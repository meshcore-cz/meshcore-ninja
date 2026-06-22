package main

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/meshcore-cz/meshpkt"
)

// wsEnvelope is the outer frame CoreScope broadcasts on its WebSocket. We only
// care about {"type":"packet", ...}; everything else is ignored.
type wsEnvelope struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

// wsPacket is the subset of a CoreScope packet record we consume. resolved_path
// is the list of full node public keys the packet traversed (sender + relays),
// used to count distinct mesh nodes. raw_hex is the wire-format packet, decoded
// locally for ADVERTs to extract node identity (pubkey, name, type, location).
type wsPacket struct {
	Hash         string   `json:"hash"`
	RawHex       string   `json:"raw_hex"`
	ObserverID   string   `json:"observer_id"`
	ObserverName string   `json:"observer_name"`
	PayloadType  *int     `json:"payload_type"`
	ResolvedPath []string `json:"resolved_path"`
}

// browserUA is sent on the handshake; some analyzers sit behind a WAF that is
// unhappy with the default Go client UA.
const browserUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
	"AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"

// Collector drives a single analyzer connection: it dials, reads the packet
// stream, feeds events into the store, and reconnects with backoff forever
// until the context is cancelled.
type Collector struct {
	net        *NetworkState
	az         *AnalyzerState
	nodes      *NodeRegistry     // global node/advert registry (nil disables advert collection)
	observers  *ObserverRegistry // global observer activity registry (nil disables it)
	origin     string
	candidates []string // ws(s) URLs to try, in preference order
}

// NewCollector builds the candidate WebSocket URLs for an analyzer. We prefer
// wss:// over ws:// (most analyzers are TLS, and plain :80 typically 301s to
// https — which looks like a "bad handshake"), and try the reverse-proxy root
// before CoreScope's registered /ws path. This makes us robust even when the
// data file declares http:// for a host that actually serves over https.
func NewCollector(net *NetworkState, az *AnalyzerState, nodes *NodeRegistry, observers *ObserverRegistry) (*Collector, error) {
	u, err := url.Parse(az.URL)
	if err != nil {
		return nil, err
	}
	if u.Host == "" {
		return nil, fmt.Errorf("missing host in %q", az.URL)
	}
	var candidates []string
	for _, scheme := range []string{"wss", "ws"} {
		for _, path := range []string{"/", "/ws"} {
			candidates = append(candidates, scheme+"://"+u.Host+path)
		}
	}
	return &Collector{
		net:        net,
		az:         az,
		nodes:      nodes,
		observers:  observers,
		origin:     "https://" + u.Host,
		candidates: candidates,
	}, nil
}

func (c *Collector) Run(ctx context.Context) {
	backoff := time.Second
	const maxBackoff = 30 * time.Second
	for {
		if ctx.Err() != nil {
			return
		}
		if err := c.connectAndRead(ctx); err != nil && ctx.Err() == nil {
			c.az.setDisconnected(err.Error())
			log.Printf("[%s/%s] %v (retry in %s)", c.net.ID, c.az.Name, err, backoff)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
		if backoff < maxBackoff {
			backoff *= 2
			if backoff > maxBackoff {
				backoff = maxBackoff
			}
		}
	}
}

func (c *Collector) connectAndRead(ctx context.Context) error {
	conn, dialed, err := c.dial(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	c.az.setConnected(nowUnix())
	log.Printf("[%s/%s] connected %s", c.net.ID, c.az.Name, dialed)
	defer c.az.setDisconnected("")

	// Close the connection when the context is cancelled so ReadMessage unblocks.
	go func() {
		<-ctx.Done()
		_ = conn.Close()
	}()

	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			return err
		}
		c.handle(data)
	}
}

// dial tries each candidate ws(s) URL until the handshake succeeds, returning
// the URL that worked.
func (c *Collector) dial(ctx context.Context) (*websocket.Conn, string, error) {
	dialer := websocket.Dialer{HandshakeTimeout: 15 * time.Second}
	header := http.Header{
		"Origin":     {c.origin},
		"User-Agent": {browserUA},
	}
	var lastErr error
	for _, target := range c.candidates {
		dctx, cancel := context.WithTimeout(ctx, 20*time.Second)
		conn, _, err := dialer.DialContext(dctx, target, header)
		cancel()
		if err == nil {
			return conn, target, nil
		}
		lastErr = err
	}
	return nil, "", lastErr
}

func (c *Collector) handle(data []byte) {
	var env wsEnvelope
	if err := json.Unmarshal(data, &env); err != nil {
		return
	}
	if env.Type != "packet" || len(env.Data) == 0 {
		return
	}
	var p wsPacket
	if err := json.Unmarshal(env.Data, &p); err != nil {
		return
	}
	hash := strings.ToLower(strings.TrimSpace(p.Hash))
	if hash == "" {
		return
	}
	typeName := ""
	if p.PayloadType != nil {
		typeName = meshpkt.PayloadType(byte(*p.PayloadType)).String()
	}
	now := nowUnix()
	c.net.Observe(c.az, Event{
		Hash:         hash,
		ObserverID:   p.ObserverID,
		ObserverName: p.ObserverName,
		PayloadType:  typeName,
		Nodes:        p.ResolvedPath,
		At:           now,
	})

	if c.observers != nil {
		c.observers.Observe(ObserverActivity{
			ObserverID: p.ObserverID,
			Name:       p.ObserverName,
			NetworkID:  c.net.ID,
			At:         now,
		})
	}

	// ADVERT packets carry node identity. Decode the wire bytes locally and feed
	// the node registry + rolling latest-adverts feed.
	if c.nodes != nil && p.PayloadType != nil && meshpkt.PayloadType(byte(*p.PayloadType)) == meshpkt.PayloadAdvert {
		c.collectAdvert(p, now)
	}
}

// collectAdvert decodes an ADVERT's raw wire bytes and records the node. Bad or
// truncated packets are silently dropped — the analyzer stream is best-effort.
func (c *Collector) collectAdvert(p wsPacket, now int64) {
	raw, err := hex.DecodeString(strings.TrimSpace(p.RawHex))
	if err != nil || len(raw) == 0 {
		return
	}
	pkt, err := meshpkt.DecodePacket(raw)
	if err != nil || pkt.Type != meshpkt.PayloadAdvert {
		return
	}
	adv, err := meshpkt.DecodeAdvertPayload(pkt.Payload)
	if err != nil {
		return
	}
	c.nodes.Observe(AdvertObservation{
		PubKey:       hex.EncodeToString(adv.PublicKey),
		Name:         adv.Name,
		NodeType:     adv.NodeType,
		HasGPS:       adv.HasGPS,
		Lat:          adv.Lat,
		Lon:          adv.Lon,
		AdvertTime:   adv.Timestamp.Unix(),
		At:           now,
		NetworkID:    c.net.ID,
		ObserverID:   p.ObserverID,
		ObserverName: p.ObserverName,
	})
}

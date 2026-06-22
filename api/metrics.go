package main

import (
	"strings"
	"sync"
	"time"
)

// rateWindowSecs is the trailing window (in 1-second buckets) over which the
// pkt/m rate is averaged. A 5-minute window smooths the rate and gives it
// fractional resolution (e.g. 7 packets in 5 min → 1.40 pkt/m).
const rateWindowSecs = 300

// rateWindow is a fixed ring of per-second counters tracking new unique
// packets. perMin extrapolates the count in the window to a per-minute rate,
// so the reported value reflects real mesh throughput rather than redundant
// re-observations.
type rateWindow struct {
	buckets  [rateWindowSecs]uint64
	lastSec  int64
	firstSec int64 // unix second of the first ever event (0 = none yet)
}

// advance zeroes any buckets that have scrolled out of the window since the
// last update, so stale counts don't linger.
func (r *rateWindow) advance(now int64) {
	if r.lastSec == 0 {
		r.lastSec = now
		return
	}
	if now <= r.lastSec {
		return
	}
	gap := now - r.lastSec
	if gap >= rateWindowSecs {
		r.buckets = [rateWindowSecs]uint64{}
	} else {
		for s := r.lastSec + 1; s <= now; s++ {
			r.buckets[s%rateWindowSecs] = 0
		}
	}
	r.lastSec = now
}

func (r *rateWindow) add(now int64) {
	r.advance(now)
	if r.firstSec == 0 {
		r.firstSec = now
	}
	r.buckets[now%rateWindowSecs]++
}

// perMin extrapolates the events in the trailing window to a per-minute rate.
// Before the window has filled (just after startup) it divides by the elapsed
// time so the rate isn't understated.
func (r *rateWindow) perMin(now int64) float64 {
	r.advance(now)
	if r.firstSec == 0 {
		return 0
	}
	var sum uint64
	for _, b := range r.buckets {
		sum += b
	}
	covered := now - r.firstSec + 1
	if covered > rateWindowSecs {
		covered = rateWindowSecs
	}
	if covered < 1 {
		covered = 1
	}
	return float64(sum) * 60 / float64(covered)
}

// ObserverStat tracks one observer node seen through a stream.
type ObserverStat struct {
	Name         string
	FirstSeen    int64
	LastSeen     int64
	Observations uint64
}

// Event is a single packet observation extracted from an analyzer's stream.
type Event struct {
	Hash         string
	ObserverID   string
	ObserverName string
	PayloadType  string
	// Nodes are the full public keys of every mesh node this packet is known to
	// have touched — the resolved path (sender + relays). Combined with the
	// observer, they feed the distinct-node gauge.
	Nodes []string
	At    int64 // unix seconds
}

// Counter accumulates dedup'd packet metrics for one scope (a single analyzer
// or a whole network). It is safe for concurrent use.
type Counter struct {
	mu sync.Mutex

	observations uint64
	unique       uint64

	seenHash     map[string]int64 // content hash -> last-seen unix (unique-packet dedup)
	seenObs      map[string]int64 // observerID|hash -> last-seen unix (observation dedup)
	observers    map[string]*ObserverStat
	nodes        map[string]int64  // node public key (lowercased) -> last-seen unix
	payloadTypes map[string]uint64 // type name -> unique-packet count

	rate       rateWindow
	lastPacket int64
}

func newCounter() *Counter {
	return &Counter{
		seenHash:     make(map[string]int64),
		seenObs:      make(map[string]int64),
		observers:    make(map[string]*ObserverStat),
		nodes:        make(map[string]int64),
		payloadTypes: make(map[string]uint64),
	}
}

// Observe records one packet observation. Two independent dedup layers apply
// within the dedup window:
//   - unique packet: first time a content hash is seen (route-independent).
//   - observation: first time a (observer, content hash) pair is seen, so a
//     single observer hearing the same flooded packet across multiple relays —
//     or multiple observers on one network reporting it — isn't double counted.
func (c *Counter) Observe(ev Event) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.lastPacket = ev.At

	// Distinct mesh nodes: every node on the resolved path plus the observer
	// that reported it. Tracked on every observation (not just unique packets)
	// since different paths/observers reveal different relays. Idle entries are
	// aged out by sweep, so this is a "nodes seen recently" gauge.
	for _, id := range ev.Nodes {
		if id != "" {
			c.nodes[strings.ToLower(id)] = ev.At
		}
	}
	if ev.ObserverID != "" {
		c.nodes[strings.ToLower(ev.ObserverID)] = ev.At
	}

	// Observation dedup by (observer, content hash).
	obsKey := ev.ObserverID + "|" + ev.Hash
	_, obsSeen := c.seenObs[obsKey]
	c.seenObs[obsKey] = ev.At

	if ev.ObserverID != "" {
		o := c.observers[ev.ObserverID]
		if o == nil {
			o = &ObserverStat{Name: ev.ObserverName, FirstSeen: ev.At}
			c.observers[ev.ObserverID] = o
		}
		if ev.ObserverName != "" {
			o.Name = ev.ObserverName
		}
		o.LastSeen = ev.At
		if !obsSeen {
			o.Observations++
		}
	}
	if !obsSeen {
		c.observations++
	}

	if ev.Hash != "" {
		if _, ok := c.seenHash[ev.Hash]; !ok {
			c.unique++
			c.rate.add(ev.At)
			if ev.PayloadType != "" {
				c.payloadTypes[ev.PayloadType]++
			}
		}
		c.seenHash[ev.Hash] = ev.At
	}
}

// sweep drops dedup entries older than the window so memory stays bounded.
// Observer entries idle longer than observerTTL are also pruned.
func (c *Counter) sweep(now, dedupWindow, observerTTL int64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for h, ts := range c.seenHash {
		if now-ts > dedupWindow {
			delete(c.seenHash, h)
		}
	}
	for k, ts := range c.seenObs {
		if now-ts > dedupWindow {
			delete(c.seenObs, k)
		}
	}
	for id, o := range c.observers {
		if now-o.LastSeen > observerTTL {
			delete(c.observers, id)
		}
	}
	for id, ts := range c.nodes {
		if now-ts > observerTTL {
			delete(c.nodes, id)
		}
	}
}

// CounterSnapshot is an immutable view of a Counter for serialization.
type CounterSnapshot struct {
	Observations  uint64            `json:"observations"`
	UniquePackets uint64            `json:"uniquePackets"`
	Observers     int               `json:"observers"`
	Nodes         int               `json:"nodes"`
	PktPerMin     float64           `json:"pktPerMin"`
	PayloadTypes  map[string]uint64 `json:"payloadTypes"`
	LastPacketAt  int64             `json:"lastPacketAt"` // unix seconds, 0 if none
}

func (c *Counter) Snapshot(now int64) CounterSnapshot {
	c.mu.Lock()
	defer c.mu.Unlock()
	pts := make(map[string]uint64, len(c.payloadTypes))
	for k, v := range c.payloadTypes {
		pts[k] = v
	}
	return CounterSnapshot{
		Observations:  c.observations,
		UniquePackets: c.unique,
		Observers:     len(c.observers),
		Nodes:         len(c.nodes),
		PktPerMin:     round2(c.rate.perMin(now)),
		PayloadTypes:  pts,
		LastPacketAt:  c.lastPacket,
	}
}

// CounterState is the durable form of a Counter, persisted to SQLite so totals
// and the node/observer gauges survive a restart. The short-lived dedup maps
// and the pkt/m rate window are intentionally omitted — they rebuild on their
// own within the dedup/rate windows.
type CounterState struct {
	Observations  uint64            `json:"observations"`
	UniquePackets uint64            `json:"uniquePackets"`
	LastPacketAt  int64             `json:"lastPacketAt"`
	PayloadTypes  map[string]uint64 `json:"payloadTypes"`
	Observers     map[string]int64  `json:"observers"` // observer id -> last-seen unix
	Nodes         map[string]int64  `json:"nodes"`     // node pubkey -> last-seen unix
}

// Export captures the counter's durable state for persistence.
func (c *Counter) Export() CounterState {
	c.mu.Lock()
	defer c.mu.Unlock()
	pts := make(map[string]uint64, len(c.payloadTypes))
	for k, v := range c.payloadTypes {
		pts[k] = v
	}
	obs := make(map[string]int64, len(c.observers))
	for id, o := range c.observers {
		obs[id] = o.LastSeen
	}
	nodes := make(map[string]int64, len(c.nodes))
	for id, ts := range c.nodes {
		nodes[id] = ts
	}
	return CounterState{
		Observations:  c.observations,
		UniquePackets: c.unique,
		LastPacketAt:  c.lastPacket,
		PayloadTypes:  pts,
		Observers:     obs,
		Nodes:         nodes,
	}
}

// Restore seeds the counter from persisted state. Called once at startup before
// any collector runs, so it merges into the (empty) live maps. Observer/node
// entries keep their persisted last-seen times, so anything that went stale
// while the process was down is pruned by the first sweep.
func (c *Counter) Restore(st CounterState) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.observations = st.Observations
	c.unique = st.UniquePackets
	if st.LastPacketAt > c.lastPacket {
		c.lastPacket = st.LastPacketAt
	}
	for k, v := range st.PayloadTypes {
		c.payloadTypes[k] = v
	}
	for id, ts := range st.Observers {
		if c.observers[id] == nil {
			c.observers[id] = &ObserverStat{FirstSeen: ts, LastSeen: ts}
		}
	}
	for id, ts := range st.Nodes {
		c.nodes[id] = ts
	}
}

func round2(f float64) float64 {
	return float64(int64(f*100+0.5)) / 100
}

// nowUnix is overridable in tests.
var nowUnix = func() int64 { return time.Now().Unix() }

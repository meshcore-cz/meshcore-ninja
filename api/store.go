package main

import "sync"

// AnalyzerState holds the live connection status and per-analyzer metrics for
// one CoreScope analyzer.
type AnalyzerState struct {
	Name    string
	URL     string
	Counter *Counter

	mu             sync.Mutex
	connected      bool
	connectedSince int64
	lastError      string
}

func (a *AnalyzerState) setConnected(now int64) {
	a.mu.Lock()
	a.connected = true
	a.connectedSince = now
	a.lastError = ""
	a.mu.Unlock()
}

func (a *AnalyzerState) setDisconnected(err string) {
	a.mu.Lock()
	a.connected = false
	a.connectedSince = 0
	if err != "" {
		a.lastError = err
	}
	a.mu.Unlock()
}

func (a *AnalyzerState) status() (connected bool, since int64, lastErr string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.connected, a.connectedSince, a.lastError
}

// NetworkState aggregates a network's own (cross-analyzer deduplicated) counter
// plus the state of each analyzer it runs.
type NetworkState struct {
	ID        string
	Name      string
	Counter   *Counter // deduplicated across all analyzers in this network
	Analyzers []*AnalyzerState
}

// Store is the immutable-after-startup registry of networks and analyzers.
// Counters inside it are individually concurrency-safe, so the map needs no
// lock once built.
type Store struct {
	Networks []*NetworkState
	byID     map[string]*NetworkState
}

func NewStore(configs []NetworkConfig) *Store {
	s := &Store{byID: make(map[string]*NetworkState)}
	for _, nc := range configs {
		ns := &NetworkState{ID: nc.ID, Name: nc.Name, Counter: newCounter()}
		for _, ac := range nc.Analyzers {
			ns.Analyzers = append(ns.Analyzers, &AnalyzerState{
				Name:    ac.Name,
				URL:     ac.URL,
				Counter: newCounter(),
			})
		}
		s.Networks = append(s.Networks, ns)
		s.byID[nc.ID] = ns
	}
	return s
}

func (s *Store) Network(id string) *NetworkState { return s.byID[id] }

// Observe routes a packet event into both the analyzer-scoped counter and the
// network-scoped (cross-analyzer deduplicated) counter.
func (n *NetworkState) Observe(a *AnalyzerState, ev Event) {
	a.Counter.Observe(ev)
	n.Counter.Observe(ev)
}

// scopeKey identifies a counter in the persistence store. Network-wide counters
// are keyed by network id; analyzer counters by "<id>\x1f<analyzer name>".
func netScopeKey(id string) string          { return "net\x1f" + id }
func azScopeKey(id, analyzer string) string { return "az\x1f" + id + "\x1f" + analyzer }

// Export captures every counter's durable state, keyed by scope, for persistence.
func (s *Store) Export() map[string]CounterState {
	out := make(map[string]CounterState, len(s.Networks)*2)
	for _, ns := range s.Networks {
		out[netScopeKey(ns.ID)] = ns.Counter.Export()
		for _, a := range ns.Analyzers {
			out[azScopeKey(ns.ID, a.Name)] = a.Counter.Export()
		}
	}
	return out
}

// Restore seeds counters from persisted state. Unknown scopes (e.g. an analyzer
// removed from the data files) are simply ignored.
func (s *Store) Restore(states map[string]CounterState) {
	for _, ns := range s.Networks {
		if st, ok := states[netScopeKey(ns.ID)]; ok {
			ns.Counter.Restore(st)
		}
		for _, a := range ns.Analyzers {
			if st, ok := states[azScopeKey(ns.ID, a.Name)]; ok {
				a.Counter.Restore(st)
			}
		}
	}
}

// sweep prunes stale dedup/observer entries across every counter.
func (s *Store) sweep(now, dedupWindow, observerTTL int64) {
	for _, ns := range s.Networks {
		ns.Counter.sweep(now, dedupWindow, observerTTL)
		for _, a := range ns.Analyzers {
			a.Counter.sweep(now, dedupWindow, observerTTL)
		}
	}
}

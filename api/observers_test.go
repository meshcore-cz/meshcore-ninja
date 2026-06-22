package main

import (
	"path/filepath"
	"testing"
)

func TestObserverRegistryObserve(t *testing.T) {
	reg := newObserverRegistry()

	// Same observer seen twice across two networks: one row, count advances,
	// network set grows, last-seen tracks the newest.
	reg.Observe(ObserverActivity{ObserverID: "o1", Name: "Alpha", NetworkID: "net-a", At: 100})
	reg.Observe(ObserverActivity{ObserverID: "o1", NetworkID: "net-b", At: 200})
	reg.Observe(ObserverActivity{ObserverID: "o2", Name: "Beta", NetworkID: "net-a", At: 150})

	// Empty observer id is ignored.
	reg.Observe(ObserverActivity{ObserverID: "", At: 999})

	obs := reg.Snapshot()
	if len(obs) != 2 {
		t.Fatalf("observers = %d, want 2", len(obs))
	}
	// Sorted by last-seen desc: o1 (200) then o2 (150).
	if obs[0].ObserverID != "o1" || obs[1].ObserverID != "o2" {
		t.Fatalf("order = %q,%q, want o1,o2", obs[0].ObserverID, obs[1].ObserverID)
	}
	o1 := obs[0]
	if o1.Name != "Alpha" {
		t.Errorf("name = %q, want Alpha (kept across empty-name report)", o1.Name)
	}
	if o1.FirstSeen != 100 || o1.LastSeen != 200 {
		t.Errorf("seen = %d/%d, want 100/200", o1.FirstSeen, o1.LastSeen)
	}
	if o1.Observations != 2 {
		t.Errorf("observations = %d, want 2", o1.Observations)
	}
	if len(o1.Networks) != 2 || o1.Networks[0] != "net-a" || o1.Networks[1] != "net-b" {
		t.Errorf("networks = %v, want [net-a net-b]", o1.Networks)
	}
}

func TestSaveLoadObservers(t *testing.T) {
	db, err := OpenDB(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatalf("OpenDB: %v", err)
	}
	defer db.Close()

	observers := []ObserverRecord{{
		ObserverID: "o1", Name: "Alpha", FirstSeen: 100, LastSeen: 200,
		Observations: 7, Networks: []string{"net-a", "net-b"},
	}}
	if err := db.SaveObservers(observers, 300); err != nil {
		t.Fatalf("SaveObservers: %v", err)
	}

	got, err := db.LoadObservers()
	if err != nil {
		t.Fatalf("LoadObservers: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("observers = %d, want 1", len(got))
	}
	o := got[0]
	if o.ObserverID != "o1" || o.Name != "Alpha" || o.LastSeen != 200 || o.Observations != 7 {
		t.Errorf("round-trip = %+v", o)
	}
	if len(o.Networks) != 2 || o.Networks[1] != "net-b" {
		t.Errorf("networks round-trip = %v", o.Networks)
	}

	// Upsert: a second save updates the same row rather than duplicating it.
	observers[0].LastSeen = 250
	observers[0].Observations = 9
	if err := db.SaveObservers(observers, 400); err != nil {
		t.Fatalf("SaveObservers 2: %v", err)
	}
	got, _ = db.LoadObservers()
	if len(got) != 1 || got[0].LastSeen != 250 || got[0].Observations != 9 {
		t.Errorf("after upsert: %+v, want one row last_seen=250 obs=9", got)
	}
}

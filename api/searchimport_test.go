package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestMergedSearchIncludesImported confirms /api/search surfaces directory-only
// nodes, dedupes them against live ones (live wins), and tags each hit's source.
func TestMergedSearchIncludesImported(t *testing.T) {
	r := newTestRegistry() // seeds bb01 "London Sensor" as a live node
	ir := newImportRegistry()
	ir.Replace([]*ImportedNode{
		// Directory-only node — must appear in results, tagged source "map".
		importedNode("ee01", "Berlin Imported", 2, 52.52, 13.40),
		// Duplicate of the live bb01 — the live node must win, the import dropped.
		importedNode("bb01", "London Dup", 4, 51.50, -0.12),
	})
	s := &Server{nodes: r, imported: ir}

	results, total, _ := s.mergedSearch(MapParams{}, 50)

	bySource := map[string]string{} // pubkey -> source
	for _, res := range results {
		if prev, dup := bySource[res.PubKey]; dup {
			t.Fatalf("pubkey %s returned twice (sources %q and %q)", res.PubKey, prev, res.Source)
		}
		bySource[res.PubKey] = res.Source
	}

	if bySource["ee01"] != "map" {
		t.Errorf("imported node ee01 source = %q, want map", bySource["ee01"])
	}
	if bySource["bb01"] != "live" {
		t.Errorf("duplicate bb01 source = %q, want live (live wins)", bySource["bb01"])
	}
	// 5 live seeds (aa01-03, bb01, cc01) + 1 directory-only (ee01) = 6.
	if total != 6 {
		t.Fatalf("total = %d, want 6 (5 live + 1 imported)", total)
	}
}

// TestMergedSearchQueryMatchesImportedName ensures a name query reaches the
// imported directory, not just the live registry.
func TestMergedSearchQueryMatchesImportedName(t *testing.T) {
	r := newNodeRegistry(defaultAdvertsPerNode)
	ir := newImportRegistry()
	ir.Replace([]*ImportedNode{importedNode("ee01", "Lonely Map Node", 2, 1, 1)})
	s := &Server{nodes: r, imported: ir}

	results, total, _ := s.mergedSearch(MapParams{Q: "lonely"}, 50)
	if total != 1 || len(results) != 1 || results[0].PubKey != "ee01" {
		t.Fatalf("got %d results (total %d), want the single imported ee01", len(results), total)
	}
	if results[0].Source != "map" {
		t.Errorf("source = %q, want map", results[0].Source)
	}
}

func TestSearchFiltersSourceNearAndSort(t *testing.T) {
	r := newTestRegistry()
	ir := newImportRegistry()
	ir.Replace([]*ImportedNode{importedNode("ee01", "Berlin Imported", 2, 52.52, 13.40)})
	s := &Server{nodes: r, imported: ir}

	results, total, _ := s.mergedSearch(MapParams{
		Types:    map[byte]bool{2: true},
		Sources:  map[string]bool{"advert": true},
		HasNear:  true,
		NearLat:  50.08,
		NearLon:  14.42,
		RadiusKM: 20,
		Sort:     "distance",
	}, 50)
	if total != 1 || len(results) != 1 || results[0].PubKey != "aa01" {
		t.Fatalf("got %+v (total %d), want only nearby live repeater aa01", results, total)
	}
	if results[0].DistanceKM != 0 {
		t.Fatalf("distanceKm = %f, want 0 for exact coordinate match", results[0].DistanceKM)
	}
}

func TestSearchOptionsAndValidation(t *testing.T) {
	s := &Server{
		store: NewStore([]NetworkConfig{{
			ID:        "meshcore-cz",
			Name:      "MeshCore CZ",
			Countries: []string{"CZ"},
			Regions:   []string{"EU868"},
			Analyzers: []AnalyzerConfig{{Name: "a", URL: "http://example.test"}},
		}}),
		nodes: newTestRegistry(),
	}

	req := httptest.NewRequest(http.MethodGet, "/api/search/options", nil)
	rr := httptest.NewRecorder()
	s.handleSearchOptions(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("options status = %d, want 200", rr.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/search?type=spaceship", nil)
	rr = httptest.NewRecorder()
	s.handleSearch(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("bad type status = %d, want 400", rr.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/search?country=CZ&type=repeater", nil)
	rr = httptest.NewRecorder()
	s.handleSearch(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("valid country status = %d, want 200", rr.Code)
	}
}

// TestHistorySigIgnoresLastAdvert confirms a sync that only advances last_advert
// is the same publish (same sig), while a name change is a new publish.
func TestHistorySigIgnoresLastAdvert(t *testing.T) {
	base := &ImportedNode{PublicKey: "ee01", AdvName: "Node", Type: 2, AdvLat: 1, AdvLon: 2, UpdatedDate: "2026-01-01T00:00:00Z"}
	base.cacheDerived()

	advanced := *base
	advanced.LastAdvert = "2026-06-29T12:00:00Z"
	advanced.cacheDerived()
	if base.historySig() != advanced.historySig() {
		t.Error("changing only last_advert produced a new sig; should be the same publish")
	}

	renamed := *base
	renamed.AdvName = "Renamed"
	if base.historySig() == renamed.historySig() {
		t.Error("changing adv_name kept the same sig; should be a new publish")
	}
}

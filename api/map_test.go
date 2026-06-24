package main

import "testing"

// seedNode inserts a node directly into the registry for map-query tests.
func seedNode(r *NodeRegistry, pubkey, name string, typ byte, lat, lon float64, lastAdvert int64, networks ...string) {
	r.nodes[pubkey] = &NodeRecord{
		PubKey:       pubkey,
		Name:         name,
		NodeType:     typ,
		HasGPS:       true,
		Lat:          lat,
		Lon:          lon,
		LastAdvertAt: lastAdvert,
		AdvertCount:  1,
		Networks:     networks,
	}
}

// featureCounts tallies cluster vs node features and the total node-equivalent
// population represented (clusters contribute their count).
func featureCounts(res MapResult) (clusters, nodes, population int) {
	for _, f := range res.Features {
		if f.Properties["cluster"] == true {
			clusters++
			population += f.Properties["count"].(int)
		} else {
			nodes++
			population++
		}
	}
	return
}

func newTestRegistry() *NodeRegistry {
	r := newNodeRegistry(defaultAdvertsPerNode)
	// A tight cluster near Prague (within one low-zoom grid cell).
	seedNode(r, "aa01", "Prague Repeater", 2, 50.08, 14.42, 1000, "meshcore-cz")
	seedNode(r, "aa02", "Prague Chat", 1, 50.09, 14.43, 1000, "meshcore-cz")
	seedNode(r, "aa03", "Prague Room", 3, 50.10, 14.44, 500, "meshcore-cz")
	// A far-away lone node in the UK (its own cell).
	seedNode(r, "bb01", "London Sensor", 4, 51.50, -0.12, 1000, "eu-uk-narrow")
	// A node without GPS must never appear.
	r.nodes["cc01"] = &NodeRecord{PubKey: "cc01", Name: "No GPS", NodeType: 2, HasGPS: false}
	return r
}

func TestMapQueryClustersAtLowZoom(t *testing.T) {
	r := newTestRegistry()
	res := r.MapQuery(MapParams{Zoom: 3, HasBBox: true, BBox: [4]float64{-25, 34, 45, 72}})

	clusters, nodes, pop := featureCounts(res)
	if clusters != 1 {
		t.Fatalf("expected the 3 Prague nodes to collapse into 1 cluster, got %d clusters", clusters)
	}
	if nodes != 1 {
		t.Fatalf("expected the lone London node to stay individual, got %d node features", nodes)
	}
	if pop != 4 {
		t.Fatalf("expected total population 4 (3 GPS Prague + 1 London), got %d", pop)
	}
}

func TestMapQueryIndividualNodesAtHighZoom(t *testing.T) {
	r := newTestRegistry()
	res := r.MapQuery(MapParams{Zoom: 12, HasBBox: true, BBox: [4]float64{14.0, 49.9, 14.6, 50.2}})
	clusters, nodes, _ := featureCounts(res)
	if clusters != 0 {
		t.Fatalf("high zoom should never cluster, got %d clusters", clusters)
	}
	if nodes != 3 {
		t.Fatalf("expected 3 individual Prague nodes in the bbox, got %d", nodes)
	}
}

func TestMapQueryBBoxExcludesOutside(t *testing.T) {
	r := newTestRegistry()
	// Bbox around Prague only — London must be excluded.
	res := r.MapQuery(MapParams{Zoom: 12, HasBBox: true, BBox: [4]float64{14.0, 49.9, 14.6, 50.2}})
	for _, f := range res.Features {
		if f.Properties["pubkey"] == "bb01" {
			t.Fatal("London node leaked into a Prague-only bbox")
		}
	}
}

func TestMapQueryFilters(t *testing.T) {
	r := newTestRegistry()
	full := [4]float64{-25, 34, 45, 72}

	// Type filter: only repeaters (type 2). At high zoom, individual nodes.
	res := r.MapQuery(MapParams{Zoom: 12, HasBBox: true, BBox: full, Types: map[byte]bool{2: true}})
	if _, nodes, _ := featureCounts(res); nodes != 1 {
		t.Fatalf("type=repeater should yield 1 node, got %d", nodes)
	}

	// Network filter: only the UK network.
	res = r.MapQuery(MapParams{Zoom: 12, HasBBox: true, BBox: full, Networks: map[string]bool{"eu-uk-narrow": true}})
	if _, nodes, _ := featureCounts(res); nodes != 1 {
		t.Fatalf("network=eu-uk-narrow should yield 1 node, got %d", nodes)
	}

	// Since filter: drop the older Prague Room (lastAdvert 500).
	res = r.MapQuery(MapParams{Zoom: 12, HasBBox: true, BBox: full, Since: 600})
	for _, f := range res.Features {
		if f.Properties["pubkey"] == "aa03" {
			t.Fatal("since filter should have dropped the stale node aa03")
		}
	}
}

func TestMapQuerySearchIgnoresBBox(t *testing.T) {
	r := newTestRegistry()
	// Bbox around Prague, but search for the London node by name — it must still
	// be returned so the client can fly to it.
	res := r.MapQuery(MapParams{Zoom: 3, HasBBox: true, BBox: [4]float64{14.0, 49.9, 14.6, 50.2}, Q: "london"})
	clusters, nodes, _ := featureCounts(res)
	if clusters != 0 || nodes != 1 {
		t.Fatalf("search should return 1 individual node regardless of bbox, got %d clusters %d nodes", clusters, nodes)
	}
	if res.Features[0].Properties["pubkey"] != "bb01" {
		t.Fatalf("search matched the wrong node: %v", res.Features[0].Properties["pubkey"])
	}

	// Pubkey-prefix search.
	res = r.MapQuery(MapParams{Zoom: 3, Q: "aa0"})
	if _, nodes, _ := featureCounts(res); nodes != 3 {
		t.Fatalf("pubkey-prefix 'aa0' should match 3 nodes, got %d", nodes)
	}
}

func TestMapQueryLimitCaps(t *testing.T) {
	r := newTestRegistry()
	res := r.MapQuery(MapParams{Zoom: 12, HasBBox: true, BBox: [4]float64{-25, 34, 45, 72}, Limit: 2})
	if !res.Capped {
		t.Fatal("expected Capped=true when limit truncates the result")
	}
	if len(res.Features) != 2 {
		t.Fatalf("expected exactly 2 features under limit=2, got %d", len(res.Features))
	}
}

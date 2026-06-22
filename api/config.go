package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"gopkg.in/yaml.v3"
)

// AnalyzerConfig is one CoreScope analyzer instance belonging to a network.
type AnalyzerConfig struct {
	Name string
	URL  string
}

// NetworkConfig is the subset of a data/networks/<id>/network.yaml we care
// about: its identity and the analyzers it runs.
type NetworkConfig struct {
	ID        string
	Name      string
	Analyzers []AnalyzerConfig
}

// networkFile mirrors the relevant fields of network.yaml for decoding.
type networkFile struct {
	Name      string `yaml:"name"`
	Analyzers []struct {
		Name string `yaml:"name"`
		URL  string `yaml:"url"`
	} `yaml:"analyzers"`
}

// LoadNetworks walks <dataDir>/networks/*/network.yaml and returns every
// network that declares at least one analyzer. The id is the directory name,
// matching how the frontend identifies networks.
func LoadNetworks(dataDir string) ([]NetworkConfig, error) {
	root := filepath.Join(dataDir, "networks")
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", root, err)
	}

	var out []NetworkConfig
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		path := filepath.Join(root, e.Name(), "network.yaml")
		raw, err := os.ReadFile(path)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return nil, fmt.Errorf("reading %s: %w", path, err)
		}
		var nf networkFile
		if err := yaml.Unmarshal(raw, &nf); err != nil {
			return nil, fmt.Errorf("parsing %s: %w", path, err)
		}
		if len(nf.Analyzers) == 0 {
			continue
		}
		nc := NetworkConfig{ID: e.Name(), Name: nf.Name}
		for _, a := range nf.Analyzers {
			if a.URL == "" {
				continue
			}
			nc.Analyzers = append(nc.Analyzers, AnalyzerConfig{Name: a.Name, URL: a.URL})
		}
		if len(nc.Analyzers) > 0 {
			out = append(out, nc)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}

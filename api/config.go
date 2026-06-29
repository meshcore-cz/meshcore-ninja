package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

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
	Countries []string
	Regions   []string
}

// networkFile mirrors the relevant fields of network.yaml for decoding.
type networkFile struct {
	Name     string `yaml:"name"`
	Coverage struct {
		Countries []string `yaml:"countries"`
	} `yaml:"coverage"`
	Radio struct {
		Frequency any    `yaml:"frequency"`
		Region    string `yaml:"region"`
	} `yaml:"radio"`
	Radios []struct {
		Frequency any    `yaml:"frequency"`
		Region    string `yaml:"region"`
	} `yaml:"radios"`
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
		seenCountries := map[string]bool{}
		for _, cc := range nf.Coverage.Countries {
			cc = strings.ToUpper(strings.TrimSpace(cc))
			if len(cc) == 2 && !seenCountries[cc] {
				seenCountries[cc] = true
				nc.Countries = append(nc.Countries, cc)
			}
		}
		seenRegions := map[string]bool{}
		addRegion := func(v any, explicit string) {
			r := strings.ToUpper(strings.TrimSpace(explicit))
			if r == "" && v != nil {
				r = strings.ToUpper(strings.TrimSpace(fmt.Sprint(v)))
				switch strings.TrimSuffix(r, "MHZ") {
				case "868":
					r = "EU868"
				case "915":
					r = "US915"
				case "433":
					r = "EU433"
				}
			}
			if r != "" && !seenRegions[r] {
				seenRegions[r] = true
				nc.Regions = append(nc.Regions, r)
			}
		}
		addRegion(nf.Radio.Frequency, nf.Radio.Region)
		for _, r := range nf.Radios {
			addRegion(r.Frequency, r.Region)
		}
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

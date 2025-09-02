package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
)

// SwitchProfile represents the JSON structure for switch profiles
type SwitchProfile struct {
	ModelID   string            `json:"modelId"`
	Roles     []string          `json:"roles"`
	Ports     Ports             `json:"ports"`
	Profiles  Profiles          `json:"profiles"`
	Meta      Meta              `json:"meta"`
}

type Ports struct {
	EndpointAssignable []string `json:"endpointAssignable"`
	FabricAssignable   []string `json:"fabricAssignable"`
}

type Profiles struct {
	Endpoint PortProfile `json:"endpoint"`
	Uplink   PortProfile `json:"uplink"`
}

type PortProfile struct {
	PortProfile *string `json:"portProfile"`
	SpeedGbps   int     `json:"speedGbps"`
}

type Meta struct {
	Source  string `json:"source"`
	Version string `json:"version"`
}

// generateDS2000Profile creates the DS2000 leaf switch profile
func generateDS2000Profile() SwitchProfile {
	endpointPortProfile := "SFP28-25G"
	uplinkPortProfile := "QSFP28-100G"
	
	return SwitchProfile{
		ModelID: "celestica-ds2000",
		Roles:   []string{"leaf"},
		Ports: Ports{
			EndpointAssignable: []string{"E1/1-48"},
			FabricAssignable:   []string{"E1/49-56"},
		},
		Profiles: Profiles{
			Endpoint: PortProfile{
				PortProfile: &endpointPortProfile,
				SpeedGbps:   25,
			},
			Uplink: PortProfile{
				PortProfile: &uplinkPortProfile,
				SpeedGbps:   100,
			},
		},
		Meta: Meta{
			Source:  "switch_profile.go",
			Version: "v0.3.0",
		},
	}
}

// generateDS3000Profile creates the DS3000 spine switch profile
func generateDS3000Profile() SwitchProfile {
	uplinkPortProfile := "QSFP28-100G"
	
	return SwitchProfile{
		ModelID: "celestica-ds3000",
		Roles:   []string{"spine"},
		Ports: Ports{
			EndpointAssignable: []string{},
			FabricAssignable:   []string{"E1/1-32"},
		},
		Profiles: Profiles{
			Endpoint: PortProfile{
				PortProfile: nil,
				SpeedGbps:   0,
			},
			Uplink: PortProfile{
				PortProfile: &uplinkPortProfile,
				SpeedGbps:   100,
			},
		},
		Meta: Meta{
			Source:  "switch_profile.go",
			Version: "v0.3.0",
		},
	}
}

// writeProfileToFile writes a switch profile to a JSON file with stable ordering
func writeProfileToFile(profile SwitchProfile, outputDir, filename string) error {
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Marshal with indentation for readability
	data, err := json.MarshalIndent(profile, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal profile: %w", err)
	}

	filePath := filepath.Join(outputDir, filename)
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write file %s: %w", filePath, err)
	}

	fmt.Printf("Generated profile: %s\n", filePath)
	return nil
}

func main() {
	var outputDir string
	flag.StringVar(&outputDir, "output", "../../src/fixtures/switch-profiles", "Output directory for generated profiles")
	flag.Parse()

	fmt.Println("HNC Profile Dump - Generating switch profiles...")

	// Generate DS2000 profile
	ds2000 := generateDS2000Profile()
	if err := writeProfileToFile(ds2000, outputDir, "ds2000.json"); err != nil {
		fmt.Fprintf(os.Stderr, "Error generating DS2000 profile: %v\n", err)
		os.Exit(1)
	}

	// Generate DS3000 profile
	ds3000 := generateDS3000Profile()
	if err := writeProfileToFile(ds3000, outputDir, "ds3000.json"); err != nil {
		fmt.Fprintf(os.Stderr, "Error generating DS3000 profile: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Profile generation completed successfully!")
}
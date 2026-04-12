package hpoe

/*
 * HPOE (Heuristic Page Optimization Engine) - Go Proposal
 * Excellent fit for continuous Goroutine monitoring.
 */

import (
	"fmt"
	"strings"
	"time"
)

type Tier string

const (
	High    Tier = "high"
	Mid     Tier = "mid"
	Low     Tier = "low"
	VeryLow Tier = "very-low"
)

type HPOE struct {
	CurrentTier Tier
	isMobile    bool
}

func NewHPOE() *HPOE {
	h := &HPOE{CurrentTier: High, isMobile: false}
	h.EvaluateHardware()
	go h.monitorDegradation()
	return h
}

func (h *HPOE) EvaluateHardware() {
	gpuInfo := strings.ToLower(mockGetGpuString())
	cores := mockGetCoreCount()

	if strings.Contains(gpuInfo, "nvidia") || strings.Contains(gpuInfo, "rtx") {
		h.CurrentTier = High
	} else if strings.Contains(gpuInfo, "adreno") || strings.Contains(gpuInfo, "mali") {
		h.CurrentTier = Mid
	} else {
		h.CurrentTier = Low
	}

	if cores <= 2 {
		h.CurrentTier = Low
	}
}

func (h *HPOE) downgradeTier() {
	switch h.CurrentTier {
	case High:
		h.CurrentTier = Mid
	case Mid:
		h.CurrentTier = Low
	case Low:
		h.CurrentTier = VeryLow
	}
	fmt.Printf("[HPOE] Emergency Thread Downgrade: %s\n", h.CurrentTier)
}

func (h *HPOE) monitorDegradation() {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	sustainedDrops := 0

	for range ticker.C {
		if h.CurrentTier == VeryLow {
			return
		}

		fps := mockGetAppFps()
		floor := 38
		limit := 6

		if h.CurrentTier == High {
			floor = 45
			limit = 4
		}

		if fps < floor {
			sustainedDrops++
		} else {
			if sustainedDrops-2 > 0 {
				sustainedDrops -= 2
			} else {
				sustainedDrops = 0
			}
		}

		if sustainedDrops >= limit {
			h.downgradeTier()
			sustainedDrops = 0
		}
	}
}

func mockGetGpuString() string { return "Nvidia RTX" }
func mockGetCoreCount() int    { return 12 }
func mockGetAppFps() int       { return 60 }

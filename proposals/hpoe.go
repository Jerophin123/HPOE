package hpoe

/*
 * HPOE (Heuristic Page Optimization Engine) - Go Proposal
 * Full Regex Matrix & Battery Saver Live Degradation Trackers.
 */

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
	"runtime"
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

func NewHPOE(isMobile bool) *HPOE {
	h := &HPOE{isMobile: isMobile}
	h.EvaluateHardware()
	go h.monitorDegradation()
	return h
}

func (h *HPOE) EvaluateHardware() {
	cores := runtime.NumCPU()
	memoryGB := 16 
	maxTextureSize := 8192 
	
	raw := strings.ToLower(mockGetGpuString())
	// Strip trademarks like (R) or (TM) that break rigid regex matching
	reClean := regexp.MustCompile(`\((r|tm)\)|graphics`)
	renderer := strings.TrimSpace(reClean.ReplaceAllString(raw, ""))

	tier := High

	has := func(s string) bool { return strings.Contains(renderer, s) }
	match := func(pat string) bool { return regexp.MustCompile(pat).MatchString(renderer) }

	// ---------------------------------------------------------
	// MASSIVE HEURISTIC GPU CLASSIFICATION MATRIX
	// ---------------------------------------------------------

	// 1. APPLE SILICON & A-SERIES
	if has("apple") {
		if match(`m[1-9]`) {
			if has("max") || has("pro") || has("ultra") { tier = High } else { tier = Mid }
		} else {
			if cores >= 6 && maxTextureSize >= 8192 { tier = High } else { tier = Mid }
		}
	} 
	// 2. NVIDIA DESKTOP & LAPTOP
	else if has("nvidia") || has("geforce") || has("quadro") {
		if match(`rtx\s*[2-9][0-9]{3}`) || has("titan") || match(`quadro\s*rtx`) { tier = High } else
		if match(`gtx\s*(?:10[6-9][0-9]|16[5-9][0-9]|9[8-9][0-9])`) { tier = High } else
		if match(`gtx\s*(?:1050|970|960|950|780)`) { tier = Mid } else
		if match(`gtx\s*(?:4|5|6)[0-9]{2}`) || match(`gt\s*[0-9]+`) || match(`[7-9][1-4]0m`) || match(`mx[1-4][0-9]{2}`) { tier = Low } else { tier = Mid }
	} 
	// 3. AMD RADEON
	else if has("amd") || has("radeon") {
		if match(`rx\s*[5-8][0-9]{3}`) || match(`vega\s*(?:56|64)`) || has("radeon pro") { tier = High } else
		if match(`rx\s*(?:4[0-9]{2}|5[7-9][0-9])`) || match(`6[6-9]0m`) { tier = Mid } else { tier = Low }
	} 
	// 4. INTEL GRAPHICS
	else if has("intel") {
		if match(`arc\s*a[3-7][0-9]{2}`) || (has("iris") && has("xe")) || match(`iris\s*(?:plus|pro)`) { tier = Mid } else { tier = Low }
	} 
	// 5. QUALCOMM ADRENO / SNAPDRAGON (ANDROID)
	else if has("adreno") || has("snapdragon") {
		reAdreno := regexp.MustCompile(`adreno\s*([0-9]{3})`)
		series := 0
		if m := reAdreno.FindStringSubmatch(renderer); len(m) > 1 { series, _ = strconv.Atoi(m[1]) }
		if series >= 800 || has("snapdragon 8 elite") || has("elite") || has("snapdragon 8 gen") { tier = High } else
		if series >= 650 || has("snapdragon 8") || has("snapdragon 7") || (series == 0 && cores >= 8 && maxTextureSize >= 8192) || has("snapdragon") { tier = Mid } else { tier = Low }
	} 
	// 6. ARM MALI (ANDROID)
	else if has("mali") {
		if has("immortalis") || match(`g[7-9][1-9][0-9]`) || match(`g7[7-9]`) { tier = High } else
		if match(`g[7-9][0-9]`) { tier = Mid } else { tier = Low }
	} 
	// 7. SAMSUNG XCLIPSE / EXYNOS (MOBILE)
	else if has("xclipse") || has("exynos") {
		if has("xclipse") {
			series := 0
			if m := regexp.MustCompile(`xclipse\s*([0-9]{3})`).FindStringSubmatch(renderer); len(m) > 1 { series, _ = strconv.Atoi(m[1]) }
			if series >= 920 { tier = High } else { tier = Mid }
		} else {
			if cores >= 8 && maxTextureSize >= 8192 { tier = High } else { tier = Low }
		}
	} 
	// 8. MEDIATEK (DIMENSITY / HELIO)
	else if has("mediatek") || has("dimensity") || has("helio") {
		if has("dimensity 9") || has("dimensity 8") { tier = High } else
		if has("dimensity") || has("helio g9") || (cores >= 8 && maxTextureSize >= 8192) { tier = Mid } else { tier = Low }
	} 
	// 9. POWERVR / UNISOC / SPREADTRUM
	else if has("powervr") || has("unisoc") || has("spreadtrum") || has("tigert") {
		tier = Low
	} 
	// 10. FALLBACK FOR UNKNOWN GPUs
	else {
		tier = Low
	}

	// Hard limits and Accessibility Overrides
	if cores <= 2 && memoryGB <= 2 { tier = VeryLow } else
	if cores <= 2 || memoryGB <= 2 { tier = Low } else // Only demote on extremely constrained hardware
	if memoryGB <= 3 && tier == High { tier = Mid } // <=3GB memory can't sustain high-tier

	// Absolute fail-safe: Mobile devices NEVER get "High" tier effects.
	if h.isMobile && tier == High { tier = Mid }
	h.CurrentTier = tier
}

// ---------------------------------------------------------
// LIVE V-SYNC DEGRADATION MONITOR (FPS SAFETY NET)
// Tuned to avoid false-positive downgrades on mid-tier hardware
// ---------------------------------------------------------
func (h *HPOE) monitorDegradation() {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	sustainedDrops := 0
	detectedBaseline := 60 // Assume standard 60fps by default
	batterySaverTicks := 0
	graceTicks := 0
	var measurements []int

	for range ticker.C {
		if h.CurrentTier == VeryLow || h.CurrentTier == Low { return }
		
		fps := mockGetAppFps()
		maxFrameDelta := mockGetMaxFrameDelta() // Tracks maximum MS between consecutive frames

		graceTicks++
		if graceTicks <= 3 {
			// Wait for initial hydration to clear, then sample naturally achievable FPS
			if graceTicks > 1 && fps > 0 { measurements = append(measurements, fps) }
			continue
		}

		// Lock in baseline detection once grace period concludes
		if len(measurements) > 0 && detectedBaseline == 60 {
			sum := 0
			for _, m := range measurements { sum += m }
			avg := float64(sum) / float64(len(measurements))
			// Accurately verify 30fps: average ~30 AND frame pacing is universally stable
			if avg >= 28 && avg <= 34 && maxFrameDelta < 45 { detectedBaseline = 30 }
		}

		// Dynamic MID-SESSION Battery Saver Detection
		if detectedBaseline == 60 && fps >= 28 && fps <= 33 && maxFrameDelta < 45 {
			batterySaverTicks++
			if batterySaverTicks >= 2 {
				detectedBaseline = 30
				sustainedDrops = 0 // Wipe lag penalties incurred during the detection phase
			}
		} else if detectedBaseline == 30 && fps >= 45 {
			detectedBaseline = 60
			sustainedDrops = 0
			batterySaverTicks = 0
		} else if detectedBaseline == 60 && (fps < 28 || fps > 33 || maxFrameDelta >= 45) {
			if batterySaverTicks > 0 { batterySaverTicks-- }
		}

		// Battery Saver Mode active: Re-assign threshold
		floor := 38
		limit := 6
		if detectedBaseline == 30 {
			if h.CurrentTier == High { floor = 22 } else { floor = 18 }
		} else {
			if h.CurrentTier == High { floor = 45; limit = 4 }
		}

		if fps < floor { sustainedDrops++ } else {
			if sustainedDrops-2 > 0 { sustainedDrops -= 2 } else { sustainedDrops = 0 }
		}
		
		if sustainedDrops >= limit {
			if h.CurrentTier == High { h.CurrentTier = Mid } else { h.CurrentTier = Low }
			fmt.Printf("[HPOE] Emergency Thread Downgrade: %s\n", h.CurrentTier)
			sustainedDrops = 0
		}
	}
}

func mockGetGpuString() string { return "Nvidia RTX 4070" }
func mockGetAppFps() int       { return 60 }
func mockGetMaxFrameDelta() int { return 16 }

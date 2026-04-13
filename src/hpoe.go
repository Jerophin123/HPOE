package hpoe

/*
 * HPOE (Heuristic Page Optimization Engine) - Go Proposal
 * Full Regex Matrix, Specs Extraction & Battery Saver Trackers.
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

type HardwareSpecs struct {
	Vendor         string
	Architecture   string
	Type           string
	EstimatedClass string
}

type HPOE struct {
	CurrentTier Tier
	Specs       HardwareSpecs
	isMobile    bool
}

func NewHPOE(isMobile bool) *HPOE {
	h := &HPOE{
		isMobile: isMobile,
		Specs: HardwareSpecs{Vendor: "Unknown", Architecture: "Unknown", Type: "Unknown", EstimatedClass: "Unknown"},
	}
	h.EvaluateHardware()
	go h.monitorDegradation()
	return h
}

func (h *HPOE) EvaluateHardware() {
	cores := runtime.NumCPU()
	memoryGB := 16 
	maxTextureSize := 8192 
	
	raw := strings.ToLower(mockGetGpuString())
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
		h.Specs.Vendor = "Apple"
		if match(`m[1-9]`) {
			h.Specs.Architecture = "M-Series Silicon"
			h.Specs.Type = "Integrated"
			if has("max") || has("pro") || has("ultra") { 
				h.Specs.EstimatedClass = "High-End"
				tier = High 
			} else { 
				h.Specs.EstimatedClass = "Mid-Range"
				tier = Mid 
			}
		} else {
			h.Specs.Architecture = "A-Series Silicon"
			h.Specs.Type = "Mobile"
			if cores >= 6 && maxTextureSize >= 8192 { 
				h.Specs.EstimatedClass = "High-End"
				tier = High 
			} else { 
				h.Specs.EstimatedClass = "Mid-Range"
				tier = Mid 
			}
		}
	} 
	// 2. NVIDIA DESKTOP & LAPTOP
	else if has("nvidia") || has("geforce") || has("quadro") {
		h.Specs.Vendor = "NVIDIA"
		h.Specs.Type = "Discrete"
		if match(`rtx\s*[2-9][0-9]{3}`) || has("titan") || match(`quadro\s*rtx`) { 
			h.Specs.Architecture = "RTX / Ampere / Ada / Turing"
			h.Specs.EstimatedClass = "High-End"
			tier = High 
		} else if match(`gtx\s*(?:10[6-9][0-9]|16[5-9][0-9]|9[8-9][0-9])`) { 
			h.Specs.Architecture = "GTX High/Mid"
			h.Specs.EstimatedClass = "High-End"
			tier = High 
		} else if match(`gtx\s*(?:1050|970|960|950|780)`) { 
			h.Specs.Architecture = "GTX Legacy Mid"
			h.Specs.EstimatedClass = "Mid-Range"
			tier = Mid 
		} else if match(`gtx\s*(?:4|5|6)[0-9]{2}`) || match(`gt\s*[0-9]+`) || match(`[7-9][1-4]0m`) || match(`mx[1-4][0-9]{2}`) { 
			h.Specs.Architecture = "Legacy / Low-End Mobile"
			h.Specs.EstimatedClass = "Budget/Legacy"
			tier = Low 
		} else { 
			h.Specs.Architecture = "Unknown NVIDIA"
			h.Specs.EstimatedClass = "Mid-Range"
			tier = Mid 
		}
	} 
	// 3. AMD RADEON
	else if has("amd") || has("radeon") {
		h.Specs.Vendor = "AMD"
		if match(`rx\s*[5-8][0-9]{3}`) || match(`vega\s*(?:56|64)`) || has("radeon pro") { 
			h.Specs.Architecture = "RDNA / High-End Vega"
			h.Specs.Type = "Discrete"
			h.Specs.EstimatedClass = "High-End"
			tier = High 
		} else if match(`rx\s*(?:4[0-9]{2}|5[7-9][0-9])`) || match(`6[6-9]0m`) { 
			h.Specs.Architecture = "Polaris / Modern APU"
			h.Specs.Type = "Integrated"
			h.Specs.EstimatedClass = "Mid-Range"
			tier = Mid 
		} else { 
			h.Specs.Architecture = "Legacy GCN or Budget APU"
			h.Specs.Type = "Integrated"
			h.Specs.EstimatedClass = "Budget/Legacy"
			tier = Low 
		}
	} 
	// 4. INTEL GRAPHICS
	else if has("intel") {
		h.Specs.Vendor = "Intel"
		if match(`arc\s*a[3-7][0-9]{2}`) { 
			h.Specs.Architecture = "Arc Alchemist"
			h.Specs.Type = "Discrete"
			h.Specs.EstimatedClass = "Mid-Range"
			tier = Mid 
		} else if (has("iris") && has("xe")) || match(`iris\s*(?:plus|pro)`) { 
			h.Specs.Architecture = "Iris Xe/Plus"
			h.Specs.Type = "Integrated"
			h.Specs.EstimatedClass = "Mid-Range"
			tier = Mid 
		} else { 
			h.Specs.Architecture = "UHD / HD Legacy"
			h.Specs.Type = "Integrated"
			h.Specs.EstimatedClass = "Budget/Legacy"
			tier = Low 
		}
	} 
	// 5. QUALCOMM ADRENO / SNAPDRAGON (ANDROID)
	else if has("adreno") || has("snapdragon") {
		h.Specs.Vendor = "Qualcomm"
		h.Specs.Type = "Mobile"
		reAdreno := regexp.MustCompile(`adreno\s*([0-9]{3})`)
		series := 0
		if m := reAdreno.FindStringSubmatch(renderer); len(m) > 1 { series, _ = strconv.Atoi(m[1]) }
		if series >= 800 || has("snapdragon 8 elite") || has("elite") || has("snapdragon 8 gen") { 
			h.Specs.Architecture = fmt.Sprintf("Adreno %d", series)
			h.Specs.EstimatedClass = "High-End"
			tier = High 
		} else if series >= 650 || has("snapdragon 8") || has("snapdragon 7") || (series == 0 && cores >= 8 && maxTextureSize >= 8192) || has("snapdragon") { 
			h.Specs.Architecture = fmt.Sprintf("Adreno %d", series)
			h.Specs.EstimatedClass = "Mid-Range"
			tier = Mid 
		} else { 
			h.Specs.Architecture = "Adreno Legacy"
			h.Specs.EstimatedClass = "Budget/Legacy"
			tier = Low 
		}
	} 
	// 6. ARM MALI (ANDROID)
	else if has("mali") {
		h.Specs.Vendor = "ARM"
		h.Specs.Type = "Mobile"
		if has("immortalis") || match(`g[7-9][1-9][0-9]`) || match(`g7[7-9]`) { 
			h.Specs.Architecture = "Mali Valhall / Immortalis"
			h.Specs.EstimatedClass = "High-End"
			tier = High 
		} else if match(`g[7-9][0-9]`) { 
			h.Specs.Architecture = "Mali Valhall Mid"
			h.Specs.EstimatedClass = "Mid-Range"
			tier = Mid 
		} else { 
			h.Specs.Architecture = "Legacy Mali"
			h.Specs.EstimatedClass = "Budget/Legacy"
			tier = Low 
		}
	} 
	// 7. SAMSUNG XCLIPSE / EXYNOS (MOBILE)
	else if has("xclipse") || has("exynos") {
		h.Specs.Vendor = "Samsung"
		h.Specs.Type = "Mobile"
		if has("xclipse") {
			series := 0
			if m := regexp.MustCompile(`xclipse\s*([0-9]{3})`).FindStringSubmatch(renderer); len(m) > 1 { series, _ = strconv.Atoi(m[1]) }
			h.Specs.Architecture = fmt.Sprintf("Xclipse %d", series)
			if series >= 920 { 
				h.Specs.EstimatedClass = "High-End"
				tier = High 
			} else { 
				h.Specs.EstimatedClass = "Mid-Range"
				tier = Mid 
			}
		} else {
			if cores >= 8 && maxTextureSize >= 8192 { 
				h.Specs.Architecture = "Exynos Flagship"
				h.Specs.EstimatedClass = "High-End"
				tier = High 
			} else { 
				h.Specs.Architecture = "Exynos Legacy"
				h.Specs.EstimatedClass = "Budget/Legacy"
				tier = Low 
			}
		}
	} 
	// 8. MEDIATEK (DIMENSITY / HELIO)
	else if has("mediatek") || has("dimensity") || has("helio") {
		h.Specs.Vendor = "MediaTek"
		h.Specs.Type = "Mobile"
		if has("dimensity 9") || has("dimensity 8") { 
			h.Specs.Architecture = "Dimensity Flagship"
			h.Specs.EstimatedClass = "High-End"
			tier = High 
		} else if has("dimensity") || has("helio g9") || (cores >= 8 && maxTextureSize >= 8192) { 
			h.Specs.Architecture = "Dimensity / High-End Helio"
			h.Specs.EstimatedClass = "Mid-Range"
			tier = Mid 
		} else { 
			h.Specs.Architecture = "Helio Legacy"
			h.Specs.EstimatedClass = "Budget/Legacy"
			tier = Low 
		}
	} 
	// 9. POWERVR / UNISOC / SPREADTRUM
	else if has("powervr") || has("unisoc") || has("spreadtrum") || has("tigert") {
		h.Specs.Architecture = "Legacy Budget"
		h.Specs.EstimatedClass = "Budget/Legacy"
		tier = Low
	} 
	// 10. FALLBACK FOR UNKNOWN GPUs
	else {
		h.Specs.Architecture = "Unknown (Fallback)"
		h.Specs.EstimatedClass = "Budget/Legacy"
		tier = Low
	}

	// Hard limits and Accessibility Overrides
	if cores < 3 && memoryGB < 3 { tier = VeryLow } else
	if cores <= 2 || memoryGB <= 2 { tier = Low } else 
	if memoryGB <= 3 && tier == High { tier = Mid } 

	// Absolute fail-safe
	if h.isMobile && tier == High { tier = Mid }
	h.CurrentTier = tier
}

// ---------------------------------------------------------
// LIVE V-SYNC DEGRADATION MONITOR (FPS SAFETY NET)
// ---------------------------------------------------------
func (h *HPOE) monitorDegradation() {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	sustainedDrops := 0
	detectedBaseline := 60 
	batterySaverTicks := 0
	graceTicks := 0
	isBaselineLocked := false
	var measurements []int

	for range ticker.C {
		if h.CurrentTier == VeryLow || h.CurrentTier == Low { return }
		
		fps := mockGetAppFps()
		maxFrameDelta := mockGetMaxFrameDelta() 

		graceTicks++
		if graceTicks <= 3 {
			if graceTicks > 1 && fps > 0 { measurements = append(measurements, fps) }
			continue
		}

		if len(measurements) > 0 && !isBaselineLocked {
			sum := 0
			for _, m := range measurements { sum += m }
			avg := float64(sum) / float64(len(measurements))
			if avg > 65 {
				detectedBaseline = int(avg + 0.5)
			} else if avg >= 28 && avg <= 34 && maxFrameDelta < 45 {
				detectedBaseline = 30
			} else {
				detectedBaseline = 60
			}
			isBaselineLocked = true
		}

		if detectedBaseline >= 60 && fps >= 28 && fps <= 33 && maxFrameDelta < 45 {
			batterySaverTicks++
			if batterySaverTicks >= 2 {
				detectedBaseline = 30
				sustainedDrops = 0 
			}
		} else if detectedBaseline == 30 && fps >= 45 {
			if fps > 65 { detectedBaseline = fps } else { detectedBaseline = 60 }
			sustainedDrops = 0
			batterySaverTicks = 0
		} else if detectedBaseline >= 60 && (fps < 28 || fps > 33 || maxFrameDelta >= 45) {
			if batterySaverTicks > 0 { batterySaverTicks-- }
		}

		floor := 40
		limit := 3
		if detectedBaseline == 30 {
			floor = 22
		}

		if fps < floor { sustainedDrops++ } else {
			if sustainedDrops-2 > 0 { sustainedDrops -= 2 } else { sustainedDrops = 0 }
		}
		
		if sustainedDrops >= limit {
			if h.CurrentTier == High { h.CurrentTier = Mid } else { h.CurrentTier = Low }
			fmt.Printf("[Hardware Profiler] Emergency Thread Downgrade: %s\n", h.CurrentTier)
			sustainedDrops = 0
		}
	}
}

func mockGetGpuString() string { return "Nvidia RTX 4070" }
func mockGetAppFps() int       { return 60 }
func mockGetMaxFrameDelta() int { return 16 }

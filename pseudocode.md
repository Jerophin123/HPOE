# HPOE Algorithm - Pseudocode Representation

This document outlines the high-level pseudocode for the Heuristic Page Optimization Engine (HPOE) as implemented in `HPOE.tsx` and all language proposals.

## System Overview
The HPOE algorithm ensures system stability and 60FPS maintenance via four sequential phases:
1. **PHASE 1: ENVIRONMENT & HARDWARE PROFILING:** Static extraction of device specs via WebGL.
2. **PHASE 2: HEURISTIC GPU CLASSIFICATION:** Massive matrix determining base theoretical tiers.
3. **PHASE 3: SYSTEM LIMITS & SAFETY OVERRIDES:** Fallbacks punishing RAM limits and protecting mobile chips from thermal events.
4. **PHASE 4: LIVE FPS PERFORMANCE MONITOR:** Dynamic adjusting of performance tiers during runtime, with battery-saver detection logic.

---

## PHASE 1: ENVIRONMENT & HARDWARE PROFILING

```text
FUNCTION InitializeProfiler():
    SET prefersReducedMotion = CHECK_OS_SETTING("prefers-reduced-motion")
    SET coreCount = System.hardwareConcurrency OR 4
    SET memory = System.deviceMemory OR 4
    SET isMobileDevice = CHECK_USER_AGENT_FOR_MOBILE()
    
    SET rendererString = "Unknown"
    SET calculatedTier = "high"
    
    OBJECT specs:
        vendor = "Unknown"
        architecture = "Unknown"
        type = "Unknown"
        estimatedClass = "Unknown"
    
    TRY:
        CREATE canvas AND INITIALIZE webglContext
        EXTRACT hardware identifier USING WEBGL_debug_renderer_info
        SET rendererString = SANITIZE(hardware identifier) // removes (R), (TM), "graphics", and lowercases
    CATCH:
        // Do nothing, variables remain unknown
```

---

## PHASE 2: HEURISTIC GPU CLASSIFICATION
```text
    // 1. APPLE SILICON & A-SERIES
    IF rendererString INCLUDES "apple":
        specs.vendor = "Apple"
        IF rendererString is M-Series (m1, m2, etc.):
            specs.architecture = "M-Series Silicon"
            specs.type = "Integrated"
            IF label includes ("max" OR "pro" OR "ultra"): 
                specs.estimatedClass = "High-End", calculatedTier = "high"
            ELSE: 
                specs.estimatedClass = "Mid-Range", calculatedTier = "mid"
        ELSE IF rendererString is A-Series (Mobile):
            specs.architecture = "A-Series Silicon"
            specs.type = "Mobile"
            IF coreCount >= 6 AND maxTextureSize >= 8192: 
                specs.estimatedClass = "High-End", calculatedTier = "high"
            ELSE: 
                specs.estimatedClass = "Mid-Range", calculatedTier = "mid"
            
    // 2. NVIDIA DESKTOP & LAPTOP
    ELSE IF rendererString INCLUDES "nvidia" OR "geforce" OR "quadro":
        specs.vendor = "NVIDIA"
        specs.type = "Discrete"
        IF is RTX/Ampere/Ada/Turing OR Modern High-End: 
            specs.architecture = "RTX / Ampere / Ada / Turing"
            specs.estimatedClass = "High-End", calculatedTier = "high"
        ELSE IF is GTX Entry (1050/960等): 
            specs.architecture = "GTX Legacy Mid"
            specs.estimatedClass = "Mid-Range", calculatedTier = "mid"
        ELSE IF is Mobile MX/Legacy: 
            specs.architecture = "Legacy / Low-End Mobile (GT/MX)"
            specs.estimatedClass = "Budget/Legacy", calculatedTier = "low"
        ELSE:
            specs.architecture = "Unknown NVIDIA"
            specs.estimatedClass = "Mid-Range", calculatedTier = "mid"
        
    // 3. AMD RADEON
    ELSE IF rendererString INCLUDES "amd" OR "radeon":
        specs.vendor = "AMD"
        IF is RDNA/High-End Vega: 
            specs.architecture = "RDNA / High-End Vega", specs.type = "Discrete"
            specs.estimatedClass = "High-End", calculatedTier = "high"
        ELSE IF is Modern APU: 
            specs.architecture = "Polaris / Modern APU", specs.type = "Integrated"
            specs.estimatedClass = "Mid-Range", calculatedTier = "mid"
        ELSE: 
            specs.architecture = "Legacy GCN or Budget APU", specs.type = "Integrated"
            specs.estimatedClass = "Budget/Legacy", calculatedTier = "low"
        
    // 4. INTEL GRAPHICS
    ELSE IF rendererString INCLUDES "intel":
        specs.vendor = "Intel"
        IF is Arc Alchemist: 
            specs.architecture = "Arc Alchemist", specs.type = "Discrete"
            specs.estimatedClass = "Mid-Range", calculatedTier = "mid" // WebGL drivers are unreliable
        ELSE IF is Iris Xe/Plus: 
            specs.architecture = "Iris Xe/Plus", specs.type = "Integrated"
            specs.estimatedClass = "Mid-Range", calculatedTier = "mid"
        ELSE: 
            specs.architecture = "UHD / HD Legacy", specs.type = "Integrated"
            specs.estimatedClass = "Budget/Legacy", calculatedTier = "low"
        
    // 5. QUALCOMM ADRENO / SNAPDRAGON (ANDROID)
    ELSE IF rendererString INCLUDES ("adreno" OR "snapdragon"):
        specs.vendor = "Qualcomm", specs.type = "Mobile"
        EXTRACT adreno_series_number
        IF series >= 800 OR is Elite: 
            specs.architecture = "Adreno [series] / Flagship"
            specs.estimatedClass = "High-End", calculatedTier = "high"
        ELSE IF series >= 650 OR Modern Masked: 
            specs.architecture = "Adreno [series] / Snapdragon 7/8 Series"
            specs.estimatedClass = "Mid-Range", calculatedTier = "mid"
        ELSE: 
            specs.architecture = "Adreno Legacy"
            specs.estimatedClass = "Budget/Legacy", calculatedTier = "low"
        
    // 6. ARM MALI (ANDROID)
    ELSE IF rendererString INCLUDES "mali":
        specs.vendor = "ARM", specs.type = "Mobile"
        IF is Immortalis OR g700/g900 series: 
            specs.architecture = "Mali Valhall / Immortalis Flagship"
            specs.estimatedClass = "High-End", calculatedTier = "high"
        ELSE IF is g70 series: 
            specs.architecture = "Mali Valhall / Immortalis"
            specs.estimatedClass = "Mid-Range", calculatedTier = "mid"
        ELSE: 
            specs.architecture = "Legacy Mali / Budget G-Series"
            specs.estimatedClass = "Budget/Legacy", calculatedTier = "low"
            
    // 7. SAMSUNG XCLIPSE / EXYNOS (MOBILE)
    ELSE IF rendererString INCLUDES ("xclipse" OR "exynos"):
        specs.vendor = "Samsung", specs.type = "Mobile"
        IF is Xclipse series >= 920 OR Flagship Exynos:
            specs.architecture = "Xclipse [series] / Exynos Flagship"
            specs.estimatedClass = "High-End", calculatedTier = "high"
        ELSE:
            specs.architecture = "Xclipse / Exynos Legacy"
            specs.estimatedClass = "Mid-Range / Budget", calculatedTier = "mid" OR "low"

    // 8. MEDIATEK (DIMENSITY / HELIO)
    ELSE IF rendererString INCLUDES ("mediatek" OR "dimensity" OR "helio"):
        specs.vendor = "MediaTek", specs.type = "Mobile"
        IF is Dimensity 8000/9000 Flagship:
            specs.architecture = "Dimensity 8000/9000 Flagship"
            specs.estimatedClass = "High-End", calculatedTier = "high"
        ELSE IF is Standard Dimensity OR High-End Helio (g90):
            specs.architecture = "Dimensity / High-End Helio"
            specs.estimatedClass = "Mid-Range", calculatedTier = "mid"
        ELSE:
            specs.architecture = "Helio Legacy / Entry SoC"
            specs.estimatedClass = "Budget/Legacy", calculatedTier = "low"

    // 9. POWERVR / UNISOC / SPREADTRUM
    ELSE IF rendererString INCLUDES ("powervr" OR "unisoc" OR "spreadtrum"):
        specs.vendor = "Imagination / Unisoc"
        specs.architecture = "Legacy Budget SoC"
        specs.type = "Mobile", specs.estimatedClass = "Budget/Legacy"
        calculatedTier = "low"
        
    // 10. FALLBACK FOR UNKNOWN GPUs
    ELSE:
        specs.architecture = "Unknown (Fallback)"
        specs.estimatedClass = "Budget/Legacy"
        calculatedTier = "low"
```

---

## PHASE 3: SYSTEM LIMITS & SAFETY OVERRIDES

```text
    IF prefersReducedMotion == TRUE:
        calculatedTier = "low"
        
    IF coreCount <= 2 AND memory <= 2:
        calculatedTier = "very-low"
    ELSE IF coreCount <= 2 OR memory <= 2:
        calculatedTier = "low"
        
    IF memory <= 3 AND calculatedTier == "high":
        calculatedTier = "mid"
        
    // CRITICAL: MOBILE THERMAL CAP
    IF isMobileDevice == TRUE AND calculatedTier == "high":
        calculatedTier = "mid" // Prevents throttling on flagship mobile chips
        
    RETURN { calculatedTier, specs }
```

---

## PHASE 4: LIVE FPS PERFORMANCE MONITOR

```text
FUNCTION StartLiveDegradationMonitor(initialTier):
    SET gracePeriod = 3000ms // Wait for hydration/load
    SET frameCount = 0
    SET sustainedDropTicks = 0
    SET detectedBaselineFps = 60
    SET batterySaverTicks = 0
    SET maxFrameDelta = 0 // Tracks frame pacing jitter
    
    LOOP on requestAnimationFrame (currentTime) OR 1s sleep loop:
        INCREMENT frameCount
        CALCULATE frameDelta = currentTime - previousFrameTime
        UPDATE maxFrameDelta = MAX(maxFrameDelta, frameDelta)
        
        IF elapsed time per cycle >= 1000ms: // Execute Once Per Second
            SET currentFPS = frameCount
            
            IF Not Past Grace Period:
                IF past 1000ms and currentFPS > 0:
                    RECORD currentFPS to BaselineArray
            ELSE:
                // Lock in initial High Refresh / 60Hz / 30Hz Boundary Detection
                IF BaselineArray NOT EMPTY AND isBaselineLocked == FALSE:
                    SET averageFPS = AVERAGE(BaselineArray)
                    IF averageFPS > 65:
                        detectedBaselineFps = ROUND(averageFPS) // E.g., 120Hz/144Hz uncapped
                    ELSE IF averageFPS between 28-34 AND maxFrameDelta < 45ms:
                        detectedBaselineFps = 30
                    ELSE:
                        detectedBaselineFps = 60
                    isBaselineLocked = TRUE
                    
                // Dynamic Mid-Session Battery Saver Adjustments
                IF detectedBaselineFps >= 60 AND detected drops stabilizing around 30Hz without jitter (<45ms delta):
                    batterySaverTicks += 1
                    IF batterySaverTicks >= 2:
                        SWITCH detectedBaselineFps = 30
                        RESET sustainedDropTicks
                ELSE IF detectedBaselineFps == 30 AND FPS >= 45:
                    SWITCH detectedBaselineFps = (FPS > 65) ? ROUND(FPS) : 60
                    RESET sustainedDropTicks
                    RESET batterySaverTicks
                ELSE IF detectedBaselineFps >= 60 AND FPS is wild (Not locked to 30, high jitter):
                    batterySaverTicks = max(0, batterySaverTicks - 1)
                    
                // Threshold determination based on Baseline
                IF detectedBaselineFps == 30:
                    currentFpsFloor = 22 // Device artificially clipped by OS
                ELSE:
                    currentFpsFloor = 40 // universally for 60Hz to >144Hz
                    
                SET allowedDropTicks = 3
                
                // Track struggle and execute downgrade
                IF currentFPS < currentFpsFloor:
                    sustainedDropTicks += 1
                ELSE:
                    sustainedDropTicks = MAX(0, sustainedDropTicks - 2) // Slow recovery
                    
                IF sustainedDropTicks >= allowedDropTicks:
                    TRIGGER EmergencyDowngrade (e.g., "high" -> "mid")
                    RESET sustainedDropTicks
                    
            // Reset state for next second interval
            RESET frameCount
            RESET maxFrameDelta

```

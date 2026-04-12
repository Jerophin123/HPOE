# HPOE Algorithm - Pseudocode Representation

This document outlines the high-level pseudocode for the Heuristic Page Optimization Engine (HPOE) as implemented in `HPOE.tsx`.

## System Overview
The HPOE algorithm ensures system stability and 60FPS maintenance via two sequential phases:
1. **Initial Hardware Profiling:** Static analysis of device specs via WebGL.
2. **Live V-Sync Degradation Monitoring:** Dynamic adjusting of performance tiers during runtime.

---

## Phase 1: Initial Hardware Profiling

```text
FUNCTION InitializeProfiler():
    SET prefersReducedMotion = CHECK_OS_SETTING("prefers-reduced-motion")
    SET coreCount = System.hardwareConcurrency OR 4
    SET memory = System.deviceMemory OR 4
    
    SET rendererString = "Unknown"
    SET calculatedTier = "high"
    
    TRY:
        CREATE canvas AND INITIALIZE webglContext
        EXTRACT hardware identifier USING WEBGL_debug_renderer_info
        SET rendererString = SANITIZE(hardware identifier)
    CATCH:
        // Do nothing, variables remain unknown
        
    // -----------------------------------------------------------------
    // HEURISTIC GPU CLASSIFICATION MATRIX
    // -----------------------------------------------------------------
    IF rendererString INCLUDES "apple":
        IF rendererString is M-Series:
            IF label includes ("max" OR "pro" OR "ultra"): => Tier: "high"
            ELSE: => Tier: "mid"
        ELSE IF rendererString is A-Series (Mobile):
            IF coreCount >= 6 AND maxTextureSize >= 8192: => Tier: "high"
            ELSE: => Tier: "mid"
            
    ELSE IF rendererString INCLUDES "nvidia" OR "geforce":
        IF is RTX/Ampere/Ada/Turing OR Modern High-End: => Tier: "high"
        ELSE IF is GTX Entry (1050/960等): => Tier: "mid"
        ELSE IF is Mobile MX/Legacy: => Tier: "low"
        
    ELSE IF rendererString INCLUDES "amd" OR "radeon":
        IF is RDNA/High-End Vega: => Tier: "high"
        ELSE IF is Modern APU: => Tier: "mid"
        ELSE: => Tier: "low"
        
    ELSE IF rendererString INCLUDES ("adreno" OR "snapdragon"):
        EXTRACT adreno_series_number
        IF series >= 800 OR is Elite: => Tier: "high"
        ELSE IF series >= 650: => Tier: "mid"
        ELSE: => Tier: "low"
        
    ELSE IF [Other Mobile Chips e.g., Mali, Exynos, Dimensity]:
        // Applies Similar Series >= N Flagship logic
        ...
        
    // -----------------------------------------------------------------
    // FAIL-SAFES AND THROTTLING RULES
    // -----------------------------------------------------------------
    IF prefersReducedMotion:
        calculatedTier = "low"
        
    IF coreCount <= 2 AND memory <= 2:
        calculatedTier = "very-low"
    ELSE IF coreCount <= 2 OR memory <= 2:
        calculatedTier = "low"
        
    IF memory <= 3 AND calculatedTier == "high":
        calculatedTier = "mid"
        
    // CRITICAL: MOBILE THERMAL CAP
    IF device is Mobile AND calculatedTier == "high":
        calculatedTier = "mid" // Prevents throttling on flagship mobile chips
        
    RETURN calculatedTier
```

---

## Phase 2: Live V-Sync Degradation Monitor

```text
FUNCTION StartLiveDegradationMonitor(initialTier):
    SET gracePeriod = 3000ms // Wait for hydration/load
    SET frameCount = 0
    SET sustainedDropTicks = 0
    SET detectedBaselineFps = 60
    
    LOOP on requestAnimationFrame (currentTime):
        INCREMENT frameCount
        CALCULATE frameDelta = currentTime - previousFrameTime
        
        IF elapsed time per cycle >= 1000ms: // Execute Once Per Second
            SET currentFPS = frameCount
            
            IF Not Past Grace Period:
                RECORD currentFPS to BaselineArray
            ELSE:
                // Battery Saver / 30Hz Screen Detection
                SET averageFPS = AVERAGE(BaselineArray)
                IF averageFPS between 28-34 AND maxFrameDelta < 45ms:
                    detectedBaselineFps = 30
                    
                // Mid-Session Battery Saver Adjustments
                IF currently 60Hz AND detected drops stabilizing around 30Hz:
                    SWITCH detectedBaselineFps = 30
                    RESET sustainedDropTicks
                ELSE IF currently 30Hz AND detected sudden FPS > 45:
                    SWITCH detectedBaselineFps = 60
                    RESET sustainedDropTicks
                    
                // Threshold determination based on Tier and Battery mode
                IF detectedBaselineFps == 30:
                    currentFpsFloor = (initialTier == "high") ? 22 : 18
                ELSE:
                    currentFpsFloor = (initialTier == "high") ? 45 : 38
                    
                SET allowedDropTicks = (initialTier == "high") ? 4 : 6
                
                // Track struggle and execute downgrade
                IF currentFPS < currentFpsFloor:
                    sustainedDropTicks += 1
                ELSE:
                    sustainedDropTicks = MAX(0, sustainedDropTicks - 2)
                    
                IF sustainedDropTicks >= allowedDropTicks:
                    TRIGGER EmergencyDowngrade (e.g., "high" -> "mid")
                    RESET sustainedDropTicks
                    
            // Reset state for next second interval
            RESET frameCount
            RESET maxFrameDelta

```

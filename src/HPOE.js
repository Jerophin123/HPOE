/**
 * HPOE (Heuristic Page Optimization Engine) - Vanilla JS Proposal
 * Full Regex Matrix, Specs Extraction, & Battery Saver Live Degradation Trackers.
 */

class HPOEProfiler {
  constructor() {
    this.tier = "high";
    this.specs = {
      vendor: "Unknown",
      architecture: "Unknown",
      type: "Unknown",
      estimatedClass: "Unknown"
    };
    this.isInitialized = false;
    this.evaluateHardware();
    this.startVsyncMonitor();
  }

  evaluateHardware() {
    const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coreCount = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    let renderer = "unknown gpu";
    let maxTextureSize = 0;

    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (gl) {
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        if (debugInfo) {
          renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        }
        maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      }
    } catch (e) {}

    const originalRenderer = renderer;
    renderer = renderer.toLowerCase().replace(/\((r|tm)\)/g, '').replace(/graphics/g, '').trim();
    let calculatedTier = "high";
    
    let specs = {
      vendor: "Unknown",
      architecture: "Unknown",
      type: "Unknown",
      estimatedClass: "Unknown"
    };

    // ---------------------------------------------------------
    // MASSIVE HEURISTIC GPU CLASSIFICATION MATRIX
    // ---------------------------------------------------------

    // 1. APPLE SILICON & A-SERIES
    if (renderer.includes("apple")) {
      specs.vendor = "Apple";
      if (/m[1-9]/.test(renderer)) {
        specs.architecture = "M-Series Silicon";
        specs.type = "Integrated";
        specs.estimatedClass = (renderer.includes("max") || renderer.includes("pro") || renderer.includes("ultra")) ? "High-End" : "Mid-Range";
        calculatedTier = specs.estimatedClass === "High-End" ? "high" : "mid";
      } else {
        specs.architecture = "A-Series Silicon";
        specs.type = "Mobile";
        if (coreCount >= 6 && maxTextureSize >= 8192) {
          specs.estimatedClass = "High-End";
          calculatedTier = "high";
        } else {
          specs.estimatedClass = "Mid-Range";
          calculatedTier = "mid";
        }
      }
    } 
    // 2. NVIDIA DESKTOP & LAPTOP
    else if (renderer.includes("nvidia") || renderer.includes("geforce") || renderer.includes("quadro")) {
      specs.vendor = "NVIDIA";
      specs.type = "Discrete";
      if (/rtx\s*[2-9][0-9]{3}/.test(renderer) || /titan/.test(renderer) || /quadro\s*rtx/.test(renderer)) {
        specs.architecture = "RTX / Ampere / Ada / Turing";
        specs.estimatedClass = "High-End";
        calculatedTier = "high";
      } else if (/gtx\s*(?:10[6-9][0-9]|16[5-9][0-9]|9[8-9][0-9])/.test(renderer)) {
        specs.architecture = "GTX High/Mid";
        specs.estimatedClass = "High-End";
        calculatedTier = "high";
      } else if (/gtx\s*(?:1050|970|960|950|780)/.test(renderer)) {
        specs.architecture = "GTX Legacy Mid";
        specs.estimatedClass = "Mid-Range";
        calculatedTier = "mid";
      } else if (/gtx\s*(?:4|5|6)[0-9]{2}/.test(renderer) || /gt\s*[0-9]+/.test(renderer) || /[7-9][1-4]0m/.test(renderer) || /mx[1-4][0-9]{2}/.test(renderer)) {
        specs.architecture = "Legacy / Low-End Mobile (GT/MX)";
        specs.estimatedClass = "Budget/Legacy";
        calculatedTier = "low";
      } else {
        specs.architecture = "Unknown NVIDIA";
        specs.estimatedClass = "Mid-Range";
        calculatedTier = "mid";
      }
    }
    // 3. AMD RADEON
    else if (renderer.includes("amd") || renderer.includes("radeon")) {
      specs.vendor = "AMD";
      if (/rx\s*[5-8][0-9]{3}/.test(renderer) || /vega\s*(?:56|64)/.test(renderer) || /radeon\s*pro/.test(renderer)) {
        specs.architecture = "RDNA / High-End Vega";
        specs.type = "Discrete";
        specs.estimatedClass = "High-End";
        calculatedTier = "high";
      } else if (/rx\s*(?:4[0-9]{2}|5[7-9][0-9])/.test(renderer) || /6[6-9]0m/.test(renderer)) {
        specs.architecture = "Polaris / Modern APU";
        specs.type = "Integrated";
        specs.estimatedClass = "Mid-Range";
        calculatedTier = "mid";
      } else {
        specs.architecture = "Legacy GCN or Budget APU";
        specs.type = "Integrated";
        specs.estimatedClass = "Budget/Legacy";
        calculatedTier = "low";
      }
    }
    // 4. INTEL GRAPHICS
    else if (renderer.includes("intel")) {
      specs.vendor = "Intel";
      if (/arc\s*a[3-7][0-9]{2}/.test(renderer)) {
        specs.architecture = "Arc Alchemist";
        specs.type = "Discrete";
        specs.estimatedClass = "Mid-Range";
        calculatedTier = "mid";
      } else if ((renderer.includes("iris") && renderer.includes("xe")) || /iris\s*(?:plus|pro)/.test(renderer)) {
        specs.architecture = "Iris Xe/Plus";
        specs.type = "Integrated";
        specs.estimatedClass = "Mid-Range";
        calculatedTier = "mid";
      } else {
        specs.architecture = "UHD / HD Legacy";
        specs.type = "Integrated";
        specs.estimatedClass = "Budget/Legacy";
        calculatedTier = "low";
      }
    }
    // 5. QUALCOMM ADRENO / SNAPDRAGON (ANDROID & ARM PC)
    else if (renderer.includes("adreno") || renderer.includes("snapdragon")) {
      specs.vendor = "Qualcomm";
      const match = renderer.match(/adreno\s*([0-9]{3})/);
      const series = match ? parseInt(match[1]) : 0;
      
      if (renderer.includes("snapdragon x") || renderer.includes("x elite") || renderer.includes("x plus") || (series >= 900)) {
        specs.type = "Integrated";
        specs.architecture = "Snapdragon X Series (ARM Desktop)";
        specs.estimatedClass = "High-End";
        calculatedTier = "high";
      } else {
        specs.type = isMobileDevice ? "Mobile" : "Integrated";
        if (series >= 800 || renderer.includes("snapdragon 8 elite") || renderer.includes("elite")) {
          specs.architecture = series ? `Adreno ${series}` : "Snapdragon 8 Elite Flagship";
          specs.estimatedClass = "High-End";
          calculatedTier = "high";
        } else if (series >= 730 || renderer.includes("snapdragon 8 gen")) {
          specs.architecture = series ? `Adreno ${series}` : "Snapdragon 8 Gen Flagship";
          specs.estimatedClass = "High-End";
          calculatedTier = "high";
        } else if (series >= 650 || renderer.includes("snapdragon 8") || renderer.includes("snapdragon 7")) {
          specs.architecture = series ? `Adreno ${series}` : "Snapdragon 7/8 Series";
          specs.estimatedClass = "Mid-Range";
          calculatedTier = "mid";
        } else if (series === 0 && coreCount >= 8 && maxTextureSize >= 8192 || renderer.includes("snapdragon")) {
          specs.architecture = `Modern Adreno/Snapdragon (Masked)`;
          specs.estimatedClass = "Mid-Range";
          calculatedTier = "mid";
        } else {
          specs.architecture = `Adreno ${series || "Legacy"}`;
          specs.estimatedClass = "Budget/Legacy";
          calculatedTier = "low";
        }
      }
    }
    // 6. ARM MALI (ANDROID)
    else if (renderer.includes("mali")) {
      specs.vendor = "ARM";
      specs.type = "Mobile";
      if (/immortalis/.test(renderer) || /g[7-9][1-9][0-9]/.test(renderer) || /g7[7-9]/.test(renderer)) {
        specs.architecture = "Mali Valhall / Immortalis Flagship";
        specs.estimatedClass = "High-End";
        calculatedTier = "high";
      } else if (/g[7-9][0-9]/.test(renderer)) {
        specs.architecture = "Mali Valhall / Immortalis";
        specs.estimatedClass = "Mid-Range";
        calculatedTier = "mid";
      } else {
        specs.architecture = "Legacy Mali / Budget G-Series";
        specs.estimatedClass = "Budget/Legacy";
        calculatedTier = "low";
      }
    }
    // 7. POWERVR (OLDER IOS / MEDIATEK)
    else if (renderer.includes("powervr")) {
      specs.vendor = "Imagination Technologies";
      specs.type = "Mobile";
      specs.architecture = "PowerVR Rogue/SGX";
      specs.estimatedClass = "Budget/Legacy";
      calculatedTier = "low";
    }
    // 8. SAMSUNG XCLIPSE / EXYNOS (MOBILE)
    else if (renderer.includes("xclipse") || renderer.includes("exynos")) {
      specs.vendor = "Samsung";
      specs.type = "Mobile";
      if (renderer.includes("xclipse")) {
        const match = renderer.match(/xclipse\s*([0-9]{3})/);
        const series = match ? parseInt(match[1], 10) : 0;
        if (series >= 920) {
          specs.architecture = `Xclipse ${series} (RDNA Flagship)`;
          specs.estimatedClass = "High-End";
          calculatedTier = "high";
        } else {
          specs.architecture = `Xclipse ${series} (RDNA)`;
          specs.estimatedClass = "Mid-Range";
          calculatedTier = "mid";
        }
      } else {
        if (coreCount >= 8 && maxTextureSize >= 8192) {
          specs.architecture = "Exynos Flagship";
          specs.estimatedClass = "High-End";
          calculatedTier = "high";
        } else {
          specs.architecture = "Exynos Legacy/Masked";
          specs.estimatedClass = "Budget/Legacy";
          calculatedTier = "low";
        }
      }
    }
    // 9. MEDIATEK (DIMENSITY / HELIO)
    else if (renderer.includes("mediatek") || renderer.includes("dimensity") || renderer.includes("helio")) {
      specs.vendor = "MediaTek";
      specs.type = "Mobile";
      if (renderer.includes("dimensity 9") || renderer.includes("dimensity 8")) {
        specs.architecture = "Dimensity 8000/9000 Flagship";
        specs.estimatedClass = "High-End";
        calculatedTier = "high";
      } else if (renderer.includes("dimensity") || renderer.includes("helio g9") || (coreCount >= 8 && maxTextureSize >= 8192)) {
        specs.architecture = "Dimensity / High-End Helio";
        specs.estimatedClass = "Mid-Range";
        calculatedTier = "mid";
      } else {
        specs.architecture = "Helio Legacy / Entry SoC";
        specs.estimatedClass = "Budget/Legacy";
        calculatedTier = "low";
      }
    }
    // 10. UNISOC / SPREADTRUM
    else if (renderer.includes("unisoc") || renderer.includes("spreadtrum") || renderer.includes("tigert")) {
      specs.vendor = "Unisoc";
      specs.type = "Mobile";
      specs.architecture = "Unisoc / Spreadtrum";
      specs.estimatedClass = "Budget/Legacy";
      calculatedTier = "low";
    }
    // 11. BROADCOM / RASPBERRY PI
    else if (renderer.includes("videocore") || renderer.includes("v3d") || renderer.includes("broadcom") || renderer.includes("raspberry")) {
      specs.vendor = "Broadcom";
      specs.type = "Integrated";
      if (renderer.includes("v3d 4") || renderer.includes("v3d 4.2") || renderer.includes("videocore vi") || renderer.includes("videocore vii")) {
        specs.architecture = "VideoCore VI/VII (Raspberry Pi 4/5)";
        specs.estimatedClass = "Budget/Legacy";
        calculatedTier = "low";
      } else {
        specs.architecture = "VideoCore IV/V (Raspberry Pi Legacy)";
        specs.estimatedClass = "Budget/Legacy";
        calculatedTier = "very-low";
      }
    }

    // 11. FALLBACK FOR UNKNOWN GPUs
    if (renderer === "unknown gpu" || renderer === "unknown" || specs.vendor === "Unknown") {
      specs.estimatedClass = "Budget/Legacy";
      calculatedTier = "low";
      specs.architecture = "Unknown (Fallback)";
    }

    // Hard limits and Accessibility Overrides
    if (prefersReducedMotion) calculatedTier = "low";
    else if (coreCount < 3 && memory < 3) calculatedTier = "very-low";
    
    else if (memory <= 3 && calculatedTier === "high") calculatedTier = "mid";

    // Absolute fail-safe: Mobile devices NEVER get "High" tier effects.
    if (isMobileDevice && calculatedTier === "high") calculatedTier = "mid";

    // Developer override
    const matchTier = window.location.search.match(/[?&]forceTier=(high|mid|low|very-low)/);
    if (matchTier) calculatedTier = matchTier[1];

    this.tier = calculatedTier;
    this.specs = specs;
    this.isInitialized = true;
  }

  startVsyncMonitor() {
    if (this.tier === "low" || this.tier === "very-low" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let startTime = performance.now();
    let sustainedDropTicks = 0;
    
    let baselineFpsMeasurements = [];
    let detectedBaselineFps = 60;
    let midSessionBatterySaverTicks = 0;
    let isBaselineLocked = false;
    
    let previousFrameTime = performance.now();
    let maxFrameDelta = 0;

    // ---------------------------------------------------------
    // LIVE V-SYNC DEGRADATION MONITOR (FPS SAFETY NET)
    // ---------------------------------------------------------
    const measureFPS = (currentTime) => {
      frameCount++;
      const frameDelta = currentTime - previousFrameTime;
      if (frameDelta > maxFrameDelta) maxFrameDelta = frameDelta;
      previousFrameTime = currentTime;

      if (currentTime - lastTime >= 1000) {
        const fps = frameCount;
        const elapsed = currentTime - startTime;

        if (elapsed <= 3000) {
          if (elapsed > 1000 && fps > 0) baselineFpsMeasurements.push(fps);
        } else {
          if (baselineFpsMeasurements.length > 0 && !isBaselineLocked) {
            const avg = baselineFpsMeasurements.reduce((a, b) => a + b, 0) / baselineFpsMeasurements.length;
            if (avg > 65) {
                detectedBaselineFps = Math.round(avg);
                console.info(`[Hardware Profiler] Uncapped high refresh rate detected (~${detectedBaselineFps}Hz). Optimizing threshold for infinite-refresh smoothness.`);
            } else if (avg >= 28 && avg <= 34 && maxFrameDelta < 45) {
                detectedBaselineFps = 30;
                console.info("[Hardware Profiler] Stable 30fps pacing with low jitter detected (Battery Saver/30Hz). Re-calibrating.");
            } else {
                detectedBaselineFps = 60;
            }
            isBaselineLocked = true;
          }

          if (detectedBaselineFps >= 60 && fps >= 28 && fps <= 33 && maxFrameDelta < 45) {
             midSessionBatterySaverTicks++;
             if (midSessionBatterySaverTicks >= 2) {
                detectedBaselineFps = 30;
                console.info("[Hardware Profiler] Mid-session Battery Saver activated. Stable 30fps pacing detected. Modifying limits.");
                sustainedDropTicks = 0; 
             }
          } else if (detectedBaselineFps === 30 && fps >= 45) {
             detectedBaselineFps = fps > 65 ? Math.round(fps) : 60;
             console.info(`[Hardware Profiler] Mid-session Battery Saver disabled. ${detectedBaselineFps}fps cap restored.`);
             sustainedDropTicks = 0;
             midSessionBatterySaverTicks = 0;
          } else if (detectedBaselineFps >= 60 && (fps < 28 || fps > 33 || maxFrameDelta >= 45)) {
             midSessionBatterySaverTicks = Math.max(0, midSessionBatterySaverTicks - 1);
          }

          let currentFpsFloor = detectedBaselineFps === 30 ? 22 : 40;
          const currentRequiredDropTicks = 3;

          if (fps < currentFpsFloor) sustainedDropTicks++;
          else sustainedDropTicks = Math.max(0, sustainedDropTicks - 2);

          const disableDowngrade = window.location.search.includes("disableDowngrade=true");
          if (sustainedDropTicks >= currentRequiredDropTicks && !disableDowngrade) {
            let downgradeTarget = "low";
            if (this.tier === "high") downgradeTarget = "mid";
            else if (this.tier === "mid") downgradeTarget = "low";
            else if (this.tier === "low") downgradeTarget = "very-low";

            this.tier = downgradeTarget;
            console.warn(`[Hardware Profiler] Emergency Downgrading to Tier: ${downgradeTarget}.`);
            sustainedDropTicks = 0;
          }
        }

        frameCount = 0;
        lastTime = currentTime;
        maxFrameDelta = 0;
      }
      requestAnimationFrame(measureFPS);
    };
    requestAnimationFrame(measureFPS);
  }
}

export default HPOEProfiler;

/**
 * HPOE (Heuristic Page Optimization Engine) - Vanilla JS Proposal
 * Fully Implemented Regex Matrix & Runtime Loops
 */

class HPOEProfiler {
  constructor() {
    this.tier = "high";
    this.isInitialized = false;
    this.evaluateHardware();
    this.startVsyncMonitor();
  }

  evaluateHardware() {
    const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coreCount = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    let renderer = "unknown";
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

    renderer = renderer.toLowerCase().replace(/\((r|tm)\)/g, '').replace(/graphics/g, '').trim();
    let calculatedTier = "high";

    // 1. APPLE SILICON & A-SERIES
    if (renderer.includes("apple")) {
      if (/m[1-9]/.test(renderer)) {
        calculatedTier = (renderer.includes("max") || renderer.includes("pro") || renderer.includes("ultra")) ? "high" : "mid";
      } else {
        calculatedTier = (coreCount >= 6 && maxTextureSize >= 8192) ? "high" : "mid";
      }
    } 
    // 2. NVIDIA
    else if (renderer.includes("nvidia") || renderer.includes("geforce") || renderer.includes("quadro")) {
      if (/rtx\s*[2-9][0-9]{3}/.test(renderer) || /titan/.test(renderer) || /quadro\s*rtx/.test(renderer)) calculatedTier = "high";
      else if (/gtx\s*(?:10[6-9][0-9]|16[5-9][0-9]|9[8-9][0-9])/.test(renderer)) calculatedTier = "high";
      else if (/gtx\s*(?:1050|970|960|950|780)/.test(renderer)) calculatedTier = "mid";
      else if (/gtx\s*(?:4|5|6)[0-9]{2}/.test(renderer) || /gt\s*[0-9]+/.test(renderer) || /[7-9][1-4]0m/.test(renderer) || /mx[1-4][0-9]{2}/.test(renderer)) calculatedTier = "low";
      else calculatedTier = "mid";
    }
    // 3. AMD RADEON
    else if (renderer.includes("amd") || renderer.includes("radeon")) {
      if (/rx\s*[5-8][0-9]{3}/.test(renderer) || /vega\s*(?:56|64)/.test(renderer) || /radeon\s*pro/.test(renderer)) calculatedTier = "high";
      else if (/rx\s*(?:4[0-9]{2}|5[7-9][0-9])/.test(renderer) || /6[6-9]0m/.test(renderer)) calculatedTier = "mid";
      else calculatedTier = "low";
    }
    // 4. INTEL GRAPHICS
    else if (renderer.includes("intel")) {
      if (/arc\s*a[3-7][0-9]{2}/.test(renderer)) calculatedTier = "mid";
      else if ((renderer.includes("iris") && renderer.includes("xe")) || /iris\s*(?:plus|pro)/.test(renderer)) calculatedTier = "mid";
      else calculatedTier = "low";
    }
    // 5. QUALCOMM ADRENO
    else if (renderer.includes("adreno") || renderer.includes("snapdragon")) {
      const match = renderer.match(/adreno\s*([0-9]{3})/);
      const series = match ? parseInt(match[1]) : 0;
      if (series >= 800 || renderer.includes("snapdragon 8 elite") || renderer.includes("elite")) calculatedTier = "high";
      else if (series >= 730 || renderer.includes("snapdragon 8 gen")) calculatedTier = "high";
      else if (series >= 650 || renderer.includes("snapdragon 8") || renderer.includes("snapdragon 7")) calculatedTier = "mid";
      else if (series === 0 && coreCount >= 8 && maxTextureSize >= 8192 || renderer.includes("snapdragon")) calculatedTier = "mid";
      else calculatedTier = "low";
    }
    // 6. ARM MALI
    else if (renderer.includes("mali")) {
      if (/immortalis/.test(renderer) || /g[7-9][1-9][0-9]/.test(renderer) || /g7[7-9]/.test(renderer)) calculatedTier = "high";
      else if (/g[7-9][0-9]/.test(renderer)) calculatedTier = "mid";
      else calculatedTier = "low";
    }
    // 7. POWERVR
    else if (renderer.includes("powervr")) {
      calculatedTier = "low";
    }
    // 8. SAMSUNG XCLIPSE / EXYNOS
    else if (renderer.includes("xclipse") || renderer.includes("exynos")) {
      if (renderer.includes("xclipse")) {
        const match = renderer.match(/xclipse\s*([0-9]{3})/);
        const series = match ? parseInt(match[1], 10) : 0;
        calculatedTier = series >= 920 ? "high" : "mid";
      } else {
        calculatedTier = (coreCount >= 8 && maxTextureSize >= 8192) ? "high" : "low";
      }
    }
    // 9. MEDIATEK
    else if (renderer.includes("mediatek") || renderer.includes("dimensity") || renderer.includes("helio")) {
      if (renderer.includes("dimensity 9") || renderer.includes("dimensity 8")) calculatedTier = "high";
      else if (renderer.includes("dimensity") || renderer.includes("helio g9") || (coreCount >= 8 && maxTextureSize >= 8192)) calculatedTier = "mid";
      else calculatedTier = "low";
    }
    // 10. UNISOC
    else if (renderer.includes("unisoc") || renderer.includes("spreadtrum") || renderer.includes("tigert")) {
      calculatedTier = "low";
    }
    // FALLBACK
    else {
      calculatedTier = "low";
    }

    // Failsafes
    if (prefersReducedMotion) calculatedTier = "low";
    else if (coreCount <= 2 && memory <= 2) calculatedTier = "very-low";
    else if (coreCount <= 2 || memory <= 2) calculatedTier = "low";
    else if (memory <= 3 && calculatedTier === "high") calculatedTier = "mid";

    // Mobile Caps
    if (isMobileDevice && calculatedTier === "high") calculatedTier = "mid";

    this.tier = calculatedTier;
    this.isInitialized = true;
    console.log(`[HPOE] Initial Tier Calculated: ${this.tier}`);
  }

  startVsyncMonitor() {
    if (this.tier === "low" || this.tier === "very-low") return;

    let frameCount = 0;
    let sustainedDropTicks = 0;
    let previousFrameTime = performance.now();
    let startTime = performance.now();
    let detectedBaselineFps = 60;
    let baselineMeasurements = [];

    const measureFPS = (currentTime) => {
      frameCount++;
      const frameDelta = currentTime - previousFrameTime;
      previousFrameTime = currentTime;

      if (currentTime - startTime >= 1000) {
        const fps = frameCount;

        if (baselineMeasurements.length < 5) {
            baselineMeasurements.push(fps);
            if (baselineMeasurements.length === 5) {
                const avg = baselineMeasurements.reduce((a, b) => a + b) / 5;
                if (avg >= 28 && avg <= 34) {
                    detectedBaselineFps = 30; // 30Hz Battery Saver
                }
            }
        } else {
            let floor = this.tier === "high" ? 45 : 38;
            if (detectedBaselineFps === 30) {
                floor = this.tier === "high" ? 22 : 18;
            }
            const limits = this.tier === "high" ? 4 : 6;

            if (fps < floor) sustainedDropTicks++;
            else sustainedDropTicks = Math.max(0, sustainedDropTicks - 2);

            if (sustainedDropTicks >= limits) {
               if (this.tier === "high") this.tier = "mid";
               else if (this.tier === "mid") this.tier = "low";
               console.warn(`[HPOE] Framerate starvation detected. Pushed down to ${this.tier}`);
               sustainedDropTicks = 0;
            }
        }
        
        frameCount = 0;
        startTime = currentTime;
      }
      requestAnimationFrame(measureFPS);
    };

    requestAnimationFrame(measureFPS);
  }
}

export default HPOEProfiler;

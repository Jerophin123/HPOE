/**
 * HPOE (Heuristic Page Optimization Engine) - Vanilla JS Proposal
 * Adapts the core heuristic evaluation into a pure Javascript class module.
 */

class HPOEProfiler {
  constructor() {
    this.tier = "high";
    this.hardwareSpecs = {};
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  evaluateHardware() {
    const memory = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    let renderer = "unknown";

    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl");
      if (gl) {
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        if (debugInfo) {
          renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
        }
      }
    } catch (e) {}

    // Simplified Matrix
    if (renderer.includes("apple")) {
      this.tier = (renderer.includes("max") || renderer.includes("pro")) ? "high" : "mid";
    } else if (renderer.includes("nvidia") || renderer.includes("rtx")) {
      this.tier = "high";
    } else if (renderer.includes("mali") || renderer.includes("adreno")) {
      this.tier = "mid"; 
    } else {
      this.tier = "low";
    }

    // Thermal Caps
    if (this.isMobile && this.tier === "high") {
      this.tier = "mid";
    }
    if (cores <= 2 && memory <= 2) {
      this.tier = "very-low";
    }

    return this.tier;
  }

  startVsyncMonitor() {
    let frameCount = 0;
    let sustainedDrops = 0;
    let previousTime = performance.now();
    let startTime = performance.now();

    const loop = (currentTime) => {
      frameCount++;
      const elapsedTotal = currentTime - startTime;

      if (currentTime - previousTime >= 1000) {
        if (elapsedTotal > 3000) {
          // Grace period passed
          let fps = frameCount;
          let floor = this.tier === "high" ? 45 : 38;

          if (fps < floor) sustainedDrops++;
          else sustainedDrops = Math.max(0, sustainedDrops - 2);

          if (sustainedDrops >= 4) {
            this.downgradeTier();
            sustainedDrops = 0;
          }
        }
        previousTime = currentTime;
        frameCount = 0;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  downgradeTier() {
    if (this.tier === "high") this.tier = "mid";
    else if (this.tier === "mid") this.tier = "low";
    else if (this.tier === "low") this.tier = "very-low";
    console.warn(`[HPOE] Downgraded to ${this.tier} due to frame drops.`);
  }
}

export default HPOEProfiler;

"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export type PerformanceTier = "high" | "mid" | "low" | "very-low";

interface HardwareSpecs {
  vendor: string;
  architecture: string;
  type: "Discrete" | "Integrated" | "Mobile" | "Unknown";
  estimatedClass: "High-End" | "Mid-Range" | "Budget/Legacy" | "Unknown";
}

interface PerformanceContextProps {
  tier: PerformanceTier;
  reducedMotion: boolean;
  gpuInfo: string | null;
  coreCount: number;
  hardwareSpecs: HardwareSpecs | null;
  isInitialized: boolean;
}

const PerformanceContext = createContext<PerformanceContextProps>({
  tier: "high", // Defaults to high to ensure splash screen has blur on mount
  reducedMotion: false,
  gpuInfo: null,
  coreCount: 4,
  hardwareSpecs: null,
  isInitialized: false,
});

export const usePerformance = () => useContext(PerformanceContext);

export function PerformanceProvider({ children }: { children: ReactNode }) {
  const [metrics, setMetrics] = useState<PerformanceContextProps>({
    tier: "high",
    reducedMotion: false,
    gpuInfo: null,
    coreCount: 4,
    hardwareSpecs: null,
    isInitialized: false,
  });
  
  const [isMounted, setIsMounted] = useState(false);

  const currentTierRef = useRef<PerformanceTier>("high");

  useEffect(() => {
    setIsMounted(true);
    
    try {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const coreCount = navigator.hardwareConcurrency || 4;
      // @ts-ignore
      const memory = navigator.deviceMemory || 4; 

      let gpuInfo = "Unknown GPU";
      let maxTextureSize = 0;
      const canvas = document.createElement("canvas");
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      let calculatedTier: PerformanceTier = "high";
      let specs: HardwareSpecs = {
        vendor: "Unknown",
        architecture: "Unknown",
        type: "Unknown",
        estimatedClass: "Unknown",
      };

      let renderer = "unknown";

      let gl: WebGLRenderingContext | null = null;
        try {
          gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext;
          if (gl) {
            const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
            if (debugInfo) {
              gpuInfo = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string;
            }
            maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
          }
        } catch (e) {}

        // Strip trademarks like (R) or (TM) that break rigid regex matching
        renderer = gpuInfo.toLowerCase().replace(/\((r|tm)\)/g, '').replace(/graphics/g, '').trim();

        // ---------------------------------------------------------
        // MASSIVE HEURISTIC GPU CLASSIFICATION MATRIX
        // ---------------------------------------------------------

      // 1. APPLE SILICON & A-SERIES
      if (renderer.includes("apple")) {
        specs.vendor = "Apple";
        if (/m[1-9]/.test(renderer)) {
          specs.architecture = "M-Series Silicon";
          specs.type = "Integrated";
          specs.estimatedClass = renderer.includes("max") || renderer.includes("pro") || renderer.includes("ultra") ? "High-End" : "Mid-Range";
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
          calculatedTier = "mid"; // Intel drivers on WebGL are unreliable for complex CSS blurs
        } else if ((renderer.includes("iris") && renderer.includes("xe")) || /iris\s*(?:plus|pro)/.test(renderer)) {
          specs.architecture = "Iris Xe/Plus";
          specs.type = "Integrated";
          specs.estimatedClass = "Mid-Range";
          calculatedTier = "mid";
        } else /* HD, UHD, Generic Intel */ {
          specs.architecture = "UHD / HD Legacy";
          specs.type = "Integrated";
          specs.estimatedClass = "Budget/Legacy";
          calculatedTier = "low"; 
        }
      }
      // 5. QUALCOMM ADRENO / SNAPDRAGON (ANDROID)
      else if (renderer.includes("adreno") || renderer.includes("snapdragon")) {
        specs.vendor = "Qualcomm";
        specs.type = "Mobile";
        const match = renderer.match(/adreno\s*([0-9]{3})/);
        const series = match ? parseInt(match[1]) : 0;
        
        if (series >= 800 || renderer.includes("snapdragon 8 elite") || renderer.includes("elite")) {
          specs.architecture = series ? `Adreno ${series}` : "Snapdragon 8 Elite Flagship";
          specs.estimatedClass = "High-End";
          calculatedTier = "high"; // Will be capped to mid by fail-safe for thermals
        } else if (series >= 730 || renderer.includes("snapdragon 8 gen")) {
          specs.architecture = series ? `Adreno ${series}` : "Snapdragon 8 Gen Flagship";
          specs.estimatedClass = "High-End";
          calculatedTier = "high";
        } else if (series >= 650 || renderer.includes("snapdragon 8") || renderer.includes("snapdragon 7")) {
          specs.architecture = series ? `Adreno ${series}` : "Snapdragon 7/8 Series";
          specs.estimatedClass = "Mid-Range";
          calculatedTier = "mid";
        } else if ((series === 0 && coreCount >= 8 && maxTextureSize >= 8192) || renderer.includes("snapdragon")) {
          // Fallback logic! If browser scrubbed the Adreno version number from string
          // but phone has 8 cores and supports heavy textures, it's a modern Snapdragon (Mid Tier).
          specs.architecture = `Modern Adreno/Snapdragon (Masked)`;
          specs.estimatedClass = "Mid-Range";
          calculatedTier = "mid";
        } else {
          specs.architecture = `Adreno ${series || "Legacy"}`;
          specs.estimatedClass = "Budget/Legacy";
          calculatedTier = "low";
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
          const series = match && match[1] ? parseInt(match[1], 10) : 0;
          if (series >= 920) {
            specs.architecture = `Xclipse ${series} (RDNA Flagship)`.trim();
            specs.estimatedClass = "High-End"; 
            calculatedTier = "high";
          } else {
            specs.architecture = `Xclipse ${series} (RDNA)`.trim();
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
        calculatedTier = "low"; // Mostly entry-level hardware
      }

      // 11. FALLBACK FOR UNKNOWN GPUs
      if (renderer === "unknown gpu" || renderer === "unknown" || specs.vendor === "Unknown") {
        specs.estimatedClass = "Budget/Legacy";
        calculatedTier = "low";
        specs.architecture = "Unknown (Fallback)";
      }

      // Hard limits and Accessibility Overrides
      if (prefersReducedMotion) {
        calculatedTier = "low";
      } else if (coreCount <= 2 && memory <= 2) {
        calculatedTier = "very-low";
      } else if (coreCount <= 2 || memory <= 2) {
        // Only demote on extremely constrained hardware (2 cores OR 2GB).
        // 4-core / 4GB machines with capable integrated GPUs (Iris Xe, etc.) stay at their GPU-classified tier.
        calculatedTier = "low";
      } else if (memory <= 3 && calculatedTier === "high") {
        // <=3GB memory can't sustain high-tier backdrop-blur stacks; cap at mid
        calculatedTier = "mid";
      }
      
      // Absolute fail-safe: Mobile devices NEVER get "High" tier effects.
      // Even with elite processors (Snapdragon 8 Elite, Exynos 2400), complex CSS blurs
      // will aggressively thermal throttle the mobile chip. We strictly cap them at Mid.
      if (isMobileDevice && calculatedTier === "high") {
        calculatedTier = "mid";
      }

      // Developer/Testing Override via URL parameter e.g., ?forceTier=high
      const matchTier = window.location.search.match(/[?&]forceTier=(high|mid|low|very-low)/);
      if (matchTier) {
        calculatedTier = matchTier[1] as PerformanceTier;
        console.info(`[Hardware Profiler] Tier forcefully overridden to: ${calculatedTier}`);
      }

      currentTierRef.current = calculatedTier;
      setMetrics({
        tier: calculatedTier,
        reducedMotion: prefersReducedMotion,
        gpuInfo: renderer !== "unknown" && renderer !== "unknown gpu" ? gpuInfo : "Hardware Masked",
        coreCount,
        hardwareSpecs: specs,
        isInitialized: false,
      });

      const initTimeout = setTimeout(() => {
        setMetrics(prev => ({ ...prev, isInitialized: true }));
      }, 50);

      // ---------------------------------------------------------
      // LIVE V-SYNC DEGRADATION MONITOR (FPS SAFETY NET)
      // Tuned to avoid false-positive downgrades on mid-tier hardware
      // ---------------------------------------------------------
      if (calculatedTier !== "low" && calculatedTier !== "very-low" && !prefersReducedMotion) {
        let frameCount = 0;
        let lastTime = performance.now();
        const startTime = performance.now();
        let animationFrameId: number;
        let sustainedDropTicks = 0;

        // Adaptive thresholds: mid-tier naturally runs 40-55 FPS; only react to genuine sustained drops
        const gracePeriodMs = 3000; // Ignore first 3 seconds (page-load jank)
        
        let baselineFpsMeasurements: number[] = [];
        let detectedBaselineFps = 60; // Assume standard 60fps by default
        let midSessionBatterySaverTicks = 0;
        
        let previousFrameTime = performance.now();
        let maxFrameDelta = 0; // Tracks maximum MS between consecutive frames

        const measureFPS = (currentTime: number) => {
          frameCount++;
          
          const frameDelta = currentTime - previousFrameTime;
          if (frameDelta > maxFrameDelta) {
             maxFrameDelta = frameDelta;
          }
          previousFrameTime = currentTime;
          if (currentTime - lastTime >= 1000) {
            const fps = frameCount;
            const elapsed = currentTime - startTime;

            if (elapsed <= gracePeriodMs) {
              // Wait for initial hydration to clear, then sample naturally achievable FPS
              if (elapsed > 1000 && fps > 0) {
                baselineFpsMeasurements.push(fps);
              }
            } else {
              // Lock in baseline detection once grace period concludes
              if (baselineFpsMeasurements.length > 0 && detectedBaselineFps === 60) {
                const avg = baselineFpsMeasurements.reduce((a, b) => a + b, 0) / baselineFpsMeasurements.length;
                // Accurately verify 30fps: average ~30 AND frame pacing is universally stable (max delta < 45ms proves it's an OS hardcap, not wild lag) 
                if (avg >= 28 && avg <= 34 && maxFrameDelta < 45) {
                  detectedBaselineFps = 30;
                  console.info("[Hardware Profiler] Stable 30fps pacing with low jitter detected (Battery Saver/30Hz). Re-calibrating.");
                }
              }

              // Dynamic MID-SESSION Battery Saver Detection (User toggles mode on/off after loading)
              if (detectedBaselineFps === 60 && fps >= 28 && fps <= 33 && maxFrameDelta < 45) {
                 midSessionBatterySaverTicks++;
                 if (midSessionBatterySaverTicks >= 2) {
                    detectedBaselineFps = 30;
                    console.info("[Hardware Profiler] Mid-session Battery Saver activated. Stable 30fps pacing detected. Modifying limits.");
                    sustainedDropTicks = 0; // Wipe lag penalties incurred during the detection phase
                 }
              } else if (detectedBaselineFps === 30 && fps >= 45) {
                 detectedBaselineFps = 60;
                 console.info("[Hardware Profiler] Mid-session Battery Saver disabled. 60fps cap restored.");
                 sustainedDropTicks = 0;
                 midSessionBatterySaverTicks = 0;
              } else {
                 if (detectedBaselineFps === 60 && (fps < 28 || fps > 33 || maxFrameDelta >= 45)) {
                   midSessionBatterySaverTicks = Math.max(0, midSessionBatterySaverTicks - 1);
                 }
              }

              const currentTier = currentTierRef.current;
              let currentFpsFloor;
              
              if (detectedBaselineFps === 30) {
                // Battery Saver Mode active: Re-assign the thresholds to avoid aggressively killing animations
                // The device can easily handle mid-tier glass, it is just artificially clipped by the OS.
                currentFpsFloor = currentTier === "high" ? 22 : 18; 
              } else {
                currentFpsFloor = currentTier === "high" ? 45 : 38;
              }
              
              const currentRequiredDropTicks = currentTier === "high" ? 4 : 6;

              if (fps < currentFpsFloor) {
                sustainedDropTicks++;
              } else {
                sustainedDropTicks = Math.max(0, sustainedDropTicks - 2);
              }

              const disableDowngrade = window.location.search.includes("disableDowngrade=true");

              if (sustainedDropTicks >= currentRequiredDropTicks && !disableDowngrade) {
                let downgradeTarget: PerformanceTier = "low";
                if (currentTier === "high") downgradeTarget = "mid";
                else if (currentTier === "mid") downgradeTarget = "low";
                else if (currentTier === "low") downgradeTarget = "very-low";

                console.warn(`[Hardware Profiler] Thermal Throttling / Resource Limit Detected (${fps} FPS, floor ${currentFpsFloor}, ${sustainedDropTicks}/${currentRequiredDropTicks} ticks). Emergency Downgrading to Tier: ${downgradeTarget}.`);

                currentTierRef.current = downgradeTarget;
                
                // Defer state update to prevent Next.js/React re-render conflict inside requestAnimationFrame
                setTimeout(() => {
                  setMetrics(prev => ({ ...prev, tier: downgradeTarget }));
                }, 0);

                sustainedDropTicks = 0;

                if (downgradeTarget === "very-low") {
                  return; // Reached rock bottom, stop measuring
                }
              }
            }

            frameCount = 0;
            lastTime = currentTime;
            maxFrameDelta = 0; // Reset jitter tracking for the next second
          }
          animationFrameId = requestAnimationFrame(measureFPS);
        };

        animationFrameId = requestAnimationFrame(measureFPS);
        return () => {
          cancelAnimationFrame(animationFrameId);
          clearTimeout(initTimeout);
        };
      }

      return () => clearTimeout(initTimeout);
    } catch (e) {
        console.warn("Performance Profiler encountered an error:", e);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.tier = metrics.tier;
      document.documentElement.dataset.reducedMotion = metrics.reducedMotion.toString();
    }
  }, [metrics.tier, metrics.reducedMotion]);

  return (
    <PerformanceContext.Provider value={metrics}>
      <AnimatePresence>
        {!metrics.isInitialized && (
          <motion.div
            key="performance-splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className={`fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-background select-none`}
          >
            <div className="relative mb-8 w-32 h-32 md:w-48 md:h-48 overflow-hidden rounded-full shadow-2xl ring-4 ring-primary/10">
              <Image 
                src="/splash.png" 
                alt="Delphin Associates Splash" 
                fill 
                className="object-cover"
                priority
              />
            </div>
            
            <div className="flex flex-col items-center gap-4">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <Loader2 className="w-8 h-8 text-primary" />
              </motion.div>
              <p className="text-sm font-medium tracking-widest text-muted-foreground uppercase opacity-80 animate-pulse">
                Optimizing Experience
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </PerformanceContext.Provider>
  );
}

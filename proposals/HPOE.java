/**
 * HPOE (Heuristic Page Optimization Engine) - Java Proposal
 * Includes Complete Regex Logic & Battery Saver FPS Caps.
 */
import java.util.regex.*;
import java.util.*;

public class HPOE {
    public enum Tier { HIGH, MID, LOW, VERY_LOW }

    private Tier currentTier = Tier.HIGH;
    private boolean isMobileDevice = false;

    public HPOE() {
        evaluateSystemHardware();
        startPerformanceMonitor();
    }

    public void evaluateSystemHardware() {
        int coreCount = Runtime.getRuntime().availableProcessors();
        long memoryGB = Runtime.getRuntime().maxMemory() / (1024 * 1024 * 1024);
        int maxTextureSize = 8192; 

        // Strip trademarks like (R) or (TM) that break rigid regex matching
        String rawGpu = getMockGpuVendorString().toLowerCase();
        String renderer = rawGpu.replaceAll("\\(r|tm\\)", "").replaceAll("graphics", "").trim();
        Tier calculated = Tier.HIGH;

        // ---------------------------------------------------------
        // MASSIVE HEURISTIC GPU CLASSIFICATION MATRIX
        // ---------------------------------------------------------

        // 1. APPLE SILICON & A-SERIES
        if (renderer.contains("apple")) {
            if (Pattern.compile("m[1-9]").matcher(renderer).find()) calculated = (renderer.contains("max") || renderer.contains("pro") || renderer.contains("ultra")) ? Tier.HIGH : Tier.MID;
            else calculated = (coreCount >= 6 && maxTextureSize >= 8192) ? Tier.HIGH : Tier.MID;
        }
        // 2. NVIDIA DESKTOP & LAPTOP
        else if (renderer.contains("nvidia") || renderer.contains("geforce") || renderer.contains("quadro")) {
            if (Pattern.compile("rtx\\s*[2-9][0-9]{3}").matcher(renderer).find() || renderer.contains("titan") || Pattern.compile("quadro\\s*rtx").matcher(renderer).find()) calculated = Tier.HIGH;
            else if (Pattern.compile("gtx\\s*(?:10[6-9][0-9]|16[5-9][0-9]|9[8-9][0-9])").matcher(renderer).find()) calculated = Tier.HIGH;
            else if (Pattern.compile("gtx\\s*(?:1050|970|960|950|780)").matcher(renderer).find()) calculated = Tier.MID;
            else if (Pattern.compile("gtx\\s*(?:4|5|6)[0-9]{2}").matcher(renderer).find() || Pattern.compile("gt\\s*[0-9]+").matcher(renderer).find() || Pattern.compile("[7-9][1-4]0m").matcher(renderer).find() || Pattern.compile("mx[1-4][0-9]{2}").matcher(renderer).find()) calculated = Tier.LOW;
            else calculated = Tier.MID;
        }
        // 3. AMD RADEON
        else if (renderer.contains("amd") || renderer.contains("radeon")) {
            if (Pattern.compile("rx\\s*[5-8][0-9]{3}").matcher(renderer).find() || Pattern.compile("vega\\s*(?:56|64)").matcher(renderer).find() || renderer.contains("radeon pro")) calculated = Tier.HIGH;
            else if (Pattern.compile("rx\\s*(?:4[0-9]{2}|5[7-9][0-9])").matcher(renderer).find() || Pattern.compile("6[6-9]0m").matcher(renderer).find()) calculated = Tier.MID;
            else calculated = Tier.LOW;
        }
        // 4. INTEL GRAPHICS
        else if (renderer.contains("intel")) {
            if (Pattern.compile("arc\\s*a[3-7][0-9]{2}").matcher(renderer).find() || (renderer.contains("iris") && renderer.contains("xe")) || Pattern.compile("iris\\s*(?:plus|pro)").matcher(renderer).find()) calculated = Tier.MID;
            else calculated = Tier.LOW;
        }
        // 5. QUALCOMM ADRENO / SNAPDRAGON (ANDROID)
        else if (renderer.contains("adreno") || renderer.contains("snapdragon")) {
            Matcher m = Pattern.compile("adreno\\s*([0-9]{3})").matcher(renderer);
            int series = (m.find()) ? Integer.parseInt(m.group(1)) : 0;
            if (series >= 800 || renderer.contains("snapdragon 8 elite") || renderer.contains("elite")) calculated = Tier.HIGH;
            else if (series >= 730 || renderer.contains("snapdragon 8 gen")) calculated = Tier.HIGH;
            else if (series >= 650 || renderer.contains("snapdragon 8") || renderer.contains("snapdragon 7")) calculated = Tier.MID;
            else if ((series == 0 && coreCount >= 8 && maxTextureSize >= 8192) || renderer.contains("snapdragon")) calculated = Tier.MID;
            else calculated = Tier.LOW;
        }
        // 6. ARM MALI (ANDROID)
        else if (renderer.contains("mali")) {
            if (renderer.contains("immortalis") || Pattern.compile("g[7-9][1-9][0-9]").matcher(renderer).find() || Pattern.compile("g7[7-9]").matcher(renderer).find()) calculated = Tier.HIGH;
            else if (Pattern.compile("g[7-9][0-9]").matcher(renderer).find()) calculated = Tier.MID;
            else calculated = Tier.LOW;
        }
        // 7. SAMSUNG XCLIPSE / EXYNOS (MOBILE)
        else if (renderer.contains("xclipse") || renderer.contains("exynos")) {
            Matcher m = Pattern.compile("xclipse\\s*([0-9]{3})").matcher(renderer);
            if (m.find()) calculated = (Integer.parseInt(m.group(1)) >= 920) ? Tier.HIGH : Tier.MID;
            else calculated = (coreCount >= 8 && maxTextureSize >= 8192) ? Tier.HIGH : Tier.LOW;
        }
        // 8. MEDIATEK (DIMENSITY / HELIO)
        else if (renderer.contains("mediatek") || renderer.contains("dimensity") || renderer.contains("helio")) {
            if (renderer.contains("dimensity 9") || renderer.contains("dimensity 8")) calculated = Tier.HIGH;
            else if (renderer.contains("dimensity") || renderer.contains("helio g9") || (coreCount >= 8 && maxTextureSize >= 8192)) calculated = Tier.MID;
            else calculated = Tier.LOW;
        }
        // 9. POWERVR / UNISOC / SPREADTRUM
        else if (renderer.contains("powervr") || renderer.contains("unisoc") || renderer.contains("spreadtrum") || renderer.contains("tigert")) {
            calculated = Tier.LOW;
        } 
        // 10. FALLBACK FOR UNKNOWN GPUs
        else {
            calculated = Tier.LOW;
        }

        // Hard limits and Accessibility Overrides
        if (coreCount <= 2 && memoryGB <= 2) calculated = Tier.VERY_LOW;
        else if (coreCount <= 2 || memoryGB <= 2) calculated = Tier.LOW; // Only demote on extremely constrained hardware
        else if (memoryGB <= 3 && calculated == Tier.HIGH) calculated = Tier.MID; // <=3GB memory can't sustain high-tier
        
        // Absolute fail-safe: Mobile devices NEVER get "High" tier effects.
        if (isMobileDevice && calculated == Tier.HIGH) calculated = Tier.MID;

        currentTier = calculated;
    }

    // ---------------------------------------------------------
    // LIVE V-SYNC DEGRADATION MONITOR (FPS SAFETY NET)
    // Tuned to avoid false-positive downgrades on mid-tier hardware
    // ---------------------------------------------------------
    private void startPerformanceMonitor() {
        Thread t = new Thread(() -> {
            int sustainedDropTicks = 0;
            int detectedBaselineFps = 60; // Assume standard 60fps by default
            int batterySaverTicks = 0;
            int gracePeriodTicks = 0;
            List<Integer> baselineMeasurements = new ArrayList<>();

            while (currentTier != Tier.LOW && currentTier != Tier.VERY_LOW) {
                try {
                    Thread.sleep(1000);
                    int fps = getMockSystemFps();
                    int maxFrameDelta = getMockMaxFrameDelta();

                    gracePeriodTicks++;
                    if (gracePeriodTicks <= 3) {
                        // Wait for initial hydration to clear, then sample naturally achievable FPS
                        if (gracePeriodTicks > 1 && fps > 0) baselineMeasurements.add(fps);
                        continue;
                    }

                    // Lock in baseline detection once grace period concludes
                    if (baselineMeasurements.size() > 0 && detectedBaselineFps == 60) {
                        double avg = baselineMeasurements.stream().mapToInt(val -> val).average().orElse(0.0);
                        // Accurately verify 30fps: average ~30 AND frame pacing is universally stable
                        if (avg >= 28 && avg <= 34 && maxFrameDelta < 45) {
                            detectedBaselineFps = 30;
                        }
                    }

                    // Dynamic MID-SESSION Battery Saver Detection
                    if (detectedBaselineFps == 60 && fps >= 28 && fps <= 33 && maxFrameDelta < 45) {
                        batterySaverTicks++;
                        if (batterySaverTicks >= 2) {
                            detectedBaselineFps = 30;
                            sustainedDropTicks = 0; // Wipe lag penalties
                        }
                    } else if (detectedBaselineFps == 30 && fps >= 45) {
                        detectedBaselineFps = 60;
                        sustainedDropTicks = 0;
                        batterySaverTicks = 0;
                    } else if (detectedBaselineFps == 60 && (fps < 28 || fps > 33 || maxFrameDelta >= 45)) {
                        batterySaverTicks = Math.max(0, batterySaverTicks - 1);
                    }

                    // Battery Saver Mode active: Re-assign threshold
                    int floor = (detectedBaselineFps == 30) ? ((currentTier == Tier.HIGH) ? 22 : 18) : ((currentTier == Tier.HIGH) ? 45 : 38);
                    int limit = (currentTier == Tier.HIGH) ? 4 : 6;

                    if (fps < floor) sustainedDropTicks++;
                    else sustainedDropTicks = Math.max(0, sustainedDropTicks - 2);

                    if (sustainedDropTicks >= limit) {
                        currentTier = (currentTier == Tier.HIGH) ? Tier.MID : Tier.LOW;
                        System.out.println("[HPOE] Emergency downgrading tier.");
                        sustainedDropTicks = 0;
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        });
        t.setDaemon(true);
        t.start();
    }

    private String getMockGpuVendorString() { return "NVIDIA GeForce RTX 4070 Ti"; }
    private int getMockSystemFps() { return 60; }
    private int getMockMaxFrameDelta() { return 16; }
}

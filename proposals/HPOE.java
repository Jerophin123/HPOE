/**
 * HPOE (Heuristic Page Optimization Engine) - Java Proposal
 * Includes Complete Regex Logic, Specs Objects, & Battery Saver Caps.
 */
import java.util.regex.*;
import java.util.*;

public class HPOE {
    public enum Tier { HIGH, MID, LOW, VERY_LOW }

    public static class HardwareSpecs {
        public String vendor = "Unknown";
        public String architecture = "Unknown";
        public String type = "Unknown";
        public String estimatedClass = "Unknown";
    }

    private Tier currentTier = Tier.HIGH;
    private HardwareSpecs specs = new HardwareSpecs();
    private boolean isMobileDevice = false;

    public HPOE() {
        evaluateSystemHardware();
        startPerformanceMonitor();
    }

    public void evaluateSystemHardware() {
        int coreCount = Runtime.getRuntime().availableProcessors();
        long memoryGB = Runtime.getRuntime().maxMemory() / (1024 * 1024 * 1024);
        int maxTextureSize = 8192; 

        String rawGpu = getMockGpuVendorString().toLowerCase();
        String renderer = rawGpu.replaceAll("\\(r|tm\\)", "").replaceAll("graphics", "").trim();
        Tier calculated = Tier.HIGH;

        // ---------------------------------------------------------
        // MASSIVE HEURISTIC GPU CLASSIFICATION MATRIX
        // ---------------------------------------------------------

        // 1. APPLE SILICON & A-SERIES
        if (renderer.contains("apple")) {
            specs.vendor = "Apple";
            if (Pattern.compile("m[1-9]").matcher(renderer).find()) {
                specs.architecture = "M-Series Silicon";
                specs.type = "Integrated";
                specs.estimatedClass = (renderer.contains("max") || renderer.contains("pro") || renderer.contains("ultra")) ? "High-End" : "Mid-Range";
                calculated = specs.estimatedClass.equals("High-End") ? Tier.HIGH : Tier.MID;
            } else {
                specs.architecture = "A-Series Silicon";
                specs.type = "Mobile";
                if (coreCount >= 6 && maxTextureSize >= 8192) {
                    specs.estimatedClass = "High-End";
                    calculated = Tier.HIGH;
                } else {
                    specs.estimatedClass = "Mid-Range";
                    calculated = Tier.MID;
                }
            }
        }
        // 2. NVIDIA DESKTOP & LAPTOP
        else if (renderer.contains("nvidia") || renderer.contains("geforce") || renderer.contains("quadro")) {
            specs.vendor = "NVIDIA";
            specs.type = "Discrete";
            if (Pattern.compile("rtx\\s*[2-9][0-9]{3}").matcher(renderer).find() || renderer.contains("titan") || Pattern.compile("quadro\\s*rtx").matcher(renderer).find()) {
                specs.architecture = "RTX / Ampere / Ada / Turing";
                specs.estimatedClass = "High-End";
                calculated = Tier.HIGH;
            } else if (Pattern.compile("gtx\\s*(?:10[6-9][0-9]|16[5-9][0-9]|9[8-9][0-9])").matcher(renderer).find()) {
                specs.architecture = "GTX High/Mid";
                specs.estimatedClass = "High-End";
                calculated = Tier.HIGH;
            } else if (Pattern.compile("gtx\\s*(?:1050|970|960|950|780)").matcher(renderer).find()) {
                specs.architecture = "GTX Legacy Mid";
                specs.estimatedClass = "Mid-Range";
                calculated = Tier.MID;
            } else if (Pattern.compile("gtx\\s*(?:4|5|6)[0-9]{2}").matcher(renderer).find() || Pattern.compile("gt\\s*[0-9]+").matcher(renderer).find() || Pattern.compile("[7-9][1-4]0m").matcher(renderer).find() || Pattern.compile("mx[1-4][0-9]{2}").matcher(renderer).find()) {
                specs.architecture = "Legacy / Low-End Mobile (GT/MX)";
                specs.estimatedClass = "Budget/Legacy";
                calculated = Tier.LOW;
            } else {
                specs.architecture = "Unknown NVIDIA";
                specs.estimatedClass = "Mid-Range";
                calculated = Tier.MID;
            }
        }
        // 3. AMD RADEON
        else if (renderer.contains("amd") || renderer.contains("radeon")) {
            specs.vendor = "AMD";
            if (Pattern.compile("rx\\s*[5-8][0-9]{3}").matcher(renderer).find() || Pattern.compile("vega\\s*(?:56|64)").matcher(renderer).find() || renderer.contains("radeon pro")) {
                specs.architecture = "RDNA / High-End Vega";
                specs.type = "Discrete";
                specs.estimatedClass = "High-End";
                calculated = Tier.HIGH;
            } else if (Pattern.compile("rx\\s*(?:4[0-9]{2}|5[7-9][0-9])").matcher(renderer).find() || Pattern.compile("6[6-9]0m").matcher(renderer).find()) {
                specs.architecture = "Polaris / Modern APU";
                specs.type = "Integrated";
                specs.estimatedClass = "Mid-Range";
                calculated = Tier.MID;
            } else {
                specs.architecture = "Legacy GCN or Budget APU";
                specs.type = "Integrated";
                specs.estimatedClass = "Budget/Legacy";
                calculated = Tier.LOW;
            }
        }
        // 4. INTEL GRAPHICS
        else if (renderer.contains("intel")) {
            specs.vendor = "Intel";
            if (Pattern.compile("arc\\s*a[3-7][0-9]{2}").matcher(renderer).find()) {
                specs.architecture = "Arc Alchemist";
                specs.type = "Discrete";
                specs.estimatedClass = "Mid-Range";
                calculated = Tier.MID;
            } else if ((renderer.contains("iris") && renderer.contains("xe")) || Pattern.compile("iris\\s*(?:plus|pro)").matcher(renderer).find()) {
                specs.architecture = "Iris Xe/Plus";
                specs.type = "Integrated";
                specs.estimatedClass = "Mid-Range";
                calculated = Tier.MID;
            } else {
                specs.architecture = "UHD / HD Legacy";
                specs.type = "Integrated";
                specs.estimatedClass = "Budget/Legacy";
                calculated = Tier.LOW;
            }
        }
        // 5. QUALCOMM ADRENO / SNAPDRAGON (ANDROID)
        else if (renderer.contains("adreno") || renderer.contains("snapdragon")) {
            specs.vendor = "Qualcomm";
            specs.type = "Mobile";
            Matcher m = Pattern.compile("adreno\\s*([0-9]{3})").matcher(renderer);
            int series = (m.find()) ? Integer.parseInt(m.group(1)) : 0;
            if (series >= 800 || renderer.contains("snapdragon 8 elite") || renderer.contains("elite")) {
                specs.architecture = (series != 0) ? "Adreno " + series : "Snapdragon 8 Elite Flagship";
                specs.estimatedClass = "High-End";
                calculated = Tier.HIGH;
            } else if (series >= 730 || renderer.contains("snapdragon 8 gen")) {
                specs.architecture = (series != 0) ? "Adreno " + series : "Snapdragon 8 Gen Flagship";
                specs.estimatedClass = "High-End";
                calculated = Tier.HIGH;
            } else if (series >= 650 || renderer.contains("snapdragon 8") || renderer.contains("snapdragon 7")) {
                specs.architecture = (series != 0) ? "Adreno " + series : "Snapdragon 7/8 Series";
                specs.estimatedClass = "Mid-Range";
                calculated = Tier.MID;
            } else if ((series == 0 && coreCount >= 8 && maxTextureSize >= 8192) || renderer.contains("snapdragon")) {
                specs.architecture = "Modern Adreno/Snapdragon (Masked)";
                specs.estimatedClass = "Mid-Range";
                calculated = Tier.MID;
            } else {
                specs.architecture = "Adreno " + ((series != 0) ? series : "Legacy");
                specs.estimatedClass = "Budget/Legacy";
                calculated = Tier.LOW;
            }
        }
        // 6. ARM MALI (ANDROID)
        else if (renderer.contains("mali")) {
            specs.vendor = "ARM";
            specs.type = "Mobile";
            if (renderer.contains("immortalis") || Pattern.compile("g[7-9][1-9][0-9]").matcher(renderer).find() || Pattern.compile("g7[7-9]").matcher(renderer).find()) {
                specs.architecture = "Mali Valhall / Immortalis Flagship";
                specs.estimatedClass = "High-End";
                calculated = Tier.HIGH;
            } else if (Pattern.compile("g[7-9][0-9]").matcher(renderer).find()) {
                specs.architecture = "Mali Valhall / Immortalis";
                specs.estimatedClass = "Mid-Range";
                calculated = Tier.MID;
            } else {
                specs.architecture = "Legacy Mali / Budget G-Series";
                specs.estimatedClass = "Budget/Legacy";
                calculated = Tier.LOW;
            }
        }
        // 7. POWERVR (OLDER IOS / MEDIATEK)
        else if (renderer.contains("powervr")) {
            specs.vendor = "Imagination Technologies";
            specs.type = "Mobile";
            specs.architecture = "PowerVR Rogue/SGX";
            specs.estimatedClass = "Budget/Legacy";
            calculated = Tier.LOW;
        }
        // 8. SAMSUNG XCLIPSE / EXYNOS (MOBILE)
        else if (renderer.contains("xclipse") || renderer.contains("exynos")) {
            specs.vendor = "Samsung";
            specs.type = "Mobile";
            Matcher m = Pattern.compile("xclipse\\s*([0-9]{3})").matcher(renderer);
            if (m.find()) {
                int series = Integer.parseInt(m.group(1));
                if (series >= 920) {
                    specs.architecture = "Xclipse " + series + " (RDNA Flagship)";
                    specs.estimatedClass = "High-End";
                    calculated = Tier.HIGH;
                } else {
                    specs.architecture = "Xclipse " + series + " (RDNA)";
                    specs.estimatedClass = "Mid-Range";
                    calculated = Tier.MID;
                }
            } else {
                if (coreCount >= 8 && maxTextureSize >= 8192) {
                    specs.architecture = "Exynos Flagship";
                    specs.estimatedClass = "High-End";
                    calculated = Tier.HIGH;
                } else {
                    specs.architecture = "Exynos Legacy/Masked";
                    specs.estimatedClass = "Budget/Legacy";
                    calculated = Tier.LOW;
                }
            }
        }
        // 9. MEDIATEK (DIMENSITY / HELIO)
        else if (renderer.contains("mediatek") || renderer.contains("dimensity") || renderer.contains("helio")) {
            specs.vendor = "MediaTek";
            specs.type = "Mobile";
            if (renderer.contains("dimensity 9") || renderer.contains("dimensity 8")) {
                specs.architecture = "Dimensity 8000/9000 Flagship";
                specs.estimatedClass = "High-End";
                calculated = Tier.HIGH;
            } else if (renderer.contains("dimensity") || renderer.contains("helio g9") || (coreCount >= 8 && maxTextureSize >= 8192)) {
                specs.architecture = "Dimensity / High-End Helio";
                specs.estimatedClass = "Mid-Range";
                calculated = Tier.MID;
            } else {
                specs.architecture = "Helio Legacy / Entry SoC";
                specs.estimatedClass = "Budget/Legacy";
                calculated = Tier.LOW;
            }
        }
        // 10. UNISOC / SPREADTRUM
        else if (renderer.contains("unisoc") || renderer.contains("spreadtrum") || renderer.contains("tigert")) {
            specs.vendor = "Unisoc";
            specs.type = "Mobile";
            specs.architecture = "Unisoc / Spreadtrum";
            specs.estimatedClass = "Budget/Legacy";
            calculated = Tier.LOW;
        } 
        // 11. FALLBACK FOR UNKNOWN GPUs
        else {
            specs.estimatedClass = "Budget/Legacy";
            calculated = Tier.LOW;
            specs.architecture = "Unknown (Fallback)";
        }

        // Hard limits and Accessibility Overrides
        if (coreCount <= 2 && memoryGB <= 2) calculated = Tier.VERY_LOW;
        else if (coreCount <= 2 || memoryGB <= 2) calculated = Tier.LOW;
        else if (memoryGB <= 3 && calculated == Tier.HIGH) calculated = Tier.MID;
        
        // Absolute fail-safe: Mobile devices NEVER get "High" tier effects.
        if (isMobileDevice && calculated == Tier.HIGH) calculated = Tier.MID;

        currentTier = calculated;
    }

    // ---------------------------------------------------------
    // LIVE V-SYNC DEGRADATION MONITOR (FPS SAFETY NET)
    // ---------------------------------------------------------
    private void startPerformanceMonitor() {
        Thread t = new Thread(() -> {
            int sustainedDropTicks = 0;
            int detectedBaselineFps = 60;
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
                        if (gracePeriodTicks > 1 && fps > 0) baselineMeasurements.add(fps);
                        continue;
                    }

                    if (baselineMeasurements.size() > 0 && detectedBaselineFps == 60) {
                        double avg = baselineMeasurements.stream().mapToInt(val -> val).average().orElse(0.0);
                        if (avg >= 28 && avg <= 34 && maxFrameDelta < 45) {
                            detectedBaselineFps = 30;
                        }
                    }

                    if (detectedBaselineFps == 60 && fps >= 28 && fps <= 33 && maxFrameDelta < 45) {
                        batterySaverTicks++;
                        if (batterySaverTicks >= 2) {
                            detectedBaselineFps = 30;
                            sustainedDropTicks = 0;
                        }
                    } else if (detectedBaselineFps == 30 && fps >= 45) {
                        detectedBaselineFps = 60;
                        sustainedDropTicks = 0;
                        batterySaverTicks = 0;
                    } else if (detectedBaselineFps == 60 && (fps < 28 || fps > 33 || maxFrameDelta >= 45)) {
                        batterySaverTicks = Math.max(0, batterySaverTicks - 1);
                    }

                    int floor = (detectedBaselineFps == 30) ? ((currentTier == Tier.HIGH) ? 22 : 18) : ((currentTier == Tier.HIGH) ? 45 : 38);
                    int limit = (currentTier == Tier.HIGH) ? 4 : 6;

                    if (fps < floor) sustainedDropTicks++;
                    else sustainedDropTicks = Math.max(0, sustainedDropTicks - 2);

                    if (sustainedDropTicks >= limit) {
                        currentTier = (currentTier == Tier.HIGH) ? Tier.MID : Tier.LOW;
                        System.out.println("[Hardware Profiler] Emergency downgrading tier.");
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

    private String getMockGpuVendorString() { return "Intel Iris Plus Graphics"; }
    private int getMockSystemFps() { return 60; }
    private int getMockMaxFrameDelta() { return 16; }
}

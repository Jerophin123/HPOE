#include <iostream>
#include <string>
#include <thread>
#include <chrono>
#include <algorithm>
#include <regex>
#include <vector>
#include <numeric>

/**
 * HPOE (Heuristic Page Optimization Engine) - C++ Proposal
 * Full Regex Matrix, Specs Objects & Battery Saver Trackers.
 */

enum class Tier { HIGH, MID, LOW, VERY_LOW };

struct HardwareSpecs {
    std::string vendor = "Unknown";
    std::string architecture = "Unknown";
    std::string type = "Unknown";
    std::string estimatedClass = "Unknown";
};

class HPOE {
private:
    Tier currentTier;
    HardwareSpecs specs;
    bool isMonitoring;
    bool isMobile;

    void evaluateHardware() {
        int coreCount = std::thread::hardware_concurrency();
        int memoryGB = 16; 
        int maxTextureSize = 8192; 
        
        std::string rawGpu = getMockGpuVendorString();
        std::transform(rawGpu.begin(), rawGpu.end(), rawGpu.begin(), ::tolower);
        
        std::string renderer = std::regex_replace(rawGpu, std::regex("\\(r\\)|\\(tm\\)|graphics"), "");
        Tier calculated = Tier::HIGH;

        auto test = [&](const std::string& pat) { return std::regex_search(renderer, std::regex(pat)); };

        // ---------------------------------------------------------
        // MASSIVE HEURISTIC GPU CLASSIFICATION MATRIX
        // ---------------------------------------------------------

        // 1. APPLE SILICON & A-SERIES
        if (renderer.find("apple") != std::string::npos) {
            specs.vendor = "Apple";
            if (test("m[1-9]")) {
                specs.architecture = "M-Series Silicon";
                specs.type = "Integrated";
                specs.estimatedClass = (renderer.find("max") != std::string::npos || renderer.find("pro") != std::string::npos || renderer.find("ultra") != std::string::npos) ? "High-End" : "Mid-Range";
                calculated = specs.estimatedClass == "High-End" ? Tier::HIGH : Tier::MID;
            } else {
                specs.architecture = "A-Series Silicon";
                specs.type = "Mobile";
                if (coreCount >= 6 && maxTextureSize >= 8192) {
                    specs.estimatedClass = "High-End";
                    calculated = Tier::HIGH;
                } else {
                    specs.estimatedClass = "Mid-Range";
                    calculated = Tier::MID;
                }
            }
        }
        // 2. NVIDIA DESKTOP & LAPTOP
        else if (renderer.find("nvidia") != std::string::npos || renderer.find("geforce") != std::string::npos || renderer.find("quadro") != std::string::npos) {
            specs.vendor = "NVIDIA";
            specs.type = "Discrete";
            if (test("rtx\\s*[2-9][0-9]{3}") || renderer.find("titan") != std::string::npos || test("quadro\\s*rtx")) {
                specs.architecture = "RTX / Ampere / Ada / Turing";
                specs.estimatedClass = "High-End";
                calculated = Tier::HIGH;
            } else if (test("gtx\\s*(?:10[6-9][0-9]|16[5-9][0-9]|9[8-9][0-9])")) {
                specs.architecture = "GTX High/Mid";
                specs.estimatedClass = "High-End";
                calculated = Tier::HIGH;
            } else if (test("gtx\\s*(?:1050|970|960|950|780)")) {
                specs.architecture = "GTX Legacy Mid";
                specs.estimatedClass = "Mid-Range";
                calculated = Tier::MID;
            } else if (test("gtx\\s*(?:4|5|6)[0-9]{2}") || test("gt\\s*[0-9]+") || test("[7-9][1-4]0m") || test("mx[1-4][0-9]{2}")) {
                specs.architecture = "Legacy / Low-End Mobile (GT/MX)";
                specs.estimatedClass = "Budget/Legacy";
                calculated = Tier::LOW;
            } else {
                specs.architecture = "Unknown NVIDIA";
                specs.estimatedClass = "Mid-Range";
                calculated = Tier::MID;
            }
        }
        // 3. AMD RADEON
        else if (renderer.find("amd") != std::string::npos || renderer.find("radeon") != std::string::npos) {
            specs.vendor = "AMD";
            if (test("rx\\s*[5-8][0-9]{3}") || test("vega\\s*(?:56|64)") || renderer.find("radeon pro") != std::string::npos) {
                specs.architecture = "RDNA / High-End Vega";
                specs.type = "Discrete";
                specs.estimatedClass = "High-End";
                calculated = Tier::HIGH;
            } else if (test("rx\\s*(?:4[0-9]{2}|5[7-9][0-9])") || test("6[6-9]0m")) {
                specs.architecture = "Polaris / Modern APU";
                specs.type = "Integrated";
                specs.estimatedClass = "Mid-Range";
                calculated = Tier::MID;
            } else {
                specs.architecture = "Legacy GCN or Budget APU";
                specs.type = "Integrated";
                specs.estimatedClass = "Budget/Legacy";
                calculated = Tier::LOW;
            }
        }
        // 4. INTEL GRAPHICS
        else if (renderer.find("intel") != std::string::npos) {
            specs.vendor = "Intel";
            if (test("arc\\s*a[3-7][0-9]{2}")) {
                specs.architecture = "Arc Alchemist";
                specs.type = "Discrete";
                specs.estimatedClass = "Mid-Range";
                calculated = Tier::MID;
            } else if ((renderer.find("iris") != std::string::npos && renderer.find("xe") != std::string::npos) || test("iris\\s*(?:plus|pro)")) {
                specs.architecture = "Iris Xe/Plus";
                specs.type = "Integrated";
                specs.estimatedClass = "Mid-Range";
                calculated = Tier::MID;
            } else {
                specs.architecture = "UHD / HD Legacy";
                specs.type = "Integrated";
                specs.estimatedClass = "Budget/Legacy";
                calculated = Tier::LOW;
            }
        }
        // 5. QUALCOMM ADRENO / SNAPDRAGON (ANDROID)
        else if (renderer.find("adreno") != std::string::npos || renderer.find("snapdragon") != std::string::npos) {
            specs.vendor = "Qualcomm";
            specs.type = "Mobile";
            std::smatch match;
            int series = 0;
            if (std::regex_search(renderer, match, std::regex("adreno\\s*([0-9]{3})"))) series = std::stoi(match[1].str());
            
            if (series >= 800 || renderer.find("snapdragon 8 elite") != std::string::npos || renderer.find("elite") != std::string::npos) {
                specs.architecture = (series != 0) ? "Adreno " + std::to_string(series) : "Snapdragon 8 Elite Flagship";
                specs.estimatedClass = "High-End";
                calculated = Tier::HIGH;
            } else if (series >= 730 || renderer.find("snapdragon 8 gen") != std::string::npos) {
                specs.architecture = (series != 0) ? "Adreno " + std::to_string(series) : "Snapdragon 8 Gen Flagship";
                specs.estimatedClass = "High-End";
                calculated = Tier::HIGH;
            } else if (series >= 650 || renderer.find("snapdragon 8") != std::string::npos || renderer.find("snapdragon 7") != std::string::npos) {
                specs.architecture = (series != 0) ? "Adreno " + std::to_string(series) : "Snapdragon 7/8 Series";
                specs.estimatedClass = "Mid-Range";
                calculated = Tier::MID;
            } else if ((series == 0 && coreCount >= 8 && maxTextureSize >= 8192) || renderer.find("snapdragon") != std::string::npos) {
                specs.architecture = "Modern Adreno/Snapdragon (Masked)";
                specs.estimatedClass = "Mid-Range";
                calculated = Tier::MID;
            } else {
                specs.architecture = "Adreno " + ((series != 0) ? std::to_string(series) : "Legacy");
                specs.estimatedClass = "Budget/Legacy";
                calculated = Tier::LOW;
            }
        }
        // 6. ARM MALI (ANDROID)
        else if (renderer.find("mali") != std::string::npos) {
            specs.vendor = "ARM";
            specs.type = "Mobile";
            if (renderer.find("immortalis") != std::string::npos || test("g[7-9][1-9][0-9]") || test("g7[7-9]")) {
                specs.architecture = "Mali Valhall / Immortalis Flagship";
                specs.estimatedClass = "High-End";
                calculated = Tier::HIGH;
            } else if (test("g[7-9][0-9]")) {
                specs.architecture = "Mali Valhall / Immortalis";
                specs.estimatedClass = "Mid-Range";
                calculated = Tier::MID;
            } else {
                specs.architecture = "Legacy Mali / Budget G-Series";
                specs.estimatedClass = "Budget/Legacy";
                calculated = Tier.LOW;
            }
        }
        // 7. SAMSUNG XCLIPSE / EXYNOS (MOBILE)
        else if (renderer.find("xclipse") != std::string::npos || renderer.find("exynos") != std::string::npos) {
            specs.vendor = "Samsung";
            specs.type = "Mobile";
            std::smatch match;
            if (std::regex_search(renderer, match, std::regex("xclipse\\s*([0-9]{3})"))) {
                int series = std::stoi(match[1].str());
                if (series >= 920) {
                    specs.architecture = "Xclipse " + std::to_string(series) + " (RDNA Flagship)";
                    specs.estimatedClass = "High-End";
                    calculated = Tier::HIGH;
                } else {
                    specs.architecture = "Xclipse " + std::to_string(series) + " (RDNA)";
                    specs.estimatedClass = "Mid-Range";
                    calculated = Tier::MID;
                }
            } else {
                if (coreCount >= 8 && maxTextureSize >= 8192) {
                    specs.architecture = "Exynos Flagship";
                    specs.estimatedClass = "High-End";
                    calculated = Tier::HIGH;
                } else {
                    specs.architecture = "Exynos Legacy/Masked";
                    specs.estimatedClass = "Budget/Legacy";
                    calculated = Tier::LOW;
                }
            }
        }
        // 8. MEDIATEK (DIMENSITY / HELIO)
        else if (renderer.find("mediatek") != std::string::npos || renderer.find("dimensity") != std::string::npos || renderer.find("helio") != std::string::npos) {
            specs.vendor = "MediaTek";
            specs.type = "Mobile";
            if (renderer.find("dimensity 9") != std::string::npos || renderer.find("dimensity 8") != std::string::npos) {
                specs.architecture = "Dimensity 8000/9000 Flagship";
                specs.estimatedClass = "High-End";
                calculated = Tier::HIGH;
            } else if (renderer.find("dimensity") != std::string::npos || renderer.find("helio g9") != std::string::npos || (coreCount >= 8 && maxTextureSize >= 8192)) {
                specs.architecture = "Dimensity / High-End Helio";
                specs.estimatedClass = "Mid-Range";
                calculated = Tier.MID;
            } else {
                specs.architecture = "Helio Legacy / Entry SoC";
                specs.estimatedClass = "Budget/Legacy";
                calculated = Tier.LOW;
            }
        }
        // 9. POWERVR / UNISOC / SPREADTRUM
        else if (renderer.find("powervr") != std::string::npos || renderer.find("unisoc") != std::string::npos || renderer.find("spreadtrum") != std::string::npos || renderer.find("tigert") != std::string::npos) {
            specs.vendor = "Unisoc / PowerVR";
            specs.type = "Mobile";
            specs.architecture = "Legacy Budget";
            specs.estimatedClass = "Budget/Legacy";
            calculated = Tier::LOW;
        } 
        // 10. FALLBACK FOR UNKNOWN GPUs
        else {
            specs.estimatedClass = "Budget/Legacy";
            calculated = Tier::LOW;
            specs.architecture = "Unknown (Fallback)";
        }

        // Hard limits and Accessibility Overrides
        if (coreCount < 3 && memoryGB < 3) calculated = Tier::VERY_LOW;
        
        else if (memoryGB <= 3 && calculated == Tier::HIGH) calculated = Tier::MID;
        
        // Absolute fail-safe
        if (isMobile && calculated == Tier::HIGH) calculated = Tier::MID;

        currentTier = calculated;
    }

    // ---------------------------------------------------------
    // LIVE V-SYNC DEGRADATION MONITOR (FPS SAFETY NET)
    // ---------------------------------------------------------
    void degradationLoop() {
        int sustainedDrops = 0;
        int detectedBaseline = 60;
        int batterySaverTicks = 0;
        int gracePeriodTicks = 0;
        bool isBaselineLocked = false;
        std::vector<int> measurements;

        while (isMonitoring && currentTier != Tier::VERY_LOW && currentTier != Tier::LOW) {
            std::this_thread::sleep_for(std::chrono::seconds(1));
            int fps = getMockSystemFps();
            int maxFrameDelta = getMockMaxFrameDelta();

            gracePeriodTicks++;
            if (gracePeriodTicks <= 3) {
                if (gracePeriodTicks > 1 && fps > 0) measurements.push_back(fps);
                continue;
            }

            if (!measurements.empty() && !isBaselineLocked) {
                double avg = std::accumulate(measurements.begin(), measurements.end(), 0.0) / measurements.size();
                if (avg > 65) {
                    detectedBaseline = (int)(avg + 0.5);
                } else if (avg >= 28 && avg <= 34 && maxFrameDelta < 45) {
                    detectedBaseline = 30;
                } else {
                    detectedBaseline = 60;
                }
                isBaselineLocked = true;
            }

            if (detectedBaseline >= 60 && fps >= 28 && fps <= 33 && maxFrameDelta < 45) {
                batterySaverTicks++;
                if (batterySaverTicks >= 2) {
                    detectedBaseline = 30;
                    sustainedDrops = 0; 
                }
            } else if (detectedBaseline == 30 && fps >= 45) {
                detectedBaseline = (fps > 65) ? fps : 60;
                sustainedDrops = 0;
                batterySaverTicks = 0;
            } else if (detectedBaseline >= 60 && (fps < 28 || fps > 33 || maxFrameDelta >= 45)) {
                batterySaverTicks = std::max(0, batterySaverTicks - 1);
            }

            int floor = (detectedBaseline == 30) ? 22 : 40;
            int limit = 3;

            if (fps < floor) sustainedDrops++;
            else sustainedDrops = std::max(0, sustainedDrops - 2);

            if (sustainedDrops >= limit) {
                currentTier = (currentTier == Tier::HIGH) ? Tier::MID : Tier::LOW;
                std::cout << "[Hardware Profiler] Throttling detected. Downgraded tier.\n";
                sustainedDrops = 0;
            }
        }
    }

    std::string getMockGpuVendorString() { return "NVIDIA GeForce RTX 4080"; }
    int getMockSystemFps() { return 60; }
    int getMockMaxFrameDelta() { return 16; }

public:
    HPOE(bool mobile = false) : isMobile(mobile), isMonitoring(true) {
        evaluateHardware();
        std::thread(&HPOE::degradationLoop, this).detach();
    }
    ~HPOE() { isMonitoring = false; }
};

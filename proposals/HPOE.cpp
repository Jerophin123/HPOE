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
 * Full Regex Matrix & Battery Saver Live Degradation Trackers.
 */

enum class Tier { HIGH, MID, LOW, VERY_LOW };

class HPOE {
private:
    Tier currentTier;
    bool isMonitoring;
    bool isMobile;

    void evaluateHardware() {
        int coreCount = std::thread::hardware_concurrency();
        int memoryGB = 16; 
        int maxTextureSize = 8192; 
        
        std::string rawGpu = getMockGpuVendorString();
        std::transform(rawGpu.begin(), rawGpu.end(), rawGpu.begin(), ::tolower);
        
        // Strip trademarks like (R) or (TM) that break rigid regex matching
        std::string renderer = std::regex_replace(rawGpu, std::regex("\\(r\\)|\\(tm\\)|graphics"), "");
        Tier calculated = Tier::HIGH;

        auto test = [&](const std::string& pat) { return std::regex_search(renderer, std::regex(pat)); };

        // ---------------------------------------------------------
        // MASSIVE HEURISTIC GPU CLASSIFICATION MATRIX
        // ---------------------------------------------------------

        // 1. APPLE SILICON & A-SERIES
        if (renderer.find("apple") != std::string::npos) {
            if (test("m[1-9]")) calculated = (renderer.find("max") != std::string::npos || renderer.find("pro") != std::string::npos || renderer.find("ultra") != std::string::npos) ? Tier::HIGH : Tier::MID;
            else calculated = (coreCount >= 6 && maxTextureSize >= 8192) ? Tier::HIGH : Tier::MID;
        }
        // 2. NVIDIA DESKTOP & LAPTOP
        else if (renderer.find("nvidia") != std::string::npos || renderer.find("geforce") != std::string::npos || renderer.find("quadro") != std::string::npos) {
            if (test("rtx\\s*[2-9][0-9]{3}") || renderer.find("titan") != std::string::npos || test("quadro\\s*rtx")) calculated = Tier::HIGH;
            else if (test("gtx\\s*(?:10[6-9][0-9]|16[5-9][0-9]|9[8-9][0-9])")) calculated = Tier::HIGH;
            else if (test("gtx\\s*(?:1050|970|960|950|780)")) calculated = Tier::MID;
            else if (test("gtx\\s*(?:4|5|6)[0-9]{2}") || test("gt\\s*[0-9]+") || test("[7-9][1-4]0m") || test("mx[1-4][0-9]{2}")) calculated = Tier::LOW;
            else calculated = Tier::MID;
        }
        // 3. AMD RADEON
        else if (renderer.find("amd") != std::string::npos || renderer.find("radeon") != std::string::npos) {
            if (test("rx\\s*[5-8][0-9]{3}") || test("vega\\s*(?:56|64)") || renderer.find("radeon pro") != std::string::npos) calculated = Tier::HIGH;
            else if (test("rx\\s*(?:4[0-9]{2}|5[7-9][0-9])") || test("6[6-9]0m")) calculated = Tier::MID;
            else calculated = Tier::LOW;
        }
        // 4. INTEL GRAPHICS
        else if (renderer.find("intel") != std::string::npos) {
            if (test("arc\\s*a[3-7][0-9]{2}") || (renderer.find("iris") != std::string::npos && renderer.find("xe") != std::string::npos) || test("iris\\s*(?:plus|pro)")) calculated = Tier::MID;
            else calculated = Tier::LOW;
        }
        // 5. QUALCOMM ADRENO / SNAPDRAGON (ANDROID)
        else if (renderer.find("adreno") != std::string::npos || renderer.find("snapdragon") != std::string::npos) {
            std::smatch match;
            int series = 0;
            if (std::regex_search(renderer, match, std::regex("adreno\\s*([0-9]{3})"))) series = std::stoi(match[1].str());
            
            if (series >= 800 || renderer.find("snapdragon 8 elite") != std::string::npos || renderer.find("elite") != std::string::npos) calculated = Tier::HIGH;
            else if (series >= 730 || renderer.find("snapdragon 8 gen") != std::string::npos) calculated = Tier::HIGH;
            else if (series >= 650 || renderer.find("snapdragon 8") != std::string::npos || renderer.find("snapdragon 7") != std::string::npos) calculated = Tier::MID;
            else if ((series == 0 && coreCount >= 8 && maxTextureSize >= 8192) || renderer.find("snapdragon") != std::string::npos) calculated = Tier::MID;
            else calculated = Tier::LOW;
        }
        // 6. ARM MALI (ANDROID)
        else if (renderer.find("mali") != std::string::npos) {
            if (renderer.find("immortalis") != std::string::npos || test("g[7-9][1-9][0-9]") || test("g7[7-9]")) calculated = Tier::HIGH;
            else if (test("g[7-9][0-9]")) calculated = Tier::MID;
            else calculated = Tier::LOW;
        }
        // 7. SAMSUNG XCLIPSE / EXYNOS (MOBILE)
        else if (renderer.find("xclipse") != std::string::npos || renderer.find("exynos") != std::string::npos) {
            std::smatch match;
            if (std::regex_search(renderer, match, std::regex("xclipse\\s*([0-9]{3})"))) {
                calculated = (std::stoi(match[1].str()) >= 920) ? Tier::HIGH : Tier::MID;
            } else {
                calculated = (coreCount >= 8 && maxTextureSize >= 8192) ? Tier::HIGH : Tier::LOW;
            }
        }
        // 8. MEDIATEK (DIMENSITY / HELIO)
        else if (renderer.find("mediatek") != std::string::npos || renderer.find("dimensity") != std::string::npos || renderer.find("helio") != std::string::npos) {
            if (renderer.find("dimensity 9") != std::string::npos || renderer.find("dimensity 8") != std::string::npos) calculated = Tier::HIGH;
            else if (renderer.find("dimensity") != std::string::npos || renderer.find("helio g9") != std::string::npos || (coreCount >= 8 && maxTextureSize >= 8192)) calculated = Tier::MID;
            else calculated = Tier::LOW;
        }
        // 9. POWERVR / UNISOC / SPREADTRUM
        else if (renderer.find("powervr") != std::string::npos || renderer.find("unisoc") != std::string::npos || renderer.find("spreadtrum") != std::string::npos || renderer.find("tigert") != std::string::npos) {
            calculated = Tier::LOW;
        } 
        // 10. FALLBACK FOR UNKNOWN GPUs
        else {
            calculated = Tier::LOW;
        }

        // Hard limits and Accessibility Overrides
        if (coreCount <= 2 && memoryGB <= 2) calculated = Tier::VERY_LOW;
        else if (coreCount <= 2 || memoryGB <= 2) calculated = Tier::LOW; // Only demote on extremely constrained hardware
        else if (memoryGB <= 3 && calculated == Tier::HIGH) calculated = Tier::MID; // <=3GB memory can't sustain high-tier
        
        // Absolute fail-safe: Mobile devices NEVER get "High" tier effects.
        if (isMobile && calculated == Tier::HIGH) calculated = Tier::MID;

        currentTier = calculated;
    }

    // ---------------------------------------------------------
    // LIVE V-SYNC DEGRADATION MONITOR (FPS SAFETY NET)
    // Tuned to avoid false-positive downgrades on mid-tier hardware
    // ---------------------------------------------------------
    void degradationLoop() {
        int sustainedDrops = 0;
        int detectedBaseline = 60; // Assume standard 60fps by default
        int batterySaverTicks = 0;
        int gracePeriodTicks = 0;
        std::vector<int> measurements;

        while (isMonitoring && currentTier != Tier::VERY_LOW && currentTier != Tier::LOW) {
            std::this_thread::sleep_for(std::chrono::seconds(1));
            int fps = getMockSystemFps();
            int maxFrameDelta = getMockMaxFrameDelta(); // Tracks maximum MS between consecutive frames

            gracePeriodTicks++;
            if (gracePeriodTicks <= 3) {
                // Wait for initial hydration to clear, then sample naturally achievable FPS
                if (gracePeriodTicks > 1 && fps > 0) measurements.push_back(fps);
                continue;
            }

            // Lock in baseline detection once grace period concludes
            if (!measurements.empty() && detectedBaseline == 60) {
                double avg = std::accumulate(measurements.begin(), measurements.end(), 0.0) / measurements.size();
                // Accurately verify 30fps: average ~30 AND frame pacing is universally stable
                if (avg >= 28 && avg <= 34 && maxFrameDelta < 45) {
                    detectedBaseline = 30;
                }
            }

            // Dynamic MID-SESSION Battery Saver Detection
            if (detectedBaseline == 60 && fps >= 28 && fps <= 33 && maxFrameDelta < 45) {
                batterySaverTicks++;
                if (batterySaverTicks >= 2) {
                    detectedBaseline = 30;
                    sustainedDrops = 0; // Wipe lag penalties incurred during detection phase
                }
            } else if (detectedBaseline == 30 && fps >= 45) {
                detectedBaseline = 60;
                sustainedDrops = 0;
                batterySaverTicks = 0;
            } else if (detectedBaseline == 60 && (fps < 28 || fps > 33 || maxFrameDelta >= 45)) {
                batterySaverTicks = std::max(0, batterySaverTicks - 1);
            }

            // Battery Saver Mode active: Re-assign threshold
            int floor = (detectedBaseline == 30) ? ((currentTier == Tier::HIGH) ? 22 : 18) : ((currentTier == Tier::HIGH) ? 45 : 38);
            int limit = (currentTier == Tier::HIGH) ? 4 : 6;

            if (fps < floor) sustainedDrops++;
            else sustainedDrops = std::max(0, sustainedDrops - 2);

            if (sustainedDrops >= limit) {
                currentTier = (currentTier == Tier::HIGH) ? Tier::MID : Tier::LOW;
                std::cout << "[HPOE] Throttling detected. Downgraded tier.\n";
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

#include <iostream>
#include <string>
#include <thread>
#include <chrono>
#include <algorithm>
#include <regex>

/**
 * HPOE (Heuristic Page Optimization Engine) - C++ Proposal
 * Full Regex Matrix Implementation.
 */

enum class Tier { HIGH, MID, LOW, VERY_LOW };

class HPOE {
private:
    Tier currentTier;
    bool isMonitoring;
    bool isMobile;

    void evaluateHardware() {
        int coreCount = std::thread::hardware_concurrency();
        int memoryGB = 16; // Mock memory retrieval
        int maxTextureSize = 8192; // Mock WebGL metric
        
        std::string rawGpu = getMockGpuVendorString();
        std::transform(rawGpu.begin(), rawGpu.end(), rawGpu.begin(), ::tolower);
        
        // Strip out trademarks and graphics keyword
        std::string renderer = std::regex_replace(rawGpu, std::regex("\\(r\\)|\\(tm\\)|graphics"), "");
        Tier calculated = Tier::HIGH;

        auto test = [&](const std::string& pat) { return std::regex_search(renderer, std::regex(pat)); };

        // 1. APPLE
        if (renderer.find("apple") != std::string::npos) {
            if (test("m[1-9]")) {
                calculated = (renderer.find("max") != std::string::npos || renderer.find("pro") != std::string::npos || renderer.find("ultra") != std::string::npos) ? Tier::HIGH : Tier::MID;
            } else {
                calculated = (coreCount >= 6 && maxTextureSize >= 8192) ? Tier::HIGH : Tier::MID;
            }
        }
        // 2. NVIDIA
        else if (renderer.find("nvidia") != std::string::npos || renderer.find("geforce") != std::string::npos || renderer.find("quadro") != std::string::npos) {
            if (test("rtx\\s*[2-9][0-9]{3}") || renderer.find("titan") != std::string::npos || test("quadro\\s*rtx")) calculated = Tier::HIGH;
            else if (test("gtx\\s*(?:10[6-9][0-9]|16[5-9][0-9]|9[8-9][0-9])")) calculated = Tier::HIGH;
            else if (test("gtx\\s*(?:1050|970|960|950|780)")) calculated = Tier::MID;
            else if (test("gtx\\s*(?:4|5|6)[0-9]{2}") || test("gt\\s*[0-9]+") || test("[7-9][1-4]0m") || test("mx[1-4][0-9]{2}")) calculated = Tier::LOW;
            else calculated = Tier::MID;
        }
        // 3. AMD
        else if (renderer.find("amd") != std::string::npos || renderer.find("radeon") != std::string::npos) {
            if (test("rx\\s*[5-8][0-9]{3}") || test("vega\\s*(?:56|64)") || renderer.find("radeon pro") != std::string::npos) calculated = Tier::HIGH;
            else if (test("rx\\s*(?:4[0-9]{2}|5[7-9][0-9])") || test("6[6-9]0m")) calculated = Tier::MID;
            else calculated = Tier::LOW;
        }
        // 4. INTEL
        else if (renderer.find("intel") != std::string::npos) {
            if (test("arc\\s*a[3-7][0-9]{2}") || (renderer.find("iris") != std::string::npos && renderer.find("xe") != std::string::npos) || test("iris\\s*(?:plus|pro)")) calculated = Tier::MID;
            else calculated = Tier::LOW;
        }
        // 5. QUALCOMM / MOBILES
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
        // 6. MALI
        else if (renderer.find("mali") != std::string::npos) {
            if (renderer.find("immortalis") != std::string::npos || test("g[7-9][1-9][0-9]") || test("g7[7-9]")) calculated = Tier::HIGH;
            else if (test("g[7-9][0-9]")) calculated = Tier::MID;
            else calculated = Tier::LOW;
        }
        // 7. SAMSUNG
        else if (renderer.find("xclipse") != std::string::npos || renderer.find("exynos") != std::string::npos) {
            std::smatch match;
            if (std::regex_search(renderer, match, std::regex("xclipse\\s*([0-9]{3})"))) {
                calculated = (std::stoi(match[1].str()) >= 920) ? Tier::HIGH : Tier::MID;
            } else {
                calculated = (coreCount >= 8 && maxTextureSize >= 8192) ? Tier::HIGH : Tier::LOW;
            }
        }
        // 8. MEDIATEK
        else if (renderer.find("mediatek") != std::string::npos || renderer.find("dimensity") != std::string::npos || renderer.find("helio") != std::string::npos) {
            if (renderer.find("dimensity 9") != std::string::npos || renderer.find("dimensity 8") != std::string::npos) calculated = Tier::HIGH;
            else if (renderer.find("dimensity") != std::string::npos || renderer.find("helio g9") != std::string::npos || (coreCount >= 8 && maxTextureSize >= 8192)) calculated = Tier::MID;
            else calculated = Tier::LOW;
        }
        else {
            calculated = Tier::LOW;
        }

        // Failsafes
        if (coreCount <= 2 && memoryGB <= 2) calculated = Tier::VERY_LOW;
        else if (coreCount <= 2 || memoryGB <= 2) calculated = Tier::LOW;
        else if (memoryGB <= 3 && calculated == Tier::HIGH) calculated = Tier::MID;
        if (isMobile && calculated == Tier::HIGH) calculated = Tier::MID;

        currentTier = calculated;
    }

    void degradationLoop() {
        int sustainedDrops = 0;
        while (isMonitoring && currentTier != Tier::VERY_LOW && currentTier != Tier::LOW) {
            std::this_thread::sleep_for(std::chrono::seconds(1));
            int currentFps = getMockSystemFps();
            int floor = (currentTier == Tier::HIGH) ? 45 : 38;
            int limit = (currentTier == Tier::HIGH) ? 4 : 6;

            if (currentFps < floor) sustainedDrops++;
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

public:
    HPOE(bool mobile = false) : isMobile(mobile), isMonitoring(true) {
        evaluateHardware();
        std::thread(&HPOE::degradationLoop, this).detach();
    }
    ~HPOE() { isMonitoring = false; }
};

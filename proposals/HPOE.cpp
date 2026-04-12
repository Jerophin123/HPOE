#include <iostream>
#include <string>
#include <thread>
#include <chrono>
#include <algorithm>

/**
 * HPOE (Heuristic Page Optimization Engine) - C++ Proposal
 * System-level hardware translation.
 */

enum class Tier { HIGH, MID, LOW, VERY_LOW };

class HPOE {
private:
    Tier currentTier;
    bool isMonitoring;

    void evaluateHardware() {
        int coreCount = std::thread::hardware_concurrency();
        std::string gpuInfo = getMockGpuVendorString();
        
        // Transform to lowercase for naive matching
        std::transform(gpuInfo.begin(), gpuInfo.end(), gpuInfo.begin(), ::tolower);

        if (gpuInfo.find("nvidia") != std::string::npos || gpuInfo.find("rtx") != std::string::npos) {
            currentTier = Tier::HIGH;
        } else if (gpuInfo.find("amd") != std::string::npos) {
            currentTier = Tier::HIGH;
        } else if (gpuInfo.find("intel") != std::string::npos) {
            currentTier = Tier::MID;
        } else {
            currentTier = Tier::LOW;
        }

        if (coreCount <= 2) {
            currentTier = Tier::LOW;
        }
    }

    void degradationLoop() {
        int sustainedDrops = 0;
        
        while (isMonitoring && currentTier != Tier::VERY_LOW) {
            std::this_thread::sleep_for(std::chrono::seconds(1));
            int currentFps = getMockSystemFps();
            
            int floor = (currentTier == Tier::HIGH) ? 45 : 38;
            int limit = (currentTier == Tier::HIGH) ? 4 : 6;

            if (currentFps < floor) {
                sustainedDrops++;
            } else {
                sustainedDrops = std::max(0, sustainedDrops - 2);
            }

            if (sustainedDrops >= limit) {
                downgradeTier();
                sustainedDrops = 0;
            }
        }
    }

    void downgradeTier() {
        if (currentTier == Tier::HIGH) currentTier = Tier::MID;
        else if (currentTier == Tier::MID) currentTier = Tier::LOW;
        else if (currentTier == Tier::LOW) currentTier = Tier::VERY_LOW;
        std::cout << "[HPOE] Throttling detected. Downgraded tier.\n";
    }

    std::string getMockGpuVendorString() {
        // e.g. dxdiag / vulkan info layer mapping
        return "NVIDIA GeForce RTX 3080";
    }

    int getMockSystemFps() {
        return 60;
    }

public:
    HPOE() : currentTier(Tier::HIGH), isMonitoring(true) {
        evaluateHardware();
        std::thread(&HPOE::degradationLoop, this).detach();
    }
    
    ~HPOE() {
        isMonitoring = false;
    }

    Tier getTier() const { return currentTier; }
};

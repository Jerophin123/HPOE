"""
HPOE (Heuristic Page Optimization Engine) - Python Proposal
Full Regex Heuristics and Threaded Live FPS Degradation Monitoring.
"""

import time
import re
import threading
import multiprocessing

class HPOE:
    def __init__(self, is_mobile=False):
        self.tier = "high"
        self.is_mobile = is_mobile
        self.evaluate_hardware()
        self.start_live_monitor()

    def evaluate_hardware(self):
        cores = multiprocessing.cpu_count()
        memory_gb = 16 # Simulated mock OS memory 
        max_texture_size = 16384 # Simulated WebGL/GPU texture limit
        prefers_reduced_motion = False
        
        raw_renderer = self._get_os_gpu_string().lower()
        renderer = re.sub(r'\((r|tm)\)', '', raw_renderer).replace('graphics', '').strip()
        calculated_tier = "high"

        # 1. APPLE SILICON & A-SERIES
        if "apple" in renderer:
            if re.search(r'm[1-9]', renderer):
                calculated_tier = "high" if ("max" in renderer or "pro" in renderer or "ultra" in renderer) else "mid"
            else:
                calculated_tier = "high" if (cores >= 6 and max_texture_size >= 8192) else "mid"
        
        # 2. NVIDIA
        elif "nvidia" in renderer or "geforce" in renderer or "quadro" in renderer:
            if re.search(r'rtx\s*[2-9][0-9]{3}', renderer) or "titan" in renderer or re.search(r'quadro\s*rtx', renderer):
                calculated_tier = "high"
            elif re.search(r'gtx\s*(?:10[6-9][0-9]|16[5-9][0-9]|9[8-9][0-9])', renderer):
                calculated_tier = "high"
            elif re.search(r'gtx\s*(?:1050|970|960|950|780)', renderer):
                calculated_tier = "mid"
            elif re.search(r'gtx\s*(?:4|5|6)[0-9]{2}', renderer) or re.search(r'gt\s*[0-9]+', renderer) or re.search(r'[7-9][1-4]0m', renderer) or re.search(r'mx[1-4][0-9]{2}', renderer):
                calculated_tier = "low"
            else:
                calculated_tier = "mid"

        # 3. AMD RADEON
        elif "amd" in renderer or "radeon" in renderer:
            if re.search(r'rx\s*[5-8][0-9]{3}', renderer) or re.search(r'vega\s*(?:56|64)', renderer) or re.search(r'radeon\s*pro', renderer):
                calculated_tier = "high"
            elif re.search(r'rx\s*(?:4[0-9]{2}|5[7-9][0-9])', renderer) or re.search(r'6[6-9]0m', renderer):
                calculated_tier = "mid"
            else:
                calculated_tier = "low"

        # 4. INTEL GRAPHICS
        elif "intel" in renderer:
            if re.search(r'arc\s*a[3-7][0-9]{2}', renderer) or ("iris" in renderer and "xe" in renderer) or re.search(r'iris\s*(?:plus|pro)', renderer):
                calculated_tier = "mid"
            else:
                calculated_tier = "low"

        # 5. QUALCOMM ADRENO
        elif "adreno" in renderer or "snapdragon" in renderer:
            match = re.search(r'adreno\s*([0-9]{3})', renderer)
            series = int(match.group(1)) if match else 0
            if series >= 800 or "snapdragon 8 elite" in renderer or "elite" in renderer:
                calculated_tier = "high"
            elif series >= 730 or "snapdragon 8 gen" in renderer:
                calculated_tier = "high"
            elif series >= 650 or "snapdragon 8" in renderer or "snapdragon 7" in renderer:
                calculated_tier = "mid"
            elif (series == 0 and cores >= 8 and max_texture_size >= 8192) or "snapdragon" in renderer:
                calculated_tier = "mid"
            else:
                calculated_tier = "low"

        # 6. ARM MALI
        elif "mali" in renderer:
            if "immortalis" in renderer or re.search(r'g[7-9][1-9][0-9]', renderer) or re.search(r'g7[7-9]', renderer):
                calculated_tier = "high"
            elif re.search(r'g[7-9][0-9]', renderer):
                calculated_tier = "mid"
            else:
                calculated_tier = "low"

        # 7. POWERVR
        elif "powervr" in renderer:
            calculated_tier = "low"

        # 8. SAMSUNG XCLIPSE/EXYNOS
        elif "xclipse" in renderer or "exynos" in renderer:
            if "xclipse" in renderer:
                match = re.search(r'xclipse\s*([0-9]{3})', renderer)
                series = int(match.group(1)) if match else 0
                calculated_tier = "high" if series >= 920 else "mid"
            else:
                calculated_tier = "high" if cores >= 8 and max_texture_size >= 8192 else "low"

        # 9. MEDIATEK
        elif "mediatek" in renderer or "dimensity" in renderer or "helio" in renderer:
            if "dimensity 9" in renderer or "dimensity 8" in renderer:
                calculated_tier = "high"
            elif "dimensity" in renderer or "helio g9" in renderer or (cores >= 8 and max_texture_size >= 8192):
                calculated_tier = "mid"
            else:
                calculated_tier = "low"

        # 10. UNISOC
        elif "unisoc" in renderer or "spreadtrum" in renderer or "tigert" in renderer:
            calculated_tier = "low"

        else:
            calculated_tier = "low"

        # Fail-Safes
        if prefers_reduced_motion:
            calculated_tier = "low"
        elif cores <= 2 and memory_gb <= 2:
            calculated_tier = "very-low"
        elif cores <= 2 or memory_gb <= 2:
            calculated_tier = "low"
        elif memory_gb <= 3 and calculated_tier == "high":
            calculated_tier = "mid"
            
        if self.is_mobile and calculated_tier == "high":
            calculated_tier = "mid"
            
        self.tier = calculated_tier
        print(f"[HPOE] Initial Tier set to {self.tier}")

    def start_live_monitor(self):
        monitor = threading.Thread(target=self._degradation_loop, daemon=True)
        monitor.start()

    def _degradation_loop(self):
        sustained_drops = 0
        detected_baseline = 60
        
        while self.tier not in ["low", "very-low"]:
            time.sleep(1.0)
            fps = self._get_application_fps()
            
            floor = 45 if self.tier == "high" else 38
            if detected_baseline == 30:
                 floor = 22 if self.tier == "high" else 18
                 
            limit = 4 if self.tier == "high" else 6
            
            if fps < floor:
                sustained_drops += 1
            else:
                sustained_drops = max(0, sustained_drops - 2)
                
            if sustained_drops >= limit:
                self.tier = "mid" if self.tier == "high" else "low"
                print(f"[HPOE] FPS struggling. Emergency throttle to: {self.tier}")
                sustained_drops = 0

    def _get_os_gpu_string(self):
        return "NVIDIA GeForce RTX 4090"

    def _get_application_fps(self):
        return 60

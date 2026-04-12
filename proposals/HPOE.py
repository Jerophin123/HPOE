"""
HPOE (Heuristic Page Optimization Engine) - Python Proposal
Regex Heuristics & Battery-Saver Aware Threaded Degradation Monitoring.
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
        memory_gb = 16 
        max_texture_size = 16384 
        prefers_reduced_motion = False
        
        # Strip trademarks like (R) or (TM) that break rigid regex matching
        raw_renderer = self._get_os_gpu_string().lower()
        renderer = re.sub(r'\((r|tm)\)', '', raw_renderer).replace('graphics', '').strip()
        calculated_tier = "high"

        # ---------------------------------------------------------
        # MASSIVE HEURISTIC GPU CLASSIFICATION MATRIX
        # ---------------------------------------------------------

        # 1. APPLE SILICON & A-SERIES
        if "apple" in renderer:
            if re.search(r'm[1-9]', renderer): calculated_tier = "high" if ("max" in renderer or "pro" in renderer or "ultra" in renderer) else "mid"
            else: calculated_tier = "high" if (cores >= 6 and max_texture_size >= 8192) else "mid"
        
        # 2. NVIDIA DESKTOP & LAPTOP
        elif "nvidia" in renderer or "geforce" in renderer or "quadro" in renderer:
            if re.search(r'rtx\s*[2-9][0-9]{3}', renderer) or "titan" in renderer or re.search(r'quadro\s*rtx', renderer): calculated_tier = "high"
            elif re.search(r'gtx\s*(?:10[6-9][0-9]|16[5-9][0-9]|9[8-9][0-9])', renderer): calculated_tier = "high"
            elif re.search(r'gtx\s*(?:1050|970|960|950|780)', renderer): calculated_tier = "mid"
            elif re.search(r'gtx\s*(?:4|5|6)[0-9]{2}', renderer) or re.search(r'gt\s*[0-9]+', renderer) or re.search(r'[7-9][1-4]0m', renderer) or re.search(r'mx[1-4][0-9]{2}', renderer): calculated_tier = "low"
            else: calculated_tier = "mid"
            
        # 3. AMD RADEON
        elif "amd" in renderer or "radeon" in renderer:
            if re.search(r'rx\s*[5-8][0-9]{3}', renderer) or re.search(r'vega\s*(?:56|64)', renderer) or re.search(r'radeon\s*pro', renderer): calculated_tier = "high"
            elif re.search(r'rx\s*(?:4[0-9]{2}|5[7-9][0-9])', renderer) or re.search(r'6[6-9]0m', renderer): calculated_tier = "mid"
            else: calculated_tier = "low"
            
        # 4. INTEL GRAPHICS
        elif "intel" in renderer:
            if re.search(r'arc\s*a[3-7][0-9]{2}', renderer) or ("iris" in renderer and "xe" in renderer) or re.search(r'iris\s*(?:plus|pro)', renderer): calculated_tier = "mid"
            else: calculated_tier = "low"
            
        # 5. QUALCOMM ADRENO / SNAPDRAGON (ANDROID)
        elif "adreno" in renderer or "snapdragon" in renderer:
            match = re.search(r'adreno\s*([0-9]{3})', renderer)
            series = int(match.group(1)) if match else 0
            if series >= 800 or "snapdragon 8 elite" in renderer or "elite" in renderer: calculated_tier = "high"
            elif series >= 730 or "snapdragon 8 gen" in renderer: calculated_tier = "high"
            elif series >= 650 or "snapdragon 8" in renderer or "snapdragon 7" in renderer: calculated_tier = "mid"
            elif (series == 0 and cores >= 8 and max_texture_size >= 8192) or "snapdragon" in renderer: calculated_tier = "mid"
            else: calculated_tier = "low"
            
        # 6. ARM MALI (ANDROID)
        elif "mali" in renderer:
            if "immortalis" in renderer or re.search(r'g[7-9][1-9][0-9]', renderer) or re.search(r'g7[7-9]', renderer): calculated_tier = "high"
            elif re.search(r'g[7-9][0-9]', renderer): calculated_tier = "mid"
            else: calculated_tier = "low"
            
        # 7. POWERVR (OLDER IOS / MEDIATEK)
        elif "powervr" in renderer: calculated_tier = "low"
        
        # 8. SAMSUNG XCLIPSE / EXYNOS (MOBILE)
        elif "xclipse" in renderer or "exynos" in renderer:
            if "xclipse" in renderer:
                match = re.search(r'xclipse\s*([0-9]{3})', renderer)
                series = int(match.group(1)) if match else 0
                calculated_tier = "high" if series >= 920 else "mid"
            else: calculated_tier = "high" if cores >= 8 and max_texture_size >= 8192 else "low"
            
        # 9. MEDIATEK (DIMENSITY / HELIO)
        elif "mediatek" in renderer or "dimensity" in renderer or "helio" in renderer:
            if "dimensity 9" in renderer or "dimensity 8" in renderer: calculated_tier = "high"
            elif "dimensity" in renderer or "helio g9" in renderer or (cores >= 8 and max_texture_size >= 8192): calculated_tier = "mid"
            else: calculated_tier = "low"
            
        # 10. UNISOC / SPREADTRUM
        elif "unisoc" in renderer or "spreadtrum" in renderer or "tigert" in renderer:
            calculated_tier = "low"

        # 11. FALLBACK FOR UNKNOWN GPUs
        else: calculated_tier = "low"

        # Hard limits and Accessibility Overrides
        if prefers_reduced_motion: calculated_tier = "low"
        elif cores <= 2 and memory_gb <= 2: calculated_tier = "very-low"
        elif cores <= 2 or memory_gb <= 2: calculated_tier = "low" # Only demote on extremely constrained hardware
        elif memory_gb <= 3 and calculated_tier == "high": calculated_tier = "mid" # <=3GB memory can't sustain high-tier
        
        # Absolute fail-safe: Mobile devices NEVER get "High" tier effects.
        # Even with elite processors, complex CSS blurs will aggressively thermal throttle the mobile chip.
        if self.is_mobile and calculated_tier == "high": calculated_tier = "mid"
            
        self.tier = calculated_tier

    def start_live_monitor(self):
        monitor = threading.Thread(target=self._degradation_loop, daemon=True)
        monitor.start()

    # ---------------------------------------------------------
    # LIVE V-SYNC DEGRADATION MONITOR (FPS SAFETY NET)
    # Tuned to avoid false-positive downgrades on mid-tier hardware
    # ---------------------------------------------------------
    def _degradation_loop(self):
        sustained_drops = 0
        detected_baseline = 60 # Assume standard 60fps by default
        battery_saver_ticks = 0
        baseline_measurements = []
        grace_period_ticks = 0

        while self.tier not in ["low", "very-low"]:
            time.sleep(1.0)
            fps = self._get_application_fps()
            max_frame_delta = self._get_max_frame_delta() # Tracks maximum MS between consecutive frames
            
            grace_period_ticks += 1
            if grace_period_ticks <= 3:
                # Wait for initial hydration to clear, then sample naturally achievable FPS
                if grace_period_ticks > 1 and fps > 0:
                    baseline_measurements.append(fps)
                continue

            # Lock in baseline detection once grace period concludes
            if len(baseline_measurements) > 0 and detected_baseline == 60:
                avg = sum(baseline_measurements) / len(baseline_measurements)
                # Accurately verify 30fps: average ~30 AND frame pacing is universally stable
                if 28 <= avg <= 34 and max_frame_delta < 45:
                    detected_baseline = 30
                    
            # Dynamic MID-SESSION Battery Saver Detection (User toggles mode on/off after loading)
            if detected_baseline == 60 and 28 <= fps <= 33 and max_frame_delta < 45:
                battery_saver_ticks += 1
                if battery_saver_ticks >= 2:
                    detected_baseline = 30
                    sustained_drops = 0 # Wipe lag penalties incurred during the detection phase
            elif detected_baseline == 30 and fps >= 45:
                detected_baseline = 60
                sustained_drops = 0
                battery_saver_ticks = 0
            elif detected_baseline == 60 and (fps < 28 or fps > 33 or max_frame_delta >= 45):
                battery_saver_ticks = max(0, battery_saver_ticks - 1)
                
            # Battery Saver Mode active: Re-assign thresholds to avoid aggressively killing animations
            floor = (22 if self.tier == "high" else 18) if detected_baseline == 30 else (45 if self.tier == "high" else 38)
            limit = 4 if self.tier == "high" else 6
            
            if fps < floor:
                sustained_drops += 1
            else:
                sustained_drops = max(0, sustained_drops - 2)
                
            if sustained_drops >= limit:
                self.tier = "mid" if self.tier == "high" else "low"
                print(f"[HPOE] Emergency throttle to: {self.tier}")
                sustained_drops = 0

    def _get_os_gpu_string(self): return "NVIDIA GeForce RTX 4090"
    def _get_application_fps(self): return 60
    def _get_max_frame_delta(self): return 16

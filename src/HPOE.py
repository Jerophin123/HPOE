"""
HPOE (Heuristic Page Optimization Engine) - Python Proposal
Regex Heuristics, Specs Extraction, & Battery-Saver Loops.
"""

import time
import re
import threading
import multiprocessing

class HPOE:
    def __init__(self, is_mobile=False):
        self.tier = "high"
        self.is_mobile = is_mobile
        self.specs = {
            "vendor": "Unknown",
            "architecture": "Unknown",
            "type": "Unknown",
            "estimatedClass": "Unknown"
        }
        self.evaluate_hardware()
        self.start_live_monitor()

    def evaluate_hardware(self):
        cores = multiprocessing.cpu_count()
        memory_gb = 16 
        max_texture_size = 16384 
        prefers_reduced_motion = False
        
        raw_renderer = self._get_os_gpu_string().lower()
        renderer = re.sub(r'\((r|tm)\)', '', raw_renderer).replace('graphics', '').strip()
        calculated_tier = "high"

        # ---------------------------------------------------------
        # MASSIVE HEURISTIC GPU CLASSIFICATION MATRIX
        # ---------------------------------------------------------

        # 1. APPLE SILICON & A-SERIES
        if "apple" in renderer:
            self.specs["vendor"] = "Apple"
            if re.search(r'm[1-9]', renderer):
                self.specs["architecture"] = "M-Series Silicon"
                self.specs["type"] = "Integrated"
                self.specs["estimatedClass"] = "High-End" if ("max" in renderer or "pro" in renderer or "ultra" in renderer) else "Mid-Range"
                calculated_tier = "high" if self.specs["estimatedClass"] == "High-End" else "mid"
            else:
                self.specs["architecture"] = "A-Series Silicon"
                self.specs["type"] = "Mobile"
                if cores >= 6 and max_texture_size >= 8192:
                    self.specs["estimatedClass"] = "High-End"
                    calculated_tier = "high"
                else:
                    self.specs["estimatedClass"] = "Mid-Range"
                    calculated_tier = "mid"
        
        # 2. NVIDIA DESKTOP & LAPTOP
        elif "nvidia" in renderer or "geforce" in renderer or "quadro" in renderer:
            self.specs["vendor"] = "NVIDIA"
            self.specs["type"] = "Discrete"
            if re.search(r'rtx\s*[2-9][0-9]{3}', renderer) or "titan" in renderer or re.search(r'quadro\s*rtx', renderer):
                self.specs["architecture"] = "RTX / Ampere / Ada / Turing"
                self.specs["estimatedClass"] = "High-End"
                calculated_tier = "high"
            elif re.search(r'gtx\s*(?:10[6-9][0-9]|16[5-9][0-9]|9[8-9][0-9])', renderer):
                self.specs["architecture"] = "GTX High/Mid"
                self.specs["estimatedClass"] = "High-End"
                calculated_tier = "high"
            elif re.search(r'gtx\s*(?:1050|970|960|950|780)', renderer):
                self.specs["architecture"] = "GTX Legacy Mid"
                self.specs["estimatedClass"] = "Mid-Range"
                calculated_tier = "mid"
            elif re.search(r'gtx\s*(?:4|5|6)[0-9]{2}', renderer) or re.search(r'gt\s*[0-9]+', renderer) or re.search(r'[7-9][1-4]0m', renderer) or re.search(r'mx[1-4][0-9]{2}', renderer):
                self.specs["architecture"] = "Legacy / Low-End Mobile (GT/MX)"
                self.specs["estimatedClass"] = "Budget/Legacy"
                calculated_tier = "low"
            else:
                self.specs["architecture"] = "Unknown NVIDIA"
                self.specs["estimatedClass"] = "Mid-Range"
                calculated_tier = "mid"
            
        # 3. AMD RADEON
        elif "amd" in renderer or "radeon" in renderer:
            self.specs["vendor"] = "AMD"
            if re.search(r'rx\s*[5-8][0-9]{3}', renderer) or re.search(r'vega\s*(?:56|64)', renderer) or re.search(r'radeon\s*pro', renderer):
                self.specs["architecture"] = "RDNA / High-End Vega"
                self.specs["type"] = "Discrete"
                self.specs["estimatedClass"] = "High-End"
                calculated_tier = "high"
            elif re.search(r'rx\s*(?:4[0-9]{2}|5[7-9][0-9])', renderer) or re.search(r'6[6-9]0m', renderer):
                self.specs["architecture"] = "Polaris / Modern APU"
                self.specs["type"] = "Integrated"
                self.specs["estimatedClass"] = "Mid-Range"
                calculated_tier = "mid"
            else:
                self.specs["architecture"] = "Legacy GCN or Budget APU"
                self.specs["type"] = "Integrated"
                self.specs["estimatedClass"] = "Budget/Legacy"
                calculated_tier = "low"
            
        # 4. INTEL GRAPHICS
        elif "intel" in renderer:
            self.specs["vendor"] = "Intel"
            if re.search(r'arc\s*a[3-7][0-9]{2}', renderer):
                self.specs["architecture"] = "Arc Alchemist"
                self.specs["type"] = "Discrete"
                self.specs["estimatedClass"] = "Mid-Range"
                calculated_tier = "mid"
            elif ("iris" in renderer and "xe" in renderer) or re.search(r'iris\s*(?:plus|pro)', renderer):
                self.specs["architecture"] = "Iris Xe/Plus"
                self.specs["type"] = "Integrated"
                self.specs["estimatedClass"] = "Mid-Range"
                calculated_tier = "mid"
            else:
                self.specs["architecture"] = "UHD / HD Legacy"
                self.specs["type"] = "Integrated"
                self.specs["estimatedClass"] = "Budget/Legacy"
                calculated_tier = "low"
            
        # 5. QUALCOMM ADRENO / SNAPDRAGON (ANDROID)
        elif "adreno" in renderer or "snapdragon" in renderer:
            self.specs["vendor"] = "Qualcomm"
            self.specs["type"] = "Mobile"
            match = re.search(r'adreno\s*([0-9]{3})', renderer)
            series = int(match.group(1)) if match else 0
            
            if series >= 800 or "snapdragon 8 elite" in renderer or "elite" in renderer:
                self.specs["architecture"] = f"Adreno {series}" if series else "Snapdragon 8 Elite Flagship"
                self.specs["estimatedClass"] = "High-End"
                calculated_tier = "high"
            elif series >= 730 or "snapdragon 8 gen" in renderer:
                self.specs["architecture"] = f"Adreno {series}" if series else "Snapdragon 8 Gen Flagship"
                self.specs["estimatedClass"] = "High-End"
                calculated_tier = "high"
            elif series >= 650 or "snapdragon 8" in renderer or "snapdragon 7" in renderer:
                self.specs["architecture"] = f"Adreno {series}" if series else "Snapdragon 7/8 Series"
                self.specs["estimatedClass"] = "Mid-Range"
                calculated_tier = "mid"
            elif (series == 0 and cores >= 8 and max_texture_size >= 8192) or "snapdragon" in renderer:
                self.specs["architecture"] = "Modern Adreno/Snapdragon (Masked)"
                self.specs["estimatedClass"] = "Mid-Range"
                calculated_tier = "mid"
            else:
                self.specs["architecture"] = f"Adreno {series or 'Legacy'}"
                self.specs["estimatedClass"] = "Budget/Legacy"
                calculated_tier = "low"
            
        # 6. ARM MALI (ANDROID)
        elif "mali" in renderer:
            self.specs["vendor"] = "ARM"
            self.specs["type"] = "Mobile"
            if "immortalis" in renderer or re.search(r'g[7-9][1-9][0-9]', renderer) or re.search(r'g7[7-9]', renderer):
                self.specs["architecture"] = "Mali Valhall / Immortalis Flagship"
                self.specs["estimatedClass"] = "High-End"
                calculated_tier = "high"
            elif re.search(r'g[7-9][0-9]', renderer):
                self.specs["architecture"] = "Mali Valhall / Immortalis"
                self.specs["estimatedClass"] = "Mid-Range"
                calculated_tier = "mid"
            else:
                self.specs["architecture"] = "Legacy Mali / Budget G-Series"
                self.specs["estimatedClass"] = "Budget/Legacy"
                calculated_tier = "low"
            
        # 7. POWERVR (OLDER IOS / MEDIATEK)
        elif "powervr" in renderer:
            self.specs["vendor"] = "Imagination Technologies"
            self.specs["type"] = "Mobile"
            self.specs["architecture"] = "PowerVR Rogue/SGX"
            self.specs["estimatedClass"] = "Budget/Legacy"
            calculated_tier = "low"
        
        # 8. SAMSUNG XCLIPSE / EXYNOS (MOBILE)
        elif "xclipse" in renderer or "exynos" in renderer:
            self.specs["vendor"] = "Samsung"
            self.specs["type"] = "Mobile"
            if "xclipse" in renderer:
                match = re.search(r'xclipse\s*([0-9]{3})', renderer)
                series = int(match.group(1)) if match else 0
                if series >= 920:
                    self.specs["architecture"] = f"Xclipse {series} (RDNA Flagship)"
                    self.specs["estimatedClass"] = "High-End"
                    calculated_tier = "high"
                else:
                    self.specs["architecture"] = f"Xclipse {series} (RDNA)"
                    self.specs["estimatedClass"] = "Mid-Range"
                    calculated_tier = "mid"
            else:
                if cores >= 8 and max_texture_size >= 8192:
                    self.specs["architecture"] = "Exynos Flagship"
                    self.specs["estimatedClass"] = "High-End"
                    calculated_tier = "high"
                else:
                    self.specs["architecture"] = "Exynos Legacy/Masked"
                    self.specs["estimatedClass"] = "Budget/Legacy"
                    calculated_tier = "low"
            
        # 9. MEDIATEK (DIMENSITY / HELIO)
        elif "mediatek" in renderer or "dimensity" in renderer or "helio" in renderer:
            self.specs["vendor"] = "MediaTek"
            self.specs["type"] = "Mobile"
            if "dimensity 9" in renderer or "dimensity 8" in renderer:
                self.specs["architecture"] = "Dimensity 8000/9000 Flagship"
                self.specs["estimatedClass"] = "High-End"
                calculated_tier = "high"
            elif "dimensity" in renderer or "helio g9" in renderer or (cores >= 8 and max_texture_size >= 8192):
                self.specs["architecture"] = "Dimensity / High-End Helio"
                self.specs["estimatedClass"] = "Mid-Range"
                calculated_tier = "mid"
            else:
                self.specs["architecture"] = "Helio Legacy / Entry SoC"
                self.specs["estimatedClass"] = "Budget/Legacy"
                calculated_tier = "low"
            
        # 10. UNISOC / SPREADTRUM
        elif "unisoc" in renderer or "spreadtrum" in renderer or "tigert" in renderer:
            self.specs["vendor"] = "Unisoc"
            self.specs["type"] = "Mobile"
            self.specs["architecture"] = "Unisoc / Spreadtrum"
            self.specs["estimatedClass"] = "Budget/Legacy"
            calculated_tier = "low"

        # 11. FALLBACK FOR UNKNOWN GPUs
        if renderer == "unknown gpu" or renderer == "unknown" or self.specs["vendor"] == "Unknown":
            self.specs["estimatedClass"] = "Budget/Legacy"
            calculated_tier = "low"
            self.specs["architecture"] = "Unknown (Fallback)"

        # Hard limits and Accessibility Overrides
        if prefers_reduced_motion: calculated_tier = "low"
        elif cores < 3 and memory_gb < 3: calculated_tier = "very-low"
        elif cores <= 2 or memory_gb <= 2: calculated_tier = "low" 
        elif memory_gb <= 3 and calculated_tier == "high": calculated_tier = "mid" 
        
        # Absolute fail-safe
        if self.is_mobile and calculated_tier == "high": calculated_tier = "mid"
            
        self.tier = calculated_tier

    def start_live_monitor(self):
        monitor = threading.Thread(target=self._degradation_loop, daemon=True)
        monitor.start()

    # ---------------------------------------------------------
    # LIVE V-SYNC DEGRADATION MONITOR (FPS SAFETY NET)
    # ---------------------------------------------------------
    def _degradation_loop(self):
        sustained_drops = 0
        detected_baseline = 60
        battery_saver_ticks = 0
        baseline_measurements = []
        is_baseline_locked = False
        grace_period_ticks = 0

        while self.tier not in ["low", "very-low"]:
            time.sleep(1.0)
            fps = self._get_application_fps()
            max_frame_delta = self._get_max_frame_delta() 
            
            grace_period_ticks += 1
            if grace_period_ticks <= 3:
                if grace_period_ticks > 1 and fps > 0:
                    baseline_measurements.append(fps)
                continue

            if len(baseline_measurements) > 0 and not is_baseline_locked:
                avg = sum(baseline_measurements) / len(baseline_measurements)
                if avg > 65:
                    detected_baseline = round(avg)
                elif 28 <= avg <= 34 and max_frame_delta < 45:
                    detected_baseline = 30
                else:
                    detected_baseline = 60
                is_baseline_locked = True
                    
            if detected_baseline >= 60 and 28 <= fps <= 33 and max_frame_delta < 45:
                battery_saver_ticks += 1
                if battery_saver_ticks >= 2:
                    detected_baseline = 30
                    sustained_drops = 0 
            elif detected_baseline == 30 and fps >= 45:
                detected_baseline = round(fps) if fps > 65 else 60
                sustained_drops = 0
                battery_saver_ticks = 0
            elif detected_baseline >= 60 and (fps < 28 or fps > 33 or max_frame_delta >= 45):
                battery_saver_ticks = max(0, battery_saver_ticks - 1)
                
            floor = 22 if detected_baseline == 30 else 40
            limit = 3
            
            if fps < floor: sustained_drops += 1
            else: sustained_drops = max(0, sustained_drops - 2)
                
            if sustained_drops >= limit:
                self.tier = "mid" if self.tier == "high" else "low"
                print(f"[Hardware Profiler] Emergency Throttling to Tier: {self.tier}")
                sustained_drops = 0

    def _get_os_gpu_string(self): return "Mali-G77 MC9"
    def _get_application_fps(self): return 60
    def _get_max_frame_delta(self): return 16

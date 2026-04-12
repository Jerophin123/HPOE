//! HPOE (Heuristic Page Optimization Engine) - Rust Proposal
//! Includes Battery Saver FPS Check Bounds, Full Matrix Logic, and Specs Object.
use std::thread;
use std::time::Duration;
use std::sync::{Arc, Mutex};
use regex::Regex;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Tier { High, Mid, Low, VeryLow }

#[derive(Debug, Clone)]
pub struct HardwareSpecs {
    pub vendor: String,
    pub architecture: String,
    pub h_type: String, // type is reserved keyword
    pub estimated_class: String,
}

impl Default for HardwareSpecs {
    fn default() -> Self {
        HardwareSpecs {
            vendor: "Unknown".to_string(),
            architecture: "Unknown".to_string(),
            h_type: "Unknown".to_string(),
             estimated_class: "Unknown".to_string(),
        }
    }
}

pub struct HpoeProfiler {
    pub tier: Arc<Mutex<Tier>>,
    pub specs: Arc<Mutex<HardwareSpecs>>,
    pub is_mobile: bool,
}

impl HpoeProfiler {
    pub fn new(is_mobile: bool) -> Self {
        let profiler = HpoeProfiler { 
            tier: Arc::new(Mutex::new(Tier::High)), 
            specs: Arc::new(Mutex::new(HardwareSpecs::default())),
            is_mobile 
        };
        profiler.evaluate_hardware();
        profiler.start_degradation_loop();
        profiler
    }

    fn evaluate_hardware(&self) {
        let mut tier_lock = self.tier.lock().unwrap();
        let mut specs_lock = self.specs.lock().unwrap();
        
        let cores = 8;
        let memory_gb = 16;
        let max_texture_size = 8192;
        
        let raw = Self::mock_gpu_string().to_lowercase();
        let re_clean = Regex::new(r"\((r|tm)\)|graphics").unwrap();
        let renderer = re_clean.replace_all(&raw, "").trim().to_string();
        
        let mut calc = Tier::High;
        let has = |s: &str| renderer.contains(s);
        let test = |pat: &str| Regex::new(pat).unwrap().is_match(&renderer);

        // ---------------------------------------------------------
        // MASSIVE HEURISTIC GPU CLASSIFICATION MATRIX
        // ---------------------------------------------------------

        // 1. APPLE SILICON & A-SERIES
        if has("apple") {
            specs_lock.vendor = "Apple".into();
            if test(r"m[1-9]") { 
                specs_lock.architecture = "M-Series Silicon".into();
                specs_lock.h_type = "Integrated".into();
                if has("max") || has("pro") || has("ultra") { 
                    specs_lock.estimated_class = "High-End".into();
                    calc = Tier::High;
                } else { 
                    specs_lock.estimated_class = "Mid-Range".into();
                    calc = Tier::Mid;
                } 
            } else { 
                specs_lock.architecture = "A-Series Silicon".into();
                specs_lock.h_type = "Mobile".into();
                if cores >= 6 && max_texture_size >= 8192 { 
                    specs_lock.estimated_class = "High-End".into();
                    calc = Tier::High;
                } else { 
                    specs_lock.estimated_class = "Mid-Range".into();
                    calc = Tier::Mid;
                } 
            };
        } 
        // 2. NVIDIA DESKTOP & LAPTOP
        else if has("nvidia") || has("geforce") || has("quadro") {
            specs_lock.vendor = "NVIDIA".into();
            specs_lock.h_type = "Discrete".into();
            if test(r"rtx\s*[2-9][0-9]{3}") || has("titan") || test(r"quadro\s*rtx") { 
                specs_lock.architecture = "RTX / Ampere / Ada / Turing".into();
                specs_lock.estimated_class = "High-End".into();
                calc = Tier::High; 
            }
            else if test(r"gtx\s*(?:10[6-9][0-9]|16[5-9][0-9]|9[8-9][0-9])") { 
                specs_lock.architecture = "GTX High/Mid".into();
                specs_lock.estimated_class = "High-End".into();
                calc = Tier::High; 
            }
            else if test(r"gtx\s*(?:1050|970|960|950|780)") { 
                specs_lock.architecture = "GTX Legacy Mid".into();
                specs_lock.estimated_class = "Mid-Range".into();
                calc = Tier::Mid; 
            }
            else if test(r"gtx\s*(?:4|5|6)[0-9]{2}") || test(r"gt\s*[0-9]+") || test(r"[7-9][1-4]0m") || test(r"mx[1-4][0-9]{2}") { 
                specs_lock.architecture = "Legacy / Low-End Mobile (GT/MX)".into();
                specs_lock.estimated_class = "Budget/Legacy".into();
                calc = Tier::Low; 
            }
            else { 
                specs_lock.architecture = "Unknown NVIDIA".into();
                specs_lock.estimated_class = "Mid-Range".into();
                calc = Tier::Mid; 
            }
        } 
        // 3. AMD RADEON
        else if has("amd") || has("radeon") {
            specs_lock.vendor = "AMD".into();
            if test(r"rx\s*[5-8][0-9]{3}") || test(r"vega\s*(?:56|64)") || has("radeon pro") { 
                specs_lock.architecture = "RDNA / High-End Vega".into();
                specs_lock.h_type = "Discrete".into();
                specs_lock.estimated_class = "High-End".into();
                calc = Tier::High; 
            }
            else if test(r"rx\s*(?:4[0-9]{2}|5[7-9][0-9])") || test(r"6[6-9]0m") { 
                specs_lock.architecture = "Polaris / Modern APU".into();
                specs_lock.h_type = "Integrated".into();
                specs_lock.estimated_class = "Mid-Range".into();
                calc = Tier::Mid; 
            }
            else { 
                specs_lock.architecture = "Legacy GCN or Budget APU".into();
                specs_lock.h_type = "Integrated".into();
                specs_lock.estimated_class = "Budget/Legacy".into();
                calc = Tier::Low; 
            }
        } 
        // 4. INTEL GRAPHICS
        else if has("intel") {
            specs_lock.vendor = "Intel".into();
            if test(r"arc\s*a[3-7][0-9]{2}") || (has("iris") && has("xe")) || test(r"iris\s*(?:plus|pro)") { 
                specs_lock.architecture = "Iris Xe/Plus".into();
                specs_lock.h_type = "Integrated".into();
                specs_lock.estimated_class = "Mid-Range".into();
                calc = Tier::Mid; 
            }
            else { 
                specs_lock.architecture = "UHD / HD Legacy".into();
                specs_lock.h_type = "Integrated".into();
                specs_lock.estimated_class = "Budget/Legacy".into();
                calc = Tier::Low; 
            }
        } 
        // 5. QUALCOMM ADRENO / SNAPDRAGON (ANDROID)
        else if has("adreno") || has("snapdragon") {
            specs_lock.vendor = "Qualcomm".into();
            specs_lock.h_type = "Mobile".into();
            let re_adreno = Regex::new(r"adreno\s*([0-9]{3})").unwrap();
            let mut series = 0;
            if let Some(caps) = re_adreno.captures(&renderer) { series = caps[1].parse::<i32>().unwrap_or(0); }
            if series >= 800 || has("snapdragon 8 elite") || has("elite") || has("snapdragon 8 gen") { 
                specs_lock.architecture = if series != 0 { format!("Adreno {}", series) } else { "Snapdragon 8 Elite".into() };
                specs_lock.estimated_class = "High-End".into();
                calc = Tier::High; 
            }
            else if series >= 650 || has("snapdragon 8") || has("snapdragon 7") || (series == 0 && cores >= 8 && max_texture_size >= 8192) || has("snapdragon") { 
                specs_lock.architecture = if series != 0 { format!("Adreno {}", series) } else { "Snapdragon 7/8".into() };
                specs_lock.estimated_class = "Mid-Range".into();
                calc = Tier::Mid; 
            }
            else { 
                specs_lock.architecture = "Adreno Legacy".into();
                specs_lock.estimated_class = "Budget/Legacy".into();
                calc = Tier::Low; 
            }
        } 
        // 6. ARM MALI (ANDROID)
        else if has("mali") {
            specs_lock.vendor = "ARM".into();
            specs_lock.h_type = "Mobile".into();
            if has("immortalis") || test(r"g[7-9][1-9][0-9]") || test(r"g7[7-9]") { 
                specs_lock.architecture = "Mali Valhall / Immortalis".into();
                specs_lock.estimated_class = "High-End".into();
                calc = Tier::High; 
            }
            else if test(r"g[7-9][0-9]") { 
                specs_lock.architecture = "Mali Valhall Mid".into();
                specs_lock.estimated_class = "Mid-Range".into();
                calc = Tier::Mid; 
            }
            else { 
                specs_lock.architecture = "Legacy Mali".into();
                specs_lock.estimated_class = "Budget/Legacy".into();
                calc = Tier::Low; 
            }
        } 
        // 7. SAMSUNG XCLIPSE / EXYNOS (MOBILE)
        else if has("xclipse") || has("exynos") {
            specs_lock.vendor = "Samsung".into();
            specs_lock.h_type = "Mobile".into();
            if has("xclipse") {
                let mut series = 0;
                if let Some(caps) = Regex::new(r"xclipse\s*([0-9]{3})").unwrap().captures(&renderer) { series = caps[1].parse::<i32>().unwrap_or(0); }
                specs_lock.architecture = format!("Xclipse {}", series);
                if series >= 920 { 
                    specs_lock.estimated_class = "High-End".into();
                    calc = Tier::High; 
                } else { 
                    specs_lock.estimated_class = "Mid-Range".into();
                    calc = Tier::Mid; 
                };
            } else { 
                if cores >= 8 && max_texture_size >= 8192 { 
                    specs_lock.architecture = "Exynos Flagship".into();
                    specs_lock.estimated_class = "High-End".into();
                    calc = Tier::High; 
                } else { 
                    specs_lock.architecture = "Exynos Legacy".into();
                    specs_lock.estimated_class = "Budget/Legacy".into();
                    calc = Tier::Low; 
                };
            }
        } 
        // 8. MEDIATEK (DIMENSITY / HELIO)
        else if has("mediatek") || has("dimensity") || has("helio") {
            specs_lock.vendor = "MediaTek".into();
            specs_lock.h_type = "Mobile".into();
            if has("dimensity 9") || has("dimensity 8") { 
                specs_lock.architecture = "Dimensity Flagship".into();
                specs_lock.estimated_class = "High-End".into();
                calc = Tier::High; 
            }
            else if has("dimensity") || has("helio g9") || (cores >= 8 && max_texture_size >= 8192) { 
                specs_lock.architecture = "Dimensity/Helio Mid".into();
                specs_lock.estimated_class = "Mid-Range".into();
                calc = Tier::Mid; 
            }
            else { 
                specs_lock.architecture = "Helio Legacy".into();
                specs_lock.estimated_class = "Budget/Legacy".into();
                calc = Tier::Low; 
            }
        } 
        // 9. POWERVR / UNISOC / SPREADTRUM
        else if has("powervr") || has("unisoc") || has("spreadtrum") || has("tigert") {
            specs_lock.architecture = "Legacy/Budget".into();
            specs_lock.estimated_class = "Budget/Legacy".into();
            calc = Tier::Low;
        } 
        // 10. FALLBACK FOR UNKNOWN GPUs
        else { 
            specs_lock.architecture = "Unknown (Fallback)".into();
            specs_lock.estimated_class = "Budget/Legacy".into();
            calc = Tier::Low; 
        }

        // Hard limits and Accessibility Overrides
        if cores <= 2 && memory_gb <= 2 { calc = Tier::VeryLow; }
        else if cores <= 2 || memory_gb <= 2 { calc = Tier::Low; } // Only demote on extremely constrained hardware
        else if memory_gb <= 3 && calc == Tier::High { calc = Tier::Mid; } // <=3GB memory can't sustain high-tier
        
        // Absolute fail-safe: Mobile devices NEVER get "High" tier effects.
        if self.is_mobile && calc == Tier::High { calc = Tier::Mid; }

        *tier_lock = calc;
    }

    // ---------------------------------------------------------
    // LIVE V-SYNC DEGRADATION MONITOR (FPS SAFETY NET)
    // ---------------------------------------------------------
    fn start_degradation_loop(&self) {
        let tier_clone = Arc::clone(&self.tier);
        thread::spawn(move || {
            let mut sustained_drops = 0;
            let mut detected_baseline = 60; // Assume standard 60fps by default
            let mut battery_saver_ticks = 0;
            let mut grace_ticks = 0;
            let mut measurements: Vec<u32> = Vec::new();

            loop {
                thread::sleep(Duration::from_secs(1));
                let mut current_tier = *tier_clone.lock().unwrap();
                if current_tier == Tier::VeryLow || current_tier == Tier::Low { break; }
                
                let fps = Self::mock_app_fps();
                let max_frame_delta = Self::mock_max_frame_delta(); 

                grace_ticks += 1;
                if grace_ticks <= 3 {
                    if grace_ticks > 1 && fps > 0 { measurements.push(fps); }
                    continue;
                }

                if !measurements.is_empty() && detected_baseline == 60 {
                    let sum: u32 = measurements.iter().sum();
                    let avg = sum as f64 / measurements.len() as f64;
                    if avg >= 28.0 && avg <= 34.0 && max_frame_delta < 45 {
                        detected_baseline = 30;
                    }
                }

                if detected_baseline == 60 && fps >= 28 && fps <= 33 && max_frame_delta < 45 {
                    battery_saver_ticks += 1;
                    if battery_saver_ticks >= 2 {
                        detected_baseline = 30;
                        sustained_drops = 0; 
                    }
                } else if detected_baseline == 30 && fps >= 45 {
                    detected_baseline = 60;
                    sustained_drops = 0;
                    battery_saver_ticks = 0;
                } else if detected_baseline == 60 && (fps < 28 || fps > 33 || max_frame_delta >= 45) {
                    battery_saver_ticks = battery_saver_ticks.saturating_sub(1);
                }

                let floor = if detected_baseline == 30 { if current_tier == Tier::High { 22 } else { 18 } } 
                            else { if current_tier == Tier::High { 45 } else { 38 } };
                let limit = if current_tier == Tier::High { 4 } else { 6 };
                
                if fps < floor { sustained_drops += 1; } else { sustained_drops = sustained_drops.saturating_sub(2); }
                
                if sustained_drops >= limit {
                    let mut lock = tier_clone.lock().unwrap();
                    *lock = match *lock { Tier::High => Tier::Mid, _ => Tier::Low };
                    println!("[HPOE] Downgraded Tier to: {:?}", *lock);
                    sustained_drops = 0;
                }
            }
        });
    }

    fn mock_gpu_string() -> String { String::from("NVIDIA GeForce RTX 4090") }
    fn mock_app_fps() -> u32 { 60 }
    fn mock_max_frame_delta() -> u32 { 16 }
}

//! HPOE (Heuristic Page Optimization Engine) - Rust Proposal
//! Includes Battery Saver FPS Check Bounds.
use std::thread;
use std::time::Duration;
use std::sync::{Arc, Mutex};
use regex::Regex;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Tier { High, Mid, Low, VeryLow }

pub struct HpoeProfiler {
    pub tier: Arc<Mutex<Tier>>,
    pub is_mobile: bool,
}

impl HpoeProfiler {
    pub fn new(is_mobile: bool) -> Self {
        let profiler = HpoeProfiler { tier: Arc::new(Mutex::new(Tier::High)), is_mobile };
        profiler.evaluate_hardware();
        profiler.start_degradation_loop();
        profiler
    }

    fn evaluate_hardware(&self) {
        let mut tier_lock = self.tier.lock().unwrap();
        let cores = 8;
        let memory_gb = 16;
        let max_texture_size = 8192;
        
        let raw = Self::mock_gpu_string().to_lowercase();
        let re_clean = Regex::new(r"\((r|tm)\)|graphics").unwrap();
        let renderer = re_clean.replace_all(&raw, "").trim().to_string();
        
        let mut calc = Tier::High;
        let has = |s: &str| renderer.contains(s);
        let test = |pat: &str| Regex::new(pat).unwrap().is_match(&renderer);

        if has("apple") {
            calc = if test(r"m[1-9]") { if has("max") || has("pro") || has("ultra") { Tier::High } else { Tier::Mid } } 
                   else { if cores >= 6 && max_texture_size >= 8192 { Tier::High } else { Tier::Mid } };
        } else if has("nvidia") || has("geforce") || has("quadro") {
            if test(r"rtx\s*[2-9][0-9]{3}") || has("titan") || test(r"quadro\s*rtx") { calc = Tier::High; }
            else if test(r"gtx\s*(?:10[6-9][0-9]|16[5-9][0-9]|9[8-9][0-9])") { calc = Tier::High; }
            else if test(r"gtx\s*(?:1050|970|960|950|780)") { calc = Tier::Mid; }
            else if test(r"gtx\s*(?:4|5|6)[0-9]{2}") || test(r"gt\s*[0-9]+") || test(r"[7-9][1-4]0m") || test(r"mx[1-4][0-9]{2}") { calc = Tier::Low; }
            else { calc = Tier::Mid; }
        } else if has("amd") || has("radeon") {
            if test(r"rx\s*[5-8][0-9]{3}") || test(r"vega\s*(?:56|64)") || has("radeon pro") { calc = Tier::High; }
            else if test(r"rx\s*(?:4[0-9]{2}|5[7-9][0-9])") || test(r"6[6-9]0m") { calc = Tier::Mid; }
            else { calc = Tier::Low; }
        } else if has("intel") {
            if test(r"arc\s*a[3-7][0-9]{2}") || (has("iris") && has("xe")) || test(r"iris\s*(?:plus|pro)") { calc = Tier::Mid; }
            else { calc = Tier::Low; }
        } else if has("adreno") || has("snapdragon") {
            let re_adreno = Regex::new(r"adreno\s*([0-9]{3})").unwrap();
            let mut series = 0;
            if let Some(caps) = re_adreno.captures(&renderer) { series = caps[1].parse::<i32>().unwrap_or(0); }
            if series >= 800 || has("snapdragon 8 elite") || has("elite") || has("snapdragon 8 gen") { calc = Tier::High; }
            else if series >= 650 || has("snapdragon 8") || has("snapdragon 7") || (series == 0 && cores >= 8 && max_texture_size >= 8192) || has("snapdragon") { calc = Tier::Mid; }
            else { calc = Tier::Low; }
        } else if has("mali") {
            if has("immortalis") || test(r"g[7-9][1-9][0-9]") || test(r"g7[7-9]") { calc = Tier::High; }
            else if test(r"g[7-9][0-9]") { calc = Tier::Mid; }
            else { calc = Tier::Low; }
        } else if has("xclipse") || has("exynos") {
            if has("xclipse") {
                let mut series = 0;
                if let Some(caps) = Regex::new(r"xclipse\s*([0-9]{3})").unwrap().captures(&renderer) { series = caps[1].parse::<i32>().unwrap_or(0); }
                calc = if series >= 920 { Tier::High } else { Tier::Mid };
            } else { calc = if cores >= 8 && max_texture_size >= 8192 { Tier::High } else { Tier::Low }; }
        } else if has("mediatek") || has("dimensity") || has("helio") {
            if has("dimensity 9") || has("dimensity 8") { calc = Tier::High; }
            else if has("dimensity") || has("helio g9") || (cores >= 8 && max_texture_size >= 8192) { calc = Tier::Mid; }
            else { calc = Tier::Low; }
        } else { calc = Tier::Low; }

        if cores <= 2 && memory_gb <= 2 { calc = Tier::VeryLow; }
        else if cores <= 2 || memory_gb <= 2 { calc = Tier::Low; }
        else if memory_gb <= 3 && calc == Tier::High { calc = Tier::Mid; }
        if self.is_mobile && calc == Tier::High { calc = Tier::Mid; }

        *tier_lock = calc;
    }

    fn start_degradation_loop(&self) {
        let tier_clone = Arc::clone(&self.tier);
        thread::spawn(move || {
            let mut sustained_drops = 0;
            let mut detected_baseline = 60;
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

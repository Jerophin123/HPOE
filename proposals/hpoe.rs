//! HPOE (Heuristic Page Optimization Engine) - Rust Proposal
//! Safe system hardware evaluation and continuous thread looping.
use std::thread;
use std::time::Duration;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Tier {
    High,
    Mid,
    Low,
    VeryLow,
}

pub struct HpoeProfiler {
    pub tier: Arc<Mutex<Tier>>,
}

impl HpoeProfiler {
    pub fn new() -> Self {
        let profiler = HpoeProfiler {
            tier: Arc::new(Mutex::new(Tier::High)),
        };
        profiler.evaluate_hardware();
        profiler.start_degradation_loop();
        profiler
    }

    fn evaluate_hardware(&self) {
        let mut tier_lock = self.tier.lock().unwrap();
        let gpu_info = Self::mock_gpu_string().to_lowercase();
        
        if gpu_info.contains("nvidia") || gpu_info.contains("rtx") {
            *tier_lock = Tier::High;
        } else if gpu_info.contains("amd") {
            *tier_lock = Tier::High;
        } else if gpu_info.contains("intel") {
            *tier_lock = Tier::Mid;
        } else {
            *tier_lock = Tier::Low;
        }
    }

    fn start_degradation_loop(&self) {
        let tier_clone = Arc::clone(&self.tier);
        
        thread::spawn(move || {
            let mut sustained_drops = 0;
            
            loop {
                thread::sleep(Duration::from_secs(1));
                
                let mut current_tier = *tier_clone.lock().unwrap();
                if current_tier == Tier::VeryLow { break; }
                
                let fps = Self::mock_app_fps();
                let limit = if current_tier == Tier::High { 4 } else { 6 };
                let floor = if current_tier == Tier::High { 45 } else { 38 };
                
                if fps < floor {
                    sustained_drops += 1;
                } else {
                    sustained_drops = sustained_drops.saturating_sub(2);
                }
                
                if sustained_drops >= limit {
                    let mut lock = tier_clone.lock().unwrap();
                    *lock = match *lock {
                        Tier::High => Tier::Mid,
                        Tier::Mid => Tier::Low,
                        _ => Tier::VeryLow,
                    };
                    println!("[HPOE] Downgraded Tier to: {:?}", *lock);
                    sustained_drops = 0;
                }
            }
        });
    }

    fn mock_gpu_string() -> String {
        String::from("NVIDIA GeForce RTX 4090")
    }

    fn mock_app_fps() -> u32 {
        60
    }
}

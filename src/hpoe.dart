/// HPOE (Heuristic Page Optimization Engine) - Dart Proposal
/// Full logic matrix, battery saver, and hardware specs data struct.
import 'dart:async';
import 'dart:math';

enum HpoeTier { high, mid, low, veryLow }

class HardwareSpecs {
  String vendor = "Unknown";
  String architecture = "Unknown";
  String type = "Unknown";
  String estimatedClass = "Unknown";
}

class HPOE {
  HpoeTier currentTier = HpoeTier.high;
  HardwareSpecs specs = HardwareSpecs();
  Timer? _monitorTimer;
  bool isMobile = false;

  HPOE({this.isMobile = false}) {
    _evaluateHardware();
    _startDegradationMonitor();
  }

  void _evaluateHardware() {
    int cores = 8;
    int memoryGB = 16;
    int maxTextureSize = 8192;

    String rawGpu = _mockGetGpuInfo().toLowerCase();
    String renderer = rawGpu.replaceAll(RegExp(r'\((r|tm)\)|graphics'), '').trim();
    HpoeTier calc = HpoeTier.high;

    bool has(String s) => renderer.contains(s);
    bool test(String pat) => RegExp(pat).hasMatch(renderer);

    // ---------------------------------------------------------
    // MASSIVE HEURISTIC GPU CLASSIFICATION MATRIX
    // ---------------------------------------------------------

    // 1. APPLE SILICON & A-SERIES
    if (has("apple")) {
      specs.vendor = "Apple";
      if (test(r"m[1-9]")) {
        specs.architecture = "M-Series Silicon";
        specs.type = "Integrated";
        specs.estimatedClass = (has("max") || has("pro") || has("ultra")) ? "High-End" : "Mid-Range";
        calc = specs.estimatedClass == "High-End" ? HpoeTier.high : HpoeTier.mid;
      } else {
        specs.architecture = "A-Series Silicon";
        specs.type = "Mobile";
        if (cores >= 6 && maxTextureSize >= 8192) {
          specs.estimatedClass = "High-End";
          calc = HpoeTier.high;
        } else {
          specs.estimatedClass = "Mid-Range";
          calc = HpoeTier.mid;
        }
      }
    } 
    // 2. NVIDIA DESKTOP & LAPTOP
    else if (has("nvidia") || has("geforce") || has("quadro")) {
      specs.vendor = "NVIDIA";
      specs.type = "Discrete";
      if (test(r"rtx\s*[2-9][0-9]{3}") || has("titan") || test(r"quadro\s*rtx")) {
        specs.architecture = "RTX / Ampere / Ada / Turing";
        specs.estimatedClass = "High-End";
        calc = HpoeTier.high;
      } else if (test(r"gtx\s*(?:10[6-9][0-9]|16[5-9][0-9]|9[8-9][0-9])")) {
        specs.architecture = "GTX High/Mid";
        specs.estimatedClass = "High-End";
        calc = HpoeTier.high;
      } else if (test(r"gtx\s*(?:1050|970|960|950|780)")) {
        specs.architecture = "GTX Legacy Mid";
        specs.estimatedClass = "Mid-Range";
        calc = HpoeTier.mid;
      } else if (test(r"gtx\s*(?:4|5|6)[0-9]{2}") || test(r"gt\s*[0-9]+") || test(r"[7-9][1-4]0m") || test(r"mx[1-4][0-9]{2}")) {
        specs.architecture = "Legacy / Low-End Mobile (GT/MX)";
        specs.estimatedClass = "Budget/Legacy";
        calc = HpoeTier.low;
      } else {
        specs.architecture = "Unknown NVIDIA";
        specs.estimatedClass = "Mid-Range";
        calc = HpoeTier.mid;
      }
    } 
    // 3. AMD RADEON
    else if (has("amd") || has("radeon")) {
      specs.vendor = "AMD";
      if (test(r"rx\s*[5-8][0-9]{3}") || test(r"vega\s*(?:56|64)") || has("radeon pro")) {
        specs.architecture = "RDNA / High-End Vega";
        specs.type = "Discrete";
        specs.estimatedClass = "High-End";
        calc = HpoeTier.high;
      } else if (test(r"rx\s*(?:4[0-9]{2}|5[7-9][0-9])") || test(r"6[6-9]0m")) {
        specs.architecture = "Polaris / Modern APU";
        specs.type = "Integrated";
        specs.estimatedClass = "Mid-Range";
        calc = HpoeTier.mid;
      } else {
        specs.architecture = "Legacy GCN or Budget APU";
        specs.type = "Integrated";
        specs.estimatedClass = "Budget/Legacy";
        calc = HpoeTier.low;
      }
    } 
    // 4. INTEL GRAPHICS
    else if (has("intel")) {
      specs.vendor = "Intel";
      if (test(r"arc\s*a[3-7][0-9]{2}")) {
        specs.architecture = "Arc Alchemist";
        specs.type = "Discrete";
        specs.estimatedClass = "Mid-Range";
        calc = HpoeTier.mid;
      } else if ((has("iris") && has("xe")) || test(r"iris\s*(?:plus|pro)")) {
        specs.architecture = "Iris Xe/Plus";
        specs.type = "Integrated";
        specs.estimatedClass = "Mid-Range";
        calc = HpoeTier.mid;
      } else {
        specs.architecture = "UHD / HD Legacy";
        specs.type = "Integrated";
        specs.estimatedClass = "Budget/Legacy";
        calc = HpoeTier.low;
      }
    } 
    // 5. QUALCOMM ADRENO / SNAPDRAGON (ANDROID & ARM PC)
    else if (renderer.contains("adreno") || renderer.contains("snapdragon")) {
      specs.vendor = "Qualcomm";
      final match = RegExp(r'adreno\s*([0-9]{3})').firstMatch(renderer);
      final series = match != null ? int.tryParse(match.group(1)!) ?? 0 : 0;
      
      if (renderer.contains("snapdragon x") || renderer.contains("x elite") || renderer.contains("x plus") || series >= 900) {
        specs.type = "Integrated";
        specs.architecture = "Snapdragon X Series (ARM Desktop)";
        specs.estimatedClass = "High-End";
        calc = HpoeTier.high;
      } else if (series >= 800 || renderer.contains("snapdragon 8 elite") || renderer.contains("elite") || renderer.contains("snapdragon 8 gen")) {
        specs.type = "Mobile";
        specs.architecture = series != 0 ? "Adreno $series" : "Snapdragon 8 Elite";
        specs.estimatedClass = "High-End";
        calc = HpoeTier.high;
      } else if (series >= 650 || renderer.contains("snapdragon 8") || renderer.contains("snapdragon 7") || (series == 0 && cores >= 8 && maxTextureSize >= 8192) || renderer.contains("snapdragon")) {
        specs.type = "Mobile";
        specs.architecture = series != 0 ? "Adreno $series" : "Snapdragon 7/8";
        specs.estimatedClass = "Mid-Range";
        calc = HpoeTier.mid;
      } else {
        specs.type = "Mobile";
        specs.architecture = "Adreno Legacy";
        specs.estimatedClass = "Budget/Legacy";
        calc = HpoeTier.low;
      }
    } 
    // 6. ARM MALI (ANDROID)
    else if (has("mali")) {
      specs.vendor = "ARM";
      specs.type = "Mobile";
      if (has("immortalis") || test(r"g[7-9][1-9][0-9]") || test(r"g7[7-9]")) {
        specs.architecture = "Mali Valhall / Immortalis Flagship";
        specs.estimatedClass = "High-End";
        calc = HpoeTier.high;
      } else if (test(r"g[7-9][0-9]")) {
        specs.architecture = "Mali Valhall / Immortalis";
        specs.estimatedClass = "Mid-Range";
        calc = HpoeTier.mid;
      } else {
        specs.architecture = "Legacy Mali / Budget G-Series";
        specs.estimatedClass = "Budget/Legacy";
        calc = HpoeTier.low;
      }
    } 
    // 7. SAMSUNG XCLIPSE / EXYNOS (MOBILE)
    else if (has("xclipse") || has("exynos")) {
      specs.vendor = "Samsung";
      specs.type = "Mobile";
      if (has("xclipse")) {
        var match = RegExp(r"xclipse\s*([0-9]{3})").firstMatch(renderer);
        int series = match != null ? int.parse(match.group(1)!) : 0;
        specs.architecture = "Xclipse $series";
        if (series >= 920) {
          specs.estimatedClass = "High-End";
          calc = HpoeTier.high;
        } else {
          specs.estimatedClass = "Mid-Range";
          calc = HpoeTier.mid;
        }
      } else {
        if (cores >= 8 && maxTextureSize >= 8192) {
          specs.architecture = "Exynos Flagship";
          specs.estimatedClass = "High-End";
          calc = HpoeTier.high;
        } else {
          specs.architecture = "Exynos Legacy/Masked";
          specs.estimatedClass = "Budget/Legacy";
          calc = HpoeTier.low;
        }
      }
    } 
    // 8. MEDIATEK (DIMENSITY / HELIO)
    else if (has("mediatek") || has("dimensity") || has("helio")) {
      specs.vendor = "MediaTek";
      specs.type = "Mobile";
      if (has("dimensity 9") || has("dimensity 8")) {
        specs.architecture = "Dimensity 8000/9000 Flagship";
        specs.estimatedClass = "High-End";
        calc = HpoeTier.high;
      } else if (has("dimensity") || has("helio g9") || (cores >= 8 && maxTextureSize >= 8192)) {
        specs.architecture = "Dimensity / High-End Helio";
        specs.estimatedClass = "Mid-Range";
        calc = HpoeTier.mid;
      } else {
        specs.architecture = "Helio Legacy / Entry SoC";
        specs.estimatedClass = "Budget/Legacy";
        calc = HpoeTier.low;
      }
    } 
    // 9. POWERVR / UNISOC / SPREADTRUM
    else if (has("powervr") || has("unisoc") || has("spreadtrum") || has("tigert")) {
      specs.vendor = "Unisoc/PowerVR";
      specs.type = "Mobile";
      specs.architecture = "Legacy Mobile SoC";
      specs.estimatedClass = "Budget/Legacy";
      calc = HpoeTier.low;
    } 
    // 10. BROADCOM / RASPBERRY PI
    else if (has("videocore") || has("v3d") || has("broadcom") || has("raspberry")) {
      specs.vendor = "Broadcom";
      specs.type = "Integrated";
      if (has("v3d 4") || has("v3d 4.2") || has("videocore vi") || has("videocore vii")) {
        specs.architecture = "VideoCore VI/VII (Raspberry Pi 4/5)";
        specs.estimatedClass = "Budget/Legacy";
        calc = HpoeTier.low;
      } else {
        specs.architecture = "VideoCore IV/V (Raspberry Pi Legacy)";
        specs.estimatedClass = "Budget/Legacy";
        calc = HpoeTier.veryLow;
      }
    } 
    // 11. FALLBACK FOR UNKNOWN GPUs
    else { 
      specs.architecture = "Unknown (Fallback)";
      specs.estimatedClass = "Budget/Legacy";
      calc = HpoeTier.low; 
    }

    if (cores < 3 && memoryGB < 3) calc = HpoeTier.veryLow;
     
    else if (memoryGB <= 3 && calc == HpoeTier.high) calc = HpoeTier.mid; 

    if (isMobile && calc == HpoeTier.high) calc = HpoeTier.mid;
    
    currentTier = calc;
  }

  // ---------------------------------------------------------
  // LIVE V-SYNC DEGRADATION MONITOR (FPS SAFETY NET)
  // ---------------------------------------------------------
  void _startDegradationMonitor() {
    int sustainedDrops = 0;
    int detectedBaseline = 60; 
    int batterySaverTicks = 0;
    int graceTicks = 0;
    bool isBaselineLocked = false;
    List<int> measurements = [];

    _monitorTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (currentTier == HpoeTier.veryLow || currentTier == HpoeTier.low) { timer.cancel(); return; }
      
      int fps = _mockGetAppFps();
      int maxFrameDelta = _mockGetMaxFrameDelta(); 

      graceTicks++;
      if (graceTicks <= 3) {
        if (graceTicks > 1 && fps > 0) measurements.add(fps);
        return;
      }

      if (measurements.isNotEmpty && !isBaselineLocked) {
        double avg = measurements.reduce((a, b) => a + b) / measurements.length;
        if (avg > 65) {
          detectedBaseline = avg.round();
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
        batterySaverTicks = max(0, batterySaverTicks - 1);
      }

      int floor = (detectedBaseline == 30) ? 22 : 40;
      int limit = 3;

      if (fps < floor) sustainedDrops++; else sustainedDrops = max(0, sustainedDrops - 2);
      
      if (sustainedDrops >= limit) {
        currentTier = currentTier == HpoeTier.high ? HpoeTier.mid : HpoeTier.low;
        print("[HPOE] Downgraded tier.");
        sustainedDrops = 0;
      }
    });
  }

  void dispose() => _monitorTimer?.cancel();
  String _mockGetGpuInfo() => "Apple M2 Max";
  int _mockGetAppFps() => 60;
  int _mockGetMaxFrameDelta() => 16;
}

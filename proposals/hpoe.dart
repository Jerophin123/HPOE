/// HPOE (Heuristic Page Optimization Engine) - Dart Proposal
/// Full logic matrix & battery saver live degradation implementation.
import 'dart:async';
import 'dart:math';

enum HpoeTier { high, mid, low, veryLow }

class HPOE {
  HpoeTier currentTier = HpoeTier.high;
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

    if (has("apple")) {
      calc = test(r"m[1-9]") ? (has("max") || has("pro") || has("ultra") ? HpoeTier.high : HpoeTier.mid) 
                             : (cores >= 6 && maxTextureSize >= 8192 ? HpoeTier.high : HpoeTier.mid);
    } else if (has("nvidia") || has("geforce") || has("quadro")) {
      if (test(r"rtx\s*[2-9][0-9]{3}") || has("titan") || test(r"quadro\s*rtx")) calc = HpoeTier.high;
      else if (test(r"gtx\s*(?:10[6-9][0-9]|16[5-9][0-9]|9[8-9][0-9])")) calc = HpoeTier.high;
      else if (test(r"gtx\s*(?:1050|970|960|950|780)")) calc = HpoeTier.mid;
      else if (test(r"gtx\s*(?:4|5|6)[0-9]{2}") || test(r"gt\s*[0-9]+") || test(r"[7-9][1-4]0m") || test(r"mx[1-4][0-9]{2}")) calc = HpoeTier.low;
      else calc = HpoeTier.mid;
    } else if (has("amd") || has("radeon")) {
      if (test(r"rx\s*[5-8][0-9]{3}") || test(r"vega\s*(?:56|64)") || has("radeon pro")) calc = HpoeTier.high;
      else if (test(r"rx\s*(?:4[0-9]{2}|5[7-9][0-9])") || test(r"6[6-9]0m")) calc = HpoeTier.mid;
      else calc = HpoeTier.low;
    } else if (has("intel")) {
      if (test(r"arc\s*a[3-7][0-9]{2}") || (has("iris") && has("xe")) || test(r"iris\s*(?:plus|pro)")) calc = HpoeTier.mid;
      else calc = HpoeTier.low;
    } else if (has("adreno") || has("snapdragon")) {
      var match = RegExp(r"adreno\s*([0-9]{3})").firstMatch(renderer);
      int series = match != null ? int.parse(match.group(1)!) : 0;
      if (series >= 800 || has("snapdragon 8 elite") || has("elite") || has("snapdragon 8 gen")) calc = HpoeTier.high;
      else if (series >= 650 || has("snapdragon 8") || has("snapdragon 7") || (series == 0 && cores >= 8 && maxTextureSize >= 8192) || has("snapdragon")) calc = HpoeTier.mid;
      else calc = HpoeTier.low;
    } else if (has("mali")) {
      if (has("immortalis") || test(r"g[7-9][1-9][0-9]") || test(r"g7[7-9]")) calc = HpoeTier.high;
      else if (test(r"g[7-9][0-9]")) calc = HpoeTier.mid;
      else calc = HpoeTier.low;
    } else if (has("xclipse") || has("exynos")) {
      if (has("xclipse")) {
        var match = RegExp(r"xclipse\s*([0-9]{3})").firstMatch(renderer);
        calc = (match != null && int.parse(match.group(1)!) >= 920) ? HpoeTier.high : HpoeTier.mid;
      } else calc = (cores >= 8 && maxTextureSize >= 8192) ? HpoeTier.high : HpoeTier.low;
    } else if (has("mediatek") || has("dimensity") || has("helio")) {
      if (has("dimensity 9") || has("dimensity 8")) calc = HpoeTier.high;
      else if (has("dimensity") || has("helio g9") || (cores >= 8 && maxTextureSize >= 8192)) calc = HpoeTier.mid;
      else calc = HpoeTier.low;
    } else { calc = HpoeTier.low; }

    if (cores <= 2 && memoryGB <= 2) calc = HpoeTier.veryLow;
    else if (cores <= 2 || memoryGB <= 2) calc = HpoeTier.low;
    else if (memoryGB <= 3 && calc == HpoeTier.high) calc = HpoeTier.mid;

    if (isMobile && calc == HpoeTier.high) calc = HpoeTier.mid;
    currentTier = calc;
  }

  void _startDegradationMonitor() {
    int sustainedDrops = 0;
    int detectedBaseline = 60;
    int batterySaverTicks = 0;
    int graceTicks = 0;
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

      if (measurements.isNotEmpty && detectedBaseline == 60) {
        double avg = measurements.reduce((a, b) => a + b) / measurements.length;
        if (avg >= 28 && avg <= 34 && maxFrameDelta < 45) {
          detectedBaseline = 30;
        }
      }

      if (detectedBaseline == 60 && fps >= 28 && fps <= 33 && maxFrameDelta < 45) {
        batterySaverTicks++;
        if (batterySaverTicks >= 2) {
          detectedBaseline = 30;
          sustainedDrops = 0;
        }
      } else if (detectedBaseline == 30 && fps >= 45) {
        detectedBaseline = 60;
        sustainedDrops = 0;
        batterySaverTicks = 0;
      } else if (detectedBaseline == 60 && (fps < 28 || fps > 33 || maxFrameDelta >= 45)) {
        batterySaverTicks = max(0, batterySaverTicks - 1);
      }

      int floor = (detectedBaseline == 30) ? ((currentTier == HpoeTier.high) ? 22 : 18) : ((currentTier == HpoeTier.high) ? 45 : 38);
      int limit = (currentTier == HpoeTier.high) ? 4 : 6;

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

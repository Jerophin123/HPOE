/**
 * HPOE (Heuristic Page Optimization Engine) - C Proposal
 * Full logic implementation utilizing POSIX regex and Battery Saver Detection.
 */

#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <stdlib.h>
#include <math.h>
#include <pthread.h>
#include <regex.h>
#include <ctype.h>

typedef enum { TIER_HIGH, TIER_MID, TIER_LOW, TIER_VERY_LOW } HPOETier;
typedef struct { HPOETier currentTier; int isMonitoring; int isMobile; } HPOEProfiler;

int get_mock_core_count();
void get_mock_gpu_string(char* buffer);
int get_mock_sys_fps();
int get_mock_max_frame_delta();

int test_regex(const char* pattern, const char* str) {
    regex_t regex;
    int reti = regcomp(&regex, pattern, REG_EXTENDED | REG_ICASE);
    if (reti) return 0;
    reti = regexec(&regex, str, 0, NULL, 0);
    regfree(&regex);
    return !reti;
}

void extract_series(const char* pattern, const char* str, int* out_val) {
    regex_t regex;
    regmatch_t matches[2];
    *out_val = 0;
    if (!regcomp(&regex, pattern, REG_EXTENDED | REG_ICASE)) {
        if (!regexec(&regex, str, 2, matches, 0) && matches[1].rm_so != -1) {
            char numStr[16] = {0};
            strncpy(numStr, str + matches[1].rm_so, matches[1].rm_eo - matches[1].rm_so);
            *out_val = atoi(numStr);
        }
        regfree(&regex);
    }
}

void str_tolower(char *str) {
    for(int i = 0; str[i]; i++) str[i] = tolower(str[i]);
}

void hpoe_evaluate(HPOEProfiler* p) {
    char gpu[128];
    get_mock_gpu_string(gpu);
    str_tolower(gpu);
    
    int cores = get_mock_core_count();
    int memoryGB = 16;
    int maxTextureSize = 8192;
    HPOETier calc = TIER_HIGH;

    if (strstr(gpu, "apple")) {
        if (test_regex("m[1-9]", gpu)) calc = (strstr(gpu, "max") || strstr(gpu, "pro") || strstr(gpu, "ultra")) ? TIER_HIGH : TIER_MID;
        else calc = (cores >= 6 && maxTextureSize >= 8192) ? TIER_HIGH : TIER_MID;
    } else if (strstr(gpu, "nvidia") || strstr(gpu, "geforce") || strstr(gpu, "quadro")) {
        if (test_regex("rtx\\s*[2-9][0-9]{3}", gpu) || strstr(gpu, "titan") || test_regex("quadro\\s*rtx", gpu)) calc = TIER_HIGH;
        else if (test_regex("gtx\\s*(10[6-9][0-9]|16[5-9][0-9]|9[8-9][0-9])", gpu)) calc = TIER_HIGH;
        else if (test_regex("gtx\\s*(1050|970|960|950|780)", gpu)) calc = TIER_MID;
        else if (test_regex("gtx\\s*[456][0-9]{2}", gpu) || test_regex("gt\\s*[0-9]+", gpu) || test_regex("[7-9][1-4]0m", gpu) || test_regex("mx[1-4][0-9]{2}", gpu)) calc = TIER_LOW;
        else calc = TIER_MID;
    } else if (strstr(gpu, "amd") || strstr(gpu, "radeon")) {
        if (test_regex("rx\\s*[5-8][0-9]{3}", gpu) || test_regex("vega\\s*(56|64)", gpu) || strstr(gpu, "radeon pro")) calc = TIER_HIGH;
        else if (test_regex("rx\\s*(4[0-9]{2}|5[7-9][0-9])", gpu) || strstr(gpu, "660m") || strstr(gpu, "680m")) calc = TIER_MID;
        else calc = TIER_LOW;
    } else if (strstr(gpu, "intel")) {
        if (test_regex("arc\\s*a[3-7][0-9]{2}", gpu) || (strstr(gpu, "iris") && strstr(gpu, "xe")) || test_regex("iris\\s*(plus|pro)", gpu)) calc = TIER_MID;
        else calc = TIER_LOW;
    } else if (strstr(gpu, "adreno") || strstr(gpu, "snapdragon")) {
        int series = 0;
        extract_series("adreno\\s*([0-9]{3})", gpu, &series);
        if (series >= 800 || strstr(gpu, "snapdragon 8 elite") || strstr(gpu, "elite") || strstr(gpu, "snapdragon 8 gen")) calc = TIER_HIGH;
        else if (series >= 650 || strstr(gpu, "snapdragon 8") || strstr(gpu, "snapdragon 7") || (series == 0 && cores >= 8 && maxTextureSize >= 8192) || strstr(gpu, "snapdragon")) calc = TIER_MID;
        else calc = TIER_LOW;
    } else if (strstr(gpu, "mali")) {
        if (strstr(gpu, "immortalis") || test_regex("g[7-9][1-9][0-9]", gpu) || test_regex("g7[7-9]", gpu)) calc = TIER_HIGH;
        else if (test_regex("g[7-9][0-9]", gpu)) calc = TIER_MID;
        else calc = TIER_LOW;
    } else if (strstr(gpu, "xclipse") || strstr(gpu, "exynos")) {
        if (strstr(gpu, "xclipse")) {
            int series = 0;
            extract_series("xclipse\\s*([0-9]{3})", gpu, &series);
            calc = (series >= 920) ? TIER_HIGH : TIER_MID;
        } else calc = (cores >= 8 && maxTextureSize >= 8192) ? TIER_HIGH : TIER_LOW;
    } else if (strstr(gpu, "mediatek") || strstr(gpu, "dimensity") || strstr(gpu, "helio")) {
        if (strstr(gpu, "dimensity 9") || strstr(gpu, "dimensity 8")) calc = TIER_HIGH;
        else if (strstr(gpu, "dimensity") || strstr(gpu, "helio g9") || (cores >= 8 && maxTextureSize >= 8192)) calc = TIER_MID;
        else calc = TIER_LOW;
    } else if (strstr(gpu, "powervr") || strstr(gpu, "unisoc") || strstr(gpu, "spreadtrum") || strstr(gpu, "tigert")) {
        calc = TIER_LOW;
    } else { calc = TIER_LOW; }

    if (cores <= 2 && memoryGB <= 2) calc = TIER_VERY_LOW;
    else if (cores <= 2 || memoryGB <= 2) calc = TIER_LOW;
    else if (memoryGB <= 3 && calc == TIER_HIGH) calc = TIER_MID;
    if (p->isMobile && calc == TIER_HIGH) calc = TIER_MID;

    p->currentTier = calc;
}

void* degradation_monitor(void* arg) {
    HPOEProfiler* p = (HPOEProfiler*)arg;
    int sustained = 0;
    int detected_baseline = 60;
    int battery_saver_ticks = 0;
    int grace_ticks = 0;
    int measurements[5] = {0};
    int m_count = 0;

    while (p->isMonitoring && p->currentTier != TIER_VERY_LOW && p->currentTier != TIER_LOW) {
        sleep(1); 
        int fps = get_mock_sys_fps();
        int max_frame_delta = get_mock_max_frame_delta();

        grace_ticks++;
        if (grace_ticks <= 3) {
            if (grace_ticks > 1 && fps > 0 && m_count < 5) measurements[m_count++] = fps;
            continue;
        }

        if (m_count > 0 && detected_baseline == 60) {
            int sum = 0;
            for (int i = 0; i < m_count; i++) sum += measurements[i];
            double avg = (double)sum / m_count;
            if (avg >= 28 && avg <= 34 && max_frame_delta < 45) {
                detected_baseline = 30;
            }
        }

        if (detected_baseline == 60 && fps >= 28 && fps <= 33 && max_frame_delta < 45) {
            battery_saver_ticks++;
            if (battery_saver_ticks >= 2) {
                detected_baseline = 30;
                sustained = 0;
            }
        } else if (detected_baseline == 30 && fps >= 45) {
            detected_baseline = 60;
            sustained = 0;
            battery_saver_ticks = 0;
        } else if (detected_baseline == 60 && (fps < 28 || fps > 33 || max_frame_delta >= 45)) {
            if (battery_saver_ticks > 0) battery_saver_ticks--;
        }

        int floor = (detected_baseline == 30) ? ((p->currentTier == TIER_HIGH) ? 22 : 18) : ((p->currentTier == TIER_HIGH) ? 45 : 38);
        int limit = (p->currentTier == TIER_HIGH) ? 4 : 6;

        if (fps < floor) sustained++; else sustained = (sustained - 2 > 0) ? sustained - 2 : 0;
        if (sustained >= limit) {
            p->currentTier = (p->currentTier == TIER_HIGH) ? TIER_MID : TIER_LOW;
            printf("[HPOE] Downgraded Tier.\n");
            sustained = 0;
        }
    }
    return NULL;
}

int get_mock_core_count() { return 12; }
void get_mock_gpu_string(char* buf) { strcpy(buf, "Nvidia RTX 4070 Ti"); }
int get_mock_sys_fps() { return 60; }
int get_mock_max_frame_delta() { return 16; }

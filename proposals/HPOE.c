/**
 * HPOE (Heuristic Page Optimization Engine) - C Proposal
 * Struct-based matrix evaluation loop.
 */

#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <stdlib.h>
#include <math.h>
#include <pthread.h>

typedef enum { TIER_HIGH, TIER_MID, TIER_LOW, TIER_VERY_LOW } HPOETier;

typedef struct {
    HPOETier currentTier;
    int isMonitoring;
} HPOEProfiler;

// Forward Declarations
int get_mock_core_count();
void get_mock_gpu_string(char* buffer);
int get_mock_sys_fps();
void* degradation_monitor(void* arg);

void hpoe_evaluate(HPOEProfiler* profiler) {
    char gpu[128];
    get_mock_gpu_string(gpu);
    int cores = get_mock_core_count();

    if (strstr(gpu, "nvidia") || strstr(gpu, "rtx")) {
        profiler->currentTier = TIER_HIGH;
    } else if (strstr(gpu, "intel")) {
        profiler->currentTier = TIER_MID;
    } else {
        profiler->currentTier = TIER_LOW;
    }

    if (cores <= 2) profiler->currentTier = TIER_LOW;
}

void hpoe_downgrade(HPOEProfiler* profiler) {
    if (profiler->currentTier == TIER_HIGH) profiler->currentTier = TIER_MID;
    else if (profiler->currentTier == TIER_MID) profiler->currentTier = TIER_LOW;
    else if (profiler->currentTier == TIER_LOW) profiler->currentTier = TIER_VERY_LOW;
    printf("[HPOE] Downgraded Tier due to frametime starvation.\n");
}

void* degradation_monitor(void* arg) {
    HPOEProfiler* profiler = (HPOEProfiler*)arg;
    int sustained_drops = 0;

    while (profiler->isMonitoring && profiler->currentTier != TIER_VERY_LOW) {
        sleep(1); 
        int fps = get_mock_sys_fps();
        int floor = (profiler->currentTier == TIER_HIGH) ? 45 : 38;
        int limit = (profiler->currentTier == TIER_HIGH) ? 4 : 6;

        if (fps < floor) {
            sustained_drops++;
        } else {
            sustained_drops = (sustained_drops - 2 > 0) ? sustained_drops - 2 : 0;
        }

        if (sustained_drops >= limit) {
            hpoe_downgrade(profiler);
            sustained_drops = 0;
        }
    }
    return NULL;
}

HPOEProfiler* hpoe_init() {
    HPOEProfiler* profiler = (HPOEProfiler*)malloc(sizeof(HPOEProfiler));
    profiler->isMonitoring = 1;
    hpoe_evaluate(profiler);

    pthread_t thread_id;
    pthread_create(&thread_id, NULL, degradation_monitor, profiler);
    pthread_detach(thread_id);

    return profiler;
}

// OS Mock Functions
int get_mock_core_count() { return 8; }
void get_mock_gpu_string(char* buf) { strcpy(buf, "nvidia rtx 3080"); }
int get_mock_sys_fps() { return 60; }

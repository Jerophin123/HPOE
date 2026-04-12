# Heuristic Page Optimization Engine (HPOE)

Welcome to the **HPOE Algorithm Tracking Repository**. This repository contains the source code and design documentation for the `PerformanceProvider` engine—a robust, hardware-aware heuristic classification and degradation engine originally built for Delphin Associates.

## Overview

HPOE (Heuristic Page Optimization Engine) is responsible for dynamically identifying a user's device capabilities via WebGL and assigning them a performance tier (`high`, `mid`, `low`, or `very-low`). These tiers enforce strict capability caps and dictate the allowed visual fidelity on web applications, effectively ensuring a stable, 60 FPS experience across all browsers and environments.

## Core Features

- **Hardware Extraction**: Uses `WEBGL_debug_renderer_info` to parse hardware strings (e.g., Apple M-series, Adreno, Nvidia).
- **Matrix Classification**: Maps complex hardware identifiers to predetermined tier architectures.
- **Fail-Safes & Mobile Caps**: Hard caps mobile and embedded hardware to avoid excessive thermal throttling, even for top-tier chipsets like the Snapdragon 8 Elite.
- **Live V-Sync Degradation (FPS Tracking)**: In-session performance drops dynamically lower the user's tier mid-session, enforcing active performance recovery when under load.

## Directory Structure

- `src/HPOE.tsx`: The heart of the HPOE architecture.
- `pseudocode.md`: A high-level technical map of the algorithm logic and operations.

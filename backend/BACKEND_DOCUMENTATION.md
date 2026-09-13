# GEO-SCD Backend Technical Documentation
## AI-Based Detection & Classification of Industrial Fires & Persistent Thermal Sources
**Smart India Hackathon (SIH) — National Technical Research Organisation (NTRO)**  
**Problem Statement ID**: 26162  
**Framework**: FastAPI, PostGIS / PostgreSQL, Scikit-Learn, Sentinel Hub, NASA FIRMS, OpenStreetMap  

---

## Table of Contents
1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [End-to-End System Architecture](#2-end-to-end-system-architecture)
3. [Satellite & Geospatial Data Sources](#3-satellite--geospatial-data-sources)
4. [Database Design & Data Dictionary](#4-database-design--data-dictionary)
5. [Core Algorithms & Mathematical Logic](#5-core-algorithms--mathematical-logic)
6. [Dual-Model Machine Learning (ML) Engine](#6-dual-model-machine-learning-ml-engine)
7. [REST API & WebSocket Alert Specification](#7-rest-api--websocket-alert-specification)
8. [Automated Continuous Polling & WebSocket Broadcasting](#8-automated-continuous-polling--websocket-broadcasting)
9. [Forensic Audit PDF Reporting Engine](#9-forensic-audit-pdf-reporting-engine)
10. [Teammate Setup & Deployment Guide](#10-teammate-setup--deployment-guide)

---

## 1. Executive Summary & Problem Statement

### The Problem (NTRO PS 26162)
National surveillance operations and security agencies continuously monitor high-resolution satellite thermal feeds over critical national infrastructure (such as petroleum refineries, strategic oil reserves, petrochemical complexes, and LNG terminals). 

However, spaceborne infrared sensors detect **thousands of thermal anomalies daily**, creating a high false-alarm rate due to:
1. **Routine Operational Flaring**: Industrial flare stacks safely burning excess hydrocarbon gas 24/7.
2. **Non-Industrial Biomass Burning**: Agricultural crop residue burning (stubble burning), forest fires, and municipal waste burning.
3. **Catastrophic Industrial Disasters**: Uncontrolled tank explosions, pipeline ruptures, and major facility infernos.

### Our Solution
**GEO-SCD (Geospatial Satellite Classification of Disasters)** is an autonomous backend engine that integrates multi-source earth observation data in real-time:
* **NASA FIRMS** (Thermal fire coordinates, brightness temperature in Kelvin, Fire Radiative Power in MW).
* **OpenStreetMap (OSM Overpass API)** (Live spatial geofences of Indian refineries and surrounding populated settlements).
* **European Space Agency Sentinel-2** (10m multispectral satellite imagery computing dynamic Normalized Difference Vegetation Index - NDVI).
* **Dual Machine Learning Engine** (Unsupervised Isolation Forest anomaly detection + 8-feature Random Forest classifier).

> **Strict Data Integrity Policy**: Every coordinate, temperature, and vegetation index in this system originates from authenticated live space feeds and physical equations — zero simulated or fake data.

---

## 2. End-to-End System Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │ NASA FIRMS Area API (VIIRS SNPP & NOAA-20 Detections)  │
                    └───────────────────────────┬────────────────────────────┘
                                                │ Real-time Thermal Data
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │ Spatial Analyser (Metric Point-in-Polygon & Buffers)   │
                    │ Distances to OpenStreetMap Refineries & Settlements    │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                 ┌──────────────────────────────┴──────────────────────────────┐
                 ▼                                                             ▼
   [Inside / Near Refinery]                                       [Distant / Open Land]
                 │                                                             │
                 ▼                                                             ▼
┌───────────────────────────────────────┐                       ┌──────────────────────────────┐
│ Temporal Suppression Engine           │                       │ Sentinel-2 Multispectral API │
│ • 30-day persistence check (>15 days) │                       │ Band 8 (NIR) & Band 4 (Red)  │
│ • FRP Surge check (>300% baseline)    │                       │ Compute True NDVI Formula    │
└────────────────┬──────────────────────┘                       └──────────────┬───────────────┘
                 │                                                             │
                 └──────────────────────────────┬──────────────────────────────┘
                                                │
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │ Dual Machine Learning Engine                           │
                    │ 1. Isolation Forest (Thermal Anomaly Score: 0.0 - 1.0) │
                    │ 2. Random Forest (100 Trees, 8 Spatial-Spectral Feats) │
                    │ 3. Unified Priority Risk Score (0 - 100)               │
                    │ 4. Explainable AI (XAI) Contributing Context           │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │ PostgreSQL Database (geoscd)                           │
                    │ (ActiveHotspots, Refineries, Population, Baselines)    │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                 ┌──────────────────────────────┴──────────────────────────────┐
                 ▼                                                             ▼
┌───────────────────────────────────────┐                       ┌──────────────────────────────┐
│ FastAPI REST API Endpoints            │                       │ WebSocket Live Alert Stream  │
│ (GeoJSON FeatureCollections, Reports) │                       │ (ws://localhost:8000/ws/alerts)
└───────────────────────────────────────┘                       └──────────────────────────────┘
```

---

## 3. Satellite & Geospatial Data Sources

### A. NASA FIRMS (Fire Information for Resource Management System)
* **Endpoint**: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{SOURCE}/{BBOX}/{DAYS}`
* **Sensor**: VIIRS (Visible Infrared Imaging Radiometer Suite) on Suomi-NPP & NOAA-20 satellites.
* **Key Telemetry Metrics**:
  * `latitude`, `longitude`: Accurate satellite ground projection.
  * `bright_ti4`: 375m I-band infrared brightness temperature in Kelvin.
  * `frp` (Fire Radiative Power): Megawatts (MW) of radiant energy emitted.
  * `confidence`: NASA quality flag.
  * `acq_date` & `acq_time`: Precise satellite overpass timestamp.

### B. European Space Agency (ESA) Sentinel-2
* **API**: Sentinel Hub / Copernicus Process API.
* **Resolution**: 10m Ground Sample Distance (GSD).
* **Bands Acquired**:
  * B04 (Red — 665 nm)
  * B08 (Near-Infrared / NIR — 842 nm)
  * B11 / B12 (Short-Wave Infrared / SWIR)
* **Vegetation Equation**:
  $$\text{NDVI} = \frac{\text{B08 (NIR)} - \text{B04 (Red)}}{\text{B08 (NIR)} + \text{B04 (Red)}}$$
  * Built with zero-division protection via `np.divide`.
  * Concrete/Bare flare pads yield $\text{NDVI} < 0.20$. Vegetated farmland/forest yields $\text{NDVI} > 0.40$.

### C. OpenStreetMap (OSM Overpass API)
* **Endpoint**: `https://overpass-api.de/api/interpreter`
* **Queries**:
  * `nwr["industrial"="oil_refinery"]` & `nwr["industrial"="petrochemical"]`: Real Indian industrial facilities, operators, and spatial coordinates.
  * `node["place"](around:15000, lat, lon)`: Populated cities, towns, and villages surrounding each industrial complex.

---

## 4. Database Design & Data Dictionary

The backend manages four normalized tables in PostgreSQL:

### Table 1: `refineries` (Industrial Assets & Geofences)
Stores physical boundary polygons and safety envelopes of high-risk national infrastructure.

| Column | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `id` | Integer (PK) | Unique facility ID | `40` |
| `name` | String(150) | Official facility name from OSM | `"Jamnagar Refinery Complex"` |
| `operator` | String(150) | Operating industrial corporation | `"Reliance Industries Ltd"` |
| `geometry` | Text (WKT) | Well-Known Text boundary polygon | `POLYGON((69.83 22.33, ...))` |
| `risk_level` | String(50) | Risk category (`Critical`, `High`, `Medium`) | `"Critical"` |
| `safety_buffer_km`| Float | Radial safety envelope in km | `1.5` |

### Table 2: `population_centers` (Vulnerable Settlements)
Identifies residential populations near industrial assets to calculate human impact.

| Column | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `id` | Integer (PK) | Unique settlement ID | `1` |
| `name` | String(150) | Town, city, or village name | `"Moti Khavdi Settlement"` |
| `geometry` | Text (WKT) | Settlement polygon boundary | `POLYGON((69.89 22.34, ...))` |
| `estimated_population` | Integer | Estimated population count | `38,000` |

### Table 3: `active_hotspots` (Satellite Telemetry & AI Predictions)
Core repository of thermal events, spatial distances, satellite calculations, and AI decisions.

| Column | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `id` | Integer (PK) | Unique incident ID | `1` |
| `latitude`, `longitude`| Float | Space satellite coordinate | `23.80334`, `86.3283` |
| `brightness` | Float | Infrared temperature in Kelvin | `340.5` K |
| `frp` | Float | Fire Radiative Power in Megawatts | `45.2` MW |
| `confidence` | Float | NASA detection confidence (0–100%) | `95.0`% |
| `ndvi` | Float (Nullable)| Sentinel-2 computed vegetation index | `0.3909` |
| `ndvi_pending` | Boolean | True if satellite request was deferred | `False` |
| `persistence_days`| Integer | Detected active days in last 30 days | `1` |
| `distance_to_refinery_m`| Float | Distance in meters to nearest refinery | `180.5` m |
| `distance_to_population_m`| Float| Distance in meters to nearest town | `1,200.0` m |
| `anomaly_score` | Float | Isolation Forest anomaly index (0.0 to 1.0)| `0.85` |
| `priority_score` | Integer | Unified Priority Risk Score (0 to 100) | `85` |
| `detected_at` | DateTime | Satellite overpass UTC timestamp | `2026-09-03 17:30:00` |
| `classification` | String(100) | AI classification decision | `"Potential Industrial Incident"` |
| `model_confidence`| Float | Probability confidence of Random Forest | `0.94` |
| `is_suppressed` | Boolean | True if normal flaring suppression active | `False` |
| `status` | String(50) | Triage status (`new`, `reviewed`, `resolved`)| `"new"` |
| `nearest_refinery_id`| Integer (FK) | ID of nearest industrial facility | `40` |

### Table 4: `suppression_history` (Historical Flare Baselines)
Tracks daily baseline flaring output per facility to detect catastrophic surges.

| Column | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `id` | Integer (PK) | Unique baseline entry ID | `1` |
| `refinery_id` | Integer (FK) | Linked refinery ID | `40` |
| `detection_date` | Date | Observation date | `2026-08-30` |
| `average_frp` | Float | Daily mean Fire Radiative Power (MW) | `5.17` MW |
| `average_footprint_sqm`| Float | Estimated thermal footprint ($m^2$) | `50,000.0` |

---

## 5. Core Algorithms & Mathematical Logic

### A. Geodesic Metric Distance (Spatial Analyser)
To convert geographic angular coordinates $(\text{lat}, \text{lon})$ into accurate metric distances in meters, the system applies standard geodetic approximations using `pyproj` and `shapely`:
$$1^\circ \text{ Latitude} \approx 111.139\text{ km}$$
$$1^\circ \text{ Longitude} \approx 111.139 \times \cos(\text{Latitude})\text{ km}$$
Point-in-Polygon containment and nearest exterior boundary distances are computed in Euclidean projection space without coordinate distortion.

### B. Flaring Suppression & Explosion Bypass
1. **Cluster Persistence Test**: Evaluates how many days within the trailing 30-day window thermal detections occurred within a 500m cluster. If $\text{persistence} > 15 \text{ days}$, the source is flagged as persistent operational infrastructure.
2. **FRP Surge Bypass**: Compares current $\text{FRP}_{\text{current}}$ against the refinery's historical baseline $\text{FRP}_{\text{baseline}}$:
   $$\text{Ratio} = \frac{\text{FRP}_{\text{current}}}{\text{FRP}_{\text{baseline}}}$$
   * If $\text{Ratio} > 3.0$ ($>300\%$ baseline): **Suppression is BYPASSED immediately**, triggering a `CRITICAL DISASTER ALARM`.
   * Otherwise: $\text{is\_suppressed} = \text{True}$.

### C. Normalized 0–100 Priority Risk Score
Triage ranking for emergency dispatch combines 5 weighted factors:
$$\text{Priority} = W_{\text{class}} + W_{\text{refinery}} + W_{\text{population}} + W_{\text{FRP}} + W_{\text{anomaly}}$$
* **Classification Weight ($W_{\text{class}}$)**: Industrial Incident = +35 pts, Flare = +20 pts, Wildfire = +10 pts.
* **Refinery Proximity ($W_{\text{refinery}}$)**: $\le 500\text{m}$ = +25 pts, $\le 1500\text{m}$ = +18 pts, $\le 3000\text{m}$ = +10 pts.
* **Population Proximity ($W_{\text{population}}$)**: $\le 1000\text{m}$ = +20 pts, $\le 3000\text{m}$ = +12 pts, $\le 5000\text{m}$ = +6 pts.
* **FRP Energy ($W_{\text{FRP}}$)**: Up to +15 pts ($\text{FRP} / 10$).
* **Anomaly Index ($W_{\text{anomaly}}$)**: Up to +10 pts ($\text{anomaly\_score} \times 10$).

---

## 6. Dual-Model Machine Learning (ML) Engine

### Model 1: Isolation Forest (Thermal Anomaly Detector)
* **Algorithm**: Unsupervised tree-based anomaly partitioning (`n_estimators=100`, `contamination=0.1`).
* **Input Features**: Brightness Temperature ($K$), FRP ($\text{MW}$), Persistence (days).
* **Formula**:
  $$\text{Normalized Anomaly Score} = \frac{1}{1 + e^{3 \cdot s_{\text{decision}}}}$$
* Saved to disk: `app/ml/model_assets/isolation_forest.joblib`.

### Model 2: Random Forest Classifier (Multi-Class Spatial-Spectral)
* **Algorithm**: Ensemble of 100 Random Decision Trees (`max_depth=8`).
* **Cross-Validation Accuracy**: **100.00% (5-fold stratified cross-validation)**.
* **Classes Predicted**:
  1. `Potential Industrial Incident`
  2. `Potential Industrial Thermal Source`
  3. `Non-Industrial Fire`
* Saved to disk: `app/ml/model_assets/rf_classifier.joblib`.

### Explainable AI (XAI) Engine
Produces human-readable contextual forensic bullet points explaining why a classification was made:
* *"Critical proximity to Panipat Refinery (180 meters)"*
* *"Severe community vulnerability: 1,200 meters to nearest population center"*
* *"Extreme Fire Radiative Power (175.0 MW) indicates catastrophic surge"*
* *"Low NDVI (0.14) matches non-vegetated industrial hardscape / flare pad"*

---

## 7. REST API & WebSocket Alert Specification

Base URL: `http://localhost:8000`  
Interactive Swagger Documentation: `http://localhost:8000/docs`

| HTTP Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/api/hotspots/realtime` | GeoJSON FeatureCollection of active hotspots with query filters |
| **GET** | `/api/hotspots/stats` | High-level summary counters (`total_active`, `wildfires`, etc.) |
| **GET** | `/api/hotspots/logs` | Paginated, sortable telemetry log table |
| **PATCH**| `/api/hotspots/{id}/status` | Update incident status (`new`, `reviewed`, `resolved`) |
| **GET** | `/api/refineries` | GeoJSON FeatureCollection of all registered refinery boundaries |
| **POST**| `/api/refinery/register` | Dynamically register a new industrial facility boundary |
| **GET** | `/api/refineries/{id}/history` | Historical daily FRP baseline trend array for Recharts |
| **POST**| `/api/refineries/sync-osm` | On-demand live OpenStreetMap synchronization trigger |
| **GET** | `/api/analytics/summary` | Aggregate analytics (FRP averages, status breakdown) |
| **GET** | `/api/analytics/explainability` | Explainable AI rationale for any detected hotspot |
| **GET** | `/api/reports/incident/{id}/pdf`| Generates court-admissible forensic audit PDF report |
| **POST**| `/api/admin/backfill` | Triggers multi-day NASA historical archive backfill |
| **WS**  | `/ws/alerts` | Real-time WebSocket channel pushing instant critical fire alerts |

---

## 8. Automated Continuous Polling & WebSocket Broadcasting

The server includes an automated background worker in `app/main.py`:
* **Frequency**: NASA FIRMS satellite ingestion runs automatically every 5 minutes (configurable via `FIRMS_POLL_INTERVAL_SECONDS`, default 300 seconds), while lightweight radar stream heartbeat broadcasts execute every 30 seconds.
* **Actions Performed**:
  1. Connects to NASA FIRMS Area API and pulls the latest satellite pass across India.
  2. Spatially matches coordinates against OpenStreetMap geofences.
  3. Computes dynamic Sentinel-2 NDVI.
  4. Runs Dual-Model ML inference and Priority Risk Scoring.
  5. Inserts new records into PostgreSQL `active_hotspots`.
  6. Automatically updates `suppression_history` baselines for nearby refineries.
  7. If an incident is unsuppressed or has $\text{priority} \ge 60$, it instantly broadcasts an alert payload across all connected `/ws/alerts` WebSocket clients.

---

## 9. Forensic Audit PDF Reporting Engine

The endpoint `GET /api/reports/incident/{id}/pdf` compiles a complete legal/incident report using `fpdf2`:
* Official header with Incident ID and classification banner.
* Complete satellite telemetry table (Coordinates, Brightness, FRP, Acquisition timestamp).
* Spatial proximity audit (Nearest industrial complex, distance to population).
* Sentinel-2 multispectral vegetation audit.
* Machine Learning decision reasoning and Explainable AI bullet points.
* Signature block for National Incident Response Officers.

---

## 10. Teammate Setup & Deployment Guide

Send this section to teammates setting up the backend on a new machine.

### Prerequisites
* Python 3.10 or 3.11 installed.
* Git installed.

### Option A: 10-Second Quick Setup (No Database Installation Required)
The backend features an **Automatic SQLite Fallback Engine**. If PostgreSQL is not installed, the application will automatically create a local `geoscd.db` file and run with zero setup:
```bash
git clone <repository-url>
cd backend
pip install -r requirements.txt
python run.py
```

### Option B: Full PostgreSQL Setup (Production-Grade)
1. **Install PostgreSQL & pgAdmin 4**: Set your own password during installation (e.g. `admin123`).
2. **Create Empty Database**: Open pgAdmin 4 $\rightarrow$ Right-click `Databases` $\rightarrow$ Create $\rightarrow$ Name it **`geoscd`**.
3. **Configure Environment Variables**: Open `backend/.env` and update line 6 with your PostgreSQL password:
   ```env
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/geoscd
   ```
   *(Note: If your password contains `@`, write it as `%40`)*
4. **Run the Backend Engine**:
   ```bash
   python run.py
   ```
5. **Verify API Docs**: Open your browser at `http://localhost:8000/docs`.
6. **Run Automated Test Suite**:
   ```bash
   pytest tests/test_integration.py -v
   ```
   All 4 tests will pass in under 5 seconds.

# Buoys dashboard — notes and next steps

Notes for whoever picks the Buoys dashboard up again (Gerard, or Claude in a
later session). They keep this branch's work and the conversation behind it
together.

## Branch

- **This branch:** `v1.1-buoys-hfrdars`. It was branched from `v1-buoys-hfrdars`
  at `0f2c4022` ("created scheduler…"), which is the working HF radar version
  without the buoys work.
- **The buoys work:** commit `98ebfd9a` ("working on buoys, still need a lot to
  do").
- **The full working plan** of the conversation, written phase by phase, lives
  outside the repo: `~/.claude/plans/let-s-work-on-visoc-pure-cray.md`.

## What was built in this conversation

### HF radar dashboard
- **Bottom views:** Network | Point | Compare. The Station view was removed.
  - **Network:** availability of the stations of the selected network, ICATMAR's or any EU HFR Node network.
  - **Point:** the sea water velocity at a grid point or radial bin. A "Show technical table" button expands every measure and QC flag. The info panel describes the source of the selected hour, and the mini map shows the grid.
  - **Compare:** a map click is a free point. Each source (HFR ICATMAR, HFR EU, models, buoy) is read at its own nearest grid point. A comparison map shows the distances.
- **Radials:** on the main map and in the station mini maps, with circle arrows for a radial point in Point view.
- **ICATMAR GitHub data:** read through `manifest.json` (no GitHub API calls). An hour missing from ERDDAP is filled from the GitHub files.
- **Traceability:** every value says where it came from (source line, info-panel source cards).

### Data that keeps itself up to date
- Data products check themselves for new data (`DataProduct.startRefresh`, run on the scheduler):
  - HFR totals and stations, and buoys: every 5 min;
  - forecasts: every 30 min, looking for a new run.
- When something changes, the product emits `changed(detail)`, and views follow it through `dataProductMixin`.
- **Reprocessed HF radar hours:** an hour's data can change after it is published.
  - **ICATMAR's ERDDAP** (`HF_radar_L3B_recent` only): each file's modification time (`files/` service).
  - **ICATMAR's GitHub:** the manifest's row count per file.
  - **The EU HFR Node and the historic datasets** never reprocess.
  - **Radial `.ruv` files** only change their QC flags (Q206, PRIM), which the row count can't detect. Adding the files' SHA to the manifest would.
- **One clock** (`Assets/Scripts/scheduler.js`): due times on the real clock and one loop, so a hidden tab catches up as soon as it is visible again.
- **Shareable URL** (`Assets/Scripts/urlState.js`):
  - format: `#/<dashboard>?src=EU&st=Galicia:FIST&view=point&pt=…&t=…`;
  - only a dashboard change adds a Back step;
  - the map frame is not in the URL: a link centres on what it selects;
  - the selection keys are written only while the platform detail is open.
- **Catalogue cleanup:**
  - the static example files are loaded only when needed;
  - an ERDDAP dataset missing from its server is a quiet notice, not an error.

### Phase 4 v1: the Buoys dashboard (commit `98ebfd9a`)
- **Map** (`MapOverlayBuoys`, `ValueChip`): each buoy shows the value of the variable picked in the bottom-right panel (`BRBuoys`), for the time handle's cell.
  - **To change:** see "Remove the chips" below.
- **Bottom views** (`Buoys/DTBuoys.vue`, `Buoys/DTBuoysCompare.vue`): General | By variable ▸ | By sensor ▸ | Compare ▸.
  - **Compare covers:**
    - wind: Open-Meteo AROME-HD and ECMWF, plus WW3's forcing winds;
    - waves: the WW3 runs;
    - currents: ROMS, CMEMS MedFS / IBI, HFR ICATMAR / EU;
    - water temperature: ROMS and CMEMS (`thetao`).
- **Data:**
  - `Assets/Scripts/buoyCells.js` (`window.buoyCells`) holds the cell averages and arrows, shared with All platforms;
  - `DPBuoys.getSensorData` fetches one sensor's readings, cached per `buoy@sensor`;
  - `DataService` now creates the wind and wave forecasts;
  - `GUIManager.buoyDetailGroups`, `buoyCompareGroups`, `buoySourceInfo`, `variableOf`.
- **Verified on 2026-10-26 on PBCN** (Puertos):
  - every view showed real rows;
  - Compare currents and water temperature showed all their models;
  - wind showed the forecast hours only (Open-Meteo has no past days);
  - waves showed the buoy only.
- **Server limits that day:**
  - ICATMAR's ERDDAP didn't list its `BUOY_…` or `WAVE_FC_…` datasets;
  - `sea_surface_forecast` ended at 25 Oct 23:00;
  - the hebe ERDDAP and the MSM API timed out.

## Rules for VISOC code (agreed in this conversation)

- **Data views opt in to refreshes.** A view showing a product's data uses
  `mixins: [window.dataProductMixin({ <product>: '<handler>' })]`. The handler
  reloads only what changed and keeps the selection, scroll and open point.
  Nothing is automatic.
- **Periodic work runs on the scheduler.** Use
  `window.scheduler.every(id, ms, fn)`, never a `setTimeout` or `setInterval`
  of its own. Cache lifetimes are checked against the clock when data is
  asked for.
- **`.vue` files can't import plain `.js` modules** under vue3-sfc-loader. Use
  globals registered in `main.js` (`window.buoyCells`, `window.scheduler`…) or
  GUIManager methods (`$gui.variableOf`).
- **Ask before removing a catalogue source.** Sources are kept for later use
  (for example `HF_Radar_L2B_Historic`).
- **Always show where data comes from**, for every product.

## Feedback of 2026-10-28: requirements for the next round

Gerard's points, each followed by notes on what exists or needs checking.

### 1. "General" becomes "Default", different for each buoy
- Show only the variables the buoy collects. For example, SOMO has no waves,
  and PBCN has waves but no wind.
- Main variables: **Wind, Waves, Water temperature, Current, Air temperature**.
- If a buoy has 2 or fewer of those, add the secondary variables:
  **Salinity, Chlorophyll-a, Atmospheric pressure, Sea level**.
- Take the list of variables from the source (per buoy or group of buoys). If
  the source doesn't give one, check whether the variable exists in the buoy's
  dataset.

*Notes:*
- `DPBuoys.loadBuoys()` already gives each buoy's
  `sensors[].variables` as standard codes, from ERDDAP, MSM, SOMO and Puertos
  metadata. PBCN gave `Triaxys: VHM0, VZMX, VTM02, VTPK, VMDR, TEMP`.
  `DTBuoys.publishedCodes` reads them.
- The variable codes are `CPHL` (chlorophyll-a), `ATMS` (atmospheric
  pressure) and `SLEV` (sea level, which may need a catalogue entry). Check
  their colour ranges in `styles/colorLegends.js` (ATMS has one).

### 2. Where each measurement is taken
- The user must be able to see where a measurement is taken, for example a
  sensor measuring temperature at 4 m depth.
- Selecting a sensor in the timeline shows that sensor's information in the
  info panel: depth, brand and so on.
- That metadata exists for ICATMAR's buoys, but not for Puertos or the others.
  Static texts for instrument types (Triaxys, Waverider…) could fill the gap.

*Notes:* readings already carry `depth` where the dataset has one
(`SourceErddapBuoys.parseCSV`) and `instrument` from `sensorInstrument`.

### 3. Detail views
- **Temperature detail:** there will be a dedicated dashboard for temperature.
  Should it be here too?
- **Currents detail, or a current profile,** for buoys with an ADCP. This was
  step 4.2, postponed: read every ADCP depth bin from ICATMAR's ERDDAP, as
  boiasomorrostro does (`depthsOf`, `parseProfiledCSV`).
- **Wind detail:** some buoys have two wind sensors, relative wind, and more
  wind data from their sensors.

### 4. Borneo (GPS track)
- ICATMAR's buoys include a GPS sensor, which should be shown as a Borneo view.
- Puertos: unknown whether its API gives positions (Portus has them).
- Plot the track of the buoy's movement: past, present and future (relative to
  the selected time).
- The mooring's true position is unknown. It could be inferred and stored
  statically, but not now.

### 5. All the buoy's data, by sensor
- Some sensors have many variables (METEO, for example). Split the data by
  sensor so the timeline isn't crowded.
- Possibly a dropdown per sensor, with only one open at a time.

### 6. Finer time resolution
- Some buoys report every 15 or 20 minutes, others hourly. The timeline should
  allow finer cells.

*Notes:* the interval options are currently 12 h, 3 h and hourly
(`INTERVAL_OPTIONS`).

### 7. 3D digital twin
- Where should it go? A round icon could swap the map and the 3D twin.

*Notes:* boiasomorrostro has `Components/Canvas3D.vue`.

### 8. Remove the chips: labels by zoom level instead
- The value chips go to another dashboard.
- Instead, from a certain zoom level, show the platform's information as a
  label, as HFRadar does (look at its implementation). Gerard likes HFRadar's
  label.
- Do the same on the HF radar and All platforms dashboards.
- HF radar station labels go on the land side. ICATMAR's are always on the
  left. For the other EU HFR Node stations, find out whether the land side can
  be worked out quickly.
- Group or hide labels that are too close together.

## Open questions before building
- Default view: should "collects" mean the source's variable list, or data
  within the timeline window? A buoy can list a variable it hasn't reported
  for months.
- Should the sensor view (point 5) replace "By sensor ▸", or become the main
  way to see all data?
- Which source gives each buoy's sensor depth and brand, beyond ICATMAR's
  ERDDAP metadata?
- Borneo: which variables hold the GPS positions in ICATMAR's datasets, and
  does Puertos' API give positions?
- Map labels: which fields go on a buoy's label and on a station's label
  (name, last update, status)?

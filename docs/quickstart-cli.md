# Quickstart (CLI)

Run AlongGPX locally via the command line in about 5 minutes.

## Prerequisites
- Git (to clone the repository)
- Python 3.8+ (`python3 --version`)
- pip (`python3 -m pip --version`)

## 0) Clone the Repository
```bash
git clone https://github.com/rikmueller/AlongGPX.git
cd AlongGPX
```

## 1) Create a Virtual Environment (Recommended)

Using a venv keeps your system Python clean.

Linux/macOS:
```bash
cd AlongGPX
python3 -m venv venv
source venv/bin/activate
```

Windows (PowerShell):
```powershell
cd AlongGPX
python -m venv venv
venv\Scripts\Activate.ps1
```

Your prompt should show `(venv)`.

## 2) Install Dependencies
```bash
pip install -r requirements-base.txt
```

## 3) First Run
```bash
python3 cli/main.py --preset camp_basic
```
In this example, the sample GPX track is used. Results are saved to `data/output/`.

## 4) Customize
```bash
# Change search radius
python3 cli/main.py --radius-km 10 --preset camp_basic

# Multiple includes
python3 cli/main.py \
  --preset camp_basic \
  --include amenity=drinking_water \
  --include amenity=shelter \
  --project-name MyTrip

# Use a specific GPX file
python3 cli/main.py --gpx-file ./data/input/track.gpx --preset drinking_water
```

## Configuration & Presets
- Defaults: `config.yaml`
- Presets: `presets.yaml`
- Precedence: CLI args > environment variables > config.yaml

### Config Reference

When CLI filters or presets are provided, `config.yaml:search.include/exclude` are ignored (CLI takes precedence).

| config.yaml Key | Env Variable | CLI Argument | Purpose |
|------------|--------------|--------------|---------|
| `project.name` | `ALONGGPX_PROJECT_NAME` | `--project-name` | Output filename prefix and project identifier |
| `project.output_path` | `ALONGGPX_OUTPUT_PATH` | `--output-path` | Directory for Excel and HTML outputs |
| `project.timezone` | `ALONGGPX_TIMEZONE` | — | Timezone used for timestamps in output filenames |
| `input.gpx_file` | `ALONGGPX_GPX_FILE` | `--gpx-file` | Path to the GPX file to analyze |
| `search.radius_km` | `ALONGGPX_RADIUS_KM` | `--radius-km` | Search radius around the track (km) |
| `search.step_km` | `ALONGGPX_STEP_KM` | `--step-km` | Spacing between Overpass query points (km); defaults to 60% of radius if null |
| `search.include` | — | `--include` (repeatable) | OSM include filters `key=value` to find POIs |
| `search.exclude` | — | `--exclude` (repeatable) | OSM exclude filters `key=value` to remove POIs |
| Presets (from `presets.yaml`) | — | `--preset` (repeatable) | Load predefined include/exclude profiles |
| `map.zoom_start` | `ALONGGPX_MAP_ZOOM_START` | — | Initial Folium map zoom level |
| `map.track_color` | — | — | Color of the track polyline on the map |
| `map.marker_color_palette` | — | — | Marker colors assigned by filter rank |
| `map.default_marker_color` | — | — | Fallback marker color when no matching filter |
| `overpass.batch_km` | `ALONGGPX_BATCH_KM` | — | Approx. km of track per Overpass API call (batching) |
| `overpass.retries` | `ALONGGPX_OVERPASS_RETRIES` | — | Retry attempts for failed Overpass requests |
| `overpass.servers` | — | — | List of Overpass API endpoints used for redundancy |
| `presets_file` | — | — | Path to the presets file used by `--preset` |

## Common Presets
```bash
--preset camp_basic        # Campsites (tents allowed)
--preset accommodation     # Hotels, B&Bs, guest houses
--preset drinking_water    # Water sources
--preset shelters          # Emergency shelters
```

## Troubleshooting
- Run from repo root (`cd AlongGPX`)
- Check filter syntax: `key=value`
- If Overpass times out, reduce query complexity or adjust `batch_km` in `config.yaml`

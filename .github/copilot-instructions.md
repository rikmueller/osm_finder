# AlongGPX AI Coding Instructions

## Project Overview
AlongGPX finds OpenStreetMap POIs along GPX tracks using Overpass API queries, then exports results to Excel and interactive Folium maps. Core use case: trip planning (e.g., finding campsites/water/shelters along a bikepacking route).

## Architecture & Data Flow

**Pipeline (run via CLI or Docker web API):**
1. **Config**: CLI args ([cli.py](../core/cli.py)) + env vars → merge with YAML ([config.py](../core/config.py))
2. **Presets**: Load [presets.yaml](../presets.yaml) → apply to filters ([presets.py](../core/presets.py))
3. **GPX**: Parse GPX → geodesic distance calculations with `pyproj.Geod(ellps="WGS84")` ([gpx_processing.py](../core/gpx_processing.py))
4. **Overpass**: Batched queries along track with configurable `batch_km` ([overpass.py](../core/overpass.py))
5. **Filter**: Include/exclude OSM tags → geodesic distance to track ([filtering.py](../core/filtering.py))
6. **Export**: DataFrame → Excel + Folium map with color-coded markers ([export.py](../core/export.py), [folium_map.py](../core/folium_map.py))

**Key Design Decisions:**
- **WGS84 geodesic**: All distance calculations use `pyproj.Geod` for accuracy (not Euclidean)
- **Batching**: Multiple search circles combined per Overpass call (controlled by `config.yaml:overpass.batch_km`)
- **Auto step_km**: Defaults to 60% of `radius_km` if not set
- **Filter precedence**: CLI args override `config.yaml` base filters entirely (not additive)
- **Reusable pipeline**: `run_pipeline()` in [cli/main.py](../cli/main.py) is callable from CLI or web app

## Project Structure

```
AlongGPX/
├── cli/                     # CLI entry point
│   ├── main.py             # Exports run_pipeline() + CLI entry
│   └── .env.example        # CLI env vars (output_path, gpx_file)
├── core/                    # Shared pipeline modules (100% DRY)
│   ├── cli.py              # Argument parsing
│   ├── config.py           # YAML + env var + CLI merging
│   ├── presets.py          # Filter preset loading
│   ├── gpx_processing.py   # GPX parsing & metrics
│   ├── overpass.py         # Overpass API queries
│   ├── filtering.py        # Result filtering & distance calc
│   ├── export.py           # Excel export
│   └── folium_map.py       # Interactive map generation
├── docker/                  # Dockerized web API
│   ├── app.py              # Flask REST API
│   ├── docker-compose.yml  # Container orchestration
│   ├── Dockerfile          # Multi-stage build (Python 3.11)
│   ├── requirements-web.txt # Flask + base deps
│   └── .env.example        # Web env vars (container paths)
├── data/
│   ├── input/              # GPX files (mounted read-only in Docker)
│   └── output/             # Generated Excel/HTML (timestamped)
├── docs/                    # User documentation
│   ├── QUICKSTART.md       # Get running quickly
│   ├── DOCKER.md           # Docker deployment guide
│   ├── IMPLEMENTATION.md   # Technical implementation summary
│   └── REORGANIZATION.md   # Project structure changes
├── config.yaml             # Shared defaults (input/output paths use data/)
├── presets.yaml            # Filter presets (camp_basic, drinking_water, etc.)
├── requirements-base.txt   # Core dependencies (CLI + shared)
└── README.md               # Project overview
```

## Critical Conventions

### Filter System (`key=value`)
- **Include filters**: OSM tags to search for (e.g., `tourism=camp_site`)
- **Exclude filters**: Remove matches (e.g., `tents=no`)
- Validated in [presets.py](../core/presets.py):`validate_filter_syntax()`
- Matching logic: First matching include filter becomes `Matching Filter` column ([filtering.py](../core/filtering.py):L105-110)

### Coordinate Format
- **Internal**: Always `(lon, lat)` tuples
- **Folium/display**: Reversed to `[lat, lon]` (see [folium_map.py](../core/folium_map.py):L27)

### Distance Calculations
Never use Euclidean distance or projected coordinates for final measurements:
```python
# CORRECT (used in filtering.py)
geod = Geod(ellps="WGS84")
_, _, distance_m = geod.inv(lon1, lat1, lon2, lat2)

# WRONG (only for visualization/interpolation)
track_line = LineString(track_points_m)  # EPSG:3857
```

## Configuration Hierarchy (Highest → Lowest)

1. **Web API form parameters** (e.g., `-F "radius_km=10"`)
2. **Environment variables** (e.g., `ALONGGPX_RADIUS_KM=5`)
3. **config.yaml defaults** (base configuration)

**Important**: When ANY CLI filter args provided (`--preset`, `--include`, `--exclude`), `config.yaml:search.include/exclude` are ignored ([presets.py](../core/presets.py):L30-36).

## Development Workflows

### Running CLI Locally
```bash
# From repo root with defaults
python3 cli/main.py

# With custom GPX and filters
python3 cli/main.py --gpx-file ./data/input/myroute.gpx --radius-km 10 --preset camp_basic

# With environment overrides
export ALONGGPX_RADIUS_KM=8
python3 cli/main.py
```

### Running Docker Web API
```bash
cd docker
docker-compose up -d           # Start container
curl http://localhost:5000/health  # Health check

# Upload and process GPX
curl -F "file=@../data/input/track.gpx" \
     -F "project_name=MyTrip" \
     -F "radius_km=5" \
     http://localhost:5000/api/process
```

### Testing Changes
- No automated tests currently exist
- Manual validation: Run with `./data/input/track.gpx` → verify Excel columns + map markers
- Check Overpass batching logs: `🔍 Querying X.Xkm track with Y batched Overpass calls`
- Docker logs: `docker-compose logs -f` from docker/ directory

### Adding New Presets
Edit [presets.yaml](../presets.yaml):
```yaml
my_preset:
  include:
    - "amenity=restaurant"
    - "amenity=bar"
  exclude:
    - "diet:vegan=only"
```

Then use: `python3 cli/main.py --preset my_preset`

## Common Gotchas

1. **Filter order matters**: Marker colors assigned by include filter rank (Filter 1=red, Filter 2=orange)
2. **Overpass timeouts**: Increase `batch_km` in config.yaml to reduce queries, or decrease for dense areas
3. **Empty results**: Check filter syntax (`key=value`), verify OSM data exists via [overpass-turbo.eu](https://overpass-turbo.eu/)
4. **Duplicate POIs**: Deduplication by OSM ID in [overpass.py](../core/overpass.py):L126-130
5. **CLI from subdirectory**: If running `python3 cli/main.py` from cli/ directory, config.yaml must exist in parent (fixed by resolving to repo root)
6. **Docker volume mounts**: Container expects `/app/data/input` and `/app/data/output` (mapped from `../data/{input,output}`)

## External Dependencies
- **Overpass API**: Multiple servers configured ([config.yaml](../config.yaml):L55-57), auto-retries with exponential backoff
- **OSM tag reference**: See [wiki.openstreetmap.org/wiki/Map_features](https://wiki.openstreetmap.org/wiki/Map_features)
- **GPX format**: Standard GPS exchange format (parsed via `gpxpy` library)
- **Docker**: Required for web API mode (Python 3.11-slim + Flask 3.0)

## Environment Variables

### CLI (.env in cli/ directory)
```
ALONGGPX_PROJECT_NAME=MyProject
ALONGGPX_OUTPUT_PATH=../data/output/
ALONGGPX_RADIUS_KM=5
ALONGGPX_STEP_KM=3
ALONGGPX_BATCH_KM=50
ALONGGPX_TIMEZONE=Europe/Berlin
```

### Docker (.env in docker/ directory)
```
FLASK_ENV=production
ALONGGPX_OUTPUT_PATH=/app/data/output
ALONGGPX_RADIUS_KM=5
ALONGGPX_BATCH_KM=50
```

## File Organization
- **core/** - Modular pipeline components (each file = 1 step, no dependencies between)
- **cli/** - Command-line entrypoint with config resolution
- **docker/** - Flask web API + containerization
- **data/input/** - GPX files for processing
- **data/output/** - Generated Excel/HTML (timestamped: `ProjectName_YYYYMMDD_HHMMSS.{xlsx,html}`)
- **docs/** - User-facing documentation and guides
- **Root config files** - config.yaml, presets.yaml (shared between CLI and web)

## Importing run_pipeline() from Web App
```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from cli.main import run_pipeline

result = run_pipeline(config, cli_presets=None, cli_include=None, cli_exclude=None)
# Returns: {excel_path, html_path, dataframe, rows_count, track_length_km}
```

## Release & Git Workflow
- Branch for features: `git checkout -b feature/description`
- Commit with scope: `git commit -m "feat(docker): update compose volumes"`
- Push to GitHub: `git push -u origin feature/description`
- Open PR and request review before merging to main

# AlongGPX AI Coding Instructions

## Project Overview
AlongGPX finds OpenStreetMap POIs along GPX tracks using Overpass API queries, then exports results to Excel and interactive Folium maps. Core use case: trip planning (e.g., finding campsites/water/shelters along a bikepacking route).

## Architecture & Data Flow

**Pipeline (see [main.py](../main.py)):**
1. **Config**: CLI args ([cli.py](../core/cli.py)) → merge with YAML ([config.py](../core/config.py))
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

## Configuration Hierarchy
1. [config.yaml](../config.yaml) - Base defaults
2. [presets.yaml](../presets.yaml) - Reusable filter profiles
3. CLI args - Override everything (`--preset`, `--include`, `--exclude`)

**Important**: When ANY CLI filter args are provided (`--preset`, `--include`, `--exclude`), `config.yaml:search.include/exclude` are ignored ([presets.py](../core/presets.py):L30-36).

## Development Workflows

### Running the Tool
```bash
# Basic (uses config.yaml)
python3 main.py

# With presets
python3 main.py --preset camp_basic --include amenity=drinking_water

# Full override
python3 main.py --gpx-file route.gpx --radius-km 10 --project-name MyTrip
```

### Testing Changes
- No automated tests currently exist
- Manual validation: Run with `./data/input/track.gpx` → verify Excel columns + map markers
- Check Overpass batching logs: `🔍 Querying X.Xkm track with Y batched Overpass calls`

### Adding New Presets
Edit [presets.yaml](../presets.yaml):
```yaml
my_preset:
  include:
    - "amenity=restaurant"
  exclude:
    - "diet:vegan=only"  # Example exclusion
```

## Common Gotchas

1. **Filter order matters**: Marker colors assigned by include filter rank (Filter 1=red, Filter 2=orange, see [config.yaml](../config.yaml):L28-38)
2. **Overpass timeouts**: Increase `batch_km` to reduce queries, or decrease for dense areas ([config.yaml](../config.yaml):L53)
3. **Empty results**: Check filter syntax (`key=value`), verify OSM data exists via [overpass-turbo.eu](https://overpass-turbo.eu/)
4. **Duplicate POIs**: Deduplication by OSM ID in [overpass.py](../core/overpass.py):L126-130

## External Dependencies
- **Overpass API**: Multiple servers configured ([config.yaml](../config.yaml):L55-57), auto-retries with exponential backoff
- **OSM tag reference**: See [wiki.openstreetmap.org/wiki/Map_features](https://wiki.openstreetmap.org/wiki/Map_features)
- **GPX format**: Standard GPS exchange format (parsed via `gpxpy` library)

## File Organization
- `core/` - Modular pipeline components (each file = 1 step)
- `data/input/` - GPX files
- `data/output/` - Generated Excel/HTML (timestamped: `ProjectName_YYYYMMDD_HHMMSS.xlsx`)
- Root config files - User-facing configuration

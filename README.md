# osm_finder

osm_finder is a modular Python tool that analyzes OpenStreetMap data along a GPX track.  
It combines GPX processing, Overpass API queries, flexible OSM filters, Excel export, and interactive Folium maps.

## Features
- Read GPX tracks and compute total distance
- Run segmented Overpass queries along the track
- Use flexible OSM include and exclude filters
- Use preset filter profiles for common search types
- Validate filters automatically
- Export all results to Excel
- Generate an interactive Folium map with track and markers
- Fully configurable through YAML and command line arguments
- Modular codebase for easy extension

## Installation
### Clone the repository
```bash
git clone https://github.com/your_username/osm_finder.git
cd osm_finder
```

### Install dependencies
```
pip install -r requirements.txt
```

Or install manually:
```
pip install gpxpy shapely pyproj requests tqdm folium pyyaml pandas
```

## Configuration

All default settings are stored in `config.yaml`.

### Example config:

```yaml
project:
  name: output
  output_path: ./

input:
  gpx_file: track.gpx

search:
  radius_km: 5
  step_km: null
  include:
    - tourism=camp_site
  exclude:
    - tents=no
    - camp_site:tent=no

map:
  zoom_start: 10
  track_color: blue
  marker_colors:
    near: green
    mid: orange
    far: red

overpass:
  retries: 5
  servers:
    - https://overpass-api.de/api/interpreter
    - https://overpass.kumi.systems/api/interpreter
    - https://lz4.overpass-api.de/api/interpreter

presets_file: presets.yaml
```

## Presets

The file `presets.yaml` contains predefined filter profiles.

### Example presets:

```yaml
presets:
  camp_basic:
    include:
      - tourism=camp_site
    exclude:
      - tents=no
      - camp_site:tent=no

  camp_and_caravan:
    include:
      - tourism=camp_site
      - tourism=caravan_site

  shelters:
    include:
      - amenity=shelter

  drinking_water:
    include:
      - amenity=drinking_water
```

## Usage

Run with default configuration:
```bash
python3 main.py
```

Override GPX file:
```bash
python3 main.py --gpx-file Tag1.gpx
```

Use a preset:
```bash
python3 main.py --preset camp_and_caravan
```

Combine presets:
```bash
python3 main.py --preset camp_basic --preset drinking_water
```

Add include filters:
```bash
python3 main.py --include amenity=toilets
```

Add exclude filters:
```bash
python3 main.py --exclude fee=yes
```

Full example:
```bash
python3 main.py --preset camp_basic --include amenity=toilets --exclude fee=yes --gpx-file Tag1.gpx --project-name Tour2025
```

## Output

The tool generates two files:

- `<project_name>.xlsx`
- `<project_name>.html`

Both files are saved in the directory defined by `project.output_path`.

## Technical Notes

- Overpass queries are executed in segments along the track
- Distances are computed using WGS84 geodesic calculations
- Track projection uses EPSG 3857
- Marker colors depend on distance to the track
- Filters are validated to ensure `key=value` format
- Duplicate results are removed

## Contributing

Pull requests are welcome. Please open an issue if you find bugs or want to request features.

## License


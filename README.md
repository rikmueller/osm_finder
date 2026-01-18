# osm_finder

osm_finder is a modular Python tool that analyzes OpenStreetMap POIs along a GPX track.  
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

## Installation
### Clone the repository
```bash
git clone https://github.com/rikmueller/osm_finder.git
cd osm_finder
```

### Create a virtual environment
It's recommended to use a Python virtual environment to avoid conflicts with system packages.

**On Linux/macOS:**
```bash
python3 -m venv venv_osm_finder
source venv_osm_finder/bin/activate
```

**On Windows:**
```bash
python -m venv venv_osm_finder
venv_osm_finder\Scripts\activate
```

> **Troubleshooting on Windows:** If you get an execution policy error, run this command in PowerShell:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```
> Then try activating the virtual environment again.

Your prompt should now show `(venv_osm_finder)` at the beginning, indicating the virtual environment is active.

### Install dependencies
```bash
pip install -r requirements.txt
```

Or install manually:
```bash
pip install gpxpy shapely pyproj requests tqdm folium pyyaml pandas openpyxl
```

## Configuration

All default settings are stored in `config.yaml`.

### Example config:

```yaml
project:
  # Name used for output files (xlsx and html)
  name: "MyProject"
  # Directory where output files will be saved
  output_path: "./output/"

input:
  # Path to the GPX file containing the track to analyze
  gpx_file: "./input/track.gpx"

search:
  # Search radius in kilometers around each track segment
  radius_km: 5
  # Distance between Overpass query points along the track (in km)
  # Set to null to auto-calculate as 60% of radius_km (highly suggested)
  step_km: null
  # OSM tags to search for (include filters)
  # Find available tags at: https://taginfo.openstreetmap.org/ or https://wiki.openstreetmap.org/wiki/Map_Features
  include:
    - "tourism=camp_site"
  # OSM tags to exclude from results (exclude filters)
  exclude:
    - "tents=no"
    - "camp_site:tent=no"

map:
  # Initial zoom level for the Folium map (1-18)
  zoom_start: 10
  # Color of the track line on the map
  track_color: "blue"
  # Color palette for markers based on filter rank
  # Colors are assigned to filters in order: Filter1=palette[0], Filter2=palette[1], etc.
  marker_color_palette:
    - "red"
    - "orange"
    - "purple"
    - "green"
    - "blue"
    - "darkred"
    - "darkblue"
    - "darkgreen"
    - "cadetblue"
    - "pink"
  # Default color if more filters than colors in palette
  default_marker_color: "gray"

overpass:
  # Number of retry attempts for failed Overpass API requests
  retries: 5
  # List of Overpass API endpoints (multiple servers for redundancy)
  servers:
    - "https://overpass-api.de/api/interpreter"
    - "https://overpass.private.coffee/api/interpreter"
    - "https://lz4.overpass-api.de/api/interpreter"

# Path to the presets file containing predefined filter profiles (don´t change unless you know what you´re doing)
presets_file: "presets.yaml"
```

**What this config does:**
- This example configuration searches for camping sites (excluding those without tent options) within 5 km of your GPX track.
- The GPX file is expected at `./input/track.gpx`.
- It generates an Excel file with a "Matching Filter" column and an interactive map.
- Markers on the map are colored by filter: camping sites get the first color in the palette (red), any second filter would be orange, etc.
- Results are saved to `./output/` as `MyProject_<date>_<timestamp>.xlsx` and `MyProject_<date>_<timestamp>.html`. 
- The map starts at zoom level 10 with a blue track line and markers color-coded by distance: green for locations within 2 km, orange for 2-5 km, and red for locations farther away. 
- Results are saved to `./output/`.

## Presets

The file `presets.yaml` contains predefined filter profiles.

### Example presets:

```yaml
presets:
  camp_basic:
    include:
      - "tourism=camp_site"
    exclude:
      - "tents=no"
      - "camp_site:tent=no"

  camp_and_caravan:
    include:
      - "tourism=camp_site"
      - "tourism=caravan_site"
    exclude:
      - "tents=no"

  wild_camping_spots:
    include:
      - "camp_site=wild"

  shelters:
    include:
      - "amenity=shelter"

  hotel:
    include:
      - "tourism=hotel"

  accommodation:
    include:
      - "tourism=hotel"
      - "tourism=guest_house"
      - "tourism=bed_and_breakfast"

  drinking_water:
    include:
      - "amenity=drinking_water"
```

## Usage

> **Note for Windows users:** Replace `python3` with `python` in all commands below.

> **Important:** When using `--preset`, `--include`, or `--exclude` arguments, the default filters from `config.yaml` are ignored. Only the filters you specify via CLI arguments will be used.

Run with default configuration:
```bash
python3 main.py
```

Override GPX file:
```bash
python3 main.py --gpx-file mytrack.gpx
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
python3 main.py --preset camp_basic --include amenity=toilets --exclude fee=yes --gpx-file mytrack.gpx --project-name Tour2025
```

## Output

The tool generates two files:

- **Excel file** (`<project_name>_<date>_<timestamp>.xlsx`): Contains all found objects with details including:
  - Name, Website, Phone, Opening hours
  - Kilometers from start of track
  - Distance from track (km)
  - **Matching Filter** - Shows which include filter matched each object
  - OSM Tags

- **Interactive map** (`<project_name>_<date>_<timestamp>.html`): Folium map featuring:
  - Your GPX track (blue line)
  - Markers colored by filter (first filter = red, second = orange, etc.)
  - Popup information for each marker
  - Locate button to show your current position

Both files are saved in the directory defined by `project.output_path` (default: `./output/`).

## Technical Notes

- Overpass queries are executed in segments along the track
- Distances are computed using WGS84 geodesic calculations (accurate across all latitudes)
- Marker colors are assigned by filter rank: Filter1 uses `palette[0]`, Filter2 uses `palette[1]`, etc.
- Filter matching allows you to track which search criteria found each object
- Filters are validated to ensure `key=value` format
- Duplicate results are removed
- For a complete list of available OSM tags, visit [TagInfo](https://taginfo.openstreetmap.org/) or the [OSM Wiki](https://wiki.openstreetmap.org/wiki/Map_Features)

## Contributing

Pull requests are welcome. Please open an issue if you find bugs or want to request features.

## Credits

osm_finder stands on the shoulders of great open-source projects:

- **[OpenStreetMap](https://www.openstreetmap.org/)** - The collaborative mapping platform providing the data
- **[Overpass API](https://overpass-api.de/)** - Powerful API for querying OpenStreetMap data
- **[gpxpy](https://github.com/tkrajina/gpxpy)** - Python GPX file parsing library
- **[Folium](https://github.com/python-visualization/folium)** - Python data to interactive Leaflet maps
- **[Shapely](https://github.com/Toblerity/Shapely)** - Python geometric operations library
- **[pandas](https://github.com/pandas-dev/pandas)** - Data analysis and manipulation library
- **[openpyxl](https://github.com/chronossc/openpyxl)** - Python library to read/write Excel files
- **[Requests](https://github.com/psf/requests)** - HTTP library for Python
- **[tqdm](https://github.com/tqdm/tqdm)** - Progress bar library
- **[GPX Studio](https://gpx.studio/)** - Modern GPX viewer and editor, inspired me to start this project


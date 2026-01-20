# osm_finder

osm_finder is a modular Python tool that analyzes OpenStreetMap POIs along a GPX track.  
It combines GPX processing, Overpass API queries, flexible OSM filters, Excel export, and interactive Folium maps.

## Use Case

You have a GPX track (from your GPS device, mapping app, or drawn on a map). You want to find specific amenities, services, or landmarks near your planned route. Instead of manually searching the map for each area, osm_finder automatically finds everything for you and creates:
- An Excel spreadsheet with details (name, contact info, distance from track, etc.)
- An interactive map showing all results with color-coded markers

Perfect for trip planning, hiking, bikepacking, road trips, or any adventure where you want to know what's nearby!

## Features
- Read GPX tracks and compute total distance
- Run segmented Overpass queries along the track
- Use flexible OSM include and exclude filters
- Use preset filter profiles for common search types
- Validate filters automatically
- Export all results to Excel with matching filter information
- Generate an interactive Folium map with color-coded markers by filter type
- Fully configurable through YAML and command line arguments
- Accurate WGS84 geodesic distance calculations

## Real-World Example: Bikepacking Tour Planning

### Scenario
You're planning a 5-day bikepacking tour through a region you've never visited. You have a GPX file with your planned route. You need to know:
- Where can I safely camp with my tent?
- Where are drinking water sources along the way?
- Are there shelters in case of bad weather?
- What are the contact details and opening hours?

**Without osm_finder:** You'd manually zoom through a map, searching each area, writing down info, and noting distances. Time-consuming and error-prone.

**With osm_finder:** Run a single command and get everything in seconds!

### Step-by-Step Example

**1. Prepare your GPX file**
Download or create your route in an app like [GPX Studio](https://gpx.studio/) and save it as `my_bikepacking_route.gpx`

**2. Run osm_finder**
```bash
python3 main.py \
  --gpx-file my_bikepacking_route.gpx \
  --preset camp_basic \
  --include amenity=drinking_water \
  --include amenity=shelter \
  --project-name BikepackingTour2025
```

**What each option does:**
- `--gpx-file` - Path to your route
- `--preset camp_basic` - Search for campsites that allow tents (excludes those without tents)
- `--include amenity=drinking_water` - Also find drinking water sources
- `--include amenity=shelter` - Also find emergency shelters
- `--project-name` - Name your results (used for output file names)

**3. Tool automatically**
1. Loads your GPX track
2. Searches a 5 km radius around each segment for:
   - Campsites that allow tents (`tourism=camp_site` without `tents=no`)
   - Drinking water sources (`amenity=drinking_water`)
   - Shelters (`amenity=shelter`)
3. Queries OpenStreetMap via Overpass API (combined into efficient batches)
4. Calculates exact distances using geodesic measurements

**4. Output created**

Two files are created in `./output/`:

**Excel File**:
| Name                     | Kilometers from start | Distance from track (km) | Matching Filter         | Website          | Phone        | Opening hours |
|--------------------------|----------------------:|-------------------------:|-------------------------|------------------|--------------|---------------|
| Mountain View Campground |                  12.5 |                      0.8 | tourism=camp_site       | www.mountain.com | +49-721-471108  | 24/7          |
| Spring Water Source      |                  18.3 |                      1.2 | amenity=drinking_water |                  |              |               |
| Emergency Shelter #42    |                  25.6 |                      2.1 | amenity=shelter        |                  |              |               |


**Interactive Map**:
- Your route shown as a blue line
- Red markers = Campsites (Filter 1)
- Orange markers = Drinking water (Filter 2)
- Purple markers = Shelters (Filter 3)
- Click markers to see details
- Use "Locate" button to see your current position

### Result
You now have a complete guide for your trip, all generated automatically from real OpenStreetMap data!

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

### config.yaml (defaults)

All default settings are stored in `config.yaml`. You can keep a single `config.yaml` with your preferred defaults and adjust settings per run using CLI arguments.

**Note:** Most settings can be overridden using command line arguments - you don't need to edit the config file for every change.

#### Example config:

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
  # Distance in km of track to query per Overpass API call
  # Batching reduces API calls: e.g., 100km route with batch_km=50 = 2 queries instead of 30+
  # Lower values (30-40) for complex queries or dense areas, higher (60-80) for simple queries
  # Recommended: 30-60km (default: 50km)
  batch_km: 50
  # List of Overpass API endpoints (multiple servers for redundancy)
  servers:
    - "https://overpass-api.de/api/interpreter"
    - "https://overpass.private.coffee/api/interpreter"
    - "https://lz4.overpass-api.de/api/interpreter"

# Path to the presets file containing predefined filter profiles (don´t change unless you know what you´re doing)
presets_file: "presets.yaml"
```

### CLI

The following command line arguments can override settings from `config.yaml`:

| Argument | Type | Description | Example |
|----------|------|-------------|---------|
| `--config` | string | Path to YAML configuration file | `--config my_config.yaml` |
| `--project-name` | string | Project name | `--project-name MyTour` |
| `--output-path` | string | Output directory | `--output-path ./results/` |
| `--gpx-file` | string | Path to GPX file | `--gpx-file route.gpx` |
| `--radius-km` | number | Search radius in km | `--radius-km 5` |
| `--preset` | string | Preset name from presets.yaml (can be used multiple times) | `--preset camp_basic --preset drinking_water` |
| `--include` | string | Add include filter key=value (can be used multiple times) | `--include amenity=toilets` |
| `--exclude` | string | Add exclude filter key=value (can be used multiple times) | `--exclude fee=yes` |

**Note:** When using `--preset`, `--include`, or `--exclude`, the default filters from `config.yaml` are **ignored** - only the CLI arguments are used.


## Presets

Presets are predefined filter profiles stored in `presets.yaml` that combine multiple OSM tags into reusable search templates. Instead of manually specifying include/exclude filters, you can use a preset name to quickly search for common amenities and landmarks.

### Available presets

For a complete list of available presets and how to create your own, see the [Presets documentation on the Wiki](https://github.com/rikmueller/osm_finder/wiki).

## Usage

> **Note for Windows users:** Replace `python3` with `python` in all commands below.

> **Important:** When using `--preset`, `--include`, or `--exclude` arguments, the default filters from `config.yaml` are ignored. Only the filters you specify via CLI arguments will be used.

Run with default configuration (config.yaml):
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

## Technical Notes

- **Batched queries**: Multiple search points are combined into single Overpass API calls (configured via `batch_km`), reducing API load by 80-90%
- **Segmented search**: Track is divided into segments for complete coverage along the route
- **Geodesic distances**: All distances computed using WGS84 geodesic calculations (accurate across all latitudes)
- **Color-coded markers**: Assigned by filter rank (Filter1→palette[0], Filter2→palette[1], etc.)
- **Filter matching**: Track which search criteria found each object
- **Validation**: Filters are validated to ensure `key=value` format
- **Deduplication**: Duplicate results across batches are automatically removed
- **OSM tags reference**: For available tags, visit [TagInfo](https://taginfo.openstreetmap.org/) or the [OSM Wiki](https://wiki.openstreetmap.org/wiki/Map_Features)

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


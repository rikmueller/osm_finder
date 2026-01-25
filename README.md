# AlongGPX

**Find OpenStreetMap POIs along GPX tracks. Plan trips smarter: campsites, water sources, shelters—all organized by distance from your route.**

## 🎯 What It Does

You provide a GPX track (from your bike computer, phone, or mapping app). AlongGPX queries OpenStreetMap for everything you're looking for nearby.

It creates:
- **Excel spreadsheet** with names, contact info, opening hours, distances
- **Interactive map** with color-coded markers showing each POI type

Perfect for trip planning: bikepacking, hiking, road trips, or any adventure where you need to know what's nearby.

## 🚀 Get Started
AlongGPX comes in two flavours:
- CLI (Python) → [docs/quickstart-cli.md](docs/quickstart-cli.md)
- REST API (Docker) → [docs/quickstart-docker.md](docs/quickstart-docker.md)

## 📁 Project Structure

```
AlongGPX/
├── cli/                    # Command-line interface
│   ├── main.py            # CLI entry point
│   └── .env.example       # CLI environment template
├── docker/                 # Docker/Web application
│   ├── app.py             # Flask REST API
│   ├── Dockerfile         # Docker build configuration
│   ├── docker-compose.yml # Container orchestration
│   ├── requirements-web.txt # Web dependencies
│   └── .env.example       # Web environment template
├── core/                   # Shared pipeline modules
│   ├── cli.py             # Argument parsing
│   ├── config.py          # Configuration management
│   ├── presets.py         # Filter presets
│   ├── gpx_processing.py  # GPX parsing and metrics
│   ├── overpass.py        # Overpass API queries
│   ├── filtering.py       # Result filtering
│   ├── export.py          # Excel export
│   └── folium_map.py      # Map generation
├── docs/                   # Documentation
│   ├── quickstart-cli.md  # CLI setup guide
│   └── quickstart-docker.md # Docker setup guide
├── data/
│   ├── input/              # GPX files (default)
│   └── output/             # Generated results
├── config.yaml            # Shared configuration
├── presets.yaml           # Filter presets
├── requirements-base.txt  # Core dependencies (CLI)
└── README.md              # This file
```

## Configuration Files

| File | Purpose |
|------|---------|
| [config.yaml](config.yaml) | Default settings (radius, step distance, Overpass servers) |
| [presets.yaml](presets.yaml) | Pre-built filter profiles (camp_basic, drinking_water, shelters, etc.) |

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
- **CLI and Web API modes** for different use cases


## Architecture

**Pipeline:**
1. Load GPX track → compute total distance
2. Query OpenStreetMap (Overpass API) with search circles along track
3. Filter results by include/exclude rules
4. Calculate geodesic distance to track (WGS84 ellipsoid)
5. Export to Excel + interactive Folium map

## Contributing

Pull requests are welcome. Please open an issue if you find bugs or want to request features.

## Credits

AlongGPX stands on the shoulders of great open-source projects:

- **[OpenStreetMap](https://www.openstreetmap.org/)** - The collaborative mapping platform providing the data
- **[Overpass API](https://overpass-api.de/)** - Powerful API for querying OpenStreetMap data
- **[gpxpy](https://github.com/tkrajina/gpxpy)** - Python GPX file parsing library
- **[Folium](https://github.com/python-visualization/folium)** - Python data to interactive Leaflet maps
- **[Shapely](https://github.com/Toblerity/Shapely)** - Python geometric operations library
- **[pandas](https://github.com/pandas-dev/pandas)** - Data analysis and manipulation library
- **[openpyxl](https://github.com/chronossc/openpyxl)** - Python library to read/write Excel files
- **[Flask](https://github.com/pallets/flask)** - Web framework for the REST API
- **[Requests](https://github.com/psf/requests)** - HTTP library for Python
- **[tqdm](https://github.com/tqdm/tqdm)** - Progress bar library
- **[GPX Studio](https://gpx.studio/)** - Modern GPX viewer and editor, inspired me to start this project


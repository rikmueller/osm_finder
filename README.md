# AlongGPX

**Find OpenStreetMap POIs along GPX tracks. Plan trips smarter: campsites, water sources, shelters—all organized by distance from your route.**

## 🎯 What It Does

You provide a GPX track (from your bike computer, phone, or mapping app). AlongGPX queries OpenStreetMap for everything you're looking for nearby.

It creates:
- **Excel spreadsheet** with names, contact info, opening hours, distances
- **Interactive map** with color-coded markers showing each POI type

Perfect for trip planning: bikepacking, hiking, road trips, or any adventure where you need to know what's nearby.

## 🚀 Get Started
AlongGPX comes in three flavours:
- **🌐 Web UI** (easiest!) → [docs/QUICKSTART-FRONTEND.md](docs/QUICKSTART-FRONTEND.md)
- CLI (Python) → [docs/quickstart-cli.md](docs/quickstart-cli.md)
- REST API (Docker) → [docs/quickstart-docker.md](docs/quickstart-docker.md)

## 📁 Project Structure

```
AlongGPX/
├── web/                    # React frontend (modern web UI)
│   ├── src/
│   │   ├── DevApp.tsx     # Main application
│   │   ├── api.ts         # API client with TypeScript types
│   │   ├── components/    # UI components
│   │   └── hooks/         # Custom React hooks (WebSocket)
│   ├── package.json       # Frontend dependencies
│   └── vite.config.ts     # Build configuration
├── backend/                # Flask REST API
│   ├── app.py             # API endpoints + job management
│   └── requirements.txt   # Backend dependencies
├── cli/                    # Command-line interface
│   ├── main.py            # CLI entry point
│   └── requirements-cli.txt
├── core/                   # Shared pipeline modules
│   ├── config.py          # Configuration management
│   ├── presets.py         # Filter presets
│   ├── gpx_processing.py  # GPX parsing and metrics
│   ├── overpass.py        # Overpass API queries
│   ├── filtering.py       # Result filtering
│   ├── export.py          # Excel export
│   └── folium_map.py      # Map generation
├── docker/                 # Production deployment
│   ├── docker-compose.yml # Container orchestration
│   ├── Dockerfile         # Backend container
│   ├── Dockerfile.nginx   # Frontend + Nginx
│   └── nginx.conf         # Reverse proxy config
├── config/                 # Shared configuration
│   ├── config.yaml        # Defaults
│   └── presets.yaml       # Filter presets
├── data/
│   ├── input/              # GPX files
│   └── output/             # Generated results
└── docs/                   # Documentation
    ├── QUICKSTART-FRONTEND.md
    ├── FRONTEND.md
    ├── quickstart-cli.md
    └── quickstart-docker.md
```

## Configuration Files

| File | Purpose |
|------|---------|
| [config.yaml](config.yaml) | Default settings (radius, step distance, Overpass servers) |
| [presets.yaml](presets.yaml) | Pre-built filter profiles (camp_basic, drinking_water, shelters, etc.) |

## Features
- **Modern web UI** with real-time interactive map visualization
- **Instant GPX track preview** upon upload - see your route immediately
- **Mobile-responsive design** with collapsible settings panel
- **Real-time progress updates** via WebSocket (with polling fallback)
- **Advanced filter management** with preset categories and custom filters
- **Live POI markers** appearing on map as processing completes
- Multiple map tile layers (OpenStreetMap, OpenTopoMap, CyclOSM)
- Color-coded markers by filter type with custom icons
- Export results to Excel with distances and contact information
- Download interactive Folium maps with start/stop markers
- Flexible OSM include/exclude filters with validation
- Preset filter profiles for common search types (camping, water, food, shops)
- Accurate WGS84 geodesic distance calculations
- **CLI, Web UI, and REST API modes** for different workflows


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


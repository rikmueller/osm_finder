# AlongGPX AI Coding Instructions

## Project Overview
AlongGPX finds OpenStreetMap POIs along GPX tracks using Overpass API queries, then exports results to Excel and interactive Folium maps. Core use case: trip planning (e.g., finding campsites/water/shelters along a bikepacking route).

**Three Interfaces:**
1. **Web UI** (React + TypeScript) - Modern browser-based interface with real-time progress
2. **CLI** (Python) - Command-line tool for batch processing and automation
3. **REST API** (Flask) - Backend for web UI, also usable standalone

## Architecture & Data Flow

### Backend Pipeline (Shared by all interfaces)
Located in `core/` directory - reusable modules called by CLI and web API:

1. **Config**: YAML defaults + env vars + runtime args → merged config ([config.py](../core/config.py))
2. **Presets**: Load [config/presets.yaml](../config/presets.yaml) → apply to filters ([presets.py](../core/presets.py))
3. **GPX**: Parse GPX → geodesic distance calculations with `pyproj.Geod(ellps="WGS84")` ([gpx_processing.py](../core/gpx_processing.py))
4. **Overpass**: Batched queries along track with configurable `batch_km` ([overpass.py](../core/overpass.py))
5. **Filter**: Include/exclude OSM tags → geodesic distance to track ([filtering.py](../core/filtering.py))
6. **Export**: DataFrame → Excel + Folium map with color-coded markers ([export.py](../core/export.py), [folium_map.py](../core/folium_map.py))

Entry point: `cli.main.run_pipeline()` - returns dict with paths and metadata

### Frontend Architecture (React/TypeScript)
Modern map-first single-page application with continuous visual feedback:

**Core Files:**
- [web/src/DevApp.tsx](../web/src/DevApp.tsx) - Main orchestrator (stage management: idle → uploaded → processing → completed/error)
- [web/src/api.ts](../web/src/api.ts) - Typed API client with axios
- [web/src/components/](../web/src/components/) - Reusable UI components
- [web/src/hooks/](../web/src/hooks/) - Custom React hooks

**Key Components:**
- `DevHeader` - Glassmorphic header with branding and modern styling
- `SettingsSheet` - Collapsible settings sidebar (mobile-responsive with smooth animations)
- `InteractiveDevMap` - React-Leaflet map with instant GPX visualization and live POI updates
- `PresetSelectionModal` - Category-organized preset selection (Camping, Accommodation, Food, etc.)
- `FilterSelectionModal` - Custom OSM filter builder (key=value format)
- `Modal` - Reusable modal base component with backdrop and animations

**Custom Hooks:**
- `useWebSocket` - Real-time progress updates via Socket.IO (with polling fallback)

**State Flow:**
```
User uploads GPX → instant client-side parsing → track renders on map
Click Generate → /api/process → job_id
WebSocket/polling updates → progress bar + live POI markers
Completed → interactive map with all results + download buttons
```

**Key Features:**
- **Instant visualization**: GPX track appears immediately after upload (client-side DOMParser)
- **Continuous experience**: Map visible throughout entire workflow
- **Real-time POIs**: Markers appear on map as backend finds them
- **Mobile-first**: Collapsible settings panel, touch-friendly controls
- **Advanced filters**: Preset deletion preserves individual filters, complex filter management
- **Tile persistence**: User's preferred map layer saved to localStorage

### REST API (Flask + SocketIO)
Located in [backend/app.py](../backend/app.py) - async job processing with polling:

**Endpoints:**
- `GET /health` - Health check
- `GET /api/config` - Returns defaults + presets for UI initialization
- `POST /api/process` - Upload GPX, start async processing, returns `job_id`
- `GET /api/status/{job_id}` - Poll job state (queued → processing → completed/failed)
- `GET /api/job/{job_id}/geojson` - Fetch track + POIs as GeoJSON for map rendering
- `GET /api/download/excel/{filename}` - Download Excel file
- `GET /api/download/html/{filename}` - Download Folium map

**Job Registry:**
Thread-safe in-memory dict tracking job state, progress (0-100%), results, errors.
Background threads execute `run_pipeline()` and update job status via callbacks.

**SocketIO (Optional):**
Real-time updates enabled if SocketIO initialization succeeds, graceful fallback to polling otherwise.

### Key Design Decisions
- **WGS84 geodesic**: All distance calculations use `pyproj.Geod` for accuracy (not Euclidean)
- **Batching**: Multiple search circles combined per Overpass call (controlled by `config/config.yaml:overpass.batch_km`)
- **Auto step_km**: Defaults to 60% of `radius_km` if not set
- **Filter precedence**: CLI/API args override `config.yaml` base filters entirely (not additive)
- **Reusable pipeline**: `cli.main.run_pipeline()` callable from CLI or web backend
- **Async processing**: Web API runs pipeline in background threads, returns immediately with job ID
- **GeoJSON export**: POIs + track converted to GeoJSON for modern map rendering
- **Progress callbacks**: Pipeline supports optional progress callback for real-time updates

## Project Structure

```
AlongGPX/
├── cli/                         # Command-line interface
│   ├── main.py                 # CLI entry + run_pipeline() export
│   └── requirements-cli.txt    # CLI-specific deps
├── core/                        # Shared pipeline (DRY - used by CLI & web)
│   ├── __init__.py
│   ├── cli.py                  # Argument parsing
│   ├── config.py               # YAML + env var + runtime merging
│   ├── presets.py              # Filter preset loading/validation
│   ├── gpx_processing.py       # GPX parsing & geodesic metrics
│   ├── overpass.py             # Batched Overpass API queries
│   ├── filtering.py            # Result filtering & distance calc
│   ├── export.py               # Excel export
│   └── folium_map.py           # Folium map generation
├── backend/                     # Flask REST API
│   ├── app.py                  # Flask + SocketIO, job registry, endpoints
│   ├── requirements.txt        # Flask + dependencies
│   └── test_api.py             # API test script
├── web/                         # React frontend
│   ├── src/
│   │   ├── DevApp.tsx          # Main application
│   │   ├── DevApp.css          # Dark theme styles
│   │   ├── api.ts              # Typed API client
│   │   ├── main.tsx            # React Router entry point
│   │   ├── index.css           # Design system
│   │   ├── components/         # UI components
│   │   │   ├── DevHeader.tsx
│   │   │   ├── SettingsSheet.tsx
│   │   │   ├── InteractiveDevMap.tsx  # React-Leaflet map
│   │   │   ├── PresetSelectionModal.tsx
│   │   │   ├── FilterSelectionModal.tsx
│   │   │   └── Modal.tsx         # Base modal component
│   │   └── hooks/              # Custom React hooks
│   │       └── useWebSocket.ts
│   ├── Dockerfile              # Frontend production build
│   ├── vite.config.ts          # Vite build config
│   └── package.json            # React, axios, leaflet, socket.io-client
├── docker/                      # Production deployment
│   ├── docker-compose.yml      # Nginx + Flask backend
│   ├── docker-compose.dev.yml  # Dev mode (hot reload)
│   ├── Dockerfile              # Backend container
│   ├── Dockerfile.nginx        # Nginx + frontend static files
│   └── nginx.conf              # Reverse proxy config
├── config/                      # Shared configuration
│   ├── config.yaml             # Defaults (paths, radius, Overpass servers)
│   ├── presets.yaml            # Filter presets (camp_basic, drinking_water, etc.)
│   └── .env.example            # Environment variable template
├── data/
│   ├── input/                  # GPX files (mounted in Docker)
│   └── output/                 # Generated Excel/HTML (timestamped)
├── docs/                        # Documentation
│   ├── QUICKSTART-FRONTEND.md  # Web UI setup & deployment
│   ├── quickstart-cli.md       # CLI setup
│   ├── quickstart-docker.md    # Docker setup
│   ├── FRONTEND.md             # Frontend architecture deep-dive
│   └── IMPLEMENTATION_NOTES.md # Project evolution notes
├── FRONTEND_QUICKREF.md         # Quick reference for developers
└── README.md                    # Project overview
```

## Critical Conventions

### Filter System (`key=value`)
- **Include filters**: OSM tags to search for (e.g., `tourism=camp_site`)
- **Exclude filters**: Remove matches (e.g., `tents=no`)
- Validated in [presets.py](../core/presets.py):`validate_filter_syntax()`
- Matching logic: First matching include filter becomes `Matching Filter` column ([filtering.py](../core/filtering.py))
- **Filter colors**: Web UI assigns colors by filter rank (1st=red, 2nd=orange, 3rd=purple, etc.)

### Coordinate Format
- **Internal (Python)**: Always `(lon, lat)` tuples
- **Folium/display**: Reversed to `[lat, lon]` (see [folium_map.py](../core/folium_map.py))
- **GeoJSON**: Standard format `[lon, lat]` (used by React-Leaflet)

### Distance Calculations
Never use Euclidean distance or projected coordinates for final measurements:
```python
# CORRECT (used in filtering.py)
geod = Geod(ellps="WGS84")
_, _, distance_m = geod.inv(lon1, lat1, lon2, lat2)

# WRONG (only for visualization/interpolation)
track_line = LineString(track_points_m)  # EPSG:3857
```

### Frontend TypeScript Conventions
- **Typed API client**: All responses typed in [api.ts](../web/src/api.ts)
- **CSS Modules pattern**: Each component has corresponding `.css` file (e.g., `DevHeader.tsx` + `DevHeader.css`)
- **Dark theme**: DevApp uses dark color scheme with glassmorphic effects
- **No heavy UI libraries**: Custom CSS with design system (CSS variables in index.css)
- **Error boundaries**: Top-level error handling in DevApp.tsx
- **Real-time updates**: useWebSocket hook for Socket.IO, graceful fallback to 1s polling
- **Client-side GPX parsing**: Browser DOMParser reads GPX immediately for instant visualization
- **LocalStorage persistence**: Tile layer preference saved across sessions

## Configuration Hierarchy (Highest → Lowest)

1. **Runtime arguments** (CLI flags or API form parameters)
2. **Environment variables** (e.g., `ALONGGPX_RADIUS_KM=5`)
3. **config.yaml defaults** ([config/config.yaml](../config/config.yaml))

**Important**: When ANY CLI/API filter args provided (`preset`, `include`, `exclude`), `config.yaml:search.include/exclude` are completely ignored (not merged) - see [presets.py](../core/presets.py).

## Development Workflows

### Local Development (Full Stack)
```bash
# Terminal 1: Backend (Flask)
cd /home/rik/AlongGPX
python3 backend/app.py
# Runs on http://localhost:5000

# Terminal 2: Frontend (Vite dev server)
cd web
npm install
npm run dev
# Runs on http://localhost:3000 with HMR

# Browser: http://localhost:3000
```

### CLI Only (No Web)
```bash
# From repo root with defaults
python3 cli/main.py

# With custom GPX and filters
python3 cli/main.py \
  --gpx-file ./data/input/myroute.gpx \
  --radius-km 10 \
  --preset camp_basic \
  --include "amenity=drinking_water"

# With environment overrides
export ALONGGPX_RADIUS_KM=8
python3 cli/main.py
```

### Docker Production Mode
```bash
cd docker
docker-compose up -d           # Nginx + Flask backend
curl http://localhost:3000     # Frontend served by Nginx
curl http://localhost:3000/api/health  # API via reverse proxy
```

### Docker Development Mode
```bash
cd docker
docker-compose -f docker-compose.dev.yml up
# Frontend with hot reload on http://localhost:3000
```

### Frontend Development (Standalone)
```bash
cd web
npm run dev          # Dev server with HMR
npm run build        # Production build to dist/
npm run preview      # Preview production build
```

### Testing Changes
- **No automated tests** currently exist
- **Manual validation**: 
  - CLI: Run with `./data/input/track.gpx` → verify Excel columns + map markers
  - Web: Upload GPX → verify progress updates → check downloads
- **Logs**: 
  - Backend: `python3 backend/app.py` shows Flask logs
  - Frontend: Browser console shows API calls
  - Docker: `docker-compose logs -f` from docker/ directory
- **Check batching**: Look for log `Querying X.Xkm track with Y batched Overpass calls`

### Adding New Presets
Edit [config/presets.yaml](../config/presets.yaml):
```yaml
my_preset:
  name: "My Custom Preset"
  category: "Accommodation"
  info: "Description shown in UI"
  include:
    - "amenity=restaurant"
    - "amenity=bar"
  exclude:
    - "diet:vegan=only"
```

**Usage:**
- CLI: `python3 cli/main.py --preset my_preset`
- Web UI: Select from preset dropdown
- API: `curl -F "preset=my_preset" ...`

### Adding New API Endpoints
1. Add route in [backend/app.py](../backend/app.py)
2. Update TypeScript types in [web/src/api.ts](../web/src/api.ts)
3. Add client method to `apiClient` object
4. Use in components via `apiClient.newMethod()`

### Adding New UI Components
1. Create `Component.tsx` and `Component.css` in [web/src/components/](../web/src/components/)
2. Import in [App.tsx](../web/src/App.tsx) or other parent
3. Follow naming convention: PascalCase for component, camelCase for props
4. Use CSS variables from [index.css](../web/src/index.css) design system

## Common Gotchas

1. **Filter order matters**: Marker colors assigned by include filter rank (1st=red, 2nd=orange, etc.)
2. **Overpass timeouts**: Increase `batch_km` in config.yaml to reduce queries, or decrease for dense areas
3. **Empty results**: Check filter syntax (`key=value`), verify OSM data exists via [overpass-turbo.eu](https://overpass-turbo.eu/)
4. **Duplicate POIs**: Deduplication by OSM ID in [overpass.py](../core/overpass.py)
5. **CLI from wrong directory**: Always run `python3 cli/main.py` from repo root
6. **Docker volume mounts**: Container expects `/app/data/input` and `/app/data/output`
7. **CORS errors in dev**: Vite proxy configured in [vite.config.ts](../web/vite.config.ts) - API calls to `/api/*` proxied to Flask
8. **SocketIO fallback**: If WebSocket fails, app automatically falls back to polling
9. **Frontend env vars**: Must start with `VITE_` to be accessible in browser code
10. **Config location**: CLI/backend expect config in `config/` directory (not root)

## External Dependencies

### Backend
- **Flask 3.0** - Web framework
- **Flask-SocketIO** - Real-time updates (optional)
- **gpxpy** - GPX parsing
- **Folium** - Interactive maps
- **pandas** - Data manipulation
- **openpyxl** - Excel export
- **pyproj** - Geodesic calculations
- **Shapely** - Geometric operations
- **requests** - HTTP client

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite 4** - Build tool
- **axios** - HTTP client
- **Leaflet** - Map library
- **react-leaflet** - React bindings for Leaflet
- **socket.io-client** - Real-time updates
- **lucide-react** - Icon library

### External Services
- **Overpass API**: Multiple servers configured ([config/config.yaml](../config/config.yaml)), auto-retries with exponential backoff
- **OSM tag reference**: [wiki.openstreetmap.org/wiki/Map_features](https://wiki.openstreetmap.org/wiki/Map_features)

## Environment Variables

### Shared (config/.env)
```
ALONGGPX_PROJECT_NAME=MyProject
ALONGGPX_OUTPUT_PATH=../data/output/
ALONGGPX_RADIUS_KM=5
ALONGGPX_STEP_KM=3
ALONGGPX_BATCH_KM=50
ALONGGPX_TIMEZONE=Europe/Berlin
ALONGGPX_HOSTNAME=localhost  # For Vite HMR in Docker
```

### Backend (backend/.env)
```
FLASK_ENV=development
FLASK_PORT=5000
```

### Frontend (web/.env.local)
```
VITE_API_BASE_URL=http://localhost:5000
VITE_ALLOWED_HOSTS=localhost,127.0.0.1
```

### Docker (docker/.env)
```
FLASK_ENV=production
FLASK_PORT=5000
```

## File Organization by Role

### Backend Developer
- **[backend/app.py](../backend/app.py)** - Add API endpoints here
- **[core/](../core/)** - Modify pipeline logic (GPX, Overpass, filtering)
- **[config/config.yaml](../config/config.yaml)** - Adjust defaults

### Frontend Developer
- **[web/src/DevApp.tsx](../web/src/DevApp.tsx)** - Main orchestration
- **[web/src/components/](../web/src/components/)** - UI components
- **[web/src/api.ts](../web/src/api.ts)** - API client
- **[web/src/hooks/useWebSocket.ts](../web/src/hooks/useWebSocket.ts)** - Real-time hook
- **[web/src/index.css](../web/src/index.css)** - Design system

### DevOps
- **[docker/docker-compose.yml](../docker/docker-compose.yml)** - Production deployment
- **[docker/nginx.conf](../docker/nginx.conf)** - Reverse proxy
- **[docker/Dockerfile](../docker/Dockerfile)** - Backend image
- **[docker/Dockerfile.nginx](../docker/Dockerfile.nginx)** - Frontend image

### Data/Config
- **[config/presets.yaml](../config/presets.yaml)** - Filter presets
- **[config/config.yaml](../config/config.yaml)** - App defaults
- **[data/input/](../data/input/)** - GPX files
- **[data/output/](../data/output/)** - Results (Excel, HTML, timestamped)

## API Integration Examples

### Python (calling run_pipeline directly)
```python
import sys, os
sys.path.insert(0, '/home/rik/AlongGPX')
from cli.main import run_pipeline
from core.config import load_yaml_config

config = load_yaml_config('config/config.yaml')
config['input']['gpx_file'] = 'data/input/track.gpx'
config['search']['radius_km'] = 10

result = run_pipeline(
    config, 
    cli_presets=['camp_basic'], 
    cli_include=['amenity=drinking_water'],
    cli_exclude=None
)
# Returns: {excel_path, html_path, dataframe, rows_count, track_length_km}
```

### cURL (REST API)
```bash
# Upload and process
curl -X POST http://localhost:5000/api/process \
  -F "file=@track.gpx" \
  -F "project_name=MyTrip" \
  -F "radius_km=10" \
  -F "preset=camp_basic" \
  -F "include=amenity=drinking_water"
# Returns: {"job_id": "abc-123", "status_url": "/api/status/abc-123"}

# Poll status
curl http://localhost:5000/api/status/abc-123
# Returns: {"state": "processing", "percent": 45, "message": "Overpass queries 3/7", ...}

# Download Excel
curl -O http://localhost:5000/api/download/excel/MyTrip_20260129_120000.xlsx
```

### TypeScript (Frontend)
```typescript
import { apiClient } from './api'

// Start processing
const response = await apiClient.startProcessing(
  gpxFile,
  'MyTrip',
  10,
  ['amenity=drinking_water'],
  [],
  ['camp_basic']
)

// Poll status
const status = await apiClient.getJobStatus(response.job_id)

// Get GeoJSON for map
const geojson = await apiClient.getGeoJson(response.job_id)
```

## Deployment Scenarios

### Single-User Local
```bash
# Just run backend + frontend locally
python3 backend/app.py &
cd web && npm run dev
```

### Multi-User Production
```bash
# Docker with Nginx reverse proxy
cd docker
docker-compose up -d
# Access at http://server:3000
```

### CI/CD Pipeline
```bash
# Build images
docker build -f docker/Dockerfile -t alonggpx-backend .
docker build -f docker/Dockerfile.nginx -t alonggpx-frontend .

# Push to registry
docker push yourregistry/alonggpx-backend
docker push yourregistry/alonggpx-frontend

# Deploy
docker-compose -f docker/docker-compose.yml up -d
```

## Release & Git Workflow
- Branch for features: `git checkout -b feature/description`
- Commit with scope: 
  - `git commit -m "feat(frontend): add new component"`
  - `git commit -m "fix(backend): correct job registry locking"`
  - `git commit -m "docs: update API examples"`
- Push to GitHub: `git push -u origin feature/description`
- Open PR and request review before merging to main
- Use semantic versioning for releases

## Performance Considerations
- **Overpass batching**: Adjust `batch_km` based on track length and POI density
- **Frontend polling**: 1s interval balances responsiveness vs server load
- **GeoJSON size**: Large tracks/POIs may cause browser memory issues (consider pagination)
- **Docker resources**: Backend threads consume memory during processing
- **File storage**: Output directory grows with each run (implement cleanup cron)

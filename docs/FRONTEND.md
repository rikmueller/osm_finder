# Web Frontend Development Guide

This document describes the new web frontend for AlongGPX and how it integrates with the existing infrastructure.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Docker Containers                            │
│                                                                      │
│  ┌──────────────────┐              ┌──────────────────┐             │
│  │   Frontend       │              │   Backend API    │             │
│  │   (React/Vite)   │──────────→   │   (Flask)        │             │
│  │   :3000          │              │   :5000          │             │
│  └──────────────────┘              └──────────────────┘             │
│                                            │                         │
│                                            ↓                         │
│                                    ┌────────────────┐                │
│                                    │ AlongGPX Core  │                │
│                                    │   Pipeline     │                │
│                                    └────────────────┘                │
│                                            │                         │
│                                            ↓                         │
│                                  ┌──────────────────┐               │
│                                  │   Overpass API   │               │
│                                  │   OSM Data       │               │
│                                  └──────────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

## Frontend Structure

```
web/
├── src/
│   ├── main.tsx              # Entry point with React Router
│   ├── DevApp.tsx            # Main app orchestrator
│   ├── DevApp.css            # Dark theme layout styles
│   ├── index.css             # Global design system
│   ├── api.ts                # API client & TypeScript types
│   ├── components/
│   │   ├── DevHeader.tsx         # Glassmorphic header with branding
│   │   ├── DevHeader.css
│   │   ├── SettingsSheet.tsx     # Collapsible settings sidebar (mobile-responsive)
│   │   ├── SettingsSheet.css
│   │   ├── InteractiveDevMap.tsx # React-Leaflet map with custom markers
│   │   ├── InteractiveDevMap.css
│   │   ├── PresetSelectionModal.tsx # Category-organized preset selection
│   │   ├── PresetSelectionModal.css
│   │   ├── FilterSelectionModal.tsx # Custom filter builder
│   │   ├── FilterSelectionModal.css
│   │   ├── Modal.tsx             # Reusable modal base component
│   │   └── Modal.css
│   └── hooks/
│       └── useWebSocket.ts       # WebSocket hook for real-time updates
├── index.html                # HTML template
├── package.json              # Dependencies (react-router, leaflet, socket.io-client)
├── vite.config.ts            # Vite configuration with proxy
├── tsconfig.json             # TypeScript config
└── Dockerfile                # Frontend build image
```

## Backend Integration

### New API Endpoints

**`GET /api/config`**
- Returns default configuration and available presets
- Used by frontend to populate dropdowns and initial values
- Response:
  ```json
  {
    "defaults": {
      "project_name": "MyProject",
      "radius_km": 5,
      "step_km": null,
      "include": ["tourism=camp_site"],
      "exclude": ["tents=no"]
    },
    "presets": ["camp_basic", "drinking_water", ...],
    "presets_detail": {
      "camp_basic": {
        "include": ["tourism=camp_site"],
        "exclude": ["tents=no"]
      }
    }
  }
  ```

**`POST /api/process`**
- Async start of GPX processing
- Returns immediately with a `job_id` for polling
- Request: multipart/form-data with file, settings, filters
- Response (HTTP 202):
  ```json
  {
    "job_id": "uuid-string",
    "status_url": "/api/status/uuid-string"
  }
  ```

**`GET /api/status/<job_id>`**
- Poll job progress
- Response:
  ```json
  {
    "id": "uuid",
    "state": "processing|completed|failed|queued",
    "percent": 45,
    "message": "Processing track...",
    "project_name": "MyProject",
    "created_at": "2026-01-25T10:30:45",
    "excel_file": "MyProject_20260125_103045.xlsx",
    "html_file": "MyProject_20260125_103045.html",
    "rows_count": 42,
    "track_length_km": 125.5,
    "error": null
  }
  ```

### Async Processing Implementation

The Flask app now:
1. Creates a job entry in `job_registry` on `/api/process` POST
2. Returns immediately with HTTP 202 + job_id
3. Spawns a background thread running `process_gpx_async()`
4. Updates job status as pipeline progresses
5. Frontend polls `/api/status/<job_id>` every 1 second

Thread-safe updates via `job_registry_lock` prevent race conditions.

## Frontend Workflow

### Modern Continuous Experience

The DevApp provides a **map-first interface** where users see their GPX track immediately upon upload, with settings available in a collapsible side panel.

### 1. **Idle Stage** (Initial load)
   - Load config via `/api/config` → populate defaults and presets
   - Display empty interactive map ready for GPX upload
   - Settings sheet collapsed on mobile, expanded on desktop

### 2. **Uploaded Stage** (GPX loaded)
   - User drags/drops GPX file or clicks to browse
   - **Instant client-side parsing** using browser DOMParser
   - GPX track appears immediately on map (blue line)
   - Start (green) and stop (red) markers added
   - Map auto-centers to track bounds
   - User adjusts settings:
     - Project name
     - Search radius (km)
     - Select presets from category-organized modal
     - Add custom filters via filter builder
     - Remove individual filters or entire presets
   - Click "Generate Results" button

### 3. **Processing Stage** (Async job running)
   - POST to `/api/process` → get job_id
   - Real-time updates via WebSocket (fallback to polling)
   - Progress bar updates smoothly (0-100%)
   - Status messages show pipeline steps
   - **POI markers appear live** on map as results arrive
   - Color-coded by filter rank (1st=red, 2nd=orange, etc.)
   - Settings sheet auto-closes on mobile after start

### 4. **Completed Stage** (Job finished)
   - All POI markers displayed with tooltips
   - Click markers for detailed popups:
     - Name, distance from start, distance from track
     - Website, phone, opening hours
     - OSM tags
   - Success message with POI count & track length
   - Download buttons for Excel and Folium HTML map
   - "Reset" button to clear and start new search
   - Map remains interactive (zoom, pan, layer switching)

### 5. **Error Stage** (Job failed)
   - Error message displayed prominently
   - Map and uploaded track remain visible
   - "Reset" button to clear and try again
   - User can adjust settings without re-uploading

## Running Locally

### Option 1: Local Dev (npm + Flask side-by-side)

**Terminal 1 - Backend:**
```bash
cd /home/rik/AlongGPX
python3 backend/app.py
```
Flask listens on http://localhost:5000

**Terminal 2 - Frontend:**
```bash
cd /home/rik/AlongGPX/web
npm install
npm run dev
```
Vite listens on http://localhost:3000
Proxies `/api/*` to http://localhost:5000

### Option 2: Docker Compose (Production-like)

**Development with hot reload:**
```bash
cd /home/rik/AlongGPX/docker
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

**Production build:**
```bash
cd /home/rik/AlongGPX/docker
docker-compose up
```
- Frontend serves static build: http://localhost:3000
- Backend API: http://localhost:5000

## Styling & Design System

### CSS Variables (in `src/index.css`)
- **Colors**: primary, success, error, warning, background tiers, text tiers
- **Spacing**: xs (0.25rem) through 2xl (3rem)
- **Radii**: sm, md, lg
- **Shadows**: light shadow, large shadow
- **Typography**: font family, sizes sm-2xl

### Component Philosophy
- Minimal, functional design (no heavy UI libraries)
- Accessibility-first (proper semantic HTML, focus states)
- Mobile-responsive (CSS Grid + media queries)
- Smooth animations for state transitions
- Consistent spacing & typography via CSS vars

## Adding New Features

### Adding a Preset
1. Edit `presets.yaml` with new include/exclude filters
2. Restart backend or reload page → dropdown auto-populates

### Adding a Filter Type
1. Update `/api/config` response in `backend/app.py`
2. Add input field in `SettingsForm.tsx`
3. Pass via `/api/process` form data

### Custom Map Styling
1. Edit `core/folium_map.py`: marker colors, zoom, track line style
2. Redeploy

## Troubleshooting

### Frontend can't connect to API
- Check if Flask is running on port 5000
- Check browser DevTools Network tab for CORS errors
- In dev mode: Vite proxy in `vite.config.ts` should forward `/api` calls

### Docker networking issues
- Use service name (`app` instead of `localhost:5000`) in docker-compose
- Check `docker-compose logs -f app` for backend errors
- Ensure both services are in same network (default: yes)

### Job stuck in "processing"
- Check Flask logs: `docker-compose logs -f app`
- Long-running Overpass queries or dense regions slow things down
- Increase `batch_km` in `config/config.yaml` to reduce API calls

## Future Enhancements

- [ ] Real-time activity logs (WebSocket instead of polling)
- [ ] Job history & re-run capability
- [ ] Map preview before download (embed Folium viewer)
- [ ] User authentication & project management
- [ ] Batch processing (multiple GPX files)
- [ ] Advanced filter builder UI
- [ ] Dark mode toggle

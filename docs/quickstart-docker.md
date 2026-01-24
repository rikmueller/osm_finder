# Quickstart (Docker)

Run AlongGPX as a web API with Docker and Docker Compose in ~2 minutes.

## Prerequisites
- Docker ≥ 20.10
- Docker Compose ≥ 1.29

## 1) Start the Container
```bash
cd docker
docker-compose up -d
```

## 2) Verify Health
```bash
curl http://localhost:5000/health
# {"status": "healthy", "service": "AlongGPX"}
```

## 3) Process a GPX File
```bash
curl -F "file=@../data/input/track.gpx" \
     -F "project_name=MyTrip" \
     -F "radius_km=5" \
     http://localhost:5000/api/process
```

Repeatable parameters (multiple filters):
```bash
curl -F "file=@../data/input/track.gpx" \
     -F "project_name=MyTrip" \
     -F "include=tourism=camp_site" \
     -F "include=amenity=drinking_water" \
     -F "exclude=tents=no" \
     http://localhost:5000/api/process
```

Example response:
```json
{
  "success": true,
  "excel_file": "MyTrip_20260124_120000.xlsx",
  "html_file": "MyTrip_20260124_120000.html",
  "excel_path": "/app/data/output/MyTrip_20260124_120000.xlsx",
  "html_path": "/app/data/output/MyTrip_20260124_120000.html",
  "rows_count": 42,
  "track_length_km": 125.5
}
```

Results are saved to `../data/output/`.

## Configuration

By default, the container uses `../config.yaml` (auto-mounted from repo root). For most setups, no extra configuration is required.

- Precedence: Web API form parameters > environment variables (optional) > `config.yaml` defaults
- Volume mounts: `../data/input` (read-only), `../data/output` (read-write)

Optional environment overrides:

Method A: `.env` file
```bash
# docker/.env
ALONGGPX_RADIUS_KM=8
ALONGGPX_BATCH_KM=60
ALONGGPX_TIMEZONE=Europe/Berlin
```

Method B: `docker-compose.yml`
```yaml
services:
  alonggpx:
    environment:
      - ALONGGPX_RADIUS_KM=8
      - ALONGGPX_BATCH_KM=60
```

### Config Reference

When form parameters are provided in `/api/process`, `config.yaml:search.include/exclude` are ignored (request takes precedence).

| config.yaml Key | Env Variable | Web API Parameter | Purpose |
|------------|--------------|-------------------|---------|
| `project.name` | `ALONGGPX_PROJECT_NAME` | `project_name` | Output filename prefix and project identifier |
| `project.output_path` | `ALONGGPX_OUTPUT_PATH` | — | Directory for Excel and HTML outputs |
| `project.timezone` | `ALONGGPX_TIMEZONE` | — | Timezone used for timestamps in output filenames |
| `input.gpx_file` | `ALONGGPX_GPX_FILE` | `file` (upload) | GPX file to analyze (multipart upload) |
| `search.radius_km` | `ALONGGPX_RADIUS_KM` | `radius_km` | Search radius around the track (km) |
| `search.step_km` | `ALONGGPX_STEP_KM` | `step_km` | Spacing between Overpass query points (km); defaults to 60% of radius if null |
| `search.include` | — | `include` (repeatable) | OSM include filters `key=value` to find POIs |
| `search.exclude` | — | `exclude` (repeatable) | OSM exclude filters `key=value` to remove POIs |
| Presets (from `presets.yaml`) | — | `preset` (repeatable) | Load predefined include/exclude profiles |
| `map.zoom_start` | `ALONGGPX_MAP_ZOOM_START` | — | Initial Folium map zoom level |
| `map.track_color` | — | — | Color of the track polyline on the map |
| `map.marker_color_palette` | — | — | Marker colors assigned by filter rank |
| `map.default_marker_color` | — | — | Fallback marker color when no matching filter |
| `overpass.batch_km` | `ALONGGPX_BATCH_KM` | — | Approx. km of track per Overpass API call (batching) |
| `overpass.retries` | `ALONGGPX_OVERPASS_RETRIES` | — | Retry attempts for failed Overpass requests |
| `overpass.servers` | — | — | List of Overpass API endpoints used for redundancy |
| `presets_file` | — | — | Path to the presets file used by `preset` |

## Troubleshooting
- Wait 10s after `up -d` (health checks)
- Ensure GPX exists in `../data/input/`
- If port 5000 is used: change to `ports: ["5001:5000"]`
- Overpass timeouts: increase `ALONGGPX_BATCH_KM` or try later
- No results: verify filter syntax (`key=value`) or test at https://overpass-turbo.eu/

## Viewing Logs
```bash
# Real-time logs
docker-compose logs -f

# Last 50 lines
docker-compose logs --tail=50

# With timestamps
docker-compose logs --timestamps
```

## Production Deployment
```dockerfile
# Dockerfile snippet: use Gunicorn in production
RUN pip install gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "docker.app:app"]
```
Rebuild:
```bash
docker-compose up -d --build
```

Reverse proxy (Nginx example):
```nginx
upstream alonggpx {
    server localhost:5000;
}

server {
    listen 443 ssl;
    server_name gpx.example.com;
    ssl_certificate /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;

    location / {
        proxy_pass http://alonggpx;
        proxy_set_header Host $host;
        client_max_body_size 50M;
    }
}
```

## Architecture Notes
- Multi-stage image, smaller production layer
- Non-root user; input mount is read-only
- Health checks via `/health`
- Volume mounts: `../data/input:ro`, `../data/output:rw`

## Next Steps
- Adjust defaults in `config.yaml`
- Explore or add presets in `presets.yaml`
- For deeper API details, see `docs/DOCKER.md`

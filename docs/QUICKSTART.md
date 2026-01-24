# AlongGPX: Quick Start Guide

Get up and running with the CLI or Dockerized web API using the new `data/` layout.

## Option 1: Run Locally (CLI)
```bash
# From repo root
pip install -r requirements-base.txt

# Run with config.yaml defaults
python3 cli/main.py

# Override inputs/filters
python3 cli/main.py --gpx-file ./data/input/track.gpx --radius-km 10 --project-name MyTrip
```

## Option 2: Run as Docker Web API
```bash
cd docker
docker-compose up -d

# Health check
curl http://localhost:5000/health

# Process a GPX file mounted from ../data/input
curl -F "file=@../data/input/track.gpx" \
     -F "project_name=MyTrip" \
     -F "radius_km=5" \
     http://localhost:5000/api/process
```

## File Structure

```
AlongGPX/
├── cli/                    # CLI entry + .env.example
├── core/                   # Shared pipeline modules
├── data/
│   ├── input/              # GPX files (default)
│   └── output/             # Generated Excel/HTML
├── docker/                 # Dockerized web API
│   ├── app.py
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── requirements-web.txt
│   └── .env.example
├── docs/                   # Guides (this file, DOCKER.md, IMPLEMENTATION.md)
├── config.yaml             # Default config (uses data/ paths)
├── presets.yaml            # Filter presets
├── requirements-base.txt   # CLI dependencies
└── README.md
```

## Testing

```bash
# 1. CLI run with explicit GPX
python3 cli/main.py --gpx-file ./data/input/track.gpx --radius-km 5

# 2. Web API health
cd docker && docker-compose up -d
curl http://localhost:5000/health

# 3. Web API upload
curl -F "file=@../data/input/track.gpx" \
     -F "project_name=TestRun" \
     http://localhost:5000/api/process

# 4. Logs
docker-compose logs -f
```

## Configuration Priority (High → Low)
- Web API form parameters
- Environment variables (`ALONGGPX_*`)
- config.yaml defaults (uses `./data/input/track.gpx` and `./data/output/`)

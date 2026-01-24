# Project Reorganization Summary

## Changes Made
# Project Reorganization Summary

## Changes Made

The AlongGPX project has been reorganized to separate CLI and web application concerns while keeping shared code modular.

### New Directory Structure

```
AlongGPX/
├── cli/                    # Command-line interface
│   ├── main.py            # CLI entry point (moved from root)
│   └── .env.example       # CLI-specific environment template
├── docker/                 # Docker/Web application
│   ├── app.py             # Flask REST API (renamed from web.py)
│   ├── Dockerfile         # Docker build (moved from root)
│   ├── docker-compose.yml # Container orchestration (moved from root)
│   ├── requirements-web.txt # Web dependencies (moved from root)
│   └── .env.example       # Web-specific environment template
├── core/                   # Shared pipeline modules (unchanged)
│   ├── cli.py
│   ├── config.py
│   ├── presets.py
│   ├── gpx_processing.py
│   ├── overpass.py
│   ├── filtering.py
│   ├── export.py
│   └── folium_map.py
├── docs/                   # Documentation (new)
│   ├── DOCKER.md          # Docker deployment guide (moved)
│   ├── QUICKSTART.md      # Quick start guide (moved)
│   └── IMPLEMENTATION.md  # Implementation details (moved)
├── data/
│   ├── input/                  # GPX files
│   └── output/                 # Generated results
├── config.yaml            # Shared configuration
├── presets.yaml           # Filter presets
├── requirements-base.txt  # Core dependencies (CLI)
└── README.md              # Updated with new structure
```

### Files Moved

**From root to cli/:**
- `main.py` → `cli/main.py` (updated imports for parent directory)
- `.env.example` → `cli/.env.example` (CLI-specific variables)

**From root to docker/:**
- `web.py` → `docker/app.py` (updated imports for parent directory)
- `Dockerfile` → `docker/Dockerfile` (updated paths for context)
- `docker-compose.yml` → `docker/docker-compose.yml` (updated context path)
- `requirements-web.txt` → `docker/requirements-web.txt` (updated path)
- New `docker/.env.example` (web-specific variables)

**From root to docs/:**
- `DOCKER.md` → `docs/DOCKER.md`
- `QUICKSTART.md` → `docs/QUICKSTART.md`
- `IMPLEMENTATION.md` → `docs/IMPLEMENTATION.md`

**Files Removed:**
- Old `main.py`, `web.py`, `Dockerfile`, `docker-compose.yml`, `requirements-web.txt` from root

### Key Changes

1. **Import Updates:**
   - Both CLI and web app now use `sys.path.insert(0, ...)` to import from parent directory
   - Web app imports pipeline from `cli.main` instead of `main`
   - Config paths adjusted to load from parent directory

2. **Docker Configuration:**
   - Dockerfile context changed to parent directory (`context: ..`)
   - Volume mounts updated to reference parent paths (`../data/input`, `../data/output`)
   - Web requirements now reference parent directory (`-r ../requirements-base.txt`)

3. **Documentation:**
   - README.md updated with new structure diagram
   - All command examples updated to use `python3 cli/main.py`
   - Added links to docs/ folder documentation

## How to Use

### CLI Mode (Local)
```bash
# From project root
python3 cli/main.py --gpx-file ./data/input/track.gpx

# Or with venv
venv2/bin/python3 cli/main.py --preset camp_basic
```

### Web API Mode (Docker)
```bash
# From docker/ directory
cd docker
docker-compose up -d

# Or from project root
cd docker && docker-compose up -d
```

### Environment Configuration

**CLI:** Copy `cli/.env.example` to `cli/.env` and customize
**Web:** Copy `docker/.env.example` to `docker/.env` and customize

## Benefits

1. **Clear Separation:** CLI and web concerns are isolated
2. **Shared Core:** Pipeline logic remains DRY in `core/`
3. **Better Organization:** Documentation, deployment files grouped logically
4. **Scalability:** Easy to add new entrypoints (e.g., `api/` folder for different API versions)
4. **Deployment:** Web stack self-contained in `docker/` folder

## Migration Notes

- All existing functionality preserved
- No changes to `core/` modules required
- Config files remain in root for shared access
- Both CLI and web work independently

## Testing

✅ CLI help works: `python3 cli/main.py --help` (with venv activated)
✅ Directory structure verified
✅ All files moved successfully
✅ Documentation updated

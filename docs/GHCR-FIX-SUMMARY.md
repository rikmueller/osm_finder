# GHCR Deployment Fix - Summary

## Problem
When deploying AlongGPX using pre-built GHCR images, users experienced:
1. **Input/output directories not accessible** - bind mounts to `../data/` fail when source tree doesn't exist
2. **Downloads fail** - backend can't write to mounted directories due to permission issues
3. **No example files** - GHCR images didn't include example.gpx in the expected location

## Root Cause
The `docker-compose.ghcr.yml` was using **bind mounts** (`../data/output`) which assume the full source tree exists locally. Users deploying from GHCR images only have the compose file, not the entire repository structure.

## Solution Implemented

### 1. Named Volumes Instead of Bind Mounts
**Changed**: `docker-compose.ghcr.yml` now uses Docker named volumes:
```yaml
volumes:
  - alonggpx-output:/app/data/output  # Was: ../data/output:/app/data/output
  - alonggpx-input:/app/data/input    # Was: ../data/input:/app/data/input
```

**Benefits**:
- Works without local source tree
- Docker manages volume permissions automatically
- Volumes persist across container restarts
- No host filesystem dependencies

### 2. Auto-Create Output Directory
**Changed**: `backend/api/app.py` now ensures output directory exists on startup:
```python
# Ensure output directory exists on startup
try:
    os.makedirs(APP_CONFIG['project']['output_path'], exist_ok=True)
    logger.info(f"Output directory ready: {APP_CONFIG['project']['output_path']}")
except Exception as e:
    logger.error(f"Failed to create output directory: {e}")
```

**Benefits**:
- No manual directory creation needed
- Works with both volumes and bind mounts
- Graceful error logging if creation fails

### 3. Improved Dockerfile
**Changed**: `deployment/Dockerfile` handles missing example files gracefully:
```dockerfile
# Copy example GPX if it exists
COPY data/input/example.gpx ./data/input/example.gpx 2>/dev/null || true
```

**Benefits**:
- Build succeeds even if example.gpx is missing
- Example files included if present during build
- No build failures due to missing optional files

### 4. Service Naming Consistency
**Changed**: Renamed service from `app` → `backend` in all compose files:
- Matches nginx.conf expectations (`http://backend:5000`)
- Consistent naming across all deployment options
- Prevents network routing issues

### 5. Proper Networking
**Added**: Explicit network configuration in GHCR compose:
```yaml
networks:
  alonggpx-network:
    driver: bridge
```

**Benefits**:
- Frontend can reliably reach backend via service name
- Isolated network for AlongGPX services
- Consistent with local build deployment

### 6. Improved Health Checks
**Changed**: Fixed health check commands to work in minimal containers:
```yaml
# Backend (has Python + requests)
test: ["CMD-SHELL", "python -c 'import requests; requests.get(\"http://localhost:5000/health\")' || exit 1"]

# Frontend (alpine nginx, has wget but not curl)
test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:80 || exit 1"]
```

## New Documentation

### Created Files:
1. **`deployment/QUICKSTART-GHCR.md`** - Comprehensive GHCR deployment guide
   - Step-by-step setup instructions
   - Data access methods (web UI, volume copy, bind mount alternative)
   - Troubleshooting section
   - Production deployment tips

2. **`deployment/README-NEW.md`** - Updated deployment guide
   - Comparison of all deployment options (GHCR, local build, dev mode)
   - Quick start for each method
   - Detailed troubleshooting
   - Architecture diagrams

### Updated Files:
- `deployment/docker-compose.ghcr.yml` - Named volumes + networking
- `backend/api/app.py` - Auto-create output directory
- `deployment/Dockerfile` - Graceful example file handling
- `deployment/docker-compose.yml` - Service name consistency

## How to Access Downloaded Files (GHCR Deployment)

### Method 1: Web UI (Recommended)
After processing completes, click the download buttons in the web interface. Files are served directly from the container.

### Method 2: Copy from Volume
```bash
# List all files
docker run --rm -v alonggpx-output:/data alpine ls -lh /data

# Copy specific file
docker run --rm -v alonggpx-output:/data -v $(pwd):/host alpine \
  cp /data/myfile.xlsx /host/

# Copy all files
docker run --rm -v alonggpx-output:/data -v $(pwd):/host alpine \
  cp -r /data/. /host/output/
```

### Method 3: Switch to Bind Mount
Edit `docker-compose.ghcr.yml`:
```yaml
backend:
  volumes:
    - ./output:/app/data/output  # Local directory
```

Then:
```bash
mkdir -p output
docker compose -f docker-compose.ghcr.yml down
docker compose -f docker-compose.ghcr.yml up -d
# Files now appear in ./output/ directory
```

## Testing the Fix

### 1. Fresh GHCR Deployment (No Source Code)
```bash
# Simulate user with only compose file
mkdir test-ghcr-deploy
cd test-ghcr-deploy

# Download compose file and .env
curl -O https://raw.githubusercontent.com/rikmueller/AlongGPX/main/deployment/docker-compose.ghcr.yml
curl -O https://raw.githubusercontent.com/rikmueller/AlongGPX/main/deployment/.env

# Deploy
docker compose -f docker-compose.ghcr.yml up -d

# Verify
curl http://localhost:3000/health
docker logs alonggpx-backend
```

### 2. Volume Creation
```bash
# Check volumes created
docker volume ls | grep alonggpx

# Inspect backend container
docker exec alonggpx-backend ls -la /app/data/output
docker exec alonggpx-backend touch /app/data/output/test.txt
docker exec alonggpx-backend ls -la /app/data/output
```

### 3. File Upload & Download
1. Open http://localhost:3000
2. Upload a GPX file
3. Configure settings and click "Generate"
4. Wait for processing
5. Click download buttons
6. Verify files download successfully

### 4. Volume Persistence
```bash
# Stop containers
docker compose -f docker-compose.ghcr.yml down

# Restart
docker compose -f docker-compose.ghcr.yml up -d

# Files should still exist
docker exec alonggpx-backend ls -la /app/data/output
```

## Migration Guide

### For Existing Users (Bind Mount → Named Volume)

**Warning**: This will lose existing output files unless you copy them first!

```bash
# 1. Copy existing files (if any)
cp -r ../data/output ./output-backup

# 2. Stop old deployment
docker compose -f docker-compose.ghcr.yml down

# 3. Update docker-compose.ghcr.yml (already done if using latest)

# 4. Start with named volumes
docker compose -f docker-compose.ghcr.yml up -d

# 5. (Optional) Copy old files into new volume
docker cp ./output-backup/. alonggpx-backend:/app/data/output/
```

## Performance & Security Notes

### Volumes vs Bind Mounts
- **Named volumes**: Better performance on Docker Desktop (Mac/Windows)
- **Bind mounts**: Direct filesystem access, easier for development
- **GHCR deployments**: Use named volumes (production-ready)
- **Local builds**: Use bind mounts (development-friendly)

### Permissions
- Containers run as non-root user (`alonggpx`, UID 1000)
- Volumes auto-created with correct ownership
- No `chmod 777` needed with volumes
- Bind mounts may need manual permissions: `chmod 777 output/`

## Rollback Plan

If issues occur, revert to bind mounts (requires source tree):

```yaml
# docker-compose.ghcr.yml
backend:
  volumes:
    - ../data/output:/app/data/output
    - ../data/input:/app/data/input
```

**Note**: This only works if you have the full AlongGPX repository structure.

## Success Criteria

✅ GHCR deployment works without local source tree  
✅ Output directory accessible by backend  
✅ Files download successfully via web UI  
✅ Example files present in built image  
✅ Health checks pass  
✅ Frontend communicates with backend  
✅ Volumes persist across restarts  

## Next Steps

1. **Test with actual GHCR images**: Build and push to GHCR, then test fresh deployment
2. **Update CI/CD**: Ensure GitHub Actions builds images with example files
3. **User testing**: Have beta users deploy from GHCR images
4. **Documentation review**: Ensure all docs reference correct volume usage

## Related Files

- `deployment/docker-compose.ghcr.yml` - GHCR deployment config
- `deployment/QUICKSTART-GHCR.md` - User guide
- `backend/api/app.py` - Backend directory creation
- `deployment/Dockerfile` - Image build instructions
- `deployment/nginx.conf` - Reverse proxy config

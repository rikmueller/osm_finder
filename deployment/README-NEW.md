# AlongGPX Deployment Guide

This directory contains Docker deployment configurations for AlongGPX. Choose the option that best fits your needs.

## Quick Start

### Option 1: Pre-built Images (GHCR) ⭐ Recommended

**Best for**: Production deployments, users without source code

**What you need**: Just two files - `docker-compose.ghcr.yml` and `.env`

```bash
# Download config files (or use from repo)
curl -O https://raw.githubusercontent.com/rikmueller/AlongGPX/main/deployment/docker-compose.ghcr.yml
curl -O https://raw.githubusercontent.com/rikmueller/AlongGPX/main/deployment/.env

# Start services
docker compose -f docker-compose.ghcr.yml up -d

# Access at http://localhost:3000
```

**See detailed guide**: [QUICKSTART-GHCR.md](QUICKSTART-GHCR.md)

---

### Option 2: Local Build

**Best for**: Developers modifying source code

```bash
cd deployment
docker compose up --build -d
```

---

### Option 3: Development Mode

**Best for**: Frontend developers needing hot reload

```bash
cd deployment
docker compose -f docker-compose.dev.yml up
```

---

## Deployment Comparison

| Feature | GHCR | Local Build | Dev Mode |
|---------|------|-------------|----------|
| **Build time** | None (pull only) | ~5 min | ~5 min |
| **Use case** | Production | Customization | Frontend dev |
| **Source code needed** | ❌ No | ✅ Yes | ✅ Yes |
| **Hot reload** | ❌ No | ❌ No | ✅ Yes |
| **Data access** | Via web UI | Direct files | Direct files |
| **Recommended for** | Deployment | Development | UI work |

---

## Configuration

### Environment Variables (.env)

All deployment options use the same `.env` file:

```env
# Project defaults
ALONGGPX_PROJECT_NAME=MyProject
ALONGGPX_TIMEZONE=UTC

# Search parameters
ALONGGPX_RADIUS_KM=5

# Presets (semicolon-separated)
ALONGGPX_PRESETS=camp_sites_tent;drinking_water

# Custom filters
ALONGGPX_SEARCH_INCLUDE=tourism=camp_site
ALONGGPX_SEARCH_EXCLUDE=tents=no
```

---

## Data Storage

### GHCR Deployment (Named Volumes)

- **Volumes**: `alonggpx-output`, `alonggpx-input`
- **Access files**: Use web UI download buttons
- **Alternative**: Copy from volume (see troubleshooting)

### Local Build (Bind Mounts)

- **Location**: `../data/output/` and `../data/input/`
- **Access files**: Direct filesystem access

---

## Troubleshooting

### Downloads Fail in GHCR Deployment

**Problem**: Backend can't access output directory

**Check**:
```bash
# Verify volume exists
docker volume ls | grep alonggpx

# Check backend logs
docker logs alonggpx-backend

# Verify permissions
docker exec alonggpx-backend ls -la /app/data/output
```

**Fix**:
```bash
# Recreate volumes with correct permissions
docker compose -f docker-compose.ghcr.yml down -v
docker compose -f docker-compose.ghcr.yml up -d
```

### No Example Files

**GHCR images include example.gpx if present during build.**

To add your own GPX:
```bash
# Option 1: Upload via web UI (recommended)

# Option 2: Copy into container
docker cp mytrack.gpx alonggpx-backend:/app/data/input/
```

### Can't Access Generated Files (GHCR)

**Option 1**: Use web UI download buttons ⭐ Recommended

**Option 2**: Copy from volume
```bash
# List files
docker run --rm -v alonggpx-output:/data alpine ls -lh /data

# Copy specific file
docker run --rm -v alonggpx-output:/data -v $(pwd):/host alpine \
  cp /data/myfile.xlsx /host/

# Copy all files
docker run --rm -v alonggpx-output:/data -v $(pwd):/host alpine \
  cp -r /data/. /host/output/
```

**Option 3**: Use bind mount instead
```yaml
# Edit docker-compose.ghcr.yml backend service:
volumes:
  - ./output:/app/data/output  # Changed from alonggpx-output
```

### Frontend Can't Connect to Backend

**Check network**:
```bash
docker network ls
docker network inspect deployment_alonggpx-network
```

**Test backend from frontend**:
```bash
docker exec alonggpx-frontend wget -O- http://backend:5000/health
```

**Check nginx config**:
```bash
docker exec alonggpx-frontend cat /etc/nginx/conf.d/default.conf
```

### Permission Errors

Containers run as non-root user. Volumes auto-created with correct permissions.

**Local build fix**:
```bash
chmod 777 ../data/output
```

**GHCR fix**:
```bash
docker compose -f docker-compose.ghcr.yml down -v
docker compose -f docker-compose.ghcr.yml up -d
```

---

## Updating

### Update GHCR Images
```bash
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
```

### Rebuild Local
```bash
docker compose down
docker compose up --build -d
```

---

## Cleanup

### Stop containers (keep data)
```bash
docker compose -f docker-compose.ghcr.yml down
```

### Remove everything including data
```bash
docker compose -f docker-compose.ghcr.yml down -v
```

### Remove images
```bash
docker rmi ghcr.io/rikmueller/alonggpx-backend:latest
docker rmi ghcr.io/rikmueller/alonggpx-frontend:latest
```

---

## Architecture

```
┌─────────────────────┐
│   User Browser      │
│   localhost:3000    │
└──────────┬──────────┘
           │
           ▼
┌───────────────────────┐
│  Nginx Container      │
│  - Frontend (React)   │
│  - Reverse Proxy      │
│  Port 80 → 3000       │
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐      ┌──────────────────┐
│  Backend Container    │      │  Docker Volumes  │
│  - Flask API          │◄─────┤  - alonggpx-     │
│  - GPX Processing     │      │    output        │
│  Port 5000 (internal) │      │  - alonggpx-     │
└───────────────────────┘      │    input         │
                               └──────────────────┘
```

---

## Files in This Directory

- **`docker-compose.ghcr.yml`** - Pre-built images (production)
- **`docker-compose.yml`** - Local build from source
- **`docker-compose.dev.yml`** - Development with hot reload
- **`.env`** - Configuration (shared by all)
- **`Dockerfile`** - Backend build instructions
- **`Dockerfile.nginx`** - Frontend + nginx build
- **`nginx.conf`** - Nginx reverse proxy config
- **`QUICKSTART-GHCR.md`** - Detailed GHCR deployment guide

---

## Migration Examples

### From Local Build to GHCR
```bash
docker compose down
docker compose -f docker-compose.ghcr.yml up -d
```

### From GHCR to Local Build
```bash
docker compose -f docker-compose.ghcr.yml down
docker compose up --build -d
```

---

## Health Checks

```bash
# Check service status
docker compose -f docker-compose.ghcr.yml ps

# Backend health
curl http://localhost:3000/health

# Check logs
docker logs alonggpx-backend
docker logs alonggpx-frontend
```

---

## Support

- **GHCR Deployment Guide**: [QUICKSTART-GHCR.md](QUICKSTART-GHCR.md)
- **Local Development**: [../docs/quickstart-dev.md](../docs/quickstart-dev.md)
- **CLI Usage**: [../docs/quickstart-cli.md](../docs/quickstart-cli.md)
- **Issues**: https://github.com/rikmueller/AlongGPX/issues

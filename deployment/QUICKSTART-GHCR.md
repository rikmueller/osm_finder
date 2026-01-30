# Quick Start: GHCR Pre-Built Images

Deploy AlongGPX using pre-built Docker images from GitHub Container Registry. No source code required!

## Prerequisites

- Docker and Docker Compose installed
- Internet connection to pull images from GHCR

## Quick Deployment

### 1. Create deployment directory

```bash
mkdir -p alonggpx-deploy
cd alonggpx-deploy
```

### 2. Download configuration files

Download these two files from the repository:

- `docker-compose.ghcr.yml` - Docker Compose configuration
- `.env` - Environment variables (optional, uses defaults if not present)

```bash
# Download docker-compose file
curl -O https://raw.githubusercontent.com/rikmueller/AlongGPX/main/deployment/docker-compose.ghcr.yml

# Download .env template (optional)
curl -O https://raw.githubusercontent.com/rikmueller/AlongGPX/main/deployment/.env
```

### 3. Configure (Optional)

Edit `.env` to customize settings:

```bash
# Example customization
ALONGGPX_PROJECT_NAME=MyBikeTrip
ALONGGPX_RADIUS_KM=10
ALONGGPX_TIMEZONE=Europe/Berlin
```

### 4. Start services

```bash
docker compose -f docker-compose.ghcr.yml up -d
```

### 5. Access the application

Open your browser: **http://localhost:3000**

## Data Persistence

The deployment uses Docker named volumes for data persistence:

- `alonggpx-output` - Generated Excel and HTML files
- `alonggpx-input` - Optional example GPX files

### Accessing generated files

Files are stored inside the Docker volume. To access them:

**Option 1: Download via web UI** (Recommended)
- Use the download buttons in the web interface after processing completes

**Option 2: Copy from volume**
```bash
# List files in output volume
docker run --rm -v alonggpx-output:/data alpine ls -lh /data

# Copy a specific file to current directory
docker run --rm -v alonggpx-output:/data -v $(pwd):/host alpine cp /data/YOUR_FILE.xlsx /host/
```

**Option 3: Use bind mount** (requires editing docker-compose.ghcr.yml)
```yaml
# Replace this line in backend service:
volumes:
  - alonggpx-output:/app/data/output
# With:
volumes:
  - ./output:/app/data/output
```

Then create the output directory and restart:
```bash
mkdir -p output
docker compose -f docker-compose.ghcr.yml down
docker compose -f docker-compose.ghcr.yml up -d
```

## Updating to Latest Version

```bash
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
```

## Troubleshooting

### Check logs
```bash
# Backend logs
docker logs -f alonggpx-backend

# Frontend logs
docker logs -f alonggpx-frontend
```

### Check health status
```bash
docker compose -f docker-compose.ghcr.yml ps
```

### Permission issues
If you encounter permission errors with volumes, the containers automatically create directories with correct permissions. If issues persist:

```bash
# Reset volumes
docker compose -f docker-compose.ghcr.yml down -v
docker compose -f docker-compose.ghcr.yml up -d
```

### Cannot access downloads

If downloads fail, check backend logs:
```bash
docker logs alonggpx-backend | grep -i error
```

Common causes:
- Volume mount issues → Use named volumes (default in ghcr config)
- Permission errors → Containers create directories automatically with correct permissions
- Insufficient disk space → Check with `df -h`

## Advanced Configuration

### Custom Presets

The GHCR image includes default presets from the repository. To use custom presets:

1. Download the default presets file:
```bash
curl -O https://raw.githubusercontent.com/rikmueller/AlongGPX/main/data/presets.yaml
```

2. Edit `presets.yaml` with your custom filters

3. Uncomment the presets mount in `docker-compose.ghcr.yml`:
```yaml
backend:
  volumes:
    - alonggpx-output:/app/data/output
    - alonggpx-input:/app/data/input
    - ./presets.yaml:/app/data/presets.yaml:ro  # Add this line
```

4. Restart services:
```bash
docker compose -f docker-compose.ghcr.yml restart backend
```

Your custom presets will now appear in the web UI dropdown.

### Environment Variables

All available environment variables are documented in `.env` file. Key settings:

- `ALONGGPX_PROJECT_NAME` - Default project name
- `ALONGGPX_RADIUS_KM` - Search radius (default: 5)
- `ALONGGPX_TIMEZONE` - Timezone for timestamps
- `ALONGGPX_BATCH_KM` - Overpass batch size (default: 50)

### Production Deployment

For production use:

1. **Use a reverse proxy** (nginx, traefik) with HTTPS
2. **Set resource limits** in docker-compose
3. **Enable monitoring** and alerting
4. **Regular backups** of output volume

Example with resource limits:
```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 4G
```

## Cleanup

```bash
# Stop and remove containers
docker compose -f docker-compose.ghcr.yml down

# Remove containers and volumes (deletes all generated files!)
docker compose -f docker-compose.ghcr.yml down -v

# Remove images
docker rmi ghcr.io/rikmueller/alonggpx-backend:latest
docker rmi ghcr.io/rikmueller/alonggpx-frontend:latest
```

## Support

- Issues: https://github.com/rikmueller/AlongGPX/issues
- Documentation: https://github.com/rikmueller/AlongGPX/tree/main/docs

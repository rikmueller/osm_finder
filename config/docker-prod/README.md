# AlongGPX Docker Production Configuration

This directory contains configuration for **Docker production deployment** with pre-built images and Nginx reverse proxy.

## Quick Start

1. **Copy the example configuration:**
   ```bash
   cp config/docker-prod/.env.example config/docker-prod/.env
   ```

2. **Edit `config/docker-prod/.env`** with your preferences

3. **Configure SSL:** See SSL/HTTPS setup section below.

4. **Build and start services:**
   ```bash
   cd config/docker-prod
   docker compose up -d
   ```

5. **Access the application:**
   - HTTP: http://localhost (redirects to HTTPS if configured)
   - HTTPS: https://your-domain.example (if SSL enabled)


## SSL/HTTPS Setup

### Prerequisites
- SSL certificate file (`.cer`, `.crt`, or `.pem`)
- Private key file (`.key`)
- Both files on the host machine

### Configuration

1. **Create SSL directory and place your files:**
   ```bash
   sudo mkdir -p /etc/ssl/along-gpx
   sudo cp your-cert.cer /etc/ssl/along-gpx/
   sudo cp your-key.key /etc/ssl/along-gpx/
   sudo chmod 644 /etc/ssl/along-gpx/*
   ```

2. **Update `deployment/nginx.conf`:**
   - Change `server_name localhost;` to your domain (e.g., `server_name along-gpx.de www.along-gpx.de;`)
   - Update `ssl_certificate` and `ssl_certificate_key` paths to match your filenames

   Example configuration:
   ```nginx
   map $http_upgrade $connection_upgrade {
       default upgrade;
       '' close;
   }

   server {
       listen 80;
       server_name your-domain.example www.your-domain.example;
       return 301 https://$host$request_uri;
   }

   server {
       listen 443 ssl;
       server_name your-domain.example www.your-domain.example;

       ssl_certificate     /etc/ssl/along-gpx/your_ssl_certificate.cer;
       ssl_certificate_key /etc/ssl/along-gpx/your_private_key.key;

       location / {
           root /usr/share/nginx/html;
           index index.html index.htm;
           try_files $uri $uri/ /index.html;
       }

       location /socket.io/ {
           proxy_pass http://backend:5000/socket.io/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection $connection_upgrade;
           proxy_set_header Host $host;
           proxy_read_timeout 60s;
           proxy_send_timeout 60s;
       }

       location /api/ {
           proxy_pass http://backend:5000/api/;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }

       location /health {
           proxy_pass http://backend:5000/health;
           proxy_http_version 1.1;
       }
   }
   ```

3. **Restart services:**
   ```bash
   docker compose down
   docker compose up --build -d
   ```

4. **Access via HTTPS:**
   ```
   https://your-domain.example
   ```

HTTP traffic (port 80) automatically redirects to HTTPS.

**Notes:**
- Volume mount `/etc/ssl/along-gpx` must be on the `nginx` service
- Certificate and key must be readable (mode 644)
- Port 443 must be open on your host firewall
- For Let's Encrypt, mount `/etc/letsencrypt` instead


## Architecture

```
nginx:80/443 (frontend static files + reverse proxy)
    ↓
backend:5000 (Flask API for GPX processing)
```

## Services

### nginx (ports 80, 443)
- Serves built React frontend (static HTML/JS/CSS)
- Reverse proxies `/api/*` to Flask backend
- Reverse proxies `/socket.io/*` for real-time updates
- Port 80 redirects to HTTPS (if SSL configured)
- Port 443 handles HTTPS traffic (requires SSL certificates)

### backend (port 5000, internal)
- Flask API for GPX processing
- Processes uploaded GPX files
- Generates Excel and HTML outputs

## Volumes

Data is persisted in these host directories:
- `../../data/input` → `/app/data/input` (read-only)
- `../../data/output` → `/app/data/output` (read-write)
- `../../data/presets.yaml` → `/app/data/presets.yaml` (read-only)
- `/etc/ssl/along-gpx` → `/etc/ssl/along-gpx` (SSL certificates, read-only, optional)

## Configuration

### User Settings (in .env)
Simple settings exposed to users via `.env` file.

### Advanced Settings (in docker-compose.yml)
Hardcoded with sensible defaults:
- Overpass API servers and retry logic
- Background cleanup intervals
- Map colors and visualization
- File retention policies

**To customize advanced settings:** Edit `docker-compose.yml` environment section.

## Logs

View logs for debugging:
```bash
docker compose logs -f          # All services
docker compose logs -f backend  # Backend only
docker compose logs -f nginx    # Nginx only
```

## Updating

Pull latest images and restart:
```bash
docker compose pull
docker compose up -d
```

Rebuild from source:
```bash
docker compose up -d --build
```

## Data Management

### Cleanup Old Outputs
Results accumulate in `data/output/`. The backend automatically deletes files older than 10 days (configurable via `ALONGGPX_OUTPUT_RETENTION_DAYS` in docker-compose.yml).

Manual cleanup:
```bash
find ../../data/output -type f -mtime +30 -delete
```

## Troubleshooting

### Port 80/443 already in use
Change the published ports in `docker-compose.yml`:
```yaml
ports:
  - "8080:80"   # HTTP on port 8080
  - "8443:443"  # HTTPS on port 8443
```

### Backend processing fails
Check backend logs:
```bash
docker compose logs backend
```

### Cannot upload files
Check volume permissions:
```bash
ls -la ../../data/output
sudo chown -R 1000:1000 ../../data
```

### SSL certificate not found
Ensure the volume mount is on the `nginx` service (not `backend`) and files exist:
```bash
ls -la /etc/ssl/along-gpx/
docker exec alonggpx-nginx ls -la /etc/ssl/along-gpx/
```

## See Also

- [Main README](../../README.md) - Project overview
- [deployment/](../../deployment/) - Dockerfile details
- [docker-compose.yml](./docker-compose.yml) - Service configuration

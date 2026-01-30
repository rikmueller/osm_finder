# Multi-stage build for AlongGPX web app
FROM python:3.11-slim AS base

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgeos-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY backend/api/requirements.txt requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (from build context root)
COPY backend ./backend
COPY cli ./cli
COPY data/presets.yaml ./data/presets.yaml

# Create data directories with proper permissions
RUN mkdir -p /app/data/input /app/data/output && \
    chmod 777 /app/data/output && \
    chmod 777 /app/data/input

# Copy example GPX if it exists
COPY data/input/example.gpx ./data/input/example.gpx 2>/dev/null || true

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Install only runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgeos-c1v5 \
    && rm -rf /var/lib/apt/lists/*

# Copy from base stage
COPY --from=base /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=base /usr/local/bin /usr/local/bin
COPY --from=base /app .

# Create non-root user for security
RUN useradd -m -u 1000 alonggpx && chown -R alonggpx:alonggpx /app
USER alonggpx

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:5000/health')" || exit 1

# Expose port
EXPOSE 5000

# Run Flask app
CMD ["python", "backend/api/app.py"]

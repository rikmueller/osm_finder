# Multi-stage build for AlongGPX web app
FROM python:3.11-slim AS base

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgeos-dev \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements from build context (repo root)
COPY requirements-base.txt docker/requirements-web.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements-web.txt

# Copy application code (from build context root)
COPY core ./core
COPY cli ./cli
COPY docker ./docker
COPY config.yaml ./config.yaml
COPY presets.yaml ./presets.yaml

# Create data directories with proper permissions
RUN mkdir -p /app/data/input /app/data/output && chmod 777 /app/data/output

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Install only runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgeos-c1v5 \
    tzdata \
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
CMD ["python", "-m", "flask", "--app", "docker.app", "run", "--host", "0.0.0.0", "--port", "5000"]

#!/bin/bash
# Test GHCR deployment without source tree
# This simulates a user deploying AlongGPX using only pre-built images

set -e

echo "=========================================="
echo "AlongGPX GHCR Deployment Test"
echo "=========================================="
echo ""

# Create isolated test directory
TEST_DIR="test-ghcr-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "✓ Created test directory: $TEST_DIR"
echo ""

# Download required files
echo "Downloading configuration files..."
curl -sS -O https://raw.githubusercontent.com/rikmueller/AlongGPX/main/deployment/docker-compose.ghcr.yml
curl -sS -O https://raw.githubusercontent.com/rikmueller/AlongGPX/main/deployment/.env

echo "✓ Downloaded docker-compose.ghcr.yml"
echo "✓ Downloaded .env"
echo ""

# Show what we have
echo "Test directory contents:"
ls -lh
echo ""

# Pull images
echo "Pulling Docker images from GHCR..."
docker compose -f docker-compose.ghcr.yml pull

echo ""
echo "✓ Images pulled successfully"
echo ""

# Start services
echo "Starting services..."
docker compose -f docker-compose.ghcr.yml up -d

echo ""
echo "✓ Services started"
echo ""

# Wait for services to be ready
echo "Waiting for services to become healthy..."
sleep 10

# Check service status
echo ""
echo "Service Status:"
docker compose -f docker-compose.ghcr.yml ps

# Test backend health
echo ""
echo "Testing backend health endpoint..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✓ Backend health check passed"
else
    echo "✗ Backend health check failed"
    docker logs alonggpx-backend
    exit 1
fi

# Test frontend
echo ""
echo "Testing frontend..."
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✓ Frontend accessible"
else
    echo "✗ Frontend not accessible"
    docker logs alonggpx-frontend
    exit 1
fi

# Check volumes
echo ""
echo "Docker volumes created:"
docker volume ls | grep alonggpx || echo "(None found)"

# Check backend can write to output
echo ""
echo "Testing backend write access..."
docker exec alonggpx-backend touch /app/data/output/test-write.txt
if docker exec alonggpx-backend ls /app/data/output/test-write.txt > /dev/null 2>&1; then
    echo "✓ Backend can write to output directory"
    docker exec alonggpx-backend rm /app/data/output/test-write.txt
else
    echo "✗ Backend cannot write to output directory"
    exit 1
fi

# Check backend logs for errors
echo ""
echo "Checking backend logs for errors..."
ERROR_COUNT=$(docker logs alonggpx-backend 2>&1 | grep -i error | wc -l)
if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "⚠ Found $ERROR_COUNT error messages in backend logs:"
    docker logs alonggpx-backend 2>&1 | grep -i error | head -5
else
    echo "✓ No errors in backend logs"
fi

echo ""
echo "=========================================="
echo "✅ GHCR Deployment Test Complete"
echo "=========================================="
echo ""
echo "Services running at:"
echo "  Web UI: http://localhost:3000"
echo "  Backend: http://localhost:3000/api/"
echo "  Health: http://localhost:3000/health"
echo ""
echo "To stop services:"
echo "  cd $TEST_DIR"
echo "  docker compose -f docker-compose.ghcr.yml down"
echo ""
echo "To remove everything (including volumes):"
echo "  docker compose -f docker-compose.ghcr.yml down -v"
echo ""
echo "To view logs:"
echo "  docker logs -f alonggpx-backend"
echo "  docker logs -f alonggpx-frontend"
echo ""
echo "To copy files from output volume:"
echo "  docker run --rm -v alonggpx-output:/data -v \$(pwd):/host alpine cp -r /data/. /host/output/"
echo ""

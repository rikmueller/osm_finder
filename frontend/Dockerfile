# Multi-stage build for frontend
FROM node:20-alpine AS builder

WORKDIR /app/web

# Copy package files (context is parent directory)
COPY web/package.json web/package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source
COPY web/ .

# Build
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app/web

# Install serve to run the built app
RUN npm install -g serve

# Copy built app from builder
COPY --from=builder /app/web/dist ./dist

EXPOSE 3000

# Start server
CMD ["serve", "-s", "dist", "-l", "3000"]

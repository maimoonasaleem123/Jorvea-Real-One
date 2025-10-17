# Jorvea Video Backend - Dockerfile
# Node.js server with FFmpeg for HLS video conversion

FROM node:18-alpine

# Install FFmpeg and required dependencies
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++

# Create app directory
WORKDIR /app

# Copy package files from jorvea-backend directory
COPY jorvea-backend/package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code from jorvea-backend directory
COPY jorvea-backend/ .

# Create required directories
RUN mkdir -p uploads output temp

# Expose port (DigitalOcean uses 8080)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "server.js"]

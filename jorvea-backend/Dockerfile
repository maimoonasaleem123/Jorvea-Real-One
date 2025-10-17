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

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Create required directories
RUN mkdir -p uploads output temp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "server.js"]

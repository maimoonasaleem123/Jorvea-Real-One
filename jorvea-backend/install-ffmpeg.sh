#!/bin/bash
# Install FFmpeg on DigitalOcean App Platform

echo "📦 Installing FFmpeg..."

# For Ubuntu-based buildpack
if command -v apt-get &> /dev/null; then
    apt-get update
    apt-get install -y ffmpeg
fi

# Verify installation
if command -v ffmpeg &> /dev/null; then
    echo "✅ FFmpeg installed successfully"
    ffmpeg -version | head -n 1
else
    echo "❌ FFmpeg installation failed"
    exit 1
fi

if command -v ffprobe &> /dev/null; then
    echo "✅ FFprobe installed successfully"
    ffprobe -version | head -n 1
else
    echo "❌ FFprobe installation failed"
    exit 1
fi

echo "🎉 All dependencies installed!"

#!/bin/bash

# Jorvea Story System - Cloud Functions Deployment Script
# This script deploys Firebase Cloud Functions for automatic story deletion

echo "🚀 Deploying Jorvea Story System Cloud Functions..."

# Navigate to functions directory
cd functions

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Set Firebase config for DigitalOcean (replace with your actual values)
echo "⚙️ Setting up configuration..."

# Set DigitalOcean Spaces configuration
firebase functions:config:set digitalocean.endpoint="blr1.digitaloceanspaces.com"
firebase functions:config:set digitalocean.access_key_id="YOUR_DIGITALOCEAN_ACCESS_KEY"
firebase functions:config:set digitalocean.secret_access_key="YOUR_DIGITALOCEAN_SECRET_KEY"
firebase functions:config:set digitalocean.region="blr1"
firebase functions:config:set digitalocean.bucket="jorvea"

# Set cleanup secret for manual cleanup endpoint
firebase functions:config:set cleanup.secret="your-secret-key-here"

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Deploy functions
echo "☁️ Deploying to Firebase..."
firebase deploy --only functions

echo "✅ Deployment complete!"
echo ""
echo "📋 Deployed Functions:"
echo "  - deleteExpiredStories (scheduled every hour)"
echo "  - cleanupStoriesManual (HTTP endpoint for manual cleanup)"
echo "  - cleanupOrphanedMedia (scheduled daily)"
echo "  - storySystemHealth (HTTP endpoint for health check)"
echo ""
echo "⚠️  Don't forget to:"
echo "  1. Replace the DigitalOcean credentials with your actual values"
echo "  2. Update the cleanup secret with a secure random string"
echo "  3. Test the functions after deployment"
echo ""
echo "🔧 To update configuration:"
echo "  firebase functions:config:set digitalocean.access_key_id=\"YOUR_KEY\""
echo ""
echo "📊 To check health:"
echo "  curl https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/storySystemHealth"

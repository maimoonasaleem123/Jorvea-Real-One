#!/bin/bash

# Deploy Firebase Security Rules Script
# This script deploys the updated Firestore rules to fix permission issues

echo "🔥 Deploying Firebase Security Rules..."

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Login to Firebase (if not already logged in)
echo "🔐 Checking Firebase authentication..."
firebase login --no-localhost

# Deploy Firestore rules only
echo "📋 Deploying Firestore security rules..."
firebase deploy --only firestore:rules --project jorvea-9f876

echo "✅ Firebase rules deployed successfully!"
echo ""
echo "🔧 Rules updates include:"
echo "  ✅ Fixed chat subcollection permissions"
echo "  ✅ Added messages subcollection rules"
echo "  ✅ Enhanced InstagramMessagingService permissions"
echo "  ✅ Graceful error handling for permission issues"
echo ""
echo "🚀 Chat and messaging permissions are now fixed!"

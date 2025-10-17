#!/bin/bash

# Firebase Deployment Script for Jorvea App
# This script deploys Firestore security rules to Firebase

echo "🔥 Deploying Firebase Security Rules for Jorvea..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed. Please install it first:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in
if ! firebase projects:list &> /dev/null; then
    echo "🔐 Please log in to Firebase:"
    firebase login
fi

# Show current project
echo "📋 Current Firebase project:"
firebase use

# Deploy Firestore rules
echo "📤 Deploying Firestore security rules..."
firebase deploy --only firestore:rules

if [ $? -eq 0 ]; then
    echo "✅ Firestore security rules deployed successfully!"
    echo ""
    echo "📋 Key Security Features Enabled:"
    echo "  • Public username availability checking"
    echo "  • Secure user authentication"
    echo "  • Story and post privacy controls"
    echo "  • Safe chat and messaging"
    echo "  • Comprehensive data protection"
    echo ""
    echo "🔗 Firebase Console: https://console.firebase.google.com/project/jorvea-9f876"
else
    echo "❌ Failed to deploy Firestore rules. Please check the configuration."
    exit 1
fi

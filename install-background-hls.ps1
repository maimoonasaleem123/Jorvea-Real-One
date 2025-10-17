# Quick Installation Script
# Run this to install everything at once

Write-Host "🎉 Installing Background HLS Video Processing..." -ForegroundColor Green
Write-Host ""

# Step 1: Install dependencies
Write-Host "📦 Step 1/4: Installing npm packages..." -ForegroundColor Cyan
npm install ffmpeg-kit-react-native react-native-background-actions react-native-push-notification aws-sdk react-native-fs

# Step 2: Link (for older React Native versions)
Write-Host ""
Write-Host "🔗 Step 2/4: Linking native modules..." -ForegroundColor Cyan
# npx react-native link # Uncomment if needed

# Step 3: Pod install (iOS)
if (Test-Path "ios") {
    Write-Host ""
    Write-Host "🍎 Step 3/4: Installing iOS pods..." -ForegroundColor Cyan
    Set-Location ios
    pod install
    Set-Location ..
} else {
    Write-Host ""
    Write-Host "⏭️  Step 3/4: Skipping iOS (not found)" -ForegroundColor Yellow
}

# Step 4: Info
Write-Host ""
Write-Host "✅ Step 4/4: Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Update CreateReelScreen with code from CREATEREELSCREEN_BACKGROUND_UPDATE.txt"
Write-Host "2. Add UploadQueueScreen to your navigation"
Write-Host "3. Run: npx react-native run-android"
Write-Host ""
Write-Host "📚 Read BACKGROUND_HLS_COMPLETE.md for full documentation" -ForegroundColor Yellow
Write-Host ""
Write-Host "🎉 You now have FREE background HLS video processing!" -ForegroundColor Green
Write-Host "💰 Cost: $0.00 (only your existing DigitalOcean $5/month)" -ForegroundColor Green
Write-Host "⚡ User never waits - everything happens in background!" -ForegroundColor Green

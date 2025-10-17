# Complete Gradle Cache Fix Script
# Run this as Administrator

Write-Host "🔧 Complete Gradle Cache Fix" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green
Write-Host ""

# Step 1: Stop all Java/Gradle processes
Write-Host "Step 1: Stopping all Java/Gradle processes..." -ForegroundColor Cyan
Get-Process | Where-Object {$_.ProcessName -like "*java*" -or $_.ProcessName -like "*gradle*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "Done stopping processes" -ForegroundColor Green
Write-Host ""

# Wait a moment
Start-Sleep -Seconds 2

# Step 2: Delete Gradle caches
Write-Host "Step 2: Deleting Gradle cache folders..." -ForegroundColor Cyan
$gradleCache = "$env:USERPROFILE\.gradle\caches"
if (Test-Path $gradleCache) {
    Write-Host "Deleting: $gradleCache" -ForegroundColor Yellow
    Remove-Item -Path $gradleCache -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Gradle cache deleted" -ForegroundColor Green
} else {
    Write-Host "Gradle cache not found (already clean)" -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Delete Gradle daemon
Write-Host "Step 3: Deleting Gradle daemon..." -ForegroundColor Cyan
$gradleDaemon = "$env:USERPROFILE\.gradle\daemon"
if (Test-Path $gradleDaemon) {
    Remove-Item -Path $gradleDaemon -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Gradle daemon deleted" -ForegroundColor Green
} else {
    Write-Host "Gradle daemon not found" -ForegroundColor Yellow
}
Write-Host ""

# Step 4: Delete project build folders
Write-Host "Step 4: Cleaning project build folders..." -ForegroundColor Cyan
$projectPath = "D:\Master Jorvea\JorveaNew\Jorvea"

if (Test-Path "$projectPath\android\build") {
    Remove-Item -Path "$projectPath\android\build" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "android/build deleted" -ForegroundColor Green
}

if (Test-Path "$projectPath\android\app\build") {
    Remove-Item -Path "$projectPath\android\app\build" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "android/app/build deleted" -ForegroundColor Green
}

if (Test-Path "$projectPath\android\.gradle") {
    Remove-Item -Path "$projectPath\android\.gradle" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "android/.gradle deleted" -ForegroundColor Green
}
Write-Host ""

# Step 5: Clean gradle
Write-Host "Step 5: Running Gradle clean..." -ForegroundColor Cyan
Set-Location "$projectPath\android"
.\gradlew clean --no-daemon
Write-Host "Gradle clean complete" -ForegroundColor Green
Write-Host ""

# Step 6: Final message
Write-Host "=============================" -ForegroundColor Green
Write-Host "ALL CLEANUP COMPLETE!" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green
Write-Host ""
Write-Host "Now run: npx react-native run-android" -ForegroundColor Yellow
Write-Host ""
Write-Host "Note: First build will take 3-5 minutes" -ForegroundColor Yellow
Write-Host ""

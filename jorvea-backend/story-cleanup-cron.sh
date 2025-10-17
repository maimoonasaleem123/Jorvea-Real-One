#!/bin/bash

# 🧹 Story Cleanup Cron Job Script
# 
# This script calls the story cleanup endpoint every hour
# Add this to your crontab to run automatically:
# 
# Run: crontab -e
# Add line: 0 * * * * /path/to/story-cleanup-cron.sh
# 
# This will run the cleanup every hour at minute 0

# Your backend URL
BACKEND_URL="${BACKEND_URL:-https://jorvea-jgg3d.ondigitalocean.app}"

# Log file
LOG_FILE="/var/log/jorvea-story-cleanup.log"

# Get current timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$TIMESTAMP] Starting story cleanup..." >> "$LOG_FILE"

# Call the cleanup endpoint
RESPONSE=$(curl -s -X DELETE "$BACKEND_URL/api/stories/cleanup" \
  -H "Content-Type: application/json" \
  -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "[$TIMESTAMP] ✅ Cleanup successful: $BODY" >> "$LOG_FILE"
else
  echo "[$TIMESTAMP] ❌ Cleanup failed (HTTP $HTTP_CODE): $BODY" >> "$LOG_FILE"
fi

echo "[$TIMESTAMP] Cleanup completed" >> "$LOG_FILE"
echo "---" >> "$LOG_FILE"

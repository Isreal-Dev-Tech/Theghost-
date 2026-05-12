#!/bin/bash

echo "========================================"
echo "  TikTok Country Race Game"
echo "========================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python3 is not installed! Please install Python 3.8+"
    exit 1
fi

# Install dependencies
echo "Checking dependencies..."
pip3 install -r backend/requirements.txt

echo ""
echo "========================================"
echo "  Choose Mode:"
echo "========================================"
echo "1. Test Mode (manual gifts)"
echo "2. Live Mode (connect to TikTok)"
echo ""
read -p "Enter choice (1 or 2): " choice

if [ "$choice" = "1" ]; then
    echo "Starting in TEST MODE..."
    python3 backend/server.py --test
elif [ "$choice" = "2" ]; then
    read -p "Enter your TikTok username (without @): " username
    echo "Starting LIVE MODE for @$username..."
    python3 backend/server.py --username "$username"
else
    echo "Invalid choice!"
fi

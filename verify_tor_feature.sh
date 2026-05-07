#!/bin/bash
# TOR Window Feature - File Verification Script
# This script verifies that all required files for the TOR window feature have been created

echo "=== TOR Window Feature - File Verification ==="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Count of verified files
verified=0
missing=0

# Function to check file
check_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description"
        echo "  Location: $file"
        ((verified++))
    else
        echo -e "${RED}✗${NC} $description"
        echo "  Expected: $file"
        ((missing++))
    fi
    echo ""
}

# Function to check directory
check_dir() {
    local dir=$1
    local description=$2
    
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $description (directory)"
        echo "  Location: $dir"
        ((verified++))
    else
        echo -e "${RED}✗${NC} $description (directory)"
        echo "  Expected: $dir"
        ((missing++))
    fi
    echo ""
}

# Go to browser directory
cd /home/notspidey/Desktop/Lykon/lykon/browser

echo "Checking Module Files..."
echo "========================"
check_file "modules/TorWindow.sys.mjs" "Core TOR Window Module"

echo ""
echo "Checking Dialog Files..."
echo "========================"
check_dir "base/content/tor" "TOR Dialog Directory"
check_file "base/content/tor/torConnectionDialog.html" "HTML Dialog UI"
check_file "base/content/tor/torConnectionDialog.xul" "XUL Dialog UI"
check_file "base/content/tor/torConnectionDialog.js" "Dialog JavaScript Handler"
check_file "base/content/tor/torConnectionDialog.css" "Dialog Styling"

echo ""
echo "Checking Localization Files..."
echo "==============================="
check_dir "locales/en-US/browser/tor" "Localization Directory"
check_file "locales/en-US/browser/tor/torConnectionDialog.dtd" "English Localization Strings"

echo ""
echo "Checking Modified Files..."
echo "==========================="
check_file "modules/BrowserWindowTracker.sys.mjs" "Updated Browser Window Tracker"
check_file "base/content/browser-sets.js" "Updated Browser Commands"

echo ""
echo "Checking Documentation Files..."
echo "================================"
check_file "tor_feature_README.md" "Feature Documentation"
cd /home/notspidey/Desktop/Lykon/lykon
check_file "IMPLEMENTATION_SUMMARY.md" "Implementation Summary"

echo ""
echo "=== Verification Summary ==="
echo -e "${GREEN}Verified: $verified files/directories${NC}"
if [ $missing -gt 0 ]; then
    echo -e "${RED}Missing: $missing files/directories${NC}"
else
    echo -e "${GREEN}Missing: 0 files/directories${NC}"
fi

echo ""
if [ $missing -eq 0 ]; then
    echo -e "${GREEN}✓ All files successfully created!${NC}"
    echo ""
    echo "To use the TOR Window feature:"
    echo "1. Restart Firefox/Lykon browser"
    echo "2. Go to File menu → New TOR Window"
    echo "3. The TOR connection dialog will appear"
    echo "4. Click 'Connect' to establish TOR connection"
    exit 0
else
    echo -e "${RED}✗ Some files are missing. Please verify the implementation.${NC}"
    exit 1
fi

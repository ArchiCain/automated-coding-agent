#!/bin/bash
# Test script for API limit handler

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/api-limit-handler.sh"

echo "Testing API Limit Handler"
echo "═══════════════════════════════════════════════════════"
echo ""

# Test 1: Detection
echo "Test 1: Detect API limit message"
test_output="You've hit your limit · resets 1am (America/New_York)"
if detect_api_limit "$test_output"; then
    echo "✓ Detection works"
else
    echo "✗ Detection failed"
fi
echo ""

# Test 2: Extract reset info
echo "Test 2: Extract reset info"
reset_info=$(extract_reset_info "$test_output")
echo "  Input:  $test_output"
echo "  Output: $reset_info"
if [ "$reset_info" = "1am (America/New_York)" ]; then
    echo "✓ Extraction works"
else
    echo "✗ Extraction failed"
fi
echo ""

# Test 3: Calculate wait time
echo "Test 3: Calculate wait time"
echo "  Current time: $(date '+%I:%M%p')"
echo ""

test_cases=(
    "1am (America/New_York)"
    "12pm (America/New_York)"
    "11:30pm (America/New_York)"
    "6am (America/Los_Angeles)"
)

for test_case in "${test_cases[@]}"; do
    wait_seconds=$(calculate_wait_seconds "$test_case")
    hours=$((wait_seconds / 3600))
    minutes=$(((wait_seconds % 3600) / 60))

    echo "  Reset: $test_case"
    echo "    → Wait: ${hours}h ${minutes}m ($wait_seconds seconds)"
    echo ""
done

echo "═══════════════════════════════════════════════════════"
echo "Tests complete!"
echo ""
echo "To test with real API limit output:"
echo "  1. Create a file with Claude output containing limit message"
echo "  2. Run: handle_api_limit /path/to/output.log"

#!/bin/bash
# scripts/api-limit-handler.sh
# Simple API limit detection and wait logic for macOS

#####################################################################
# API Limit Detection
#####################################################################

# Detects if Claude Code output contains API limit message
# Returns 0 (true) if limit detected, 1 (false) otherwise
detect_api_limit() {
    local output="$1"

    if echo "$output" | grep -q "You've hit your limit"; then
        return 0
    fi

    return 1
}

# Extracts reset time info from API limit message
# Example: "You've hit your limit · resets 1am (America/New_York)"
# Returns: "1am (America/New_York)"
extract_reset_info() {
    local output="$1"

    # Extract everything after "resets "
    echo "$output" | grep -o "resets [^·]*" | sed 's/resets //'
}

#####################################################################
# Wait Time Calculation (Simple macOS approach)
#####################################################################

# Parse reset time and calculate seconds to wait
# Input: "1am (America/New_York)" or "12:30pm (America/Los_Angeles)"
# Output: seconds to wait
calculate_wait_seconds() {
    local reset_info="$1"

    # Extract time part (before timezone)
    local time_str=$(echo "$reset_info" | awk '{print $1}')

    # Extract hour and period (am/pm)
    local reset_hour=$(echo "$time_str" | grep -o '^[0-9]\+')
    local reset_minute=0
    local reset_period=$(echo "$time_str" | grep -o '[ap]m$')

    # Check if minutes specified (e.g., "12:30pm")
    if echo "$time_str" | grep -q ':'; then
        reset_minute=$(echo "$time_str" | grep -o ':[0-9]\+' | tr -d ':')
    fi

    # Convert to 24-hour format
    if [ "$reset_period" = "pm" ] && [ "$reset_hour" != "12" ]; then
        reset_hour=$((reset_hour + 12))
    elif [ "$reset_period" = "am" ] && [ "$reset_hour" = "12" ]; then
        reset_hour=0
    fi

    # Get current time
    local current_hour=$(date +%H)
    local current_minute=$(date +%M)
    local current_seconds=$((current_hour * 3600 + current_minute * 60))

    # Calculate reset time in seconds from midnight
    local reset_seconds=$((reset_hour * 3600 + reset_minute * 60))

    # Calculate wait time
    local wait_seconds
    if [ "$reset_seconds" -gt "$current_seconds" ]; then
        # Reset is later today
        wait_seconds=$((reset_seconds - current_seconds))
    else
        # Reset is tomorrow
        wait_seconds=$((86400 - current_seconds + reset_seconds))
    fi

    echo "$wait_seconds"
}

#####################################################################
# Wait with Progress Display
#####################################################################

# Waits for specified seconds with live countdown
wait_with_progress() {
    local total_seconds=$1
    local reset_info="$2"
    local waited=0

    echo ""
    echo "⏸️  Paused due to API limit"
    echo "   Will resume at: $reset_info"
    echo ""

    # Wait in 30-second intervals for smoother progress
    while [ $waited -lt $total_seconds ]; do
        local remaining=$((total_seconds - waited))
        local hours=$((remaining / 3600))
        local minutes=$(((remaining % 3600) / 60))
        local seconds=$((remaining % 60))

        printf "\r   ⏳ Time remaining: %02d:%02d:%02d   " "$hours" "$minutes" "$seconds"

        # Sleep for 30 seconds or remaining time, whichever is less
        local sleep_time=30
        if [ $remaining -lt 30 ]; then
            sleep_time=$remaining
        fi

        sleep $sleep_time
        waited=$((waited + sleep_time))
    done

    printf "\r   ✓ API limit reset!                        \n"
    echo ""
}

#####################################################################
# Main Handler Function
#####################################################################

# Complete API limit handling workflow
# Returns 0 if limit was handled, 1 if no limit detected
handle_api_limit() {
    local output_file="$1"
    local context="${2:-Task}"  # Optional context for logging (e.g., "Worker", "Validator")

    local output=$(cat "$output_file" 2>/dev/null || echo "")

    if ! detect_api_limit "$output"; then
        # No limit detected
        return 1
    fi

    # Limit detected!
    local reset_info=$(extract_reset_info "$output")

    if [ -z "$reset_info" ]; then
        echo ""
        echo "⚠️  API limit detected but couldn't parse reset time"
        echo "   Please check manually when limit resets"
        echo ""
        return 1
    fi

    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "  API Limit Reached ($context)"
    echo "════════════════════════════════════════════════════════════"

    local wait_seconds=$(calculate_wait_seconds "$reset_info")

    if [ "$wait_seconds" -le 0 ]; then
        echo "⚠️  Calculated wait time is invalid ($wait_seconds seconds)"
        echo "   Continuing anyway..."
        return 1
    fi

    # Show summary
    local hours=$((wait_seconds / 3600))
    local minutes=$(((wait_seconds % 3600) / 60))

    echo "   Reset time: $reset_info"
    echo "   Wait duration: ${hours}h ${minutes}m"

    # Wait with progress
    wait_with_progress "$wait_seconds" "$reset_info"

    echo "════════════════════════════════════════════════════════════"
    echo "  Resuming Execution"
    echo "════════════════════════════════════════════════════════════"
    echo ""

    return 0
}

#####################################################################
# Export Functions
#####################################################################

export -f detect_api_limit
export -f extract_reset_info
export -f calculate_wait_seconds
export -f wait_with_progress
export -f handle_api_limit

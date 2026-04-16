# Dashboard Feature

The main dashboard landing page that users see after login.

## Overview

This feature provides:
- **Overview metrics** - System status and key performance indicators
- **Recent activity** - Latest user actions and system events  
- **Quick actions** - Easy access to common tasks
- **System health indicators** - Visual status of key services
- **User notifications** - Important alerts and messages

## Components

- `DashboardPage` - Main dashboard page component
- `MetricsCard` - Reusable metric display card
- `ActivityFeed` - Recent activity list component
- `QuickActions` - Action button grid
- `SystemStatus` - Health indicator component

## Architecture

- Uses Material Design card-based layout
- Implements responsive design for mobile/tablet
- Follows 8pt grid spacing system
- Includes proper loading and empty states
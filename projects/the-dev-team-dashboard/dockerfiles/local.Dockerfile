FROM node:20-alpine

WORKDIR /app

# Install dependencies if needed
# Volume mounting will overlay this, so we install on startup
COPY package*.json ./

# Expose dashboard dev port
EXPOSE 3002

# Install dependencies and start Vite in development mode
# Use --host to allow connections from outside container
# Port configured via DASHBOARD_PORT env var in vite.config.ts
CMD sh -c "npm install && npm run dev -- --host"

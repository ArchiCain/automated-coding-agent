FROM node:20-alpine

WORKDIR /app

# Install dependencies if needed
# Volume mounting will overlay this, so we install on startup
COPY package*.json ./

# Expose service port
EXPOSE 8080

# Install dependencies and start Vite in development mode
# Use --host to allow connections from outside container
# Port configured via PORT env var in vite.config.ts
CMD sh -c "npm install && npm run dev -- --host"

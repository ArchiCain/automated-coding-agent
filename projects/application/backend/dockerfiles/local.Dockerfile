FROM node:20-alpine

WORKDIR /app

# Install dependencies if needed
# Volume mounting will overlay this, so we install on startup
COPY package*.json ./

# Copy start script
COPY scripts/start-dev.sh /usr/local/bin/start-dev.sh
RUN chmod +x /usr/local/bin/start-dev.sh

# Expose service port
EXPOSE 8080

# Install dependencies, run migrations, and start NestJS in development mode
CMD ["/usr/local/bin/start-dev.sh"]

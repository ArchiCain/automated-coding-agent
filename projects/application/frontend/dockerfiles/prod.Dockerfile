# Stage 1: Dependencies
FROM node:22-alpine AS deps

WORKDIR /app

COPY app/package.json app/package-lock.json ./

RUN npm ci

# Stage 2: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY app/ .

RUN npx ng build --configuration=production

# Stage 3: Production runtime with nginx
FROM nginx:alpine

RUN apk add --no-cache wget

COPY dockerfiles/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist/app/browser /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d
RUN touch /var/run/nginx.pid && chown -R nginx:nginx /var/run/nginx.pid
USER nginx

CMD ["nginx", "-g", "daemon off;"]

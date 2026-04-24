# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY app/package.json app/package-lock.json* ./
RUN npm ci
COPY app/ .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY dockerfiles/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

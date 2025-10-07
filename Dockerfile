# Multi-stage build for Vite React app

FROM node:20-alpine AS build
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci

# Build
COPY . .
RUN npm run build

# Runtime: serve static files with Nginx and SPA fallback
FROM nginx:1.25-alpine

# Replace default server with SPA-friendly config
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]



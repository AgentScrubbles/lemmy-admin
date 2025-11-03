# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy runtime environment scripts
COPY env.sh /env.sh
COPY docker-entrypoint.sh /docker-entrypoint.sh

# Make scripts executable
RUN chmod +x /env.sh /docker-entrypoint.sh

# Expose port 80
EXPOSE 80

# Use custom entrypoint to generate runtime config
ENTRYPOINT ["/docker-entrypoint.sh"]

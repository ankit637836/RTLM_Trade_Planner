# Stage 1: Build the React application
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code
COPY . .

# Allow DevOps to pass the API URL dynamically during the CI/CD pipeline build step.
# It defaults to '/api' for Ingress routing if nothing is provided.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

# Build static files
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Copy built static files from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80 for the Nginx server
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]

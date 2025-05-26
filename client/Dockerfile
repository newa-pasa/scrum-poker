# Use an official Nginx image. Alpine versions are lightweight.
FROM nginx:1.25-alpine

# Set the working directory for Nginx's static files
WORKDIR /usr/share/nginx/html

# Remove default Nginx welcome page and any other default assets
RUN rm -rf ./*

COPY ./dist/ ./
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Nginx listens on port 80 by default
EXPOSE 80

# Command to run Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]

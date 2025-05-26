# Use an official Node.js runtime as a parent image
# Using alpine for a smaller image size. Choose a version that matches your project.
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Create a non-root user and group for security
# Running applications as a non-root user is a critical security best practice.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy package.json and package-lock.json (or yarn.lock if you use Yarn)
# These are copied separately to leverage Docker's layer caching.
# If these files haven't changed, Docker can reuse the layer from a previous build
# where dependencies were installed.
COPY --chown=appuser:appgroup package.json ./
COPY --chown=appuser:appgroup package-lock.json ./
# If using yarn, replace package-lock.json with yarn.lock:
# COPY --chown=appuser:appgroup yarn.lock ./

# Install production dependencies
# Using `npm ci` for reproducible builds from package-lock.json.
# `--omit=dev` (or `NODE_ENV=production npm install`) ensures only production dependencies are installed.
RUN npm ci --omit=dev
# If using yarn, use:
# RUN yarn install --production --frozen-lockfile

# Copy the rest of the application source code
# The --chown flag ensures the files are owned by the non-root user.
# Make sure you have a .dockerignore file in this 'server' directory
# to exclude unnecessary files (e.g., local node_modules, .git, .env files).
COPY . .
RUN chown -R appuser:appgroup /usr/src/app

# If your server has a build step (e.g., TypeScript compilation) that isn't part of `npm start`,
# you might need to run it here. For example:
# RUN npm run build

# Switch to the non-root user
USER appuser

# Expose the port your server runs on
EXPOSE 3000 

# Add HEALTHCHECK to allow Docker to verify container health.
# This example uses Node.js to make an HTTP GET request to '/health' on localhost.
# Adjust the path and port if your health check endpoint is different or if you don't have one.
# If you don't have a /health endpoint, you might check '/' or another known path.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1));"

# Define the command to run your app
# This could be "node your-main-script.js" or "npm start"
CMD [ "npm", "start" ]
# Or, if you have a specific entry point:
# CMD [ "node", "server.js" ]

# Note on .dockerignore:
# Ensure you have a .dockerignore file inside your 'server' directory (the build context for this image)
# to exclude files like .git, local node_modules, .env, etc.
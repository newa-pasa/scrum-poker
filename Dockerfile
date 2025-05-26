# Use an official Node.js runtime as a parent image
# Using alpine for a smaller image size. Choose a version that matches your project.
FROM node:18-alpine as base

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock)
# Do this first to leverage Docker cache for dependencies
COPY package.json ./
COPY package-lock.json ./
# If using yarn:
# COPY yarn.lock ./

# Install production dependencies
# Using --omit=dev to skip development dependencies for a smaller image
RUN npm ci --omit=dev
# If using yarn:
# RUN yarn install --production --frozen-lockfile

# Copy the rest of the application source code
COPY . .

# If your server has a build step (e.g., TypeScript compilation) that isn't part of `npm start`,
# you might need to run it here. For example:
# RUN npm run build

# Expose the port your server runs on
EXPOSE 3000 

# Define the command to run your app
CMD [ "node", "server.js" ]
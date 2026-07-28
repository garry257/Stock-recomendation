# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy the backend package.json and package-lock.json
COPY backend/package*.json ./backend/

# Install backend dependencies
RUN cd backend && npm install

# Copy the rest of the application files
# This copies both the backend code and the frontend files in the root directory
COPY . .

# Set environment variable for the port (optional, server defaults to 5005)
ENV PORT=5005

# Expose the port the app runs on
EXPOSE 5005

# Define the command to run the app
CMD ["node", "backend/server.js"]

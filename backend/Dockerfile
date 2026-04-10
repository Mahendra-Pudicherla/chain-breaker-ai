FROM mcr.microsoft.com/playwright:v1.49.1-jammy

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install explicit Node dependencies
RUN npm install

# Copy all the backend code
COPY . .

# Expose the API port
EXPOSE 5000

# Start it up
CMD ["npm", "start"]

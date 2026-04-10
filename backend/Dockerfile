FROM node:22-bookworm

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install explicit Node dependencies
RUN npm install

# Install Playwright browser and OS dependencies
RUN npx playwright install chromium --with-deps

# Copy all the backend code
COPY . .

# Expose the API port
EXPOSE 5000

# Start it up
CMD ["npm", "start"]

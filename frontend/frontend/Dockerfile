FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package*.json ./
RUN npm install

# Copy rest of the application
COPY . .

EXPOSE 5173

# Use host mode for Vite dev server to work properly in Docker
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
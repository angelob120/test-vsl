# Build stage for client
FROM node:20-slim AS client-builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build && ls -la dist/

# Production stage
FROM node:20-slim

# Install dependencies for Puppeteer and FFmpeg
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer environment
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copy server package files and install
COPY package*.json ./
RUN npm install --only=production

# Copy server code
COPY server/ ./server/

# Copy built client and verify
COPY --from=client-builder /app/client/dist ./client/dist
RUN echo "Client dist contents:" && ls -la ./client/dist/

# Create necessary directories
RUN mkdir -p public/uploads public/videos public/previews public/backgrounds

# Set environment variables
ENV PORT=3001
ENV NODE_ENV=production

# Start the server
CMD ["npm", "start"]

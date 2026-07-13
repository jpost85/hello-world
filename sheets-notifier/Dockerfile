# Use a small, current Node runtime.
FROM node:22-slim

WORKDIR /app

# Install production dependencies first (better layer caching).
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the application source.
COPY . .

ENV NODE_ENV=production
ENV PORT=3000

# The store (watched sheets + recipients) is written here. Mount a volume
# at /app/data to make it survive container restarts.
VOLUME ["/app/data"]

EXPOSE 3000

CMD ["node", "src/server.js"]

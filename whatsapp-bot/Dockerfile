# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (layer caching)
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# ---- Runtime Stage ----
FROM node:20-alpine

WORKDIR /app

# Copy installed modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Health check — Render uses this
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/ || exit 1

# Start the bot
CMD ["node", "index.js"]

# ═══ ArchGen Railway Dockerfile ═══
# Dual runtime: Node.js (app) + Python (mingrammer engine)

FROM node:20-slim AS builder

WORKDIR /app

# Install Python3 + graphviz (required by mingrammer/diagrams)
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv graphviz \
    && rm -rf /var/lib/apt/lists/*

# Install Python diagrams library
RUN pip3 install diagrams --break-system-packages

# Copy package files and install Node dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY . .

# Build the app
RUN npm run build

# ═══ Production stage ═══
FROM node:20-slim

WORKDIR /app

# Install Python3 + graphviz in production image
RUN apt-get update && apt-get install -y \
    python3 python3-pip graphviz \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install diagrams --break-system-packages

# Copy built app + node_modules + Python engine
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server/engine ./dist/engine

# Create output directory for generated PNGs
RUN mkdir -p generated-diagrams

# Railway injects PORT
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.cjs"]

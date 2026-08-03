FROM node:20-slim

# Install Python 3, Go, and build essentials
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    golang-go \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server.js ./

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "server.js"]

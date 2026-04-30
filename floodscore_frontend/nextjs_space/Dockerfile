# Use a lightweight Node image
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --production=false

# Copy source
COPY . .

# Build production assets
RUN npm run build

# Production image
FROM node:20-alpine AS release
WORKDIR /app
COPY --from=base /app/package.json ./
COPY --from=base /app/package-lock.json* ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/.next ./.next
COPY --from=base /app/public ./public
COPY --from=base /app/next.config.js ./next.config.js
COPY --from=base /app/tsconfig.json ./tsconfig.json
COPY --from=base /app/next-env.d.ts ./next-env.d.ts

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]

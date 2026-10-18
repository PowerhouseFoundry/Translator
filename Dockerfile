# Consistent free speech on iPads and other devices: generate audio on the server.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng espeak-ng-data && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node","server.js"]

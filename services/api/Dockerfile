FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY shared ./shared
COPY server ./server
RUN npx tsc --noEmit && npx vite build
ENV HOST=0.0.0.0 PORT=3001
USER node
EXPOSE 3001
CMD ["npm", "start"]

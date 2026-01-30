FROM node:22-alpine AS builder

# Переменные подставляются в бандл на этапе сборки (Vite читает import.meta.env).
# Если в контексте есть frontend/.env — он подхватится при сборке (без --env-file).
ARG VITE_API_BASE_URL
ARG VITE_LIVEKIT_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_LIVEKIT_URL=$VITE_LIVEKIT_URL

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Подгрузка .env из контекста (если есть), чтобы не передавать --env-file при docker-compose
RUN set -a && [ -f .env ] && . ./.env; set +a && npm run build:app

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
RUN echo 'server { listen 80; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# ── Stage 1: Build Angular ────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Instalar dependencias primero (layer cacheada si package.json no cambia)
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copiar fuentes y compilar
COPY . .
RUN npm run build -- --configuration production

# ── Stage 2: Servir con Nginx ─────────────────────────────────────────────────
FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist/frontend_proyect/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

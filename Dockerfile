# ── Stage 1: Build Angular ────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Instalar dependencias primero (cache layer)
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copiar fuentes y compilar
COPY . .
RUN npm run build -- --configuration production

# ── Stage 2: Servir con Nginx ─────────────────────────────────────────────────
FROM nginx:alpine

# Eliminar config default
RUN rm /etc/nginx/conf.d/default.conf

# Copiar el build de Angular
COPY --from=builder /app/dist/frontend_proyect/browser /usr/share/nginx/html

# Copiar config personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

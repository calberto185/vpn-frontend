FROM nginx:alpine

# Eliminar config default de nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copiar el build de Angular (generado en GitHub Actions)
COPY dist/frontend_proyect/browser /usr/share/nginx/html

# Copiar config personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

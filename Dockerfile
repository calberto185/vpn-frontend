FROM nginx:alpine

# Elimina la config default de nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copia tu build Angular
COPY . /usr/share/nginx/html

# Copia tu configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

FROM node:22.12.0-alpine3.21 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && sh scripts/check-main-build.sh dist/shell/browser

# Unprivileged nginx: runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.27.3-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.inc /etc/nginx/security-headers.inc
COPY --from=build /app/dist/shell/browser /usr/share/nginx/html
# Built portal modules (see the README); the manifest points to /portals/<name>.js on this same origin.
COPY portals/ /usr/share/nginx/html/portals/
EXPOSE 8080

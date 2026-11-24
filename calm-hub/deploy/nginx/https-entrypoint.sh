#!/bin/sh
# First start writes a dev certificate. Later starts reuse the mounted volume.
set -eu
cert_dir=/etc/nginx/certs
mkdir -p "$cert_dir"
if [ ! -s "$cert_dir/tls.crt" ] || [ ! -s "$cert_dir/tls.key" ]; then
  if ! command -v openssl >/dev/null 2>&1; then
    apk add --no-cache openssl
  fi
  openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -keyout "$cert_dir/tls.key" \
    -out "$cert_dir/tls.crt" \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,DNS:hub.creditas.cz,DNS:hub.localhost,IP:127.0.0.1"
fi
exec nginx -g 'daemon off;'

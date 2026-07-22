# Playdown landing page — static site in nginx.
# nginx:alpine is multi-arch (arm64 included), so the same image runs on a
# Jetson. Build/push from the repo root:
#   docker compose build && docker compose push
# Multi-arch (amd64 + arm64) in one go:
#   docker buildx build --platform linux/arm64,linux/amd64 \
#     -f docker/Dockerfile -t $DOCKERHUB_USER/playdown-site:latest --push .
FROM nginx:alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docs/ /usr/share/nginx/html/

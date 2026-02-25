# Login en Docker Hub
docker login

# Build de producción
docker compose build api web

# Tag
docker tag geomun-api:latest rizomatico/geo-api:latest
docker tag geomun-web:latest rizomatico/geo-web:latest

# Push
docker push rizomatico/geo-api:latest
docker push rizomatico/geo-web:latest

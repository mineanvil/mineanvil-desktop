FROM node:22-bookworm

WORKDIR /work

RUN apt-get update && apt-get install -y \
  python3 make g++ git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV npm_config_cache=/work/.npm-cache

CMD ["bash", "-lc", "npm install && npm run dev -- --host 0.0.0.0 --port 5173"]

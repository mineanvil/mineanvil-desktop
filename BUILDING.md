# Building & Running MineAnvil

## macOS (Docker-only)

Renderer (browser mode):

- Run: `docker compose up dev`
- Open: `http://localhost:5173`

Notes:
- Electron is Windows-only for this project; it will not run on macOS here.
- All installs happen inside the container (`npm ci`).

## Windows (native Electron)

Full app (Vite + Electron main/preload/IPC):

- Run: `npm ci`
- Run: `npm run dev:electron`

Renderer only:

- Run: `npm run dev`



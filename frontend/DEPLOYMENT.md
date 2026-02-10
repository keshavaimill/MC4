# MC4 Frontend – Deployment (AWS, Azure, any webserver)

This app is a Next.js 16 frontend that talks to the MC4 FastAPI backend. It can be deployed on AWS, Azure, or any host that runs Node or serves static + API proxy.

## Build

```bash
cd frontend
npm ci
npm run build
```

Production build output is in `.next/`. Run with:

```bash
npm run start
```

(Port 3000 by default; set `PORT` if needed.)

---

## Deployment patterns

### 1. Same host (recommended for single-server deploy)

Frontend and backend on the same machine. A reverse proxy (nginx, Caddy, or Azure App Service / AWS ALB) serves the app and forwards `/api/*` to the backend.

- **Build:** `npm run build && npm run start`, or build locally and upload `.next` + `node_modules` + `package.json` and run `node .next/standalone/server.js` if using `output: 'standalone'`.
- **Env:** Set `BACKEND_URL` to your backend URL (e.g. `http://localhost:8000` or `http://backend:8000`) so Next rewrites send `/api/*` to the backend. If the proxy forwards `/api` before the request hits Next, you can leave `BACKEND_URL` unset.
- **Frontend URL:** Users open `https://your-domain.com`. Requests to `https://your-domain.com/api/*` are proxied to the backend.

### 2. Frontend and backend on different hosts (e.g. S3 + API Gateway, or separate App Services)

The browser must call the backend directly. Set the public API base URL at **build time**:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-api.example.com npm run build
```

Or in your host’s env (Azure App Settings, AWS Amplify / CodeBuild env, etc.) set:

- `NEXT_PUBLIC_API_BASE_URL=https://your-backend.azurewebsites.net`  
  (no trailing slash)

Then run `npm run build`. All API requests will go to `https://your-backend.azurewebsites.net/api/...`.

- **CORS:** The FastAPI backend must allow your frontend origin (already configured for `*` in dev; restrict in production).
- **Backend:** Deploy the FastAPI app (e.g. Azure App Service, AWS ECS/EC2, Lambda + HTTP API) and note its URL.

### 3. Static export (optional)

If you use `output: 'export'` in `next.config.js`, you get a static site. There is no Next server, so no rewrites. You **must** set `NEXT_PUBLIC_API_BASE_URL` to your backend URL and rebuild. The backend must be reachable from the user’s browser and allow CORS.

---

## Environment variables summary

| Variable | When to set | Purpose |
|----------|-------------|--------|
| `NEXT_PUBLIC_API_BASE_URL` | Frontend and backend on different hosts | Base URL for API (e.g. `https://api.example.com`). Set at build time. |
| `BACKEND_URL` | Same host, using Next rewrites | URL to which Next proxies `/api/*` (e.g. `http://localhost:8000`). |
| `PORT` | Any | Port for `next start` (default 3000). |

---

## Azure App Service (Node)

1. Create a Node (e.g. 20 LTS) App Service.
2. Build: either use Oryx/build or deploy a pre-built app (e.g. `npm run build` in CI, then deploy `.next`, `node_modules`, `package.json`, `public`).
3. Start command: `npm run start` or `npx next start -p ${PORT:-3000}`.
4. Application settings: set `BACKEND_URL` to your FastAPI backend URL if using rewrites; or set `NEXT_PUBLIC_API_BASE_URL` and rebuild if frontend and backend are on different hosts.

---

## AWS (Amplify / EC2 / ECS)

- **Amplify:** Connect the repo, build with `npm ci && npm run build`, run `npm run start` or use Amplify’s Next.js support. Set `NEXT_PUBLIC_API_BASE_URL` (and optionally `BACKEND_URL`) in Amplify env.
- **EC2/ECS:** Build the app, run `next start`. Put behind ALB; optionally proxy `/api` to the backend or set `NEXT_PUBLIC_API_BASE_URL` and point the frontend to the API URL.

---

## Docker (optional)

Example Dockerfile for a standalone-style deploy:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

To use this, uncomment `output: 'standalone'` in `next.config.js` and build again. Then the image will use the standalone server.

---

## Checklist

- [ ] Backend is deployed and reachable (same host or public URL).
- [ ] If frontend and backend on different hosts: set `NEXT_PUBLIC_API_BASE_URL` and rebuild.
- [ ] If using Next rewrites: set `BACKEND_URL` where `next start` runs.
- [ ] CORS on the backend allows the frontend origin (or use same origin via proxy).
- [ ] Default date range is 2020; dataset is 2020 – use “From” date in 2020 to see data.

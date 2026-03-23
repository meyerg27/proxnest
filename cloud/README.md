# ProxNest Cloud Portal

Remote access to your ProxNest home servers from anywhere - like HexOS deck.hexos.com.

## Architecture

```
Browser → cloud.proxnest.com → WebSocket Tunnel → ProxNest Agent → Local API
```

No port forwarding required. The agent maintains a persistent WebSocket connection
to the cloud portal. User requests are proxied through this tunnel.

## Stack

- **Backend:** Fastify + TypeScript + SQLite (better-sqlite3) + WebSocket
- **Frontend:** React + TypeScript + Tailwind CSS v4 + Vite
- **Auth:** JWT + bcrypt password hashing

## Development

```bash
# Backend
cd cloud
npm install
npm run dev          # Starts on :4000

# Frontend (separate terminal)
cd cloud/dashboard
npm install
npm run dev          # Starts on :3001, proxies /api to :4000
```

## Features

- **User Auth** - Register, login, JWT sessions, password change
- **Server Claiming** - Agent generates claim code, user enters it to link
- **Server Dashboard** - Full proxied access to local ProxNest dashboard
- **WebSocket Proxy** - All requests tunneled through agent connection
- **Agent Pool** - Heartbeats, reconnection, metrics collection
- **Session Management** - View/revoke active sessions
- **Rate Limiting** - Per-IP request throttling

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `JWT_SECRET` | dev secret | JWT signing key |
| `DATABASE_PATH` | `./data/cloud.db` | SQLite database path |
| `LOG_LEVEL` | `info` | Pino log level |

## API Endpoints

- `POST /api/v1/auth/register` - Create account
- `POST /api/v1/auth/login` - Sign in
- `GET /api/v1/auth/me` - Get profile
- `PATCH /api/v1/auth/profile` - Update profile
- `POST /api/v1/auth/change-password` - Change password
- `GET /api/v1/servers` - List servers
- `POST /api/v1/servers/claim` - Claim server with code
- `ALL /api/v1/proxy/:serverId/*` - Proxy to agent
- `WS /ws/agent` - Agent WebSocket endpoint

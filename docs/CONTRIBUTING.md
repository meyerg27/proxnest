# Contributing to ProxNest

Thank you for your interest in contributing to ProxNest! We welcome contributions of all kinds - code, documentation, bug reports, feature requests, and community support.

## Stack Overview

### Frontend
| Component | Technology |
|-----------|-----------|
| Landing Page | React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion |
| Cloud Dashboard | React 18 + TypeScript + Vite + Tailwind CSS + React Router v6 |
| Icons | Lucide React |
| Animations | Framer Motion |

### Backend
| Component | Technology |
|-----------|-----------|
| API Server | Node.js + TypeScript + Fastify |
| Database | SQLite (better-sqlite3) |
| Auth | JWT + bcrypt |
| Validation | Zod |

### (Server Daemon)
| Component | Technology |
|-----------|-----------|
| Runtime | Node.js + TypeScript |
| Communication | WebSocket (real-time) |
| System Info | systeminformation |
| Scheduling | node-cron |
| Build | pkg (single binary) |

### Infrastructure
| Component | Technology |
|-----------|-----------|
| Base OS | Proxmox VE 7+ / 8+ |
| Hosting | Cloudflare Pages (landing + dashboard) |
| API Hosting | VPS / self-hosted |
| DNS | Cloudflare |

---

## Project Structure

```
proxnest/
├── landing/               # Marketing website (proxnest.com)
│   ├── src/
│   │   ├── App.tsx        # Main landing page component
│   │   ├── main.tsx       # Entry point
│   │   └── index.css      # Tailwind + custom styles
│   ├── public/
│   │   └── screenshots/   # Dashboard screenshots
│   ├── package.json
│   └── vite.config.ts
├── cloud/
│   └── dashboard/         # Cloud dashboard (cloud.proxnest.com)
│       ├── src/
│       │   ├── pages/     # Page components
│       │   ├── components/ # Shared components
│       │   ├── lib/       # API client, utils
│       │   └── hooks/     # Custom React hooks
│       ├── package.json
│       └── vite.config.ts
├── api/                   # Backend REST API
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   ├── middleware/     # Auth, validation
│   │   └── db/            # Database schema + migrations
│   ├── package.json
│   └── tsconfig.json
├── agent/                 # Server agent daemon
│   ├── src/
│   │   ├── commands/      # Command handlers
│   │   ├── modules/       # System modules
│   │   └── ws/            # WebSocket client
│   ├── package.json
│   └── tsconfig.json
├── docs/                  # Documentation
├── scripts/               # Build and deployment scripts
└── README.md
```

---

## Development Setup

### Prerequisites
- Node.js 20+ (LTS)
- npm 10+
- Git

### and Install
```bash
git clone https://github.com/proxnest-os/proxnest.git
cd proxnest

# Landing page
cd landing
npm install
npm run dev  # → http://localhost:5173

# Cloud dashboard
cd ../cloud/dashboard
npm install
npm run dev  # → http://localhost:5174

# API server
cd ../../api
npm install
npm run dev  # → http://localhost:4000
```

### Variables
Create `.env` files from the examples:
```bash
# API
cp api/.env.example api/.env

# Dashboard
cp cloud/dashboard/.env.example cloud/dashboard/.env
```

### for Production
```bash
# Landing page
cd landing && npm run build  # Output: dist/

# Dashboard
cd cloud/dashboard && npm run build  # Output: dist/

# API
cd api && npm run build  # Output: dist/
```

---

## to Contribute

### Bugs
1. Search [existing issues](https://github.com/proxnest-os/proxnest/issues) first
2. Open a new issue with:
   - Clear title describing the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - ProxNest version and hardware info
   - Screenshots or logs if applicable

### Features
1. Open a [GitHub Discussion](https://github.com/proxnest-os/proxnest/discussions) first
2. Describe the feature and why it would be useful
3. If there's community interest, we'll create an issue

### Code

1. **Fork** the repository
2. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/my-feature
   # or
   git checkout -b fix/my-bugfix
   ```
3. **Make your changes**
4. **Test** your changes locally
5. **Commit** with a clear message:
   ```bash
   git commit -m "feat: add dark mode toggle to dashboard"
   # or
   git commit -m "fix: resolve storage wizard crash on empty disks"
   ```
6. **Push** and create a Pull Request

### Convention
We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Purpose |
|--------|---------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `style:` | Formatting, no code change |
| `refactor:` | Code restructuring |
| `test:` | Adding tests |
| `chore:` | Build/tooling changes |

### Process
1. Fill out the PR template
2. Ensure CI checks pass
3. Request review from a maintainer
4. Address feedback
5. Maintainer merges when approved

---

## Adding a New App Template

To add a new app to the App Store:

1. Add the app definition to `cloud/dashboard/src/pages/ServerDashboard.tsx` in the `DEFAULT_APPS` array
2. Follow the existing format:
   ```typescript
   {
     id: 'my-app',
     name: 'My App',
     description: 'What this app does',
     icon: '🔧',
     category: 'productivity',
     type: 'docker',
     tags: ['tag1', 'tag2'],
     webPort: 8080,
     minResources: { cores: 1, memoryMB: 512, diskGB: 5 },
     docker: {
       image: 'my-app/my-app:latest',
       ports: { '8080': 8080 },
       volumes: { '/config': '/opt/my-app' }
     }
   }
   ```
3. Add auto-wiring rules if the app connects to others
4. Test the install flow
5. Submit a PR

---

## Community

- **Discord:** [Join our server](https://discord.gg/b4NGUMYU34)
- **GitHub Issues:** [Bug reports](https://github.com/proxnest-os/proxnest/issues)
- **GitHub Discussions:** [Feature requests & questions](https://github.com/proxnest-os/proxnest/discussions)

---

## License

By contributing to ProxNest, you agree that your contributions will be licensed under the AGPLv3 license (for open-source core).

# ProxNest — Build Progress

## Run 1 — 2026-03-20

### ✅ Phase 1: Architecture Doc (README.md)
- Full architecture document with diagrams
- Tech stack defined (React+TS+Tailwind frontend, Node+TS+Fastify backend, Proxmox API)
- Feature breakdown: App Store, Storage, Dashboard, Users, Cloud Portal
- Revenue model: Free tier + $5/mo Pro
- Project structure defined
- License: AGPLv3 core + proprietary features

### ✅ Phase 2: Landing Page (landing/)
- Full React + TypeScript + Tailwind landing page
- Vite build, production-ready (builds clean, 339KB JS + 25KB CSS gzipped to ~112KB)
- **Sections built:**
  - Navbar (responsive, mobile hamburger, glass effect)
  - Hero (animated headline, CTA buttons, mock dashboard preview)
  - Features (6 cards: App Store, Storage, Dashboard, Local-First, Proxmox Powered, Multi-User)
  - App Store showcase (4 categories: Media, Downloads, Cloud, Network with 12 apps)
  - Comparison table (ProxNest vs Hexos vs Unraid — 9 features)
  - Pricing (Free + Pro tiers with feature lists)
  - CTA section (download + GitHub buttons)
  - Footer (4-column with links)
- **Design:** Dark theme (nest-900 base), indigo accent, glass morphism cards, gradient text, glow borders, Framer Motion animations
- **Dependencies:** react, tailwindcss v4 (@tailwindcss/vite), lucide-react, framer-motion

---

## Next Up
- [ ] **Phase 3: Core Backend (api/)** — Fastify + TypeScript API wrapping Proxmox
  - Auth (JWT), Proxmox proxy endpoints, app template CRUD, storage management
- [ ] **Phase 4: Web Dashboard (dashboard/)** — React admin UI
- [ ] **Phase 5: Agent (agent/)** — Server daemon

# Installing and hosting

## For alliance leaders: install the app on your phone

You only need the link your developer gives you (for example
`https://<username>.github.io/soul-ds-planner/`).

### iPhone / iPad (Safari)

1. Open the link in **Safari** (installation only works from Safari on iOS).
2. Tap the **Share** button (square with an arrow up).
3. Scroll and tap **Add to Home Screen**, then **Add**.
4. Open **SOUL DS** from the home screen. It runs full screen (an internet connection is needed to sign in and sync).

### Android (Chrome)

1. Open the link in **Chrome**.
2. Tap **Install app** in the banner, or the **⋮** menu → **Install app**
   (on some phones: **Add to Home screen**).
3. Confirm. The app appears in your app drawer / home screen.

### Updates

The app updates itself: when a new version is published, it is downloaded in the
background and used the next time you open the app (close and reopen it to be sure).
Your data is kept.

> Data is stored online and shared by all R4s. Sign in with your own account on any
> phone. Use **Settings → Export backup** for safety copies.

---

## For the developer

### Requirements

* Node.js 20.19+ (22 LTS recommended) and npm.

### Run locally

```bash
npm install
npm run dev          # http://localhost:5173 with hot reload
npm test             # unit tests (Vitest)
npm run lint         # ESLint + architecture/cycle check
npm run typecheck    # TypeScript
npm run build        # production build in dist/ (PWA, service worker, manifest)
npm run preview      # serve dist/ at http://localhost:4173 to test the installable PWA
npm run icons        # regenerate public/icons/*.png (original, script-drawn)
```

Commit the generated `package-lock.json` after the first `npm install` so CI builds are
reproducible (the workflow uses `npm ci` automatically once the lockfile exists).

### Publish your own copy on GitHub Pages

1. Create an empty repository on GitHub, e.g. `soul-ds-planner`.
2. Push this project to it:

   ```bash
   git remote add origin https://github.com/<username>/soul-ds-planner.git
   git push -u origin main
   ```

3. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. The workflow `.github/workflows/deploy.yml` runs on every push to `main`: it installs,
   lints, tests, builds with `VITE_BASE=/<repository-name>/` and deploys.
   Follow it in the **Actions** tab; the URL appears in the deploy job
   (`https://<username>.github.io/<repository-name>/`).
5. Share that link with your R4s (see the install steps above).

**Custom domain or user site** (`https://<username>.github.io/` or `https://ds.example.com/`):
set `VITE_BASE: /` in the workflow's build step.

**Other hosts** (Netlify, Cloudflare Pages, any static server): run
`VITE_BASE=/ npm run build` (or the sub-path you serve from) and upload `dist/`.
The app uses hash-based navigation, so no server rewrite rules are needed. Serve over
HTTPS – service workers and installation require it (localhost is fine for testing).

### Pushing to another git remote

```bash
git remote -v                                  # see current remotes
git remote add mine https://example.com/me/soul-ds-planner.git
git push mine main
```

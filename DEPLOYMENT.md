# HireFlow AI Deployment

## Fastest Demo Deploy

Deploy the frontend to Vercel or Netlify. The app includes a browser-local fallback API, so the demo works without a backend, but data is stored in the user's browser.

### Vercel

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Framework preset: Vite.
4. Build command: `npm run build`.
5. Output directory: `dist`.

The included `vercel.json` handles candidate/report routes like `/interview/:id` and `/company/reports/:id`.

### Netlify

1. Push this repo to GitHub.
2. Import it in Netlify.
3. Build command: `npm run build`.
4. Publish directory: `dist`.

The included `netlify.toml` handles SPA routing.

## Full Frontend + Backend Deploy

1. Deploy `backend/` to Render as a Python web service.
2. Set backend environment variable:
   - `ALLOWED_ORIGINS=https://your-frontend-domain.com`
3. Deploy frontend to Vercel/Netlify.
4. Set frontend environment variable:
   - `VITE_API_URL=https://your-backend-domain.com`
5. Rebuild/redeploy the frontend.

## Important Production Note

The current backend stores interviews and sessions in memory. For real production, replace the in-memory dictionaries with PostgreSQL before relying on it for real candidates.

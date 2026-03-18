# ACPS Flare

Cloudflare free-tier SvelteKit deployment for Debias Lens.

## Runtime bindings

Use these exact names:

- Secret: `OPENAI_API_KEY`
- Variable: `OPENAI_MODEL`
- Variable: `OPENAI_BASE_URL`
- Variable: `ALLOWED_ORIGIN`

## Local development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

## Deploy

```bash
pnpm deploy
```

Or:

```bash
npx wrangler deploy
```

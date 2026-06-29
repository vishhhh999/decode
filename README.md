# DECODE

Reverse-engineer any design system. Paste a URL — brand site, portfolio, Behance or Dribbble profile — and DECODE scrapes it, extracts design tokens and patterns, then generates structured design reasoning you can learn from or drop into Claude.

## Stack

- **Frontend**: React + Vite + Framer Motion
- **API**: Vercel serverless functions
- **Scraping**: Browserless.io (cloud headless Chrome)
- **Reasoning**: Claude API (claude-sonnet-4-6)
- **Storage**: localStorage (per-user history, no backend needed)

## Setup

```bash
git clone https://github.com/yourusername/decode
cd decode
npm install
```

Copy the env file:
```bash
cp .env.example .env.local
```

Fill in your keys in `.env.local`:
- `BROWSERLESS_TOKEN` — get from [browserless.io](https://browserless.io) (free tier works)
- `ANTHROPIC_API_KEY` — get from [console.anthropic.com](https://console.anthropic.com)

Run locally:
```bash
npm run dev
```

> Note: The `/api/scrape` endpoint only runs on Vercel. For local dev, you'll see the UI but scraping won't work without a local Vercel dev server.

For full local dev (including API):
```bash
npm install -g vercel
vercel dev
```

## Deploy to Vercel

```bash
vercel
```

Or connect your GitHub repo to Vercel and add the two environment variables in the Vercel dashboard.

## How it works

1. You paste a URL
2. Browserless loads the page in a real Chrome instance, extracts CSS variables, computed styles, fonts, colors, border radii, and component patterns
3. It crawls up to 4–5 internal pages to get a more complete picture
4. All scraped data is sent to Claude, which generates structured design reasoning: color roles, typography strategy, spacing philosophy, brand voice, and transferable principles
5. The output is displayed as an interactive panel and can be downloaded as a `.md` file or copied as CSS tokens
6. Every analysis is saved to your browser's localStorage as history

## What DECODE extracts

- Full color palette with semantic roles
- Typography system (families, weights, sizes, tracking approach)
- Button and card radius philosophy
- Spacing density and section padding
- Elevation and shadow strategy
- Brand personality and visual voice
- Transferable design principles
- Ready-to-use CSS custom properties

## Limitations

- Some sites actively block scraping (Figma's app, sites behind auth)
- Behance and Dribbble work for public profiles but may fail occasionally
- Dynamic/JS-heavy sites may load incompletely in the 30s timeout
- The free Browserless tier has limited monthly minutes — upgrade for heavy use

## License

MIT

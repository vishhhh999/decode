// api/scrape.js — Vercel serverless function
// Routes by URL type: brand website vs Behance vs Dribbble

export const config = { maxDuration: 60 }

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// ─── URL type detection ────────────────────────────────────────────────────────
function getUrlType(url) {
  const { hostname, pathname } = new URL(url)
  const host = hostname.replace(/^www\./, '')

  if (host === 'behance.net' || host.endsWith('.behance.net')) {
    const parts = pathname.split('/').filter(Boolean)
    if (parts[0] === 'gallery') return { type: 'behance-project', platform: 'behance' }
    return { type: 'behance-profile', platform: 'behance' }
  }

  if (host === 'dribbble.com' || host.endsWith('.dribbble.com')) {
    const parts = pathname.split('/').filter(Boolean)
    if (parts[0] === 'shots') return { type: 'dribbble-shot', platform: 'dribbble' }
    return { type: 'dribbble-profile', platform: 'dribbble' }
  }

  return { type: 'website', platform: null }
}

// ─── Minimal valid Browserless /content body ──────────────────────────────────
// Browserless uses a STRICT JSON schema — any unrecognised field = 400.
// Only these top-level keys are valid: url, html, gotoOptions, waitForEvent,
// waitForFunction, waitForSelector, waitForTimeout, cookies, authenticate,
// addScriptTag, addStyleTag, rejectRequestPattern, requestInterceptors,
// userAgent, viewport, bestAttempt, headless, ignoreHTTPSErrors, slowMo.
// NO "waitFor" (number), NO "setJavaScriptEnabled".

function contentBody(url) {
  return {
    url,
    gotoOptions: {
      waitUntil: 'domcontentloaded',
      timeout: 25000,
    },
    waitForTimeout: 2000,
  }
}

function screenshotBody(url) {
  return {
    url,
    gotoOptions: {
      waitUntil: 'networkidle2',
      timeout: 25000,
    },
    waitForTimeout: 2500,
    viewport: {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
    },
  }
}

const BL = `https://chrome.browserless.io`

async function blFetch(endpoint, body) {
  const res = await fetch(`${BL}/${endpoint}?token=${BROWSERLESS_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => String(res.status))
    throw new Error(`Browserless /${endpoint} ${res.status}: ${t.slice(0, 300)}`)
  }
  return res
}

// ─── Behance / Dribbble: screenshot → Claude Vision ──────────────────────────
async function screenshotAndAnalyze(url) {
  if (!BROWSERLESS_TOKEN) throw new Error('BROWSERLESS_TOKEN not set')

  // Screenshot → raw PNG bytes
  const ssRes = await blFetch('screenshot', screenshotBody(url))
  const ssBuffer = await ssRes.arrayBuffer()
  const base64Screenshot = Buffer.from(ssBuffer).toString('base64')

  // HTML content for title/description context (best-effort, non-fatal)
  let pageContext = { title: '', bodyText: '' }
  try {
    const htmlRes = await blFetch('content', contentBody(url))
    const html = await htmlRes.text()
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    pageContext.title = titleMatch ? titleMatch[1].trim() : ''
    pageContext.bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000)
  } catch { /* non-fatal */ }

  return { base64Screenshot, pageContext }
}

// ─── Brand website: HTML → parse CSS tokens ───────────────────────────────────
async function extractBrandStyles(url) {
  if (!BROWSERLESS_TOKEN) throw new Error('BROWSERLESS_TOKEN not set')
  const res = await blFetch('content', contentBody(url))
  const html = await res.text()
  return parseHtmlForTokens(html, url)
}

// ─── Parse HTML for design tokens ─────────────────────────────────────────────
function parseHtmlForTokens(html, url) {
  // Pull all CSS text from <style> blocks
  const styleBlocks = []
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    styleBlocks.push(m[1])
  }
  const allCss = styleBlocks.join('\n')

  // CSS custom properties
  const cssVars = {}
  for (const m of allCss.matchAll(/(--[\w-]+)\s*:\s*([^;}\n]+)/g)) {
    const key = m[1].trim()
    const val = m[2].trim()
    if (val && val.length < 100) cssVars[key] = val
  }

  // Hex colors
  const colors = new Set()
  for (const m of allCss.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    const h = m[1]
    colors.add(('#' + (h.length === 3 ? h.split('').map(c => c+c).join('') : h)).toLowerCase())
  }
  for (const m of allCss.matchAll(/rgba?\([^)]+\)/g)) colors.add(m[0])

  // Fonts
  const fonts = new Set()
  const SKIP_FONTS = new Set(['sans-serif','serif','monospace','inherit','initial','unset','cursive','fantasy'])
  for (const m of allCss.matchAll(/font-family\s*:\s*([^;}\n]+)/gi)) {
    m[1].split(',').forEach(f => {
      const clean = f.trim().replace(/['"]/g, '').trim()
      if (clean && !SKIP_FONTS.has(clean.toLowerCase())) fonts.add(clean)
    })
  }

  // Font weights
  const weights = new Set()
  for (const m of allCss.matchAll(/font-weight\s*:\s*(\d{3}|bold|normal)/gi)) weights.add(m[1])

  // Font sizes
  const sizes = new Set()
  for (const m of allCss.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?(?:px|rem|em))/gi)) sizes.add(m[1])

  // Border radii
  const radii = new Set()
  for (const m of allCss.matchAll(/border-radius\s*:\s*([^;}\n]+)/gi)) {
    const r = m[1].trim()
    if (r && r !== '0' && r !== '0px') radii.add(r)
  }

  // Box shadows
  const shadows = new Set()
  for (const m of allCss.matchAll(/box-shadow\s*:\s*([^;}\n]+)/gi)) {
    const s = m[1].trim()
    if (s && s !== 'none') shadows.add(s)
  }

  // Page meta
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : ''
  const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)
  const metaDesc = metaMatch ? metaMatch[1] : ''

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000)

  const h1s = []
  for (const m of html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)) {
    const t = m[1].replace(/<[^>]+>/g, '').trim()
    if (t) h1s.push(t)
  }

  return {
    cssVars,
    colors: Array.from(colors).slice(0, 80),
    fonts: Array.from(fonts).slice(0, 20),
    fontWeights: Array.from(weights),
    fontSizes: Array.from(sizes).slice(0, 20),
    radii: Array.from(radii).slice(0, 20),
    shadows: Array.from(shadows).slice(0, 10),
    title,
    metaDesc,
    bodyText,
    h1s: h1s.slice(0, 5),
    pageUrl: url,
  }
}

// ─── Crawl internal pages (brand websites only, sequential, time-gated) ────────
const INTERNAL_PATHS = ['/about', '/work', '/projects', '/pricing']

async function crawlInternalPages(baseUrl) {
  const results = []
  const origin = new URL(baseUrl).origin
  const deadline = Date.now() + 20000 // 20s budget for crawling

  for (const path of INTERNAL_PATHS.slice(0, 2)) {
    if (Date.now() > deadline) break
    try {
      const data = await extractBrandStyles(origin + path)
      results.push(data)
    } catch { /* skip missing pages */ }
  }
  return results
}

// ─── Claude: brand website CSS data → design system JSON ──────────────────────
async function analyzeBrandWebsite(scrapedData, url) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')

  const prompt = `You are a senior design systems analyst. You have CSS token data scraped from: ${url}

This is the brand's OWN website CSS — not a third-party platform.

SCRAPED DATA:
${JSON.stringify(scrapedData, null, 2)}

Instructions:
- cssVars: CSS custom properties — most reliable token source, use these first
- colors: hex/rgb values found in CSS — identify which are brand vs text vs background
- fonts: font families actually used (ignore system fallbacks like Arial, sans-serif)
- radii: border-radius values from buttons, cards, inputs
- shadows: box-shadow values found
- h1s + bodyText: gives brand context and copy voice
- Ignore browser-default colors like pure #000000 from resets unless clearly intentional

Return ONLY valid JSON, zero markdown, zero preamble:

{
  "brand": {
    "name": "infer from title/domain/bodyText",
    "url": "${url}",
    "type": "website",
    "atmosphere": "2-3 sentences on visual atmosphere inferred from tokens"
  },
  "colors": {
    "primary": "main brand/action hex",
    "canvas": "background hex",
    "ink": "primary text hex",
    "accent": "secondary accent hex if distinct",
    "secondary": "muted text hex",
    "border": "border/divider hex",
    "surface": "card/panel hex",
    "others": ["up to 4 other notable hex values"]
  },
  "typography": {
    "displayFamily": "headline font name",
    "bodyFamily": "body font name",
    "displayWeight": "number",
    "bodyWeight": "number",
    "displaySize": "largest px size found",
    "bodySize": "body px size",
    "tracking": "describe letter-spacing approach",
    "notes": "other notable type decisions"
  },
  "spacing": {
    "baseUnit": "base spacing unit",
    "sectionPadding": "section vertical padding",
    "cardPadding": "card internal padding",
    "density": "compact or balanced or generous"
  },
  "shape": {
    "buttonRadius": "button radius from data",
    "cardRadius": "card radius from data",
    "philosophy": "pill or tight or sharp or binary"
  },
  "elevation": {
    "shadowStyle": "none or single-tier or layered or surface-contrast",
    "definition": "actual box-shadow value from data or empty string"
  },
  "voice": {
    "canvasTemperature": "dark or light or warm-light",
    "brandPersonality": "3 adjectives",
    "antiPatterns": ["3-5 things absent/avoided based on what's not in the data"],
    "signature": "single most distinctive visual element"
  },
  "principles": ["5-8 transferable design principles, each a full sentence"],
  "tokens": {
    "css": ":root {\n  --primary: #hex;\n  --canvas: #hex;\n  --ink: #hex;\n  --accent: #hex;\n  --border: #hex;\n  --surface: #hex;\n  --font-display: 'Name';\n  --font-body: 'Name';\n  --radius-button: Xpx;\n  --radius-card: Xpx;\n}"
  }
}`

  return callClaude(prompt, false, null)
}

// ─── Claude: screenshot → design system JSON (Vision) ─────────────────────────
async function analyzeVisualScreenshot(screenshotData, url, urlTypeInfo) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')

  const { base64Screenshot, pageContext } = screenshotData
  const platform = urlTypeInfo.platform === 'behance' ? 'Behance' : 'Dribbble'
  const contentType = urlTypeInfo.type.includes('profile') ? 'portfolio profile' : 'design project'

  const prompt = `You are a senior design systems analyst looking at a screenshot of a ${platform} ${contentType}.

CRITICAL: Analyze ONLY the designer's WORK visible in the screenshot.
DO NOT analyze ${platform}'s own UI (their nav bar, their background, their buttons, their layout chrome).
Focus entirely on the design work/portfolio pieces being showcased.

Page title: ${pageContext.title}
Context: ${pageContext.bodyText.slice(0, 400)}
URL: ${url}

From the visual work shown in the screenshot, extract:
- Color palette used IN the designs (ignore ${platform}'s grey/white UI shell)
- Typography style visible IN the work
- Layout, spacing and composition approach
- Visual aesthetic and style fingerprint

Return ONLY valid JSON, zero markdown, zero preamble:

{
  "brand": {
    "name": "designer or project name from title",
    "url": "${url}",
    "type": "${urlTypeInfo.type}",
    "atmosphere": "2-3 sentences on this designer's visual style based on their work"
  },
  "colors": {
    "primary": "dominant color IN the work (hex estimate)",
    "canvas": "background used in the work",
    "ink": "text color in the work",
    "accent": "accent color if present",
    "secondary": "secondary color",
    "border": "border/divider color if apparent",
    "surface": "card/panel color if apparent",
    "others": ["other notable colors in the work"]
  },
  "typography": {
    "displayFamily": "headline font style (describe or name if visible)",
    "bodyFamily": "body font style",
    "displayWeight": "apparent weight",
    "bodyWeight": "apparent weight",
    "displaySize": "estimated px",
    "bodySize": "estimated px",
    "tracking": "tight or loose or normal",
    "notes": "type observations"
  },
  "spacing": {
    "baseUnit": "estimated",
    "sectionPadding": "estimated",
    "cardPadding": "estimated",
    "density": "compact or balanced or generous"
  },
  "shape": {
    "buttonRadius": "from UI elements visible in work",
    "cardRadius": "from containers in work",
    "philosophy": "pill or tight or sharp or binary"
  },
  "elevation": {
    "shadowStyle": "none or single-tier or layered or surface-contrast",
    "definition": ""
  },
  "voice": {
    "canvasTemperature": "dark or light or warm-light",
    "brandPersonality": "3 adjectives for this designer's style",
    "antiPatterns": ["things absent from or avoided in this work"],
    "signature": "single most distinctive visual element of this designer's style"
  },
  "principles": ["5-8 design principles apparent from this work"],
  "tokens": {
    "css": ":root {\n  /* Visual analysis estimates */\n  --primary: #hex;\n  --canvas: #hex;\n  --ink: #hex;\n}"
  }
}`

  return callClaude(prompt, true, base64Screenshot)
}

// ─── Claude API (with optional Vision) ────────────────────────────────────────
async function callClaude(prompt, withImage, base64Image) {
  const content = withImage && base64Image
    ? [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Image } },
        { type: 'text', text: prompt },
      ]
    : prompt

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => String(res.status))
    throw new Error(`Claude API ${res.status}: ${t.slice(0, 200)}`)
  }

  const result = await res.json()
  const text = result.content[0].text.trim()
  const clean = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()

  try {
    return JSON.parse(clean)
  } catch {
    const match = clean.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error('Claude returned invalid JSON')
  }
}

// ─── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url } = req.body || {}
  if (!url) return res.status(400).json({ error: 'URL required' })

  res.setHeader('Content-Type', 'application/json')

  try {
    const urlTypeInfo = getUrlType(url)

    // ── Behance / Dribbble → screenshot + Vision ──────────────────────────────
    if (urlTypeInfo.platform === 'behance' || urlTypeInfo.platform === 'dribbble') {
      const screenshotData = await screenshotAndAnalyze(url)
      const designSystem = await analyzeVisualScreenshot(screenshotData, url, urlTypeInfo)
      return res.status(200).json({ success: true, pagesScraped: 1, method: 'visual-analysis', designSystem })
    }

    // ── Brand website → CSS extraction ────────────────────────────────────────
    const homepageData = await extractBrandStyles(url)
    const internalPages = await crawlInternalPages(url)

    const allData = {
      homepage: homepageData,
      internalPages,
      pagesScraped: 1 + internalPages.length,
    }

    const designSystem = await analyzeBrandWebsite(allData, url)
    return res.status(200).json({
      success: true,
      pagesScraped: allData.pagesScraped,
      method: 'css-extraction',
      designSystem,
    })
  } catch (err) {
    console.error('DECODE error:', err)
    return res.status(500).json({ error: err.message || 'Analysis failed' })
  }
}

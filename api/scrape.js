// api/scrape.js — Vercel serverless function
// Routes: brand website → CSS extraction | Behance/Dribbble → screenshot + Vision

export const config = { maxDuration: 60 }

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const BL = 'https://chrome.browserless.io'

// Stealth script injected to mask headless signals — addScriptTag is a valid Browserless field
const STEALTH_SCRIPT = {
  content: [
    'Object.defineProperty(navigator, "webdriver", { get: () => undefined });',
    'Object.defineProperty(navigator, "plugins", { get: () => [1,2,3] });',
    'window.chrome = { runtime: {} };',
  ].join('\n')
}

// ─── URL type detection ────────────────────────────────────────────────────────
function getUrlType(url) {
  const { hostname, pathname } = new URL(url)
  const host = hostname.replace(/^www\./, '')
  const parts = pathname.split('/').filter(Boolean)

  if (host === 'behance.net' || host.endsWith('.behance.net')) {
    return { type: parts[0] === 'gallery' ? 'behance-project' : 'behance-profile', platform: 'behance' }
  }
  if (host === 'dribbble.com' || host.endsWith('.dribbble.com')) {
    return { type: parts[0] === 'shots' ? 'dribbble-shot' : 'dribbble-profile', platform: 'dribbble' }
  }
  return { type: 'website', platform: null }
}

// ─── Browserless fetch wrapper ────────────────────────────────────────────────
async function blFetch(endpoint, body) {
  if (!BROWSERLESS_TOKEN) throw new Error('BROWSERLESS_TOKEN environment variable is not set')
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

// ─── Body builders (only valid Browserless schema fields) ────────────────────
function makeContentBody(url) {
  return {
    url,
    addScriptTag: [STEALTH_SCRIPT],
    gotoOptions: { waitUntil: 'domcontentloaded', timeout: 25000 },
    waitForTimeout: 2000,
  }
}

function makeScreenshotBody(url) {
  return {
    url,
    addScriptTag: [STEALTH_SCRIPT],
    gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 },
    waitForTimeout: 5000, // longer wait — gives SPA bot-checks/lazy content time to resolve
    viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  }
}

// ─── Behance / Dribbble: screenshot → validate → Claude Vision ───────────────
async function handlePlatformUrl(url, urlTypeInfo) {
  // 1. Screenshot — longer wait to let SPA content render past any bot-check interstitial
  let ssBuffer
  try {
    const ssRes = await blFetch('screenshot', makeScreenshotBody(url))
    ssBuffer = await ssRes.arrayBuffer()
  } catch (err) {
    // Browserless itself returned non-200 — the page likely hard-blocked the request
    const platform = urlTypeInfo.platform === 'behance' ? 'Behance' : 'Dribbble'
    throw new Error(
      `${platform} blocked this request at the network level (${err.message}). ` +
      `${platform} runs bot-detection that can reject automated browsers regardless of which page is requested. ` +
      `This is a known limitation — there is currently no reliable workaround for ${platform} specifically. ` +
      `Try a brand website instead, which works reliably.`
    )
  }

  const bytes = ssBuffer.byteLength

  // If image is tiny (<8KB) it's almost certainly an error/blank/login page
  if (bytes < 8000) {
    const platform = urlTypeInfo.platform === 'behance' ? 'Behance' : 'Dribbble'
    throw new Error(
      `${platform} returned a blank or error screen instead of the page content (${bytes} bytes received). ` +
      `${platform} actively blocks automated browser access, even for public profile URLs. ` +
      `This is a platform-side limitation, not a URL problem — there is currently no reliable workaround. ` +
      `Try a brand website URL instead, which works reliably.`
    )
  }

  const base64Screenshot = Buffer.from(ssBuffer).toString('base64')

  // 2. Page text context (non-fatal)
  let pageContext = { title: '', bodyText: '' }
  try {
    const htmlRes = await blFetch('content', makeContentBody(url))
    const html = await htmlRes.text()
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    pageContext.title = titleMatch ? titleMatch[1].trim() : ''
    pageContext.bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1500)
  } catch { /* non-fatal */ }

  // 3. Quick Claude Vision check — is design work actually visible?
  const checkPrompt = `Look at this screenshot. Answer with ONLY the JSON below, nothing else.
Is this showing actual design work/portfolio content, or is it an error page, login wall, 
access-denied page, or blank page with no design content visible?

{"visible": true/false, "reason": "one sentence"}`

  const checkResult = await callClaude(checkPrompt, true, base64Screenshot)
  // checkResult might be raw text since it's not our usual JSON shape — handle both
  let visible = true
  let checkReason = ''
  try {
    const parsed = typeof checkResult === 'object' ? checkResult : JSON.parse(checkResult)
    visible = parsed.visible !== false
    checkReason = parsed.reason || ''
  } catch { /* if parse fails, assume visible and proceed */ }

  if (!visible) {
    throw new Error(
      `No design work visible in the screenshot: ${checkReason} ` +
      `The URL may be private, require login, or be blocked. ` +
      `Try a public profile URL (e.g. behance.net/username) instead of a specific project link.`
    )
  }

  // 4. Full analysis
  return analyzeVisualScreenshot(base64Screenshot, pageContext, url, urlTypeInfo)
}

// ─── Brand website: HTML → parse CSS → Claude ─────────────────────────────────
async function handleWebsiteUrl(url) {
  const homepageData = await scrapePageCss(url)

  // Crawl 1-2 internal pages if time allows (sequential, non-fatal)
  const internalPages = await crawlInternalPages(url)

  const allData = { homepage: homepageData, internalPages, pagesScraped: 1 + internalPages.length }
  const designSystem = await analyzeBrandWebsite(allData, url)
  return { designSystem, pagesScraped: allData.pagesScraped, method: 'css-extraction' }
}

async function scrapePageCss(url) {
  const res = await blFetch('content', makeContentBody(url))
  const html = await res.text()
  return parseHtmlForTokens(html, url)
}

const INTERNAL_PATHS = ['/about', '/work', '/projects', '/pricing', '/services']

async function crawlInternalPages(baseUrl) {
  const results = []
  const origin = new URL(baseUrl).origin
  const deadline = Date.now() + 18000 // 18s budget

  for (const path of INTERNAL_PATHS.slice(0, 2)) {
    if (Date.now() > deadline) break
    try {
      results.push(await scrapePageCss(origin + path))
    } catch { /* page doesn't exist, skip */ }
  }
  return results
}

// ─── HTML → design token extraction ───────────────────────────────────────────
function parseHtmlForTokens(html, url) {
  const styleBlocks = []
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) styleBlocks.push(m[1])
  const allCss = styleBlocks.join('\n')

  // CSS custom properties (most reliable source)
  const cssVars = {}
  for (const m of allCss.matchAll(/(--[\w-]+)\s*:\s*([^;}\n]+)/g)) {
    const val = m[2].trim()
    if (val && val.length < 100) cssVars[m[1].trim()] = val
  }

  // Colors
  const colors = new Set()
  for (const m of allCss.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    const h = m[1]
    colors.add(('#' + (h.length === 3 ? h.split('').map(c => c+c).join('') : h)).toLowerCase())
  }
  for (const m of allCss.matchAll(/rgba?\([^)]+\)/g)) colors.add(m[0])

  // Fonts (skip generic fallbacks)
  const SKIP = new Set(['sans-serif','serif','monospace','inherit','initial','unset','cursive','fantasy','system-ui','-apple-system'])
  const fonts = new Set()
  for (const m of allCss.matchAll(/font-family\s*:\s*([^;}\n]+)/gi)) {
    m[1].split(',').forEach(f => {
      const c = f.trim().replace(/['"]/g, '').trim()
      if (c && !SKIP.has(c.toLowerCase())) fonts.add(c)
    })
  }

  // Font weights, sizes, radii, shadows
  const weights = new Set()
  for (const m of allCss.matchAll(/font-weight\s*:\s*(\d{3}|bold|normal)/gi)) weights.add(m[1])

  const sizes = new Set()
  for (const m of allCss.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?(?:px|rem|em))/gi)) sizes.add(m[1])

  const radii = new Set()
  for (const m of allCss.matchAll(/border-radius\s*:\s*([^;}\n]+)/gi)) {
    const r = m[1].trim()
    if (r && r !== '0' && r !== '0px') radii.add(r)
  }

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
    cssVars, colors: [...colors].slice(0, 80),
    fonts: [...fonts].slice(0, 20), fontWeights: [...weights],
    fontSizes: [...sizes].slice(0, 20), radii: [...radii].slice(0, 20),
    shadows: [...shadows].slice(0, 10), title, metaDesc, bodyText, h1s: h1s.slice(0, 5), pageUrl: url,
  }
}

// ─── Claude prompts ────────────────────────────────────────────────────────────
async function analyzeBrandWebsite(scrapedData, url) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY environment variable is not set')

  const prompt = `You are a senior design systems analyst. CSS token data scraped from: ${url}

This is the brand's OWN website CSS — not a third-party platform.

DATA:
${JSON.stringify(scrapedData, null, 2)}

Notes:
- cssVars = CSS custom properties — most reliable, prioritize these
- colors = hex values from CSS — distinguish brand/action vs text vs background
- fonts = font families in use (generic fallbacks already filtered out)
- radii = border-radius values from interactive elements
- shadows = box-shadow values
- Ignore browser reset defaults like pure #000/#fff unless clearly intentional brand usage
- Infer brand name from title, domain, or bodyText

Return ONLY valid JSON. No markdown. No explanation. No preamble:

{
  "brand": {
    "name": "brand name",
    "url": "${url}",
    "type": "website",
    "atmosphere": "2-3 sentences describing visual atmosphere from the token data"
  },
  "colors": {
    "primary": "#hex",
    "canvas": "#hex",
    "ink": "#hex",
    "accent": "#hex",
    "secondary": "#hex",
    "border": "#hex",
    "surface": "#hex",
    "others": ["#hex", "#hex"]
  },
  "typography": {
    "displayFamily": "font name",
    "bodyFamily": "font name",
    "displayWeight": "700",
    "bodyWeight": "400",
    "displaySize": "48px",
    "bodySize": "16px",
    "tracking": "description of letter-spacing approach",
    "notes": "other type observations"
  },
  "spacing": {
    "baseUnit": "8px",
    "sectionPadding": "96px",
    "cardPadding": "24px",
    "density": "balanced"
  },
  "shape": {
    "buttonRadius": "6px",
    "cardRadius": "12px",
    "philosophy": "tight"
  },
  "elevation": {
    "shadowStyle": "single-tier",
    "definition": "box-shadow value or empty string"
  },
  "voice": {
    "canvasTemperature": "dark",
    "brandPersonality": "precise, technical, confident",
    "antiPatterns": ["thing 1", "thing 2", "thing 3"],
    "signature": "the single most distinctive visual element"
  },
  "principles": [
    "Principle sentence 1.",
    "Principle sentence 2.",
    "Principle sentence 3.",
    "Principle sentence 4.",
    "Principle sentence 5."
  ],
  "tokens": {
    "css": ":root {\n  --primary: #hex;\n  --canvas: #hex;\n  --ink: #hex;\n  --accent: #hex;\n  --border: #hex;\n  --surface: #hex;\n  --font-display: 'Name';\n  --font-body: 'Name';\n  --radius-button: 6px;\n  --radius-card: 12px;\n}"
  }
}`

  return callClaude(prompt, false, null)
}

async function analyzeVisualScreenshot(base64Screenshot, pageContext, url, urlTypeInfo) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY environment variable is not set')

  const platform = urlTypeInfo.platform === 'behance' ? 'Behance' : 'Dribbble'
  const contentType = urlTypeInfo.type.includes('profile') ? 'portfolio profile' : 'design project'

  const prompt = `You are a senior design systems analyst. You see a ${platform} ${contentType} screenshot.

CRITICAL RULE: Analyze ONLY the design WORK visible in the screenshot.
IGNORE ${platform}'s own UI entirely — their nav, background, buttons, chrome.
Focus on the portfolio pieces, project imagery, and compositions being showcased.

Page title: ${pageContext.title}
Context text: ${pageContext.bodyText.slice(0, 400)}
URL: ${url}

Return ONLY valid JSON. No markdown. No explanation. No preamble.
For any field where you genuinely cannot determine a value from the work shown, use null — do NOT use strings like "unknown" or "unavailable":

{
  "brand": {
    "name": "designer or project name from title",
    "url": "${url}",
    "type": "${urlTypeInfo.type}",
    "atmosphere": "2-3 sentences describing this designer's visual style from their work"
  },
  "colors": {
    "primary": "#hex dominant color in the work",
    "canvas": "#hex background in the work",
    "ink": "#hex text color in the work",
    "accent": "#hex or null",
    "secondary": "#hex or null",
    "border": "#hex or null",
    "surface": "#hex or null",
    "others": ["#hex values from the work"]
  },
  "typography": {
    "displayFamily": "font name if identifiable, else describe style",
    "bodyFamily": "font name if identifiable, else describe style",
    "displayWeight": "number or null",
    "bodyWeight": "number or null",
    "displaySize": "estimated px or null",
    "bodySize": "estimated px or null",
    "tracking": "tight or loose or normal",
    "notes": "type observations from the visible work"
  },
  "spacing": {
    "baseUnit": "estimated or null",
    "sectionPadding": "estimated or null",
    "cardPadding": "estimated or null",
    "density": "compact or balanced or generous"
  },
  "shape": {
    "buttonRadius": "estimated from work or null",
    "cardRadius": "estimated from work or null",
    "philosophy": "pill or tight or sharp or binary"
  },
  "elevation": {
    "shadowStyle": "none or single-tier or layered or surface-contrast",
    "definition": ""
  },
  "voice": {
    "canvasTemperature": "dark or light or warm-light",
    "brandPersonality": "3 adjectives describing this designer's style",
    "antiPatterns": ["things absent from or avoided in this work"],
    "signature": "single most distinctive visual element of this work"
  },
  "principles": [
    "5-8 design principles apparent from this designer's work, each a full sentence"
  ],
  "tokens": {
    "css": ":root {\n  /* Estimated from visual analysis */\n  --primary: #hex;\n  --canvas: #hex;\n  --ink: #hex;\n}"
  }
}`

  const designSystem = await callClaude(prompt, true, base64Screenshot)
  return { designSystem, pagesScraped: 1, method: 'visual-analysis' }
}

// ─── Claude API ────────────────────────────────────────────────────────────────
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
    // For the vision check, return raw text so caller can handle it
    return clean
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

    if (urlTypeInfo.platform === 'behance' || urlTypeInfo.platform === 'dribbble') {
      const { designSystem, pagesScraped, method } = await handlePlatformUrl(url, urlTypeInfo)
      return res.status(200).json({ success: true, pagesScraped, method, designSystem })
    }

    const { designSystem, pagesScraped, method } = await handleWebsiteUrl(url)
    return res.status(200).json({ success: true, pagesScraped, method, designSystem })

  } catch (err) {
    console.error('DECODE error:', err)
    return res.status(500).json({ error: err.message || 'Analysis failed' })
  }
}

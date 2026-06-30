// api/scrape.js — Vercel serverless function
// Deep analysis: screenshot + CSS extraction + multi-page crawl → Claude reasoning

export const config = { maxDuration: 60 }

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const BL = 'https://chrome.browserless.io'

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

function makeContentBody(url) {
  return {
    url,
    addScriptTag: [STEALTH_SCRIPT],
    gotoOptions: { waitUntil: 'domcontentloaded', timeout: 22000 },
    waitForTimeout: 1800,
  }
}

function makeScreenshotBody(url, fullPage = false) {
  return {
    url,
    addScriptTag: [STEALTH_SCRIPT],
    gotoOptions: { waitUntil: 'networkidle2', timeout: 28000 },
    waitForTimeout: 3500,
    viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
    options: fullPage ? { fullPage: true } : undefined,
  }
}

// ─── Page-type classification (for crawl targeting + Claude context) ──────────
const PAGE_TYPE_PATTERNS = [
  { type: 'about',    paths: ['/about', '/about-us', '/company', '/who-we-are'] },
  { type: 'work',     paths: ['/work', '/projects', '/portfolio', '/case-studies'] },
  { type: 'pricing',  paths: ['/pricing', '/plans'] },
  { type: 'product',  paths: ['/product', '/products', '/features'] },
  { type: 'blog',     paths: ['/blog', '/journal', '/news', '/insights'] },
]

// ─── Brand website: screenshot + multi-page CSS crawl ─────────────────────────
async function handleWebsiteUrl(url) {
  // Screenshot the homepage so Claude can SEE the layout, not just infer from CSS soup
  let homepageScreenshot = null
  try {
    const ssRes = await blFetch('screenshot', makeScreenshotBody(url, false))
    const ssBuffer = await ssRes.arrayBuffer()
    if (ssBuffer.byteLength > 5000) {
      homepageScreenshot = Buffer.from(ssBuffer).toString('base64')
    }
  } catch {
    // Non-fatal — proceed with CSS-only analysis if screenshot fails
  }

  const homepageData = await scrapePageCss(url)
  const internalPages = await crawlInternalPages(url)

  const allData = {
    homepage: homepageData,
    internalPages,
    pagesScraped: 1 + internalPages.length,
  }

  const designSystem = await analyzeBrandWebsite(allData, url, homepageScreenshot)
  return {
    designSystem,
    pagesScraped: allData.pagesScraped,
    method: homepageScreenshot ? 'visual+css-extraction' : 'css-extraction',
  }
}

async function scrapePageCss(url) {
  const res = await blFetch('content', makeContentBody(url))
  const html = await res.text()
  return parseHtmlForTokens(html, url)
}

async function crawlInternalPages(baseUrl) {
  const results = []
  const origin = new URL(baseUrl).origin
  const deadline = Date.now() + 14000 // 14s crawl budget — leaves room for screenshot (~6s) + Claude call (~20-25s)

  // Try one path per category — about, work, pricing — to get varied page-type data
  const candidates = PAGE_TYPE_PATTERNS.flatMap(cat =>
    cat.paths.slice(0, 1).map(p => ({ url: origin + p, pageType: cat.type }))
  )

  for (const { url, pageType } of candidates.slice(0, 3)) {
    if (Date.now() > deadline) break
    try {
      const data = await scrapePageCss(url)
      results.push({ ...data, pageType })
    } catch { /* page doesn't exist, skip */ }
  }
  return results
}

// ─── HTML → design token extraction ───────────────────────────────────────────
function parseHtmlForTokens(html, url) {
  const styleBlocks = []
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) styleBlocks.push(m[1])
  const allCss = styleBlocks.join('\n')

  const cssVars = {}
  for (const m of allCss.matchAll(/(--[\w-]+)\s*:\s*([^;}\n]+)/g)) {
    const val = m[2].trim()
    if (val && val.length < 100) cssVars[m[1].trim()] = val
  }

  const colors = new Set()
  for (const m of allCss.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    const h = m[1]
    colors.add(('#' + (h.length === 3 ? h.split('').map(c => c+c).join('') : h)).toLowerCase())
  }
  for (const m of allCss.matchAll(/rgba?\([^)]+\)/g)) colors.add(m[0])

  const SKIP = new Set(['sans-serif','serif','monospace','inherit','initial','unset','cursive','fantasy','system-ui','-apple-system'])
  const fonts = new Set()
  for (const m of allCss.matchAll(/font-family\s*:\s*([^;}\n]+)/gi)) {
    m[1].split(',').forEach(f => {
      const c = f.trim().replace(/['"]/g, '').trim()
      if (c && !SKIP.has(c.toLowerCase())) fonts.add(c)
    })
  }

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

  const letterSpacings = new Set()
  for (const m of allCss.matchAll(/letter-spacing\s*:\s*([^;}\n]+)/gi)) {
    const ls = m[1].trim()
    if (ls && ls !== 'normal' && ls !== '0') letterSpacings.add(ls)
  }

  const transitions = new Set()
  for (const m of allCss.matchAll(/transition\s*:\s*([^;}\n]+)/gi)) {
    const t = m[1].trim()
    if (t && t !== 'none' && t.length < 80) transitions.add(t)
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : ''
  const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)
  const metaDesc = metaMatch ? metaMatch[1] : ''

  const ogSiteMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i)
  const ogSiteName = ogSiteMatch ? ogSiteMatch[1] : ''

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3500)

  const h1s = []
  for (const m of html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)) {
    const t = m[1].replace(/<[^>]+>/g, '').trim()
    if (t) h1s.push(t)
  }

  const h2s = []
  for (const m of html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)) {
    const t = m[1].replace(/<[^>]+>/g, '').trim()
    if (t) h2s.push(t)
  }

  // Detect button-like elements and their class names (helps Claude infer component naming)
  const buttonClasses = new Set()
  for (const m of html.matchAll(/<(?:button|a)[^>]+class=["']([^"']+)["'][^>]*>/gi)) {
    const classes = m[1].split(/\s+/).filter(c => /btn|button|cta/i.test(c))
    classes.forEach(c => buttonClasses.add(c))
  }

  return {
    cssVars,
    colors: [...colors].slice(0, 100),
    fonts: [...fonts].slice(0, 20),
    fontWeights: [...weights],
    fontSizes: [...sizes].slice(0, 25),
    radii: [...radii].slice(0, 25),
    shadows: [...shadows].slice(0, 12),
    letterSpacings: [...letterSpacings].slice(0, 15),
    transitions: [...transitions].slice(0, 10),
    buttonClasses: [...buttonClasses].slice(0, 10),
    title, metaDesc, ogSiteName, bodyText,
    h1s: h1s.slice(0, 5), h2s: h2s.slice(0, 8),
    pageUrl: url,
  }
}

// ─── Claude: deep brand website analysis ───────────────────────────────────────
async function analyzeBrandWebsite(scrapedData, url, screenshotBase64) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY environment variable is not set')

  const prompt = `You are a senior design systems analyst with 15 years of experience reverse-engineering production design systems for documentation purposes. You are analyzing: ${url}

You have been given:
1. A screenshot of the homepage (if provided) — use this to understand actual layout, composition, photography style, and component arrangement, not just colors.
2. Scraped CSS data from multiple pages of this site, each tagged with its page type (about/work/pricing/etc).

SCRAPED DATA (CSS tokens, copy, structural signals across ${scrapedData.pagesScraped} pages):
${JSON.stringify(scrapedData, null, 2)}

YOUR JOB: Go deep, not wide. Don't just list tokens — explain the REASONING behind design decisions, the way a design director would when briefing a new hire on "why we do things this way here." For every major decision (color choice, type weight, button shape, spacing rhythm), articulate WHY it likely serves the brand's positioning, not just WHAT the value is.

Also determine:
- Is this a CORPORATE BRAND/COMPANY website, or a PERSONAL DESIGNER/FREELANCER portfolio? Look at the copy voice, structure, and content for signals (first-person voice, "my work", personal name in title = portfolio; "we", "our team", company structure = brand).
- What INDUSTRY/CATEGORY tags apply? (e.g. "fintech", "developer-tools", "e-commerce", "saas-b2b", "creative-agency", "consumer-app", "healthcare", "education", "luxury-goods", "media-entertainment", "crypto-web3", "ai-ml", "design-portfolio", "marketing-agency" — pick 2-4 that genuinely fit, don't force it)

Return ONLY valid JSON. No markdown fences. No preamble. No explanation outside the JSON.
Use null for genuinely unknowable fields — never the string "unknown".

{
  "brand": {
    "name": "brand or designer name",
    "url": "${url}",
    "siteType": "brand-website or designer-portfolio",
    "siteTypeReasoning": "1 sentence explaining which signals led to this classification",
    "industryTags": ["tag1", "tag2", "tag3"],
    "atmosphere": "3-4 sentences describing the visual atmosphere AND the underlying design philosophy — what is this system trying to communicate and why does it look the way it does"
  },
  "designPhilosophy": {
    "coreIdea": "1-2 sentences: what is the single organizing idea behind this entire visual system? What is it optimizing for?",
    "positioningSignal": "1-2 sentences: what does this design communicate about the brand's market position (premium/accessible/technical/playful/trustworthy/etc) and how do the visual choices support that"
  },
  "colors": {
    "primary": "#hex",
    "canvas": "#hex",
    "ink": "#hex",
    "accent": "#hex or null",
    "secondary": "#hex",
    "border": "#hex",
    "surface": "#hex",
    "others": ["#hex", "#hex", "#hex"],
    "reasoning": "2-3 sentences on WHY this palette — what role does the primary color play, why this canvas temperature, what's deliberately absent"
  },
  "typography": {
    "displayFamily": "font name",
    "bodyFamily": "font name",
    "displayWeight": "number",
    "bodyWeight": "number",
    "displaySize": "px",
    "bodySize": "px",
    "tracking": "description of letter-spacing approach with actual values where found",
    "weightContrastStrategy": "how display weight relates to body weight and why (e.g. 'heavy display + light body for editorial authority')",
    "notes": "other notable type decisions"
  },
  "spacing": {
    "baseUnit": "px",
    "sectionPadding": "px",
    "cardPadding": "px",
    "density": "compact or balanced or generous",
    "reasoning": "why this density level fits the product category"
  },
  "shape": {
    "buttonRadius": "px",
    "cardRadius": "px",
    "philosophy": "pill or tight or sharp or binary",
    "reasoning": "what this radius choice signals about the brand (friendly/technical/luxury/etc)"
  },
  "elevation": {
    "shadowStyle": "none or single-tier or layered or surface-contrast",
    "definition": "actual box-shadow value or empty string",
    "reasoning": "why this elevation approach — does photography/surface-contrast replace shadow, or is shadow doing real work here"
  },
  "motion": {
    "transitionTimings": ["values found in transitions data"],
    "observedPattern": "describe the general motion philosophy if transitions data suggests one (fast/snappy vs slow/deliberate)"
  },
  "components": [
    {
      "name": "kebab-case-component-name like 'button-primary' or 'hero-band'",
      "description": "2-4 sentences describing this component's visual treatment, layout, and purpose — written the way a design system document would describe it, referencing actual structural signals from the scraped data where possible"
    }
  ],
  "voice": {
    "canvasTemperature": "dark or light or warm-light",
    "brandPersonality": "3 adjectives",
    "antiPatterns": ["4-6 things this system deliberately avoids, inferred from what's absent or from the category norms it's NOT following"],
    "signature": "the single most distinctive visual element of this system"
  },
  "principles": [
    "6-10 transferable design principles extracted from this system, each a full sentence explaining both the pattern AND its underlying rationale"
  ],
  "knownGaps": [
    "Be honest about what could NOT be reliably determined from the scraped data and screenshot — e.g. 'Exact font file could not be confirmed, inferred from font-family declaration only' or 'Only homepage and 2 internal pages were analyzed; deeper page types like checkout or dashboard were not in scope'"
  ],
  "tokens": {
    "css": ":root {\n  --primary: #hex;\n  --canvas: #hex;\n  --ink: #hex;\n  --accent: #hex;\n  --border: #hex;\n  --surface: #hex;\n  --font-display: 'Name';\n  --font-body: 'Name';\n  --radius-button: Xpx;\n  --radius-card: Xpx;\n}"
  }
}

Generate AT LEAST 5 entries in the "components" array, identifying real, specific components you can infer from the data (buttons, nav, hero section, cards, footer, inputs — whatever applies). Be specific to what you observed, not generic.`

  const content = screenshotBase64
    ? [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshotBase64 } },
        { type: 'text', text: prompt },
      ]
    : prompt

  return callClaude(content, 6000)
}

// ─── Behance / Dribbble: screenshot → validate → Claude Vision ───────────────
async function handlePlatformUrl(url, urlTypeInfo) {
  let ssBuffer
  try {
    const ssRes = await blFetch('screenshot', makeScreenshotBody(url, false))
    ssBuffer = await ssRes.arrayBuffer()
  } catch (err) {
    const platform = urlTypeInfo.platform === 'behance' ? 'Behance' : 'Dribbble'
    throw new Error(
      `${platform} blocked this request at the network level (${err.message}). ` +
      `${platform} runs bot-detection that rejects automated browsers at the IP/fingerprint level — ` +
      `this is a known platform-side limitation with no reliable code-level workaround currently. ` +
      `Try a brand website instead, which works reliably.`
    )
  }

  const bytes = ssBuffer.byteLength
  if (bytes < 8000) {
    const platform = urlTypeInfo.platform === 'behance' ? 'Behance' : 'Dribbble'
    throw new Error(
      `${platform} returned a blank or error screen instead of page content (${bytes} bytes). ` +
      `${platform} actively blocks automated browser access. This is a platform-side limitation, not a URL problem. ` +
      `Try a brand website URL instead.`
    )
  }

  const base64Screenshot = Buffer.from(ssBuffer).toString('base64')

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

  const checkPrompt = `Look at this screenshot. Reply with ONLY this JSON, nothing else:
{"visible": true/false, "reason": "one sentence"}
Is this showing actual design work/portfolio content, or an error/login/blocked page?`

  const checkContent = [
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Screenshot } },
    { type: 'text', text: checkPrompt },
  ]
  const checkResult = await callClaude(checkContent, 200)
  let visible = true
  let checkReason = ''
  try {
    const parsed = typeof checkResult === 'object' ? checkResult : JSON.parse(checkResult)
    visible = parsed.visible !== false
    checkReason = parsed.reason || ''
  } catch { /* assume visible if parse fails */ }

  if (!visible) {
    throw new Error(
      `No design work visible in the screenshot: ${checkReason} ` +
      `Try a public profile URL instead of a specific project link.`
    )
  }

  return analyzeVisualScreenshot(base64Screenshot, pageContext, url, urlTypeInfo)
}

async function analyzeVisualScreenshot(base64Screenshot, pageContext, url, urlTypeInfo) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY environment variable is not set')

  const platform = urlTypeInfo.platform === 'behance' ? 'Behance' : 'Dribbble'
  const contentType = urlTypeInfo.type.includes('profile') ? 'portfolio profile' : 'design project'

  const prompt = `You are a senior design systems analyst examining a ${platform} ${contentType} screenshot.

CRITICAL: Analyze ONLY the design WORK visible — never ${platform}'s own UI chrome (their nav, background, buttons).

Page title: ${pageContext.title}
Context: ${pageContext.bodyText.slice(0, 400)}
URL: ${url}

This is almost certainly a DESIGNER PORTFOLIO, not a brand website. Classify accordingly.
Also infer 2-4 industry/category tags this designer's work seems to specialize in (e.g. "branding", "ui-ux", "illustration", "motion-design", "packaging", "editorial-design", "3d-rendering", "typography", "web-design").

Return ONLY valid JSON. No markdown. No preamble. Use null for unknowable fields:

{
  "brand": {
    "name": "designer or project name",
    "url": "${url}",
    "siteType": "designer-portfolio",
    "siteTypeReasoning": "1 sentence",
    "industryTags": ["tag1", "tag2"],
    "atmosphere": "3-4 sentences on this designer's visual style and underlying creative philosophy"
  },
  "designPhilosophy": {
    "coreIdea": "1-2 sentences on the organizing idea behind this designer's visual approach",
    "positioningSignal": "1-2 sentences on what this work communicates about the designer's specialization and market position"
  },
  "colors": {
    "primary": "#hex", "canvas": "#hex", "ink": "#hex",
    "accent": "#hex or null", "secondary": "#hex or null",
    "border": "#hex or null", "surface": "#hex or null",
    "others": ["#hex values from the work"],
    "reasoning": "why this palette serves the work shown"
  },
  "typography": {
    "displayFamily": "describe style if not identifiable by name",
    "bodyFamily": "describe style",
    "displayWeight": "number or null", "bodyWeight": "number or null",
    "displaySize": "estimated or null", "bodySize": "estimated or null",
    "tracking": "tight or loose or normal",
    "weightContrastStrategy": "observation if apparent",
    "notes": "observations from visible work"
  },
  "spacing": {
    "baseUnit": "estimated or null", "sectionPadding": "estimated or null",
    "cardPadding": "estimated or null", "density": "compact or balanced or generous",
    "reasoning": "why this density fits the work"
  },
  "shape": {
    "buttonRadius": "estimated or null", "cardRadius": "estimated or null",
    "philosophy": "pill or tight or sharp or binary",
    "reasoning": "what this signals about the designer's aesthetic"
  },
  "elevation": {
    "shadowStyle": "none or single-tier or layered or surface-contrast",
    "definition": "", "reasoning": "observation"
  },
  "motion": { "transitionTimings": [], "observedPattern": null },
  "components": [
    {"name": "kebab-case-name", "description": "2-4 sentences on a visual pattern observed in this designer's work"}
  ],
  "voice": {
    "canvasTemperature": "dark or light or warm-light",
    "brandPersonality": "3 adjectives",
    "antiPatterns": ["things absent from this work"],
    "signature": "most distinctive visual element"
  },
  "principles": ["5-8 design principles apparent from this work, each explaining pattern + rationale"],
  "knownGaps": ["honest notes on what could not be determined from a single screenshot"],
  "tokens": { "css": ":root {\n  /* Visual estimate */\n  --primary: #hex;\n  --canvas: #hex;\n  --ink: #hex;\n}" }
}

Generate AT LEAST 3 entries in "components" based on visual patterns you can actually see.`

  const content = [
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Screenshot } },
    { type: 'text', text: prompt },
  ]

  const designSystem = await callClaude(content, 5000)
  return { designSystem, pagesScraped: 1, method: 'visual-analysis' }
}

// ─── Claude API ────────────────────────────────────────────────────────────────
async function callClaude(content, maxTokens = 4000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
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

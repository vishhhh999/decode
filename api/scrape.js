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
    // /gallery/ID/Title = project page
    // /username = profile page
    const parts = pathname.split('/').filter(Boolean)
    if (parts[0] === 'gallery') return { type: 'behance-project', platform: 'behance' }
    return { type: 'behance-profile', platform: 'behance' }
  }

  if (host === 'dribbble.com' || host.endsWith('.dribbble.com')) {
    const parts = pathname.split('/').filter(Boolean)
    // /shots/ID = single shot, /username = profile
    if (parts[0] === 'shots') return { type: 'dribbble-shot', platform: 'dribbble' }
    return { type: 'dribbble-profile', platform: 'dribbble' }
  }

  return { type: 'website', platform: null }
}

// ─── Browserless: screenshot + pixel analysis (for Behance/Dribbble) ──────────
async function screenshotAndAnalyze(url) {
  if (!BROWSERLESS_TOKEN) throw new Error('BROWSERLESS_TOKEN not set')

  // Step 1: Get a screenshot as base64
  const screenshotRes = await fetch(
    `https://chrome.browserless.io/screenshot?token=${BROWSERLESS_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        options: { type: 'jpeg', quality: 80, fullPage: false },
        viewport: { width: 1440, height: 900 },
        waitFor: 3000,
      }),
    }
  )

  if (!screenshotRes.ok) {
    const t = await screenshotRes.text().catch(() => screenshotRes.status.toString())
    throw new Error(`Screenshot failed ${screenshotRes.status}: ${t.slice(0, 200)}`)
  }

  const screenshotBuffer = await screenshotRes.arrayBuffer()
  const base64Screenshot = Buffer.from(screenshotBuffer).toString('base64')

  // Step 2: Also get page text content for context (title, project name, description)
  const contentRes = await fetch(
    `https://chrome.browserless.io/content?token=${BROWSERLESS_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, waitFor: 2000 }),
    }
  )

  let pageContext = { title: '', bodyText: '' }
  if (contentRes.ok) {
    const html = await contentRes.text()
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    pageContext.title = titleMatch ? titleMatch[1].trim() : ''
    pageContext.bodyText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)
  }

  return { base64Screenshot, pageContext, method: 'screenshot' }
}

// ─── Browserless: full CSS extraction (for brand websites) ────────────────────
async function extractBrandStyles(url) {
  if (!BROWSERLESS_TOKEN) throw new Error('BROWSERLESS_TOKEN not set')

  // Use /content for raw HTML (most reliable across Browserless plans)
  const contentRes = await fetch(
    `https://chrome.browserless.io/content?token=${BROWSERLESS_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        waitFor: 3000,
        setJavaScriptEnabled: true,
      }),
    }
  )

  if (!contentRes.ok) {
    const t = await contentRes.text().catch(() => contentRes.status.toString())
    throw new Error(`Browserless error ${contentRes.status}: ${t.slice(0, 200)}`)
  }

  const html = await contentRes.text()
  return parseHtmlForTokens(html, url)
}

// ─── Parse HTML for design tokens ─────────────────────────────────────────────
function parseHtmlForTokens(html, url) {
  const cssVars = {}
  const colors = new Set()
  const fonts = new Set()
  const radii = new Set()
  const fontWeights = new Set()
  const fontSizes = new Set()

  // Extract all <style> blocks and inline styles
  const styleBlocks = []
  const styleTagMatches = html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)
  for (const m of styleTagMatches) styleBlocks.push(m[1])

  // Also grab any CSS from <link> referenced stylesheets (can't fetch those, but get inline)
  const allCss = styleBlocks.join('\n')

  // CSS custom properties
  const varMatches = allCss.matchAll(/(--[\w-]+)\s*:\s*([^;}\n]+)/g)
  for (const m of varMatches) {
    const key = m[1].trim()
    const val = m[2].trim()
    if (val && val.length < 100) cssVars[key] = val
  }

  // Hex colors from all CSS
  const hexMatches = allCss.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)
  for (const m of hexMatches) {
    const hex = m[1].length === 3
      ? '#' + m[1].split('').map(c => c + c).join('')
      : '#' + m[1]
    colors.add(hex.toLowerCase())
  }

  // RGB/RGBA colors
  const rgbMatches = allCss.matchAll(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+[^)]*\)/g)
  for (const m of rgbMatches) colors.add(m[0])

  // Font families from CSS
  const fontMatches = allCss.matchAll(/font-family\s*:\s*([^;}\n]+)/gi)
  for (const m of fontMatches) {
    const families = m[1].split(',').map(f => f.trim().replace(/['"]/g, '').trim())
    families.forEach(f => {
      if (f && !['sans-serif', 'serif', 'monospace', 'inherit', 'initial', 'unset'].includes(f.toLowerCase())) {
        fonts.add(f)
      }
    })
  }

  // Font weights
  const weightMatches = allCss.matchAll(/font-weight\s*:\s*(\d{3}|bold|normal|lighter|bolder)/gi)
  for (const m of weightMatches) fontWeights.add(m[1])

  // Font sizes (collect unique px values used for display/heading sizes)
  const sizeMatches = allCss.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?(?:px|rem|em))/gi)
  for (const m of sizeMatches) fontSizes.add(m[1])

  // Border radii
  const radiiMatches = allCss.matchAll(/border-radius\s*:\s*([^;}\n]+)/gi)
  for (const m of radiiMatches) {
    const r = m[1].trim()
    if (r && r !== '0' && r !== '0px') radii.add(r)
  }

  // Page meta
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : ''

  const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)
  const metaDesc = metaDescMatch ? metaDescMatch[1] : ''

  // Visible text (strip all tags)
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000)

  // H1 text
  const h1Matches = html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)
  const h1s = []
  for (const m of h1Matches) {
    const text = m[1].replace(/<[^>]+>/g, '').trim()
    if (text) h1s.push(text)
  }

  // Filter colors: remove near-black and near-white unless they're intentional brand colors
  // Keep all unique colors for Claude to interpret
  const colorArray = Array.from(colors)
    .filter(c => c.startsWith('#'))
    .slice(0, 80)

  return {
    cssVars,
    colors: colorArray,
    fonts: Array.from(fonts).slice(0, 20),
    fontWeights: Array.from(fontWeights),
    fontSizes: Array.from(fontSizes).slice(0, 20),
    radii: Array.from(radii).slice(0, 20),
    title,
    metaDesc,
    bodyText,
    h1s: h1s.slice(0, 5),
    pageUrl: url,
    method: 'css-extraction',
  }
}

// ─── Crawl a few internal pages for richer token data ─────────────────────────
// Sequential with per-page timeout to stay within the 60s function limit
const INTERNAL_PATHS = ['/about', '/work', '/projects', '/pricing', '/products']

async function crawlInternalPages(baseUrl, timeRemaining) {
  const results = []
  const base = new URL(baseUrl)

  // Only crawl if we have at least 20s left
  if (timeRemaining < 20000) return results

  for (const path of INTERNAL_PATHS.slice(0, 2)) {
    if (Date.now() - global._startTime > 40000) break // hard stop at 40s total
    try {
      const pageUrl = base.origin + path
      const data = await extractBrandStyles(pageUrl)
      if (data) results.push(data)
    } catch {
      // page doesn't exist or timed out — skip
    }
  }

  return results
}

// ─── Claude: analyze brand website token data ──────────────────────────────────
async function analyzeBrandWebsite(scrapedData, url) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')

  const prompt = `You are a senior design systems analyst. You have been given CSS and token data scraped from the brand website: ${url}

This data is from the brand's OWN website — NOT a third-party platform. Analyze it and extract their design system.

SCRAPED DATA:
${JSON.stringify(scrapedData, null, 2)}

Important analysis notes:
- The cssVars object contains CSS custom properties defined in their stylesheets — these are the most reliable token source
- The colors array contains hex values extracted from their CSS — identify which are brand/primary colors vs background vs text
- The fonts array contains font families they actually use
- The radii array contains border-radius values from their buttons, cards, inputs
- The h1s and bodyText give you context about what the brand does and their copy voice
- Ignore any colors/fonts that look like browser defaults or common utility libraries (e.g. pure #000000 from resets, or 'Arial' as a fallback)

Return ONLY valid JSON, no markdown fences, no preamble:

{
  "brand": {
    "name": "infer from title/domain/bodyText",
    "url": "${url}",
    "type": "website",
    "atmosphere": "2-3 sentences describing the visual atmosphere and philosophy based on the token data"
  },
  "colors": {
    "primary": "most prominent brand/action color as hex",
    "canvas": "background color as hex",
    "ink": "primary text color as hex",
    "accent": "secondary accent hex if distinct",
    "secondary": "muted/secondary text hex",
    "border": "border/divider color hex",
    "surface": "card/panel background hex",
    "others": ["up to 4 other notable hex values"]
  },
  "typography": {
    "displayFamily": "primary display/headline font",
    "bodyFamily": "body text font",
    "displayWeight": "weight used for headlines (number)",
    "bodyWeight": "weight used for body (number)",
    "displaySize": "largest font size found in px",
    "bodySize": "body text size in px",
    "tracking": "describe letter-spacing approach from the data",
    "notes": "any other notable type decisions"
  },
  "spacing": {
    "baseUnit": "infer base unit from spacing values",
    "sectionPadding": "vertical section padding",
    "cardPadding": "card internal padding",
    "density": "compact or balanced or generous"
  },
  "shape": {
    "buttonRadius": "button border-radius from radii data",
    "cardRadius": "card border-radius from radii data",
    "philosophy": "pill or tight or sharp or binary"
  },
  "elevation": {
    "shadowStyle": "none or single-tier or layered or surface-contrast",
    "definition": "actual box-shadow CSS value if found in data, else empty string"
  },
  "voice": {
    "canvasTemperature": "dark or light or warm-light",
    "brandPersonality": "3 adjectives based on visual data",
    "antiPatterns": ["3-5 things this system avoids based on what's absent from the data"],
    "signature": "the single most distinctive visual element"
  },
  "principles": [
    "5-8 transferable design principles extracted from this system, each a full sentence"
  ],
  "tokens": {
    "css": ":root {\n  --primary: #hex;\n  --canvas: #hex;\n  --ink: #hex;\n  --accent: #hex;\n  --border: #hex;\n  --surface: #hex;\n  --font-display: 'FontName';\n  --font-body: 'FontName';\n  --radius-button: Xpx;\n  --radius-card: Xpx;\n}"
  }
}`

  return callClaude(prompt, false)
}

// ─── Claude: analyze Behance/Dribbble via screenshot (Claude Vision) ──────────
async function analyzeVisualScreenshot(screenshotData, url, urlTypeInfo) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')

  const { base64Screenshot, pageContext } = screenshotData
  const platformName = urlTypeInfo.platform === 'behance' ? 'Behance' : 'Dribbble'
  const contentType = urlTypeInfo.type.includes('profile') ? 'portfolio profile' : 'design project'

  const prompt = `You are a senior design systems analyst. You are looking at a screenshot of a ${platformName} ${contentType} page.

IMPORTANT: This is a ${platformName} page. You must analyze ONLY the designer's work/style visible in the screenshot — NOT ${platformName}'s own UI chrome (their nav, their background, their buttons). Focus entirely on the design work being showcased.

Page title: ${pageContext.title}
Page context: ${pageContext.bodyText.slice(0, 500)}
URL: ${url}

From the screenshot, analyze:
- The color palette used IN the design work (not ${platformName}'s UI)
- The typography style apparent in the work (if visible)
- The visual aesthetic, spacing, and composition of the showcased designs
- The designer's apparent style, preferences, and signature visual choices
- What this designer's personal design system seems to be based on their work

Return ONLY valid JSON, no markdown fences, no preamble:

{
  "brand": {
    "name": "designer/project name from title",
    "url": "${url}",
    "type": "${urlTypeInfo.type}",
    "atmosphere": "2-3 sentences describing the designer's visual style and aesthetic based on their work"
  },
  "colors": {
    "primary": "dominant color in the work as hex (best estimate)",
    "canvas": "background color used in the work",
    "ink": "text/primary color in the work",
    "accent": "accent color if present",
    "secondary": "secondary color",
    "border": "border/divider color if apparent",
    "surface": "card/panel color if apparent",
    "others": ["other notable colors visible in the work"]
  },
  "typography": {
    "displayFamily": "font style apparent in headlines (describe if not identifiable)",
    "bodyFamily": "body font style",
    "displayWeight": "apparent weight",
    "bodyWeight": "apparent weight",
    "displaySize": "estimated size",
    "bodySize": "estimated size",
    "tracking": "tight/loose/normal based on what you see",
    "notes": "any notable type observations"
  },
  "spacing": {
    "baseUnit": "estimated",
    "sectionPadding": "estimated from the work",
    "cardPadding": "estimated",
    "density": "compact or balanced or generous"
  },
  "shape": {
    "buttonRadius": "apparent from UI elements in work",
    "cardRadius": "apparent from cards/containers in work",
    "philosophy": "pill or tight or sharp or binary"
  },
  "elevation": {
    "shadowStyle": "none or single-tier or layered or surface-contrast",
    "definition": ""
  },
  "voice": {
    "canvasTemperature": "dark or light or warm-light",
    "brandPersonality": "3 adjectives describing this designer's visual style",
    "antiPatterns": ["things absent from or avoided in this work"],
    "signature": "the single most distinctive visual element of this designer's style"
  },
  "principles": [
    "5-8 design principles apparent from this designer's work"
  ],
  "tokens": {
    "css": ":root {\n  /* Estimated tokens from visual analysis */\n  --primary: #hex;\n  --canvas: #hex;\n  --ink: #hex;\n}"
  }
}`

  return callClaude(prompt, true, base64Screenshot)
}

// ─── Claude API call (with optional vision) ────────────────────────────────────
async function callClaude(prompt, withImage = false, base64Image = null) {
  const content = withImage && base64Image
    ? [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: base64Image },
        },
        { type: 'text', text: prompt },
      ]
    : prompt

  const response = await fetch('https://api.anthropic.com/v1/messages', {
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

  if (!response.ok) {
    const t = await response.text().catch(() => response.status.toString())
    throw new Error(`Claude API error ${response.status}: ${t.slice(0, 200)}`)
  }

  const result = await response.json()
  const text = result.content[0].text.trim()

  // Strip any markdown fences Claude might add
  const clean = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()

  try {
    return JSON.parse(clean)
  } catch {
    const match = clean.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error('Claude returned invalid JSON')
  }
}

// ─── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url } = req.body || {}
  if (!url) return res.status(400).json({ error: 'URL required' })

  res.setHeader('Content-Type', 'application/json')

  global._startTime = Date.now()

  try {
    const urlTypeInfo = getUrlType(url)

    // ── BEHANCE / DRIBBBLE: screenshot + Claude Vision ──────────────────────
    if (urlTypeInfo.platform === 'behance' || urlTypeInfo.platform === 'dribbble') {
      let screenshotData
      try {
        screenshotData = await screenshotAndAnalyze(url)
      } catch (err) {
        return res.status(500).json({
          error: `Failed to screenshot ${url}: ${err.message}`,
        })
      }

      const designSystem = await analyzeVisualScreenshot(screenshotData, url, urlTypeInfo)

      return res.status(200).json({
        success: true,
        pagesScraped: 1,
        method: 'visual-analysis',
        designSystem,
      })
    }

    // ── BRAND WEBSITE: CSS extraction + crawl ──────────────────────────────
    let homepageData
    try {
      homepageData = await extractBrandStyles(url)
    } catch (err) {
      return res.status(500).json({
        error: `Failed to scrape ${url}: ${err.message}`,
      })
    }

    // Crawl a couple internal pages if time allows
    const elapsed = Date.now() - global._startTime
    const internalPages = await crawlInternalPages(url, 60000 - elapsed)

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

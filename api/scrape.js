// api/scrape.js — Vercel serverless function
// Uses Browserless for headless scraping + Claude API for reasoning

export const config = { maxDuration: 60 }

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// Pages to crawl per site (beyond homepage)
const CRAWL_PATHS = ['/about', '/work', '/projects', '/contact', '/pricing', '/products', '/services', '/blog']

async function scrapeWithBrowserless(url) {
  const endpoint = `https://chrome.browserless.io/scrape?token=${BROWSERLESS_TOKEN}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      elements: [
        { selector: 'body' },
        { selector: 'style' },
        { selector: 'link[rel="stylesheet"]' },
      ],
      waitFor: 2000,
    }),
  })

  if (!response.ok) throw new Error(`Browserless error: ${response.status}`)
  return response.json()
}

async function getPageStyles(url) {
  const endpoint = `https://chrome.browserless.io/function?token=${BROWSERLESS_TOKEN}`

  const fn = `
    module.exports = async ({ page }) => {
      await page.goto('${url}', { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForTimeout(2000);

      const data = await page.evaluate(() => {
        // Extract CSS custom properties from :root
        const styles = getComputedStyle(document.documentElement);
        const cssVars = {};
        for (const prop of styles) {
          if (prop.startsWith('--')) {
            cssVars[prop] = styles.getPropertyValue(prop).trim();
          }
        }

        // Extract font families in use
        const fonts = new Set();
        document.querySelectorAll('*').forEach(el => {
          const ff = getComputedStyle(el).fontFamily;
          if (ff) fonts.add(ff);
        });

        // Extract colors from computed styles (sample)
        const colors = new Set();
        const colorProps = ['color', 'background-color', 'border-color', 'fill', 'stroke'];
        document.querySelectorAll('h1,h2,h3,p,a,button,nav,header,footer,[class*="btn"],[class*="button"]').forEach(el => {
          const cs = getComputedStyle(el);
          colorProps.forEach(prop => {
            const val = cs.getPropertyValue(prop);
            if (val && val !== 'rgba(0, 0, 0, 0)' && val !== 'transparent') {
              colors.add(val);
            }
          });
        });

        // Extract font sizes and weights
        const typography = [];
        document.querySelectorAll('h1,h2,h3,h4,p,button,a,nav *').forEach(el => {
          const cs = getComputedStyle(el);
          typography.push({
            tag: el.tagName.toLowerCase(),
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            lineHeight: cs.lineHeight,
            letterSpacing: cs.letterSpacing,
            fontFamily: cs.fontFamily.split(',')[0].trim(),
          });
        });

        // Extract border radii
        const radii = new Set();
        document.querySelectorAll('button,input,[class*="card"],[class*="btn"],[class*="button"]').forEach(el => {
          const r = getComputedStyle(el).borderRadius;
          if (r && r !== '0px') radii.add(r);
        });

        // Page title and meta
        const title = document.title;
        const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
        const bodyText = document.body.innerText.slice(0, 2000);

        // Screenshot-able component list
        const components = [];
        ['button', 'input', 'nav', 'header', 'footer', 'form', '[class*="card"]', '[class*="hero"]'].forEach(sel => {
          const els = document.querySelectorAll(sel);
          els.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              components.push({
                selector: sel,
                text: el.innerText?.slice(0, 100),
                classes: el.className,
              });
            }
          });
        });

        return {
          cssVars,
          fonts: Array.from(fonts).slice(0, 20),
          colors: Array.from(colors).slice(0, 50),
          typography: typography.slice(0, 30),
          radii: Array.from(radii).slice(0, 20),
          title,
          metaDesc,
          bodyText,
          components: components.slice(0, 20),
          pageUrl: window.location.href,
        };
      });

      return data;
    };
  `

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: fn }),
  })

  if (!response.ok) throw new Error(`Browserless function error: ${response.status}`)
  return response.json()
}

async function crawlInternalPages(baseUrl) {
  const results = []
  const base = new URL(baseUrl)

  // Try known paths
  const attempts = CRAWL_PATHS.map(p => base.origin + p)

  // Crawl up to 4 additional pages in parallel
  const crawlPromises = attempts.slice(0, 4).map(async (url) => {
    try {
      const data = await getPageStyles(url)
      if (data) results.push({ url, data })
    } catch {
      // page doesn't exist, skip silently
    }
  })

  await Promise.allSettled(crawlPromises)
  return results
}

async function generateDesignSystem(scrapedData, url) {
  const prompt = `You are a senior design systems analyst. Analyze this scraped data from ${url} and generate a comprehensive design system analysis.

SCRAPED DATA:
${JSON.stringify(scrapedData, null, 2)}

Generate a structured design system analysis in this EXACT JSON format. Be specific with actual values extracted from the data. For anything you can confidently infer, include it. Do not include placeholder values.

Return ONLY valid JSON, no markdown, no explanation:

{
  "brand": {
    "name": "string — brand name",
    "url": "string",
    "type": "string — website/portfolio/behance/dribbble",
    "atmosphere": "string — 2-3 sentence description of the visual atmosphere and philosophy"
  },
  "colors": {
    "primary": "hex or rgb",
    "canvas": "hex or rgb — background color",
    "ink": "hex or rgb — primary text",
    "accent": "hex or rgb — brand accent if present",
    "secondary": "hex or rgb — secondary text",
    "border": "hex or rgb",
    "surface": "hex or rgb — card/panel background",
    "others": ["array of other notable colors"]
  },
  "typography": {
    "displayFamily": "font family name for headlines",
    "bodyFamily": "font family name for body",
    "displayWeight": "number",
    "bodyWeight": "number",
    "displaySize": "px value at hero",
    "bodySize": "px value",
    "tracking": "description of letter-spacing approach",
    "notes": "any notable type decisions"
  },
  "spacing": {
    "baseUnit": "px",
    "sectionPadding": "px — vertical section breathing room",
    "cardPadding": "px",
    "density": "compact/balanced/generous"
  },
  "shape": {
    "buttonRadius": "px",
    "cardRadius": "px",
    "philosophy": "string — pill/tight/sharp/binary"
  },
  "elevation": {
    "shadowStyle": "string — none/single-tier/layered/surface-contrast",
    "definition": "string — actual shadow value if present"
  },
  "voice": {
    "canvasTemperature": "dark/light/warm-light",
    "brandPersonality": "string — 3 adjectives",
    "antiPatterns": ["what this brand explicitly avoids"],
    "signature": "string — the ONE thing this visual system is remembered for"
  },
  "principles": [
    "string — 5-8 transferable design principles extracted from this system"
  ],
  "tokens": {
    "css": "string — ready-to-use CSS custom properties block"
  }
}`

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
      messages: [{
        role: 'user',
        content: prompt,
      }],
    }),
  })

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`)
  const result = await response.json()
  const text = result.content[0].text.trim()

  // Strip markdown fences if present
  const clean = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
  return JSON.parse(clean)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL required' })

  // Set headers for streaming-style response
  res.setHeader('Content-Type', 'application/json')

  try {
    // Step 1: Scrape homepage
    let homepageData
    try {
      homepageData = await getPageStyles(url)
    } catch (err) {
      return res.status(500).json({ error: `Failed to scrape ${url}: ${err.message}` })
    }

    // Step 2: Crawl internal pages (best effort)
    let internalPages = []
    try {
      internalPages = await crawlInternalPages(url)
    } catch {
      // non-fatal — proceed with homepage data only
    }

    // Merge all scraped data
    const allData = {
      homepage: homepageData,
      internalPages: internalPages.map(p => ({ url: p.url, ...p.data })),
      pagesScraped: 1 + internalPages.length,
    }

    // Step 3: Generate design system via Claude
    const designSystem = await generateDesignSystem(allData, url)

    return res.status(200).json({
      success: true,
      pagesScraped: allData.pagesScraped,
      designSystem,
    })
  } catch (err) {
    console.error('DECODE error:', err)
    return res.status(500).json({ error: err.message || 'Analysis failed' })
  }
}

// api/test.js — quick health check for your API keys
export default async function handler(req, res) {
  const browserless = !!process.env.BROWSERLESS_TOKEN
  const anthropic = !!process.env.ANTHROPIC_API_KEY

  // Ping Browserless to verify the token actually works
  let browserlessOk = false
  let browserlessError = ''
  if (browserless) {
    try {
      // Use the simplest possible Browserless endpoint — just check auth
      const r = await fetch('https://production-sfo.browserless.io/chromium/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.BROWSERLESS_TOKEN}`,
        },
        body: JSON.stringify({ url: 'https://example.com', waitFor: 500 }),
      })
      browserlessOk = r.status < 500
      if (!browserlessOk) {
        const t = await r.text().catch(() => r.status.toString())
        browserlessError = `Status ${r.status}: ${t.slice(0, 100)}`
      }
    } catch (e) {
      browserlessError = e.message
    }
  }

  return res.status(200).json({
    browserless: { set: browserless, ok: browserlessOk, error: browserlessError || null },
    anthropic: { set: anthropic },
    ready: browserlessOk && anthropic,
  })
}

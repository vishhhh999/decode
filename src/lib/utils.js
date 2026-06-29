export function normalizeUrl(input) {
  let url = input.trim()
  if (!url) return null
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  try {
    const parsed = new URL(url)
    return parsed.href
  } catch {
    return null
  }
}

export function getDomain(url) {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function getBrandName(url) {
  const domain = getDomain(url)
  // Handle known platforms
  if (domain.includes('behance.net')) {
    const parts = url.split('/').filter(Boolean)
    return parts[parts.length - 1] || 'Behance Profile'
  }
  if (domain.includes('dribbble.com')) {
    const parts = url.split('/').filter(Boolean)
    return parts[parts.length - 1] || 'Dribbble Profile'
  }
  // Regular brand — use domain name
  return domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)
}

export function getSourceType(url) {
  const domain = getDomain(url)
  if (domain.includes('behance.net')) return 'behance'
  if (domain.includes('dribbble.com')) return 'dribbble'
  return 'website'
}

export function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatTime(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

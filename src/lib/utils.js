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
    const { hostname } = new URL(url)
    return hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function getBrandName(url) {
  try {
    const { hostname, pathname } = new URL(url)
    const host = hostname.replace(/^www\./, '')
    const parts = pathname.split('/').filter(Boolean)

    if (host === 'behance.net' || host.endsWith('.behance.net')) {
      if (parts[0] === 'gallery') {
        // /gallery/ID/ProjectTitle — use project title (last segment)
        return parts[2] ? decodeURIComponent(parts[2]).replace(/-/g, ' ') : 'Behance Project'
      }
      // /username — use username
      return parts[0] ? `@${parts[0]}` : 'Behance Profile'
    }

    if (host === 'dribbble.com' || host.endsWith('.dribbble.com')) {
      if (parts[0] === 'shots') {
        // /shots/ID-slug — use slug
        const slug = parts[1] ? parts[1].replace(/^\d+-/, '').replace(/-/g, ' ') : ''
        return slug || 'Dribbble Shot'
      }
      // /username
      return parts[0] ? `@${parts[0]}` : 'Dribbble Profile'
    }

    // Regular domain — capitalize domain name
    const name = host.split('.')[0]
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return url
  }
}

export function getSourceType(url) {
  try {
    const { hostname, pathname } = new URL(url)
    const host = hostname.replace(/^www\./, '')
    const parts = pathname.split('/').filter(Boolean)

    if (host === 'behance.net' || host.endsWith('.behance.net')) {
      return parts[0] === 'gallery' ? 'behance-project' : 'behance-profile'
    }
    if (host === 'dribbble.com' || host.endsWith('.dribbble.com')) {
      return parts[0] === 'shots' ? 'dribbble-shot' : 'dribbble-profile'
    }
    return 'website'
  } catch {
    return 'website'
  }
}

// Label shown in UI for source type
export function getSourceLabel(type) {
  const labels = {
    'website': 'Website',
    'behance-project': 'Behance Project',
    'behance-profile': 'Behance Profile',
    'dribbble-shot': 'Dribbble Shot',
    'dribbble-profile': 'Dribbble Profile',
  }
  return labels[type] || 'Website'
}

export function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatTime(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

// Generates a deep, BMW-style .md design system document from Claude's analysis JSON

export function generateMarkdown(ds, url, meta = {}) {
  const name = ds.brand?.name || 'Unknown'
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const lines = []

  // ── YAML frontmatter ──────────────────────────────────────────────
  lines.push('---')
  lines.push('version: alpha')
  lines.push(`name: ${slug}-design-analysis`)
  lines.push(`description: ${yamlEscape(ds.brand?.atmosphere || '')}`)
  lines.push('')
  lines.push(`siteType: ${ds.brand?.siteType || 'website'}`)
  if (ds.brand?.industryTags?.length) {
    lines.push(`industryTags: [${ds.brand.industryTags.map(t => `"${t}"`).join(', ')}]`)
  }
  lines.push('')
  lines.push('colors:')
  Object.entries(ds.colors || {}).forEach(([k, v]) => {
    if (k === 'others' || k === 'reasoning' || !v) return
    lines.push(`  ${toKebab(k)}: "${v}"`)
  })
  if (ds.colors?.others?.length) {
    ds.colors.others.forEach((c, i) => lines.push(`  other-${i + 1}: "${c}"`))
  }
  lines.push('')
  lines.push('typography:')
  lines.push('  display:')
  lines.push(`    fontFamily: "${ds.typography?.displayFamily || ''}"`)
  lines.push(`    fontSize: ${ds.typography?.displaySize || 'null'}`)
  lines.push(`    fontWeight: ${ds.typography?.displayWeight || 'null'}`)
  lines.push('  body:')
  lines.push(`    fontFamily: "${ds.typography?.bodyFamily || ''}"`)
  lines.push(`    fontSize: ${ds.typography?.bodySize || 'null'}`)
  lines.push(`    fontWeight: ${ds.typography?.bodyWeight || 'null'}`)
  lines.push('')
  lines.push('shape:')
  lines.push(`  buttonRadius: "${ds.shape?.buttonRadius || ''}"`)
  lines.push(`  cardRadius: "${ds.shape?.cardRadius || ''}"`)
  lines.push('')
  lines.push('spacing:')
  lines.push(`  base: "${ds.spacing?.baseUnit || ''}"`)
  lines.push(`  section: "${ds.spacing?.sectionPadding || ''}"`)
  lines.push(`  card: "${ds.spacing?.cardPadding || ''}"`)
  lines.push('---')
  lines.push('')

  // ── Overview ──────────────────────────────────────────────────────
  lines.push(`# ${name} — Design System Analysis`)
  lines.push('')
  lines.push(`**URL:** ${url}`)
  lines.push(`**Type:** ${ds.brand?.siteType === 'designer-portfolio' ? 'Designer Portfolio' : 'Brand Website'}${ds.brand?.siteTypeReasoning ? ` — ${ds.brand.siteTypeReasoning}` : ''}`)
  if (ds.brand?.industryTags?.length) {
    lines.push(`**Industry:** ${ds.brand.industryTags.join(' · ')}`)
  }
  if (meta.pagesScraped) {
    lines.push(`**Pages analyzed:** ${meta.pagesScraped}`)
  }
  lines.push('')
  lines.push(ds.brand?.atmosphere || '')
  lines.push('')

  // ── Design Philosophy ────────────────────────────────────────────
  if (ds.designPhilosophy?.coreIdea || ds.designPhilosophy?.positioningSignal) {
    lines.push('## Design Philosophy')
    lines.push('')
    if (ds.designPhilosophy.coreIdea) {
      lines.push(`**Core idea:** ${ds.designPhilosophy.coreIdea}`)
      lines.push('')
    }
    if (ds.designPhilosophy.positioningSignal) {
      lines.push(`**Positioning signal:** ${ds.designPhilosophy.positioningSignal}`)
      lines.push('')
    }
  }

  // ── Colors ────────────────────────────────────────────────────────
  lines.push('## Colors')
  lines.push('')
  lines.push('| Role | Value |')
  lines.push('|------|-------|')
  Object.entries(ds.colors || {}).forEach(([k, v]) => {
    if (k === 'others' || k === 'reasoning' || !v) return
    lines.push(`| ${toKebab(k)} | \`${v}\` |`)
  })
  if (ds.colors?.others?.length) {
    ds.colors.others.forEach((c, i) => lines.push(`| other-${i + 1} | \`${c}\` |`))
  }
  lines.push('')
  if (ds.colors?.reasoning) {
    lines.push(ds.colors.reasoning)
    lines.push('')
  }

  // ── Typography ────────────────────────────────────────────────────
  lines.push('## Typography')
  lines.push('')
  lines.push(`- **Display:** ${ds.typography?.displayFamily || '—'} · ${ds.typography?.displaySize || '—'} · weight ${ds.typography?.displayWeight || '—'}`)
  lines.push(`- **Body:** ${ds.typography?.bodyFamily || '—'} · ${ds.typography?.bodySize || '—'} · weight ${ds.typography?.bodyWeight || '—'}`)
  lines.push(`- **Tracking:** ${ds.typography?.tracking || '—'}`)
  if (ds.typography?.weightContrastStrategy) {
    lines.push(`- **Weight contrast strategy:** ${ds.typography.weightContrastStrategy}`)
  }
  if (ds.typography?.notes) {
    lines.push(`- **Notes:** ${ds.typography.notes}`)
  }
  lines.push('')

  // ── Shape & Radius ────────────────────────────────────────────────
  lines.push('## Shape & Radius')
  lines.push('')
  lines.push(`- **Button radius:** ${ds.shape?.buttonRadius || '—'}`)
  lines.push(`- **Card radius:** ${ds.shape?.cardRadius || '—'}`)
  lines.push(`- **Philosophy:** ${ds.shape?.philosophy || '—'}`)
  if (ds.shape?.reasoning) {
    lines.push('')
    lines.push(ds.shape.reasoning)
  }
  lines.push('')

  // ── Spacing ───────────────────────────────────────────────────────
  lines.push('## Spacing')
  lines.push('')
  lines.push(`- **Base unit:** ${ds.spacing?.baseUnit || '—'}`)
  lines.push(`- **Section padding:** ${ds.spacing?.sectionPadding || '—'}`)
  lines.push(`- **Card padding:** ${ds.spacing?.cardPadding || '—'}`)
  lines.push(`- **Density:** ${ds.spacing?.density || '—'}`)
  if (ds.spacing?.reasoning) {
    lines.push('')
    lines.push(ds.spacing.reasoning)
  }
  lines.push('')

  // ── Elevation ─────────────────────────────────────────────────────
  if (ds.elevation?.shadowStyle) {
    lines.push('## Elevation')
    lines.push('')
    lines.push(`**Style:** ${ds.elevation.shadowStyle}`)
    if (ds.elevation.definition) {
      lines.push('')
      lines.push('```css')
      lines.push(`box-shadow: ${ds.elevation.definition};`)
      lines.push('```')
    }
    if (ds.elevation.reasoning) {
      lines.push('')
      lines.push(ds.elevation.reasoning)
    }
    lines.push('')
  }

  // ── Motion ────────────────────────────────────────────────────────
  if (ds.motion?.observedPattern || ds.motion?.transitionTimings?.length) {
    lines.push('## Motion')
    lines.push('')
    if (ds.motion.observedPattern) lines.push(ds.motion.observedPattern)
    if (ds.motion.transitionTimings?.length) {
      lines.push('')
      lines.push('Observed transition values:')
      ds.motion.transitionTimings.forEach(t => lines.push(`- \`${t}\``))
    }
    lines.push('')
  }

  // ── Components ────────────────────────────────────────────────────
  if (ds.components?.length) {
    lines.push('## Components')
    lines.push('')
    ds.components.forEach(c => {
      lines.push(`### \`${c.name}\``)
      lines.push('')
      lines.push(c.description)
      lines.push('')
    })
  }

  // ── Brand Voice ───────────────────────────────────────────────────
  lines.push('## Brand Voice')
  lines.push('')
  lines.push(`- **Canvas:** ${ds.voice?.canvasTemperature || '—'}`)
  lines.push(`- **Personality:** ${ds.voice?.brandPersonality || '—'}`)
  lines.push(`- **Signature:** ${ds.voice?.signature || '—'}`)
  lines.push('')
  if (ds.voice?.antiPatterns?.length) {
    lines.push('### What this system avoids')
    lines.push('')
    ds.voice.antiPatterns.forEach(p => lines.push(`- ${p}`))
    lines.push('')
  }

  // ── Design Principles ─────────────────────────────────────────────
  if (ds.principles?.length) {
    lines.push('## Design Principles')
    lines.push('')
    ds.principles.forEach((p, i) => lines.push(`${i + 1}. ${p}`))
    lines.push('')
  }

  // ── Known Gaps ────────────────────────────────────────────────────
  if (ds.knownGaps?.length) {
    lines.push('## Known Gaps')
    lines.push('')
    lines.push('Honest limitations of this analysis:')
    lines.push('')
    ds.knownGaps.forEach(g => lines.push(`- ${g}`))
    lines.push('')
  }

  // ── CSS Tokens ────────────────────────────────────────────────────
  lines.push('## CSS Tokens')
  lines.push('')
  lines.push('```css')
  lines.push(ds.tokens?.css || generateFallbackCSS(ds))
  lines.push('```')
  lines.push('')

  return lines.join('\n')
}

export function generateFallbackCSS(ds) {
  if (!ds) return ''
  const lines = [':root {']
  const c = ds.colors || {}
  ;['primary', 'canvas', 'ink', 'accent', 'secondary', 'border', 'surface'].forEach(k => {
    if (c[k]) lines.push(`  --${k}: ${c[k]};`)
  })
  const t = ds.typography || {}
  if (t.displayFamily) lines.push(`  --font-display: ${t.displayFamily};`)
  if (t.bodyFamily) lines.push(`  --font-body: ${t.bodyFamily};`)
  const s = ds.shape || {}
  if (s.buttonRadius) lines.push(`  --radius-button: ${s.buttonRadius};`)
  if (s.cardRadius) lines.push(`  --radius-card: ${s.cardRadius};`)
  lines.push('}')
  return lines.join('\n')
}

function toKebab(str) {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase()
}

function yamlEscape(str) {
  if (!str) return ''
  return str.replace(/"/g, '\\"').replace(/\n/g, ' ')
}

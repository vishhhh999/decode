import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Check, Download, ChevronDown, ChevronUp, ExternalLink, RefreshCw } from 'lucide-react'
import ColorSwatch from './ColorSwatch'
import { getDomain, getSourceLabel, getSourceType } from '../lib/utils'

const SECTION_ORDER = ['colors', 'typography', 'shape', 'spacing', 'elevation', 'voice', 'principles', 'tokens']

export default function AnalysisResult({ result, url, onReset, onReAnalyze }) {
  const [openSections, setOpenSections] = useState(new Set(['colors', 'typography', 'voice', 'principles']))
  const [copiedTokens, setCopiedTokens] = useState(false)

  const ds = result.designSystem
  if (!ds) return null

  function toggleSection(id) {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function copyTokens() {
    const css = ds.tokens?.css || generateCSS(ds)
    navigator.clipboard.writeText(css).then(() => {
      setCopiedTokens(true)
      setTimeout(() => setCopiedTokens(false), 2000)
    })
  }

  function downloadMd() {
    const md = generateMarkdown(ds, url)
    const blob = new Blob([md], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `DESIGN-${getDomain(url)}.md`
    a.click()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ width: '100%', maxWidth: '720px', margin: '0 auto', paddingBottom: '80px' }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: '32px',
        gap: '16px',
      }}>
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '6px',
          }}>
            <div style={{
              width: '8px', height: '8px',
              borderRadius: '50%',
              background: 'var(--accent)',
            }} />
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
            }}>
              {ds.brand?.name || getDomain(url)}
            </h2>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}
            >
              <ExternalLink size={13} strokeWidth={1.5} />
            </a>
          </div>
          <p style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            maxWidth: '500px',
            lineHeight: 1.6,
          }}>
            {ds.brand?.atmosphere}
          </p>
          <div style={{
            marginTop: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}>
            <span style={{
              fontSize: '10px',
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
              padding: '2px 6px',
              border: '1px solid var(--border)',
              borderRadius: '3px',
              background: 'var(--bg-elevated)',
            }}>
              {getSourceLabel(getSourceType(url))}
            </span>
            <span style={{
              fontSize: '10px',
              color: result.method === 'visual-analysis' ? 'var(--accent)' : 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
              padding: '2px 6px',
              border: `1px solid ${result.method === 'visual-analysis' ? 'var(--accent-border)' : 'var(--border)'}`,
              borderRadius: '3px',
              background: result.method === 'visual-analysis' ? 'var(--accent-dim)' : 'var(--bg-elevated)',
            }}>
              {result.method === 'visual-analysis' ? '✦ visual analysis' : `${result.pagesScraped} pages scraped`}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <ActionBtn onClick={onReAnalyze} icon={<RefreshCw size={13} strokeWidth={1.5} />} label="Re-run" />
          <ActionBtn onClick={copyTokens} icon={copiedTokens ? <Check size={13} /> : <Copy size={13} strokeWidth={1.5} />} label={copiedTokens ? 'Copied' : 'Copy CSS'} accent={copiedTokens} />
          <ActionBtn onClick={downloadMd} icon={<Download size={13} strokeWidth={1.5} />} label=".md" accent />
        </div>
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>

        {/* Colors */}
        <Section id="colors" label="Colors" open={openSections.has('colors')} onToggle={toggleSection}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
            gap: '16px',
          }}>
            {Object.entries(ds.colors || {}).filter(([k]) => k !== 'others').map(([key, val]) => (
              <ColorSwatch key={key} label={key} value={val} />
            ))}
            {ds.colors?.others?.slice(0, 6).map((c, i) => (
              <ColorSwatch key={i} label={`other-${i+1}`} value={c} />
            ))}
          </div>
        </Section>

        {/* Typography */}
        <Section id="typography" label="Typography" open={openSections.has('typography')} onToggle={toggleSection}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <TypeRow label="Display" value={ds.typography?.displayFamily} sub={`${ds.typography?.displaySize} / ${ds.typography?.displayWeight}`} />
            <TypeRow label="Body" value={ds.typography?.bodyFamily} sub={`${ds.typography?.bodySize} / ${ds.typography?.bodyWeight}`} />
            <MetaRow label="Tracking" value={ds.typography?.tracking} />
            {ds.typography?.notes && <MetaRow label="Notes" value={ds.typography.notes} />}
          </div>
        </Section>

        {/* Shape */}
        <Section id="shape" label="Shape & Radius" open={openSections.has('shape')} onToggle={toggleSection}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <RadiusSwatch label="Button" value={ds.shape?.buttonRadius} />
              <RadiusSwatch label="Card" value={ds.shape?.cardRadius} />
            </div>
            <MetaRow label="Philosophy" value={ds.shape?.philosophy} />
          </div>
        </Section>

        {/* Spacing */}
        <Section id="spacing" label="Spacing" open={openSections.has('spacing')} onToggle={toggleSection}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <MetaRow label="Base unit" value={ds.spacing?.baseUnit} />
            <MetaRow label="Section padding" value={ds.spacing?.sectionPadding} />
            <MetaRow label="Card padding" value={ds.spacing?.cardPadding} />
            <MetaRow label="Density" value={ds.spacing?.density} />
          </div>
        </Section>

        {/* Elevation */}
        <Section id="elevation" label="Elevation" open={openSections.has('elevation')} onToggle={toggleSection}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <MetaRow label="Style" value={ds.elevation?.shadowStyle} />
            {ds.elevation?.definition && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Shadow definition</div>
                <code style={{
                  display: 'block',
                  padding: '10px 12px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent)',
                  wordBreak: 'break-all',
                }}>
                  {ds.elevation.definition}
                </code>
              </div>
            )}
          </div>
        </Section>

        {/* Voice */}
        <Section id="voice" label="Brand Voice" open={openSections.has('voice')} onToggle={toggleSection}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <MetaRow label="Canvas temperature" value={ds.voice?.canvasTemperature} />
            <MetaRow label="Personality" value={ds.voice?.brandPersonality} />
            <MetaRow label="Signature" value={ds.voice?.signature} accent />
            {ds.voice?.antiPatterns?.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Anti-patterns</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {ds.voice.antiPatterns.map((p, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '8px',
                      fontSize: '13px', color: 'var(--text-secondary)',
                    }}>
                      <span style={{ color: 'var(--error)', flexShrink: 0, marginTop: '2px' }}>—</span>
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Principles */}
        <Section id="principles" label="Design Principles" open={openSections.has('principles')} onToggle={toggleSection}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(ds.principles || []).map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-elevated)',
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--text-tertiary)',
                  flexShrink: 0,
                  paddingTop: '2px',
                  minWidth: '16px',
                }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {p}
                </span>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* CSS Tokens */}
        <Section id="tokens" label="CSS Tokens" open={openSections.has('tokens')} onToggle={toggleSection}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={copyTokens}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--bg-overlay)',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                zIndex: 1,
              }}
            >
              {copiedTokens ? <Check size={11} /> : <Copy size={11} strokeWidth={1.5} />}
              {copiedTokens ? 'Copied' : 'Copy'}
            </button>
            <pre style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              overflowX: 'auto',
              lineHeight: 1.8,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {ds.tokens?.css || generateCSS(ds)}
            </pre>
          </div>
        </Section>
      </div>

      {/* New analysis CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        style={{
          marginTop: '40px',
          textAlign: 'center',
        }}
      >
        <button
          onClick={onReset}
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-strong)',
            background: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent-border)'
            e.currentTarget.style.color = 'var(--accent)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border-strong)'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }}
        >
          Decode another URL →
        </button>
      </motion.div>
    </motion.div>
  )
}

// Sub-components

function Section({ id, label, open, onToggle, children }) {
  return (
    <div style={{
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      background: 'var(--bg-surface)',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => onToggle(id)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: 'none',
          cursor: 'pointer',
          borderBottom: open ? '1px solid var(--border)' : 'none',
          transition: 'background 150ms ease',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '0.01em',
          color: 'var(--text-primary)',
        }}>
          {label}
        </span>
        <span style={{ color: 'var(--text-tertiary)' }}>
          {open ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '16px' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TypeRow({ label, value, sub }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', paddingTop: '2px' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{value || '—'}</div>
        {sub && <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{sub}</div>}
      </div>
    </div>
  )
}

function MetaRow({ label, value, accent }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: '13px',
        color: accent ? 'var(--accent)' : 'var(--text-secondary)',
        textAlign: 'right',
        lineHeight: 1.5,
      }}>{value}</span>
    </div>
  )
}

function RadiusSwatch({ label, value }) {
  if (!value) return null
  const r = parseInt(value) || 0
  const display = Math.min(r, 24)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
      <div style={{
        width: '52px',
        height: '32px',
        border: '1.5px solid var(--border-strong)',
        borderRadius: `${display}px`,
        background: 'var(--bg-elevated)',
      }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{label}</div>
        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{value}</div>
      </div>
    </div>
  )
}

function ActionBtn({ onClick, icon, label, accent }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        padding: '7px 12px',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${accent ? 'var(--accent-border)' : 'var(--border)'}`,
        background: accent ? 'var(--accent-dim)' : 'var(--bg-surface)',
        color: accent ? 'var(--accent)' : 'var(--text-secondary)',
        fontSize: '12px',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 150ms ease',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent-border)'
        e.currentTarget.style.color = 'var(--accent)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = accent ? 'var(--accent-border)' : 'var(--border)'
        e.currentTarget.style.color = accent ? 'var(--accent)' : 'var(--text-secondary)'
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// Helpers

function generateCSS(ds) {
  if (!ds) return ''
  const lines = [':root {']
  const c = ds.colors || {}
  if (c.canvas) lines.push(`  --canvas: ${c.canvas};`)
  if (c.primary) lines.push(`  --primary: ${c.primary};`)
  if (c.ink) lines.push(`  --ink: ${c.ink};`)
  if (c.accent) lines.push(`  --accent: ${c.accent};`)
  if (c.secondary) lines.push(`  --secondary: ${c.secondary};`)
  if (c.border) lines.push(`  --border: ${c.border};`)
  if (c.surface) lines.push(`  --surface: ${c.surface};`)
  const t = ds.typography || {}
  if (t.displayFamily) lines.push(`  --font-display: ${t.displayFamily};`)
  if (t.bodyFamily) lines.push(`  --font-body: ${t.bodyFamily};`)
  const s = ds.shape || {}
  if (s.buttonRadius) lines.push(`  --radius-button: ${s.buttonRadius};`)
  if (s.cardRadius) lines.push(`  --radius-card: ${s.cardRadius};`)
  lines.push('}')
  return lines.join('\n')
}

function generateMarkdown(ds, url) {
  return `# Design System — ${ds.brand?.name || url}

## Overview
${ds.brand?.atmosphere || ''}

**URL:** ${url}
**Type:** ${ds.brand?.type || 'website'}

## Colors

| Role | Value |
|------|-------|
${Object.entries(ds.colors || {}).filter(([k]) => k !== 'others').map(([k,v]) => `| ${k} | \`${v}\` |`).join('\n')}

## Typography

- **Display:** ${ds.typography?.displayFamily} / ${ds.typography?.displaySize} / ${ds.typography?.displayWeight}
- **Body:** ${ds.typography?.bodyFamily} / ${ds.typography?.bodySize} / ${ds.typography?.bodyWeight}
- **Tracking:** ${ds.typography?.tracking}
${ds.typography?.notes ? `- **Notes:** ${ds.typography.notes}` : ''}

## Shape

- **Button radius:** ${ds.shape?.buttonRadius}
- **Card radius:** ${ds.shape?.cardRadius}
- **Philosophy:** ${ds.shape?.philosophy}

## Spacing

- **Base unit:** ${ds.spacing?.baseUnit}
- **Section padding:** ${ds.spacing?.sectionPadding}
- **Density:** ${ds.spacing?.density}

## Brand Voice

- **Canvas:** ${ds.voice?.canvasTemperature}
- **Personality:** ${ds.voice?.brandPersonality}
- **Signature:** ${ds.voice?.signature}

### Anti-patterns
${(ds.voice?.antiPatterns || []).map(p => `- ${p}`).join('\n')}

## Design Principles

${(ds.principles || []).map((p, i) => `${i+1}. ${p}`).join('\n')}

## CSS Tokens

\`\`\`css
${ds.tokens?.css || generateCSS(ds)}
\`\`\`
`
}

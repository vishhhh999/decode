import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Check, Download, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Lightbulb, AlertTriangle } from 'lucide-react'
import ColorSwatch from './ColorSwatch'
import { getDomain, getSourceLabel, getSourceType } from '../lib/utils'
import { generateMarkdown, generateFallbackCSS } from '../lib/markdownGenerator'

export default function AnalysisResult({ result, url, onReset, onReAnalyze }) {
  const [openSections, setOpenSections] = useState(new Set(['philosophy', 'colors', 'typography', 'components', 'voice', 'principles']))
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
    const css = ds.tokens?.css || generateFallbackCSS(ds)
    navigator.clipboard.writeText(css).then(() => {
      setCopiedTokens(true)
      setTimeout(() => setCopiedTokens(false), 2000)
    })
  }

  function downloadMd() {
    const md = generateMarkdown(ds, url, { pagesScraped: result.pagesScraped })
    const blob = new Blob([md], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `DESIGN-${getDomain(url)}.md`
    a.click()
  }

  const isPortfolio = ds.brand?.siteType === 'designer-portfolio'

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ width: '100%', maxWidth: '760px', margin: '0 auto', paddingBottom: '80px' }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: '28px',
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
            maxWidth: '540px',
            lineHeight: 1.6,
          }}>
            {ds.brand?.atmosphere}
          </p>

          {/* Badge row */}
          <div style={{
            marginTop: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap',
          }}>
            <Badge label={getSourceLabel(getSourceType(url))} />
            <Badge
              label={isPortfolio ? '◆ designer portfolio' : '◆ brand website'}
              accent
            />
            <Badge
              label={result.method === 'visual-analysis'
                ? '✦ visual analysis'
                : result.method === 'visual+css-extraction'
                ? `✦ visual + ${result.pagesScraped} pages`
                : `${result.pagesScraped} pages scraped`}
            />
            {ds.brand?.industryTags?.map((tag, i) => (
              <Badge key={i} label={tag} subtle />
            ))}
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

        {/* Design Philosophy */}
        {(ds.designPhilosophy?.coreIdea || ds.designPhilosophy?.positioningSignal) && (
          <Section id="philosophy" label="Design Philosophy" icon={<Lightbulb size={13} strokeWidth={1.5} />} open={openSections.has('philosophy')} onToggle={toggleSection}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {ds.designPhilosophy.coreIdea && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--accent)', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>CORE IDEA</div>
                  <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.7 }}>{ds.designPhilosophy.coreIdea}</p>
                </div>
              )}
              {ds.designPhilosophy.positioningSignal && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--accent)', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>POSITIONING SIGNAL</div>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{ds.designPhilosophy.positioningSignal}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Colors */}
        <Section id="colors" label="Colors" open={openSections.has('colors')} onToggle={toggleSection}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
              gap: '16px',
            }}>
              {Object.entries(ds.colors || {}).filter(([k]) => !['others', 'reasoning'].includes(k)).map(([key, val]) => (
                <ColorSwatch key={key} label={key} value={val} />
              ))}
              {ds.colors?.others?.slice(0, 6).map((c, i) => (
                <ColorSwatch key={i} label={`other-${i+1}`} value={c} />
              ))}
            </div>
            {ds.colors?.reasoning && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
                {ds.colors.reasoning}
              </p>
            )}
          </div>
        </Section>

        {/* Typography */}
        <Section id="typography" label="Typography" open={openSections.has('typography')} onToggle={toggleSection}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <TypeRow label="Display" value={ds.typography?.displayFamily} sub={`${ds.typography?.displaySize || ''} / ${ds.typography?.displayWeight || ''}`} />
            <TypeRow label="Body" value={ds.typography?.bodyFamily} sub={`${ds.typography?.bodySize || ''} / ${ds.typography?.bodyWeight || ''}`} />
            <MetaRow label="Tracking" value={ds.typography?.tracking} />
            {ds.typography?.weightContrastStrategy && (
              <MetaRow label="Weight strategy" value={ds.typography.weightContrastStrategy} />
            )}
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
            {ds.shape?.reasoning && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                {ds.shape.reasoning}
              </p>
            )}
          </div>
        </Section>

        {/* Spacing */}
        <Section id="spacing" label="Spacing" open={openSections.has('spacing')} onToggle={toggleSection}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <MetaRow label="Base unit" value={ds.spacing?.baseUnit} />
            <MetaRow label="Section padding" value={ds.spacing?.sectionPadding} />
            <MetaRow label="Card padding" value={ds.spacing?.cardPadding} />
            <MetaRow label="Density" value={ds.spacing?.density} />
            {ds.spacing?.reasoning && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                {ds.spacing.reasoning}
              </p>
            )}
          </div>
        </Section>

        {/* Elevation */}
        {ds.elevation?.shadowStyle && (
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
              {ds.elevation?.reasoning && (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, paddingTop: '4px' }}>
                  {ds.elevation.reasoning}
                </p>
              )}
            </div>
          </Section>
        )}

        {/* Components */}
        {ds.components?.length > 0 && (
          <Section id="components" label={`Components (${ds.components.length})`} open={openSections.has('components')} onToggle={toggleSection}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {ds.components.map((c, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <code style={{
                    display: 'inline-block',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent)',
                    background: 'var(--accent-dim)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '8px',
                  }}>
                    {c.name}
                  </code>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {c.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </Section>
        )}

        {/* Voice */}
        <Section id="voice" label="Brand Voice" open={openSections.has('voice')} onToggle={toggleSection}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <MetaRow label="Canvas temperature" value={ds.voice?.canvasTemperature} />
            <MetaRow label="Personality" value={ds.voice?.brandPersonality} />
            <MetaRow label="Signature" value={ds.voice?.signature} accent />
            {ds.voice?.antiPatterns?.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>What this system avoids</div>
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

        {/* Known Gaps */}
        {ds.knownGaps?.length > 0 && (
          <Section id="gaps" label="Known Gaps" icon={<AlertTriangle size={12} strokeWidth={1.5} />} open={openSections.has('gaps')} onToggle={toggleSection}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                Honest limitations of this analysis:
              </p>
              {ds.knownGaps.map((g, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                  fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6,
                }}>
                  <span style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '2px' }}>!</span>
                  {g}
                </div>
              ))}
            </div>
          </Section>
        )}

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
              {ds.tokens?.css || generateFallbackCSS(ds)}
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

// ─── Sub-components ────────────────────────────────────────────────────────────

function Badge({ label, accent, subtle }) {
  return (
    <span style={{
      fontSize: '10px',
      color: accent ? 'var(--accent)' : subtle ? 'var(--text-tertiary)' : 'var(--text-tertiary)',
      fontFamily: 'var(--font-mono)',
      padding: '2px 7px',
      border: `1px solid ${accent ? 'var(--accent-border)' : 'var(--border)'}`,
      borderRadius: '3px',
      background: accent ? 'var(--accent-dim)' : 'var(--bg-elevated)',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function Section({ id, label, icon, open, onToggle, children }) {
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
          display: 'flex', alignItems: 'center', gap: '8px',
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '0.01em',
          color: 'var(--text-primary)',
        }}>
          {icon && <span style={{ color: 'var(--accent)' }}>{icon}</span>}
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

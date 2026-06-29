import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Globe, AlertCircle } from 'lucide-react'
import { normalizeUrl } from '../lib/utils'

export default function Hero({ onSubmit, isLoading }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  function handleSubmit(e) {
    e?.preventDefault()
    setError('')
    const url = normalizeUrl(value)
    if (!url) {
      setError('Enter a valid URL — brand site, portfolio, Behance or Dribbble profile')
      return
    }
    onSubmit(url)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit()
  }

  const examples = [
    'stripe.com',
    'framer.com',
    'behance.net/username',
    'dribbble.com/username',
  ]

  return (
    <section style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '80px 24px 40px',
      position: 'relative',
    }}>
      {/* Subtle grid texture */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(var(--border) 1px, transparent 1px),
          linear-gradient(90deg, var(--border) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        opacity: 0.3,
        pointerEvents: 'none',
      }} />

      {/* Accent glow behind input */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '300px',
        background: 'radial-gradient(ellipse, rgba(184,245,160,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '640px',
        display: 'flex',
        flexDirection: 'column',
        gap: '40px',
      }}>
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'var(--accent)',
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
          }}>
            Design System Extractor
          </span>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(40px, 6vw, 64px)',
            fontWeight: 600,
            lineHeight: 1.0,
            letterSpacing: '-0.03em',
            color: 'var(--text-primary)',
          }}>
            Reverse-engineer<br />
            <span style={{ color: 'var(--text-secondary)' }}>any design system.</span>
          </h1>
        </motion.div>

        {/* Subline */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontSize: '15px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            maxWidth: '440px',
            marginTop: '-20px',
          }}
        >
          Paste any URL. DECODE scrapes the site, extracts tokens and patterns, then generates structured design reasoning — ready to learn from or drop into Claude.
        </motion.p>

        {/* Input */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            transition: 'border-color 200ms ease',
            overflow: 'hidden',
          }}
          onFocusCapture={e => {
            e.currentTarget.style.borderColor = 'var(--accent-border)'
          }}
          onBlurCapture={e => {
            e.currentTarget.style.borderColor = 'var(--border-strong)'
          }}
          >
            <div style={{
              padding: '0 14px',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-tertiary)',
              flexShrink: 0,
            }}>
              <Globe size={15} strokeWidth={1.5} />
            </div>

            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={e => { setValue(e.target.value); setError('') }}
              onKeyDown={handleKeyDown}
              placeholder="stripe.com or behance.net/username"
              disabled={isLoading}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '15px',
                fontFamily: 'var(--font-mono)',
                padding: '14px 0',
                caretColor: 'var(--accent)',
              }}
            />

            <motion.button
              onClick={handleSubmit}
              disabled={isLoading || !value.trim()}
              whileTap={{ scale: 0.96 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                margin: '6px',
                borderRadius: 'var(--radius-md)',
                background: value.trim() && !isLoading ? 'var(--accent)' : 'var(--bg-elevated)',
                color: value.trim() && !isLoading ? 'var(--text-inverse)' : 'var(--text-tertiary)',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'all 200ms ease',
                flexShrink: 0,
              }}
            >
              {isLoading ? (
                <LoadingDots />
              ) : (
                <>
                  <span>Decode</span>
                  <ArrowRight size={13} strokeWidth={2} />
                </>
              )}
            </motion.button>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--error)',
                  fontSize: '12px',
                  padding: '0 4px',
                }}
              >
                <AlertCircle size={12} strokeWidth={2} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Example chips */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap',
          }}>
            <span style={{
              fontSize: '11px',
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
            }}>try:</span>
            {examples.map(ex => (
              <button
                key={ex}
                onClick={() => { setValue(ex); setError(''); inputRef.current?.focus() }}
                style={{
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-tertiary)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  transition: 'all 120ms ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--border-strong)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-tertiary)'
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function LoadingDots() {
  return (
    <span style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
          style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: 'currentColor',
            display: 'block',
          }}
        />
      ))}
    </span>
  )
}

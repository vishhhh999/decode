import { motion } from 'framer-motion'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ErrorState({ message, onRetry, onReset }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        width: '100%',
        maxWidth: '480px',
        margin: '0 auto',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
      }}
    >
      <div style={{
        width: '48px', height: '48px',
        borderRadius: 'var(--radius-lg)',
        background: 'rgba(235, 87, 87, 0.08)',
        border: '1px solid rgba(235, 87, 87, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--error)',
      }}>
        <AlertTriangle size={20} strokeWidth={1.5} />
      </div>

      <div>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '6px',
        }}>Analysis failed</h3>
        <p style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxWidth: '320px',
        }}>
          {message || 'Something went wrong. The site may block scraping, or the URL may be invalid.'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onRetry}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '9px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-strong)',
            background: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--text-primary)'
            e.currentTarget.style.borderColor = 'var(--border-strong)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--text-secondary)'
          }}
        >
          <RefreshCw size={13} strokeWidth={1.5} />
          Retry
        </button>

        <button
          onClick={onReset}
          style={{
            padding: '9px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--accent-border)',
            background: 'var(--accent-dim)',
            color: 'var(--accent)',
            fontSize: '13px',
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Try a different URL
        </button>
      </div>
    </motion.div>
  )
}

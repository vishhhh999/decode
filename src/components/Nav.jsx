import { motion } from 'framer-motion'
import { Clock, Github } from 'lucide-react'

export default function Nav({ onHistoryClick, historyCount }) {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        height: '52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(14,14,14,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Wordmark */}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        fontSize: '15px',
        letterSpacing: '0.08em',
        color: 'var(--text-primary)',
      }}>
        DECODE
      </div>

      {/* Right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <NavButton onClick={onHistoryClick}>
          <Clock size={14} strokeWidth={1.5} />
          <span>History</span>
          {historyCount > 0 && (
            <span style={{
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              border: '1px solid var(--accent-border)',
              borderRadius: '3px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '1px 5px',
              lineHeight: 1.4,
            }}>
              {historyCount}
            </span>
          )}
        </NavButton>

        <NavButton
          as="a"
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Github size={14} strokeWidth={1.5} />
          <span>GitHub</span>
        </NavButton>
      </div>
    </motion.nav>
  )
}

function NavButton({ children, onClick, as: Tag = 'button', ...props }) {
  return (
    <Tag
      onClick={onClick}
      {...props}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-body)',
        fontSize: '12px',
        fontWeight: 500,
        transition: 'all 150ms ease',
        cursor: 'pointer',
        textDecoration: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--border-strong)'
        e.currentTarget.style.color = 'var(--text-primary)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.color = 'var(--text-secondary)'
      }}
    >
      {children}
    </Tag>
  )
}

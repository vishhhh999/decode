import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, ExternalLink, Clock } from 'lucide-react'
import { getDomain, formatDate, formatTime, getSourceLabel, getSourceType } from '../lib/utils'

export default function HistoryPanel({ history, onClose, onSelect, onDelete, onClear }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 200,
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />

      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '360px',
          zIndex: 201,
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={14} strokeWidth={1.5} color="var(--text-secondary)" />
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}>History</span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-tertiary)',
              padding: '1px 6px',
              border: '1px solid var(--border)',
              borderRadius: '3px',
            }}>{history.length}</span>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {history.length > 0 && (
              <button
                onClick={onClear}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'none',
                  color: 'var(--text-tertiary)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'var(--error)'
                  e.currentTarget.style.borderColor = 'var(--error)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--text-tertiary)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                <Trash2 size={11} strokeWidth={1.5} />
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                width: '28px', height: '28px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <X size={13} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {history.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              gap: '8px',
            }}>
              <Clock size={24} strokeWidth={1} color="var(--text-tertiary)" />
              <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                No analyses yet
              </span>
            </div>
          ) : (
            history.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  marginBottom: '2px',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--bg-elevated)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'transparent'
                }}
              >
                <div
                  onClick={() => onSelect(entry)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Color dots */}
                    {entry.designSystem?.colors && (
                      <div style={{ display: 'flex', gap: '3px', marginBottom: '8px' }}>
                        {Object.values(entry.designSystem.colors)
                          .filter(c => typeof c === 'string' && c.startsWith('#'))
                          .slice(0, 6)
                          .map((c, j) => (
                            <div key={j} style={{
                              width: '10px', height: '10px',
                              borderRadius: '50%',
                              background: c,
                              border: '1px solid rgba(255,255,255,0.06)',
                            }} />
                          ))}
                      </div>
                    )}

                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '2px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {entry.designSystem?.brand?.name || getDomain(entry.url)}
                    </div>

                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-tertiary)',
                      fontFamily: 'var(--font-mono)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {getDomain(entry.url)}
                    </div>

                    <div style={{
                      fontSize: '10px',
                      color: 'var(--text-tertiary)',
                      marginTop: '4px',
                    }}>
                      {formatDate(entry.createdAt)} · {formatTime(entry.createdAt)}
                    </div>
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); onDelete(entry.id) }}
                    style={{
                      width: '24px', height: '24px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: 'none',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      flexShrink: 0,
                      opacity: 0,
                      transition: 'opacity 150ms ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.opacity = '1'
                      e.currentTarget.style.color = 'var(--error)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.opacity = '0'
                    }}
                  >
                    <X size={11} strokeWidth={2} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

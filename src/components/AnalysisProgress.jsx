import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getDomain } from '../lib/utils'

const STAGES = [
  { id: 'connect',    label: 'Connecting to browser instance',      duration: 800  },
  { id: 'screenshot', label: 'Capturing homepage screenshot',       duration: 2500 },
  { id: 'load',       label: 'Loading page',                         duration: 1200 },
  { id: 'css',        label: 'Extracting CSS variables',             duration: 900  },
  { id: 'colors',     label: 'Sampling color values',               duration: 700  },
  { id: 'typography', label: 'Mapping typography system',           duration: 800  },
  { id: 'crawl',      label: 'Crawling internal pages',             duration: 2500 },
  { id: 'components', label: 'Identifying component patterns',      duration: 1200 },
  { id: 'philosophy', label: 'Reasoning about design intent',       duration: 1800 },
  { id: 'claude',     label: 'Generating deep design analysis',     duration: 3500 },
  { id: 'done',       label: 'Analysis complete',                   duration: 400  },
]

export default function AnalysisProgress({ url, pagesScraped }) {
  const [stageIndex, setStageIndex] = useState(0)
  const [completedStages, setCompletedStages] = useState([])

  useEffect(() => {
    let idx = 0
    let timeout

    function advance() {
      if (idx >= STAGES.length - 1) return
      idx++
      setCompletedStages(prev => [...prev, STAGES[idx - 1].id])
      setStageIndex(idx)
      timeout = setTimeout(advance, STAGES[idx].duration)
    }

    timeout = setTimeout(advance, STAGES[0].duration)
    return () => clearTimeout(timeout)
  }, [])

  const domain = getDomain(url)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        width: '100%',
        maxWidth: '640px',
        margin: '0 auto',
      }}
    >
      {/* Terminal window */}
      <div style={{
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        background: 'var(--bg-surface)',
      }}>
        {/* Terminal chrome */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'var(--bg-elevated)',
        }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['var(--error)', 'var(--warning)', 'var(--accent)'].map((c, i) => (
              <div key={i} style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: c,
                opacity: 0.7,
              }} />
            ))}
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-tertiary)',
          }}>
            decode — {domain}
          </span>
        </div>

        {/* Terminal body */}
        <div style={{
          padding: '20px',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          lineHeight: 1.8,
          minHeight: '280px',
        }}>
          {STAGES.map((stage, i) => {
            const isDone = completedStages.includes(stage.id)
            const isActive = stageIndex === i
            const isPending = i > stageIndex

            if (isPending) return null

            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: isDone
                    ? 'var(--text-tertiary)'
                    : isActive
                    ? 'var(--text-primary)'
                    : 'var(--text-tertiary)',
                }}
              >
                {/* Status indicator */}
                <span style={{ width: '14px', flexShrink: 0 }}>
                  {isDone ? (
                    <span style={{ color: 'var(--accent)' }}>✓</span>
                  ) : isActive ? (
                    <motion.span
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      style={{ color: 'var(--accent)' }}
                    >▋</motion.span>
                  ) : null}
                </span>

                {/* Label */}
                <span>{stage.label}</span>

                {/* Extra info on certain stages */}
                {isDone && stage.id === 'crawl' && pagesScraped && (
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
                    — {pagesScraped} pages
                  </span>
                )}
              </motion.div>
            )
          })}

          {/* Blinking cursor at end if still running */}
          {stageIndex < STAGES.length - 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
              <span style={{ width: '14px' }} />
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                style={{ color: 'var(--text-tertiary)' }}
              >█</motion.span>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        marginTop: '16px',
        height: '2px',
        background: 'var(--border)',
        borderRadius: '1px',
        overflow: 'hidden',
      }}>
        <motion.div
          animate={{ width: `${((stageIndex + 1) / STAGES.length) * 100}%` }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{
            height: '100%',
            background: 'var(--accent)',
            borderRadius: '1px',
          }}
        />
      </div>

      <p style={{
        marginTop: '12px',
        textAlign: 'center',
        fontSize: '12px',
        color: 'var(--text-tertiary)',
        fontFamily: 'var(--font-mono)',
      }}>
        This takes 30–50 seconds — DECODE is reading the actual page, not guessing
      </p>
    </motion.div>
  )
}

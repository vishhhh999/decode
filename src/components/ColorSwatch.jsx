import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Copy } from 'lucide-react'

export default function ColorSwatch({ label, value }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  if (!value) return null

  // Determine text color on swatch
  const isLight = isLightColor(value)

  return (
    <motion.button
      onClick={copy}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{
        width: '100%',
        height: '52px',
        borderRadius: 'var(--radius-md)',
        background: value,
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 150ms ease',
      }}>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: copied ? 1 : 0 }}
          style={{ color: isLight ? '#000' : '#fff', fontSize: '11px' }}
        >
          {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={1.5} />}
        </motion.span>
      </div>
      <div>
        <div style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
          fontWeight: 500,
          marginBottom: '2px',
        }}>{label}</div>
        <div style={{
          fontSize: '10px',
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-mono)',
        }}>{value}</div>
      </div>
    </motion.button>
  )
}

function isLightColor(color) {
  // Very rough luminance check
  const hex = color.replace('#', '')
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0,2), 16)
    const g = parseInt(hex.slice(2,4), 16)
    const b = parseInt(hex.slice(4,6), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 > 128
  }
  return false
}

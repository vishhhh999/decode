import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'decode_history'
const MAX_HISTORY = 50

export function useHistory() {
  const [history, setHistory] = useState([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setHistory(JSON.parse(stored))
    } catch {}
  }, [])

  const addEntry = useCallback((entry) => {
    setHistory(prev => {
      const next = [
        {
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          ...entry,
        },
        ...prev,
      ].slice(0, MAX_HISTORY)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const removeEntry = useCallback((id) => {
    setHistory(prev => {
      const next = prev.filter(e => e.id !== id)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }, [])

  return { history, addEntry, removeEntry, clearHistory }
}

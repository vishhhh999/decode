import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Nav from './components/Nav'
import Hero from './components/Hero'
import AnalysisProgress from './components/AnalysisProgress'
import AnalysisResult from './components/AnalysisResult'
import HistoryPanel from './components/HistoryPanel'
import ErrorState from './components/ErrorState'
import { useHistory } from './hooks/useHistory'

// States: 'idle' | 'loading' | 'result' | 'error'

export default function App() {
  const [appState, setAppState] = useState('idle')
  const [currentUrl, setCurrentUrl] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [pagesScraped, setPagesScraped] = useState(null)
  const [showHistory, setShowHistory] = useState(false)

  const { history, addEntry, removeEntry, clearHistory } = useHistory()

  async function runAnalysis(url) {
    setCurrentUrl(url)
    setAppState('loading')
    setError('')
    setResult(null)
    setPagesScraped(null)

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Analysis failed')
      }

      setResult(data)
      setPagesScraped(data.pagesScraped)
      setAppState('result')

      // Save to history
      addEntry({
        url,
        designSystem: data.designSystem,
        pagesScraped: data.pagesScraped,
      })
    } catch (err) {
      setError(err.message || 'Something went wrong')
      setAppState('error')
    }
  }

  function handleReset() {
    setAppState('idle')
    setCurrentUrl('')
    setResult(null)
    setError('')
  }

  function handleSelectHistory(entry) {
    setCurrentUrl(entry.url)
    setResult({ designSystem: entry.designSystem, pagesScraped: entry.pagesScraped, success: true })
    setPagesScraped(entry.pagesScraped)
    setAppState('result')
    setShowHistory(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Nav
        onHistoryClick={() => setShowHistory(true)}
        historyCount={history.length}
      />

      {/* Main content */}
      <main style={{
        paddingTop: '52px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '100vh',
      }}>
        <AnimatePresence mode="wait">
          {appState === 'idle' && (
            <motion.div
              key="hero"
              style={{ width: '100%' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <Hero onSubmit={runAnalysis} isLoading={false} />
            </motion.div>
          )}

          {appState === 'loading' && (
            <motion.div
              key="loading"
              style={{
                width: '100%',
                maxWidth: '640px',
                padding: '80px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
            >
              <AnalysisProgress url={currentUrl} pagesScraped={pagesScraped} />
            </motion.div>
          )}

          {appState === 'result' && result && (
            <motion.div
              key="result"
              style={{ width: '100%', padding: '40px 24px' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <AnalysisResult
                result={result}
                url={currentUrl}
                onReset={handleReset}
                onReAnalyze={() => runAnalysis(currentUrl)}
              />
            </motion.div>
          )}

          {appState === 'error' && (
            <motion.div
              key="error"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '80px 24px',
                minHeight: 'calc(100vh - 52px)',
              }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <ErrorState
                message={error}
                onRetry={() => runAnalysis(currentUrl)}
                onReset={handleReset}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* History panel */}
      <AnimatePresence>
        {showHistory && (
          <HistoryPanel
            history={history}
            onClose={() => setShowHistory(false)}
            onSelect={handleSelectHistory}
            onDelete={removeEntry}
            onClear={clearHistory}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

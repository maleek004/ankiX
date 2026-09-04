import React, { useState, useRef, useEffect } from 'react'
import * as api from '../api.js'

export default function ImportCardsModal({ deckId, deckTitle, onClose, onImportSuccess }) {
  const [importTab, setImportTab] = useState('file') // 'file' | 'text'
  const [selectedFile, setSelectedFile] = useState(null)
  const [rawText, setRawText] = useState('')
  const [textFormat, setTextFormat] = useState('csv')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Guard against unmounted state updates during async import
  const isMountedRef = useRef(true)
  useEffect(() => {
    return () => { isMountedRef.current = false }
  }, [])

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
      setErrorMsg('')
    }
  }

  const handleImport = async (e) => {
    if (e) e.preventDefault()
    setImporting(true)
    setErrorMsg('')
    setImportResult(null)

    try {
      let res
      if (importTab === 'file') {
        if (!selectedFile) {
          setErrorMsg('Please select a file to import.')
          setImporting(false)
          return
        }
        res = await api.importCardsFile(deckId, selectedFile)
      } else {
        if (!rawText.trim()) {
          setErrorMsg('Please paste content to import.')
          setImporting(false)
          return
        }
        res = await api.importCardsText(deckId, rawText, textFormat)
      }

      if (!isMountedRef.current) return
      setImportResult(res)
      if (onImportSuccess) onImportSuccess(res)
    } catch (err) {
      if (!isMountedRef.current) return
      setErrorMsg(err.message || 'Import failed.')
    } finally {
      if (isMountedRef.current) setImporting(false)
    }
  }

  return (
    <div
      className="mobile-bottom-sheet-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="mobile-bottom-sheet-content"
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '90%',
          maxWidth: 620,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 24,
          boxShadow: '0 20px 40px rgba(0,0,0,0.35)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, pb: 12, borderBottom: '1px solid #e9ecef' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
            📥 Import Cards into {deckTitle ? `"${deckTitle}"` : 'Deck'}
          </h3>
          <button
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#6c757d' }}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Format Documentation Notice */}
        <div style={{ background: '#e7f5ff', border: '1px solid #a5d8ff', borderRadius: 8, padding: 14, fontSize: '0.85rem', color: '#1864ab', marginBottom: 16 }}>
          <strong>Supported Flat File Formats:</strong>
          <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
            <li><strong>CSV / TSV (.csv, .tsv, .txt):</strong> <code>Prompt, Answer</code> (supports multi-line Markdown)</li>
            <li><strong>JSON (.json):</strong> <code>[ &#123; "prompt": "...", "answer": "..." &#125; ]</code></li>
          </ul>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', borderBottom: '2px solid #dee2e6', marginBottom: 16 }}>
          <button
            type="button"
            style={{
              padding: '8px 16px',
              fontSize: '0.9rem',
              fontWeight: 600,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: importTab === 'file' ? '3px solid #0d6efd' : '3px solid transparent',
              color: importTab === 'file' ? '#0d6efd' : '#495057'
            }}
            onClick={() => { setImportTab('file'); setErrorMsg(''); setImportResult(null); }}
          >
            📁 File Upload (.csv, .tsv, .json)
          </button>
          <button
            type="button"
            style={{
              padding: '8px 16px',
              fontSize: '0.9rem',
              fontWeight: 600,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: importTab === 'text' ? '3px solid #0d6efd' : '3px solid transparent',
              color: importTab === 'text' ? '#0d6efd' : '#495057'
            }}
            onClick={() => { setImportTab('text'); setErrorMsg(''); setImportResult(null); }}
          >
            ✍️ Raw Text Paste
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: '#ffe3e3', color: '#e03131', padding: '10px 14px', borderRadius: 6, fontSize: '0.85rem', marginBottom: 16, border: '1px solid #ffc9c9' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {importResult ? (
          <div style={{ background: '#d3f9d8', color: '#2b8a3e', padding: 16, borderRadius: 8, border: '1px solid #b2f2bb', marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', fontWeight: 700 }}>🎉 Import Successful!</h4>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              Successfully imported <strong>{importResult.importedCount}</strong> cards into this deck. (Skipped: {importResult.skippedCount})
            </p>

            {importResult.cards && importResult.cards.length > 0 && (
              <div style={{ marginTop: 12, maxHeight: 150, overflowY: 'auto', background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #b2f2bb' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#333', marginBottom: 6 }}>Imported Cards Preview:</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8rem', color: '#495057' }}>
                  {importResult.cards.map((c, i) => (
                    <li key={i}><strong>{c.prompt}</strong> ({c.type})</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={onClose}>Done & Refresh Queue</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleImport} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {importTab === 'file' ? (
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>Select Flat File</label>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.json"
                  className="form-control"
                  onChange={handleFileChange}
                  style={{ padding: 8 }}
                />
                {selectedFile && (
                  <div style={{ fontSize: '0.8rem', color: '#495057', marginTop: 6 }}>
                    Selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Paste Raw Flat Text</label>
                  <select className="form-control" style={{ width: 'auto', padding: '2px 8px', fontSize: '0.8rem' }} value={textFormat} onChange={e => setTextFormat(e.target.value)}>
                    <option value="csv">CSV (Comma-separated)</option>
                    <option value="tsv">TSV (Tab-separated)</option>
                    <option value="json">JSON Array</option>
                  </select>
                </div>
                <textarea
                  className="form-control"
                  rows={8}
                  placeholder={textFormat === 'json' ? '[\n  { "prompt": "What is binary search?", "answer": "O(log n)" }\n]' : 'Question 1, Answer 1\nQuestion 2, Answer 2'}
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button type="button" className="btn-study-tool" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={importing}>
                {importing ? 'Importing Cards...' : '📥 Import Cards Now'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

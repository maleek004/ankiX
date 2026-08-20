import React, { useDeferredValue } from 'react'
import MarkdownViewer from './MarkdownViewer'

export default function MarkdownField({
  label,
  value = '',
  onChange,
  placeholder = '',
  required = false,
  rows = 3,
  hint = 'Supports Markdown: **bold**, `code`, ```lang blocks',
  helpText
}) {
  const safeValue = typeof value === 'string' ? value : String(value ?? '')
  const deferredValue = useDeferredValue(safeValue)
  const hasContent = safeValue.trim().length > 0

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <label style={{ fontWeight: 600, fontSize: '0.88rem', color: '#374151' }}>
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
        {hint && <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{hint}</span>}
      </div>

      <textarea
        className="form-control"
        rows={rows}
        value={safeValue}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 6,
          border: '1px solid #d1d5db',
          fontSize: '0.9rem',
          fontFamily: 'inherit',
          lineHeight: 1.5,
          resize: 'vertical',
          boxSizing: 'border-box'
        }}
      />

      {helpText && (
        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4 }}>
          {helpText}
        </div>
      )}

      {/* Live Preview Pane (deferred for non-blocking typing) */}
      {hasContent && (
        <div
          style={{
            marginTop: 8,
            padding: '10px 14px',
            backgroundColor: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: 6,
            fontSize: '0.88rem'
          }}
        >
          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <span>👁️ Live Markdown Preview</span>
          </div>
          <MarkdownViewer content={deferredValue} />
        </div>
      )}
    </div>
  )
}

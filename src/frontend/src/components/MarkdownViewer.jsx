import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'

function extractText(node) {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node.props && node.props.children) return extractText(node.props.children)
  return ''
}

function CodeBlock({ node, inline, className, children, ...props }) {
  const [copied, setCopied] = useState(false)
  const timerRef = React.useRef(null)

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const match = /language-(\w+)/.exec(className || '')
  const lang = match ? match[1] : ''
  const codeText = extractText(children).replace(/\n$/, '')

  const handleCopy = (e) => {
    e.stopPropagation()
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(codeText)
        .then(() => {
          setCopied(true)
          if (timerRef.current) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => setCopied(false), 2000)
        })
        .catch(() => {})
    }
  }

  if (!inline && (match || codeText.includes('\n') || className)) {
    return (
      <div
        style={{
          position: 'relative',
          margin: '12px 0',
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: '#1e1e2e',
          border: '1px solid #313244',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#181825',
            padding: '6px 12px',
            borderBottom: '1px solid #313244',
            fontSize: '0.75rem',
            color: '#a6adc8',
            fontFamily: 'monospace'
          }}
        >
          <span>{lang ? lang.toUpperCase() : 'CODE'}</span>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              backgroundColor: copied ? '#22c55e' : '#313244',
              color: copied ? '#ffffff' : '#cdd6f4',
              border: 'none',
              borderRadius: 4,
              padding: '3px 8px',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease'
            }}
            title="Copy code to clipboard"
          >
            {copied ? '✓ Copied!' : '📋 Copy Code'}
          </button>
        </div>
        <pre
          style={{
            margin: 0,
            padding: '14px 16px',
            overflowX: 'auto',
            backgroundColor: '#1e1e2e',
            color: '#cdd6f4',
            fontSize: '0.88rem',
            lineHeight: 1.55,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
          }}
        >
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      </div>
    )
  }

  return (
    <code
      style={{
        backgroundColor: 'rgba(99, 102, 241, 0.12)',
        color: '#4f46e5',
        padding: '2px 6px',
        borderRadius: 4,
        fontSize: '0.88em',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontWeight: 500
      }}
      className={className}
      {...props}
    >
      {children}
    </code>
  )
}

export default function MarkdownViewer({ content = '', className = '', style = {}, compact = false }) {
  const safeContent = typeof content === 'string' ? content : String(content ?? '')
  if (!safeContent) return null

  return (
    <div
      className={`markdown-content ${className}`}
      style={{
        lineHeight: 1.65,
        wordBreak: 'break-word',
        color: 'inherit',
        fontSize: '0.95rem',
        ...style
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code: CodeBlock,
          p: ({ children }) => (
            <p style={{
              margin: (style?.margin === 0 || compact) ? 0 : '0 0 10px 0',
              lineHeight: style?.lineHeight || 1.6
            }}>
              {children}
            </p>
          ),
          h1: ({ children }) => <h1 style={{ fontSize: '1.4rem', margin: '16px 0 8px 0', fontWeight: 700 }}>{children}</h1>,
          h2: ({ children }) => <h2 style={{ fontSize: '1.25rem', margin: '14px 0 8px 0', fontWeight: 600 }}>{children}</h2>,
          h3: ({ children }) => <h3 style={{ fontSize: '1.1rem', margin: '12px 0 6px 0', fontWeight: 600 }}>{children}</h3>,
          ul: ({ children }) => <ul style={{ paddingLeft: 22, margin: '8px 0' }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ paddingLeft: 22, margin: '8px 0' }}>{children}</ol>,
          li: ({ children }) => <li style={{ margin: '4px 0' }}>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote
              style={{
                borderLeft: '4px solid #6366f1',
                paddingLeft: 14,
                margin: '10px 0',
                color: '#6b7280',
                fontStyle: 'italic',
                backgroundColor: 'rgba(99, 102, 241, 0.04)',
                padding: '8px 12px',
                borderRadius: '0 6px 6px 0'
              }}
            >
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div style={{ overflowX: 'auto', margin: '12px 0' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.88rem' }}>
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th style={{ border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px' }}>
              {children}
            </td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#4f46e5', textDecoration: 'underline', fontWeight: 500 }}
              onClick={e => e.stopPropagation()}
            >
              {children}
            </a>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

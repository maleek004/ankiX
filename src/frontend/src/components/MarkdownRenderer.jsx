import React from 'react'

/**
 * Lightweight, zero-dependency Markdown & Image Renderer
 * Parses headers, bold, italic, code blocks, lists, blockquotes, and embedded images.
 */
export default function MarkdownRenderer({ content, style = {} }) {
  if (!content) return null

  // Function to format inline markdown tokens (bold, italic, inline code, images)
  const renderInline = (text) => {
    // 1. Match Markdown images ![alt](src)
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
    const parts = []
    let lastIndex = 0
    let match

    while ((match = imageRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index))
      }
      const altText = match[1] || 'Embedded Image'
      const imageSrc = match[2]
      parts.push(
        <img
          key={`img-${match.index}`}
          src={imageSrc}
          alt={altText}
          style={{
            maxWidth: '100%',
            maxHeight: 450,
            height: 'auto',
            borderRadius: 8,
            border: '1px solid #dee2e6',
            margin: '8px 0',
            display: 'block',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}
        />
      )
      lastIndex = imageRegex.lastIndex
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }

    // Process strings within parts array for bold, italic, code
    return parts.map((part, index) => {
      if (typeof part !== 'string') return part

      // Parse inline code `code`
      const segments = part.split(/(`[^`]+`)/g)
      return segments.map((seg, sIdx) => {
        if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2) {
          return (
            <code
              key={`c-${index}-${sIdx}`}
              style={{
                background: '#f1f3f5',
                color: '#d63384',
                padding: '2px 6px',
                borderRadius: 4,
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: '0.88em'
              }}
            >
              {seg.slice(1, -1)}
            </code>
          )
        }

        // Parse Bold **text**
        const boldSegments = seg.split(/(\*\*[^*]+\*\*|__[^_]+__)/g)
        return boldSegments.map((bSeg, bIdx) => {
          if ((bSeg.startsWith('**') && bSeg.endsWith('**')) || (bSeg.startsWith('__') && bSeg.endsWith('__'))) {
            return <strong key={`b-${index}-${sIdx}-${bIdx}`}>{bSeg.slice(2, -2)}</strong>
          }

          // Parse Italic *text*
          const italicSegments = bSeg.split(/(\*[^*]+\*|_[^_]+_)/g)
          return italicSegments.map((iSeg, iIdx) => {
            if ((iSeg.startsWith('*') && iSeg.endsWith('*')) || (iSeg.startsWith('_') && iSeg.endsWith('_'))) {
              return <em key={`i-${index}-${sIdx}-${bIdx}-${iIdx}`}>{iSeg.slice(1, -1)}</em>
            }
            return iSeg
          })
        })
      })
    })
  }

  // Split lines into blocks
  const lines = content.split(/\r?\n/)
  const elements = []
  let inCodeBlock = false
  let codeBlockBuffer = []
  let codeLanguage = ''

  lines.forEach((line, idx) => {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        elements.push(
          <pre
            key={`code-block-${idx}`}
            style={{
              background: '#1e1e1e',
              color: '#d4d4d4',
              padding: 14,
              borderRadius: 8,
              fontFamily: 'Consolas, Monaco, monospace',
              fontSize: '0.88rem',
              overflowX: 'auto',
              margin: '10px 0'
            }}
          >
            <code>{codeBlockBuffer.join('\n')}</code>
          </pre>
        )
        inCodeBlock = false
        codeBlockBuffer = []
      } else {
        // Start of code block
        inCodeBlock = true
        codeLanguage = line.trim().slice(3).trim()
      }
      return
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(line)
      return
    }

    const trimmed = line.trim()

    // Headers
    if (trimmed.startsWith('# ')) {
      elements.push(<h1 key={`h1-${idx}`} style={{ fontSize: '1.5rem', fontWeight: 700, margin: '12px 0 6px 0' }}>{renderInline(trimmed.slice(2))}</h1>)
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h2 key={`h2-${idx}`} style={{ fontSize: '1.25rem', fontWeight: 700, margin: '10px 0 6px 0' }}>{renderInline(trimmed.slice(3))}</h2>)
    } else if (trimmed.startsWith('### ')) {
      elements.push(<h3 key={`h3-${idx}`} style={{ fontSize: '1.1rem', fontWeight: 700, margin: '8px 0 4px 0' }}>{renderInline(trimmed.slice(4))}</h3>)
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <li key={`li-${idx}`} style={{ marginLeft: 20, marginBottom: 4 }}>
          {renderInline(trimmed.slice(2))}
        </li>
      )
    } else if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote
          key={`bq-${idx}`}
          style={{
            borderLeft: '4px solid #0d6efd',
            paddingLeft: 12,
            margin: '8px 0',
            color: '#6c757d',
            fontStyle: 'italic'
          }}
        >
          {renderInline(trimmed.slice(2))}
        </blockquote>
      )
    } else if (trimmed === '') {
      elements.push(<div key={`br-${idx}`} style={{ height: 6 }} />)
    } else {
      elements.push(<p key={`p-${idx}`} style={{ margin: '4px 0' }}>{renderInline(line)}</p>)
    }
  })

  return <div style={{ lineHeight: 1.6, ...style }}>{elements}</div>
}

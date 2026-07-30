import React, { useRef, useState } from 'react'
import { uploadImage } from '../api'
import MarkdownRenderer from './MarkdownRenderer'

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write in markdown (e.g. **bold**, # Header, code, or add images)...',
  rows = 4,
  style = {}
}) {
  const [activeTab, setActiveTab] = useState('edit') // 'edit' | 'preview'
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  const insertText = (before, after = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentVal = value || ''
    const selectedText = currentVal.substring(start, end) || 'text'
    const replacement = `${before}${selectedText}${after}`

    const newVal = currentVal.substring(0, start) + replacement + currentVal.substring(end)
    onChange(newVal)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length)
    }, 0)
  }

  const handleImageFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      const res = await uploadImage(file)
      const imageUrl = res.imageUrl
      const altText = file.name.replace(/\.[^/.]+$/, '') || 'Uploaded Image'
      const markdownImage = `\n![${altText}](${imageUrl})\n`

      const textarea = textareaRef.current
      if (textarea) {
        const start = textarea.selectionStart
        const currentVal = value || ''
        const newVal = currentVal.substring(0, start) + markdownImage + currentVal.substring(start)
        onChange(newVal)
      } else {
        onChange((value || '') + markdownImage)
      }
    } catch (err) {
      alert(`Image upload failed: ${err.message}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div style={{ border: '1px solid #dee2e6', borderRadius: 8, overflow: 'hidden', background: '#fff', ...style }}>
      {/* Editor Header / Toolbar */}
      <div style={{ background: '#f8f9fa', borderBottom: '1px solid #dee2e6', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Toolbar Action Buttons */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            type="button"
            className="btn-study-tool"
            style={{ padding: '2px 8px', fontSize: '0.8rem', fontWeight: 700 }}
            onClick={() => insertText('**', '**')}
            title="Bold"
          >
            B
          </button>
          <button
            type="button"
            className="btn-study-tool"
            style={{ padding: '2px 8px', fontSize: '0.8rem', fontStyle: 'italic' }}
            onClick={() => insertText('*', '*')}
            title="Italic"
          >
            I
          </button>
          <button
            type="button"
            className="btn-study-tool"
            style={{ padding: '2px 8px', fontSize: '0.8rem', fontWeight: 700 }}
            onClick={() => insertText('### ')}
            title="Heading"
          >
            H
          </button>
          <button
            type="button"
            className="btn-study-tool"
            style={{ padding: '2px 8px', fontSize: '0.8rem', fontFamily: 'monospace' }}
            onClick={() => insertText('`', '`')}
            title="Inline Code"
          >
            &lt;/&gt;
          </button>
          <button
            type="button"
            className="btn-study-tool"
            style={{ padding: '2px 8px', fontSize: '0.8rem', fontFamily: 'monospace' }}
            onClick={() => insertText('\n```\n', '\n```\n')}
            title="Code Block"
          >
            ```
          </button>

          <span style={{ borderLeft: '1px solid #ced4da', height: 16, margin: '0 4px' }} />

          {/* Image Upload Button */}
          <button
            type="button"
            className="btn-study-tool"
            style={{ padding: '2px 10px', fontSize: '0.8rem', color: '#0d6efd', fontWeight: 600 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Upload and insert an image"
          >
            {uploading ? 'Uploading...' : '📷 Add Image'}
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageFileSelect}
            accept="image/png, image/jpeg, image/gif, image/webp, image/svg+xml"
            style={{ display: 'none' }}
          />
        </div>

        {/* Tab Switcher: Edit / Preview */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            style={{
              border: 'none',
              background: activeTab === 'edit' ? '#e7f5ff' : 'transparent',
              color: activeTab === 'edit' ? '#0d6efd' : '#6c757d',
              padding: '2px 10px',
              borderRadius: 4,
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            onClick={() => setActiveTab('edit')}
          >
            Edit
          </button>
          <button
            type="button"
            style={{
              border: 'none',
              background: activeTab === 'preview' ? '#e7f5ff' : 'transparent',
              color: activeTab === 'preview' ? '#0d6efd' : '#6c757d',
              padding: '2px 10px',
              borderRadius: 4,
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            onClick={() => setActiveTab('preview')}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Editor Body */}
      {activeTab === 'edit' ? (
        <textarea
          ref={textareaRef}
          className="form-control"
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ border: 'none', borderRadius: 0, padding: 12, outline: 'none', resize: 'vertical' }}
        />
      ) : (
        <div style={{ padding: 14, minHeight: rows * 24, background: '#fafafa' }}>
          {value?.trim() ? (
            <MarkdownRenderer content={value} />
          ) : (
            <em style={{ color: '#adb5bd', fontSize: '0.9rem' }}>Nothing to preview...</em>
          )}
        </div>
      )}
    </div>
  )
}

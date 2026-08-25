/**
 * Tag Utilities for AnkiX
 * Handles tag normalization, presets, autocomplete suggestions,
 * and deterministic badge styling for custom topic tags.
 */

export const POPULAR_TOPIC_TAGS = [
  'general',
  'linux',
  'networking',
  'devops',
  'sql',
  'architecture',
  'security',
  'algorithms',
  'docker',
  'kubernetes',
  'react',
  'dotnet',
  'git',
  'database',
  'system-design',
  'cloud',
  'microservices',
  'data-structures',
  'web-development',
  'testing',
  'ci-cd',
  'redis',
  'postgresql'
]

export const KNOWN_TAG_BADGES = {
  // Programming language runtimes (CodeExecution)
  csharp:       { label: 'C#',             color: '#68217a', bg: '#f3e8f8' },
  python:       { label: 'Python',         color: '#3572A5', bg: '#e8f4f8' },
  javascript:   { label: 'JavaScript',     color: '#b5a000', bg: '#fffde8' },
  go:           { label: 'Go',             color: '#00ADD8', bg: '#e8f9fd' },

  // Pre-configured popular topic tags (MCQ & Short Answer)
  general:      { label: '🏷️ General',     color: '#495057', bg: '#e9ecef' },
  linux:        { label: '🐧 Linux',       color: '#2c5282', bg: '#ebf8ff' },
  networking:   { label: '🌐 Networking',  color: '#2c5282', bg: '#e8f4fd' },
  devops:       { label: '⚙️ DevOps',      color: '#276749', bg: '#e6fffa' },
  sql:          { label: '🗄️ SQL',         color: '#744210', bg: '#fefcbf' },
  architecture: { label: '🏛️ Architecture', color: '#44337a', bg: '#faf5ff' },
  security:     { label: '🔐 Security',    color: '#7b341e', bg: '#fff5f5' },
  algorithms:   { label: '🧮 Algorithms',  color: '#1a365d', bg: '#ebf8ff' },
  docker:       { label: '🐳 Docker',      color: '#0284c7', bg: '#e0f2fe' },
  kubernetes:   { label: '☸️ Kubernetes',  color: '#2563eb', bg: '#eff6ff' },
  react:        { label: '⚛️ React',       color: '#0284c7', bg: '#e0f2fe' },
  dotnet:       { label: '🟣 .NET',        color: '#512bd4', bg: '#ede9fe' },
  git:          { label: '🌿 Git',          color: '#c2410c', bg: '#ffedd5' },
  cloud:        { label: '☁️ Cloud',        color: '#0369a1', bg: '#e0f2fe' },
  database:     { label: '💾 Database',     color: '#4d7c0f', bg: '#ecfccb' },
  microservices:{ label: '🧩 Microservices',color: '#7c3aed', bg: '#f5f3ff' },
  'system-design': { label: '📐 System Design', color: '#0f766e', bg: '#ccfbf1' },
}

const PASTEL_PALETTES = [
  { color: '#1d4ed8', bg: '#dbeafe' }, // Blue
  { color: '#4338ca', bg: '#e0e7ff' }, // Indigo
  { color: '#6d28d9', bg: '#ede9fe' }, // Violet
  { color: '#7e22ce', bg: '#f3e8ff' }, // Purple
  { color: '#a21caf', bg: '#fae8ff' }, // Fuchsia
  { color: '#be185d', bg: '#fce7f3' }, // Pink
  { color: '#be123c', bg: '#ffe4e6' }, // Rose
  { color: '#047857', bg: '#d1fae5' }, // Emerald
  { color: '#0f766e', bg: '#ccfbf1' }, // Teal
  { color: '#0e7490', bg: '#cffafe' }, // Cyan
  { color: '#b45309', bg: '#fef3c7' }, // Amber
  { color: '#334155', bg: '#f1f5f9' }, // Slate
]

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * Normalizes user tag inputs to a lowercase, sanitized identifier (max 50 chars).
 */
export function normalizeTag(tag) {
  if (!tag || typeof tag !== 'string') return 'general'
  let cleaned = tag.trim().toLowerCase()
  // Common domain aliases
  if (cleaned === '.net') cleaned = 'dotnet'
  else if (cleaned === 'c#') cleaned = 'csharp'
  else if (cleaned === 'c++') cleaned = 'cpp'
  
  cleaned = cleaned.replace(/[^a-z0-9-_]/g, '')
  return cleaned.slice(0, 50) || 'general'
}

/**
 * Formats a raw tag slug into a human-readable title (e.g. "cloud-native" -> "Cloud Native").
 */
export function formatTagLabel(tag) {
  if (!tag || typeof tag !== 'string') return 'General'
  return tag
    .split(/[-_]/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Returns badge styling and formatted label for any tag.
 * Known presets receive custom colors and icons; custom tags are styled deterministically.
 */
export function getTagBadge(tag) {
  const norm = normalizeTag(tag)
  if (Object.prototype.hasOwnProperty.call(KNOWN_TAG_BADGES, norm)) {
    return KNOWN_TAG_BADGES[norm]
  }

  const hash = hashString(norm)
  const palette = PASTEL_PALETTES[hash % PASTEL_PALETTES.length]
  return {
    label: `🏷️ ${formatTagLabel(norm)}`,
    color: palette.color,
    bg: palette.bg
  }
}

// Backward-compatible alias
export const langBadgeFor = getTagBadge

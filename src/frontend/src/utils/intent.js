export function getPendingIntent() {
  try {
    const raw = sessionStorage.getItem('ankix_pending_intent')
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

export function savePendingIntent(intent) {
  try {
    sessionStorage.setItem('ankix_pending_intent', JSON.stringify(intent))
  } catch {}
}

export function clearPendingIntent() {
  try {
    sessionStorage.removeItem('ankix_pending_intent')
  } catch {}
}

export function resolvePostLoginRedirect(defaultUrl = '/study-groups') {
  const intent = getPendingIntent()
  if (intent && typeof intent.returnUrl === 'string') {
    clearPendingIntent()
    const trimmed = intent.returnUrl.trim()
    if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
      return trimmed
    }
  }
  return defaultUrl
}

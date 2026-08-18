/**
 * Validates whether an email string adheres to a standard, valid email pattern.
 * Checks for:
 * - Non-empty string
 * - Valid RFC 5322 characters
 * - Valid user and domain structure (user@domain.tld)
 * - Domain has at least one dot and a TLD with 2+ characters
 * - No internal whitespace
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false
  const trimmed = email.trim()
  if (trimmed.length > 254) return false

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
  if (!emailRegex.test(trimmed)) return false

  const parts = trimmed.split('@')
  if (parts.length !== 2) return false

  const domainParts = parts[1].split('.')
  if (domainParts.length < 2) return false
  if (domainParts.some(part => part.length === 0)) return false
  if (domainParts[domainParts.length - 1].length < 2) return false

  return true
}

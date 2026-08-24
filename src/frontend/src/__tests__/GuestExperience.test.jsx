import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter } from 'react-router-dom'
import GuestBanner from '../components/GuestBanner'
import AuthModal from '../components/AuthModal'
import NavBar from '../components/NavBar'
import { savePendingIntent, getPendingIntent, resolvePostLoginRedirect } from '../utils/intent'

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ user: null, logout: vi.fn(), oauthLogin: vi.fn() })
}))

vi.mock('../studyGroup/StudyGroupProvider', () => ({
  useStudyGroup: () => ({ activeStudyGroup: null, clearStudyGroup: vi.fn() })
}))

describe('Guest Experience & AuthModal', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  test('GuestBanner renders preview message and CTA for unauthenticated visitor', () => {
    render(
      <MemoryRouter>
        <GuestBanner />
      </MemoryRouter>
    )

    expect(screen.getByText(/Guest Preview Mode/i)).toBeInTheDocument()
    expect(screen.getByText(/Unlock Full Spaced Repetition/i)).toBeInTheDocument()
  })

  test('AuthModal saves intent and displays value proposition', () => {
    const intent = { returnUrl: '/decks/1', action: 'study_deck' }
    render(
      <MemoryRouter>
        <AuthModal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal Title"
          subtitle="Test Subtitle"
          intent={intent}
        />
      </MemoryRouter>
    )

    expect(screen.getByText('Test Modal Title')).toBeInTheDocument()
    expect(screen.getByText(/SM-2 Memory Engine/i)).toBeInTheDocument()

    const signUpBtn = screen.getByText('Sign Up Free')
    fireEvent.click(signUpBtn)

    const saved = getPendingIntent()
    expect(saved).toEqual(intent)
  })

  test('resolvePostLoginRedirect retrieves returnUrl and clears storage', () => {
    savePendingIntent({ returnUrl: '/exercises', action: 'enroll' })
    const redirectUrl = resolvePostLoginRedirect('/study-groups')
    expect(redirectUrl).toBe('/exercises')
    expect(getPendingIntent()).toBeNull()
  })

  test('resolvePostLoginRedirect defaults to /study-groups when no pending intent', () => {
    const redirectUrl = resolvePostLoginRedirect()
    expect(redirectUrl).toBe('/study-groups')
  })

  test('NavBar renders guest badge and public navigation links', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>
    )

    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(screen.getAllByText('👥 Study Groups').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Decks').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Exercises').length).toBeGreaterThan(0)
    expect(screen.getAllByText('🔍 Search').length).toBeGreaterThan(0)
  })
})

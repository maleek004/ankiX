import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { getEffectiveDisplayName } from '../api'
import * as authModule from '../auth/AuthProvider'

vi.mock('../auth/AuthProvider', () => ({
  useAuth: vi.fn(() => ({ user: null, logout: vi.fn() }))
}))

vi.mock('../studyGroup/StudyGroupProvider', () => ({
  useStudyGroup: vi.fn(() => ({ activeStudyGroup: null, clearStudyGroup: vi.fn() }))
}))

test('NavBar renders links when unauthenticated', () => {
  render(<MemoryRouter><NavBar/></MemoryRouter>)
  expect(screen.getAllByText(/AnkiX/i).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/Log In/i).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/Account/i).length).toBeGreaterThan(0)
})

test('NavBar renders user display name or email prefix when logged in', () => {
  vi.mocked(authModule.useAuth).mockReturnValue({
    user: { email: 'john.doe@example.com', displayName: 'John Doe' },
    logout: vi.fn()
  })

  const { rerender } = render(
    <MemoryRouter>
      <NavBar />
    </MemoryRouter>
  )
  expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0)

  vi.mocked(authModule.useAuth).mockReturnValue({
    user: { email: 'jane.smith@example.com' },
    logout: vi.fn()
  })

  rerender(
    <MemoryRouter>
      <NavBar />
    </MemoryRouter>
  )
  expect(screen.getAllByText('jane.smith').length).toBeGreaterThan(0)
})

test('getEffectiveDisplayName splits email at @ when display name missing', () => {
  expect(getEffectiveDisplayName(null, 'sam@example.com')).toBe('sam')
  expect(getEffectiveDisplayName('   ', 'alex.dev@example.org')).toBe('alex.dev')
  expect(getEffectiveDisplayName('Sam White', 'sam@example.com')).toBe('Sam White')
  expect(getEffectiveDisplayName('sam@example.com', 'sam@example.com')).toBe('sam')
})

test('NavBar renders mobile hamburger button', () => {
  vi.mocked(authModule.useAuth).mockReturnValue({ user: null, logout: vi.fn() })
  render(<MemoryRouter><NavBar /></MemoryRouter>)
  const hamburger = screen.getByRole('button', { name: /open navigation menu/i })
  expect(hamburger).toBeInTheDocument()
})

test('NavBar mobile drawer opens and closes on hamburger click', () => {
  vi.mocked(authModule.useAuth).mockReturnValue({ user: null, logout: vi.fn() })
  render(<MemoryRouter><NavBar /></MemoryRouter>)

  const hamburger = screen.getByRole('button', { name: /open navigation menu/i })
  // Drawer should start closed
  const drawer = document.querySelector('.mobile-nav-drawer')
  expect(drawer).not.toHaveClass('open')

  // Open drawer
  fireEvent.click(hamburger)
  expect(drawer).toHaveClass('open')

  // Close drawer via close button
  const closeBtn = screen.getByRole('button', { name: /close navigation menu/i })
  fireEvent.click(closeBtn)
  expect(drawer).not.toHaveClass('open')
})

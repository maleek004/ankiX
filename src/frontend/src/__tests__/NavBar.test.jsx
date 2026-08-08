import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { getEffectiveDisplayName } from '../api'
import * as authModule from '../auth/AuthProvider'

vi.mock('../auth/AuthProvider', () => ({
  useAuth: vi.fn(() => ({ user: null, logout: vi.fn() }))
}))

test('NavBar renders links when unauthenticated', () => {
  render(<MemoryRouter><NavBar/></MemoryRouter>)
  expect(screen.getByText(/AnkiX/i)).toBeInTheDocument()
  expect(screen.getByText(/Log In/i)).toBeInTheDocument()
  expect(screen.getByText(/Account/i)).toBeInTheDocument()
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
  expect(screen.getByText('John Doe')).toBeInTheDocument()

  vi.mocked(authModule.useAuth).mockReturnValue({
    user: { email: 'jane.smith@example.com' },
    logout: vi.fn()
  })

  rerender(
    <MemoryRouter>
      <NavBar />
    </MemoryRouter>
  )
  expect(screen.getByText('jane.smith')).toBeInTheDocument()
})

test('getEffectiveDisplayName splits email at @ when display name missing', () => {
  expect(getEffectiveDisplayName(null, 'sam@example.com')).toBe('sam')
  expect(getEffectiveDisplayName('   ', 'alex.dev@example.org')).toBe('alex.dev')
  expect(getEffectiveDisplayName('Sam White', 'sam@example.com')).toBe('Sam White')
  expect(getEffectiveDisplayName('sam@example.com', 'sam@example.com')).toBe('sam')
})

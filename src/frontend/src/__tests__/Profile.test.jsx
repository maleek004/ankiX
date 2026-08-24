import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Profile from '../pages/Profile'
import * as authModule from '../auth/AuthProvider'
import * as apiModule from '../api'

describe('Profile Page Component', () => {
  const mockUser = {
    id: 1,
    email: 'learner@example.com',
    displayName: 'Learner One',
    role: 'Learner',
    authProvider: 'local',
    isEmailVerified: false
  }

  const mockProfileResponse = {
    id: 1,
    email: 'learner@example.com',
    displayName: 'Learner One',
    role: 'Learner',
    authProvider: 'local',
    isEmailVerified: false,
    createdAt: '2026-01-01T00:00:00Z',
    stats: {
      reviewsCount: 42,
      decksCreatedCount: 5
    }
  }

  const mockUpdateUser = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      user: mockUser,
      updateUser: mockUpdateUser
    })
    vi.spyOn(apiModule, 'getProfile').mockResolvedValue(mockProfileResponse)
  })

  it('renders user details, badges, and learning activity stats', async () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('profile-effective-name')).toHaveTextContent('Learner One')
      expect(screen.getByTestId('profile-email')).toHaveTextContent('learner@example.com')
      expect(screen.getByTestId('profile-reviews-count')).toHaveTextContent('42')
      expect(screen.getByTestId('profile-decks-count')).toHaveTextContent('5')
    })

    expect(screen.getAllByText(/Local Email/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Pending Verification/i)).toBeInTheDocument()
  })

  it('allows updating display name and calls updateUser upon success', async () => {
    vi.spyOn(apiModule, 'updateProfile').mockResolvedValue({
      id: 1,
      displayName: 'Alex River',
      email: 'learner@example.com',
      role: 'Learner',
      authProvider: 'local',
      isEmailVerified: false
    })

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /display name/i })).toHaveValue('Learner One')
    })

    const input = screen.getByRole('textbox', { name: /display name/i })
    fireEvent.change(input, { target: { value: 'Alex River' } })

    const saveButton = screen.getByRole('button', { name: /save display name/i })
    expect(saveButton).not.toBeDisabled()

    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(apiModule.updateProfile).toHaveBeenCalledWith('Alex River')
      expect(mockUpdateUser).toHaveBeenCalledWith({ displayName: 'Alex River' })
      expect(screen.getByTestId('profile-success-msg')).toHaveTextContent('Display name updated successfully!')
    })
  })

  it('displays error banner when display name update fails', async () => {
    vi.spyOn(apiModule, 'updateProfile').mockRejectedValue(new Error('Display name already taken or invalid.'))

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /display name/i })).toHaveValue('Learner One')
    })

    const input = screen.getByRole('textbox', { name: /display name/i })
    fireEvent.change(input, { target: { value: 'Invalid Name' } })

    const saveButton = screen.getByRole('button', { name: /save display name/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByTestId('profile-error-msg')).toHaveTextContent('Display name already taken or invalid.')
    })
  })

  it('disables save button when display name is unchanged or too short', async () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /display name/i })).toHaveValue('Learner One')
    })

    const saveButton = screen.getByRole('button', { name: /save display name/i })
    // Initially unchanged -> disabled
    expect(saveButton).toBeDisabled()

    const input = screen.getByRole('textbox', { name: /display name/i })
    fireEvent.change(input, { target: { value: 'A' } })
    expect(saveButton).toBeDisabled()
  })

  it('handles resending email verification', async () => {
    vi.spyOn(apiModule, 'sendVerificationEmail').mockResolvedValue({ message: 'Sent' })

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/resend verification email/i)).toBeInTheDocument()
    })

    const resendButton = screen.getByText(/resend verification email/i)
    fireEvent.click(resendButton)

    await waitFor(() => {
      expect(apiModule.sendVerificationEmail).toHaveBeenCalledWith('learner@example.com')
      expect(screen.getByText(/verification email sent/i)).toBeInTheDocument()
    })
  })

  it('renders emoji avatar initials safely without surrogate corruption', async () => {
    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      user: { ...mockUser, displayName: '🚀 Rocket Dev' },
      updateUser: mockUpdateUser
    })
    vi.spyOn(apiModule, 'getProfile').mockResolvedValue({
      ...mockProfileResponse,
      displayName: '🚀 Rocket Dev'
    })

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('profile-avatar')).toHaveTextContent('🚀')
    })
  })
})

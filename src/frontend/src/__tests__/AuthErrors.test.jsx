import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter } from 'react-router-dom'
import { parseApiError } from '../api'
import Login from '../pages/Login'
import Register from '../pages/Register'
import * as authModule from '../auth/AuthProvider'

describe('parseApiError', () => {
  it('extracts message property from JSON response', async () => {
    const mockRes = {
      text: async () => JSON.stringify({ message: 'Invalid credentials.' })
    }
    const result = await parseApiError(mockRes, 'Fallback error')
    expect(result).toBe('Invalid credentials.')
  })

  it('extracts detail property from ProblemDetails JSON response', async () => {
    const mockRes = {
      text: async () => JSON.stringify({ detail: 'User account is locked.' })
    }
    const result = await parseApiError(mockRes, 'Fallback error')
    expect(result).toBe('User account is locked.')
  })

  it('extracts validation error array from ASP.NET ValidationProblemDetails', async () => {
    const mockRes = {
      text: async () => JSON.stringify({
        title: 'One or more validation errors occurred.',
        errors: {
          Email: ['The Email field is not a valid e-mail address.']
        }
      })
    }
    const result = await parseApiError(mockRes, 'Fallback error')
    expect(result).toBe('The Email field is not a valid e-mail address.')
  })

  it('handles plain text responses gracefully', async () => {
    const mockRes = {
      text: async () => 'Service unavailable'
    }
    const result = await parseApiError(mockRes, 'Fallback error')
    expect(result).toBe('Service unavailable')
  })

  it('falls back to default message for empty or HTML responses', async () => {
    const mockRes = {
      text: async () => '<!DOCTYPE html><html><body>Error 500</body></html>'
    }
    const result = await parseApiError(mockRes, 'Server error. Please try again.')
    expect(result).toBe('Server error. Please try again.')
  })
})

describe('Login Component Error Handling', () => {
  it('displays clean error message in an alert banner and clears on typing', async () => {
    const mockLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials.'))
    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      login: mockLogin,
      user: null
    })

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    const emailInput = screen.getByPlaceholderText('name@example.com')
    const passwordInput = screen.getByLabelText(/^Password/i)
    const submitBtn = screen.getByRole('button', { name: /Log In/i })

    // Fill valid email format & password
    fireEvent.change(emailInput, { target: { value: 'test2@gmail.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
    fireEvent.click(submitBtn)

    // Verify error banner is rendered cleanly without raw json braces
    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(alert).toHaveTextContent('Invalid credentials.')
      expect(alert).not.toHaveTextContent('{"message"')
    })

    // Typing in password input should clear error banner immediately
    fireEvent.change(passwordInput, { target: { value: 'anotherattempt' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('sanitizes raw JSON error strings if thrown directly', async () => {
    const mockLogin = vi.fn().mockRejectedValue(new Error('{"message":"Invalid credentials."}'))
    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      login: mockLogin,
      user: null
    })

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    const emailInput = screen.getByPlaceholderText('name@example.com')
    const passwordInput = screen.getByLabelText(/^Password/i)
    const submitBtn = screen.getByRole('button', { name: /Log In/i })

    fireEvent.change(emailInput, { target: { value: 'test2@gmail.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(alert).toHaveTextContent('Invalid credentials.')
      expect(alert).not.toHaveTextContent('{"message"')
    })
  })
})

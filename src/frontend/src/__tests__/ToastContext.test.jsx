import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ToastProvider, useToast } from '../context/ToastContext'

function TestConsumer() {
  const toast = useToast()
  return (
    <div>
      <button onClick={() => toast.success('Operation succeeded!')}>Trigger Success</button>
      <button onClick={() => toast.error('Something went wrong!')}>Trigger Error</button>
      <button onClick={() => toast.warning('Careful with that!')}>Trigger Warning</button>
      <button onClick={() => toast.info('For your info.')}>Trigger Info</button>
      <button onClick={() => toast.showToast('Custom message', 'success', 2000)}>Trigger Custom</button>
    </div>
  )
}

describe('ToastContext & ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('renders children correctly', () => {
    render(
      <ToastProvider>
        <div>Test Child Content</div>
      </ToastProvider>
    )
    expect(screen.getByText('Test Child Content')).toBeInTheDocument()
  })

  it('displays success and info toasts with role="status" and aria-live="polite"', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Trigger Success' }))
    const statusToast = screen.getByRole('status')
    expect(statusToast).toBeInTheDocument()
    expect(statusToast).toHaveTextContent('Operation succeeded!')
    expect(statusToast).toHaveAttribute('aria-live', 'polite')
  })

  it('displays error and warning toasts with role="alert" and aria-live="assertive"', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Trigger Error' }))
    const errorToast = screen.getByRole('alert')
    expect(errorToast).toBeInTheDocument()
    expect(errorToast).toHaveTextContent('Something went wrong!')
    expect(errorToast).toHaveAttribute('aria-live', 'assertive')
  })

  it('allows manual dismissal via close button', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Trigger Info' }))
    expect(screen.getByText('For your info.')).toBeInTheDocument()

    const closeBtn = screen.getByRole('button', { name: 'Close notification' })
    fireEvent.click(closeBtn)

    expect(screen.queryByText('For your info.')).not.toBeInTheDocument()
  })

  it('automatically dismisses toasts after the specified duration', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Trigger Custom' }))
    expect(screen.getByText('Custom message')).toBeInTheDocument()

    // Advance clock by 1999ms (should still be visible)
    act(() => {
      vi.advanceTimersByTime(1999)
    })
    expect(screen.getByText('Custom message')).toBeInTheDocument()

    // Advance past duration (2000ms total)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByText('Custom message')).not.toBeInTheDocument()
  })

  it('provides safe fallback methods when used outside ToastProvider without crashing', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function NakedConsumer() {
      const toast = useToast()
      return (
        <div>
          <button onClick={() => toast.success('Fallback success')}>Click</button>
          <button onClick={() => toast.error('Fallback error')}>Click Error</button>
        </div>
      )
    }

    render(<NakedConsumer />)
    fireEvent.click(screen.getByRole('button', { name: 'Click' }))
    expect(consoleSpy).toHaveBeenCalledWith('[Toast:success]', 'Fallback success')

    fireEvent.click(screen.getByRole('button', { name: 'Click Error' }))
    expect(consoleErrorSpy).toHaveBeenCalledWith('[Toast:error]', 'Fallback error')

    consoleSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })
})

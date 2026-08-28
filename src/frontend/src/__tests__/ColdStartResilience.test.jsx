import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import WakeupProgressTicker, { getWakeupStage } from '../components/WakeupProgressTicker'
import ColdStartRecoveryCard from '../components/ColdStartRecoveryCard'
import { CodeEditorExercise, MultipleChoiceExercise } from '../components/ExerciseComponents'
import { safeFetchWithRetry } from '../api.js'

describe('Cold-Start Resilience & Progressive UX Tests', () => {
  describe('WakeupProgressTicker stages & rendering', () => {
    test('getWakeupStage returns correct progressive copy across time thresholds', () => {
      expect(getWakeupStage(0).message).toContain('Running solution against test cases')
      expect(getWakeupStage(2).message).toContain('Running solution against test cases')
      expect(getWakeupStage(4).message).toContain('taking a quick nap')
      expect(getWakeupStage(10).message).toContain('Slapping the server awake')
      expect(getWakeupStage(20).message).toContain('Jump-scaring the code runner')
      expect(getWakeupStage(35).message).toContain('Containers warming up')
      expect(getWakeupStage(50).message).toContain('Almost there')
    })

    test('WakeupProgressTicker renders stages and responds to cancel callback', () => {
      const onCancelMock = vi.fn()
      const { unmount } = render(
        <WakeupProgressTicker
          running={true}
          progressInfo={{ attempt: 2, maxAttempts: 5, elapsedMs: 8000 }}
          onCancel={onCancelMock}
        />
      )

      expect(screen.getByText(/Running solution against test cases|taking a quick nap/i)).toBeInTheDocument()
      const cancelBtn = screen.getByText('Cancel')
      expect(cancelBtn).toBeInTheDocument()
      fireEvent.click(cancelBtn)
      expect(onCancelMock).toHaveBeenCalledTimes(1)

      unmount()
    })

    test('WakeupProgressTicker returns null when running is false', () => {
      const { container } = render(<WakeupProgressTicker running={false} />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('ColdStartRecoveryCard Component', () => {
    test('renders user-friendly message, retry button and expandable diagnostic info', () => {
      const onRetryMock = vi.fn()
      const errorDetails = 'HTTP 503 Service Unavailable: Dyno boot timeout'

      render(
        <ColdStartRecoveryCard
          onRetry={onRetryMock}
          details={errorDetails}
          isRetrying={false}
        />
      )

      expect(screen.getByText(/Code Runner took a bit longer to wake up/i)).toBeInTheDocument()
      expect(screen.getByText(/free-tier cloud execution containers go to sleep/i)).toBeInTheDocument()

      const retryBtn = screen.getByRole('button', { name: /Run Solution Again/i })
      expect(retryBtn).toBeInTheDocument()
      fireEvent.click(retryBtn)
      expect(onRetryMock).toHaveBeenCalledTimes(1)

      // Diagnostic toggle
      const toggleDetailsBtn = screen.getByText(/View Diagnostic Info/i)
      expect(screen.queryByText(errorDetails)).not.toBeInTheDocument()
      fireEvent.click(toggleDetailsBtn)
      expect(screen.getByText(errorDetails)).toBeInTheDocument()
      expect(screen.getByText(/Hide Diagnostic Info/i)).toBeInTheDocument()
    })
  })

  describe('ExerciseComponents Cold-Start and Ticker Integration', () => {
    const mockExercise = {
      id: 101,
      title: 'Sum Two Numbers',
      language: 'csharp',
      exerciseType: 'CodeExecution',
      starterCode: 'int a = 1;',
      exerciseSpec: JSON.stringify({
        options: ['Option A', 'Option B'],
        correctIndex: 0
      })
    }

    test('CodeEditorExercise shows ticker when running and recovery card when cold start occurs', () => {
      const { rerender } = render(
        <CodeEditorExercise
          exercise={mockExercise}
          practiceCode="int a = 1;"
          setPracticeCode={() => {}}
          onRunCode={() => {}}
          running={true}
          runResult={null}
          runProgress={{ attempt: 1, maxAttempts: 5 }}
          onCancel={() => {}}
        />
      )

      expect(screen.getByText(/Running solution against test cases/i)).toBeInTheDocument()

      // When cold start occurs
      rerender(
        <CodeEditorExercise
          exercise={mockExercise}
          practiceCode="int a = 1;"
          setPracticeCode={() => {}}
          onRunCode={() => {}}
          running={false}
          runResult={{
            passed: false,
            result: 'COLD_START',
            isColdStart: true,
            details: 'Container timed out'
          }}
          runProgress={null}
          onCancel={() => {}}
        />
      )

      expect(screen.getByText(/Code Runner took a bit longer to wake up/i)).toBeInTheDocument()
    })

    test('MultipleChoiceExercise renders ticker and cold start card correctly', () => {
      const { rerender } = render(
        <MultipleChoiceExercise
          exercise={{ ...mockExercise, exerciseType: 'MultipleChoice' }}
          onRunCode={() => {}}
          running={true}
          runResult={null}
          runProgress={{ attempt: 1, maxAttempts: 5 }}
          onCancel={() => {}}
        />
      )

      expect(screen.getByText(/Running solution against test cases/i)).toBeInTheDocument()

      rerender(
        <MultipleChoiceExercise
          exercise={{ ...mockExercise, exerciseType: 'MultipleChoice' }}
          onRunCode={() => {}}
          running={false}
          runResult={{
            passed: false,
            result: 'COLD_START',
            isColdStart: true,
            details: 'Service waking up'
          }}
          runProgress={null}
          onCancel={() => {}}
        />
      )

      expect(screen.getByText(/Code Runner took a bit longer to wake up/i)).toBeInTheDocument()
    })
  })

  describe('safeFetchWithRetry mechanics', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    test('retries on transient HTTP 503 and notifies onProgress callback', async () => {
      let callCount = 0
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve(new Response('Gateway timeout', { status: 503 }))
        }
        return Promise.resolve(new Response(JSON.stringify({ passed: true }), { status: 200 }))
      })

      const progressEvents = []
      const res = await safeFetchWithRetry(
        '/api/test',
        {},
        {
          maxAttempts: 2,
          delaysMs: [10],
          onProgress: ev => progressEvents.push(ev)
        }
      )

      expect(res.status).toBe(200)
      expect(callCount).toBe(2)
      expect(progressEvents.length).toBe(2)
      expect(progressEvents[0].attempt).toBe(1)
      expect(progressEvents[1].attempt).toBe(2)
      expect(progressEvents[1].isRetrying).toBe(true)
    })

    test('throws cold-start friendly error when transient retries are exhausted', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() => {
        return Promise.reject(new TypeError('Failed to fetch'))
      })

      await expect(
        safeFetchWithRetry(
          '/api/test',
          {},
          {
            maxAttempts: 2,
            delaysMs: [5]
          }
        )
      ).rejects.toMatchObject({
        isColdStartTimeout: true
      })
    })

    test('aborts immediately when AbortSignal is triggered', async () => {
      const abortCtrl = new AbortController()
      abortCtrl.abort()

      await expect(
        safeFetchWithRetry(
          '/api/test',
          {},
          {
            maxAttempts: 3,
            signal: abortCtrl.signal
          }
        )
      ).rejects.toMatchObject({
        name: 'AbortError'
      })
    })
  })
})

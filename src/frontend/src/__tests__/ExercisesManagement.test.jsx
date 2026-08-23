import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter } from 'react-router-dom'
import Exercises from '../pages/Exercises'
import { MultipleChoiceExercise } from '../components/ExerciseComponents'
import * as api from '../api'

vi.mock('../studyGroup/StudyGroupProvider', () => ({
  useStudyGroup: () => ({ activeStudyGroup: { id: 1, name: 'Mock Group', role: 'Admin' } })
}))

vi.mock('../api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getExercises: vi.fn(async () => [
      {
        id: 10,
        title: 'Reverse String in Python',
        language: 'python',
        exerciseType: 'CodeExecution',
        description: 'Reverse the **given string** with `[::-1]`',
        starterCode: 'def reverse(s): pass',
        solutionCode: 'def reverse(s): return s[::-1]',
        averageEaseFactor: 2.50,
        totalReviewsCount: 2
      },
      {
        id: 20,
        title: 'HTTP Status Code MCQ',
        language: 'general',
        exerciseType: 'MultipleChoice',
        exerciseSpec: JSON.stringify({
          options: ['`200 OK` indicates success', '`404 Not Found` indicates server error'],
          correctIndex: 0
        }),
        description: 'Select the statement describing **200 OK**',
        averageEaseFactor: 2.60,
        totalReviewsCount: 5
      }
    ]),
    getExercise: vi.fn(async (id) => {
      if (id === 10) {
        return {
          id: 10,
          title: 'Reverse String in Python',
          language: 'python',
          exerciseType: 'CodeExecution',
          description: 'Reverse the **given string** with `[::-1]`',
          starterCode: 'def reverse(s): pass',
          solutionCode: 'def reverse(s): return s[::-1]'
        }
      }
      return {
        id: 20,
        title: 'HTTP Status Code MCQ',
        language: 'general',
        exerciseType: 'MultipleChoice',
        exerciseSpec: JSON.stringify({
          options: ['`200 OK` indicates success', '`404 Not Found` indicates server error'],
          correctIndex: 0
        }),
        description: 'Select the statement describing **200 OK**'
      }
    }),
    getMyCollectionExerciseIds: vi.fn(async () => [10]),
    getMyDueExercises: vi.fn(async () => [
      {
        id: 10,
        title: 'Reverse String in Python',
        language: 'python',
        exerciseType: 'CodeExecution',
        description: 'Reverse the **given string** with `[::-1]`',
        starterCode: 'def reverse(s): pass',
        solutionCode: 'def reverse(s): return s[::-1]'
      }
    ]),
    createExercise: vi.fn(async (payload) => ({ id: 30, ...payload })),
    updateExercise: vi.fn(async () => true),
    deleteExercise: vi.fn(async () => true),
    canCreateContent: vi.fn(() => true)
  }
})

describe('Story 7.5: Exercise Management & Rich Markdown Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('ankix_token', 'mock_jwt_token')
    window.alert = vi.fn()
    window.confirm = vi.fn(() => true)
  })

  test('renders exercises with Edit buttons and opens Edit modal with preloaded values', async () => {
    render(
      <MemoryRouter>
        <Exercises />
      </MemoryRouter>
    )

    // Wait for due queue item to load
    await waitFor(() => expect(screen.getByText('Reverse String in Python')).toBeInTheDocument())

    // Click on All Study Group Exercises tab
    const allTab = screen.getByRole('button', { name: /All Study Group Exercises/i })
    fireEvent.click(allTab)

    await waitFor(() => expect(screen.getByText('HTTP Status Code MCQ')).toBeInTheDocument())

    // Edit button should be present for authorized users
    const editButtons = screen.getAllByRole('button', { name: /✏️ Edit/i })
    expect(editButtons.length).toBeGreaterThanOrEqual(1)

    // Click Edit on the first exercise
    fireEvent.click(editButtons[0])

    // Edit modal should open
    await waitFor(() => expect(screen.getByText('✏️ Edit Exercise')).toBeInTheDocument())

    // Should contain Save Changes button and input preloaded with title
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Reverse String in Python')).toBeInTheDocument()
  })

  test('submitting edit calls api.updateExercise and closes modal', async () => {
    render(
      <MemoryRouter>
        <Exercises />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('Reverse String in Python')).toBeInTheDocument())

    const editButtons = screen.getAllByRole('button', { name: /✏️ Edit/i })
    fireEvent.click(editButtons[0])

    await waitFor(() => expect(screen.getByText('✏️ Edit Exercise')).toBeInTheDocument())

    const titleInput = screen.getByDisplayValue('Reverse String in Python')
    fireEvent.change(titleInput, { target: { value: 'Reverse String in Python (Updated)' } })

    const saveButton = screen.getByRole('button', { name: /Save Changes/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(api.updateExercise).toHaveBeenCalledTimes(1)
      expect(api.updateExercise).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          title: 'Reverse String in Python (Updated)',
          language: 'python',
          exerciseType: 'CodeExecution'
        })
      )
    })

    // Modal should be closed
    await waitFor(() => expect(screen.queryByText('✏️ Edit Exercise')).not.toBeInTheDocument())
  })

  test('MultipleChoiceExercise renders rich markdown in option choices', () => {
    const exercise = {
      id: 99,
      exerciseType: 'MultipleChoice',
      exerciseSpec: JSON.stringify({
        options: ['Use the `let` keyword for mutable variables', 'Use **const** for constants'],
        correctIndex: 1
      })
    }

    const onRunCode = vi.fn()

    render(
      <MultipleChoiceExercise
        exercise={exercise}
        onRunCode={onRunCode}
        running={false}
        runResult={null}
      />
    )

    // Verify markdown code element is rendered
    expect(screen.getByText('let')).toBeInTheDocument()
    expect(screen.getByText('const')).toBeInTheDocument()
  })

  test('non-authorized users do not see Edit button', async () => {
    api.canCreateContent.mockReturnValueOnce(false)

    render(
      <MemoryRouter>
        <Exercises />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('Reverse String in Python')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /✏️ Edit/i })).not.toBeInTheDocument()
  })
})

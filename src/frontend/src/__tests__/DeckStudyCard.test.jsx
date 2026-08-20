import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Deck from '../pages/Deck'
import * as api from '../api'

vi.mock('../studyGroup/StudyGroupProvider', () => ({
  useStudyGroup: () => ({ activeStudyGroup: { id: 1, name: 'Mock Group', role: 'Admin' } })
}))

vi.mock('../api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getUser: vi.fn(() => ({ id: 1, email: 'test@example.com', role: 'admin', displayName: 'Admin User' })),
    getDeck: vi.fn(async (id) => ({ id: Number(id), title: 'Test Deck' })),
    getStudyQueue: vi.fn(async () => ({
      newCount: 1,
      learningCount: 0,
      reviewCount: 0,
      dueCards: [{ id: 101, prompt: 'What is C#?', answer: 'A modern OO language', type: 'basic' }]
    })),
    getCards: vi.fn(async () => [
      { id: 101, prompt: 'What is C#?', answer: 'A modern OO language', type: 'basic' }
    ]),
    getCardExercises: vi.fn(async () => []),
    getFollowups: vi.fn(async () => []),
    createCard: vi.fn(async (deckId, prompt, answer) => ({ id: 102, prompt, answer, type: 'basic' })),
    updateCard: vi.fn(async () => true),
    deleteCard: vi.fn(async () => true),
    canCreateContent: vi.fn(() => true),
    getEffectiveDisplayName: vi.fn((name) => name || 'User')
  }
})

describe('Deck Page - Card View & Editing Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.alert = vi.fn()
    window.confirm = vi.fn(() => true)
  })

  test('renders card prompt, toolbar without Limits button', async () => {
    render(
      <MemoryRouter initialEntries={['/decks/1']}>
        <Routes>
          <Route path="/decks/:id" element={<Deck />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/What is C#/i)).toBeInTheDocument())

    // Limits button should NOT exist
    expect(screen.queryByText(/^Limits$/i)).not.toBeInTheDocument()

    // Add Card button, Edit button, Import Cards exist
    expect(screen.getByText(/\+ Add Card/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Edit$/i })).toBeInTheDocument()
    expect(screen.getByText(/Import Cards/i)).toBeInTheDocument()
  })

  test('toggles lightweight Add Card drawer and keeps open on submit', async () => {
    render(
      <MemoryRouter initialEntries={['/decks/1']}>
        <Routes>
          <Route path="/decks/:id" element={<Deck />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/What is C#/i)).toBeInTheDocument())

    // Click + Add Card
    fireEvent.click(screen.getByText(/\+ Add Card/i))

    // Form appears without "Existing Cards" section
    expect(screen.getByText(/Add New Card to Deck/i)).toBeInTheDocument()
    expect(screen.queryByText(/Existing Cards/i)).not.toBeInTheDocument()

    // Fill form
    const inputs = screen.getAllByPlaceholderText(/Type card question or prompt using Markdown/i)
    fireEvent.change(inputs[0], { target: { value: 'New Card Question' } })
    const answerInputs = screen.getAllByPlaceholderText(/Type answer in Markdown with syntax-highlighted code blocks/i)
    fireEvent.change(answerInputs[0], { target: { value: 'New Card Answer' } })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /^Add Flashcard$/i }))

    await waitFor(() => {
      expect(api.createCard).toHaveBeenCalledWith('1', 'New Card Question', 'New Card Answer', 'basic')
    })

    // Drawer should still remain open for rapid batch addition
    expect(screen.getByText(/Add New Card to Deck/i)).toBeInTheDocument()
    expect(screen.getByText(/Form stays open for rapid card entry/i)).toBeInTheDocument()
  })

  test('allows in-place editing of the current active card', async () => {
    render(
      <MemoryRouter initialEntries={['/decks/1']}>
        <Routes>
          <Route path="/decks/:id" element={<Deck />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/What is C#/i)).toBeInTheDocument())

    // Click Edit button on the card or toolbar
    const editBtn = screen.getByRole('button', { name: /^Edit$/i })
    fireEvent.click(editBtn)

    // Inline edit form should appear with prefilled content
    expect(screen.getByText(/Edit Flashcard/i)).toBeInTheDocument()
    const promptInput = screen.getByDisplayValue('What is C#?')
    const answerInput = screen.getByDisplayValue('A modern OO language')

    fireEvent.change(promptInput, { target: { value: 'What is C# (Updated)?' } })
    fireEvent.change(answerInput, { target: { value: 'An updated answer' } })

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }))

    await waitFor(() => {
      expect(api.updateCard).toHaveBeenCalledWith(101, 'What is C# (Updated)?', 'An updated answer', 'basic')
    })
  })

  test('allows deleting current card from card toolbar with confirmation', async () => {
    render(
      <MemoryRouter initialEntries={['/decks/1']}>
        <Routes>
          <Route path="/decks/:id" element={<Deck />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/What is C#/i)).toBeInTheDocument())

    const deleteBtn = screen.getByRole('button', { name: /Delete/i })
    fireEvent.click(deleteBtn)

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this card?')
    await waitFor(() => {
      expect(api.deleteCard).toHaveBeenCalledWith('1', 101)
    })
  })
})

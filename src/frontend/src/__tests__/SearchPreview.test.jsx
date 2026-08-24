import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Search from '../pages/Search'
import * as api from '../api'

vi.mock('../studyGroup/StudyGroupProvider', () => ({
  useStudyGroup: () => ({ activeStudyGroup: { id: 1, name: 'Talent Nation Lessons', role: 'Admin' } })
}))

vi.mock('../api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getUser: vi.fn(() => ({ id: 1, email: 'test@example.com', role: 'admin', displayName: 'Admin User' })),
    globalSearch: vi.fn(async (query) => ({
      decks: [],
      cards: [
        {
          id: 101,
          deckId: 5,
          deckTitle: 'Talent Nation Lessons',
          prompt: 'What does the $ prefix before PATH signify?',
          answer: 'It instructs the shell to substitute/expand the variable.',
          type: 'basic'
        }
      ],
      exercises: [],
      followups: []
    })),
    getFollowups: vi.fn(async () => [
      {
        id: 1,
        authorDisplayName: 'Jane Doe',
        createdAt: new Date().toISOString(),
        questionText: 'Is this case sensitive in Linux?'
      }
    ]),
    getCardExercises: vi.fn(async () => []),
    getDecks: vi.fn(async () => [{ id: 5, title: 'Talent Nation Lessons' }]),
    getAllCards: vi.fn(async () => []),
    updateCard: vi.fn(async () => true),
    addFollowup: vi.fn(async (cardId, q) => ({
      id: 2,
      authorDisplayName: 'Admin User',
      createdAt: new Date().toISOString(),
      questionText: q
    })),
    canCreateContent: vi.fn(() => true),
    getEffectiveDisplayName: vi.fn((name) => name || 'User')
  }
})

describe('Search Page - Card Preview Modal Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.alert = vi.fn()
    window.confirm = vi.fn(() => true)
  })

  test('searching query displays cards with Preview button and opens CardDetailModal', async () => {
    render(
      <MemoryRouter initialEntries={['/search']}>
        <Routes>
          <Route path="/search" element={<Search />} />
        </Routes>
      </MemoryRouter>
    )

    const searchInput = screen.getByPlaceholderText(/Search decks, cards, exercises/i)
    fireEvent.change(searchInput, { target: { value: 'prefix' } })

    await waitFor(() => {
      expect(screen.getByText(/What does the \$ prefix before PATH signify\?/i)).toBeInTheDocument()
    })

    const previewBtn = screen.getByRole('button', { name: /👁 Preview/i })
    expect(previewBtn).toBeInTheDocument()

    // Click Preview button
    fireEvent.click(previewBtn)

    // Modal opens with full details
    await waitFor(() => {
      expect(screen.getByText(/🎴 Flashcard Preview/i)).toBeInTheDocument()
    })

    // Edit button is visible for admin
    expect(screen.getByRole('button', { name: /✏️ Edit Card/i })).toBeInTheDocument()

    // Follow-ups tab can be clicked inside modal
    const followupsTabs = screen.getAllByRole('button', { name: /💬 Follow-ups/i })
    const modalFollowupsTab = followupsTabs[followupsTabs.length - 1]
    fireEvent.click(modalFollowupsTab)

    await waitFor(() => {
      expect(screen.getByText(/Is this case sensitive in Linux\?/i)).toBeInTheDocument()
    })
  })
})

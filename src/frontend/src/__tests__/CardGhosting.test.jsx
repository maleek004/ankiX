import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Deck from '../pages/Deck'
import CardDetailModal from '../components/CardDetailModal'
import * as api from '../api'

vi.mock('../studyGroup/StudyGroupProvider', () => ({
  useStudyGroup: () => ({ activeStudyGroup: { id: 1, name: 'Mock Group', role: 'Admin' } })
}))

let mockGhostedIds = new Set([201])

const initialDueCards = [
  { id: 101, prompt: 'Card 1 Question', answer: 'Card 1 Answer', type: 'basic' },
  { id: 102, prompt: 'Card 2 Question', answer: 'Card 2 Answer', type: 'basic' }
]

vi.mock('../api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getUser: vi.fn(() => ({ id: 1, email: 'test@example.com', role: 'admin', displayName: 'Admin User' })),
    getDeck: vi.fn(async (id) => ({ id: Number(id), title: 'Test Deck' })),
    getStudyQueue: vi.fn(async () => {
      const activeCards = initialDueCards.filter(c => !mockGhostedIds.has(c.id))
      return {
        newCount: activeCards.length,
        learningCount: 0,
        reviewCount: 0,
        dueCards: activeCards
      }
    }),
    getCards: vi.fn(async () => initialDueCards),
    getGhostedCards: vi.fn(async () => {
      const ghosted = []
      if (mockGhostedIds.has(201)) {
        ghosted.push({ id: 201, prompt: 'Ghosted Card 1', answer: 'Ghosted Answer 1', type: 'basic', isGhosted: true })
      }
      for (const c of initialDueCards) {
        if (mockGhostedIds.has(c.id)) {
          ghosted.push({ ...c, isGhosted: true })
        }
      }
      return ghosted
    }),
    ghostCard: vi.fn(async (cardId) => {
      mockGhostedIds.add(cardId)
      return { cardId, isGhosted: true, message: 'Card ghosted successfully.' }
    }),
    unghostCard: vi.fn(async (cardId) => {
      mockGhostedIds.delete(cardId)
      return { cardId, isGhosted: false, message: 'Card restored.' }
    }),
    getCardExercises: vi.fn(async () => []),
    getFollowups: vi.fn(async () => []),
    canCreateContent: vi.fn(() => true),
    getEffectiveDisplayName: vi.fn((name) => name || 'User')
  }
})

describe('Story 7.9 - User-Level Card Ghosting & Queue Personalization', () => {
  beforeEach(() => {
    mockGhostedIds = new Set([201])
    vi.clearAllMocks()
    window.alert = vi.fn()
    window.confirm = vi.fn(() => true)
    localStorage.setItem('ankix_token', 'mock_valid_jwt_token')
  })

  describe('Deck.jsx Study Session Ghosting & Drawer', () => {
    test('renders Ghost Card button on active card and Ghosted drawer button in toolbar', async () => {
      render(
        <MemoryRouter initialEntries={['/decks/1']}>
          <Routes>
            <Route path="/decks/:id" element={<Deck />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => expect(screen.getByText(/Card 1 Question/i)).toBeInTheDocument())

      // Ghost Card button is present on active card
      expect(screen.getByRole('button', { name: /👻 Ghost Card/i })).toBeInTheDocument()

      // Ghosted button with badge count is present in toolbar
      expect(screen.getByRole('button', { name: /👻 Ghosted/i })).toBeInTheDocument()
    })

    test('ghosting an active card calls api.ghostCard and advances to next card', async () => {
      render(
        <MemoryRouter initialEntries={['/decks/1']}>
          <Routes>
            <Route path="/decks/:id" element={<Deck />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => expect(screen.getByText(/Card 1 Question/i)).toBeInTheDocument())

      // Click 👻 Ghost Card
      fireEvent.click(screen.getByRole('button', { name: /👻 Ghost Card/i }))

      await waitFor(() => {
        expect(api.ghostCard).toHaveBeenCalledWith(101)
      })

      // Queue advances to Card 2
      await waitFor(() => {
        expect(screen.getByText(/Card 2 Question/i)).toBeInTheDocument()
      })
    })

    test('opens Ghosted Cards drawer and allows unghosting cards back to queue', async () => {
      render(
        <MemoryRouter initialEntries={['/decks/1']}>
          <Routes>
            <Route path="/decks/:id" element={<Deck />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => expect(screen.getByText(/Card 1 Question/i)).toBeInTheDocument())

      // Open Ghosted Cards drawer
      fireEvent.click(screen.getByRole('button', { name: /👻 Ghosted/i }))

      // Verify drawer header and ghosted card content
      expect(screen.getByText(/Ghosted Cards \(/i)).toBeInTheDocument()
      expect(screen.getByText(/Ghosted Card 1/i)).toBeInTheDocument()

      // Click ✨ Un-ghost button
      const unghostBtn = screen.getByRole('button', { name: /✨ Un-ghost/i })
      fireEvent.click(unghostBtn)

      await waitFor(() => {
        expect(api.unghostCard).toHaveBeenCalledWith(201)
        expect(api.getStudyQueue).toHaveBeenCalled()
      })
    })

    test('hides ghosting controls when in guest mode (unauthenticated)', async () => {
      localStorage.removeItem('ankix_token')

      render(
        <MemoryRouter initialEntries={['/decks/1']}>
          <Routes>
            <Route path="/decks/:id" element={<Deck />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => expect(screen.getByText(/Card 1 Question/i)).toBeInTheDocument())

      // Ghost Card and Ghosted drawer buttons should NOT exist in guest mode
      expect(screen.queryByRole('button', { name: /👻 Ghost Card/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /👻 Ghosted/i })).not.toBeInTheDocument()
    })
  })

  describe('CardDetailModal.jsx Ghosting Toggle', () => {
    test('renders Ghost Card button and toggles to Restore Card on click', async () => {
      const mockCard = { id: 301, deckId: 1, prompt: 'Modal Question', answer: 'Modal Answer', isGhosted: false }
      const onCardUpdated = vi.fn()

      render(
        <MemoryRouter>
          <CardDetailModal card={mockCard} onClose={vi.fn()} onCardUpdated={onCardUpdated} />
        </MemoryRouter>
      )

      expect(screen.getByText(/Modal Question/i)).toBeInTheDocument()
      const ghostBtn = screen.getByRole('button', { name: /👻 Ghost Card/i })
      expect(ghostBtn).toBeInTheDocument()

      // Click Ghost Card
      fireEvent.click(ghostBtn)

      await waitFor(() => {
        expect(api.ghostCard).toHaveBeenCalledWith(301)
      })

      // Button toggles to Restore Card and Ghosted badge appears
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /✨ Restore Card/i })).toBeInTheDocument()
        expect(screen.getByText(/👻 Ghosted/i)).toBeInTheDocument()
      })

      expect(onCardUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: 301, isGhosted: true }))

      // Click Restore Card
      const restoreBtn = screen.getByRole('button', { name: /✨ Restore Card/i })
      fireEvent.click(restoreBtn)

      await waitFor(() => {
        expect(api.unghostCard).toHaveBeenCalledWith(301)
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /👻 Ghost Card/i })).toBeInTheDocument()
      })

      expect(onCardUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: 301, isGhosted: false }))
    })
  })
})

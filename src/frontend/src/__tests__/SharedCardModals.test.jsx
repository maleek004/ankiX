import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter } from 'react-router-dom'
import CardExerciseLinkerModal from '../components/CardExerciseLinkerModal'
import ConvertFollowupModal from '../components/ConvertFollowupModal'
import LinkedCardsPreviewModal from '../components/LinkedCardsPreviewModal'

vi.mock('../studyGroup/StudyGroupProvider', () => ({
  useStudyGroup: () => ({
    activeStudyGroup: { id: 'group-1', name: 'Test Group', role: 'admin' },
    setActiveStudyGroupId: vi.fn(),
    studyGroups: [{ id: 'group-1', name: 'Test Group', role: 'admin' }]
  })
}))

vi.mock('../api', () => ({
  getExercises: vi.fn().mockResolvedValue([
    { id: 'ex-1', title: 'Binary Search', language: 'csharp', exerciseType: 'CodeExecution', description: 'Search in sorted array' }
  ]),
  getCardExercises: vi.fn().mockResolvedValue([]),
  createExercise: vi.fn().mockResolvedValue({ id: 'ex-new', title: 'New Exercise' }),
  linkCardExercise: vi.fn().mockResolvedValue({ success: true }),
  unlinkCardExercise: vi.fn().mockResolvedValue({ success: true }),
  getDecks: vi.fn().mockResolvedValue([
    { id: 'deck-1', title: 'Data Structures' }
  ]),
  getAllCards: vi.fn().mockResolvedValue([
    { id: 'card-2', prompt: 'What is a Red-Black tree?', answer: 'A self-balancing BST' }
  ]),
  createCard: vi.fn().mockResolvedValue({ id: 'card-new' }),
  linkFollowupToCard: vi.fn().mockResolvedValue({ success: true }),
  unlinkFollowupCard: vi.fn().mockResolvedValue({ success: true })
}))

describe('Story 7.7: Shared Card Modals & Linker Refactoring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.alert = vi.fn()
    window.confirm = vi.fn().mockReturnValue(true)
  })

  it('renders CardExerciseLinkerModal and allows searching & tab switching', async () => {
    const card = { id: 'card-1', prompt: 'Card Prompt' }
    const onClose = vi.fn()
    const onUpdated = vi.fn()

    render(
      <MemoryRouter>
        <CardExerciseLinkerModal card={card} onClose={onClose} onUpdated={onUpdated} />
      </MemoryRouter>
    )

    expect(screen.getByText(/Link Coding Exercises/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/Binary Search/i)).toBeInTheDocument()
    })

    // Switch to create tab
    fireEvent.click(screen.getByText(/Create & Link New Exercise/i))
    expect(screen.getByPlaceholderText(/e.g. Implement Binary Search/i)).toBeInTheDocument()
  })

  it('renders ConvertFollowupModal and switches between link and create tabs', async () => {
    const followup = { id: 'f-1', questionText: 'How does rotation work?' }
    const parentCard = { id: 'card-1', prompt: 'Tree balancing' }
    const onClose = vi.fn()
    const onConverted = vi.fn()

    render(
      <MemoryRouter>
        <ConvertFollowupModal
          followup={followup}
          parentCard={parentCard}
          currentDeckId="deck-1"
          onClose={onClose}
          onConverted={onConverted}
        />
      </MemoryRouter>
    )

    expect(screen.getByText(/Turn Follow-up into Flashcard/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/What is a Red-Black tree\?/i)).toBeInTheDocument()
    })

    // Switch to create tab
    fireEvent.click(screen.getByText(/Create New Card & Link/i))
    expect(screen.getByText(/Save & Link Card 🎴/i)).toBeInTheDocument()
  })

  it('renders LinkedCardsPreviewModal with single card preview and navigation', () => {
    const modalData = {
      cards: [
        { id: 'c-1', prompt: 'First Answer Card', answer: 'Answer 1', type: 'basic', deckId: 'd-1' },
        { id: 'c-2', prompt: 'Second Answer Card', answer: 'Answer 2', type: 'basic', deckId: 'd-1' }
      ],
      initialIndex: 0,
      followup: { id: 'f-1', questionText: 'Followup question text' },
      parentCard: { id: 'p-1' }
    }
    const onClose = vi.fn()
    const onUnlinked = vi.fn()

    render(
      <MemoryRouter>
        <LinkedCardsPreviewModal modalData={modalData} onClose={onClose} onUnlinked={onUnlinked} />
      </MemoryRouter>
    )

    expect(screen.getByText(/Linked Answer Card/i)).toBeInTheDocument()
    expect(screen.getByText(/Card 1 of 2/i)).toBeInTheDocument()
    expect(screen.getByText(/First Answer Card/i)).toBeInTheDocument()

    // Next card
    fireEvent.click(screen.getByText(/Next Answer Card ›/i))
    expect(screen.getByText(/Card 2 of 2/i)).toBeInTheDocument()
    expect(screen.getByText(/Second Answer Card/i)).toBeInTheDocument()
  })
})

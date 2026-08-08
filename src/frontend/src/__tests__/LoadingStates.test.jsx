import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Decks from '../pages/Decks'
import Exercises from '../pages/Exercises'
import Deck from '../pages/Deck'

vi.mock('../studyGroup/StudyGroupProvider', () => ({
  useStudyGroup: () => ({ activeStudyGroup: { id: 1, name: 'Mock Group', role: 'Admin' } })
}))

vi.mock('../api.js', () => ({
  getDecks: async () => [{ id: 10, title: 'Async Deck' }],
  getExercises: async () => [],
  getMyCollectionExerciseIds: async () => [],
  getMyDueExercises: async () => [],
  getDeck: async () => ({ id: 1, title: 'Async Deck' }),
  getStudyQueue: async () => ({
    newCount: 1,
    learningCount: 0,
    reviewCount: 0,
    dueCards: [{ id: 100, prompt: 'Async Card Prompt', type: 'basic' }]
  }),
  getCards: async () => [{ id: 100, prompt: 'Async Card Prompt', type: 'basic' }],
  getFollowups: async () => [],
  getCardExercises: async () => [],
  canCreateContent: () => true
}))

describe('Resource Loading & Button Disabled States', () => {
  test('Decks lists decks from api and clears loading indicator', async () => {
    render(
      <MemoryRouter>
        <Decks />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Async Deck')).toBeInTheDocument()
    })

    expect(screen.queryByText('Fetching decks...')).not.toBeInTheDocument()
  })

  test('Exercises clears loading indicator after loading', async () => {
    render(
      <MemoryRouter>
        <Exercises />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/🎉 All Caught Up!/i)).toBeInTheDocument()
    })

    expect(screen.queryByText('Fetching exercise queue...')).not.toBeInTheDocument()
  })

  test('Deck page shows card prompt and clears loading indicator', async () => {
    render(
      <MemoryRouter initialEntries={['/decks/1']}>
        <Routes>
          <Route path="/decks/:id" element={<Deck />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Async Card Prompt')).toBeInTheDocument()
    })

    expect(screen.queryByText('Fetching deck cards...')).not.toBeInTheDocument()
  })
})

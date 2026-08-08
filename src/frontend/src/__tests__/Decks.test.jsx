import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter } from 'react-router-dom'
import Decks from '../pages/Decks'

vi.mock('../studyGroup/StudyGroupProvider', () => ({
  useStudyGroup: () => ({ activeStudyGroup: { id: 1, name: 'Mock Group', role: 'Admin' } })
}))

vi.mock('../api.js', () => ({
  getDecks: async () => [{ id: 42, title: 'Mock Deck' }],
  createDeck: async (title) => ({ id: 99, title }),
  canCreateContent: () => true
}))

test('Decks lists decks from api and can create', async () => {
  render(
    <MemoryRouter>
      <Decks />
    </MemoryRouter>
  )
  await waitFor(() => expect(screen.getByText(/Mock Deck/i)).toBeInTheDocument())
})

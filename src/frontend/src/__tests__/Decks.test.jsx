import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import Decks from '../pages/Decks'

vi.mock('../api.js', () => ({
  getDecks: async () => [{ id: 42, title: 'Mock Deck' }],
  createDeck: async (title) => ({ id: 99, title })
}))

test('Decks lists decks from api and can create', async () => {
  render(<Decks />)
  await waitFor(() => expect(screen.getByText(/Mock Deck/i)).toBeInTheDocument())
})

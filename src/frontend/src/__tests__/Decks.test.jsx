import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter } from 'react-router-dom'
import Decks from '../pages/Decks'
import * as api from '../api.js'

const mockSetActiveStudyGroup = vi.fn()

vi.mock('../studyGroup/StudyGroupProvider', () => ({
  useStudyGroup: () => ({
    activeStudyGroup: { id: 1, name: 'Mock Group', slug: 'mock-group', role: 'Admin', isFrozen: false },
    setActiveStudyGroup: mockSetActiveStudyGroup
  })
}))

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 1, email: 'admin@ankix.local' } })
}))

vi.mock('../api.js', () => ({
  getDecks: vi.fn(),
  createDeck: vi.fn(),
  updateDeck: vi.fn(),
  deleteDeck: vi.fn(),
  updateStudyGroup: vi.fn(),
  canCreateContent: () => true
}))

describe('Decks Page Management & Editing', () => {
  beforeEach(() => {
    localStorage.setItem('ankix_token', 'test-token')
    api.getDecks.mockResolvedValue([
      { id: 42, title: 'Mock Deck', description: 'Sample deck description', dueCount: 3, learnCount: 5 }
    ])
    api.updateDeck.mockResolvedValue(true)
    api.updateStudyGroup.mockResolvedValue({ id: 1, name: 'Renamed Study Group', slug: 'mock-group', description: 'New description' })
  })

  afterEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  test('Decks lists decks from api and can create', async () => {
    render(
      <MemoryRouter>
        <Decks />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText(/Mock Deck/i)).toBeInTheDocument())
  })

  test('opens Edit Deck modal from Actions dropdown and saves updated title', async () => {
    render(
      <MemoryRouter>
        <Decks />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/Mock Deck/i)).toBeInTheDocument())

    // Click Actions dropdown button
    const actionsBtn = screen.getByRole('button', { name: /Actions/i })
    fireEvent.click(actionsBtn)

    // Click Edit button in dropdown
    const editBtn = screen.getByRole('button', { name: /^Edit$/i })
    expect(editBtn).toBeInTheDocument()
    fireEvent.click(editBtn)

    // Edit modal should be open
    expect(screen.getByText('✏️ Edit Deck')).toBeInTheDocument()
    const titleInput = screen.getByDisplayValue('Mock Deck')
    fireEvent.change(titleInput, { target: { value: 'Updated Deck Name' } })

    // Save changes
    const saveBtn = screen.getByRole('button', { name: /Save Changes/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(api.updateDeck).toHaveBeenCalledWith(42, 'Updated Deck Name', 'Sample deck description')
      expect(screen.getByText('Updated Deck Name')).toBeInTheDocument()
    })
  })

  test('allows study group admin to rename group via Edit Group button in header', async () => {
    render(
      <MemoryRouter>
        <Decks />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/Decks: Mock Group/i)).toBeInTheDocument())

    const editGroupBtn = screen.getByRole('button', { name: /✏️ Edit Group/i })
    expect(editGroupBtn).toBeInTheDocument()
    fireEvent.click(editGroupBtn)

    expect(screen.getByText('✏️ Edit Study Group Details')).toBeInTheDocument()
    const groupNameInput = screen.getByDisplayValue('Mock Group')
    fireEvent.change(groupNameInput, { target: { value: 'Renamed Study Group' } })

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(api.updateStudyGroup).toHaveBeenCalledWith('mock-group', {
        name: 'Renamed Study Group',
        description: ''
      })
      expect(mockSetActiveStudyGroup).toHaveBeenCalled()
    })
  })
})

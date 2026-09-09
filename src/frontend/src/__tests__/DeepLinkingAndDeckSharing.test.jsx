import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import JoinGroup from '../pages/JoinGroup'
import Deck from '../pages/Deck'
import Decks from '../pages/Decks'
import StudyGroups from '../pages/StudyGroups'
import * as api from '../api'

const mockSyncActiveStudyGroup = vi.fn()
const mockSetActiveStudyGroup = vi.fn()

vi.mock('../studyGroup/StudyGroupProvider', () => ({
  useStudyGroup: () => ({
    activeStudyGroup: null,
    setActiveStudyGroup: mockSetActiveStudyGroup,
    syncActiveStudyGroup: mockSyncActiveStudyGroup
  })
}))

const mockAuthUser = { id: 10, email: 'learner@ankix.local', displayName: 'Learner User' }
let currentAuth = { user: mockAuthUser }

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => currentAuth
}))

vi.mock('../api', async () => {
  const actual = await vi.importActual('../api')
  return {
    ...actual,
    prewarmBackend: vi.fn(),
    getDeck: vi.fn(),
    getStudyQueue: vi.fn(),
    getCards: vi.fn(),
    getGhostedCards: vi.fn(),
    getCardExercises: vi.fn(),
    getDecks: vi.fn(),
    getStudyGroups: vi.fn(),
    getStudyGroupBySlug: vi.fn(),
    getMyStudyGroupInvitations: vi.fn(),
    getStudyGroupInvitePreview: vi.fn(),
    acceptStudyGroupInvite: vi.fn(),
    getStudyGroupInviteLink: vi.fn(),
    createOrUpdateStudyGroupInviteLink: vi.fn(),
    resetStudyGroupInviteLink: vi.fn(),
    requestStudyGroupAccess: vi.fn(),
    getStudyGroupMembers: vi.fn(),
    getStudyGroupJoinRequests: vi.fn()
  }
})

describe('Story 7.13: Deep Linking, Deck Sharing & Shareable Invites', () => {
  const originalClipboard = { ...navigator.clipboard }

  beforeEach(() => {
    currentAuth = { user: mockAuthUser }
    localStorage.setItem('ankix_token', 'test-jwt')
    vi.clearAllMocks()
    window.alert = vi.fn()
    window.confirm = vi.fn().mockReturnValue(true)

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    })
  })

  afterEach(() => {
    Object.assign(navigator, { clipboard: originalClipboard })
    localStorage.clear()
  })

  // ── AC 2.1: Direct Deck URLs & 1-Click Sharing ────────────────────────────
  describe('AC 2.1: Deck Deep Links & 1-Click Sharing', () => {
    test('renders Share Deck button and copies link to clipboard with toast notification', async () => {
      api.getDeck.mockResolvedValue({
        id: 42,
        name: 'Distributed Systems Patterns',
        studyGroupId: 5,
        studyGroupName: 'Backend Architecture Guild',
        studyGroupSlug: 'backend-arch',
        studyGroupPrivacy: 'Public',
        canAccess: true,
        isPrivateDeck: false,
        isMember: true
      })
      api.getStudyQueue.mockResolvedValue({
        newCount: 2,
        learningCount: 0,
        reviewCount: 0,
        dueCards: [{ id: 101, prompt: 'What is Raft?', answer: 'Consensus algorithm' }]
      })
      api.getCards.mockResolvedValue([
        { id: 101, prompt: 'What is Raft?', answer: 'Consensus algorithm' }
      ])
      api.getGhostedCards.mockResolvedValue([])
      api.getCardExercises.mockResolvedValue([])

      render(
        <MemoryRouter initialEntries={['/decks/42']}>
          <Routes>
            <Route path="/decks/:id" element={<Deck />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/What is Raft/i)).toBeInTheDocument()
      })

      // Verifies parent study group context auto-sync
      expect(mockSyncActiveStudyGroup).toHaveBeenCalledWith({
        id: 5,
        slug: 'backend-arch',
        name: 'Backend Architecture Guild'
      })

      // Share button in deck view
      const shareBtn = screen.getByRole('button', { name: /share deck/i })
      expect(shareBtn).toBeInTheDocument()

      fireEvent.click(shareBtn)

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('/decks/42'))
      expect(await screen.findByText(/Deck link copied to clipboard!/i)).toBeInTheDocument()
    })

    test('renders Share Deck action in Decks list dropdown', async () => {
      api.getDecks.mockResolvedValue([
        { id: 77, title: 'Rust Systems Programming', dueCount: 5, learnCount: 1 }
      ])

      render(
        <MemoryRouter initialEntries={['/decks']}>
          <Routes>
            <Route path="/decks" element={<Decks />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Rust Systems Programming')).toBeInTheDocument()
      })

      // Open Actions dropdown
      const actionsBtn = screen.getByRole('button', { name: /actions ▾/i })
      fireEvent.click(actionsBtn)

      const shareAction = screen.getByRole('button', { name: /🔗 share deck/i })
      expect(shareAction).toBeInTheDocument()

      fireEvent.click(shareAction)

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('/decks/77'))
      expect(await screen.findByText(/Deck link copied to clipboard!/i)).toBeInTheDocument()
    })
  })

  // ── AC 2.2: Private Deck Access Gate ──────────────────────────────────────
  describe('AC 2.2: Private Deck Access Gate', () => {
    test('renders friendly access gate for authenticated non-member and supports access request & invite code', async () => {
      api.getDeck.mockResolvedValue({
        id: 88,
        name: 'Confidential Production Incidents',
        canAccess: false,
        isPrivateDeck: true,
        isMember: false,
        studyGroupId: 9,
        studyGroupName: 'SRE Core Team',
        studyGroupSlug: 'sre-core',
        studyGroupDescription: 'Internal post-mortems and runbooks.',
        studyGroupPrivacy: 'Private'
      })
      api.getStudyQueue.mockResolvedValue({ newCount: 0, learningCount: 0, reviewCount: 0, dueCards: [] })
      api.getCards.mockResolvedValue([])

      api.requestStudyGroupAccess.mockResolvedValue({ message: 'Request sent' })
      api.acceptStudyGroupInvite.mockResolvedValue({ message: 'Joined successfully' })

      render(
        <MemoryRouter initialEntries={['/decks/88']}>
          <Routes>
            <Route path="/decks/:id" element={<Deck />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Confidential Production Incidents')).toBeInTheDocument()
        expect(screen.getByText(/This deck belongs to/i)).toBeInTheDocument()
        expect(screen.getByText(/SRE Core Team/i)).toBeInTheDocument()
      })

      // Friendly explanation present instead of blank or 403
      expect(screen.getByText(/You must be a member of this study group/i)).toBeInTheDocument()

      // Request to Join action
      const requestBtn = screen.getByRole('button', { name: /request to join group/i })
      expect(requestBtn).toBeInTheDocument()

      fireEvent.click(requestBtn)
      await waitFor(() => {
        expect(api.requestStudyGroupAccess).toHaveBeenCalledWith('sre-core')
        expect(screen.getByText(/Join request submitted!/i)).toBeInTheDocument()
      })

      // Invite Code entry form
      const codeInput = screen.getByPlaceholderText(/inv_ab12cd34/i)
      const joinCodeBtn = screen.getByRole('button', { name: /join with code/i })

      fireEvent.change(codeInput, { target: { value: 'inv_validToken123' } })
      fireEvent.click(joinCodeBtn)

      await waitFor(() => {
        expect(api.acceptStudyGroupInvite).toHaveBeenCalledWith('inv_validToken123')
      })
    })

    test('renders Sign In button on access gate for guest visitors', async () => {
      currentAuth = { user: null }
      localStorage.removeItem('ankix_token')

      api.getDeck.mockResolvedValue({
        id: 99,
        name: 'Private Clinical Cases',
        canAccess: false,
        isPrivateDeck: true,
        isMember: false,
        studyGroupName: 'Neurosurgery Cohort',
        studyGroupSlug: 'neuro-cohort',
        studyGroupPrivacy: 'Private'
      })
      api.getStudyQueue.mockResolvedValue({ newCount: 0, learningCount: 0, reviewCount: 0, dueCards: [] })
      api.getCards.mockResolvedValue([])

      render(
        <MemoryRouter initialEntries={['/decks/99']}>
          <Routes>
            <Route path="/decks/:id" element={<Deck />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Private Clinical Cases')).toBeInTheDocument()
      })

      const signInBtn = screen.getByRole('button', { name: /sign in to request access \/ join/i })
      expect(signInBtn).toBeInTheDocument()
    })
  })

  // ── AC 2.3: Direct Study Group URLs & 404 Fallback ─────────────────────────
  describe('AC 2.3: Direct Study Group URLs', () => {
    test('navigating to /study-groups/:slug sets active group when exists', async () => {
      api.getStudyGroups.mockResolvedValue([])
      api.getMyStudyGroupInvitations.mockResolvedValue([])
      api.getStudyGroupBySlug.mockResolvedValue({
        id: 12,
        name: 'Deep Learning Lab',
        slug: 'deep-learning-lab',
        description: 'Transformers & LLMs',
        userRole: 'Member',
        privacy: 'Public'
      })

      render(
        <MemoryRouter initialEntries={['/study-groups/deep-learning-lab']}>
          <Routes>
            <Route path="/study-groups/:slug" element={<StudyGroups />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(api.getStudyGroupBySlug).toHaveBeenCalledWith('deep-learning-lab')
        expect(mockSetActiveStudyGroup).toHaveBeenCalledWith(expect.objectContaining({
          id: 12,
          slug: 'deep-learning-lab',
          name: 'Deep Learning Lab'
        }))
        expect(screen.getByText(/Viewing Direct Study Group: Deep Learning Lab/i)).toBeInTheDocument()
      })
    })

    test('displays Study Group Not Found state when slug returns 404', async () => {
      api.getStudyGroups.mockResolvedValue([])
      api.getMyStudyGroupInvitations.mockResolvedValue([])
      api.getStudyGroupBySlug.mockRejectedValue({ status: 404, message: 'Not found' })

      render(
        <MemoryRouter initialEntries={['/study-groups/non-existent-cohort']}>
          <Routes>
            <Route path="/study-groups/:slug" element={<StudyGroups />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Study Group Not Found/i)).toBeInTheDocument()
        expect(screen.getByText(/non-existent-cohort/i)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /browse all groups/i })).toBeInTheDocument()
      })
    })
  })

  // ── AC 2.4: Shareable Invite Links & Join Landing Page ────────────────────
  describe('AC 2.4: Tokenized Shareable Invite Links & /join/:inviteCode', () => {
    test('renders invite preview and allows authenticated user to accept invite', async () => {
      api.getStudyGroupInvitePreview.mockResolvedValue({
        studyGroupId: 25,
        studyGroupName: 'Full-Stack Guild',
        studyGroupSlug: 'fullstack-guild',
        description: 'Collaborative web development mastery.',
        inviteRole: 'Member',
        memberCount: 18,
        isMember: false,
        currentUserRole: null
      })
      api.acceptStudyGroupInvite.mockResolvedValue({
        studyGroupId: 25,
        studyGroupName: 'Full-Stack Guild',
        role: 'Member'
      })

      render(
        <MemoryRouter initialEntries={['/join/inv_testguild456']}>
          <Routes>
            <Route path="/join/:inviteCode" element={<JoinGroup />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Full-Stack Guild')).toBeInTheDocument()
        expect(screen.getByText(/Collaborative web development mastery/i)).toBeInTheDocument()
        expect(screen.getByText(/18/)).toBeInTheDocument()
        expect(screen.getByText(/members/)).toBeInTheDocument()
      })

      const acceptBtn = screen.getByRole('button', { name: /accept & join group/i })
      expect(acceptBtn).toBeInTheDocument()

      fireEvent.click(acceptBtn)

      await waitFor(() => {
        expect(api.acceptStudyGroupInvite).toHaveBeenCalledWith('inv_testguild456')
        expect(mockSetActiveStudyGroup).toHaveBeenCalledWith(expect.objectContaining({
          id: 25,
          name: 'Full-Stack Guild',
          slug: 'fullstack-guild'
        }))
      })
    })

    test('renders already member state if user is already in the study group', async () => {
      api.getStudyGroupInvitePreview.mockResolvedValue({
        studyGroupId: 25,
        studyGroupName: 'Full-Stack Guild',
        studyGroupSlug: 'fullstack-guild',
        description: 'Collaborative web development mastery.',
        inviteRole: 'Member',
        memberCount: 19,
        isMember: true,
        currentUserRole: 'Contributor'
      })

      render(
        <MemoryRouter initialEntries={['/join/inv_testguild456']}>
          <Routes>
            <Route path="/join/:inviteCode" element={<JoinGroup />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/You are already a member/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /enter group decks/i })).toBeInTheDocument()
      })
    })

    test('renders sign in prompt with preserved intent for guest on invite page', async () => {
      currentAuth = { user: null }
      localStorage.removeItem('ankix_token')

      api.getStudyGroupInvitePreview.mockResolvedValue({
        studyGroupId: 30,
        studyGroupName: 'Guest Onboarding Group',
        description: 'Join us to start learning.',
        inviteRole: 'Member',
        memberCount: 5,
        isMember: false
      })

      render(
        <MemoryRouter initialEntries={['/join/inv_guest123']}>
          <Routes>
            <Route path="/join/:inviteCode" element={<JoinGroup />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Guest Onboarding Group')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /sign in to join/i })).toBeInTheDocument()
      })
    })
  })
})

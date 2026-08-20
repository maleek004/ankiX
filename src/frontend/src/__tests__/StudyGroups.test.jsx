import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter } from 'react-router-dom'
import StudyGroups from '../pages/StudyGroups'
import * as api from '../api'

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 10, email: 'test@ankix.local', displayName: 'Test User' },
    logout: vi.fn(),
    oauthLogin: vi.fn()
  })
}))

vi.mock('../studyGroup/StudyGroupProvider', () => ({
  useStudyGroup: () => ({ activeStudyGroup: null, setActiveStudyGroup: vi.fn() })
}))

vi.mock('../api', async () => {
  const actual = await vi.importActual('../api')
  return {
    ...actual,
    getStudyGroups: vi.fn(),
    getMyStudyGroupInvitations: vi.fn(),
    requestStudyGroupAccess: vi.fn(),
    acceptStudyGroupInvitation: vi.fn(),
    declineStudyGroupInvitation: vi.fn(),
    createStudyGroup: vi.fn()
  }
})

describe('StudyGroups Page 3-Tier Privacy UI', () => {
  beforeEach(() => {
    localStorage.setItem('ankix_token', 'test-token')
  })

  afterEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  test('renders 3 privacy tiers and invitations banner correctly', async () => {
    api.getStudyGroups.mockResolvedValue([
      {
        id: 1,
        name: 'Algorithms Public Group',
        slug: 'algo-public',
        description: 'Open to all',
        privacy: 'Public',
        isPublic: true,
        memberCount: 15,
        deckCount: 4,
        exerciseCount: 10,
        userRole: null,
        userMembershipStatus: null
      },
      {
        id: 2,
        name: 'Cardiology Private Cohort',
        slug: 'cardio-private',
        description: 'Request access cohort',
        privacy: 'Private',
        isPublic: false,
        memberCount: 5,
        deckCount: 2,
        exerciseCount: 5,
        userRole: null,
        userMembershipStatus: null
      },
      {
        id: 3,
        name: 'Neuro Surgery Locked Circle',
        slug: 'neuro-locked',
        description: 'Invite only',
        privacy: 'Locked',
        isPublic: false,
        memberCount: 3,
        deckCount: 1,
        exerciseCount: 2,
        userRole: 'Member',
        userMembershipStatus: 'Active'
      },
      {
        id: 4,
        name: 'Dermatology Private Pending',
        slug: 'derma-private',
        description: 'Already requested access',
        privacy: 'Private',
        isPublic: false,
        memberCount: 8,
        deckCount: 3,
        exerciseCount: 4,
        userRole: null,
        userMembershipStatus: 'PendingRequest'
      }
    ])

    api.getMyStudyGroupInvitations.mockResolvedValue([
      {
        studyGroupId: 5,
        studyGroupName: 'Pathology Research Team',
        studyGroupSlug: 'pathology-team',
        description: 'Exclusive research group',
        role: 'Contributor',
        inviterDisplayName: 'Dr. House',
        invitedAt: new Date().toISOString()
      }
    ])

    render(
      <MemoryRouter>
        <StudyGroups />
      </MemoryRouter>
    )

    // Verify invitations banner
    await waitFor(() => {
      expect(screen.getByText(/Pending Group Invitations/i)).toBeInTheDocument()
      expect(screen.getByText(/Pathology Research Team/i)).toBeInTheDocument()
      expect(screen.getByText(/Dr. House/i)).toBeInTheDocument()
    })

    // Verify groups and badges
    expect(screen.getByText('Algorithms Public Group')).toBeInTheDocument()
    expect(screen.getByText(/🌐 Public/i)).toBeInTheDocument()

    expect(screen.getByText('Cardiology Private Cohort')).toBeInTheDocument()
    expect(screen.getAllByText(/🔒 Private \(Request to Join\)/i).length).toBe(2)
    expect(screen.getByText('🔒 Request to Join')).toBeInTheDocument()

    expect(screen.getByText('Neuro Surgery Locked Circle')).toBeInTheDocument()
    expect(screen.getByText(/🛡️ Locked \(Invite Only\)/i)).toBeInTheDocument()

    expect(screen.getByText('Dermatology Private Pending')).toBeInTheDocument()
    expect(screen.getByText('⏳ Request Pending Review')).toBeInTheDocument()
  })
})

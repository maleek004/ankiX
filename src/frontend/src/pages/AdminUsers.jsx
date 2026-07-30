import React, { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { getAdminUsers, updateUserRole } from '../api'

export default function AdminUsers() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRoles, setSelectedRoles] = useState({})
  const [updatingUserId, setUpdatingUserId] = useState(null)

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await getAdminUsers()
      setUsers(data || [])
      const initialRoles = {}
      ;(data || []).forEach(u => {
        initialRoles[u.id] = u.role
      })
      setSelectedRoles(initialRoles)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role === 'Admin') {
      loadUsers()
    }
  }, [user])

  if (user?.role !== 'Admin') {
    return (
      <div style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: 32 }}>
          <h2>🔒 Access Denied</h2>
          <p style={{ color: '#6c757d' }}>You must be logged in as an Admin to manage user roles.</p>
        </div>
      </div>
    )
  }

  const handleRoleChange = (userId, newRole) => {
    setSelectedRoles(prev => ({ ...prev, [userId]: newRole }))
  }

  const handleSaveRole = async (userId) => {
    const newRole = selectedRoles[userId]
    if (!newRole) return
    setUpdatingUserId(userId)
    try {
      await updateUserRole(userId, newRole)
      alert(`User role updated to '${newRole}'!`)
      await loadUsers()
    } catch (err) {
      alert('Failed to update role: ' + (err.message || err))
    } finally {
      setUpdatingUserId(null)
    }
  }

  const filteredUsers = users.filter(u => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      u.email.toLowerCase().includes(q) ||
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q)
    )
  })

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'Admin':
        return { background: '#6f42c1', color: '#fff' }
      case 'Contributor':
        return { background: '#0d6efd', color: '#fff' }
      default:
        return { background: '#6c757d', color: '#fff' }
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '30px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>👥 User Role Management</h2>
          <span style={{ color: '#6c757d', fontSize: '0.9rem' }}>Promote users to Contributor or Admin roles</span>
        </div>
        <button className="btn-study-tool" onClick={loadUsers}>
          ↻ Refresh List
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div style={{ marginBottom: 20 }}>
        <input
          className="form-control"
          placeholder="Search users by email, display name, or role..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ maxWidth: 400 }}
        />
      </div>

      {/* Users Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #dee2e6', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6c757d' }}>Loading registered users...</div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6c757d' }}>No users found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #dee2e6', color: '#495057', fontSize: '0.85rem' }}>
                <th style={{ padding: '12px 16px' }}>USER / EMAIL</th>
                <th style={{ padding: '12px 16px' }}>DISPLAY NAME</th>
                <th style={{ padding: '12px 16px' }}>CURRENT ROLE</th>
                <th style={{ padding: '12px 16px' }}>REGISTERED</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f3f5' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: '#212529' }}>
                    {u.email}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#495057' }}>
                    {u.displayName || <em style={{ color: '#adb5bd' }}>None</em>}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: 12, ...getRoleBadgeStyle(u.role) }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#6c757d', fontSize: '0.85rem' }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <select
                        className="form-control"
                        value={selectedRoles[u.id] || u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '0.85rem', width: 'auto' }}
                      >
                        <option value="User">User</option>
                        <option value="Contributor">Contributor</option>
                        <option value="Admin">Admin</option>
                      </select>
                      <button
                        className="btn-primary"
                        style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                        disabled={updatingUserId === u.id || selectedRoles[u.id] === u.role}
                        onClick={() => handleSaveRole(u.id)}
                      >
                        {updatingUserId === u.id ? 'Saving...' : 'Update Role'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

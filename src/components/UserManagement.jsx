import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { ROLE_LIST } from '../constants/roles';
import { VERTICAL_LIST } from '../constants/verticals';
import './UserManagement.css';

const UserManagement = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [status, setStatus] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching users:", error.message);
      setStatus({ type: 'error', text: 'Failed to load users.' });
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setLoading(true);
    setStatus({ type: '', text: '' });

    console.log("🛠️ Attempting to update user:", editingUser.email, "Role:", editingUser.role_id);

    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        role_id: editingUser.role_id,
        assigned_verticals: editingUser.assigned_verticals
      })
      .eq('id', editingUser.id)
      .select();

    if (error) {
      console.error("❌ Database Update Error:", error);
      setStatus({ type: 'error', text: `Sync Error: ${error.message}` });
      setLoading(false);
    } else if (!data || data.length === 0) {
      console.warn("⚠️ No rows updated. This usually means an RLS Policy violation.");
      setStatus({ type: 'error', text: 'Permission Denied: RLS Policy blocked the update.' });
      setLoading(false);
    } else {
      console.log("✅ Update Successful! Server returned:", data[0]);
      setStatus({ type: 'success', text: 'User permissions synchronized with cloud!' });
      setEditingUser(null);
      await fetchUsers();
    }
  };

  const toggleVertical = (vId) => {
    setEditingUser(prev => {
      const verticals = [...(prev.assigned_verticals || [])];
      if (verticals.includes(vId)) {
        return { ...prev, assigned_verticals: verticals.filter(id => id !== vId) };
      } else {
        return { ...prev, assigned_verticals: [...verticals, vId] };
      }
    });
  };

  if (loading) return <div className="user-mgmt-loading">Loading Users...</div>;

  return (
    <div className="user-management-container">
      <header className="user-mgmt-header">
        <h2>User Management</h2>
        <p>Manage application users, their roles, and vertical access levels.</p>
      </header>

      {status.text && (
        <div className={`status-banner ${status.type}`}>
          {status.text}
          <button onClick={() => setStatus({ type: '', text: '' })}>×</button>
        </div>
      )}

      <div className="user-list-wrapper">
        <table className="user-table">
          <thead>
            <tr>
              <th>Name / Email</th>
              <th>Role</th>
              <th>Vertical Access</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="user-identity">
                    <span className="user-name-cell">{u.name}</span>
                    <span className="user-email-cell">{u.email}</span>
                  </div>
                </td>
                <td>
                  <span className={`role-badge ${u.role_id}`}>
                    {u.role_id?.replace('_', ' ')}
                  </span>
                </td>
                <td>
                  <div className="vertical-tags">
                    {u.assigned_verticals?.length > 0 ? (
                      u.assigned_verticals.map(vId => (
                        <span key={vId} className="v-tag">{vId}</span>
                      ))
                    ) : (
                      <span className="v-tag locked">No Access</span>
                    )}
                  </div>
                </td>
                <td>
                  <button className="halo-button edit-user-btn" onClick={() => setEditingUser({ ...u })}>
                    Edit Permissions
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <div className="edit-modal-overlay">
          <div className="edit-modal">
            <h3>Edit User: {editingUser.name}</h3>
            <form onSubmit={handleUpdateUser}>
              <div className="form-section">
                <label>System Role</label>
                <select 
                  value={editingUser.role_id} 
                  onChange={(e) => setEditingUser({...editingUser, role_id: e.target.value})}
                >
                  {ROLE_LIST.map(r => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-section">
                <label>Assigned Verticals</label>
                <div className="vertical-selection-grid">
                  {VERTICAL_LIST.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      className={`v-select-btn ${editingUser.assigned_verticals?.includes(v.id) ? 'active' : ''}`}
                      onClick={() => toggleVertical(v.id)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setEditingUser(null)}>Cancel</button>
                <button type="submit" className="save-btn">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

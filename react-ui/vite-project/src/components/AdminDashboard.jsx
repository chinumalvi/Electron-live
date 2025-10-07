// src/components/AdminDashboard.jsx
import React, { useEffect, useState } from 'react';

/**
 * AdminDashboard
 * - Lists users (admin-get-users)
 * - Shows create user form (admin-create-user)
 * - Update and delete actions (admin-update-user/admin-delete-user)
 */
export default function AdminDashboard({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState('employee');
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await window.electronAPI['admin-get-users']();
    if (res && res.success) {
      setUsers(res.users);
    } else {
      setError(res && res.message ? res.message : 'Failed to get users');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e) => {
    e && e.preventDefault();
    setMsg(null);
    setError(null);
    try {
      const res = await window.electronAPI['admin-create-user']({ username: createUsername, password: createPassword, role: createRole });
      if (res && res.success) {
        setMsg('User created');
        setCreateUsername('');
        setCreatePassword('');
        setCreateRole('employee');
        fetchUsers();
      } else {
        setError(res && res.message ? res.message : 'Failed to create user');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to create user due to internal error');
    }
  };

  const handleDelete = async (userId) => {
    setMsg(null);
    setError(null);
    if (!confirm('Delete this user? This action cannot be undone.')) return;
    const res = await window.electronAPI['admin-delete-user']({ userId });
    if (res && res.success) {
      setMsg('User deleted');
      fetchUsers();
    } else {
      setError(res && res.message ? res.message : 'Failed to delete user');
    }
  };

  const handleUpdate = async (user) => {
    const newUsername = prompt('New username (leave blank to keep)', user.username) || '';
    const newRole = prompt('New role (admin/employee)', user.role) || user.role;
    if (!newUsername && newRole === user.role) return; // nothing to do

    setMsg(null);
    setError(null);

    const payload = { userId: user._id };
    if (newUsername) payload.username = newUsername;
    if (newRole) payload.role = newRole;

    const res = await window.electronAPI['admin-update-user'](payload);
    if (res && res.success) {
      setMsg('User updated');
      fetchUsers();
    } else {
      setError(res && res.message ? res.message : 'Failed to update user');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Admin Dashboard</h2>
      <p>Logged in as <strong>{currentUser.username}</strong> ({currentUser.role})</p>

      <section style={{ marginTop: 16 }}>
        <h3>Create user</h3>
        <form onSubmit={handleCreate} style={{ maxWidth: 420 }}>
          <div style={{ marginBottom: 8 }}>
            <input placeholder="Username" value={createUsername} onChange={(e) => setCreateUsername(e.target.value)} required style={{ width: '100%', padding: 8 }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <input placeholder="Password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} required type="password" style={{ width: '100%', padding: 8 }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <select value={createRole} onChange={(e) => setCreateRole(e.target.value)} style={{ width: '100%', padding: 8 }}>
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit">Create</button>
        </form>
        {msg && <div style={{ color: 'green', marginTop: 8 }}>{msg}</div>}
        {error && <div style={{ color: 'crimson', marginTop: 8 }}>{error}</div>}
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Users</h3>
        {loading ? <div>Loading users…</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 8 }}>Username</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Role</th>
                <th style={{ padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id} style={{ borderTop: '1px solid #ddd' }}>
                  <td style={{ padding: 8 }}>{u.username}</td>
                  <td style={{ padding: 8 }}>{u.role}</td>
                  <td style={{ padding: 8 }}>
                    <button onClick={() => handleUpdate(u)} style={{ marginRight: 8 }}>Update</button>
                    <button onClick={() => handleDelete(u._id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

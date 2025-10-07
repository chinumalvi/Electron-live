// src/components/SignupForm.jsx
import React, { useState } from 'react';

export default function SignupForm({ onCreateSuccess, isFirstUser = false }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // Allow selecting role only if admin user or first user scenario
  const [role, setRole] = useState(isFirstUser ? 'admin' : 'employee');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await window.electronAPI.registerUser({ username, password, role });
      if (res && res.success) {
        setSuccessMsg('User created successfully.');
        onCreateSuccess && onCreateSuccess(res.user);
      } else {
        setError(res && res.message ? res.message : 'Failed to create user');
      }
    } catch (err) {
      console.error('register error', err);
      setError('Failed to create user due to internal error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: '24px auto' }}>
      <h2>{isFirstUser ? 'Create first admin user' : 'Create user'}</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 8 }}>
          <label>Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} required style={{ width: '100%', padding: 8 }}/>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} required type="password" style={{ width: '100%', padding: 8 }}/>
        </div>

        {isFirstUser ? null : (
          <div style={{ marginBottom: 8 }}>
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%', padding: 8 }}>
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        )}

        {error && <div style={{ color: 'crimson', marginBottom: 8 }}>{error}</div>}
        {successMsg && <div style={{ color: 'green', marginBottom: 8 }}>{successMsg}</div>}
        <button type="submit" disabled={busy} style={{ padding: '8px 12px' }}>
          {busy ? 'Creating…' : 'Create user'}
        </button>
      </form>
    </div>
  );
}

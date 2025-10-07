// src/components/LoginForm.jsx
import React, { useState } from 'react';

export default function LoginForm({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await window.electronAPI.loginUser({ username, password });
      if (res && res.success) {
        onLoginSuccess(res.user);
      } else {
        setError(res && res.message ? res.message : 'Login failed');
      }
    } catch (err) {
      console.error('login error', err);
      setError('Login failed due to internal error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '24px auto' }}>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 8 }}>
          <label>Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            type="password"
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        {error && <div style={{ color: 'crimson', marginBottom: 8 }}>{error}</div>}
        <button type="submit" disabled={busy} style={{ padding: '8px 12px' }}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}

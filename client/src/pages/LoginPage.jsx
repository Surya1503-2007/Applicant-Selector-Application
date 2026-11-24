import React, { useState } from 'react';
import { login } from '../api/client';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError('');
          setSubmitting(true);
          try {
            const data = await login(username, password);
            onLogin(data.user);
          } catch (loginError) {
            setError(loginError.message);
          } finally {
            setSubmitting(false);
          }
        }}
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-7 shadow-sm"
      >
        <h1 className="text-xl font-black text-slate-900">Boardroom Sign In</h1>
        <p className="mt-1 text-sm text-slate-600">RAC DRDO assessment terminal</p>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <label className="mt-6 block text-xs font-bold text-slate-700">
          Username
          <input
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </label>
        <label className="mt-4 block text-xs font-bold text-slate-700">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-md bg-gov-navy px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}

import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { showErrorToast, showSuccessToast } from '../../utils/toast';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: 'maya@example.com', password: 'User@12345' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(form.email, form.password);
      showSuccessToast('Signed in successfully');
      navigate(location.state?.from || (user.role === 'ADMIN' ? '/admin' : '/dashboard'));
    } catch (err) {
      setError(showErrorToast(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto flex max-w-md flex-col px-4 py-12">
        <div className="panel p-6">
          <h1 className="text-2xl font-semibold text-slate-950">Login</h1>
          <p className="mt-2 text-sm text-slate-500">Use a customer or bank-staff demo account.</p>
          {error ? <div className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div>
              <label>Email</label>
              <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </div>
            <div>
              <label>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </div>
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p className="mt-4 text-sm text-slate-500">
            New here?{' '}
            <Link to="/register" className="font-semibold text-bank">
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

import React, { useState } from 'react';
import { Landmark } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import { showErrorToast, showSuccessToast } from '../../utils/toast';

function homeFor(user) {
  return user?.effectivePermissions?.includes('dashboard.view') ? '/admin' : '/profile';
}

export default function LoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const branding = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const signedIn = await login(form.email, form.password);
      showSuccessToast('Signed in successfully');
      navigate(location.state?.from || homeFor(signedIn));
    } catch (err) {
      setError(showErrorToast(err));
    } finally {
      setLoading(false);
    }
  }

  if (!authLoading && user) {
    return <Navigate to={homeFor(user)} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-12">
      <main className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="h-14 w-14 rounded-md object-contain" />
          ) : (
            <span className="grid h-14 w-14 place-items-center rounded-md bg-bank text-white">
              <Landmark size={26} />
            </span>
          )}
          <p className="mt-3 text-lg font-semibold text-slate-950">{branding.name}</p>
          {branding.legalName && branding.legalName !== branding.name ? <p className="text-xs text-slate-500">{branding.legalName}</p> : null}
        </div>
        <div className="panel p-6">
          <h1 className="text-2xl font-semibold text-slate-950">Staff login</h1>
          <p className="mt-2 text-sm text-slate-500">Internal access only. Contact your admin if you need an account.</p>
          {error ? <div className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div>
              <label>Email</label>
              <input type="email" autoComplete="username" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
            </div>
            <div>
              <label>Password</label>
              <input
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
              />
            </div>
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
        {branding.supportEmail ? <p className="mt-4 text-center text-xs text-slate-500">Support: {branding.supportEmail}</p> : null}
      </main>
    </div>
  );
}

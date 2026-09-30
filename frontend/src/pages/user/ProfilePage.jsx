import React, { useEffect, useState } from 'react';
import { Save, ShieldCheck } from 'lucide-react';
import { api } from '../../api/client';
import { ErrorState, LoadingState } from '../../components/AsyncState';
import { useAuth } from '../../context/AuthContext';
import { showErrorToast, showSuccessToast } from '../../utils/toast';

export default function ProfilePage() {
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', address: '', occupation: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/users/profile')
      .then((response) => {
        setForm({
          name: response.data.name || '',
          phone: response.data.phone || '',
          address: response.data.address || '',
          occupation: response.data.occupation || '',
        });
      })
      .catch((err) => setError(showErrorToast(err)))
      .finally(() => setLoading(false));
  }, []);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.patch('/users/profile', form);
      await refreshUser();
      setMessage('Profile updated.');
      showSuccessToast('Profile updated');
    } catch (err) {
      setError(showErrorToast(err));
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.patch('/users/profile/password', passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setMessage('Password changed. Other sessions were signed out.');
      showSuccessToast('Password changed successfully');
    } catch (err) {
      setError(showErrorToast(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Loading profile..." />;
  if (error && !form.name) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Keep your staff profile and account security details current.</p>
      </div>
      {error ? <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <section className="panel p-5">
          <h2 className="text-lg font-semibold">Personal details</h2>
          <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={saveProfile}>
            <div>
              <label>Name</label>
              <input value={form.name} onChange={(event) => update('name', event.target.value)} />
            </div>
            <div>
              <label>Phone</label>
              <input value={form.phone} onChange={(event) => update('phone', event.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label>Designation</label>
              <input value={form.occupation} onChange={(event) => update('occupation', event.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label>Address</label>
              <textarea rows={3} value={form.address} onChange={(event) => update('address', event.target.value)} />
            </div>
            <button className="btn-primary md:col-span-2" disabled={saving}>
              <Save size={18} />
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </form>
        </section>

        <section className="panel p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-bank" size={20} />
            <h2 className="text-lg font-semibold">Password</h2>
          </div>
          <form className="mt-5 space-y-4" onSubmit={changePassword}>
            <div>
              <label>Current password</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
              />
            </div>
            <div>
              <label>New password</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
              />
            </div>
            <button className="btn-secondary w-full" disabled={saving}>
              Change password
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

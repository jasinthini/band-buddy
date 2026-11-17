import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import ProfileGoalSettings from './ProfileGoalSettings';
import './ProfileSettings.css';

const TOKEN_KEY = 'band_buddy_access_token';

export default function ProfileSettings() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!sessionStorage.getItem(TOKEN_KEY)) {
      navigate('/login', { replace: true });
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    api.get('/dashboard/overview', { signal })
      .then(({ data }) => {
        if (signal.aborted) return;

        if (!data?.user) {
          setLoadError('Could not load your profile.');
          return;
        }

        setProfile(data);
        setName(data.user.full_name ?? '');
      })
      .catch((error) => {
        if (signal.aborted) return;

        if (error.response?.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          navigate('/login', { replace: true });
          return;
        }

        setLoadError('Could not load your profile. Please try again.');
      });

    return () => controller.abort();
  }, [navigate, retry]);

  async function saveName(event) {
    event.preventDefault();
    if (saving) return;

    const fullName = name.trim();
    setSaveError('');
    setMessage('');

    if (fullName.length < 2) {
      setSaveError('Enter at least two characters.');
      return;
    }

    setSaving(true);

    try {
      const { data: savedUser } = await api.put('/dashboard/settings', {
        full_name: fullName,
      });

      setProfile((current) => ({
        ...current,
        user: { ...current.user, ...savedUser },
      }));
      setName(savedUser.full_name);
      setEditing(false);
      setMessage('Your profile name was updated.');
    } catch (error) {
      if (error.response?.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        navigate('/login', { replace: true });
        return;
      }

      const detail = error.response?.data?.detail;
      setSaveError(typeof detail === 'string' ? detail : 'Could not save your name.');
    } finally {
      setSaving(false);
    }
  }

  const user = profile?.user;
  const goal = profile?.goal;
  const initials = (user?.full_name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'BB';

  return (
    <div className="bb-profile-layout">
      <aside className="bb-profile-sidebar">
        <Link to="/dashboard" className="bb-profile-brand">
          <img src="/images/admin-logo.png" alt="Band Buddy" />
        </Link>

        <nav aria-label="Student navigation">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/mock-tests">Mock Tests</Link>
          <Link to="/plans">Plans &amp; Billing</Link>
          <Link to="/profile-settings" aria-current="page">
            Profile &amp; Settings
          </Link>
        </nav>
      </aside>

      <main className="bb-profile-settings">
        <div className="bb-profile-content">
          <header className="bb-profile-header">
            <h1>Profile &amp; Settings</h1>
            <p>Manage your profile, IELTS goals, and practice preferences.</p>
          </header>

          {loadError ? (
            <div className="bb-profile-card" role="alert">
              <p>{loadError}</p>
              <button
                className="bb-profile-button"
                type="button"
                onClick={() => {
                  setLoadError('');
                  setRetry((value) => value + 1);
                }}
              >
                Try again
              </button>
            </div>
          ) : !user ? (
            <p role="status">Loading your profile…</p>
          ) : (
            <>
              <section className="bb-profile-card" aria-labelledby="profile-heading">
                <h2 id="profile-heading">Profile</h2>

                <div className="bb-profile-identity">
                  <span className="bb-profile-avatar" aria-hidden="true">
                    {initials}
                  </span>

                  <div className="bb-profile-person">
                    <strong>{user.full_name}</strong>
                    <span>{user.email}</span>
                  </div>

                  {!editing && (
                    <button
                      className="bb-profile-button"
                      type="button"
                      onClick={() => {
                        setMessage('');
                        setEditing(true);
                      }}
                    >
                      Edit profile
                    </button>
                  )}
                </div>

                {editing && (
                  <form className="bb-profile-form" onSubmit={saveName}>
                    <label htmlFor="profile-full-name">Full name</label>
                    <input
                      id="profile-full-name"
                      value={name}
                      autoComplete="name"
                      minLength={2}
                      maxLength={100}
                      required
                      disabled={saving}
                      onChange={(event) => setName(event.target.value)}
                    />

                    {saveError && (
                      <p className="bb-profile-error" role="alert">{saveError}</p>
                    )}

                    <div className="bb-profile-actions">
                      <button className="bb-profile-button" type="submit" disabled={saving}>
                        {saving ? 'Saving…' : 'Save changes'}
                      </button>
                      <button
                        className="bb-profile-button bb-profile-button-secondary"
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setName(user.full_name ?? '');
                          setSaveError('');
                          setEditing(false);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {message && (
                  <p className="bb-profile-success" role="status">{message}</p>
                )}
              </section>

              {goal && <ProfileGoalSettings goal={goal} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
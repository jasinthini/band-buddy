import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Dashboard.css';

const TOKEN_KEY = 'band_buddy_access_token';

const skills = [
  ['writing', 'Writing', 'Practise writing tasks and develop your ideas.'],
  ['speaking', 'Speaking', 'Record your answer and practise expressing your thoughts.'],
  ['reading', 'Reading', 'Explore passages and build your understanding.'],
  ['listening', 'Listening', 'Listen to a short conversation and pick out key details.'],
];

const icons = {
  home: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
  writing: 'M13 4H4v17h16v-9M10 14l1-4 8-8 3 3-8 8Z',
  speaking: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8',
  reading: 'M12 6C8 3 5 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-6-1-10 2v15',
  listening: 'M3 14v-3a9 9 0 0 1 18 0v3M3 12h4v9H3ZM17 12h4v9h-4Z',
  history: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l4 2',
  target: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM12 11v2',
  card: 'M3 5h18v14H3ZM3 10h18M7 15h4',
  settings: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 22v-3a8 8 0 0 1 16 0v3',
  logout: 'M9 3H3v18h6M8 12h13m-5-5 5 5-5 5',
  gift: 'M3 8h18v4H3ZM5 12v9h14v-9M12 8v13M12 8C4 8 5 1 9 3l3 5Zm0 0c8 0 7-7 3-5Z',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
};

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d={icons[name]} />
    </svg>
  );
}

function AnalogClock() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const seconds = time.getSeconds();
  const minutes = time.getMinutes() + seconds / 60;
  const hours = (time.getHours() % 12) + minutes / 60;

  return (
    <div className="db-clock" role="img" aria-label={`Local time ${time.toLocaleTimeString()}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="57" fill="#FAFCFF" stroke="#91AEC8" strokeWidth="3" />
        {Array.from({ length: 12 }, (_, index) => {
          const number = index + 1;
          const angle = (number * Math.PI) / 6;
          return (
            <text key={number} x={60 + Math.sin(angle) * 44}
              y={63 - Math.cos(angle) * 44} textAnchor="middle"
              fill="#17365A" fontSize="8" fontFamily="Arial, sans-serif">
              {number}
            </text>
          );
        })}
        <line x1="60" y1="60" x2="60" y2="34" stroke="#17365A"
          strokeWidth="4" strokeLinecap="round" transform={`rotate(${hours * 30} 60 60)`} />
        <line x1="60" y1="60" x2="60" y2="23" stroke="#17365A"
          strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${minutes * 6} 60 60)`} />
        <line x1="60" y1="68" x2="60" y2="19" stroke="#619BCD"
          strokeWidth="1" transform={`rotate(${seconds * 6} 60 60)`} />
        <circle cx="60" cy="60" r="3" fill="#17365A" />
      </svg>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog className="db-dialog" ref={ref} aria-labelledby="db-dialog-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="db-dialog-heading">
        <h2 id="db-dialog-title">{title}</h2>
        <button type="button" aria-label="Close" onClick={onClose}>×</button>
      </div>
      {children}
    </dialog>
  );
}

const examCalendar = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Colombo',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

function examReminder(examDate, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate || '')) return null;

  const parts = examCalendar.formatToParts(now);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  const today = Date.UTC(get('year'), get('month') - 1, get('day'));
  const exam = Date.parse(`${examDate}T00:00:00Z`);
  const days = (exam - today) / 86_400_000;

  return [
    '🎯 Your IELTS exam is today. Good luck!',
    '📅 Your IELTS exam is tomorrow.',
    '📅 Your IELTS exam is in 2 days.',
    '📅 Your IELTS exam is in 3 days.',
  ][days] ?? null;
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-GB') : '—';
}

function errorText(error, fallback) {
  const detail = error.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState('');
  const [name, setName] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [trialDeadline, setTrialDeadline] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [checks, setChecks] = useState([false, false, false]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!sessionStorage.getItem(TOKEN_KEY)) {
      navigate('/login', { replace: true });
      return;
    }

    const controller = new AbortController();
    setError('');

    api.get('/dashboard/overview', { signal: controller.signal })
      .then(({ data: overview }) => {
        if (controller.signal.aborted) return;

        if (!overview.goal) {
          navigate('/goal-setup', { replace: true });
          return;
        }

        const loadedAt = Date.now();
        setData(overview);
        setName(overview.user.full_name);
        setNow(loadedAt);
        setTrialDeadline(loadedAt + overview.access.remaining_seconds * 1000);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;

        if (err.response?.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          navigate('/login', { replace: true });
        } else {
          setError(errorText(err, 'Could not load your dashboard. Please try again.'));
        }
      });

    return () => controller.abort();
  }, [navigate, retry]);

  const paidActive = Boolean(data?.access?.paid_active);
  const daysLeft = Math.max(0, Math.ceil((trialDeadline - now) / 86_400_000));
  const trialText = paidActive
    ? 'Subscription active'
    : daysLeft
      ? `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left · free trial`
      : 'Free trial ended';
  const firstName = data?.user?.full_name?.trim().split(/\s+/)[0] || 'Learner';
  const initial = firstName[0].toUpperCase();
  const recentAttempts = data?.recent_attempts ?? [];
  const drafts = data?.drafts ?? [];
  const reminder = examReminder(data?.goal?.exam_date, now);

  function showPanel(value) {
    setMenuOpen(false);
    setSettingsError('');
    setPanel(value);
  }

  function openPractice(route) {
    setMenuOpen(false);

    if (!paidActive && Date.now() >= trialDeadline) {
      navigate('/plans');
      return;
    }

    navigate(route);
  }

  function jumpToGoal() {
    setMenuOpen(false);
    const goal = document.getElementById('dashboard-goal');
    goal?.scrollIntoView({ block: 'start' });
    goal?.focus({ preventScroll: true });
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    navigate('/login', { replace: true });
  }

  async function saveSettings(event) {
    event.preventDefault();
    if (savingSettings) return;

    setSavingSettings(true);
    setSettingsError('');

    try {
      const { data: savedUser } = await api.put('/dashboard/settings', {
        full_name: name.trim(),
      });

      setData((current) => ({ ...current, user: { ...current.user, ...savedUser } }));
      setName(savedUser.full_name);
      setPanel('');
    } catch (err) {
      setSettingsError(errorText(err, 'Could not save your settings.'));
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="db-page">
      <a className="db-skip" href="#dashboard-content">Skip to content</a>
      {menuOpen && (
        <button className="db-backdrop" type="button" aria-label="Close navigation"
          onClick={() => setMenuOpen(false)} />
      )}

      <aside className={`db-sidebar${menuOpen ? ' is-open' : ''}`} id="db-sidebar">
        <Link to="/dashboard" className="db-logo">
          <img src="/images/logo.png" alt="Band Buddy" />
        </Link>

        <nav className="db-nav" aria-label="Student navigation">
          <Link className="is-active" to="/dashboard" aria-current="page"
            onClick={() => setMenuOpen(false)}>
            <Icon name="home" /> Dashboard
          </Link>

          {skills.map(([key, title]) => (
            <button key={key} type="button" disabled={!data}
              onClick={() => openPractice(`/${key}`)}>
              <Icon name={key} /> {title}
            </button>
          ))}

          <Link to="/mock-tests" onClick={() => setMenuOpen(false)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="3" width="14" height="18" rx="2" />
              <path d="M9 8h6M9 12h6M9 16h4" />
            </svg>
            Mock tests
          </Link>

          <Link to="/writing/history"><Icon name="history" /> Practice history</Link>

          <button type="button" disabled={!data} onClick={jumpToGoal}>
            <Icon name="target" /> Your goal
          </button>

          <Link to="/plans" onClick={() => setMenuOpen(false)}>
            <Icon name="card" /> Plans &amp; Billing
          </Link>

          <Link to="/profile-settings" onClick={() => setMenuOpen(false)}>
            <Icon name="settings" /> Profile &amp; Settings
          </Link>
        </nav>

        <div className="db-sidebar-bottom">
          <button type="button" disabled={!data} onClick={() => showPanel('profile')}>
            <Icon name="user" /> Profile
          </button>
          <button type="button" onClick={logout}><Icon name="logout" /> Log out</button>
        </div>
      </aside>

      <div className="db-workspace">
        <header className="db-topbar">
          <button className="db-menu-button" type="button" aria-label="Toggle navigation"
            aria-controls="db-sidebar" aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}>☰</button>

          <Link to="/" className="db-breadcrumb">
            <Icon name="home" /><span>My learning space</span>
          </Link>

          <div className="db-topbar-actions">
            {data && <span className="db-trial"><Icon name="gift" /> {trialText}</span>}
            <button className="db-upgrade" type="button" onClick={() => navigate('/plans')}>
              Upgrade
            </button>
            <button className="db-account" type="button" disabled={!data}
              aria-label="Open profile" onClick={() => showPanel('profile')}>
              <span className="db-avatar">{initial}</span><span>{firstName}</span>
            </button>
          </div>
        </header>

        <main className="db-main" id="dashboard-content">
          {error ? (
            <div className="db-loading" role="alert">
              <p>{error}</p>
              <button className="db-button" type="button" onClick={() => setRetry((count) => count + 1)}>
                Try again
              </button>
            </div>
          ) : !data ? (
            <p className="db-loading" role="status">Loading your learning space…</p>
          ) : (
            <>
              <section className="db-welcome">
                <h1>Welcome back, {firstName}.</h1>
                <p>A little practice today. More confidence tomorrow.</p>
                <span className="db-trial-note">
                  {paidActive
                    ? 'Your subscription is active.'
                    : daysLeft > 0
                      ? 'Your free trial lasts 14 days from account creation.'
                      : 'Your trial has ended. Your saved writing is still available.'}
                </span>
              </section>

              <section className="db-personal-goal" id="dashboard-goal"
                aria-label="Your IELTS goal" tabIndex={-1}>
                <strong>🎯 Your target band: {Number(data.goal.target_band).toFixed(1)}</strong>
                {reminder && <p role="status">{reminder}</p>}
              </section>

              <section className="db-hero">
                <div className="db-hero-copy">
                  <h2>Make time for<br />your next<br />small step.</h2>
                  <p>Explore a skill and give your ideas a little room to grow.</p>
                </div>
                <img className="db-hero-image" src="/images/dashboard-group.png"
                  alt="Four students studying together" />
                <AnalogClock />
              </section>

              <section className="db-section">
                <h2>Choose your practice</h2>
                <div className="db-skills">
                  {skills.map(([key, title, text]) => (
                    <article className="db-panel db-skill" key={key}>
                      <span className={`db-skill-art db-art-${key}`} aria-hidden="true" />
                      <h3>{title}</h3>
                      <p>{text}</p>
                      <button className="db-button" type="button" onClick={() => openPractice(`/${key}`)}>
                        Start practice <Icon name="arrow" />
                      </button>
                    </article>
                  ))}
                </div>
              </section>

              <div className="db-content-row">
                <section className="db-panel">
                  <div className="db-panel-heading">
                    <h2>Recent writing</h2>
                    <Link to="/writing/history">View all →</Link>
                  </div>

                  {recentAttempts.length ? (
                    <div className="db-table-scroll">
                      <table aria-label="Your latest writing attempts">
                        <thead>
                          <tr><th>Question</th><th>Status</th><th>Saved</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                          {recentAttempts.map((attempt) => (
                            <tr key={attempt.id}>
                              <td>{attempt.title}</td>
                              <td>
                                <span className="db-status">
                                  {attempt.status === 'draft' ? 'Draft' : 'Submitted'}
                                </span>
                              </td>
                              <td>{formatDate(attempt.updated_at)}</td>
                              <td>
                                <Link to="/writing/history">
                                  {attempt.status === 'draft' ? 'Continue' : 'Review'} →
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="db-empty">
                      <p>Your saved writing will appear here.</p>
                      <button className="db-button" type="button" onClick={() => openPractice('/writing')}>
                        Explore writing
                      </button>
                    </div>
                  )}
                </section>

                <section className="db-panel db-checklist">
                  <h2>Your next session</h2>
                  {[
                    'Plan your ideas before you start.',
                    'Take your time to organise a clear answer.',
                    'Review your writing before submitting.',
                  ].map((text, index) => (
                    <label key={text}>
                      <input type="checkbox" checked={checks[index]}
                        onChange={() => setChecks((items) =>
                          items.map((value, position) => position === index ? !value : value)
                        )} />
                      <span>{text}</span>
                    </label>
                  ))}
                  <Link to="/writing/history">View writing history →</Link>
                </section>
              </div>

              <div className="db-content-row">
                <section className="db-panel db-saved-panel">
                  <h2>Your saved writing</h2>

                  {drafts.length ? drafts.map((draft) => (
                    <article className="db-draft" key={draft.id}>
                      <span className="db-draft-icon"><Icon name="writing" /></span>
                      <div>
                        <h3>{draft.title}</h3>
                        <p>{draft.word_count} words · {formatDate(draft.updated_at)}</p>
                      </div>
                      <Link className="db-button" to="/writing/history">Open draft →</Link>
                    </article>
                  )) : (
                    <p className="db-muted">No drafts yet. Save an answer during writing practice to find it here.</p>
                  )}

                  <p className="db-help">Open writing history to select and continue your saved answer.</p>
                  <img className="db-saved-drawing" src="/images/saved-writing.png" alt="" loading="lazy" />
                </section>

                <section className="db-panel db-tip">
                  <h2>Writing tip</h2>
                  <h3>One main idea per paragraph.</h3>
                  <p>Explain your point and support it with a clear reason or example.</p>
                  <span className="db-skill-art db-art-writing" aria-hidden="true" />
                </section>
              </div>

              <section className="db-bottom-banner">
                <img src="/images/home-study.png" alt="" loading="lazy" />
                <div>
                  <h2>Keep going, one session<br />at a time.</h2>
                  <p>Choose a practice and build your skills steadily.</p>
                  <button className="db-button" type="button" onClick={() => openPractice('/writing')}>
                    Open practice <Icon name="arrow" />
                  </button>
                </div>
              </section>

              <footer className="db-footer">Band Buddy · Small steps. Meaningful progress.</footer>
            </>
          )}
        </main>
      </div>

      {panel === 'settings' && data && (
        <Modal title="Settings" onClose={() => setPanel('')}>
          <form className="db-settings-form" onSubmit={saveSettings}>
            <label htmlFor="settings-name">Full name</label>
            <input id="settings-name" value={name} minLength={2} maxLength={100}
              required disabled={savingSettings} onChange={(event) => setName(event.target.value)} />
            <p className="db-help">This updates the name on your account.</p>
            {settingsError && <p className="db-form-error" role="alert">{settingsError}</p>}
            <button className="db-button" type="submit" disabled={savingSettings}>
              {savingSettings ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </Modal>
      )}

      {panel === 'profile' && data && (
        <Modal title="My profile" onClose={() => setPanel('')}>
          <span className="db-avatar">{initial}</span>
          <h3>{data.user.full_name}</h3>
          <p className="db-profile-email">{data.user.email}</p>
          <button className="db-button" type="button" onClick={() => showPanel('settings')}>
            Edit name
          </button>
        </Modal>
      )}
    </div>
  );
}
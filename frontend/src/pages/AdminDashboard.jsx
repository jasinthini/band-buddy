import { Component as ReactComponent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import AdminBillingOverview from '../components/AdminBillingOverview';
import AdminStudents from '../components/AdminStudents';
import AdminResourceUpload from '../components/AdminResourceUpload';
import AdminQuestionReview from '../components/AdminQuestionReview';
import AdminPublishedQuestions from '../components/AdminPublishedQuestions';
import '../App.css';
import './AdminDashboard.css';

const TOKEN_KEY = 'band_buddy_access_token';
const TOPICS_URL = '/admin/speaking/topics';

const PARTS = [
  { value: 'part1', label: 'Part 1 · Familiar topics', points: 4 },
  { value: 'part2', label: 'Part 2 · Long turn', points: 4 },
  { value: 'part3', label: 'Part 3 · Discussion', points: 3 },
];

function errorMessage(error, fallback) {
  const detail = error.response?.data?.detail;

  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).filter(Boolean).join(' ') || fallback;
  }

  return fallback;
}

function handleAuthError(error, navigate) {
  const status = error.response?.status;

  if (status === 401) {
    sessionStorage.removeItem(TOKEN_KEY);
    navigate('/login', { replace: true });
    return true;
  }

  if (status === 403) {
    navigate('/dashboard', { replace: true });
    return true;
  }

  return false;
}

function SpeakingTopics() {
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadTopics() {
      setLoading(true);
      setLoadError('');

      try {
        const { data } = await api.get(TOPICS_URL, { signal });
        if (!signal.aborted) setTopics(data);
      } catch (error) {
        if (signal.aborted) return;

        if (!handleAuthError(error, navigate)) {
          setLoadError(errorMessage(error, 'Could not load speaking topics.'));
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }

    void loadTopics();
    return () => controller.abort();
  }, [navigate, retry]);

  const visibleTopics = topics.filter((topic) => !filter || topic.part === filter);
  const formPart = PARTS.find((part) => part.value === form?.part);
  const isCueCard = form?.part === 'part2';

  function openForm(topic) {
    setActionError('');
    setMessage('');

    setForm(topic
      ? { ...topic, points: [...(topic.points ?? [])] }
      : {
          id: null,
          part: filter || 'part1',
          title: '',
          prompt: '',
          points: ['', '', '', ''],
        }
    );
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updatePoint(index, value) {
    setForm((current) => {
      const points = [...current.points];
      points[index] = value;
      return { ...current, points };
    });
  }

  async function saveTopic(event) {
    event.preventDefault();
    if (!form || !formPart || busy) return;

    const body = {
      part: form.part,
      title: form.title.trim(),
      prompt: form.prompt.trim(),
      points: Array.from(
        { length: formPart.points },
        (_, index) => (form.points[index] ?? '').trim()
      ),
    };

    setActionError('');
    setMessage('');

    if (!body.title || !body.prompt || body.points.some((point) => !point)) {
      setActionError('Enter a title, a main prompt and every required point.');
      return;
    }

    if (
      form.status === 'published' &&
      !window.confirm('Save these changes to the live topic students can see?')
    ) {
      return;
    }

    setBusy(true);

    try {
      const { data } = form.id
        ? await api.put(`${TOPICS_URL}/${form.id}`, body)
        : await api.post(TOPICS_URL, body);

      setTopics((current) =>
        [...current.filter((topic) => topic.id !== data.id), data].sort(
          (first, second) =>
            first.part.localeCompare(second.part) ||
            first.position - second.position ||
            first.id - second.id
        )
      );

      setFilter((current) => current ? data.part : '');
      setMessage(form.id ? 'Topic changes saved.' : 'Draft created.');
      setForm(null);
    } catch (error) {
      if (!handleAuthError(error, navigate)) {
        setActionError(errorMessage(error, 'Could not save the topic.'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(topic) {
    if (busy || form) return;

    const publish = topic.status !== 'published';
    const confirmation = publish
      ? `Publish "${topic.title}" so students can see it?`
      : `Unpublish "${topic.title}" and move it to drafts?`;

    if (!window.confirm(confirmation)) return;

    setActionError('');
    setMessage('');
    setBusy(true);

    try {
      const { data } = await api.patch(`${TOPICS_URL}/${topic.id}/status`, {
        status: publish ? 'published' : 'draft',
      });

      setTopics((current) =>
        current.map((item) => item.id === data.id ? data : item)
      );
      setMessage(publish ? 'Topic published.' : 'Topic unpublished and moved to drafts.');
    } catch (error) {
      if (!handleAuthError(error, navigate)) {
        setActionError(errorMessage(error, 'Could not change the topic status.'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="admin-speaking-title" aria-busy={loading || busy}>
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
        <div>
          <h2 className="h4 fw-bold" id="admin-speaking-title">Speaking Topics</h2>
          <p className="mb-0">Create practice topics and publish them for students.</p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          disabled={loading || Boolean(loadError) || busy || Boolean(form)}
          onClick={() => openForm()}
        >
          Add draft
        </button>
      </div>

      {message && <p className="alert alert-success" role="status">{message}</p>}
      {actionError && <p className="alert alert-danger" role="alert">{actionError}</p>}

      {loading ? (
        <p role="status">Loading speaking topics…</p>
      ) : loadError ? (
        <div role="alert">
          <p>{loadError}</p>
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {form && formPart && (
            <form className="bb-admin-edit-form mb-4" onSubmit={saveTopic}>
              <fieldset disabled={busy}>
                <legend className="h5 fw-bold">
                  {form.id ? 'Edit topic' : 'New speaking draft'}
                </legend>

                {form.status === 'published' && (
                  <p>Saving changes updates the topic students can see.</p>
                )}

                <div className="row g-3">
                  <div className="col-12 col-md-4">
                    <label className="form-label" htmlFor="speaking-topic-part">
                      Part
                    </label>
                    <select
                      id="speaking-topic-part"
                      className="form-select"
                      value={form.part}
                      onChange={(event) => updateField('part', event.target.value)}
                    >
                      {PARTS.map((part) => (
                        <option key={part.value} value={part.value}>{part.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-md-8">
                    <label className="form-label" htmlFor="speaking-topic-title">
                      Topic title
                    </label>
                    <input
                      id="speaking-topic-title"
                      className="form-control"
                      required
                      maxLength={180}
                      value={form.title}
                      onChange={(event) => updateField('title', event.target.value)}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label" htmlFor="speaking-topic-prompt">
                      {isCueCard ? 'Cue card prompt' : 'Main question'}
                    </label>
                    <textarea
                      id="speaking-topic-prompt"
                      className="form-control"
                      rows={2}
                      required
                      maxLength={2000}
                      value={form.prompt}
                      onChange={(event) => updateField('prompt', event.target.value)}
                    />
                  </div>

                  {Array.from({ length: formPart.points }, (_, index) => (
                    <div className="col-12 col-md-6" key={index}>
                      <label className="form-label" htmlFor={`speaking-topic-point-${index}`}>
                        {isCueCard ? 'Guiding point' : 'Follow-up question'} {index + 1}
                      </label>
                      <textarea
                        id={`speaking-topic-point-${index}`}
                        className="form-control"
                        rows={2}
                        required
                        maxLength={500}
                        value={form.points[index] ?? ''}
                        onChange={(event) => updatePoint(index, event.target.value)}
                      />
                    </div>
                  ))}
                </div>

                <div className="d-flex flex-wrap gap-2 mt-3">
                  <button type="submit" className="btn btn-primary">
                    {busy ? 'Saving…' : form.id ? 'Save changes' : 'Create draft'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      setForm(null);
                      setActionError('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </fieldset>
            </form>
          )}

          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <label htmlFor="speaking-topic-filter">Filter by part</label>
            <select
              id="speaking-topic-filter"
              className="form-select w-auto"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="">All parts</option>
              {PARTS.map((part) => (
                <option key={part.value} value={part.value}>{part.label}</option>
              ))}
            </select>
            <span role="status">{visibleTopics.length} topics</span>
          </div>

          {visibleTopics.length === 0 ? (
            <p className="mb-0">No speaking topics in this part yet.</p>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <caption className="visually-hidden">Speaking practice topics</caption>
                <thead>
                  <tr>
                    <th scope="col">Topic</th>
                    <th scope="col">Part</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTopics.map((topic) => {
                    const published = topic.status === 'published';
                    const action = published ? 'Unpublish' : 'Publish';

                    return (
                      <tr key={topic.id}>
                        <th scope="row">{topic.title}</th>
                        <td>{PARTS.find((part) => part.value === topic.part)?.label}</td>
                        <td>
                          <span
                            className="bb-billing-status"
                            data-status={published ? 'published' : 'draft'}
                          >
                            {published ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              disabled={busy || Boolean(form)}
                              aria-label={`Edit ${topic.title}`}
                              onClick={() => openForm(topic)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              disabled={busy || Boolean(form)}
                              aria-label={`${action} ${topic.title}`}
                              onClick={() => changeStatus(topic)}
                            >
                              {action}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

class AdminPanelErrorBoundary extends ReactComponent {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error(`[Admin] ${this.props.label}`, error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="alert alert-danger" role="alert">
          <p className="mb-2">{this.props.label} could not be displayed.</p>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={() => this.setState({ failed: false })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const ADMIN_SECTIONS = [
  { id: 'billing', label: 'Overview & Payments', Component: AdminBillingOverview },
  { id: 'students', label: 'Students', Component: AdminStudents },
  { id: 'upload', label: 'Upload Resources', Component: AdminResourceUpload },
  { id: 'review', label: 'Question Review', Component: AdminQuestionReview },
  { id: 'published', label: 'Published Questions', Component: AdminPublishedQuestions },
  { id: 'speaking', label: 'Speaking Topics', Component: SpeakingTopics },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('billing');
  const [visitedSections, setVisitedSections] = useState(['billing']);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!sessionStorage.getItem(TOKEN_KEY)) {
      navigate('/login', { replace: true });
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    async function checkAdmin() {
      setError('');

      try {
        const { data } = await api.get('/auth/admin-check', { signal });
        if (!signal.aborted) setUser(data);
      } catch (requestError) {
        if (signal.aborted) return;

        if (!handleAuthError(requestError, navigate)) {
          setError('Could not load your admin dashboard. Please try again.');
        }
      }
    }

    void checkAdmin();
    return () => controller.abort();
  }, [navigate, retry]);

  function openSection(id) {
    setActiveSection(id);
    setVisitedSections((current) =>
      current.includes(id) ? current : [...current, id]
    );
  }

  function handleLogout() {
    sessionStorage.removeItem(TOKEN_KEY);
    navigate('/login', { replace: true });
  }

  const sectionTitle = ADMIN_SECTIONS.find(
    (section) => section.id === activeSection
  ).label;

  return (
    <div className="bb-admin-shell">
      <aside className="bb-admin-sidebar">
        <Link className="bb-admin-brand" to="/">
          <img src="/images/admin-logo.png" alt="Band Buddy" />
          <small>Admin workspace</small>
        </Link>

        {user && (
          <nav className="bb-admin-nav" aria-label="Admin sections">
            {ADMIN_SECTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={id === activeSection}
                onClick={() => openSection(id)}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
      </aside>

      <main className="bb-admin-main">
        <header className="bb-admin-header">
          <h1>{sectionTitle}</h1>

          {user && (
            <div className="bb-admin-account">
              <span>{user.full_name}</span>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={handleLogout}
              >
                Log out
              </button>
            </div>
          )}
        </header>

        <div className="bb-admin-content">
          {error ? (
            <div className="alert alert-danger" role="alert">
              <p>{error}</p>
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={() => setRetry((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          ) : !user ? (
            <p role="status">Loading your admin dashboard…</p>
          ) : (
            ADMIN_SECTIONS.filter(({ id }) => visitedSections.includes(id)).map(
              ({ id, label, Component }) => (
                <div
                  className="bb-admin-panel"
                  data-section={id}
                  key={id}
                  hidden={id !== activeSection}
                >
                  <AdminPanelErrorBoundary label={label}>
                    <Component />
                  </AdminPanelErrorBoundary>
                </div>
              )
            )
          )}
        </div>
      </main>
    </div>
  );
}
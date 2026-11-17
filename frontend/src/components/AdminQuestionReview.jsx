import { useEffect, useState } from 'react';
import api from '../services/api';

const DRAFTS_URL = '/admin/resources/writing-drafts';
const PAGE_SIZE = 20;

function getError(error, fallback) {
  const detail = error.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

export default function AdminQuestionReview() {
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function load() {
      try {
        const { data } = await api.get(DRAFTS_URL, {
          signal,
          params: { offset: page * PAGE_SIZE, limit: PAGE_SIZE + 1 },
        });

        if (!signal.aborted) setResult({ page, refresh, data });
      } catch (err) {
        if (!signal.aborted) {
          setResult({
            page,
            refresh,
            error: getError(err, 'Could not load saved drafts.'),
          });
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [page, refresh]);

  const current =
    result?.page === page && result?.refresh === refresh ? result : null;
  const drafts = current?.data?.slice(0, PAGE_SIZE) ?? [];
  const hasNextPage = (current?.data?.length ?? 0) > PAGE_SIZE;

  function reload() {
    setRefresh((value) => value + 1);
  }

  function openDraft(draft) {
    setSelected(draft);
    setError('');
    setMessage('');
  }

  function updateField(field, value) {
    setSelected((draft) => ({ ...draft, [field]: value }));
  }

  async function saveOrPublish(event) {
    event.preventDefault();
    if (!selected || busy) return;

    const publish = event.nativeEvent.submitter?.value === 'publish';
    if (publish && !window.confirm('Publish this question to Writing Practice?')) {
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    const url = `${DRAFTS_URL}/${selected.id}`;
    try {
      const { data: saved } = await api.put(url, {
        category: selected.category,
        title: selected.title.trim(),
        prompt: selected.prompt.trim(),
      });

      setSelected(saved);

      if (publish) {
        await api.post(`${url}/publish`);
        setSelected(null);
        setMessage('Published to Writing Practice.');
        if (drafts.length === 1 && page > 0) {
          setPage(page - 1);
        }
      } else {
        setMessage('Draft changes saved.');
      }

      reload();
    } catch (err) {
      setError(getError(err, 'Could not complete the action. Try again.'));
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="mt-4 rounded-4 border bg-white p-3 p-md-4"
      aria-labelledby="admin-review-heading"
    >
      <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
        <h2 id="admin-review-heading" className="h4 fw-bold">Question Review</h2>
        <button
          type="button"
          className="btn btn-outline-secondary"
          disabled={busy}
          onClick={reload}
        >
          Refresh drafts
        </button>
      </div>

      {message && <p className="alert alert-success" role="status">{message}</p>}
      {error && <p className="alert alert-danger" role="alert">{error}</p>}

      {!current ? (
        <p role="status">Loading drafts…</p>
      ) : current.error ? (
        <p role="alert">{current.error}</p>
      ) : drafts.length === 0 ? (
        <p>No saved drafts on this page.</p>
      ) : (
        <ul className="list-group mb-3">
          {drafts.map((draft) => (
            <li
              key={draft.id}
              className="list-group-item d-flex justify-content-between align-items-center gap-3"
            >
              <div>
                <strong>{draft.title}</strong>
                <span className="d-block text-capitalize">{draft.category}</span>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                disabled={busy || Boolean(selected)}
                onClick={() => openDraft(draft)}
              >
                Review
              </button>
            </li>
          ))}
        </ul>
      )}

      {current && !current.error && (page > 0 || hasNextPage) && (
        <nav className="d-flex align-items-center gap-2 mb-3" aria-label="Draft pages">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={page === 0 || Boolean(selected)}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>Page {page + 1}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={!hasNextPage || Boolean(selected)}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </nav>
      )}

      {selected && (
        <form className="border rounded p-3" onSubmit={saveOrPublish}>
          <fieldset disabled={busy}>
            <legend className="h5">Edit writing draft</legend>

            <label htmlFor="review-title" className="form-label">Title</label>
            <input
              id="review-title"
              className="form-control mb-3"
              value={selected.title}
              maxLength={200}
              required
              onChange={(event) => updateField('title', event.target.value)}
            />

            <label htmlFor="review-prompt" className="form-label">Prompt</label>
            <textarea
              id="review-prompt"
              className="form-control mb-3"
              value={selected.prompt}
              rows={5}
              maxLength={6000}
              required
              onChange={(event) => updateField('prompt', event.target.value)}
            />

            <div className="d-flex flex-wrap gap-2">
              <button type="submit" value="save" className="btn btn-primary">
                Save changes
              </button>
              <button type="submit" value="publish" className="btn btn-success">
                Save & Publish
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => {
                  setSelected(null);
                  setError('');
                }}
              >
                Close
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
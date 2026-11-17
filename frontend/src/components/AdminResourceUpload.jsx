import { useState } from 'react';
import api from '../services/api';

function WritingDraftReview({ text }) {
  const [category, setCategory] = useState('discussion');
  const [draft, setDraft] = useState(null);
  const [savedDraft, setSavedDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function runAction(action, fallback) {
    setBusy(true);
    setError('');

    try {
      await action();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : fallback);
    } finally {
      setBusy(false);
    }
  }

  function generateDraft() {
    void runAction(async () => {
      const { data } = await api.post('/admin/resources/writing-drafts/generate', {
        category,
        text,
      });
      setDraft(data);
      setSavedDraft(null);
    }, 'Could not generate a writing draft.');
  }

  function saveDraft(event) {
    event.preventDefault();

    void runAction(async () => {
      const { data } = await api.post('/admin/resources/writing-drafts', {
        ...draft,
        title: draft.title.trim(),
        prompt: draft.prompt.trim(),
      });
      setDraft(data);
      setSavedDraft(data);
    }, 'Could not save the writing draft.');
  }

  function publishDraft() {
    void runAction(async () => {
      const { data } = await api.post(
        `/admin/resources/writing-drafts/${savedDraft.id}/publish`
      );
      setDraft(data);
      setSavedDraft(data);
    }, 'Could not publish the writing draft.');
  }

  const published = savedDraft?.status === 'published';

  return (
    <section className="mt-4 border rounded p-3" aria-labelledby="writing-draft-title">
      <h3 id="writing-draft-title" className="h5">Writing Task 2 draft</h3>

      <fieldset disabled={busy}>
        <label className="form-label" htmlFor="writing-draft-category">
          Question type
        </label>
        <select
          id="writing-draft-category"
          className="form-select mb-2"
          value={category}
          disabled={Boolean(draft)}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="discussion">Discussion</option>
          <option value="opinion">Opinion</option>
        </select>

        {!draft && (
          <button type="button" className="btn btn-primary" onClick={generateDraft}>
            {busy ? 'Generating…' : 'Generate draft'}
          </button>
        )}

        {draft && (
          <form onSubmit={saveDraft} className="mt-3">
            <label className="form-label" htmlFor="writing-draft-name">Title</label>
            <input
              id="writing-draft-name"
              className="form-control mb-3"
              value={draft.title}
              maxLength={200}
              required
              readOnly={Boolean(savedDraft)}
              onChange={(event) => {
                const title = event.target.value;
                setDraft((current) => ({ ...current, title }));
              }}
            />

            <label className="form-label" htmlFor="writing-draft-prompt">Prompt</label>
            <textarea
              id="writing-draft-prompt"
              className="form-control mb-3"
              rows={5}
              value={draft.prompt}
              maxLength={6000}
              required
              readOnly={Boolean(savedDraft)}
              onChange={(event) => {
                const prompt = event.target.value;
                setDraft((current) => ({ ...current, prompt }));
              }}
            />

            {!savedDraft && (
              <button type="submit" className="btn btn-primary">
                {busy ? 'Saving…' : 'Save draft'}
              </button>
            )}

            {savedDraft && !published && (
              <button type="button" className="btn btn-success" onClick={publishDraft}>
                {busy ? 'Publishing…' : 'Approve & Publish'}
              </button>
            )}

            {published && <p role="status">Published to Writing Practice.</p>}
          </form>
        )}
      </fieldset>

      {error && <p className="alert alert-danger mt-3" role="alert">{error}</p>}
    </section>
  );
}

export default function AdminResourceUpload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  async function extractText(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setPreview(null);

    try {
      const { data } = await api.post('/admin/resources/extract', formData);
      setPreview(data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === 'string' ? detail : 'Could not extract PDF text.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="mt-4 rounded-4 border bg-white p-3 p-md-4"
      aria-labelledby="admin-resource-heading"
    >
      <h2 id="admin-resource-heading" className="h4 fw-bold">Upload Resources</h2>
      <p>Choose a text-based PDF and select up to 10 pages to preview.</p>

      <form onSubmit={extractText}>
        <fieldset disabled={busy}>
          <div className="row g-3 mb-3">
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="resource-pdf">PDF file</label>
              <input
                id="resource-pdf"
                className="form-control"
                type="file"
                name="file"
                accept=".pdf,application/pdf"
                required
              />
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label" htmlFor="resource-start">Start page</label>
              <input
                id="resource-start"
                className="form-control"
                type="number"
                name="start_page"
                min="1"
                defaultValue="1"
                required
              />
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label" htmlFor="resource-end">End page</label>
              <input
                id="resource-end"
                className="form-control"
                type="number"
                name="end_page"
                min="1"
                defaultValue="1"
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary">
            {busy ? 'Extracting…' : 'Extract text'}
          </button>
        </fieldset>
      </form>

      {error && <p className="alert alert-danger mt-3" role="alert">{error}</p>}

      {preview && (
        <div className="mt-4">
          <h3 className="h5">Extracted text</h3>
          <p>Pages {preview.start_page}–{preview.end_page} of {preview.page_count}</p>
          {preview.truncated && <p>Preview is limited to the first 20,000 characters.</p>}
          <pre
            className="rounded border bg-light p-3"
            style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
          >
            {preview.text}
          </pre>
          <WritingDraftReview text={preview.text} />
        </div>
      )}
    </section>
  );
}
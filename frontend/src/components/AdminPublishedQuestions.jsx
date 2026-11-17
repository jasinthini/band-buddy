import { useEffect, useState } from 'react';
import api from '../services/api';

const PAGE_SIZE = 20;
const URL = '/admin/resources/published-writing-questions';

export default function AdminPublishedQuestions() {
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadQuestions() {
      try {
        const { data } = await api.get(URL, {
          signal,
          params: { offset: page * PAGE_SIZE, limit: PAGE_SIZE + 1 },
        });

        if (!signal.aborted) {
          setResult({
            page,
            reload,
            questions: data.slice(0, PAGE_SIZE),
            hasNext: data.length > PAGE_SIZE,
          });
        }
      } catch (error) {
        if (!signal.aborted) {
          const detail = error.response?.data?.detail;
          setResult({
            page,
            reload,
            error: typeof detail === 'string'
              ? detail
              : 'Could not load published questions.',
          });
        }
      }
    }

    void loadQuestions();
    return () => controller.abort();
  }, [page, reload]);

  const current =
    result?.page === page && result?.reload === reload ? result : null;

  return (
    <section
      className="mt-4 rounded-4 border bg-white p-3 p-md-4"
      aria-labelledby="admin-published-heading"
      aria-busy={!current}
    >
      <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
        <h2 id="admin-published-heading" className="h4 fw-bold">
          Published Writing Questions
        </h2>
        <button
          type="button"
          className="btn btn-outline-secondary"
          disabled={!current}
          onClick={() => setReload((value) => value + 1)}
        >
          Refresh
        </button>
      </div>

      {!current ? (
        <p role="status">Loading published questions…</p>
      ) : current.error ? (
        <p className="alert alert-danger mb-0" role="alert">{current.error}</p>
      ) : (
        <>
          {current.questions.length === 0 ? (
            <p className="mb-0">No published questions from PDF uploads on this page.</p>
          ) : (
            <ul className="list-group">
              {current.questions.map((question) => (
                <li className="list-group-item" key={question.id}>
                  <details>
                    <summary>
                      <strong>{question.title}</strong>
                      <span className="badge bg-secondary text-capitalize ms-2">
                        {question.category}
                      </span>
                    </summary>
                    <p className="mt-2 mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                      {question.prompt}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          )}

          {(page > 0 || current.hasNext) && (
            <nav
              className="d-flex align-items-center gap-3 mt-3"
              aria-label="Published question pages"
            >
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>
              <span>Page {page + 1}</span>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={!current.hasNext}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
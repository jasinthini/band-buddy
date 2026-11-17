import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const PAGE_SIZE = 20;
const TOKEN_KEY = 'band_buddy_access_token';

const dateFormat = new Intl.DateTimeFormat('en-LK', {
  dateStyle: 'medium',
  timeZone: 'Asia/Colombo',
});

export default function AdminStudents() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState({ search: '', page: 0 });
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState(null);
  const { search, page } = query;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadStudents() {
      try {
        const { data } = await api.get('/admin/billing/students', {
          signal,
          params: { search, offset: page * PAGE_SIZE, limit: PAGE_SIZE },
        });

        if (!signal.aborted) setResult({ query, retry, data });
      } catch (error) {
        if (signal.aborted) return;

        if (error.response?.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          navigate('/login', { replace: true });
        } else if (error.response?.status === 403) {
          navigate('/dashboard', { replace: true });
        } else {
          setResult({ query, retry, error: 'Could not load students.' });
        }
      }
    }

    void loadStudents();
    return () => controller.abort();
  }, [navigate, query, search, page, retry]);

  const current = result?.query === query && result.retry === retry ? result : null;
  const students = current?.data?.students ?? [];
  const total = current?.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleSearch(event) {
    event.preventDefault();
    setQuery({ search: searchInput.trim(), page: 0 });
  }

  function clearSearch() {
    setSearchInput('');
    setQuery({ search: '', page: 0 });
  }

  return (
    <section className="mt-4 rounded-4 border bg-white p-3 p-md-4"
      aria-labelledby="admin-students-heading">
      <h2 id="admin-students-heading" className="h4 fw-bold">Students</h2>

      <form className="d-flex flex-wrap align-items-end gap-2 mb-3"
        onSubmit={handleSearch}>
        <div>
          <label className="form-label" htmlFor="admin-student-search">
            Search by name or email
          </label>
          <input
            id="admin-student-search"
            className="form-control"
            type="search"
            maxLength={254}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary">Search</button>
        {(search || searchInput) && (
          <button type="button" className="btn btn-outline-secondary" onClick={clearSearch}>
            Clear
          </button>
        )}
      </form>

      {!current ? (
        <p role="status">Loading students…</p>
      ) : current.error ? (
        <div>
          <p role="alert">{current.error}</p>
          <button type="button" className="btn btn-outline-primary"
            onClick={() => setRetry((value) => value + 1)}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <p role="status">{total} {total === 1 ? 'student' : 'students'}</p>

          {students.length === 0 ? (
            <p className="mb-0">
              {search ? 'No students match your search.' : 'No students to display.'}
            </p>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <caption className="visually-hidden">Students and paid plan access</caption>
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Paid access</th>
                    <th scope="col">Access ends</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id}>
                      <th scope="row">
                        {student.full_name}
                        <span className="d-block text-muted fw-normal">{student.email}</span>
                      </th>
                      <td className="text-capitalize">{student.plan_id ?? '—'}</td>
                      <td className="text-capitalize">{student.plan_status}</td>
                      <td>
                        {student.ends_at ? dateFormat.format(new Date(student.ends_at)) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pageCount > 1 && (
            <nav className="d-flex align-items-center gap-3 mt-3"
              aria-label="Student list pages">
              <button type="button" className="btn btn-outline-primary btn-sm"
                disabled={page === 0} onClick={() => setQuery({ search, page: page - 1 })}>
                Previous
              </button>
              <span>Page {page + 1} of {pageCount}</span>
              <button type="button" className="btn btn-outline-primary btn-sm"
                disabled={page + 1 >= pageCount}
                onClick={() => setQuery({ search, page: page + 1 })}>
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
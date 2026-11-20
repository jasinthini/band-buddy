import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const PLAN_NAMES = {
  starter: 'Starter',
  plus: 'Plus',
  premium: 'Premium',
};

const PLAN_STATUS = {
  active: 'Active',
  inactive: 'Inactive',
  expired: 'Expired',
};

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'long',
  timeZone: 'Asia/Colombo',
});

export default function MyPlanSummary() {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadPlan() {
      try {
        const { data } = await api.get('/billing/my-plan', {
          signal,
        });

        if (!signal.aborted) {
          setResult({ plan: data });
        }
      } catch (error) {
        if (signal.aborted) return;

        if (error.response?.status === 401) {
          sessionStorage.removeItem('band_buddy_access_token');
          navigate('/login', { replace: true });
          return;
        }

        setResult({
          error: 'Could not load your plan. Please try again.',
        });
      }
    }

    void loadPlan();

    return () => controller.abort();
  }, [navigate, retry]);

  const plan = result?.plan;
  const expiry = plan?.ends_at
    ? new Date(plan.ends_at)
    : null;

  const expiryLabel =
    expiry && !Number.isNaN(expiry.getTime())
      ? dateFormat.format(expiry)
      : '—';

  return (
    <section
      className="mb-4 rounded-4 border bg-white p-3 p-md-4 shadow-sm"
      aria-labelledby="my-plan-heading"
    >
      <h2 id="my-plan-heading" className="h4 fw-bold">
        My plan
      </h2>

      {!result && (
        <p className="mb-0" role="status">
          Loading your plan…
        </p>
      )}

      {result?.error && (
        <div>
          <p role="alert">{result.error}</p>

          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => {
              setResult(null);
              setRetry((value) => value + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}

      {plan && (
        <dl className="row g-3 mb-0">
          <div className="col-12 col-sm-4">
            <dt>Paid plan</dt>
            <dd className="mb-0">
              {PLAN_NAMES[plan.plan_id] ?? 'No paid plan'}
            </dd>
          </div>

          <div className="col-12 col-sm-4">
            <dt>Status</dt>
            <dd className="mb-0">
              {PLAN_STATUS[plan.status] ?? '—'}
            </dd>
          </div>

          <div className="col-12 col-sm-4">
            <dt>Access ends</dt>
            <dd className="mb-0">{expiryLabel}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
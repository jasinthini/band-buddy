import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const PAGE_SIZE = 20;
const TOKEN_KEY = 'band_buddy_access_token';

const currency = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  maximumFractionDigits: 0,
});

const dateFormat = new Intl.DateTimeFormat('en-LK', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Colombo',
});

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormat.format(date);
}

function StudyIllustration() {
  return (
    <svg
      className="bb-billing-illustration"
      viewBox="0 0 420 220"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M33 186c100-32 165 22 266 0 36-8 64-22 91-42"
        fill="none"
        stroke="#78d4ff"
        strokeWidth="3"
        opacity=".55"
      />
      <path
        d="M222 78c-40-19-80-22-129-10v104c51-12 93-8 129 12 36-20 78-24 129-12V68c-49-12-89-9-129 10Z"
        fill="#ecf8ff"
        stroke="#75c6f3"
        strokeWidth="4"
      />
      <path d="M222 78v106" stroke="#75b5da" strokeWidth="3" />
      <path
        d="M115 93q40-7 83 8m-83 11q40-7 83 8m-83 11q40-7 83 8m47-38q43-15 83-8m-83 27q43-15 83-8m-83 27q43-15 83-8"
        fill="none"
        stroke="#a6cce5"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M64 126V93a49 49 0 0 1 98 0v33"
        fill="none"
        stroke="#72d3ff"
        strokeWidth="14"
      />
      <rect x="52" y="104" width="25" height="46" rx="10" fill="#e2f6ff" />
      <rect x="149" y="104" width="25" height="46" rx="10" fill="#e2f6ff" />
      <path d="m282 168 81-49 8 13-81 49-19 4Z" fill="#ffc46d" />
      <path d="m271 185 9-10 5 7Z" fill="#102b50" />
    </svg>
  );
}

export default function AdminBillingOverview() {
  const navigate = useNavigate();
  const ordersHeading = useRef(null);
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadBilling() {
      try {
        const [overviewResponse, ordersResponse] = await Promise.all([
          api.get('/admin/billing/overview', { signal }),
          api.get('/admin/billing/orders', {
            signal,
            params: { offset: page * PAGE_SIZE, limit: PAGE_SIZE },
          }),
        ]);

        if (signal.aborted) return;

        const overview = overviewResponse.data;
        const { orders, total } = ordersResponse.data ?? {};

        if (!overview || !Array.isArray(orders) || !Number.isFinite(total)) {
          throw new Error('Unexpected billing response');
        }

        setResult({ page, retry, overview, orders, total });
      } catch (error) {
        if (signal.aborted) return;

        if (error.response?.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          navigate('/login', { replace: true });
        } else if (error.response?.status === 403) {
          navigate('/dashboard', { replace: true });
        } else {
          setResult({ page, retry, error: 'Could not load billing data.' });
        }
      }
    }

    void loadBilling();
    return () => controller.abort();
  }, [navigate, page, retry]);

  if (result?.page !== page || result?.retry !== retry) {
    return <p role="status">Loading billing data…</p>;
  }

  if (result.error) {
    return (
      <div className="alert alert-danger" role="alert">
        <p>{result.error}</p>
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={() => setRetry((value) => value + 1)}
        >
          Try again
        </button>
      </div>
    );
  }

  const { overview, orders, total } = result;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const metrics = [
    ['Students', overview.total_students],
    ['Active paid plans', overview.active_plans],
    ['Pending orders', overview.pending_orders],
    ['Total paid to date', currency.format(overview.paid_total_lkr)],
  ];

  function jumpToOrders() {
    ordersHeading.current?.focus({ preventScroll: true });
    ordersHeading.current?.scrollIntoView({ block: 'start' });
  }

  return (
    <section className="bb-billing" aria-labelledby="admin-billing-heading">
      <div className="bb-billing-hero">
        <div className="bb-billing-hero-copy">
          <h2 id="admin-billing-heading">Billing overview</h2>
          <button type="button" className="bb-billing-jump" onClick={jumpToOrders}>
            View payment orders <span aria-hidden="true">→</span>
          </button>
        </div>
        <StudyIllustration />
      </div>

      <dl className="bb-billing-metrics">
        {metrics.map(([label, value]) => (
          <div className="bb-billing-metric" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section className="bb-billing-orders" aria-labelledby="admin-payment-orders">
        <h3 id="admin-payment-orders" ref={ordersHeading} tabIndex={-1}>
          Payment orders
        </h3>

        {orders.length === 0 ? (
          <p className="mb-0">No billing orders to display.</p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <caption className="visually-hidden">Band Buddy payment orders</caption>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                  <th scope="col">Paid on</th>
                  <th scope="col">Order ID</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.order_id}>
                    <th scope="row">
                      {order.student_name}
                      <span className="d-block text-muted fw-normal">
                        {order.student_email}
                      </span>
                    </th>
                    <td className="text-capitalize">{order.plan_id}</td>
                    <td className="text-nowrap">{currency.format(order.amount_lkr)}</td>
                    <td>
                      <span className="bb-billing-status" data-status={order.status}>
                        {order.status}
                      </span>
                    </td>
                    <td className="text-nowrap">{formatDate(order.created_at)}</td>
                    <td className="text-nowrap">{formatDate(order.paid_at)}</td>
                    <td><code>{order.order_id}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 && (
          <nav className="d-flex align-items-center gap-3 mt-3" aria-label="Payment order pages">
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              disabled={page === 0}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </button>
            <span>Page {page + 1} of {pageCount}</span>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </nav>
        )}
      </section>
    </section>
  );
}
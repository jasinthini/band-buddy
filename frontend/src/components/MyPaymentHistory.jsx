import { useEffect, useState } from 'react';
import api from '../services/api';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeZone: 'Asia/Colombo',
});

const amountFormat = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  maximumFractionDigits: 0,
});

export default function MyPaymentHistory() {
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    api.get('/billing/my-orders', { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setResult({ orders: data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ error: true });
      });

    return () => controller.abort();
  }, [retry]);

  const orders = result?.orders ?? [];

  return (
    <section
      className="mt-4 rounded-4 border bg-white p-3 p-md-4 shadow-sm"
      aria-labelledby="my-payment-history-heading"
    >
      <h2 id="my-payment-history-heading" className="h4 fw-bold">
        Payment history
      </h2>

      {!result && <p role="status">Loading your orders…</p>}

      {result?.error && (
        <div>
          <p role="alert">Could not load your orders.</p>
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

      {result?.orders && orders.length === 0 && (
        <p className="mb-0">You haven’t placed any orders yet.</p>
      )}

      {orders.length > 0 && (
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <caption className="visually-hidden">Your recent plan orders</caption>
            <thead>
              <tr>
                <th scope="col">Order date</th>
                <th scope="col">Plan</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.order_id}>
                  <td>{dateFormat.format(new Date(order.created_at))}</td>
                  <td className="text-capitalize">{order.plan_id}</td>
                  <td>{amountFormat.format(order.amount_lkr)}</td>
                  <td className="text-capitalize">{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
import { useRef, useState } from 'react';
import {
  Link,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import api from '../services/api';
import './Checkout.css';

const TOKEN_KEY = 'band_buddy_access_token';

const plans = [
  { id: 'starter', name: 'Starter', price: 'LKR 990' },
  { id: 'plus', name: 'Plus', price: 'LKR 1,490' },
  { id: 'premium', name: 'Premium', price: 'LKR 1,990' },
];

function CheckoutOrder({ plan }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const submittingRef = useRef(false);
  const orderIdRef = useRef(searchParams.get('order_id') || null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const payment = searchParams.get('payment');
  const returnedFromPayment = payment === 'success';
  const cancelled = payment === 'cancelled';

  async function openStripeCheckout() {
    if (submittingRef.current) return;

    if (!sessionStorage.getItem(TOKEN_KEY)) {
      navigate('/login', { replace: true });
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    setError('');

    try {
      let orderId = orderIdRef.current;

      if (!orderId) {
        const { data: order } = await api.post('/billing/orders', {
          plan_id: plan.id,
        });

        if (typeof order?.order_id !== 'string' || !order.order_id) {
          throw new Error('Unexpected order response');
        }

        orderId = order.order_id;
        orderIdRef.current = orderId;

        // Preserve this order across refreshes and checkout retries.
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('plan', plan.id);
        nextParams.set('order_id', orderId);
        nextParams.delete('payment');
        nextParams.delete('session_id');

        setSearchParams(nextParams, { replace: true });
      }

      const { data } = await api.post(
        `/billing/orders/${encodeURIComponent(orderId)}/checkout`
      );

      if (typeof data?.checkout_url !== 'string') {
        throw new Error('Missing checkout URL');
      }

      const checkoutUrl = new URL(data.checkout_url);

      if (
        checkoutUrl.protocol !== 'https:' ||
        checkoutUrl.hostname !== 'checkout.stripe.com'
      ) {
        throw new Error('Unexpected checkout URL');
      }

      window.location.assign(checkoutUrl.href);
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        navigate('/login', { replace: true });
        return;
      }

      const detail = requestError.response?.data?.detail;

      setError(
        typeof detail === 'string'
          ? detail
          : 'Could not open Stripe checkout. Please try again.'
      );
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <h1 id="checkout-title">
        {returnedFromPayment
          ? 'Check your payment status'
          : 'Review your order'}
      </h1>

      <dl className="bb-checkout-summary">
        <div>
          <dt>Selected plan</dt>
          <dd>{plan.name}</dd>
        </div>

        <div>
          <dt>Access period</dt>
          <dd>30 days</dd>
        </div>

        <div className="bb-checkout-total">
          <dt>Plan price</dt>
          <dd>{plan.price}</dd>
        </div>

        <div>
          <dt>Payment environment</dt>
          <dd>Stripe Sandbox</dd>
        </div>
      </dl>

      {returnedFromPayment ? (
        <>
          <div className="bb-checkout-note" role="status">
            <strong>You have returned from Stripe Checkout.</strong>
            <p>
              Plan access becomes available after the backend verifies
              your payment. Open Plans &amp; Billing to check your plan
              and order status.
            </p>
          </div>

          <Link className="bb-checkout-back" to="/plans">
            View my plan →
          </Link>
        </>
      ) : (
        <>
          <p>
            One-time payment for 30 days of access.
            No automatic renewal.
          </p>

          <div className="bb-checkout-note">
            <strong>Sandbox payment testing</strong>
            <p>
              Use a Stripe test card on the Stripe payment page.
              Sandbox transactions do not collect real money.
            </p>
          </div>

          {cancelled && (
            <div className="bb-checkout-note" role="status">
              <strong>Checkout was cancelled.</strong>
              <p>You can continue when you are ready.</p>
            </div>
          )}

          {error && (
            <p className="bb-checkout-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="bb-checkout-pay"
            type="button"
            disabled={busy}
            aria-busy={busy}
            onClick={openStripeCheckout}
          >
            {busy
              ? 'Opening Stripe checkout…'
              : 'Continue to Stripe Checkout →'}
          </button>
        </>
      )}
    </>
  );
}

export default function Checkout() {
  const [searchParams] = useSearchParams();

  const plan = plans.find(
    (item) => item.id === searchParams.get('plan')
  );

  return (
    <main className="bb-checkout">
      <section
        className="bb-checkout-card"
        aria-labelledby="checkout-title"
      >
        <Link className="bb-checkout-back" to="/plans">
          ← Back to plans
        </Link>

        <p className="bb-checkout-kicker">
          BAND BUDDY · STRIPE SANDBOX
        </p>

        {plan ? (
          <CheckoutOrder key={plan.id} plan={plan} />
        ) : (
          <>
            <h1 id="checkout-title">Choose a plan</h1>
            <p>
              Choose Starter, Plus, or Premium from the
              Plans &amp; Billing page.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
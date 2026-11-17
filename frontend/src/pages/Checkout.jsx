import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './Checkout.css';

const DEMO_PLAN_KEY = 'bb-demo-plan';

const plans = [
  { id: 'starter', name: 'Starter', price: 'LKR 990' },
  { id: 'plus', name: 'Plus', price: 'LKR 1,490' },
  { id: 'premium', name: 'Premium', price: 'LKR 1,990' },
];

function CheckoutOrder({ plan }) {
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  function confirmDemoOrder() {
    setError('');

    try {
      sessionStorage.setItem(DEMO_PLAN_KEY, plan.id);
      setConfirmed(true);
    } catch {
      setError('Could not save the demo plan in this browser. Please try again.');
    }
  }

  return (
    <>
      <h1 id="checkout-title">
        {confirmed ? 'Demo order confirmed' : 'Review your order'}
      </h1>

      <dl className="bb-checkout-summary">
        <div>
          <dt>Selected plan</dt>
          <dd>{plan.name}</dd>
        </div>
        <div>
          <dt>Access period in plan</dt>
          <dd>30 days</dd>
        </div>
        <div className="bb-checkout-total">
          <dt>Plan price</dt>
          <dd>{plan.price}</dd>
        </div>
        <div>
          <dt>Charged in demo</dt>
          <dd>LKR 0</dd>
        </div>
      </dl>

      {confirmed ? (
        <>
          <div className="bb-checkout-note" role="status">
            <strong>{plan.name} demo selection saved.</strong>
            <p>
              No payment was collected. This demo does not activate a paid
              subscription or unlock practice sets yet.
            </p>
          </div>

          <Link className="bb-checkout-back" to="/dashboard">
            Go to dashboard →
          </Link>
        </>
      ) : (
        <>
          <p>Paid plans are one-time purchases with no automatic renewal.</p>

          <div className="bb-checkout-note">
            <strong>No payment will be collected.</strong>
            <p>Confirming saves your demo plan for this browser session.</p>
          </div>

          {error && <p role="alert">{error}</p>}

          <button
            className="bb-checkout-pay"
            type="button"
            onClick={confirmDemoOrder}
          >
            Confirm demo order →
          </button>
        </>
      )}
    </>
  );
}

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const plan = plans.find((item) => item.id === searchParams.get('plan'));

  return (
    <main className="bb-checkout">
      <section className="bb-checkout-card" aria-labelledby="checkout-title">
        <Link className="bb-checkout-back" to="/plans">
          ← Back to plans
        </Link>

        <p className="bb-checkout-kicker">BAND BUDDY · DEMO CHECKOUT</p>

        {plan ? (
          <CheckoutOrder key={plan.id} plan={plan} />
        ) : (
          <>
            <h1 id="checkout-title">Choose a plan</h1>
            <p>Choose Starter, Plus, or Premium from the Plans &amp; Billing page.</p>
          </>
        )}
      </section>
    </main>
  );
}
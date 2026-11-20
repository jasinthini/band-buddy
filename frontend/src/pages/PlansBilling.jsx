import { Link } from 'react-router-dom';
import MyPlanSummary from '../components/MyPlanSummary';
import MyPaymentHistory from '../components/MyPaymentHistory';
import './PlansBilling.css';

const skills = [
  { label: 'Writing', total: 90, unit: 'prompts' },
  { label: 'Speaking', total: 36, unit: 'topics' },
  { label: 'Reading', total: 30, unit: 'sets' },
  { label: 'Listening', total: 20, unit: 'sets' },
];

const plans = [
  {
    id: 'trial',
    name: 'Free Trial',
    price: 'Free',
    duration: '14 days',
    access: [3, 3, 1, 1],
    action: 'Start free trial',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 'LKR 990',
    duration: '30 days',
    access: [20, 10, 5, 5],
    action: 'Get Starter',
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 'LKR 1,490',
    duration: '30 days',
    access: [50, 20, 15, 15],
    action: 'Get Plus',
    featured: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 'LKR 1,990',
    duration: '30 days',
    access: skills.map((skill) => skill.total),
    action: 'Get Premium',
  },
];

const iconPaths = {
  trial: 'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2ZM3 10h18M8 3v4m8-4v4m-8 8h2m4 0h2',
  starter: 'M12 2c0 6 4 10 10 10-6 0-10 4-10 10 0-6-4-10-10-10 6 0 10-4 10-10Z',
  plus: 'M13 2 4 14h7l-1 8 10-12h-7l1-8Z',
  premium: 'm3 7 5 4 4-7 4 7 5-4-3 12H6L3 7Zm3 9h12',
};

function PlanIcon({ id }) {
  return (
    <span className="bb-plan-icon" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={iconPaths[id]} />
      </svg>
    </span>
  );
}

function BillingIllustration() {
  return (
    <svg className="bb-plans-art" viewBox="0 0 180 120" aria-hidden="true">
      <circle cx="99" cy="60" r="52" fill="#c6e4ff" />

      <path
        d="M108 20h37a5 5 0 0 1 5 5v66l-7-5-7 5-7-5-7 5-7-5-12 5V25a5 5 0 0 1 5-5Z"
        fill="#fff"
        stroke="#2568ab"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M113 35h26m-26 10h20"
        fill="none"
        stroke="#6ca8da"
        strokeWidth="3"
        strokeLinecap="round"
      />

      <g transform="rotate(-9 74 70)">
        <rect x="27" y="45" width="100" height="56" rx="10" fill="#102b50" />
        <path d="M27 59h100v10H27z" fill="#367dbd" />
        <rect x="42" y="77" width="16" height="10" rx="3" fill="#c6e4ff" />
        <path d="M72 84h33" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </g>

      <path
        d="M159 39v12m-6-6h12M36 24v12m-6-6h12"
        stroke="#2568ab"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function PlansBilling() {
  return (
    <main className="bb-plans">
      <div className="bb-plans-back">
        <Link to="/dashboard">← Back to dashboard</Link>
      </div>

      <header className="bb-plans-hero">
        <div className="bb-plans-waves" aria-hidden="true" />
        <div>
          <p className="bb-plans-kicker">BAND BUDDY · IELTS PRACTICE</p>
          <h1>Plans &amp; Billing</h1>
          <p>Compare how much practice each plan gives you.</p>
        </div>
        <BillingIllustration />
      </header>

      <MyPlanSummary />

      <p className="bb-plans-preview" role="note">
        Demo checkout is available for paid plans. No payment will be collected.
      </p>

      <section className="bb-plans-grid" aria-label="Compare IELTS practice plans">
        {plans.map((plan, index) => (
          <article
            key={plan.id}
            className={`bb-plan bb-plan--${plan.id}`}
            style={{ '--plan-index': index }}
            aria-labelledby={`bb-plan-title-${plan.id}`}
          >
            {plan.featured && (
              <span className="bb-plan-popular">Most popular</span>
            )}

            <div className="bb-plan-heading">
              <PlanIcon id={plan.id} />
              <h2 id={`bb-plan-title-${plan.id}`}>{plan.name}</h2>
              <p className="bb-plan-price">{plan.price}</p>
              <span className="bb-plan-duration">{plan.duration}</span>
            </div>

            <ul className="bb-plan-features bb-plan-access">
              {skills.map((skill, skillIndex) => {
                const count = plan.access[skillIndex];

                return (
                  <li key={skill.label}>
                    <strong>{skill.label}</strong>
                    <span>
                      {count === skill.total
                        ? `All ${skill.total} ${skill.unit}`
                        : `${count} of ${skill.total} ${skill.unit}`}
                    </span>
                  </li>
                );
              })}
            </ul>

            {plan.id === 'trial' ? (
              <button className="bb-plan-button" type="button" disabled>
                {plan.action}
              </button>
            ) : (
              <Link className="bb-plan-button" to={`/checkout?plan=${plan.id}`}>
                {plan.action}
              </Link>
            )}
          </article>
        ))}
      </section>

      <MyPaymentHistory />

      <footer className="bb-plans-footer">
        <p>
          <strong>Paid plans:</strong> One-time payment for 30 days. No automatic renewal.
        </p>
      </footer>
    </main>
  );
}
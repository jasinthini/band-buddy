import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './GoalSetup.css';

const TOKEN_KEY = 'band_buddy_access_token';

const FIELDS = [
  {
    name: 'target_band',
    label: 'Target band',
    placeholder: 'Choose your target band',
    icon: '🎯',
    options: Array.from({ length: 17 }, (_, index) => {
      const band = (1 + index / 2).toFixed(1);
      return [band, `Band ${band}`];
    }),
  },
  {
    name: 'test_type',
    label: 'Test type',
    placeholder: 'Choose your test type',
    icon: '📘',
    options: [
      ['academic', 'IELTS Academic'],
      ['general', 'IELTS General Training'],
    ],
  },
  {
    name: 'exam_date',
    label: 'Exam date',
    icon: '📅',
  },
  {
    name: 'daily_minutes',
    label: 'Daily practice',
    placeholder: 'Choose your practice time',
    icon: '⏱️',
    options: [10, 15, 20, 30, 45, 60].map((minutes) => [
      String(minutes),
      `${minutes} min/day`,
    ]),
  },
  {
    name: 'focus_skill',
    label: 'Focus skill',
    placeholder: 'Choose your focus skill',
    icon: '✨',
    options: [
      ['writing', 'Writing'],
      ['speaking', 'Speaking'],
      ['reading', 'Reading'],
      ['listening', 'Listening'],
    ],
  },
];

const SKILL_ICONS = {
  writing: '✏️',
  speaking: '🎙️',
  reading: '📖',
  listening: '🎧',
};

function formatDate(value) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function PracticePlan({ values }) {
  return (
    <aside className="gp-paper gp-preview" aria-labelledby="gp-plan-title">
      <p className="gp-kicker">Live preview</p>
      <h2 id="gp-plan-title">Your Practice Plan</h2>
      <p className="gp-intro">Your choices will appear here as you fill in the form.</p>

      <dl className="gp-plan-list">
        {FIELDS.map((field) => {
          const value = values[field.name];
          const text = !value
            ? 'Not set'
            : field.name === 'exam_date'
              ? formatDate(value)
              : field.options.find(([key]) => key === value)?.[1];

          const icon = field.name === 'focus_skill'
            ? SKILL_ICONS[value] || field.icon
            : field.icon;

          return (
            <div className="gp-plan-row" key={field.name}>
              <dt>{field.label}</dt>
              <dd>
                <span
                  key={value || 'empty'}
                  className={value ? 'gp-plan-value gp-drop' : 'gp-plan-value gp-empty'}
                >
                  <span aria-hidden="true">{icon}</span>
                  {text}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </aside>
  );
}

export default function GoalSetup() {
  const navigate = useNavigate();
  const busy = useRef(false);
  const [values, setValues] = useState({
    target_band: '',
    test_type: '',
    exam_date: '',
    daily_minutes: '',
    focus_skill: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    navigate('/login', { replace: true });
  }

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setError('');
  }

  async function saveGoal(event) {
    event.preventDefault();
    if (busy.current) return;

    busy.current = true;
    setSaving(true);
    setError('');

    try {
      await api.put('/dashboard/goal', {
        target_band: Number(values.target_band),
        test_type: values.test_type,
        exam_date: values.exam_date || null,
        daily_minutes: Number(values.daily_minutes),
        focus_skill: values.focus_skill,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        return;
      }

      if (err.response?.status === 409) {
        try {
          const { data } = await api.get('/dashboard/goal');
          if (data.goal) {
            navigate('/dashboard', { replace: true });
            return;
          }
        } catch (checkError) {
          if (checkError.response?.status === 401) {
            logout();
            return;
          }
        }
      }

      const detail = err.response?.data?.detail;
      setError(
        typeof detail === 'string'
          ? detail
          : 'Could not save your goal. Please try again.'
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="gp-page">
      <header className="gp-header">
        <img src="/images/logo.png" alt="Band Buddy" />
        <button type="button" onClick={logout} disabled={saving}>
          Log out
        </button>
      </header>

      <main className="gp-main">
        <svg
          className="gp-path"
          viewBox="0 0 1440 680"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M-40 610 C190 620 180 380 408 430 S660 685 850 480 S1110 212 1260 285 S1390 182 1480 110" />
        </svg>

        <div className="gp-layout">
          <section className="gp-paper gp-form-paper" aria-labelledby="gp-title">
            <p className="gp-kicker">First-time setup</p>
            <h1 id="gp-title">Set your IELTS goal</h1>
            <p className="gp-intro">Tell us what you’re working toward.</p>

            <form onSubmit={saveGoal} aria-busy={saving}>
              <fieldset className="gp-fields" disabled={saving}>
                {FIELDS.map((field) => (
                  <div className="gp-field" key={field.name}>
                    <label htmlFor={`gp-${field.name}`}>
                      {field.label}
                      {!field.options && <small> (optional)</small>}
                    </label>

                    {field.options ? (
                      <select
                        id={`gp-${field.name}`}
                        name={field.name}
                        value={values[field.name]}
                        onChange={updateField}
                        required
                      >
                        <option value="" disabled>{field.placeholder}</option>
                        {field.options.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`gp-${field.name}`}
                        name={field.name}
                        type="date"
                        value={values[field.name]}
                        onChange={updateField}
                      />
                    )}
                  </div>
                ))}
              </fieldset>

              <p className="gp-warning" id="gp-save-note">
                You can’t change your goal after saving.
              </p>
              {error && <p className="gp-error" role="alert">{error}</p>}
              <button className="gp-submit" type="submit" disabled={saving}
                aria-describedby="gp-save-note">
                {saving ? 'Saving…' : 'Save target & continue'}
              </button>
            </form>
          </section>

          <PracticePlan values={values} />
        </div>
      </main>
    </div>
  );
}
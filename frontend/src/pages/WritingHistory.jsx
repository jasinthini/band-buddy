import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import WritingHistoryContent from './WritingHistoryContent';
import { getPracticeAttempts } from '../services/practiceHistory';
import { getWritingAttempts } from '../services/writing';

const TOKEN_KEY = 'band_buddy_access_token';
const PAGE_SIZE = 20;
const VISIBLE_ROWS = 10;
const DAY = 86_400_000;
const WEEK = 7 * DAY;

const SKILLS = [
  { id: 'writing', label: 'Writing', path: '/writing' },
  { id: 'speaking', label: 'Speaking', path: '/speaking' },
  { id: 'reading', label: 'Reading', path: '/reading' },
  { id: 'listening', label: 'Listening', path: '/listening' },
];

const localCalendar = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Colombo',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

const dateLabel = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Colombo',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const weekLabel = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
});

function weekStart(date) {
  const parts = localCalendar.formatToParts(date);
  const part = (type) => Number(parts.find((item) => item.type === type)?.value);
  const day = Date.UTC(part('year'), part('month') - 1, part('day'));
  const weekday = new Date(day).getUTCDay();
  return day - ((weekday + 6) % 7) * DAY;
}

function timestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return NaN;
  return Date.parse(value);
}

function getWeeks(rows) {
  const current = weekStart(new Date());
  const first = current - 7 * WEEK;
  const weeks = Array.from({ length: 8 }, (_, index) => ({
    start: first + index * WEEK,
    count: 0,
  }));

  for (const row of rows) {
    const time = timestamp(row.date);
    if (!Number.isFinite(time)) continue;

    const index = (weekStart(new Date(time)) - first) / WEEK;
    if (index >= 0 && index < weeks.length) weeks[index].count += 1;
  }

  return weeks;
}

function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return '—';
  const value = Math.max(0, Math.floor(Number(seconds)));
  const minutes = Math.floor(value / 60);
  const remaining = value % 60;
  return minutes ? `${minutes}m ${remaining}s` : `${remaining}s`;
}

async function loadSkill(skill, isActive) {
  const items = new Map();
  let offset = 0;

  while (isActive()) {
    const response = skill.id === 'writing'
      ? await getWritingAttempts(offset)
      : await getPracticeAttempts(skill.id, offset, PAGE_SIZE);

    if (!isActive()) return [];

    const batch = Array.isArray(response)
      ? response
      : response?.items ?? response?.attempts;

    if (!Array.isArray(batch)) {
      throw new Error(`Unexpected ${skill.id} history response`);
    }
    if (!batch.length) break;

    const previousSize = items.size;
    for (const attempt of batch) items.set(attempt.id, attempt);

    offset += batch.length;
    if (typeof response?.total === 'number' && offset >= response.total) break;
    if (items.size === previousSize) {
      throw new Error(`Repeated ${skill.id} history page`);
    }
    if (typeof response?.total !== 'number' && batch.length < PAGE_SIZE) break;
  }

  return [...items.values()]
    .filter((attempt) => skill.id !== 'writing' || attempt.status === 'submitted')
    .map((attempt) => ({
      key: `${skill.id}-${attempt.id}`,
      skill: skill.id,
      label: skill.label,
      title: attempt.title || `${skill.label} practice`,
      date: skill.id === 'writing'
        ? attempt.submitted_at || attempt.updated_at || attempt.created_at
        : attempt.created_at,
      seconds: attempt.elapsed_seconds,
      score: attempt.score,
      total: attempt.total_questions,
    }));
}

function WeeklyChart({ weeks }) {
  const width = 720;
  const left = 46;
  const right = 692;
  const top = 20;
  const bottom = 160;
  const maximum = Math.max(4, ...weeks.map((week) => week.count));
  const step = Math.ceil(maximum / 4);
  const ceiling = step * 4;
  const x = (index) => left + index * (right - left) / (weeks.length - 1);
  const y = (count) => bottom - count * (bottom - top) / ceiling;
  const points = weeks.map((week, index) => `${x(index)},${y(week.count)}`).join(' ');
  const total = weeks.reduce((sum, week) => sum + week.count, 0);

  return (
    <section className="ph-panel" aria-labelledby="ph-chart-title">
      <div className="ph-panel-head">
        <div>
          <p className="ph-kicker">YOUR PRACTICE TREND</p>
          <h2 id="ph-chart-title">Weekly activity</h2>
          <p className="ph-muted">Saved attempts across all four skills over the last 8 weeks.</p>
        </div>
        <span className="ph-pill">{total} attempts</span>
      </div>

      {total === 0 ? (
        <p className="ph-empty">No saved attempts in the last 8 weeks. Your next saved practice will appear here.</p>
      ) : (
        <>
          <div className="ph-chart-scroll">
            <svg className="ph-chart" viewBox={`0 0 ${width} 205`}
              role="img" aria-labelledby="ph-chart-label">
              <title id="ph-chart-label">Number of saved practice attempts per week</title>

              {Array.from({ length: 5 }, (_, index) => index * step).map((tick) => (
                <g key={tick}>
                  <line x1={left} y1={y(tick)} x2={right} y2={y(tick)} />
                  <text x={left - 10} y={y(tick)} textAnchor="end" dominantBaseline="middle">
                    {tick}
                  </text>
                </g>
              ))}

              <polygon points={`${left},${bottom} ${points} ${right},${bottom}`} />
              <polyline points={points} />

              {weeks.map((week, index) => (
                <g key={week.start}>
                  <circle cx={x(index)} cy={y(week.count)} r="4.5">
                    <title>{`${weekLabel.format(week.start)}: ${week.count} attempts`}</title>
                  </circle>
                  <text x={x(index)} y="185" textAnchor="middle">
                    {weekLabel.format(week.start)}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <details className="ph-chart-data">
            <summary>View weekly counts</summary>
            <ul>
              {weeks.map((week, index) => (
                <li key={week.start}>
                  <span>Week of {weekLabel.format(week.start)}{index === 7 ? ' (this week)' : ''}</span>
                  <strong>{week.count}</strong>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}

function AttemptList({ rows, selected, shown, onMore }) {
  const skill = SKILLS.find((item) => item.id === selected);

  return (
    <section className="ph-panel" aria-labelledby="ph-list-title">
      <div className="ph-panel-head">
        <div>
          <p className="ph-kicker">SAVED SESSIONS</p>
          <h2 id="ph-list-title">{skill ? `${skill.label} history` : 'All practice history'}</h2>
          <p className="ph-muted">{rows.length} {rows.length === 1 ? 'attempt' : 'attempts'}</p>
        </div>
        {skill && <Link className="ph-button" to={skill.path}>Start practice →</Link>}
      </div>

      {rows.length === 0 ? (
        <p className="ph-empty">No saved attempts yet.</p>
      ) : (
        <ul className="ph-list">
          {rows.slice(0, shown).map((row) => {
            const time = timestamp(row.date);

            return (
              <li key={row.key} className="ph-row">
                <div>
                  <span className="ph-skill">{row.label}</span>
                  <h3>{row.title}</h3>
                  <p className="ph-muted">
                    {Number.isFinite(time) ? dateLabel.format(time) : 'Date unavailable'}
                    {' · Time: '}{formatDuration(row.seconds)}
                  </p>
                </div>

                {(row.skill === 'reading' || row.skill === 'listening') &&
                  row.score != null && row.total != null && (
                    <span className="ph-pill">{row.score}/{row.total}</span>
                  )}
              </li>
            );
          })}
        </ul>
      )}

      {shown < rows.length && (
        <button className="ph-button ph-more" type="button" onClick={onMore}>
          Show more attempts
        </button>
      )}
    </section>
  );
}

export default function WritingHistory() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState('all');
  const [shown, setShown] = useState(VISIBLE_ROWS);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState(null);

  const current = result?.retry === retry ? result : null;
  const rows = current?.rows ?? [];
  const weeks = getWeeks(rows);
  const filtered = selected === 'all'
    ? rows
    : rows.filter((row) => row.skill === selected);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const groups = await Promise.all(
          SKILLS.map((skill) => loadSkill(skill, () => active)),
        );

        if (!active) return;

        const attempts = groups.flat().sort(
          (a, b) => (timestamp(b.date) || 0) - (timestamp(a.date) || 0),
        );
        setResult({ retry, rows: attempts });
      } catch (error) {
        if (!active) return;

        if (error.response?.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          navigate('/login', { replace: true });
          return;
        }

        setResult({ retry, error: true });
      }
    }

    void load();
    return () => { active = false; };
  }, [navigate, retry]);

  function selectSkill(id) {
    setSelected(id);
    setShown(VISIBLE_ROWS);
  }

  return (
    <main className="ph-page">
      <style>{styles}</style>

      <header className="ph-hero">
        <div>
          <p className="ph-kicker">YOUR LEARNING JOURNEY</p>
          <h1>Practice history</h1>
          <p>Review your saved IELTS practice and see how often you practise each week.</p>
        </div>
        <Link className="ph-button" to="/dashboard">← Dashboard</Link>
      </header>

      {!current ? (
        <p className="ph-panel" role="status">Loading weekly activity and practice history…</p>
      ) : current.error ? (
        <section className="ph-panel">
          <p role="alert">Could not load history for all four skills.</p>
          <button className="ph-button" type="button" onClick={() => setRetry((count) => count + 1)}>
            Try again
          </button>
        </section>
      ) : (
        <WeeklyChart weeks={weeks} />
      )}

      <nav className="ph-tabs" aria-label="Filter practice history">
        <button type="button" aria-pressed={selected === 'all'} onClick={() => selectSkill('all')}>
          All skills
        </button>
        {SKILLS.map((skill) => (
          <button key={skill.id} type="button" aria-pressed={selected === skill.id}
            onClick={() => selectSkill(skill.id)}>
            {skill.label}
          </button>
        ))}
      </nav>

      {selected === 'writing' ? (
        <div className="ph-panel ph-writing">
          <WritingHistoryContent />
        </div>
      ) : current && !current.error ? (
        <AttemptList
          rows={filtered}
          selected={selected}
          shown={shown}
          onMore={() => setShown((count) => count + VISIBLE_ROWS)}
        />
      ) : null}
    </main>
  );
}

const styles = `
  .ph-page {
    --ph-ink: #112f50;
    --ph-muted: #40617e;
    --ph-blue: #175db4;
    --ph-line: #c9ddf0;
    box-sizing: border-box;
    width: min(100%, 1250px);
    margin-inline: auto;
    padding: clamp(14px, 3vw, 30px);
    color: var(--ph-ink);
    font: 1rem/1.55 system-ui, sans-serif;
  }

  .ph-page *, .ph-page *::before, .ph-page *::after {
    box-sizing: border-box;
  }

  .ph-page :focus-visible {
    outline: 3px solid #2479d3;
    outline-offset: 3px;
  }

  .ph-page .ph-hero {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    padding: clamp(20px, 4vw, 38px);
    border-radius: 22px;
    background: linear-gradient(120deg, #102d4b, #1b507e);
    color: #fff;
  }

  .ph-page .ph-hero h1 {
    margin: 4px 0 8px;
    color: #fff;
    font: 700 clamp(2rem, 5vw, 3rem)/1.1 Georgia, serif;
  }

  .ph-page .ph-hero p {
    margin: 0;
    color: #e5f2ff;
  }

  .ph-page .ph-hero .ph-kicker {
    color: #b7ddff;
  }

  .ph-page .ph-kicker {
    margin: 0 0 4px;
    color: #245b90;
    font-size: .75rem;
    font-weight: 800;
    letter-spacing: .1em;
  }

  .ph-page .ph-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 8px 15px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: var(--ph-blue);
    color: #fff;
    font: inherit;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }

  .ph-page .ph-hero .ph-button {
    background: #e7f4ff;
    color: #153958;
  }

  .ph-page .ph-button:hover {
    filter: brightness(.93);
  }

  .ph-page .ph-panel {
    margin-top: 16px;
    padding: clamp(15px, 3vw, 26px);
    border: 1px solid var(--ph-line);
    border-radius: 18px;
    background: #fff;
    box-shadow: 0 8px 24px #112f5009;
  }

  .ph-page .ph-panel-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 10px;
  }

  .ph-page .ph-panel-head h2 {
    margin: 0;
    color: var(--ph-ink);
    font-size: clamp(1.3rem, 3vw, 1.7rem);
  }

  .ph-page .ph-muted {
    margin: 4px 0 0;
    color: var(--ph-muted);
    font-size: .9rem;
  }

  .ph-page .ph-pill,
  .ph-page .ph-skill {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 100px;
    background: #e5f2ff;
    color: #164d80;
    font-size: .82rem;
    font-weight: 750;
  }

  .ph-page .ph-chart-scroll {
    overflow-x: auto;
  }

  .ph-page .ph-chart {
    display: block;
    width: 100%;
    min-width: 480px;
    max-height: 260px;
    margin-top: 6px;
  }

  .ph-page .ph-chart line { stroke: #d7e5f2; }
  .ph-page .ph-chart text { fill: #345673; font-size: 12px; }
  .ph-page .ph-chart polygon { fill: #e6f2ff; }
  .ph-page .ph-chart polyline {
    fill: none;
    stroke: #1768c9;
    stroke-width: 3;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .ph-page .ph-chart circle {
    fill: #1768c9;
    stroke: #fff;
    stroke-width: 2;
  }

  .ph-page .ph-chart-data summary {
    cursor: pointer;
    color: #245b90;
    font-weight: 700;
  }

  .ph-page .ph-chart-data ul {
    max-width: 370px;
    padding: 0;
    list-style: none;
  }

  .ph-page .ph-chart-data li {
    display: flex;
    justify-content: space-between;
    padding: 5px 0;
    border-bottom: 1px solid var(--ph-line);
  }

  .ph-page .ph-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 16px;
    padding: 6px;
    border: 1px solid var(--ph-line);
    border-radius: 14px;
    background: #fff;
  }

  .ph-page .ph-tabs button {
    flex: 1 0 auto;
    min-height: 44px;
    padding: 7px 13px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--ph-ink);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .ph-page .ph-tabs button[aria-pressed="true"] {
    background: #d9edff;
    color: #153c63;
  }

  .ph-page .ph-list {
    display: grid;
    gap: 8px;
    margin: 16px 0 0;
    padding: 0;
    list-style: none;
  }

  .ph-page .ph-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 12px 15px;
    border: 1px solid #dbe8f5;
    border-radius: 12px;
    background: #f8fbff;
  }

  .ph-page .ph-row h3 {
    margin: 5px 0 0;
    color: var(--ph-ink);
    font-size: 1rem;
    overflow-wrap: anywhere;
  }

  .ph-page .ph-row .ph-pill {
    flex-shrink: 0;
  }

  .ph-page .ph-more {
    margin-top: 14px;
  }

  .ph-page .ph-empty {
    margin: 14px 0 0;
    padding: 14px;
    border-radius: 10px;
    background: #f0f7ff;
    color: var(--ph-muted);
  }

  .ph-page .ph-writing .wh-page > .wh-header,
  .ph-page .ph-writing .wh-page > .wh-footer,
  .ph-page .ph-writing .wh-heading .wh-eyebrow {
    display: none;
  }

  .ph-page .ph-writing .wh-page {
    min-height: 0;
    background: transparent;
  }

  .ph-page .ph-writing .wh-page > .wh-main {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
  }

  @media (max-width: 540px) {
    .ph-page .ph-tabs button {
      flex-basis: 30%;
    }
  }
`;
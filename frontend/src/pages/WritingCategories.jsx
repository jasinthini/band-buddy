import { useState } from 'react';
import { Link } from 'react-router-dom';
import './WritingCategories.css';

const filters = [
  ['all', 'All writing'],
  ['academic', 'Academic · Task 1'],
  ['general', 'General Training · Task 1'],
  ['essay', 'Task 2 · Essays'],
];

const subtitles = {
  essay: 'TASK 2 · ACADEMIC & GENERAL TRAINING',
  general: 'TASK 1 · GENERAL TRAINING',
  academic: 'TASK 1 · ACADEMIC',
};

const categories = [
  ['discussion', 'essay', 'Discussion essay', 'Explore both views and explain your opinion.'],
  ['opinion', 'essay', 'Opinion essay', 'Explain whether you agree or disagree.'],
  ['letters', 'general', 'Letter writing', 'Practise writing for everyday situations.'],
  ['bar', 'academic', 'Bar chart', 'Compare categories and important figures.'],
  ['line', 'academic', 'Line graph', 'Describe patterns and changes over time.'],
  ['pie', 'academic', 'Pie chart', 'Compare proportions and percentages.'],
  ['map', 'academic', 'Maps', 'Describe locations and changes to a place.'],
  ['process', 'academic', 'Process diagram', 'Explain stages in a process or cycle.'],
  ['table', 'academic', 'Table', 'Summarise data and make comparisons.'],
];

const icons = {
  discussion: 'M3 3h13v10H9l-4 4v-4H3ZM19 8h3v12h-4l-3 3v-3h-4v-4',
  opinion: 'M8 15a6 6 0 1 1 8 0l-1 3H9ZM9 21h6',
  letters: 'M4 5h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm-1 2 9 7 9-7',
  bar: 'M3 3v18h19M7 17v-6M12 17V6M17 17V9',
  line: 'M3 3v18h19M6 15l5-6 5 3 5-7',
  pie: 'M11 3a9 9 0 1 0 10 10H11ZM15 2v7h7a8 8 0 0 0-7-7Z',
  map: 'm2 5 7-3 6 3 7-3v17l-7 3-6-3-7 3ZM9 2v17M15 5v17',
  process: 'M2 3h7v6H2ZM15 15h7v6h-7ZM9 6h9v6m-3-3 3 3 3-3M5 9v9h7',
  table: 'M3 3h18v18H3ZM3 9h18M9 3v18M3 15h18',
};

function CategoryIcon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={icons[name]} />
    </svg>
  );
}

function WritingDecoration() {
  return (
    <svg className="wc-heading-art" viewBox="0 0 280 130" fill="none" aria-hidden="true">
      <g stroke="#609ce0" opacity=".55">
        <path d="M4 18h270M4 41h270M4 64h270M4 87h270M4 110h270" />
      </g>
      <g stroke="#255f9f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m211 87 5-15 39-44a5 5 0 0 1 8 7l-39 44ZM216 72l8 7M250 34l8 7m5-6 5 4-15 17" />
        <path d="M164 89c12 0 14-9 24-5 7 3 11 6 18 3" />
      </g>
    </svg>
  );
}

export default function WritingCategories() {
  const [filter, setFilter] = useState('all');
  const visibleCategories = categories.filter(
    ([, group]) => filter === 'all' || group === filter
  );

  return (
    <main className="wc-page">
      <div className="wc-main">
        <section className="wc-heading" aria-labelledby="wc-title">
          <div className="wc-heading-copy">
            <span>BUILD YOUR WRITING CONFIDENCE</span>
            <h1 id="wc-title">Every good answer starts here.</h1>
            <p>
              Choose a question type. Take your time, organise your
              ideas and make each answer your own.
            </p>
            <div className="wc-heading-note">
              Original sample questions · More practice types coming soon
            </div>
          </div>
          <WritingDecoration />
        </section>

        <nav className="wc-filters" aria-label="Filter writing categories">
          {filters.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              className={filter === value ? 'is-selected' : ''}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="wc-grid">
          {visibleCategories.map(([id, group, title, description]) => (
            <Link
              className="wc-card"
              key={id}
              to={`/writing/practice?category=${id}`}
            >
              <span className="wc-icon">
                <CategoryIcon name={id} />
              </span>
              <div className="wc-card-copy">
                <span className="wc-subtitle">{subtitles[group]}</span>
                <h2>{title}</h2>
                <p>{description}</p>
                <span className="wc-card-status">Open practice →</span>
              </div>
            </Link>
          ))}
        </div>

        <footer className="wc-footer">
          Band Buddy · Small steps. Meaningful progress.
        </footer>
      </div>
    </main>
  );
}
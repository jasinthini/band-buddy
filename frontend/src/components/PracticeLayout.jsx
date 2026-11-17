import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import './PracticeLayout.css';

const links = [
  ['/dashboard', 'Dashboard', 'M3 10l9-7 9 7v11h-6v-7H9v7H3Z'],
  ['/writing', 'Writing', 'm4 16-1 5 5-1L21 7l-4-4ZM14 6l4 4'],
  ['/speaking', 'Speaking', 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0ZM5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8'],
  ['/reading', 'Reading', 'M12 6C8 3 5 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-6-1-10 2Zm0 0v15'],
  ['/listening', 'Listening', 'M3 14v-3a9 9 0 0 1 18 0v3M3 12h4v9H3ZM17 12h4v9h-4Z'],
  ['/practice/history', 'Practice history', 'M3 12a9 9 0 1 1 2 6m-2-6V6m0 6h6m3-5v5l4 2'],
  ['/mock-tests', 'Mock tests', 'M8 3h8l4 4v14H4V3h4ZM8 11h8M8 15h8M8 18h5'],
];

const dashboardBackPages = new Set([
  '/speaking',
  '/reading',
  '/listening',
]);

export default function PracticeLayout({ title, children }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const currentPath = pathname.replace(/\/+$/, '');
  const showDashboardBack = dashboardBackPages.has(currentPath);

  return (
    <div className="bb-practice-shell">
      <aside className="bb-practice-sidebar">
        <Link to="/dashboard" className="bb-practice-brand">
          <img src="/images/logo.png" alt="Band Buddy" />
        </Link>

        <nav
          id="bb-practice-nav"
          aria-label="Student navigation"
          className={`bb-practice-nav${open ? ' is-open' : ''}`}
        >
          {links.map(([path, label, icon]) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/dashboard' || path === '/practice/history'}
              onClick={() => setOpen(false)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={icon} />
              </svg>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="bb-practice-art" aria-hidden="true">
          <svg viewBox="0 0 180 115" fill="none">
            <path
              d="M90 38Q58 17 16 34v60q43-13 74 9 31-22 74-9V34q-42-17-74 4Z"
              fill="#f7fbff"
              stroke="#82b8ed"
              strokeWidth="3"
            />
            <path
              d="M90 39v63M29 48q25-7 47 5M29 61q25-7 47 5M29 74q25-7 47 5M103 62q24-13 46-8M103 75q24-13 46-8"
              stroke="#a3c4e4"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="m104 69 5-17 42-42 12 12-42 42Z"
              fill="#194f86"
              stroke="#bbdcfb"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="m104 69 5-17 12 12Z" fill="#f3c471" />
          </svg>
        </div>
      </aside>

      <div
        className={`bb-practice-workspace${showDashboardBack ? ' bb-practice-with-dashboard-back' : ''}`}
      >
        <header className="bb-practice-topbar">
          <button
            type="button"
            className="bb-practice-menu"
            aria-expanded={open}
            aria-controls="bb-practice-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? 'Close menu' : '☰ Menu'}
          </button>

          <span>Practice</span>
          <span aria-hidden="true">/</span>
          <strong>{title}</strong>

          {showDashboardBack && (
            <Link className="bb-practice-back" to="/dashboard">
              ← Back to dashboard
            </Link>
          )}
        </header>

        {children}
      </div>
    </div>
  );
}
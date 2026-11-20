import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  getWritingQuestions,
  getWritingAttempts,
  createWritingAttempt,
  updateWritingAttempt,
} from '../services/writing';
import './Writing.css';

const TOKEN_KEY = 'band_buddy_access_token';

const categories = {
  discussion: ['Task 2 · Discussion essay', 40, 250, 300],
  opinion: ['Task 2 · Opinion essay', 40, 250, 300],
  letters: ['General Training · Task 1 · Letter', 20, 150, 200],
  bar: ['Academic · Task 1 · Bar chart', 20, 150, 200],
  line: ['Academic · Task 1 · Line graph', 20, 150, 200],
  pie: ['Academic · Task 1 · Pie chart', 20, 150, 200],
  map: ['Academic · Task 1 · Maps', 20, 150, 200],
  process: ['Academic · Task 1 · Process diagram', 20, 150, 200],
  table: ['Academic · Task 1 · Table', 20, 150, 200],
};

function questionUrl(category, questionId, attemptId) {
  const params = new URLSearchParams({ category });

  if (questionId != null) {
    params.set('question', String(questionId));
  }

  if (attemptId != null) {
    params.set('attempt', String(attemptId));
  }

  return `/writing/practice?${params}`;
}

async function loadAllPages(fetchPage) {
  const items = [];
  let offset = 0;

  while (true) {
    const page = await fetchPage(offset);
    items.push(...page);

    if (page.length < 20) return items;

    offset += page.length;
  }
}

function countWords(value) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function formatClock(seconds) {
  return [
    Math.floor(seconds / 3600),
    Math.floor((seconds % 3600) / 60),
    seconds % 60,
  ]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function Footer() {
  return (
    <footer className="wp-footer">
      Band Buddy · Small steps. Meaningful progress.
    </footer>
  );
}

function Page({ children }) {
  return (
    <div className="writing-page">
      <style>{`
        .writing-page .wp-action-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 14px;
        }

        .writing-page .wp-action-row > button,
        .writing-page .wp-timer-dialog button {
          min-height: 44px;
          padding: 9px 14px;
          border-radius: 9px;
          font-weight: 700;
          cursor: pointer;
        }

        .writing-page .wp-word-guide {
          padding: 10px 14px;
          border-radius: 10px;
          background: #e1effc;
          color: #17476e;
          overflow-wrap: anywhere;
        }

        .writing-page #writing-answer[readonly] {
          background: #eff5fb;
        }

        .writing-page .wp-timer-dialog {
          box-sizing: border-box;
          width: min(420px, calc(100% - 32px));
          padding: 24px;
          border: 1px solid #bfd6eb;
          border-radius: 16px;
          color: #102f4a;
          background: #fff;
          box-shadow: 0 22px 64px #102f4a35;
        }

        .writing-page .wp-timer-dialog::backdrop {
          background: #102f4a70;
        }

        .writing-page .wp-timer-dialog h2 {
          margin-top: 0;
        }

        .writing-page .wp-feedback-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
          margin-block: 20px;
          min-width: 0;
        }

        .writing-page .wp-feedback-card {
          box-sizing: border-box;
          min-width: 0;
          padding: 24px;
          border: 1px solid #cbdceb;
          border-top: 3px solid #7ab5e9;
          border-radius: 16px;
          background: #fff;
          color: #173953;
          box-shadow: 0 6px 20px #102f4a10;
          overflow-wrap: anywhere;
          line-height: 1.65;
          animation: wp-feedback-enter 400ms ease-out both;
        }

        .writing-page .wp-feedback-card h2 {
          margin: 0 0 16px;
          color: #102f4a;
          font-size: 21px;
          line-height: 1.3;
        }

        .writing-page .wp-feedback-card ul,
        .writing-page .wp-feedback-card ol {
          margin: 0;
          padding-left: 22px;
        }

        .writing-page .wp-feedback-card li + li {
          margin-top: 16px;
        }

        .writing-page .wp-feedback-card li p {
          margin: 6px 0;
        }

        .writing-page .wp-feedback-empty {
          margin: 0;
          color: #526b80;
        }

        .writing-page .wp-feedback-answer {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .writing-page .wp-submitted-answer summary {
          min-height: 44px;
          cursor: pointer;
          font-weight: 700;
        }

        .writing-page .wp-feedback-navigation {
          flex-wrap: wrap;
          gap: 12px;
        }

        @keyframes wp-feedback-enter {
          from {
            opacity: 0;
            transform: translateY(10px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 767px) {
          .writing-page .wp-feedback-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 14px;
          }

          .writing-page .wp-feedback-card {
            padding: 18px;
          }

          .writing-page .wp-feedback-card h2 {
            font-size: 19px;
          }

          .writing-page .wp-feedback-navigation {
            align-items: flex-start;
          }

          .writing-page .wp-feedback-navigation a {
            display: inline-flex;
            align-items: center;
            min-height: 44px;
            max-width: 100%;
            white-space: normal;
            overflow-wrap: anywhere;
          }

          .writing-page .wp-action-row > button {
            flex: 1 1 140px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .writing-page .wp-feedback-card {
            animation: none;
          }
        }
      `}</style>

      <main className="wp-main">
        {children}
        <Footer />
      </main>
    </div>
  );
}

function QuestionCards({
  category,
  questions,
  attempts,
  invalid,
}) {
  const [label, minutes] = categories[category];

  return (
    <Page>
      <div className="wp-heading">
        <div>
          <p className="wp-eyebrow">
            IELTS WRITING PRACTICE
          </p>
          <h1>Choose a question.</h1>
          <p>
            {label} · {questions.length} questions
          </p>
        </div>
      </div>

      <section
        className="wp-toolbar"
        aria-label="Writing navigation"
      >
        <Link className="wp-text-button" to="/writing">
          ← Writing categories
        </Link>

        <Link
          className="wp-text-button"
          to="/writing/history"
        >
          My writing history →
        </Link>
      </section>

      {invalid && (
        <p className="wp-notice" role="status">
          That question is unavailable. Choose another question below.
        </p>
      )}

      <div className="wp-question-grid">
        {questions.map((question, index) => {
          const matching = attempts.filter(
            (attempt) =>
              String(attempt.question_id) === String(question.id),
          );

          const hasDraft = matching.some(
            (attempt) => attempt.status === 'draft',
          );

          const reviewed = matching.find(
            (attempt) =>
              attempt.status === 'submitted' &&
              attempt.feedback,
          );

          return (
            <article
              className="wp-question-card"
              key={question.id}
            >
              <span className="wp-card-tag">Writing</span>

              <p className="wp-card-label">
                {label} · Practice {index + 1}
              </p>

              <h2>{question.title}</h2>

              <div className="wp-card-meta">
                <span>Suggested: {minutes} min</span>
              </div>

              <Link
                className="wp-card-start"
                to={questionUrl(category, question.id)}
              >
                {hasDraft ? 'Continue draft' : 'Start practice'} →
              </Link>

              {reviewed && (
                <Link
                  className="wp-text-button"
                  to={questionUrl(
                    category,
                    question.id,
                    reviewed.id,
                  )}
                >
                  View latest feedback →
                </Link>
              )}
            </article>
          );
        })}
      </div>
    </Page>
  );
}

export default function Writing() {
  const [params] = useSearchParams();
  const category = params.get('category') || 'discussion';

  if (!Object.hasOwn(categories, category)) {
    return (
      <Page>
        <h1>Choose an available writing category.</h1>
        <Link to="/writing">← Writing categories</Link>
      </Page>
    );
  }

  return (
    <WritingWorkspace
      key={category}
      category={category}
      questionId={params.get('question')}
      reviewId={params.get('attempt')}
      draftId={params.get('draft')}
    />
  );
}

function WritingWorkspace({
  category,
  questionId,
  reviewId,
  draftId,
}) {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!sessionStorage.getItem(TOKEN_KEY)) {
      navigate('/login', { replace: true });
      return;
    }

    let active = true;

    setData(null);
    setError('');

    Promise.all([
      loadAllPages((offset) =>
        getWritingQuestions(category, offset),
      ),
      loadAllPages((offset) => getWritingAttempts(offset)),
    ])
      .then(([questions, attempts]) => {
        if (active) {
          setData({ questions, attempts });
        }
      })
      .catch((err) => {
        if (!active) return;

        if (err.response?.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          navigate('/login', { replace: true });
          return;
        }

        const detail = err.response?.data?.detail;

        setError(
          typeof detail === 'string'
            ? detail
            : 'Could not load your writing practice. Please try again.',
        );
      });

    return () => {
      active = false;
    };
  }, [category, navigate, retry]);

  if (!data) {
    return (
      <Page>
        <p role={error ? 'alert' : 'status'}>
          {error || 'Loading your questions and saved drafts…'}
        </p>

        {error && (
          <button
            className="wp-primary"
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        )}
      </Page>
    );
  }

  const { questions, attempts } = data;

  const index = questions.findIndex(
    (question) => String(question.id) === questionId,
  );

  const question = questions[index];
  const nextQuestion = questions[index + 1];

  if (reviewId != null) {
    const review = attempts.find(
      (attempt) =>
        String(attempt.id) === reviewId &&
        String(attempt.question_id) === questionId &&
        attempt.status === 'submitted',
    );

    return (
      <FeedbackScreen
        key={reviewId}
        category={category}
        question={question}
        attempt={review}
        nextQuestion={question ? nextQuestion : null}
      />
    );
  }

  if (!question) {
    return (
      <QuestionCards
        category={category}
        questions={questions}
        attempts={attempts}
        invalid={questionId != null}
      />
    );
  }

  const draft = attempts.find(
    (attempt) =>
      String(attempt.question_id) === String(question.id) &&
      attempt.status === 'draft' &&
      (draftId == null || String(attempt.id) === draftId),
  );

  function rememberAttempt(saved) {
    setData((current) => ({
      ...current,
      attempts: [
        saved,
        ...current.attempts.filter(
          (item) => item.id !== saved.id,
        ),
      ],
    }));
  }

  return (
    <WritingEditor
      key={`${question.id}:${draftId ?? 'practice'}`}
      category={category}
      question={question}
      number={index + 1}
      total={questions.length}
      draft={draft}
      nextQuestion={nextQuestion}
      onSaved={rememberAttempt}
    />
  );
}

function WritingEditor({
  category,
  question,
  number,
  total,
  draft,
  nextQuestion,
  onSaved,
}) {
  const navigate = useNavigate();
  const [label, minutes, target, limit] = categories[category];

  const [answer, setAnswer] = useState(draft?.answer || '');
  const [attemptId, setAttemptId] = useState(draft?.id ?? null);
  const [seconds, setSeconds] = useState(
    draft?.elapsed_seconds || 0,
  );
  const [running, setRunning] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(
    draft ? 'Your saved draft has been restored.' : '',
  );
  const [error, setError] = useState('');

  const timerDialog = useRef(null);
  const answerInput = useRef(null);
  const startedAt = useRef(null);
  const elapsedMs = useRef(
    (draft?.elapsed_seconds || 0) * 1000,
  );
  const saveLock = useRef(false);
  const dirty = useRef(false);
  const mounted = useRef(true);

  const wordCount = countWords(answer);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!running) return;

    const timer = window.setInterval(() => {
      if (startedAt.current === null) return;

      setSeconds(
        Math.floor(
          (
            elapsedMs.current +
            Date.now() -
            startedAt.current
          ) / 1000,
        ),
      );
    }, 250);

    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    function warn(event) {
      if (!dirty.current && !saveLock.current) return;

      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', warn);

    return () =>
      window.removeEventListener('beforeunload', warn);
  }, []);

  function openTimerDialog() {
    if (
      !saving &&
      timerDialog.current &&
      !timerDialog.current.open
    ) {
      timerDialog.current.showModal();
    }
  }

  function startTimer() {
    if (
      saveLock.current ||
      startedAt.current !== null
    ) {
      return;
    }

    startedAt.current = Date.now();
    setTimerStarted(true);
    setRunning(true);

    timerDialog.current?.close();
    answerInput.current?.focus();
  }

  function pauseTimer() {
    if (startedAt.current !== null) {
      elapsedMs.current += Date.now() - startedAt.current;
      startedAt.current = null;
    }

    const duration = Math.floor(elapsedMs.current / 1000);

    setSeconds(duration);
    setRunning(false);

    return duration;
  }

  function leavePage(event, destination) {
    event.preventDefault();

    if (saveLock.current) return;

    if (
      dirty.current &&
      !window.confirm('Leave without saving your changes?')
    ) {
      return;
    }

    navigate(destination);
  }

  async function persist(status) {
    if (saveLock.current) return false;

    if (status === 'submitted' && !timerStarted) {
      openTimerDialog();
      return false;
    }

    if (!answer.trim()) {
      setError('Write an answer first.');
      return false;
    }

    if (status === 'submitted' && wordCount > limit) {
      setError(
        `Shorten your answer to ${limit} words or fewer before submitting.`,
      );
      return false;
    }

    saveLock.current = true;
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        questionId: question.id,
        answer,
        elapsedSeconds: pauseTimer(),
        status,
      };

      const saved = attemptId
        ? await updateWritingAttempt(attemptId, payload)
        : await createWritingAttempt(payload);

      if (!mounted.current) return false;

      dirty.current = false;

      setAttemptId(saved.id);
      onSaved(saved);

      if (status === 'submitted') {
        navigate(
          questionUrl(category, question.id, saved.id),
          { replace: true },
        );
      } else {
        setMessage(
          'Draft saved. Resume the timer to keep writing.',
        );
      }

      return true;
    } catch (err) {
      if (!mounted.current) return false;

      const detail = err.response?.data?.detail;

      setError(
        typeof detail === 'string'
          ? detail
          : 'Could not save your answer. Your text is still here. Please try again.',
      );

      return false;
    } finally {
      saveLock.current = false;

      if (mounted.current) {
        setSaving(false);
      }
    }
  }

  async function handleNext() {
    if (!nextQuestion || saveLock.current) return;

    if (dirty.current) {
      if (answer.trim()) {
        if (!(await persist('draft'))) return;
      } else if (
        !window.confirm(
          'Move to the next question without saving this change?',
        )
      ) {
        return;
      }
    }

    navigate(questionUrl(category, nextQuestion.id));
  }

  const listUrl = questionUrl(category);

  return (
    <Page>
      <div className="wp-heading">
        <div>
          <p className="wp-eyebrow">
            ONE IDEA AT A TIME
          </p>
          <h1>Your writing workspace.</h1>
          <p>
            {label} · Suggested time: {minutes} min
          </p>
        </div>

        <span className="wp-mode">Practice mode</span>
      </div>

      <section
        className="wp-toolbar"
        aria-label="Practice controls"
      >
        <Link
          className="wp-text-button"
          to={listUrl}
          onClick={(event) => leavePage(event, listUrl)}
        >
          ← All questions
        </Link>

        <Link
          className="wp-text-button"
          to="/writing/history"
          onClick={(event) =>
            leavePage(event, '/writing/history')
          }
        >
          My writing history →
        </Link>

        <div className="wp-timer">
          <span aria-label="Elapsed practice time">
            {formatClock(seconds)}
          </span>

          <button
            type="button"
            disabled={saving}
            onClick={running ? pauseTimer : startTimer}
          >
            {running
              ? 'Pause timer'
              : timerStarted
                ? 'Resume timer'
                : 'Start timer'}
          </button>
        </div>
      </section>

      <p className="wp-word-guide" id="wp-word-guide">
        <strong>
          Target: {target}–{limit} words
        </strong>{' '}
        · App practice limit: {limit} words
      </p>

      <div className="wp-workspace">
        <aside className="wp-question-panel">
          <div className="wp-question-meta">
            <span>{label}</span>
            <small>
              Question {number} of {total}
            </small>
          </div>

          <p className="wp-eyebrow">YOUR QUESTION</p>
          <h2>{question.title}</h2>
          <p className="wp-prompt">{question.prompt}</p>

          {question.visual_url && (
            <figure style={{ margin: '16px 0' }}>
              <a
                href={question.visual_url}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={question.visual_url}
                  alt={`Question visual: ${question.title}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    borderRadius: 12,
                  }}
                />
              </a>

              <figcaption>
                Click the image to view it full size.
              </figcaption>
            </figure>
          )}

          {question.points?.length > 0 && (
            <ul className="wp-points">
              {question.points.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          )}

          <div className="wp-question-note">
            <strong>Before you begin</strong>
            <p>
              Plan your answer and leave time to review your
              ideas, grammar and vocabulary.
            </p>
          </div>

          <div className="wp-sample-note">
            Band Buddy practice question. Not an official IELTS paper.
          </div>
        </aside>

        <section
          className="wp-editor-panel"
          aria-labelledby="answer-heading"
        >
          <div className="wp-editor-heading">
            <div>
              <h2 id="answer-heading">Your answer</h2>

              <p id="wp-editor-status">
                {running
                  ? 'Timer running. Save your draft before leaving.'
                  : 'The editor is locked. Start or resume the timer to write.'}
              </p>
            </div>

            <span className="wp-word-count">
              {wordCount} / {limit} words
            </span>
          </div>

          <textarea
            id="writing-answer"
            ref={answerInput}
            value={answer}
            readOnly={!running}
            disabled={saving}
            maxLength={50000}
            aria-label="Write your answer"
            aria-describedby="wp-word-guide wp-editor-status"
            placeholder={
              running
                ? 'Start writing your answer here…'
                : 'Click here to start the timer…'
            }
            onClick={() => {
              if (!running) openTimerDialog();
            }}
            onKeyDown={(event) => {
              if (!running && event.key === 'Enter') {
                event.preventDefault();
                openTimerDialog();
              }
            }}
            onChange={(event) => {
              if (!running || saveLock.current) return;

              dirty.current = true;

              setAnswer(event.target.value);
              setError('');
              setMessage('');
            }}
            spellCheck
          />

          {wordCount > limit && (
            <p className="wp-notice" role="status">
              {wordCount - limit} words over the practice limit.
              You can save your draft.
            </p>
          )}

          <div className="wp-action-row">
            <button
              className="wp-secondary"
              type="button"
              disabled={saving || !answer.trim()}
              onClick={() => void persist('draft')}
            >
              Save draft
            </button>

            <button
              className="wp-primary"
              type="button"
              disabled={saving}
              onClick={() => void persist('submitted')}
            >
              {saving ? 'Saving…' : 'Submit answer'}
            </button>

            <button
              className="wp-secondary"
              type="button"
              disabled={saving || !nextQuestion}
              onClick={() => void handleNext()}
            >
              Next question →
            </button>
          </div>

          {error && (
            <p className="wp-notice" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="wp-notice" role="status">
              {message}
            </p>
          )}
        </section>
      </div>

      <dialog
        className="wp-timer-dialog"
        ref={timerDialog}
        aria-labelledby="wp-timer-title"
      >
        <h2 id="wp-timer-title">
          {timerStarted
            ? 'Resume the timer'
            : 'Start the timer first'}
        </h2>

        <p>
          Start or resume the timer to unlock your answer box.
        </p>

        <div className="wp-action-row">
          <button
            className="wp-secondary"
            type="button"
            onClick={() => timerDialog.current?.close()}
          >
            Cancel
          </button>

          <button
            className="wp-primary"
            type="button"
            onClick={startTimer}
          >
            {timerStarted ? 'Resume timer' : 'Start timer'}
          </button>
        </div>
      </dialog>
    </Page>
  );
}

function FeedbackList({ items, emptyMessage }) {
  const entries = Array.isArray(items)
    ? items.filter(
        (item) => typeof item === 'string' && item.trim(),
      )
    : [];

  if (!entries.length) {
    return (
      <p className="wp-feedback-empty">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul>
      {entries.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

function FeedbackScreen({
  category,
  question,
  attempt,
  nextQuestion,
}) {
  const feedback = attempt?.feedback;

  const grammarCorrections = Array.isArray(
    feedback?.grammar_corrections,
  )
    ? feedback.grammar_corrections
    : [];

  const vocabularySuggestions = Array.isArray(
    feedback?.vocabulary_suggestions,
  )
    ? feedback.vocabulary_suggestions
    : [];

  const band =
    feedback?.overall_band ?? feedback?.estimated_band;

  return (
    <Page>
      <div className="wp-heading">
        <div>
          <p className="wp-eyebrow">WRITING REVIEW</p>
          <h1>AI writing feedback</h1>
          <p>
            {question?.title || 'Review your submitted writing.'}
          </p>
        </div>
      </div>

      <section
        className="wp-toolbar wp-feedback-navigation"
        aria-label="Feedback navigation"
      >
        <Link
          className="wp-text-button"
          to={questionUrl(category)}
        >
          ← All questions
        </Link>

        <Link
          className="wp-text-button"
          to="/writing/history"
        >
          My writing history →
        </Link>

        {nextQuestion && (
          <Link
            className="wp-text-button"
            to={questionUrl(category, nextQuestion.id)}
          >
            Next question →
          </Link>
        )}
      </section>

      {!attempt ? (
        <p className="wp-notice" role="status">
          This submitted answer could not be found.
        </p>
      ) : (
        <>
          {band != null && (
            <p className="wp-word-guide">
              <strong>
                Overall estimated band: {band}
              </strong>
            </p>
          )}

          {feedback ? (
            <div className="wp-feedback-grid" lang="en">
              <article
                className="wp-feedback-card"
                aria-labelledby="wp-strengths-title"
              >
                <h2 id="wp-strengths-title">
                  Strengths
                </h2>

                <FeedbackList
                  items={feedback.strengths}
                  emptyMessage="No specific strengths were provided for this attempt."
                />
              </article>

              <article
                className="wp-feedback-card"
                aria-labelledby="wp-improvements-title"
                style={{ animationDelay: '70ms' }}
              >
                <h2 id="wp-improvements-title">
                  What to improve
                </h2>

                <FeedbackList
                  items={feedback.improvements}
                  emptyMessage="No improvement suggestions were provided for this attempt."
                />
              </article>

              <article
                className="wp-feedback-card"
                aria-labelledby="wp-grammar-title"
                style={{ animationDelay: '140ms' }}
              >
                <h2 id="wp-grammar-title">
                  Grammar corrections
                </h2>

                {grammarCorrections.length ? (
                  <ol>
                    {grammarCorrections.map((item, index) => (
                      <li key={index}>
                        <p>
                          <strong>Original:</strong>{' '}
                          {item.original}
                        </p>

                        <p>
                          <strong>Corrected:</strong>{' '}
                          {item.corrected}
                        </p>

                        {item.explanation && (
                          <p>{item.explanation}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="wp-feedback-empty">
                    No grammar corrections were provided for
                    this attempt.
                  </p>
                )}
              </article>

              <article
                className="wp-feedback-card"
                aria-labelledby="wp-vocabulary-title"
                style={{ animationDelay: '210ms' }}
              >
                <h2 id="wp-vocabulary-title">
                  Vocabulary suggestions
                </h2>

                {vocabularySuggestions.length ? (
                  <ol>
                    {vocabularySuggestions.map((item, index) => (
                      <li key={index}>
                        <p>
                          <strong>Original:</strong>{' '}
                          {item.original}
                        </p>

                        <p>
                          <strong>Suggested wording:</strong>{' '}
                          {item.suggestion}
                        </p>

                        {item.meaning && (
                          <p>
                            <strong>Meaning:</strong>{' '}
                            {item.meaning}
                          </p>
                        )}

                        {item.example_sentence && (
                          <p>
                            <strong>Example:</strong>{' '}
                            {item.example_sentence}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="wp-feedback-empty">
                    No vocabulary suggestions were provided
                    for this attempt.
                  </p>
                )}
              </article>
            </div>
          ) : (
            <p className="wp-notice" role="status">
              Your answer was submitted and saved. AI feedback
              is not available for this attempt.
            </p>
          )}

          <details className="wp-feedback-card wp-submitted-answer">
            <summary>
              Your submitted answer ·{' '}
              {attempt.word_count ??
                countWords(attempt.answer || '')}{' '}
              words
            </summary>

            <p className="wp-feedback-answer">
              {attempt.answer}
            </p>
          </details>
        </>
      )}
    </Page>
  );
}
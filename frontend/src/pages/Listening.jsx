import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { savePracticeAttempt } from '../services/practiceHistory';
import originalSets from '../data/listeningQuestions.json';
import extraSets from '../data/listeningExtraSets';
import './Listening.css';

const SETS = [...originalSets, ...extraSets];
const PAGE_SIZE = 6;

const PLAN_NAMES = {
  starter: 'Starter',
  plus: 'Plus',
  premium: 'Premium',
};

const SLIDES = [
  [
    'Listen carefully',
    'Follow the conversation from beginning to end.',
  ],
  [
    'Catch key details',
    'Listen for names, times, locations, and changes to plans.',
  ],
  [
    'Check your answers',
    'Review your score and read the transcript after submitting.',
  ],
];

function getRequiredPlan(index) {
  if (index === 0) return 'trial';
  if (index < 5) return 'starter';
  if (index < 15) return 'plus';

  return 'premium';
}

function getUnlockedSetCount(plan) {
  switch (plan) {
    case 'starter':
      return 5;
    case 'plus':
      return 15;
    case 'premium':
      return SETS.length;
    default:
      return 1;
  }
}

function normalise(value = '') {
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
}

function isCorrect(question, value = '') {
  const clean = normalise(value);

  if (!clean) return false;

  if (question.limit && clean.split(' ').length > question.limit) {
    return false;
  }

  return [
    question.answer,
    ...(question.acceptedAnswers ?? []),
  ].some((answer) => normalise(answer) === clean);
}

function formatTime(seconds) {
  return [
    Math.floor(seconds / 60),
    seconds % 60,
  ]
    .map((number) => String(number).padStart(2, '0'))
    .join(':');
}

function Headphones() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 14v-3a9 9 0 0 1 18 0v3" />
      <rect x="3" y="12" width="4" height="8" rx="2" />
      <rect x="17" y="12" width="4" height="8" rx="2" />
    </svg>
  );
}

function Waveform({ playing = false }) {
  const heights = [
    10, 16, 25, 19, 33, 45, 24,
    37, 48, 35, 20, 30, 17, 12,
  ];

  return (
    <div
      className={`ls-waveform${playing ? ' ls-playing' : ''}`}
      aria-hidden="true"
    >
      {heights.map((height, index) => (
        <i
          key={index}
          style={{
            '--height': `${height}px`,
            '--delay': `${index * -70}ms`,
          }}
        />
      ))}
    </div>
  );
}

function ListeningHero() {
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;

    const preference = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );

    function advance() {
      if (!preference.matches && !document.hidden) {
        setSlide((index) => (index + 1) % SLIDES.length);
      }
    }

    const interval = window.setInterval(advance, 6500);

    return () => window.clearInterval(interval);
  }, [paused]);

  return (
    <header className={`ls-hero${paused ? ' ls-paused' : ''}`}>
      <svg
        className="ls-background-wave"
        viewBox="0 0 1200 220"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 130C180 15 290 215 485 123S770 42 960 125s195 18 240-10v105H0Z" />
        <path d="M0 160c160-58 235 28 425 14s295-112 490-45 227 52 285 20v71H0Z" />
      </svg>

      <div>
        <p className="ls-kicker">
          BAND BUDDY · IELTS PRACTICE
        </p>
        <h1>Listening practice</h1>
        <p>
          Build confidence with conversations, announcements,
          and short briefings.
        </p>
      </div>

      <div className="ls-slide">
        <div className="ls-slide-copy" key={slide}>
          <p className="ls-kicker">
            LISTENING TIP {slide + 1} OF {SLIDES.length}
          </p>
          <h2>{SLIDES[slide][0]}</h2>
          <p>{SLIDES[slide][1]}</p>
        </div>

        <div
          className="ls-slide-controls"
          role="group"
          aria-label="Listening tips"
        >
          {SLIDES.map(([title], index) => (
            <button
              key={title}
              type="button"
              className="ls-dot"
              aria-label={`Show tip ${index + 1}: ${title}`}
              aria-pressed={slide === index}
              onClick={() => {
                setSlide(index);
                setPaused(true);
              }}
            >
              <span />
            </button>
          ))}

          <button
            type="button"
            className="ls-pause"
            onClick={() => setPaused(!paused)}
          >
            {paused ? 'Play slides' : 'Pause slides'}
          </button>
        </div>
      </div>
    </header>
  );
}

function ListeningExercise({ practice, onBack }) {
  const duration = (practice.minutes ?? 8) * 60;

  const [phase, setPhase] = useState('ready');
  const [remaining, setRemaining] = useState(duration);
  const [answers, setAnswers] = useState({});
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [result, setResult] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle');

  const started = useRef(null);
  const deadline = useRef(null);
  const playback = useRef(null);
  const saving = useRef(false);
  const timerDialog = useRef(null);

  const total = practice.questions.length;
  const answered = Object.values(answers).filter(
    (value) => normalise(value),
  ).length;

  useEffect(() => {
    return () => {
      if (playback.current) {
        playback.current = null;
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (phase !== 'running') return;

    function tick() {
      const left = Math.max(
        0,
        Math.ceil((deadline.current - Date.now()) / 1000),
      );

      setRemaining(left);

      if (!left) {
        if (playback.current) {
          playback.current = null;
          window.speechSynthesis?.cancel();
        }

        setPlaying(false);
        setPhase('expired');
      }
    }

    const id = window.setInterval(tick, 200);
    document.addEventListener('visibilitychange', tick);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [phase]);

  function showTimer() {
    if (timerDialog.current && !timerDialog.current.open) {
      timerDialog.current.showModal();
    }
  }

  function startTimer() {
    if (started.current !== null) return;

    timerDialog.current?.close();

    started.current = Date.now();
    deadline.current = started.current + duration * 1000;

    setPhase('running');
  }

  function stopAudio() {
    if (playback.current) {
      playback.current = null;
      window.speechSynthesis?.cancel();
    }

    setPlaying(false);
  }

  function playAudio() {
    if (phase === 'ready') {
      showTimer();
      return;
    }

    if (
      !result &&
      (phase !== 'running' || Date.now() >= deadline.current)
    ) {
      return;
    }

    if (playback.current) return;

    const synth = window.speechSynthesis;

    if (
      !synth ||
      typeof window.SpeechSynthesisUtterance !== 'function'
    ) {
      setAudioError(
        'Audio playback is unavailable in this browser. Try a browser with an English system voice.',
      );
      return;
    }

    setAudioError('');

    const session = { utterance: null };
    playback.current = session;
    setPlaying(true);

    const englishVoices = synth
      .getVoices()
      .filter((voice) => /^en(?:-|_)/i.test(voice.lang));

    const voices = [
      ...englishVoices.filter(
        (voice) => /^en[-_]GB$/i.test(voice.lang),
      ),
      ...englishVoices.filter(
        (voice) => !/^en[-_]GB$/i.test(voice.lang),
      ),
    ];

    const speakers = [
      ...new Set(practice.dialogue.map(([speaker]) => speaker)),
    ];

    function next(index) {
      if (playback.current !== session) return;

      if (
        index >= practice.dialogue.length ||
        (!result && Date.now() >= deadline.current)
      ) {
        playback.current = null;
        setPlaying(false);
        return;
      }

      const [speaker, line] = practice.dialogue[index];
      const speakerIndex = speakers.indexOf(speaker);

      const utterance = new window.SpeechSynthesisUtterance(line);
      const voice = voices[
        speakerIndex % Math.max(voices.length, 1)
      ];

      utterance.lang = voice?.lang ?? 'en-GB';

      if (voice) {
        utterance.voice = voice;
      }

      utterance.rate = 0.92;
      utterance.pitch = speakerIndex % 2 ? 0.92 : 1.05;

      session.utterance = utterance;

      utterance.onend = () => next(index + 1);

      utterance.onerror = () => {
        if (playback.current !== session) return;

        playback.current = null;
        setPlaying(false);

        setAudioError(
          'Could not play the audio. Check your browser’s speech settings and try again.',
        );
      };

      synth.speak(utterance);
    }

    next(0);
  }

  function update(index, value) {
    if (
      phase !== 'running' ||
      Date.now() >= deadline.current
    ) {
      return;
    }

    setAnswers((previous) => ({
      ...previous,
      [index]: value,
    }));
  }

  async function save(attempt) {
    if (saving.current) return;

    saving.current = true;
    setSaveStatus('saving');

    try {
      await savePracticeAttempt(attempt);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    } finally {
      saving.current = false;
    }
  }

  function submit(event) {
    event.preventDefault();

    if (phase === 'ready') {
      showTimer();
      return;
    }

    if (result || saving.current) return;

    if (
      answered < total &&
      phase !== 'expired' &&
      !window.confirm(
        'Some answers are blank. Check your answers anyway?',
      )
    ) {
      return;
    }

    stopAudio();

    const attempt = {
      skill: 'listening',
      title: practice.title,
      elapsed_seconds: Math.floor(
        (
          Math.min(Date.now(), deadline.current) -
          started.current
        ) / 1000,
      ),
      score: practice.questions.filter((question, index) =>
        isCorrect(question, answers[index]),
      ).length,
      total_questions: total,
    };

    setResult(attempt);
    setPhase('finished');

    void save(attempt);
  }

  function back() {
    if (
      phase !== 'ready' &&
      saveStatus !== 'saved' &&
      !window.confirm(
        'Leave this practice? Unsaved progress will be lost.',
      )
    ) {
      return;
    }

    stopAudio();
    onBack();
  }

  return (
    <>
      <button
        type="button"
        className="ls-secondary"
        onClick={back}
      >
        ← All listening practices
      </button>

      <div className="ls-exercise-title">
        <p className="ls-kicker">LISTENING SESSION</p>
        <h1>{practice.title}</h1>
        <p>{practice.intro}</p>
      </div>

      <div className="ls-toolbar">
        <span>
          Time left:{' '}
          <strong role="timer">
            {formatTime(remaining)}
          </strong>
        </span>

        <span>
          {answered}/{total} answered
        </span>

        {phase === 'ready' && (
          <button type="button" onClick={startTimer}>
            Start timer
          </button>
        )}

        {phase === 'expired' && (
          <span role="status">
            Time is up. You can check your answers.
          </span>
        )}
      </div>

      {result && (
        <div className="ls-toolbar ls-result">
          <strong>
            Score: {result.score}/{total}
          </strong>

          {saveStatus === 'saving' && (
            <span role="status">Saving…</span>
          )}

          {saveStatus === 'saved' && (
            <span role="status">
              Saved to Practice history.
            </span>
          )}

          {saveStatus === 'error' && (
            <>
              <span role="alert">
                Could not save to Practice history.
              </span>

              <button
                type="button"
                onClick={() => save(result)}
              >
                Retry save
              </button>
            </>
          )}
        </div>
      )}

      <div className="ls-workspace">
        <section
          className="ls-panel ls-player"
          aria-labelledby="ls-player-title"
        >
          <div className="ls-icon">
            <Headphones />
          </div>

          <h2 id="ls-player-title">Audio player</h2>

          <Waveform playing={playing} />

          <p>
            {phase === 'ready'
              ? 'Start the timer to unlock audio and answers.'
              : phase === 'expired'
                ? 'Check your answers to unlock replay.'
                : playing
                  ? 'Playing audio…'
                  : 'You can replay the audio during practice.'}
          </p>

          {playing ? (
            <button type="button" onClick={stopAudio}>
              Stop audio
            </button>
          ) : (
            <button
              type="button"
              disabled={phase === 'expired'}
              onClick={playAudio}
            >
              {phase === 'ready'
                ? 'Unlock audio'
                : result
                  ? 'Replay audio'
                  : '▶ Play audio'}
            </button>
          )}

          {audioError && (
            <p role="alert" className="ls-error">
              {audioError}
            </p>
          )}

          {result && (
            <details className="ls-transcript">
              <summary>Read transcript</summary>

              {practice.dialogue.map(
                ([speaker, line], index) => (
                  <p key={index}>
                    <strong>{speaker}:</strong> {line}
                  </p>
                ),
              )}
            </details>
          )}
        </section>

        <form
          className="ls-panel"
          onSubmit={submit}
          aria-labelledby="ls-question-title"
        >
          <h2 id="ls-question-title">
            Practice questions
          </h2>

          {phase === 'ready' && (
            <p className="ls-muted">
              Answer fields unlock after you start the timer.
            </p>
          )}

          {practice.questions.map((question, index) => {
            const id = `ls-q-${index}`;
            const value = answers[index] ?? '';
            const correct = Boolean(
              result && isCorrect(question, value),
            );

            return (
              <section className="ls-question" key={id}>
                <p className="ls-muted">
                  {index + 1} of {total} ·{' '}
                  {question.type ?? 'Multiple choice'}
                </p>

                <h3 id={`${id}-title`}>
                  {question.prompt}
                </h3>

                {question.options ? (
                  <fieldset
                    disabled={phase !== 'running'}
                    aria-labelledby={`${id}-title`}
                  >
                    {question.options.map((option) => (
                      <label
                        key={option}
                        className="ls-option"
                      >
                        <input
                          type="radio"
                          name={id}
                          checked={value === option}
                          onChange={() =>
                            update(index, option)
                          }
                        />
                        {option}
                      </label>
                    ))}
                  </fieldset>
                ) : (
                  <>
                    <label
                      htmlFor={id}
                      className="ls-muted"
                    >
                      {question.limit
                        ? `Answer · up to ${question.limit} words`
                        : 'Fill in the blank'}
                    </label>

                    <input
                      id={id}
                      className="ls-text-input"
                      type="text"
                      value={value}
                      disabled={phase !== 'running'}
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={100}
                      aria-labelledby={`${id}-title`}
                      onChange={(event) =>
                        update(index, event.target.value)
                      }
                    />
                  </>
                )}

                {result && (
                  <div
                    className={`ls-feedback${
                      correct ? ' ls-correct' : ''
                    }`}
                  >
                    <strong>
                      {correct
                        ? 'Correct'
                        : value.trim()
                          ? 'Incorrect'
                          : 'Unanswered'}
                    </strong>

                    <p>
                      Your answer: {value.trim() || '—'}
                    </p>

                    {!correct && (
                      <p>
                        Correct answer:{' '}
                        <strong>{question.answer}</strong>
                      </p>
                    )}

                    {question.explanation && (
                      <p>{question.explanation}</p>
                    )}
                  </div>
                )}
              </section>
            );
          })}

          {!result && (
            <button
              type="submit"
              className="ls-submit"
            >
              Check answers →
            </button>
          )}
        </form>
      </div>

      <dialog
        ref={timerDialog}
        className="ls-dialog"
        aria-labelledby="ls-dialog-title"
      >
        <h2 id="ls-dialog-title">
          Start the timer first
        </h2>

        <p>
          You have {duration / 60} minutes to listen and answer.
        </p>

        <div className="ls-dialog-actions">
          <button type="button" onClick={startTimer}>
            Start timer
          </button>

          <button
            type="button"
            className="ls-secondary"
            onClick={() => timerDialog.current?.close()}
          >
            Not yet
          </button>
        </div>
      </dialog>
    </>
  );
}

export default function Listening() {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState('');
  const [planRetry, setPlanRetry] = useState(0);

  const heading = useRef(null);

  const unlockedSetCount = getUnlockedSetCount(activePlan);
  const pageCount = Math.ceil(SETS.length / PAGE_SIZE);
  const startIndex = page * PAGE_SIZE;
  const visibleSets = SETS.slice(
    startIndex,
    startIndex + PAGE_SIZE,
  );

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadPlan() {
      setPlanLoading(true);
      setPlanError('');
      setActivePlan(null);

      try {
        const { data } = await api.get(
          '/billing/my-plan',
          { signal },
        );

        if (signal.aborted) return;

        setActivePlan(
          data.status === 'active' ? data.plan_id : null,
        );
      } catch (error) {
        if (signal.aborted) return;

        if (error.response?.status === 401) {
          sessionStorage.removeItem(
            'band_buddy_access_token',
          );
          window.location.assign('/login');
          return;
        }

        setPlanError(
          'Could not check your plan. Please try again.',
        );
      } finally {
        if (!signal.aborted) {
          setPlanLoading(false);
        }
      }
    }

    void loadPlan();

    return () => controller.abort();
  }, [planRetry]);

  function goToPage(index) {
    setPage(index);
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: 'start' });
  }

  return (
    <div className="ls-page">
      {selected ? (
        <ListeningExercise
          key={selected.id}
          practice={selected}
          onBack={() => setSelected(null)}
        />
      ) : (
        <>
          <ListeningHero />

          <div className="ls-list-header">
            <h2 ref={heading} tabIndex={-1}>
              Choose an audio practice
            </h2>

            <p role="status">
              {SETS.length} practice sets · Page{' '}
              {page + 1} of {pageCount}
            </p>
          </div>

          {planLoading && (
            <p role="status">
              Checking your plan access…
            </p>
          )}

          {planError && (
            <div role="alert">
              <p>{planError}</p>

              <button
                type="button"
                className="ls-secondary"
                onClick={() => {
                  setPlanLoading(true);
                  setPlanError('');
                  setPlanRetry((value) => value + 1);
                }}
              >
                Try again
              </button>
            </div>
          )}

          <div className="ls-grid">
            {visibleSets.map((practice, index) => {
              const setIndex = startIndex + index;
              const number = String(
                setIndex + 1,
              ).padStart(2, '0');

              const requiredPlan = getRequiredPlan(setIndex);
              const canAccess = setIndex < unlockedSetCount;

              const planName = requiredPlan === 'trial'
                ? 'Free Trial'
                : PLAN_NAMES[requiredPlan];

              const mixed = practice.questions.some(
                (question) => !question.options,
              );

              return (
                <article
                  className="ls-card"
                  key={practice.id}
                >
                  <div className="ls-card-top">
                    <div className="ls-icon">
                      <Headphones />
                    </div>

                    <span>
                      Practice {number} · {planName}
                    </span>
                  </div>

                  <Waveform />

                  <h3>{practice.title}</h3>

                  <p>
                    {practice.questions.length} questions ·{' '}
                    {practice.minutes ?? 8} min
                  </p>

                  <p>
                    {mixed
                      ? 'Multiple choice · Form completion · Short answer'
                      : 'Multiple choice'}
                  </p>

                  <button
                    type="button"
                    disabled={
                      planLoading || Boolean(planError)
                    }
                    aria-label={
                      canAccess
                        ? `Start listening: ${practice.title}`
                        : `View ${planName} plan for ${practice.title}`
                    }
                    onClick={() => {
                      if (!canAccess) {
                        window.location.assign(
                          `/plans#bb-plan-title-${requiredPlan}`,
                        );
                        return;
                      }

                      setSelected(practice);
                      window.scrollTo(0, 0);
                    }}
                  >
                    {canAccess
                      ? 'Start listening →'
                      : `${planName} plan required →`}
                  </button>
                </article>
              );
            })}
          </div>

          <nav
            className="ls-pagination"
            aria-label="Listening practice pages"
          >
            <button
              type="button"
              className="ls-secondary"
              disabled={page === 0}
              onClick={() => goToPage(page - 1)}
            >
              ← Previous
            </button>

            <span>
              {page + 1} / {pageCount}
            </span>

            <button
              type="button"
              className="ls-secondary"
              disabled={page + 1 === pageCount}
              onClick={() => goToPage(page + 1)}
            >
              Next →
            </button>
          </nav>
        </>
      )}
    </div>
  );
}
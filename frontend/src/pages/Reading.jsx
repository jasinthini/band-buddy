import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { savePracticeAttempt } from '../services/practiceHistory';
import { LEVELS, SETS, TYPES } from '../data/readingSets';
import './Reading.css';

const PAGE_SIZE = 6;

const PLAN_NAMES = {
  trial: 'Free Trial',
  starter: 'Starter',
  plus: 'Plus',
  premium: 'Premium',
};

const PLAN_RANK = {
  trial: 0,
  starter: 1,
  plus: 2,
  premium: 3,
};

function canAccessSet(requiredPlan, activePlan) {
  const requiredRank = PLAN_RANK[requiredPlan];
  const currentRank = PLAN_RANK[activePlan] ?? PLAN_RANK.trial;

  return requiredRank !== undefined && currentRank >= requiredRank;
}

function normalise(value = '') {
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.,!?;:]+$/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function withinLimit(question, value) {
  if (question.options) return true;

  return (
    (normalise(value).match(/\S+/g)?.length ?? 0) <=
    (question.limit ?? 1)
  );
}

function correct(question, value) {
  return (
    withinLimit(question, value) &&
    [question.answer, ...(question.acceptedAnswers ?? [])].some(
      (answer) => normalise(answer) === normalise(value),
    )
  );
}

function clock(seconds) {
  return [Math.floor(seconds / 60), seconds % 60]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

function tokens(text) {
  return text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) ?? [];
}

function missedWords(sentence, transcript) {
  const expected = tokens(sentence);
  const heard = tokens(transcript).map(normalise);

  const grid = Array.from(
    { length: expected.length + 1 },
    () => new Uint16Array(heard.length + 1),
  );

  for (let i = expected.length - 1; i >= 0; i -= 1) {
    for (let j = heard.length - 1; j >= 0; j -= 1) {
      grid[i][j] =
        normalise(expected[i]) === heard[j]
          ? grid[i + 1][j + 1] + 1
          : Math.max(grid[i + 1][j], grid[i][j + 1]);
    }
  }

  const missing = [];
  let i = 0;
  let j = 0;

  while (i < expected.length) {
    if (j < heard.length && normalise(expected[i]) === heard[j]) {
      i += 1;
      j += 1;
    } else if (
      j < heard.length &&
      grid[i][j + 1] >= grid[i + 1][j]
    ) {
      j += 1;
    } else {
      missing.push(expected[i]);
      i += 1;
    }
  }

  return [
    ...new Map(
      missing.map((word) => [normalise(word), word]),
    ).values(),
  ].slice(0, 3);
}

function QuickRead({ passage }) {
  const sentences = passage.paragraphs
    .flatMap(
      (paragraph) =>
        paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [paragraph],
    )
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const prompts = [...new Set(sentences)].slice(0, 3);

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState('idle');
  const [clip, setClip] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(20);

  const session = useRef(null);
  const audioUrl = useRef('');
  const pending = useRef(null);
  const mounted = useRef(false);
  const text = prompts[index] ?? '';

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      pending.current?.abort();

      const current = session.current;
      session.current = null;

      if (current) {
        clearInterval(current.tick);

        if (current.recorder?.state === 'recording') {
          current.recorder.stop();
        }

        current.stream?.getTracks().forEach((track) => track.stop());
      }

      if (audioUrl.current) {
        URL.revokeObjectURL(audioUrl.current);
      }

      window.speechSynthesis?.cancel();
    };
  }, []);

  function listen(value, rate = 0.85) {
    const player = window.speechSynthesis;

    if (!player || typeof SpeechSynthesisUtterance === 'undefined') {
      setError('Sample audio is unavailable in this browser.');
      return;
    }

    player.cancel();
    setError('');

    const lines = Array.isArray(value) ? value : [value];

    for (const line of lines) {
      if (!line?.trim()) continue;

      const speech = new SpeechSynthesisUtterance(line.trim());
      speech.lang = 'en-GB';
      speech.rate = rate;

      player.speak(speech);
    }
  }

  function clearClip() {
    if (audioUrl.current) {
      URL.revokeObjectURL(audioUrl.current);
    }

    audioUrl.current = '';
    setClip(null);
    setTranscript('');
    setError('');
    setRemaining(20);
  }

  function goToSentence(nextIndex) {
    window.speechSynthesis?.cancel();
    clearClip();
    setIndex(nextIndex);
  }

  async function record() {
    if (session.current || pending.current) return;

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setError(
        'Microphone recording needs a supported browser on localhost or HTTPS.',
      );
      return;
    }

    window.speechSynthesis?.cancel();
    clearClip();

    const current = {};
    session.current = current;
    setPhase('requesting');

    function release() {
      clearInterval(current.tick);
      current.stream?.getTracks().forEach((track) => track.stop());

      if (session.current === current) {
        session.current = null;
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      current.stream = stream;

      if (session.current !== current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const type = [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/ogg',
      ].find((format) => MediaRecorder.isTypeSupported(format));

      const recorder = type
        ? new MediaRecorder(stream, { mimeType: type })
        : new MediaRecorder(stream);

      current.recorder = recorder;
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        const active = session.current === current;
        release();

        if (active && mounted.current) {
          setError('Recording failed. Please try again.');
          setPhase('idle');
        }
      };

      recorder.onstop = () => {
        const active = session.current === current;
        release();

        if (!active || !mounted.current) return;

        const mime =
          recorder.mimeType || chunks[0]?.type || 'audio/webm';

        const blob = new Blob(chunks, { type: mime });

        if (!blob.size) {
          setError('No audio was recorded. Please try again.');
        } else {
          const url = URL.createObjectURL(blob);
          audioUrl.current = url;

          const extension = mime.includes('mp4')
            ? 'm4a'
            : mime.includes('ogg')
              ? 'ogg'
              : 'webm';

          setClip({ blob, url, extension });
        }

        setPhase('idle');
      };

      recorder.start();
      setPhase('recording');

      const deadline = Date.now() + 20000;

      current.tick = setInterval(() => {
        const left = Math.max(
          0,
          Math.ceil((deadline - Date.now()) / 1000),
        );

        setRemaining(left);

        if (!left && recorder.state === 'recording') {
          recorder.stop();
        }
      }, 200);
    } catch {
      const active = session.current === current;
      release();

      if (active && mounted.current) {
        setPhase('idle');
        setError(
          'Could not start recording. Check your microphone permission and try again.',
        );
      }
    }
  }

  async function check() {
    if (!clip || pending.current) return;

    window.speechSynthesis?.cancel();

    const controller = new AbortController();
    pending.current = controller;

    setPhase('checking');
    setError('');

    const form = new FormData();

    form.append(
      'audio',
      clip.blob,
      `quick-read.${clip.extension}`,
    );

    try {
      const { data } = await api.post(
        '/speaking/transcribe',
        form,
        { signal: controller.signal },
      );

      const value =
        typeof data?.transcript === 'string'
          ? data.transcript.trim()
          : '';

      if (!value) {
        setError('No speech was detected. Try recording again.');
      } else {
        setTranscript(value);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        const detail = err.response?.data?.detail;

        setError(
          typeof detail === 'string'
            ? detail
            : 'Could not check your recording. Try again.',
        );
      }
    } finally {
      if (pending.current === controller) {
        pending.current = null;
      }

      if (mounted.current && !controller.signal.aborted) {
        setPhase('idle');
      }
    }
  }

  const busy = phase !== 'idle';
  const missing = transcript ? missedWords(text, transcript) : [];

  return (
    <section className="bb-reading-panel bb-reading-quick">
      <p className="bb-reading-kicker">
        QUICK READ · {index + 1} OF {prompts.length}
      </p>

      <h2>Read one sentence aloud</h2>

      <p className="bb-reading-help">
        Listen to the full passage or the sentence below. Then read the
        sentence into your microphone.
      </p>

      <blockquote>{text}</blockquote>

      <div className="bb-reading-actions">
        <button
          type="button"
          disabled={busy || !sentences.length}
          onClick={() => listen(sentences)}
        >
          Play full passage
        </button>

        <button
          type="button"
          className="bb-reading-secondary"
          disabled={busy || !text}
          onClick={() => listen(text)}
        >
          Play this sentence
        </button>

        <button
          type="button"
          className="bb-reading-secondary"
          disabled={busy}
          onClick={() => window.speechSynthesis?.cancel()}
        >
          Stop audio
        </button>

        {phase === 'recording' ? (
          <button
            type="button"
            onClick={() => session.current?.recorder?.stop()}
          >
            Stop recording · {clock(remaining)}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || !text}
            onClick={record}
          >
            {phase === 'requesting'
              ? 'Opening microphone…'
              : clip
                ? 'Record again'
                : 'Start timer & record'}
          </button>
        )}
      </div>

      {clip && (
        <audio
          controls
          src={clip.url}
          className="bb-reading-audio"
        />
      )}

      {clip && (
        <button type="button" disabled={busy} onClick={check}>
          {phase === 'checking' ? 'Checking…' : 'Check recording'}
        </button>
      )}

      {error && (
        <p role="alert" className="bb-reading-error">
          {error}
        </p>
      )}

      {transcript && (
        <div className="bb-reading-review" role="status">
          <h3>What the transcript picked up</h3>
          <p>{transcript}</p>

          <h3>
            {missing.length
              ? 'Words to try again'
              : 'All sentence words were detected in order'}
          </h3>

          {missing.length > 0 && (
            <div className="bb-reading-actions">
              {missing.map((word) => (
                <button
                  key={word}
                  type="button"
                  className="bb-reading-secondary"
                  disabled={busy}
                  onClick={() => listen(word, 0.75)}
                >
                  Listen: {word}
                </button>
              ))}
            </div>
          )}

          <p className="bb-reading-help">
            Speech recognition can miss a word even when you say it
            correctly.
          </p>
        </div>
      )}

      <div className="bb-reading-actions">
        <button
          type="button"
          className="bb-reading-secondary"
          disabled={busy || index === 0}
          onClick={() => goToSentence(index - 1)}
        >
          ← Previous
        </button>

        <button
          type="button"
          className="bb-reading-secondary"
          disabled={busy || index + 1 >= prompts.length}
          onClick={() => goToSentence(index + 1)}
        >
          Next sentence →
        </button>
      </div>
    </section>
  );
}

function Quiz({ passage, active, onRunning, onWork }) {
  const [answers, setAnswers] = useState({});
  const [phase, setPhase] = useState('ready');
  const [remaining, setRemaining] = useState(passage.minutes * 60);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState('');
  const [fontSize, setFontSize] = useState(18);

  const started = useRef(null);
  const deadline = useRef(null);
  const dialog = useRef(null);
  const saveLock = useRef(false);

  const total = passage.questions.length;
  const answered = Object.values(answers).filter(
    (value) => normalise(value),
  ).length;

  useEffect(() => {
    onWork(phase !== 'ready' && !saved);
  }, [phase, saved, onWork]);

  useEffect(() => {
    if (phase !== 'running') return;

    function tick() {
      const left = Math.max(
        0,
        Math.ceil((deadline.current - Date.now()) / 1000),
      );

      setRemaining(left);

      if (!left) {
        setPhase('expired');
        onRunning(false);
      }
    }

    const interval = setInterval(tick, 200);
    document.addEventListener('visibilitychange', tick);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [phase, onRunning]);

  function start() {
    if (started.current !== null) return;

    dialog.current?.close();

    started.current = Date.now();
    deadline.current = started.current + passage.minutes * 60000;

    setPhase('running');
    onRunning(true);
  }

  function showTimerDialog() {
    if (dialog.current && !dialog.current.open) {
      dialog.current.showModal();
    }
  }

  function change(index, value) {
    if (
      phase === 'running' &&
      Date.now() < deadline.current
    ) {
      setAnswers((previous) => ({
        ...previous,
        [index]: value,
      }));
    }
  }

  async function save(attempt) {
    if (saveLock.current) return;

    saveLock.current = true;
    setSaving(true);
    setNotice('');

    try {
      await savePracticeAttempt(attempt);
      setSaved(true);
    } catch {
      setNotice(
        'Could not save to Practice history. You can retry.',
      );
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  function submit(event) {
    event.preventDefault();

    if (phase === 'ready') {
      showTimerDialog();
      return;
    }

    if (result) return;

    if (
      answered < total &&
      !window.confirm(
        'Some questions are unanswered. Check answers anyway?',
      )
    ) {
      return;
    }

    const attempt = {
      skill: 'reading',
      title: passage.title,
      elapsed_seconds: Math.floor(
        (Math.min(Date.now(), deadline.current) - started.current) /
          1000,
      ),
      score: passage.questions.filter(
        (question, index) =>
          correct(question, answers[index] ?? ''),
      ).length,
      total_questions: total,
    };

    setPhase('finished');
    onRunning(false);
    setResult(attempt);

    void save(attempt);
  }

  return (
    <div hidden={!active}>
      <div className="bb-reading-timer">
        <strong role="timer">{clock(remaining)}</strong>
        <span>{answered}/{total} answered</span>

        {phase === 'ready' && (
          <button type="button" onClick={start}>
            Start timer
          </button>
        )}

        {phase === 'expired' && (
          <strong>
            Time is up. You can check your answers.
          </strong>
        )}
      </div>

      {result && (
        <div className="bb-reading-result">
          <strong>
            Score: {result.score}/{total}
          </strong>

          {saving && <span role="status">Saving…</span>}

          {saved && (
            <span role="status">
              Saved to Practice history.
            </span>
          )}

          {notice && <span role="alert">{notice}</span>}

          {notice && (
            <button
              type="button"
              onClick={() => save(result)}
            >
              Retry save
            </button>
          )}
        </div>
      )}

      <div className="bb-reading-workspace">
        <section className="bb-reading-panel">
          <div className="bb-reading-panel-head">
            <h2>{passage.title}</h2>

            <div className="bb-reading-actions">
              <button
                type="button"
                className="bb-reading-secondary"
                aria-label="Make text smaller"
                onClick={() =>
                  setFontSize((size) => Math.max(14, size - 2))
                }
              >
                A−
              </button>

              <button
                type="button"
                className="bb-reading-secondary"
                aria-label="Make text larger"
                onClick={() =>
                  setFontSize((size) => Math.min(26, size + 2))
                }
              >
                A+
              </button>
            </div>
          </div>

          <div
            className="bb-reading-scroll bb-reading-passage"
            style={{ fontSize }}
          >
            {passage.paragraphs.map((paragraph, index) => (
              <p key={index}>
                <strong>
                  {String.fromCharCode(65 + index)}
                </strong>{' '}
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        <form className="bb-reading-panel" onSubmit={submit}>
          <h2>Practice questions</h2>

          {phase === 'ready' && (
            <button
              type="button"
              className="bb-reading-secondary"
              onClick={showTimerDialog}
            >
              Unlock answer fields
            </button>
          )}

          <div className="bb-reading-scroll">
            {passage.questions.map((question, index) => {
              const value = answers[index] ?? '';
              const isCorrect = Boolean(
                result && correct(question, value),
              );
              const locked = phase !== 'running';

              return (
                <section
                  key={index}
                  className="bb-reading-question"
                >
                  <p className="bb-reading-help">
                    {index + 1} of {total} · {question.type}
                  </p>

                  <h3 id={`reading-question-${index}`}>
                    {question.prompt}
                  </h3>

                  {question.options ? (
                    question.type === TYPES[4] ? (
                      <select
                        aria-labelledby={`reading-question-${index}`}
                        value={value}
                        disabled={locked}
                        onChange={(event) =>
                          change(index, event.target.value)
                        }
                      >
                        <option value="">Choose a heading</option>

                        {question.options.map((option) => (
                          <option key={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <fieldset
                        aria-labelledby={`reading-question-${index}`}
                        disabled={locked}
                      >
                        {question.options.map((option) => (
                          <label
                            key={option}
                            className="bb-reading-option"
                          >
                            <input
                              type="radio"
                              name={`reading-answer-${index}`}
                              checked={value === option}
                              onChange={() =>
                                change(index, option)
                              }
                            />
                            {option}
                          </label>
                        ))}
                      </fieldset>
                    )
                  ) : (
                    <>
                      <label
                        htmlFor={`reading-answer-${index}`}
                      >
                        Answer · maximum {question.limit ?? 1}{' '}
                        {(question.limit ?? 1) === 1
                          ? 'word'
                          : 'words'}
                      </label>

                      <input
                        id={`reading-answer-${index}`}
                        type="text"
                        value={value}
                        disabled={locked}
                        maxLength={100}
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(event) =>
                          change(index, event.target.value)
                        }
                      />

                      {!withinLimit(question, value) && (
                        <p className="bb-reading-error">
                          Your answer exceeds the word limit.
                        </p>
                      )}
                    </>
                  )}

                  {result && (
                    <div
                      className={`bb-reading-answer${
                        isCorrect ? ' is-correct' : ''
                      }`}
                    >
                      <strong>
                        {isCorrect
                          ? 'Correct'
                          : value.trim()
                            ? 'Incorrect'
                            : 'Unanswered'}
                      </strong>

                      <p>
                        Your answer: {value.trim() || '—'}
                      </p>

                      {!isCorrect && (
                        <p>
                          Correct answer:{' '}
                          <strong>{question.answer}</strong>
                        </p>
                      )}

                      <p>{question.explanation}</p>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {!result && (
            <button
              className="bb-reading-submit"
              type="submit"
            >
              Check answers →
            </button>
          )}
        </form>
      </div>

      <dialog
        ref={dialog}
        className="bb-reading-dialog"
        aria-labelledby="reading-timer-title"
      >
        <h2 id="reading-timer-title">
          Start the timer to begin
        </h2>

        <p>
          You have {passage.minutes} minutes. Answers lock when
          time is up.
        </p>

        <div className="bb-reading-actions">
          <button type="button" onClick={start}>
            Start timer
          </button>

          <button
            type="button"
            className="bb-reading-secondary"
            onClick={() => dialog.current?.close()}
          >
            Not yet
          </button>
        </div>
      </dialog>
    </div>
  );
}

export default function Reading() {
  const navigate = useNavigate();

  const [selected, setSelected] = useState(null);
  const [level, setLevel] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState('quiz');
  const [running, setRunning] = useState(false);
  const [hasWork, setHasWork] = useState(false);

  const [activePlan, setActivePlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState('');
  const [planRetry, setPlanRetry] = useState(0);

  const catalog = useRef(null);

  useEffect(() => {
    if (!sessionStorage.getItem('band_buddy_access_token')) {
      navigate('/login', { replace: true });
      return;
    }

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
          sessionStorage.removeItem('band_buddy_access_token');
          navigate('/login', { replace: true });
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
  }, [navigate, planRetry]);

  useEffect(() => {
    if (!hasWork) return;

    function warn(event) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', warn);

    return () =>
      window.removeEventListener('beforeunload', warn);
  }, [hasWork]);

  function back() {
    if (
      hasWork &&
      !window.confirm(
        'Leave this set? Progress that has not been saved will be lost.',
      )
    ) {
      return;
    }

    setSelected(null);
    setRunning(false);
    setHasWork(false);
  }

  function changePage(nextPage) {
    setPage(nextPage);

    catalog.current?.focus({ preventScroll: true });
    catalog.current?.scrollIntoView({ block: 'start' });
  }

  function openPractice(set) {
    if (planLoading || planError) return;

    if (!canAccessSet(set.requiredPlan, activePlan)) {
      navigate(`/plans#bb-plan-title-${set.requiredPlan}`);
      return;
    }

    setMode('quiz');
    setSelected(set);
    window.scrollTo(0, 0);
  }

  const filtered = SETS.filter(
    (set) =>
      (!level || set.level === level) &&
      (!type || set.types.includes(type)),
  );

  const pageCount = Math.max(
    1,
    Math.ceil(filtered.length / PAGE_SIZE),
  );

  const visible = filtered.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  return (
    <div className="bb-reading">
      {!selected ? (
        <>
          <header className="bb-reading-hero">
            <div>
              <p className="bb-reading-kicker">
                BAND BUDDY · IELTS PRACTICE
              </p>

              <h1>Reading practice</h1>

              <p>
                Choose a passage, practise against the timer,
                or read a sentence aloud.
              </p>
            </div>

            <svg
              className="bb-reading-art"
              viewBox="0 0 180 130"
              aria-hidden="true"
            >
              <circle
                cx="90"
                cy="65"
                r="57"
                fill="#c8e4fc"
              />

              <path
                d="M90 42Q64 26 34 34v56q30-8 56 10 26-18 56-10V34q-30-8-56 8Z"
                fill="#fff"
                stroke="#367dbd"
                strokeWidth="3"
              />

              <path
                d="M90 43v56M46 48q19-5 32 5m-32 9q19-5 32 5m-32 9q19-5 32 5m24-28q14-10 32-5m-32 19q14-10 32-5m-32 19q14-10 32-5"
                fill="none"
                stroke="#6ca8d9"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </header>

          {planLoading && (
            <p role="status">
              Checking your plan access…
            </p>
          )}

          {planError && (
            <div role="alert">
              <p className="bb-reading-error">
                {planError}
              </p>

              <button
                type="button"
                className="bb-reading-secondary"
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

          <div className="bb-reading-filters">
            <label>
              Level
              <select
                value={level}
                onChange={(event) => {
                  setLevel(event.target.value);
                  setPage(0);
                }}
              >
                <option value="">All levels</option>

                {LEVELS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label>
              Question type
              <select
                value={type}
                onChange={(event) => {
                  setType(event.target.value);
                  setPage(0);
                }}
              >
                <option value="">All question types</option>

                {TYPES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            {(level || type) && (
              <button
                type="button"
                className="bb-reading-secondary"
                onClick={() => {
                  setLevel('');
                  setType('');
                  setPage(0);
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          <p ref={catalog} tabIndex={-1} role="status">
            {filtered.length} practice{' '}
            {filtered.length === 1 ? 'set' : 'sets'}
            {pageCount > 1
              ? ` · Page ${page + 1} of ${pageCount}`
              : ''}
          </p>

          {!visible.length && (
            <p>No passages match these filters.</p>
          )}

          <div className="bb-reading-cards">
            {visible.map((set) => {
              const canAccess = canAccessSet(
                set.requiredPlan,
                activePlan,
              );

              const planName =
                PLAN_NAMES[set.requiredPlan] ?? 'Paid';

              return (
                <article
                  key={set.id}
                  className="bb-reading-card"
                >
                  <span
                    className={`bb-reading-badge level-${set.level.toLowerCase()}`}
                  >
                    {set.level}
                  </span>

                  <h2>{set.title}</h2>

                  <p className="bb-reading-meta">
                    {set.questions.length} questions ·{' '}
                    {set.minutes} min
                  </p>

                  <p className="bb-reading-types">
                    {set.types.join(' · ')}
                  </p>

                  <button
                    type="button"
                    className={
                      canAccess
                        ? undefined
                        : 'bb-reading-secondary'
                    }
                    disabled={
                      planLoading || Boolean(planError)
                    }
                    aria-label={
                      canAccess
                        ? `Start practice: ${set.title}`
                        : `View ${planName} plan for ${set.title}`
                    }
                    onClick={() => openPractice(set)}
                  >
                    {canAccess
                      ? 'Start practice →'
                      : `${planName} plan required →`}
                  </button>
                </article>
              );
            })}
          </div>

          {pageCount > 1 && (
            <nav
              aria-label="Reading passage pages"
              className="bb-reading-pagination"
            >
              <button
                type="button"
                className="bb-reading-secondary"
                disabled={!page}
                onClick={() => changePage(page - 1)}
              >
                ← Previous
              </button>

              <span>
                {page + 1} / {pageCount}
              </span>

              <button
                type="button"
                className="bb-reading-secondary"
                disabled={page + 1 >= pageCount}
                onClick={() => changePage(page + 1)}
              >
                Next →
              </button>
            </nav>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            className="bb-reading-secondary"
            onClick={back}
          >
            ← All passages
          </button>

          <h1 className="bb-reading-session-title">
            {selected.title}
          </h1>

          <div
            className="bb-reading-actions bb-reading-modes"
            role="group"
            aria-label="Reading mode"
          >
            <button
              type="button"
              aria-pressed={mode === 'quiz'}
              onClick={() => setMode('quiz')}
            >
              Answer questions
            </button>

            <button
              type="button"
              aria-pressed={mode === 'aloud'}
              disabled={running}
              onClick={() => setMode('aloud')}
            >
              Quick Read
            </button>
          </div>

          {running && (
            <p className="bb-reading-help">
              Quick Read opens when the quiz timer ends
              or you check your answers.
            </p>
          )}

          <Quiz
            key={selected.id}
            passage={selected}
            active={mode === 'quiz'}
            onRunning={setRunning}
            onWork={setHasWork}
          />

          {mode === 'aloud' && (
            <QuickRead
              key={selected.id}
              passage={selected}
            />
          )}
        </>
      )}
    </div>
  );
}
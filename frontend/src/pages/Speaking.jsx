import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import SpeakingPracticeSave from '../components/SpeakingPracticeSave';
import SpeakingFeedback from './SpeakingFeedback';
import './Speaking.css';

const TOKEN_KEY = 'band_buddy_access_token';
const PART_KEYS = ['part1', 'part2', 'part3'];

const WAVE_HEIGHTS = [
  14, 22, 34, 48, 27, 60, 44, 25,
  37, 52, 30, 20, 35, 48, 26, 17,
];

const cardGrid = {
  display: 'grid',
  gridTemplateColumns:
    'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
  gap: 16,
  marginBlock: '16px 28px',
};

function clock(seconds) {
  return [Math.floor(seconds / 60), seconds % 60]
    .map((number) => String(number).padStart(2, '0'))
    .join(':');
}

function fileExtension(type) {
  if (type.includes('mp4')) return 'm4a';
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('wav')) return 'wav';

  return 'webm';
}

function releaseRecording(session) {
  if (!session) return;

  const { recorder, stream } = session;

  if (recorder) {
    recorder.ondataavailable = null;
    recorder.onstop = null;
    recorder.onerror = null;

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  }

  stream?.getTracks().forEach((track) => track.stop());
}

function MicIcon({ recording }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {recording ? (
        <rect
          x="6"
          y="6"
          width="12"
          height="12"
          rx="2"
        />
      ) : (
        <>
          <rect
            x="9"
            y="2"
            width="6"
            height="13"
            rx="3"
          />
          <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
        </>
      )}
    </svg>
  );
}

function PracticeSession({
  part,
  config,
  topic,
  onBack,
  onFeedback,
  feedbackOpen,
}) {
  const cueCard = part === 'part2';

  const questions = cueCard
    ? [topic.prompt]
    : [topic.prompt, ...topic.points];

  const [index, setIndex] = useState(0);
  const [timing, setTiming] = useState('idle');
  const [remaining, setRemaining] = useState(
    config.practice_seconds,
  );
  const [phase, setPhase] = useState('idle');
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [recordings, setRecordings] = useState({});
  const [transcripts, setTranscripts] = useState({});
  const [error, setError] = useState('');
  const [transcriptError, setTranscriptError] = useState('');

  const timerRef = useRef(null);
  const sessionRef = useRef(null);
  const urlsRef = useRef(new Set());
  const requestRef = useRef(null);
  const dialogRef = useRef(null);
  const headingRef = useRef(null);

  const clip = recordings[index];
  const transcript = transcripts[index];
  const recording = phase === 'recording';
  const locked = phase !== 'idle';

  useEffect(() => {
    if (!feedbackOpen) {
      headingRef.current?.focus();
    }
  }, [index, feedbackOpen]);

  useEffect(() => {
    const urls = urlsRef.current;

    function warnBeforeLeaving(event) {
      if (!sessionRef.current && urls.size === 0) return;

      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener(
      'beforeunload',
      warnBeforeLeaving,
    );

    return () => {
      window.removeEventListener(
        'beforeunload',
        warnBeforeLeaving,
      );

      const session = sessionRef.current;
      sessionRef.current = null;

      releaseRecording(session);

      requestRef.current?.abort();
      requestRef.current = null;

      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  useEffect(() => {
    function tick() {
      const timer = timerRef.current;

      if (!timer || timer.pausedAt !== null) return;

      const now = Date.now();
      const session = sessionRef.current;

      if (now >= timer.endsAt) {
        setTiming('ended');
        setRemaining(0);

        if (session?.recorder?.state === 'recording') {
          session.stoppedAt = timer.endsAt;
          setPhase('stopping');
          session.recorder.stop();
        } else if (session && !session.recorder) {
          sessionRef.current = null;
          releaseRecording(session);
          setPhase('idle');
        }

        return;
      }

      if (
        session?.startedAt &&
        session.stoppedAt == null
      ) {
        setRecordedSeconds(
          Math.floor((now - session.startedAt) / 1000),
        );
      }

      const preparing = now < timer.prepEndsAt;
      const deadline = preparing
        ? timer.prepEndsAt
        : timer.endsAt;

      setTiming(preparing ? 'preparing' : 'speaking');

      setRemaining(
        Math.max(0, Math.ceil((deadline - now) / 1000)),
      );
    }

    const interval = window.setInterval(tick, 200);
    document.addEventListener('visibilitychange', tick);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  function startTimer() {
    if (sessionRef.current || requestRef.current) return;

    const existing = timerRef.current;
    const now = Date.now();

    if (existing) {
      if (existing.pausedAt === null) return;

      const pausedDuration = now - existing.pausedAt;

      existing.prepEndsAt += pausedDuration;
      existing.endsAt += pausedDuration;
      existing.pausedAt = null;

      const preparing = now < existing.prepEndsAt;
      const deadline = preparing
        ? existing.prepEndsAt
        : existing.endsAt;

      setTiming(preparing ? 'preparing' : 'speaking');

      setRemaining(
        Math.max(0, Math.ceil((deadline - now) / 1000)),
      );

      dialogRef.current?.close();
      setError('');
      return;
    }

    const prep = config.preparation_seconds ?? 0;
    const prepEndsAt = now + prep * 1000;

    timerRef.current = {
      prepEndsAt,
      endsAt: prepEndsAt + config.practice_seconds * 1000,
      pausedAt: null,
    };

    dialogRef.current?.close();
    setError('');
    setTiming(prep ? 'preparing' : 'speaking');
    setRemaining(prep || config.practice_seconds);
  }

  function pauseTimer() {
    const timer = timerRef.current;

    if (!timer || timer.pausedAt !== null) return;

    const now = Date.now();

    if (now >= timer.endsAt) {
      setTiming('ended');
      setRemaining(0);
      return;
    }

    timer.pausedAt = now;

    setRemaining(
      Math.max(
        0,
        Math.ceil((timer.endsAt - now) / 1000),
      ),
    );

    setTiming('paused');
  }

  function canRecordNow() {
    const timer = timerRef.current;
    const now = Date.now();

    return Boolean(
      timer &&
      timer.pausedAt === null &&
      now >= timer.prepEndsAt &&
      now < timer.endsAt,
    );
  }

  async function startRecording() {
    if (sessionRef.current || requestRef.current) return;

    if (!timerRef.current) {
      if (dialogRef.current && !dialogRef.current.open) {
        dialogRef.current.showModal();
      }
      return;
    }

    if (!canRecordNow()) {
      const timer = timerRef.current;

      if (timer.pausedAt !== null) {
        setError('Resume the timer before recording.');
      } else if (Date.now() < timer.prepEndsAt) {
        setError('Wait until the preparation timer finishes.');
      } else {
        setError('Time is up for this practice set.');
      }

      return;
    }

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setError(
        'Microphone recording requires a supported browser on localhost or HTTPS.',
      );
      return;
    }

    if (
      clip &&
      !window.confirm(
        'Replace the recording for this question?',
      )
    ) {
      return;
    }

    if (!canRecordNow()) {
      setError('Time is up for this practice set.');
      return;
    }

    const session = {
      stream: null,
      recorder: null,
      startedAt: 0,
      stoppedAt: null,
    };

    sessionRef.current = session;
    setPhase('requesting');
    setError('');

    function fail(message) {
      if (sessionRef.current !== session) return;

      sessionRef.current = null;
      releaseRecording(session);
      pauseTimer();

      setPhase('idle');
      setRecordedSeconds(clip?.seconds ?? 0);
      setError(message);
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      if (sessionRef.current !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      session.stream = stream;

      if (!canRecordNow()) {
        fail('Time is up for this practice set.');
        return;
      }

      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ].find(
        (type) => MediaRecorder.isTypeSupported?.(type),
      );

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      const chunks = [];
      session.recorder = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () =>
        fail('Recording failed. Please try again.');

      recorder.onstop = () => {
        if (sessionRef.current !== session) return;

        const finishedAt = Math.min(
          session.stoppedAt ?? Date.now(),
          timerRef.current.endsAt,
        );

        const seconds = Math.max(
          0,
          Math.floor(
            (finishedAt - session.startedAt) / 1000,
          ),
        );

        const type =
          recorder.mimeType ||
          chunks[0]?.type ||
          'audio/webm';

        const blob = new Blob(chunks, { type });

        if (!blob.size) {
          fail('No audio was captured. Please try again.');
          return;
        }

        pauseTimer();

        sessionRef.current = null;
        releaseRecording(session);
        setPhase('idle');

        if (clip) {
          URL.revokeObjectURL(clip.url);
          urlsRef.current.delete(clip.url);
        }

        const url = URL.createObjectURL(blob);
        urlsRef.current.add(url);

        setRecordings((old) => ({
          ...old,
          [index]: {
            url,
            blob,
            seconds,
            extension: fileExtension(type),
          },
        }));

        setTranscripts((old) => {
          const next = { ...old };
          delete next[index];
          return next;
        });

        setTranscriptError('');
        setRecordedSeconds(seconds);
      };

      session.startedAt = Date.now();
      recorder.start();

      setRecordedSeconds(0);
      setPhase('recording');
    } catch (err) {
      fail(
        err.name === 'NotAllowedError'
          ? 'Allow microphone access in your browser and try again.'
          : err.name === 'NotFoundError'
            ? 'No microphone was found. Connect one and try again.'
            : 'Could not start recording. Check your microphone and try again.',
      );
    }
  }

  function stopRecording() {
    const session = sessionRef.current;

    if (
      session?.recorder?.state !== 'recording'
    ) {
      return;
    }

    session.stoppedAt = Math.min(
      Date.now(),
      timerRef.current.endsAt,
    );

    pauseTimer();
    setPhase('stopping');
    session.recorder.stop();
  }

  async function generateTranscript() {
    if (
      !clip ||
      sessionRef.current ||
      requestRef.current ||
      transcript
    ) {
      return;
    }

    pauseTimer();

    const request = new AbortController();
    requestRef.current = request;

    setTranscribing(true);
    setTranscriptError('');

    const form = new FormData();

    form.append(
      'audio',
      clip.blob,
      `recording.${clip.extension}`,
    );

    try {
      const { data } = await api.post(
        '/speaking/transcribe',
        form,
        {
          signal: request.signal,
          timeout: 60000,
        },
      );

      if (request.signal.aborted) return;

      const text =
        typeof data?.transcript === 'string'
          ? data.transcript.trim()
          : '';

      if (text) {
        setTranscripts((old) => ({
          ...old,
          [index]: text,
        }));
      } else {
        setTranscriptError(
          'No transcript was returned. Please try again.',
        );
      }
    } catch (err) {
      if (request.signal.aborted) return;

      const detail = err.response?.data?.detail;

      setTranscriptError(
        err.response?.status === 401
          ? 'Your session expired. Please log in again.'
          : typeof detail === 'string'
            ? detail
            : 'Could not generate the transcript. Please try again.',
      );
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null;
        setTranscribing(false);
      }
    }
  }

  function moveQuestion(next) {
    if (
      sessionRef.current ||
      requestRef.current ||
      next < 0 ||
      next >= questions.length
    ) {
      return;
    }

    setIndex(next);
    setRecordedSeconds(recordings[next]?.seconds ?? 0);
    setError('');
    setTranscriptError('');
  }

  function leavePractice() {
    if (sessionRef.current || requestRef.current) return;

    if (
      urlsRef.current.size &&
      !window.confirm(
        'Download any recordings you want to keep. Leave this practice set?',
      )
    ) {
      return;
    }

    onBack();
  }

  function openFeedback() {
    if (!transcript || locked || transcribing) return;

    pauseTimer();

    const feedbackQuestion = cueCard
      ? [
          topic.prompt,
          ...topic.points.map((point) => `- ${point}`),
        ].join('\n')
      : questions[index];

    onFeedback({
      title: topic.title,
      question: feedbackQuestion,
      transcript,
    });
  }

  const timerLabel = {
    idle: 'Practice time',
    preparing: 'Preparation time left',
    speaking: 'Speaking time left',
    paused: 'Practice timer paused',
    ended: 'Time is up',
  }[timing];

  const recordLabel = {
    idle: clip ? 'Record again' : 'Start recording',
    requesting: 'Opening microphone…',
    recording: 'Stop recording',
    stopping: 'Finishing recording…',
  }[phase];

  const recordDisabled =
    !recording &&
    (
      locked ||
      transcribing ||
      timing === 'preparing' ||
      timing === 'paused' ||
      timing === 'ended'
    );

  const recordAction = recording
    ? stopRecording
    : startRecording;

  return (
    <>
      <div
        className="sp-studio-actions"
        style={{ marginBlock: 16 }}
      >
        <button
          type="button"
          className="sp-button sp-outline"
          disabled={locked || transcribing}
          onClick={leavePractice}
        >
          ← Back to topics
        </button>
      </div>

      <div className="sp-studio-grid">
        <section
          className="sp-studio-panel"
          aria-labelledby="sp-topic-title"
        >
          <div className="sp-coach-note">
            <img
              src="/images/login-student.png"
              alt=""
            />

            <div>
              <p className="sp-eyebrow">
                {config.label} · YOUR SPEAKING PROMPT
              </p>

              <h2 id="sp-topic-title">
                {topic.title}
              </h2>

              <p>{config.tip}</p>
            </div>
          </div>

          <div className="sp-prompt-box">
            <p className="sp-topic-number">
              {cueCard
                ? 'Cue card'
                : `Question ${index + 1} of ${questions.length}`}
            </p>

            <h3 ref={headingRef} tabIndex={-1}>
              {questions[index]}
            </h3>

            {cueCard && (
              <ul className="sp-points">
                {topic.points.map((point, number) => (
                  <li key={number}>{point}</li>
                ))}
              </ul>
            )}
          </div>

          <div
            className="sp-record-box"
            style={{ marginBlock: 14 }}
          >
            <div className="sp-studio-actions">
              <strong role="status">
                {timerLabel}
              </strong>

              <span
                className="sp-studio-clock"
                role="timer"
              >
                {clock(remaining)}
              </span>

              {(timing === 'idle' || timing === 'paused') && (
                <button
                  type="button"
                  className="sp-button"
                  disabled={locked || transcribing}
                  onClick={startTimer}
                >
                  {timing === 'paused'
                    ? 'Resume timer'
                    : 'Start timer'}
                </button>
              )}
            </div>

            {timing === 'idle' && (
              <p>Start the timer before recording.</p>
            )}

            {timing === 'preparing' && (
              <p>
                Recording opens when preparation ends.
              </p>
            )}

            {timing === 'paused' && (
              <p>
                Your timer is paused. Resume it before
                recording another answer.
              </p>
            )}

            {timing === 'ended' && (
              <p>
                You can still listen to, save or transcribe
                your recordings.
              </p>
            )}
          </div>

          <div className="sp-record-box">
            <div className="sp-record-row">
              <button
                type="button"
                className="sp-mic-control"
                onClick={recordAction}
                disabled={recordDisabled}
                aria-label={recordLabel}
              >
                <MicIcon recording={recording} />
              </button>

              <div
                className={`sp-wave${
                  recording ? ' sp-wave-live' : ''
                }`}
                aria-hidden="true"
              >
                {WAVE_HEIGHTS.map((height, bar) => (
                  <span
                    key={bar}
                    style={{
                      height: `${height}%`,
                      animationDelay: `${bar * 45}ms`,
                    }}
                  />
                ))}
              </div>

              <span
                className="sp-studio-clock"
                aria-label={`Recording time: ${clock(recordedSeconds)}`}
              >
                {clock(recordedSeconds)}
              </span>
            </div>

            <div className="sp-studio-actions">
              <button
                type="button"
                className="sp-button"
                disabled={recordDisabled}
                onClick={recordAction}
              >
                {recordLabel}
              </button>
            </div>

            {error && (
              <p className="sp-error" role="alert">
                {error}
              </p>
            )}

            {clip && !locked && (
              <div className="sp-playback">
                <audio
                  key={`audio-${clip.url}`}
                  src={clip.url}
                  controls
                  preload="metadata"
                  aria-label="Listen to your recorded answer"
                />

                <SpeakingPracticeSave
                  key={`save-${clip.url}`}
                  title={
                    cueCard
                      ? topic.title
                      : `${topic.title} · Question ${index + 1}`
                  }
                  seconds={clip.seconds}
                />

                <a
                  className="sp-button sp-outline"
                  href={clip.url}
                  download={`band-buddy-${topic.slug}-answer-${index + 1}.${clip.extension}`}
                >
                  Download recording
                </a>
              </div>
            )}
          </div>

          {!cueCard && (
            <div
              className="sp-studio-actions"
              style={{ marginTop: 16 }}
            >
              <button
                type="button"
                className="sp-button sp-outline"
                disabled={
                  locked || transcribing || index === 0
                }
                onClick={() => moveQuestion(index - 1)}
              >
                ← Previous question
              </button>

              <button
                type="button"
                className="sp-button"
                disabled={
                  locked ||
                  transcribing ||
                  index === questions.length - 1
                }
                onClick={() => moveQuestion(index + 1)}
              >
                Next question →
              </button>
            </div>
          )}
        </section>

        <aside
          className="sp-studio-panel sp-transcript"
          aria-labelledby="sp-transcript-title"
          aria-busy={transcribing}
        >
          <div className="sp-transcript-heading">
            <h2 id="sp-transcript-title">
              Transcript
            </h2>
          </div>

          <p>
            Record an English answer, then generate its
            transcript.
          </p>

          <button
            type="button"
            className="sp-button"
            disabled={
              !clip ||
              locked ||
              transcribing ||
              Boolean(transcript)
            }
            onClick={generateTranscript}
          >
            {transcribing
              ? 'Transcribing…'
              : transcript
                ? 'Transcript ready'
                : 'Generate transcript'}
          </button>

          {transcriptError && (
            <p className="sp-error" role="alert">
              {transcriptError}
            </p>
          )}

          {transcript && (
            <>
              <p
                role="status"
                style={{ overflowWrap: 'anywhere' }}
              >
                {transcript}
              </p>

              <button
                type="button"
                className="sp-button"
                disabled={locked || transcribing}
                onClick={openFeedback}
              >
                Get feedback →
              </button>
            </>
          )}
        </aside>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="sp-timer-dialog-title"
        style={{
          boxSizing: 'border-box',
          width: 'min(420px, calc(100% - 32px))',
          border: '1px solid #c7ddef',
          borderRadius: 18,
          padding: 24,
          color: '#102b50',
        }}
      >
        <h2 id="sp-timer-dialog-title">
          Start the timer first
        </h2>

        <p>
          Start the timer to begin your practice.
        </p>

        <div className="sp-studio-actions">
          <button
            type="button"
            className="sp-button"
            onClick={startTimer}
          >
            Start timer
          </button>

          <button
            type="button"
            className="sp-button sp-outline"
            onClick={() => dialogRef.current?.close()}
          >
            Not yet
          </button>
        </div>
      </dialog>
    </>
  );
}

export default function Speaking() {
  const navigate = useNavigate();

  const [parts, setParts] = useState(null);
  const [part, setPart] = useState('part1');
  const [topicId, setTopicId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!sessionStorage.getItem(TOKEN_KEY)) {
      navigate('/login', { replace: true });
      return;
    }

    const controller = new AbortController();

    async function loadTopics() {
      try {
        const { data } = await api.get(
          '/speaking/topics',
          { signal: controller.signal },
        );

        if (controller.signal.aborted) return;

        if (
          !PART_KEYS.every(
            (key) => Array.isArray(data?.[key]?.topics),
          )
        ) {
          throw new Error(
            'Unexpected speaking topics response',
          );
        }

        setParts(data);
      } catch (err) {
        if (controller.signal.aborted) return;

        if (err.response?.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          navigate('/login', { replace: true });
          return;
        }

        setError(
          'Could not load speaking topics. Check that the backend is running, then try again.',
        );
      }
    }

    void loadTopics();

    return () => controller.abort();
  }, [navigate, retry]);

  if (!parts) {
    return (
      <main className="sp-page sp-loading">
        <h1>Speaking practice</h1>

        <p role={error ? 'alert' : 'status'}>
          {error || 'Loading your speaking topics…'}
        </p>

        {error && (
          <button
            type="button"
            className="sp-button"
            onClick={() => {
              setError('');
              setRetry((old) => old + 1);
            }}
          >
            Try again
          </button>
        )}
      </main>
    );
  }

  const current = parts[part];
  const selected = current.topics.find(
    (topic) => topic.id === topicId,
  );

  return (
    <div className="sp-page">
      <div
        style={
          feedback ? { display: 'none' } : undefined
        }
      >
        <main className="sp-shell sp-main sp-studio">
          <section
            className="sp-studio-hero"
            aria-labelledby="speaking-title"
          >
            <div>
              <p className="sp-eyebrow">
                BAND BUDDY · IELTS PRACTICE
              </p>

              <h1 id="speaking-title">
                Speaking practice
              </h1>

              <p>
                Build confidence, one answer at a time.
              </p>
            </div>

            <img
              src="/images/speaking-conversation.png"
              alt=""
            />
          </section>

          {selected ? (
            <PracticeSession
              key={`${part}:${selected.id}`}
              part={part}
              config={current}
              topic={selected}
              onBack={() => setTopicId(null)}
              onFeedback={setFeedback}
              feedbackOpen={Boolean(feedback)}
            />
          ) : (
            <>
              <div
                className="sp-part-switch"
                role="group"
                aria-label="Speaking part"
              >
                {PART_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={part === key}
                    onClick={() => {
                      setPart(key);
                      setTopicId(null);
                    }}
                  >
                    <strong>{parts[key].label}</strong>
                    <span>{parts[key].title}</span>
                  </button>
                ))}
              </div>

              <section
                aria-labelledby="sp-topics-title"
              >
                <h2 id="sp-topics-title">
                  Choose a topic
                </h2>

                <p>
                  {current.topics.length} practice sets ·{' '}
                  {current.tip}
                </p>

                {current.topics.length === 0 ? (
                  <p>
                    No topics are currently available for
                    this part.
                  </p>
                ) : (
                  <div style={cardGrid}>
                    {current.topics.map((topic, index) => (
                      <article
                        key={topic.id}
                        className="sp-studio-panel"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <p className="sp-eyebrow">
                          {current.label} · Set {index + 1}
                        </p>

                        <h3 style={{ margin: 0 }}>
                          {topic.title}
                        </h3>

                        <p style={{ margin: 0 }}>
                          {part === 'part2'
                            ? `1 cue card · ${current.preparation_seconds / 60} min prep + ${current.practice_seconds / 60} min speaking`
                            : `${topic.points.length + 1} questions · ${current.practice_seconds / 60} min`}
                        </p>

                        <button
                          type="button"
                          className="sp-button"
                          style={{
                            alignSelf: 'flex-start',
                            marginTop: 'auto',
                          }}
                          aria-label={`Start practice: ${topic.title}`}
                          onClick={() =>
                            setTopicId(topic.id)
                          }
                        >
                          Start practice →
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>

      {feedback && (
        <SpeakingFeedback
          title={feedback.title}
          question={feedback.question}
          transcript={feedback.transcript}
          onBack={() => setFeedback(null)}
        />
      )}

      <footer className="sp-footer">
        Band Buddy · Small steps. Meaningful progress.
      </footer>
    </div>
  );
}
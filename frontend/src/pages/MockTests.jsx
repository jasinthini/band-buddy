import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import extraSets from '../data/listeningExtraSets';
import './Listening.css';

const PART_IDS = [
  'extra-hall-booking',
  'extra-bus-diversion',
  'extra-course-registration',
  'extra-campus-orientation',
];

const PARTS = PART_IDS.map((id) => extraSets.find((set) => set.id === id));

function normalise(value = '') {
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .trim()
    .replace(/[.!?]+$/, '')
    .replace(/\s+/g, ' ');
}

function isCorrect(question, value = '') {
  const answer = normalise(value);
  if (!answer) return false;
  if (question.limit && answer.split(' ').length > question.limit) return false;
  return [question.answer, ...(question.acceptedAnswers ?? [])]
    .some((expected) => normalise(expected) === answer);
}

function ListeningMock() {
  const [stage, setStage] = useState('intro');
  const [partIndex, setPartIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [audioStatus, setAudioStatus] = useState('ready');
  const [audioError, setAudioError] = useState('');
  const playback = useRef(null);
  const heading = useRef(null);

  const part = PARTS[partIndex];
  const lastPart = partIndex === PARTS.length - 1;
  const total = PARTS.reduce((count, item) => count + item.questions.length, 0);
  const questionOffset = PARTS.slice(0, partIndex)
    .reduce((count, item) => count + item.questions.length, 0);
  const answered = Object.values(answers).filter((value) => normalise(value)).length;
  const keyFor = (item, index) => `${item.id}-${index}`;

  useEffect(() => {
    return () => {
      if (!playback.current) return;
      playback.current = null;
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    heading.current?.focus();
  }, [stage, partIndex]);

  function playAudio() {
    if (audioStatus !== 'ready' || playback.current) return;

    const synth = window.speechSynthesis;
    if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') {
      setAudioError('Audio is unavailable in this browser. Try Chrome or Edge with an English system voice.');
      return;
    }

    const attempt = { began: false, utterance: null };
    playback.current = attempt;
    setAudioError('');
    setAudioStatus('playing');

    const voices = synth.getVoices().filter((voice) => /^en(?:[-_]|$)/i.test(voice.lang));
    const speakers = [...new Set(part.dialogue.map(([speaker]) => speaker))];

    function fail() {
      if (playback.current !== attempt) return;
      playback.current = null;

      if (attempt.began) {
        setAudioStatus('interrupted');
        setAudioError('The audio was interrupted after it started. Continue with what you heard, or restart the mock.');
      } else {
        setAudioStatus('ready');
        setAudioError('The audio could not start. Check your device voice settings and try again.');
      }
    }

    function playLine(index) {
      if (playback.current !== attempt) return;

      if (index === part.dialogue.length) {
        playback.current = null;
        setAudioStatus('finished');
        return;
      }

      const [speaker, line] = part.dialogue[index];
      const speakerIndex = speakers.indexOf(speaker);
      const voice = voices[speakerIndex % voices.length];
      const utterance = new window.SpeechSynthesisUtterance(line);

      utterance.lang = voice?.lang ?? 'en-GB';
      if (voice) utterance.voice = voice;
      utterance.rate = 0.92;
      utterance.pitch = speakerIndex % 2 ? 0.92 : 1.05;
      utterance.onstart = () => { attempt.began = true; };
      utterance.onend = () => {
        attempt.began = true;
        playLine(index + 1);
      };
      utterance.onerror = fail;
      attempt.utterance = utterance;

      try {
        synth.speak(utterance);
      } catch {
        fail();
      }
    }

    playLine(0);
  }

  function next(event) {
    event.preventDefault();
    if (audioStatus !== 'finished' && audioStatus !== 'interrupted') return;

    const blanks = part.questions.some(
      (_, index) => !normalise(answers[keyFor(part, index)]),
    );

    if (blanks && !window.confirm('Some answers are blank. Continue anyway?')) return;

    if (lastPart) {
      setStage('result');
    } else {
      setPartIndex((value) => value + 1);
      setAudioStatus('ready');
      setAudioError('');
    }
  }

  function restart() {
    if (!window.confirm('Restart the mock? Your current answers will be cleared.')) return;
    if (playback.current) {
      playback.current = null;
      window.speechSynthesis?.cancel();
    }
    setAnswers({});
    setPartIndex(0);
    setAudioStatus('ready');
    setAudioError('');
    setStage('intro');
  }

  if (stage === 'intro') {
    return (
      <section className="ls-panel">
        <p className="ls-kicker">BAND BUDDY · FULL MOCK</p>
        <h1 ref={heading} tabIndex={-1}>Listening mock test</h1>
        <p>4 parts · {total} questions · one playback per part</p>
        <p>You can preview each part’s questions before playing its audio. Once you move to the next part, your answers for the previous part are locked.</p>
        <button type="button" onClick={() => setStage('test')}>Start mock →</button>
        <p style={{ marginTop: 16 }}><Link to="/mock-tests">← All mock tests</Link></p>
      </section>
    );
  }

  if (stage === 'result') {
    const scores = PARTS.map((item) => item.questions.filter(
      (question, index) => isCorrect(question, answers[keyFor(item, index)]),
    ).length);

    return (
      <>
        <section className="ls-panel">
          <p className="ls-kicker">MOCK COMPLETE</p>
          <h1 ref={heading} tabIndex={-1}>
            Score: {scores.reduce((sum, score) => sum + score, 0)}/{total}
          </h1>
          <p>Review your answers and transcript for each part below.</p>
          <button type="button" onClick={restart}>Try again</button>
          <p style={{ marginTop: 16 }}><Link to="/mock-tests">← All mock tests</Link></p>
        </section>

        {PARTS.map((item, partNumber) => (
          <details className="ls-panel ls-transcript" key={item.id}>
            <summary>
              Part {partNumber + 1} · {item.title} · {scores[partNumber]}/{item.questions.length}
            </summary>

            {item.questions.map((question, index) => {
              const value = answers[keyFor(item, index)] ?? '';
              const correct = isCorrect(question, value);
              return (
                <div className={`ls-feedback${correct ? ' ls-correct' : ''}`}
                  key={keyFor(item, index)}>
                  <strong>{index + 1}. {question.prompt}</strong>
                  <p>Your answer: {value.trim() || 'Unanswered'}</p>
                  <p>Correct answer: {question.answer}</p>
                </div>
              );
            })}

            <details className="ls-transcript">
              <summary>Read transcript</summary>
              {item.dialogue.map(([speaker, line], index) => (
                <p key={index}><strong>{speaker}:</strong> {line}</p>
              ))}
            </details>
          </details>
        ))}
      </>
    );
  }

  return (
    <>
      <div className="ls-exercise-title">
        <p className="ls-kicker">LISTENING MOCK · PART {partIndex + 1} OF {PARTS.length}</p>
        <h1 ref={heading} tabIndex={-1}>{part.title}</h1>
        <p>{part.intro}</p>
      </div>

      <div className="ls-toolbar">
        <span>{answered}/{total} answered</span>
        <button type="button" className="ls-secondary" onClick={restart}>Restart mock</button>
      </div>

      <div className="ls-workspace">
        <section className="ls-panel ls-player">
          <h2>Part audio</h2>
          <p role="status">
            {audioStatus === 'ready' && 'Preview the questions, then play the audio once.'}
            {audioStatus === 'playing' && 'Playing… You can answer while you listen.'}
            {audioStatus === 'finished' && 'Audio finished. Check your answers before you continue.'}
            {audioStatus === 'interrupted' && 'Playback interrupted.'}
          </p>
          <button type="button" disabled={audioStatus !== 'ready'} onClick={playAudio}>
            {audioStatus === 'ready' ? '▶ Play audio' : 'Audio started'}
          </button>
          {audioError && <p role="alert" className="ls-error">{audioError}</p>}
        </section>

        <form className="ls-panel" onSubmit={next}>
          <h2>Questions {questionOffset + 1}–{questionOffset + part.questions.length}</h2>

          {part.questions.map((question, index) => {
            const key = keyFor(part, index);
            const value = answers[key] ?? '';
            const update = (nextValue) => setAnswers(
              (previous) => ({ ...previous, [key]: nextValue }),
            );

            return (
              <section className="ls-question" key={key}>
                <p className="ls-muted">{question.type ?? 'Multiple choice'}</p>
                <h3 id={`${key}-label`}>{questionOffset + index + 1}. {question.prompt}</h3>
                {question.options ? (
                  <fieldset aria-labelledby={`${key}-label`}>
                    {question.options.map((option) => (
                      <label className="ls-option" key={option}>
                        <input type="radio" name={key} checked={value === option}
                          onChange={() => update(option)} />
                        {option}
                      </label>
                    ))}
                  </fieldset>
                ) : (
                  <>
                    {question.limit && (
                      <p id={`${key}-limit`} className="ls-muted">Up to {question.limit} words</p>
                    )}
                    <input className="ls-text-input" type="text" value={value}
                      aria-labelledby={`${key}-label`}
                      aria-describedby={question.limit ? `${key}-limit` : undefined}
                      autoComplete="off" spellCheck={false} maxLength={100}
                      onChange={(event) => update(event.target.value)} />
                  </>
                )}
              </section>
            );
          })}

          <button className="ls-submit" type="submit"
            disabled={audioStatus !== 'finished' && audioStatus !== 'interrupted'}>
            {lastPart ? 'Submit mock →' : 'Next part →'}
          </button>
        </form>
      </div>
    </>
  );
}

export default function MockTests() {
  const { pathname } = useLocation();
  const isListening = pathname.replace(/\/$/, '') === '/mock-tests/listening';
  const dataReady = PARTS.every((part) => part?.questions.length === 10 && part.dialogue.length);

  return (
    <div className="ls-page">
      {isListening ? (
        dataReady ? <ListeningMock /> : (
          <p role="alert">The four listening mock sets could not be loaded.</p>
        )
      ) : (
        <>
          <header className="ls-hero">
            <div>
              <p className="ls-kicker">BAND BUDDY · IELTS PREPARATION</p>
              <h1>Mock tests</h1>
              <p>Practise a full skill test and review your answers at the end.</p>
            </div>
          </header>

          <div className="ls-list-header"><h2>Available tests</h2></div>
          <article className="ls-panel" style={{ maxWidth: 480 }}>
            <p className="ls-kicker">LISTENING</p>
            <h2>Full listening mock</h2>
            <p>4 parts · 40 questions · audio plays once per part</p>
            <Link to="/mock-tests/listening">Open listening mock →</Link>
          </article>
        </>
      )}
    </div>
  );
}
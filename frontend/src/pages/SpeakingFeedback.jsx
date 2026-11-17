import { useEffect, useState } from 'react';
import api from '../services/api';

export default function SpeakingFeedback({
  title,
  question,
  transcript,
  onBack,
}) {
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  const text = typeof transcript === 'string' ? transcript.trim() : '';
  const prompt = typeof question === 'string' ? question.trim() : '';

  useEffect(() => {
    if (!text) return;

    const controller = new AbortController();
    setLoading(true);
    setError('');
    setFeedback(null);

    async function loadFeedback() {
      try {
        const { data } = await api.post(
          '/speaking/feedback',
          {
            transcript: text,
            ...(prompt.length <= 500 && prompt ? { prompt } : {}),
          },
          { signal: controller.signal },
        );

        if (!controller.signal.aborted) setFeedback(data);
      } catch (err) {
        if (controller.signal.aborted) return;

        const detail = err.response?.data?.detail;
        setError(
          typeof detail === 'string'
            ? detail
            : 'Could not load feedback. Please try again.',
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadFeedback();
    return () => controller.abort();
  }, [text, prompt, retry]);

  const corrections = feedback?.grammar_corrections ?? [];

  return (
    <main className="sp-main">
      <button type="button" className="sp-button" onClick={onBack}>
        ← Back to practice
      </button>

      <section className="sp-studio-panel" aria-labelledby="sp-feedback-title">
        <h1 id="sp-feedback-title">Speaking practice feedback</h1>
        {title && <p><strong>{title}</strong></p>}
        {prompt && <p>{prompt}</p>}

        {!text ? (
          <p>Generate a transcript before requesting feedback.</p>
        ) : loading ? (
          <p role="status">Checking your transcript…</p>
        ) : error ? (
          <>
            <p className="sp-error" role="alert">{error}</p>
            <button
              type="button"
              className="sp-button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Try again
            </button>
          </>
        ) : feedback ? (
          <>
            <h2>Grammar tips</h2>
            <p>{feedback.summary}</p>

            {corrections.map((item, index) => (
              <article key={index}>
                <p><strong>You said:</strong> {item.original}</p>
                <p><strong>Try:</strong> {item.corrected}</p>
                <p><strong>Why:</strong> {item.explanation}</p>
              </article>
            ))}

            {corrections.length === 0 && (
              <p>This check covers a small set of examples. It may miss other errors.</p>
            )}

            <h2>Next practice step</h2>
            <p>{feedback.next_step}</p>
          </>
        ) : null}

        {text && (
          <details>
            <summary>View transcript</summary>
            <p style={{ overflowWrap: 'anywhere' }}>{text}</p>
          </details>
        )}
      </section>
    </main>
  );
}
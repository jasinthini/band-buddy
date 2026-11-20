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

  const text = typeof transcript === 'string'
    ? transcript.trim()
    : '';

  const prompt = typeof question === 'string'
    ? question.trim()
    : '';

  useEffect(() => {
    setFeedback(null);
    setError('');

    if (!text || !prompt) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    setLoading(true);

    async function loadFeedback() {
      try {
        const { data } = await api.post(
          '/speaking/feedback',
          {
            question: prompt,
            transcript: text,
          },
          {
            signal,
            timeout: 100000,
          },
        );

        if (signal.aborted) return;

        const fields = [
          'grammar',
          'vocabulary',
          'organisation',
          'next_step',
        ];

        const valid = fields.every(
          (field) =>
            typeof data?.[field] === 'string' &&
            data[field].trim(),
        );

        if (!valid) {
          setError(
            'The server returned incomplete feedback. Please try again.',
          );
          return;
        }

        setFeedback(data);
      } catch (err) {
        if (signal.aborted) return;

        const detail = err.response?.data?.detail;

        if (err.response?.status === 401) {
          setError('Your session expired. Please log in again.');
        } else if (typeof detail === 'string') {
          setError(detail);
        } else if (err.response?.status === 422) {
          setError(
            'The question or transcript could not be accepted. Please check the practice data.',
          );
        } else if (err.code === 'ECONNABORTED') {
          setError(
            'Feedback took too long. Please try again.',
          );
        } else {
          setError(
            'Could not load feedback. Check your connection and try again.',
          );
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadFeedback();

    return () => controller.abort();
  }, [text, prompt, retry]);

  const sections = feedback
    ? [
        ['Grammar', feedback.grammar],
        ['Vocabulary', feedback.vocabulary],
        ['Organisation', feedback.organisation],
        ['Next practice step', feedback.next_step],
      ]
    : [];

  return (
    <main className="sp-main">
      <style>{`
        .sp-feedback-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          margin-block: 20px;
        }

        .sp-feedback-card {
          box-sizing: border-box;
          min-width: 0;
          padding: 22px;
          border: 1px solid #c7ddef;
          border-top: 3px solid #7ab5e9;
          border-radius: 16px;
          background: #fff;
          color: #102b50;
          overflow-wrap: anywhere;
        }

        .sp-feedback-card h2 {
          margin: 0 0 12px;
          font-size: 21px;
        }

        .sp-feedback-card p {
          margin: 0;
          line-height: 1.7;
          white-space: pre-wrap;
        }

        .sp-feedback-description,
        .sp-feedback-transcript {
          overflow-wrap: anywhere;
          white-space: pre-wrap;
        }

        .sp-feedback-transcript-toggle {
          display: flex;
          align-items: center;
          min-height: 44px;
          cursor: pointer;
        }

        @media (max-width: 767px) {
          .sp-feedback-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 14px;
          }

          .sp-feedback-card {
            padding: 18px;
          }
        }
      `}</style>

      <button
        type="button"
        className="sp-button"
        onClick={onBack}
      >
        ← Back to practice
      </button>

      <section
        className="sp-studio-panel"
        aria-labelledby="sp-feedback-title"
        aria-busy={loading}
        style={{ marginTop: 18 }}
        lang="en"
      >
        <h1 id="sp-feedback-title">
          Speaking practice feedback
        </h1>

        {title && (
          <p className="sp-feedback-description">
            <strong>{title}</strong>
          </p>
        )}

        {prompt && (
          <p className="sp-feedback-description">
            {prompt}
          </p>
        )}

        {!text || !prompt ? (
          <p role="status">
            A question and transcript are needed to generate feedback.
            Return to practice and generate your transcript.
          </p>
        ) : loading ? (
          <p role="status">
            Reviewing your answer. This may take a little time…
          </p>
        ) : error ? (
          <div>
            <p className="sp-error" role="alert">
              {error}
            </p>

            <button
              type="button"
              className="sp-button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        ) : feedback ? (
          <div className="sp-feedback-grid">
            {sections.map(([heading, content]) => (
              <article
                className="sp-feedback-card"
                key={heading}
              >
                <h2>{heading}</h2>
                <p>{content}</p>
              </article>
            ))}
          </div>
        ) : null}

        {text && (
          <details>
            <summary className="sp-feedback-transcript-toggle">
              View transcript
            </summary>

            <p className="sp-feedback-transcript">
              {text}
            </p>
          </details>
        )}
      </section>
    </main>
  );
}
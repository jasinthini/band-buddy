import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const FOCUS_SKILLS = ['writing', 'speaking', 'reading', 'listening'];

export default function ProfileGoalSettings({ goal }) {
  const navigate = useNavigate();
  const [fields, setFields] = useState(() => ({
    test_type: goal.test_type,
    target_band: String(goal.target_band),
    exam_date: goal.exam_date ?? '',
    daily_minutes: String(goal.daily_minutes),
    focus_skill: goal.focus_skill,
  }));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function updateField(event) {
    const { name, value } = event.target;
    setFields((previous) => ({ ...previous, [name]: value }));
    setMessage('');
    setError('');
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const { data } = await api.put('/dashboard/goal/settings', {
        ...fields,
        target_band: Number(fields.target_band),
        exam_date: fields.exam_date || null,
        daily_minutes: Number(fields.daily_minutes),
      });

      setFields({
        test_type: data.test_type,
        target_band: String(data.target_band),
        exam_date: data.exam_date ?? '',
        daily_minutes: String(data.daily_minutes),
        focus_skill: data.focus_skill,
      });
      setMessage('Your goals and practice preferences were saved.');
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        sessionStorage.removeItem('band_buddy_access_token');
        navigate('/login', { replace: true });
        return;
      }

      const detail = requestError.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((item) => item.msg).join(' '));
      } else {
        setError(typeof detail === 'string' ? detail : 'Could not save your settings.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <fieldset className="bb-profile-preferences" disabled={saving}>
        <section className="bb-profile-card" aria-labelledby="profile-goals-heading">
          <h2 id="profile-goals-heading">IELTS Goals</h2>

          <div className="bb-profile-fields">
            <label>
              Test type
              <select name="test_type" value={fields.test_type} onChange={updateField}>
                <option value="academic">Academic</option>
                <option value="general">General Training</option>
              </select>
            </label>

            <label>
              Target band score
              <input
                name="target_band"
                type="number"
                min="1"
                max="9"
                step="0.5"
                required
                value={fields.target_band}
                onChange={updateField}
              />
            </label>

            <label>
              Planned test date
              <input
                name="exam_date"
                type="date"
                value={fields.exam_date}
                onChange={updateField}
              />
            </label>
          </div>
        </section>

        <section className="bb-profile-card" aria-labelledby="profile-practice-heading">
          <h2 id="profile-practice-heading">Practice Preferences</h2>

          <div className="bb-profile-fields">
            <label>
              Daily practice goal (minutes)
              <input
                name="daily_minutes"
                type="number"
                min="5"
                max="180"
                step="1"
                required
                value={fields.daily_minutes}
                onChange={updateField}
              />
            </label>

            <label>
              Focus skill
              <select name="focus_skill" value={fields.focus_skill} onChange={updateField}>
                {FOCUS_SKILLS.map((skill) => (
                  <option key={skill} value={skill}>
                    {skill.charAt(0).toUpperCase() + skill.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="bb-profile-preference-actions">
            <button type="submit" className="bb-profile-button">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {error && <p className="bb-profile-error" role="alert">{error}</p>}
            {message && <p className="bb-profile-success" role="status">{message}</p>}
          </div>
        </section>
      </fieldset>
    </form>
  );
}
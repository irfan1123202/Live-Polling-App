import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Plus, Trash2, HelpCircle, Clock, Sparkles, Send, Eye } from 'lucide-react';
import { Toast } from '../components/Toast';

export const CreatePoll = () => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [expirationHours, setExpirationHours] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const navigate = useNavigate();

  const handleAddOption = () => {
    if (options.length >= 10) {
      setToast({ message: 'Maximum 10 options allowed', type: 'error' });
      return;
    }
    setOptions([...options, '']);
  };

  const handleOptionChange = (index, value) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const handleRemoveOption = (index) => {
    if (options.length <= 2) {
      setToast({ message: 'A poll must have at least 2 options', type: 'error' });
      return;
    }
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!question.trim() || question.trim().length < 5) {
      setToast({ message: 'Question must be at least 5 characters long', type: 'error' });
      return;
    }

    const cleanedOptions = options.map(o => o.trim()).filter(Boolean);
    if (cleanedOptions.length < 2) {
      setToast({ message: 'At least 2 non-empty options are required', type: 'error' });
      return;
    }

    const uniqueOptions = new Set(cleanedOptions.map(o => o.toLowerCase()));
    if (uniqueOptions.size !== cleanedOptions.length) {
      setToast({ message: 'Duplicate options are not allowed', type: 'error' });
      return;
    }

    setLoading(true);
    setToast(null);

    try {
      const poll = await api.createPoll({
        question: question.trim(),
        options: cleanedOptions,
        expirationHours: Number(expirationHours),
      });

      setToast({ message: 'Poll created successfully!', type: 'success' });
      setTimeout(() => {
        navigate(`/poll/${poll.id}/results`);
      }, 800);
    } catch (err) {
      setToast({ message: err.message || 'Failed to create poll', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container main-content" style={{ maxWidth: '1100px' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
        {/* Form Panel */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px var(--primary-glow)'
            }}>
              <Sparkles size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.6rem' }}>Create a New Live Poll</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Formulate your question, define target options, and distribute your link.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Question Input */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HelpCircle size={16} color="var(--primary)" />
                Enter Poll Question
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter poll question..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={250}
                required
              />
            </div>

            {/* Options Section */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Poll Options (2 – 10 options)</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{options.length} of 10</span>
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {options.map((opt, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-glass)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: 'var(--primary)'
                    }}>
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={`Option ${idx + 1}`}
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      required
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="btn btn-danger btn-icon"
                        style={{ borderRadius: 'var(--radius-sm)' }}
                        title="Remove option"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {options.length < 10 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="btn btn-secondary"
                  style={{ marginTop: '12px', alignSelf: 'flex-start', padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  <Plus size={16} />
                  Add Option
                </button>
              )}
            </div>

            {/* Expiration Settings */}
            <div className="form-group" style={{ marginTop: '20px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} color="var(--primary)" />
                Poll Duration Preset
              </label>
              
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {[
                  { label: 'Never Expire', value: 0 },
                  { label: '1 Hour', value: 1 },
                  { label: '24 Hours', value: 24 },
                  { label: '7 Days', value: 168 },
                ].map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setExpirationHours(preset.value)}
                    className={`preset-pill ${Number(expirationHours) === preset.value ? 'active' : ''}`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Action */}
            <div style={{ marginTop: '28px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
              >
                {loading ? 'Publishing Poll...' : (
                  <>
                    <Send size={18} />
                    Publish Live Poll
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview Sidebar */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
            <Eye size={18} color="var(--primary)" />
            Voter Card Live Preview
          </div>

          <div className="glass-panel" style={{ padding: '28px', borderStyle: 'dashed' }}>
            <div className="live-badge" style={{ marginBottom: '14px' }}>
              <span className="pulse-dot"></span>
              LIVE PREVIEW
            </div>

            <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', lineHeight: '1.4' }}>
              {question.trim() || 'Your Question Will Appear Here...'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {options.map((opt, i) => (
                <div
                  key={i}
                  className="vote-option-card"
                  style={{ cursor: 'default' }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    {opt.trim() || `Option ${i + 1}`}
                  </span>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--border-glass)' }}></div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-glass)', fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center' }}>
              {Number(expirationHours) === 0 ? 'Stays open until manually closed' : `Expires in ${expirationHours} hour(s)`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

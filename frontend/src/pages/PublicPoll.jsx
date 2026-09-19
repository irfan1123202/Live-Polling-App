import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { PollWebSocket } from '../services/websocket';
import { LiveResultsChart } from '../components/LiveResultsChart';
import { Toast } from '../components/Toast';
import { Flame, CheckCircle2, AlertTriangle, Vote, Snowflake } from 'lucide-react';

export const PublicPoll = () => {
  const { shareCode } = useParams();
  const [poll, setPoll] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [wsStatus, setWsStatus] = useState('CONNECTING');
  const [toast, setToast] = useState(null);

  // Fetch initial poll data
  useEffect(() => {
    const fetchPoll = async () => {
      setLoading(true);
      setHasVoted(false);
      setSelectedOption(null);
      try {
        const data = await api.getPollByShareCode(shareCode);
        setPoll(data);
        if (data.hasVoted) {
          setHasVoted(true);
        }
      } catch (err) {
        setToast({ message: err.message || 'Poll not found', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchPoll();
  }, [shareCode]);

  // Connect WebSocket for real-time live updates
  useEffect(() => {
    if (!poll?.pollId) return;

    const ws = new PollWebSocket(
      poll.pollId,
      (eventData) => {
        if (eventData.event === 'VOTE_UPDATED' || eventData.options) {
          setPoll(prev => prev ? {
            ...prev,
            options: eventData.options,
            totalVotes: eventData.totalVotes,
          } : prev);
        }
      },
      (status) => setWsStatus(status)
    );

    ws.connect();

    return () => {
      ws.disconnect();
    };
  }, [poll?.pollId]);

  const handleVoteSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOption) {
      setToast({ message: 'Please select an option to vote', type: 'error' });
      return;
    }

    setVoting(true);
    setToast(null);

    try {
      const res = await api.castVote(poll.pollId, selectedOption);
      setPoll(res.results);
      setHasVoted(true);

      // Trigger Confetti Effect
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch (e) {
        // Fallback if confetti fails
      }

      setToast({ message: 'Vote submitted successfully!', type: 'success' });
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('already voted')) {
        setHasVoted(true);
      }
      setToast({ message: err.message || 'Failed to submit vote', type: 'error' });
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <div className="container main-content" style={{ maxWidth: '640px' }}>
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <div className="skeleton" style={{ height: '32px', width: '70%', margin: '0 auto 20px' }}></div>
          <div className="skeleton" style={{ height: '54px', width: '100%', marginBottom: '12px' }}></div>
          <div className="skeleton" style={{ height: '54px', width: '100%', marginBottom: '12px' }}></div>
        </div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="container main-content" style={{ maxWidth: '640px' }}>
        <div className="glass-panel" style={{ padding: '50px 20px', textAlign: 'center' }}>
          <AlertTriangle size={48} color="var(--warning)" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Poll Not Found</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            The requested poll code <code>{shareCode}</code> is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  const isFrozen = poll.status === 'frozen';
  const isClosed = poll.status === 'closed' || poll.isExpired;

  return (
    <div className="container main-content" style={{ maxWidth: '640px' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="glass-panel" style={{ padding: '36px' }}>
        {/* Simple Audience Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            background: 'var(--gradient-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 16px var(--shadow-glow)'
          }}>
            <Flame size={20} color="#fff" fill="#fff" style={{ opacity: 0.95 }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--secondary)', letterSpacing: '0.08em' }}>
              POLLIFY LIVE VOTING
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Anonymous & Real-Time
            </div>
          </div>
        </div>

        {/* Question Title */}
        <h1 style={{ fontSize: '1.65rem', lineHeight: '1.4', marginBottom: '28px', color: 'var(--text-main)', fontWeight: 800 }}>
          {poll.question}
        </h1>

        {/* Voting View vs Frozen Alert vs Post-Vote Confirmation */}
        {isFrozen ? (
          <div style={{
            padding: '28px 20px',
            borderRadius: 'var(--radius-lg)',
            background: 'rgba(6, 182, 212, 0.12)',
            border: '1.5px solid rgba(6, 182, 212, 0.4)',
            textAlign: 'center',
            marginBottom: '28px'
          }}>
            <Snowflake size={48} color="var(--secondary)" style={{ marginBottom: '12px' }} />
            <h2 style={{ fontSize: '1.35rem', color: 'var(--secondary)', marginBottom: '8px', fontWeight: 800 }}>
              Voting Temporarily Frozen
            </h2>
            <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 600 }}>
              This voting is temporary freeze. Try again some time later.
            </p>
          </div>
        ) : !hasVoted && !isClosed ? (
          <form onSubmit={handleVoteSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '32px' }}>
              {poll.options.map((opt) => {
                const isSelected = selectedOption === opt.id;
                return (
                  <div
                    key={opt.id}
                    className={`vote-option-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedOption(opt.id)}
                  >
                    <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {opt.text}
                    </span>
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      border: isSelected ? '6px solid var(--secondary)' : '2px solid var(--border-glass)',
                      boxShadow: isSelected ? '0 0 10px var(--secondary-glow)' : 'none',
                      transition: 'all 0.2s ease',
                      flexShrink: 0
                    }}></div>
                  </div>
                );
              })}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={voting || !selectedOption}
              style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }}
            >
              {voting ? 'Submitting Vote...' : (
                <>
                  <Vote size={20} />
                  Submit My Vote
                </>
              )}
            </button>
          </form>
        ) : (
          <div>
            {hasVoted && (
              <div style={{
                padding: '24px',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                textAlign: 'center',
                marginBottom: '28px'
              }}>
                <CheckCircle2 size={44} color="var(--success)" style={{ marginBottom: '12px' }} />
                <h2 style={{ fontSize: '1.4rem', color: 'var(--success)', marginBottom: '6px', fontWeight: 800 }}>
                  Thank You for Voting!
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '12px' }}>
                  Your response has been counted in real-time.
                </p>
                {!isClosed && (
                  <button
                    type="button"
                    onClick={() => {
                      setHasVoted(false);
                      setSelectedOption(null);
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                  >
                    Cast Another Vote
                  </button>
                )}
              </div>
            )}

            {isClosed && !hasVoted && (
              <div style={{
                padding: '20px',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--danger)',
                fontWeight: 600,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '28px'
              }}>
                <AlertTriangle size={24} />
                <div>
                  <strong style={{ display: 'block', fontSize: '1.05rem' }}>Poll Closed</strong>
                  This poll is closed or expired. Voting is no longer active.
                </div>
              </div>
            )}

            {/* Live Chart Display for Voted Audience */}
            <LiveResultsChart
              options={poll.options}
              totalVotes={poll.totalVotes}
              wsStatus={wsStatus}
            />
          </div>
        )}
      </div>
    </div>
  );
};

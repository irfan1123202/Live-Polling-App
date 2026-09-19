import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, ExternalLink, BarChart3, Trash2, Power, Check, Snowflake, QrCode } from 'lucide-react';
import { PollQRCodeModal } from './PollQRCodeModal';

export const PollCard = ({ poll, onDelete, onToggleStatus, onCopyShareLink }) => {
  const [copied, setCopied] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  const pollId = poll.pollId || poll.id;
  const pollStatus = poll.status || (poll.isActive !== false ? 'active' : 'closed');
  const shareUrl = `${window.location.origin}/poll/${poll.shareCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(poll.shareCode);
    setCopied(true);
    if (onCopyShareLink) onCopyShareLink(poll.shareCode);
    setTimeout(() => setCopied(false), 2000);
  };

  const isActive = pollStatus === 'active' && !poll.isExpired;
  const isFrozen = pollStatus === 'frozen';

  const totalVotes = poll.totalVotes !== undefined
    ? poll.totalVotes
    : (poll.options || []).reduce((sum, o) => sum + (o.votesCount ?? o.votes ?? 0), 0);

  return (
    <div className="glass-panel glass-card-hover" style={{ padding: '24px', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
      <PollQRCodeModal poll={poll} isOpen={showQRModal} onClose={() => setShowQRModal(false)} />

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="live-badge" style={{
              background: isFrozen ? 'rgba(6, 182, 212, 0.15)' : isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
              borderColor: isFrozen ? 'rgba(6, 182, 212, 0.4)' : isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
              color: isFrozen ? 'var(--secondary)' : isActive ? 'var(--success)' : 'var(--danger)'
            }}>
              {isActive && <span className="pulse-dot"></span>}
              {poll.isExpired ? 'EXPIRED' : isFrozen ? '❄️ FROZEN' : pollStatus.toUpperCase()}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              Code: <code style={{ color: 'var(--secondary)', background: 'var(--input-bg)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border-glass)', fontWeight: 700 }}>{poll.shareCode}</code>
            </span>
            <button
              type="button"
              onClick={() => setShowQRModal(true)}
              style={{
                background: 'rgba(6, 182, 212, 0.12)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                borderRadius: '6px',
                color: 'var(--secondary)',
                padding: '3px 8px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s ease'
              }}
              title="View Scan QR Code for this poll"
            >
              <QrCode size={13} />
              Scan Code
            </button>
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700 }}>
            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          </span>
        </div>

        <h3 style={{ fontSize: '1.2rem', lineHeight: '1.4', color: 'var(--text-main)', marginBottom: '16px', fontWeight: 700 }}>
          {poll.question}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(poll.options || []).slice(0, 3).map((opt, idx) => {
            const optVotes = opt.votesCount ?? opt.votes ?? 0;
            const percentage = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
            const colors = ['#06b6d4', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];
            const optColor = colors[idx % colors.length];

            return (
              <div key={opt.id || idx} style={{
                position: 'relative',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-glass)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden'
              }}>
                {/* Background Mini Progress Bar Fill */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${percentage}%`,
                  background: `${optColor}1e`,
                  borderRight: percentage > 0 ? `2px solid ${optColor}` : 'none',
                  transition: 'width 0.4s ease'
                }} />

                <div style={{
                  position: 'relative',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.85rem',
                  color: 'var(--text-main)',
                  zIndex: 1
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: optColor, flexShrink: 0 }}></span>
                    {opt.text}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px', flexShrink: 0 }}>
                    <strong style={{ color: optColor, fontWeight: 800 }}>{percentage}%</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({optVotes})</span>
                  </span>
                </div>
              </div>
            );
          })}
          {(poll.options || []).length > 3 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic', textAlign: 'right' }}>
              +{(poll.options || []).length - 3} more options
            </div>
          )}
        </div>
      </div>

      {/* Action Toolbar */}
      <div style={{
        borderTop: '1px solid var(--border-glass)',
        paddingTop: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {/* Tier 1: Primary Action Buttons */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px'
        }}>
          <button 
            onClick={handleCopy} 
            className="btn btn-secondary" 
            style={{ height: '38px', padding: '0 12px', fontSize: '0.85rem', width: '100%', borderRadius: 'var(--radius-sm)', justifyContent: 'center', fontWeight: 600 }}
            title="Copy Public Vote Link"
          >
            {copied ? <Check size={15} color="var(--success)" /> : <Copy size={15} />}
            {copied ? 'Copied Link' : 'Share Poll'}
          </button>

          <Link 
            to={`/poll/${pollId}/results`} 
            className="btn btn-primary" 
            style={{ height: '38px', padding: '0 12px', fontSize: '0.85rem', width: '100%', borderRadius: 'var(--radius-sm)', justifyContent: 'center', fontWeight: 600 }} 
            title="View Live Results Dashboard"
          >
            <BarChart3 size={15} />
            Live Results
          </Link>
        </div>

        {/* Tier 2: Utility & Controls Toolbar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          alignItems: 'center'
        }}>
          <Link 
            to={`/poll/${poll.shareCode}`} 
            className="btn btn-secondary btn-icon" 
            style={{ height: '36px', width: '100%', padding: 0, borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} 
            title="Open Public Voting Page"
          >
            <ExternalLink size={15} />
          </Link>

          {/* Freeze / Unfreeze Button */}
          <button 
            onClick={() => onToggleStatus(pollId, isFrozen ? 'active' : 'frozen')}
            className="btn btn-secondary btn-icon" 
            style={{
              height: '36px',
              width: '100%',
              padding: 0,
              borderRadius: 'var(--radius-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isFrozen ? 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)' : 'rgba(148, 163, 184, 0.12)',
              border: isFrozen ? '1px solid #38bdf8' : '1px solid var(--border-glass)',
              boxShadow: isFrozen ? '0 0 14px rgba(6, 182, 212, 0.5)' : 'none',
              transition: 'all 0.25s ease'
            }} 
            title={isFrozen ? 'Unfreeze Voting (Resume Normal Mode)' : 'Freeze Voting (Pause Temporarily)'}
          >
            <Snowflake size={16} color={isFrozen ? '#ffffff' : 'var(--secondary)'} />
          </button>

          {/* Activate / Close Poll Button */}
          <button 
            onClick={() => onToggleStatus(pollId, pollStatus === 'active' ? 'closed' : 'active')}
            className="btn btn-secondary btn-icon" 
            style={{ height: '36px', width: '100%', padding: 0, borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} 
            title={pollStatus === 'active' ? 'Close Poll (Stop Acceptance)' : 'Activate Poll (Accept Votes)'}
          >
            <Power size={15} color={pollStatus === 'active' ? 'var(--warning)' : 'var(--success)'} />
          </button>

          {/* Delete Poll Button */}
          <button 
            onClick={() => onDelete(pollId)} 
            className="btn btn-danger btn-icon" 
            style={{
              height: '36px',
              width: '100%',
              padding: 0,
              borderRadius: 'var(--radius-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }} 
            title="Delete Poll Permanently"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};


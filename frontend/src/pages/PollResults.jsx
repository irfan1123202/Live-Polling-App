import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { api } from '../services/api';
import { PollWebSocket } from '../services/websocket';
import { LiveResultsChart } from '../components/LiveResultsChart';
import { Toast } from '../components/Toast';
import { Copy, ExternalLink, ArrowLeft, Check, Download, QrCode } from 'lucide-react';

export const PollResults = () => {
  const { id } = useParams();
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState('CONNECTING');
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const data = await api.getPollResults(id);
        setPoll(data);
      } catch (err) {
        setToast({ message: err.message || 'Failed to load poll results', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const ws = new PollWebSocket(
      id,
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
  }, [id]);

  // Generate QR code client-side reliably with network IP support for mobile scanning
  useEffect(() => {
    if (poll?.shareCode) {
      let host = window.location.host;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const port = window.location.port ? `:${window.location.port}` : '';
        host = `10.175.248.12${port}`;
      }
      const voteUrl = `${window.location.protocol}//${host}/poll/${poll.shareCode}`;

      QRCode.toDataURL(voteUrl, {
        margin: 1,
        width: 280,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
        .then(url => setQrDataUrl(url))
        .catch(err => {
          console.error('QR code generation failed:', err);
          setQrDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(voteUrl)}`);
        });
    }
  }, [poll?.shareCode]);

  const handleCopyLink = () => {
    if (!poll?.shareCode) return;
    navigator.clipboard.writeText(poll.shareCode);
    setCopied(true);
    setToast({ message: `Poll code "${poll.shareCode}" copied to clipboard!`, type: 'success' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCSV = () => {
    if (!poll || !poll.options) return;
    const headers = ['Option ID', 'Option Text', 'Votes Count', 'Percentage'];
    const rows = poll.options.map(opt => {
      const percentage = poll.totalVotes > 0 ? ((opt.votesCount / poll.totalVotes) * 100).toFixed(1) : '0';
      return [
        `"${opt.id}"`,
        `"${opt.text.replace(/"/g, '""')}"`,
        opt.votesCount,
        `"${percentage}%"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pollify_results_${poll.shareCode || id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ message: 'Poll results exported to CSV!', type: 'success' });
  };

  if (loading) {
    return (
      <div className="container main-content" style={{ maxWidth: '840px' }}>
        <div className="glass-panel" style={{ padding: '40px' }}>
          <div className="skeleton" style={{ height: '36px', width: '60%', marginBottom: '24px' }}></div>
          <div className="skeleton" style={{ height: '220px', width: '100%' }}></div>
        </div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="container main-content" style={{ maxWidth: '640px', textAlign: 'center' }}>
        <div className="glass-panel" style={{ padding: '50px 20px' }}>
          <h2>Poll Results Not Available</h2>
          <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: '16px' }}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container main-content" style={{ maxWidth: '840px' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ marginBottom: '20px' }}>
        <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>

      <div className="glass-panel" style={{ padding: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="live-badge">
                <span className="pulse-dot"></span>
                LIVE RESULTS DASHBOARD
              </span>
            </div>
            <h1 style={{ fontSize: '1.8rem', color: 'var(--text-main)', lineHeight: '1.3', fontWeight: 800 }}>
              {poll.question}
            </h1>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            maxWidth: '480px'
          }}>
            <button
              onClick={handleExportCSV}
              className="btn btn-secondary"
              title="Export Results to CSV"
              style={{ padding: '10px 14px', fontSize: '0.85rem', width: '100%', justifyContent: 'center' }}
            >
              <Download size={16} />
              Export CSV
            </button>
            <button
              onClick={handleCopyLink}
              className="btn btn-secondary"
              style={{ padding: '10px 14px', fontSize: '0.85rem', width: '100%', justifyContent: 'center' }}
            >
              {copied ? <Check size={16} color="var(--success)" /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Share Link'}
            </button>
            <Link
              to={`/poll/${poll.shareCode}`}
              className="btn btn-secondary"
              target="_blank"
              style={{ padding: '10px 14px', fontSize: '0.85rem', width: '100%', justifyContent: 'center' }}
            >
              <ExternalLink size={16} />
              Visit Vote
            </Link>
          </div>
        </div>

        <LiveResultsChart
          options={poll.options}
          totalVotes={poll.totalVotes}
          wsStatus={wsStatus}
        />

        {/* Scan Bar & Share Code Card */}
        <div style={{
          marginTop: '36px',
          padding: '24px',
          background: 'var(--input-bg)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
        }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <QrCode size={20} color="var(--secondary)" />
              Share Code & QR Scan Card
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '400px' }}>
              Audience members can enter this code or scan the QR code to open the voting interface instantly.
            </p>
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '1.8rem',
                fontWeight: 900,
                letterSpacing: '4px',
                color: 'var(--secondary)',
                background: 'rgba(6, 182, 212, 0.12)',
                border: '2px dashed var(--secondary)',
                padding: '8px 20px',
                borderRadius: 'var(--radius-md)'
              }}>
                {poll.shareCode}
              </span>
              <button onClick={handleCopyLink} className="btn btn-secondary" style={{ padding: '10px 16px', fontSize: '0.85rem' }}>
                {copied ? <Check size={16} color="var(--success)" /> : <Copy size={16} />}
                {copied ? 'Code Copied' : 'Copy Code'}
              </button>
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: '12px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', textAlign: 'center', margin: '0 auto' }}>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Scan QR Code to Vote"
                style={{ width: '150px', height: '150px', display: 'block', borderRadius: '8px' }}
              />
            ) : (
              <div style={{ width: '150px', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>
                Generating QR...
              </div>
            )}
            <span style={{ fontSize: '0.725rem', fontWeight: 800, color: '#0f172a', marginTop: '8px', display: 'block', letterSpacing: '0.05em' }}>
              📱 SCAN TO VOTE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

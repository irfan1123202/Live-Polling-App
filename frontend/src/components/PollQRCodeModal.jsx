import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Download, Check, QrCode } from 'lucide-react';

export const PollQRCodeModal = ({ poll, isOpen, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!poll || !isOpen) return;

    let host = window.location.host;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      const port = window.location.port ? `:${window.location.port}` : '';
      host = `10.175.248.12${port}`;
    }
    const voteUrl = `${window.location.protocol}//${host}/poll/${poll.shareCode}`;

    QRCode.toDataURL(voteUrl, {
      margin: 1,
      width: 300,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then(url => setQrDataUrl(url))
      .catch(err => {
        console.error('Failed to generate QR:', err);
        setQrDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(voteUrl)}`);
      });
  }, [poll, isOpen]);

  if (!isOpen || !poll) return null;

  const voteUrl = `${window.location.origin}/poll/${poll.shareCode}`;

  const handleCopyLink = () => {
    if (!poll?.shareCode) return;
    navigator.clipboard.writeText(poll.shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `poll_qr_${poll.shareCode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      animation: 'slideUp 0.25s ease-out'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '28px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-glass-bright)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        position: 'relative',
        background: 'var(--card-bg)',
        textAlign: 'center'
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'var(--gradient-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}>
              <QrCode size={20} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Poll QR & Scan Code
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Scan with phone camera to vote live
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary btn-icon"
            style={{ borderRadius: '50%', padding: '8px', width: '36px', height: '36px', justifyContent: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Poll Question summary */}
        <div style={{
          fontSize: '0.95rem',
          fontWeight: 700,
          color: 'var(--text-main)',
          marginBottom: '16px',
          background: 'var(--input-bg)',
          padding: '12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-glass)',
          wordBreak: 'break-word'
        }}>
          "{poll.question}"
        </div>

        {/* Big Code display */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700 }}>
            SHARE CODE
          </div>
          <span style={{
            fontSize: '1.8rem',
            fontWeight: 900,
            letterSpacing: '4px',
            color: 'var(--secondary)',
            background: 'rgba(6, 182, 212, 0.12)',
            border: '2px dashed var(--secondary)',
            padding: '6px 20px',
            borderRadius: 'var(--radius-md)',
            display: 'inline-block'
          }}>
            {poll.shareCode}
          </span>
        </div>

        {/* QR Code Container */}
        <div style={{
          background: '#ffffff',
          padding: '16px',
          borderRadius: '16px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          display: 'inline-block',
          marginBottom: '24px'
        }}>
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Code for poll ${poll.shareCode}`}
              style={{ width: '200px', height: '200px', display: 'block', borderRadius: '8px' }}
            />
          ) : (
            <div style={{ width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.85rem' }}>
              Generating QR Code...
            </div>
          )}
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', marginTop: '8px', display: 'block', letterSpacing: '0.05em' }}>
            📱 SCAN TO VOTE INSTANTLY
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button onClick={handleDownloadQR} className="btn btn-secondary" style={{ padding: '10px', fontSize: '0.85rem', justifyContent: 'center' }}>
            <Download size={16} />
            Download QR
          </button>
          <button onClick={handleCopyLink} className="btn btn-primary" style={{ padding: '10px', fontSize: '0.85rem', justifyContent: 'center' }}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Code Copied' : 'Copy Code'}
          </button>
        </div>
      </div>
    </div>
  );
};

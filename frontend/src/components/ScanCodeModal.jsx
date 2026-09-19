import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Camera, X, ArrowRight, AlertCircle, QrCode, Sparkles } from 'lucide-react';

export const ScanCodeModal = ({ isOpen, onClose, setToast }) => {
  const navigate = useNavigate();
  const [manualCode, setManualCode] = useState('');
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    let scanner = null;

    const timer = setTimeout(() => {
      try {
        scanner = new Html5QrcodeScanner(
          'qr-code-reader-element',
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
            rememberLastUsedCamera: true,
          },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            handleCodeFound(decodedText);
            if (scanner) {
              scanner.clear().catch(() => {});
            }
          },
          (err) => {
            // ignore scan frame errors
          }
        );

        scannerRef.current = scanner;
      } catch (err) {
        console.error('Failed to initialize QR scanner:', err);
        setError('Camera permission needed or camera unavailable. You can enter the poll code manually below.');
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  const handleCodeFound = (text) => {
    if (!text) return;
    let code = text.trim();
    // Parse full URLs if scanned (e.g., http://localhost:5173/poll/50B851 or https://.../poll/ABC123)
    const urlMatch = code.match(/\/poll\/([A-Za-z0-9]+)/i);
    if (urlMatch && urlMatch[1]) {
      code = urlMatch[1];
    }
    code = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    if (code) {
      if (onClose) onClose();
      if (setToast) {
        setToast({ message: `Scanned code ${code}! Redirecting to poll...`, type: 'success' });
      }
      navigate(`/poll/${code}`);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleCodeFound(manualCode);
  };

  if (!isOpen) return null;

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
      animation: 'slideUp 0.3s ease-out'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '480px',
        padding: '28px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-glass-bright)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        position: 'relative',
        background: 'var(--card-bg)'
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '14px',
              background: 'var(--gradient-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 0 16px var(--shadow-glow)'
            }}>
              <Camera size={22} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Scan Poll QR Code
                <Sparkles size={16} color="var(--secondary)" />
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Point camera at audience QR code or enter code below
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary btn-icon"
            style={{ borderRadius: '50%', padding: '8px', width: '36px', height: '36px', justifyContent: 'center' }}
            title="Close Scanner"
          >
            <X size={18} />
          </button>
        </div>

        {/* Camera Viewport Container */}
        <div className="html5-qr-scanner-wrapper" style={{
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          marginBottom: '20px',
          border: '1px dashed var(--secondary)',
          minHeight: '260px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}>
          <div id="qr-code-reader-element" style={{ width: '100%' }}></div>
          {error && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#f87171', fontSize: '0.875rem' }}>
              <AlertCircle size={32} color="#f87171" style={{ marginBottom: '10px' }} />
              <div>{error}</div>
            </div>
          )}
        </div>

        {/* Manual Fallback Input */}
        <form onSubmit={handleManualSubmit}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <QrCode size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--secondary)' }} />
              <input
                type="text"
                placeholder="Or enter Share Code (e.g. 50B851)"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                className="form-input"
                maxLength={12}
                style={{
                  paddingLeft: '40px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 700,
                  fontSize: '0.95rem'
                }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!manualCode.trim()}
              style={{ padding: '10px 20px', flexShrink: 0 }}
            >
              <ArrowRight size={18} />
              Join
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

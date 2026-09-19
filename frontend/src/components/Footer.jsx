import React from 'react';
import { Flame } from 'lucide-react';

export const Footer = () => {
  return (
    <footer style={{
      borderTop: '1px solid var(--border-glass)',
      padding: '20px 0',
      background: 'var(--header-bg)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      fontSize: '0.85rem',
      color: 'var(--text-muted)',
      transition: 'background-color 0.3s ease, border-color 0.3s ease',
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      }}>
        <Flame size={16} color="var(--secondary)" fill="var(--secondary)" style={{ opacity: 0.9 }} />
        <span><strong>Pollify</strong> &bull; Real-Time Polling Platform</span>
      </div>
    </footer>
  );
};

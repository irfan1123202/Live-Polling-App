import React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export const Toast = ({ message, type = 'info', onClose }) => {
  if (!message) return null;

  const isSuccess = type === 'success';
  const isError = type === 'error';

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '14px 20px',
      borderRadius: '12px',
      background: isSuccess 
        ? 'rgba(16, 185, 129, 0.15)' 
        : isError 
        ? 'rgba(239, 68, 68, 0.15)' 
        : 'rgba(99, 102, 241, 0.15)',
      border: `1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.4)' : isError ? 'rgba(239, 68, 68, 0.4)' : 'rgba(99, 102, 241, 0.4)'}`,
      backdropFilter: 'blur(16px)',
      color: isSuccess ? '#34d399' : isError ? '#fca5a5' : '#a5b4fc',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      animation: 'slideUp 0.3s ease-out'
    }}>
      {isSuccess ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{message}</span>
      {onClose && (
        <button 
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'currentColor', cursor: 'pointer', display: 'flex' }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

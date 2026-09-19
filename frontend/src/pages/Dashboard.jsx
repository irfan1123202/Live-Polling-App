import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { PollCard } from '../components/PollCard';
import { Toast } from '../components/Toast';
import { PlusCircle, BarChart2, CheckCircle, Vote, RefreshCw, Search, Filter } from 'lucide-react';

export const Dashboard = () => {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchPolls = async () => {
    setLoading(true);
    try {
      const data = await api.getUserPolls();
      setPolls(data);
    } catch (err) {
      setToast({ message: err.message || 'Failed to fetch polls', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolls();
  }, []);

  const handleDelete = async (pollId) => {
    if (!window.confirm('Are you sure you want to delete this poll? This action cannot be undone.')) {
      return;
    }

    try {
      await api.deletePoll(pollId);
      setPolls(polls.filter(p => p.pollId !== pollId));
      setToast({ message: 'Poll deleted successfully', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete poll', type: 'error' });
    }
  };

  const handleToggleStatus = async (pollId, targetStatus) => {
    try {
      await api.togglePollStatus(pollId, targetStatus);
      setPolls(polls.map(p => p.pollId === pollId ? { ...p, status: targetStatus } : p));
      
      if (targetStatus === 'frozen') {
        setToast({ message: 'Freeze activated! Voting is temporarily paused for audience.', type: 'info' });
      } else if (targetStatus === 'active') {
        setToast({ message: 'Freeze deactivated! Voting has resumed normally.', type: 'success' });
      } else {
        setToast({ message: `Poll status updated to ${targetStatus}`, type: 'success' });
      }
    } catch (err) {
      setToast({ message: err.message || 'Failed to update status', type: 'error' });
    }
  };

  const totalVotesCast = polls.reduce((acc, p) => acc + (p.totalVotes || 0), 0);
  const activePollsCount = polls.filter(p => p.status === 'active' && !p.isExpired).length;

  const filteredPolls = polls.filter((poll) => {
    const matchesSearch = poll.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          poll.shareCode.toLowerCase().includes(searchQuery.toLowerCase());
    const isActive = poll.status === 'active' && !poll.isExpired;
    if (statusFilter === 'active') return matchesSearch && isActive;
    if (statusFilter === 'closed') return matchesSearch && !isActive;
    return matchesSearch;
  });

  return (
    <div className="container main-content">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '6px' }}>My Live Polls</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Manage your questions, share codes, and monitor live audience responses in real-time.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={fetchPolls} className="btn btn-secondary btn-icon" title="Refresh Polls">
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
          </button>
          <Link to="/create-poll" className="btn btn-primary">
            <PlusCircle size={18} />
            Create New Poll
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        <div className="glass-panel glass-card-hover" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <Vote size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Polls</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>{polls.length}</div>
          </div>
        </div>

        <div className="glass-panel glass-card-hover" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Polls</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>{activePollsCount}</div>
          </div>
        </div>

        <div className="glass-panel glass-card-hover" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(236, 72, 153, 0.15)', border: '1px solid rgba(236, 72, 153, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
            <BarChart2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Audience Votes</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>{totalVotesCast}</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      {polls.length > 0 && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type="text"
              placeholder="Search polls by question or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '40px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Filter size={16} color="var(--text-dim)" />
            {['all', 'active', 'closed'].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`preset-pill ${statusFilter === filter ? 'active' : ''}`}
                style={{ textTransform: 'capitalize' }}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Poll Cards List */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {[1, 2, 3].map(n => (
            <div key={n} className="glass-panel" style={{ height: '220px', padding: '24px' }}>
              <div className="skeleton" style={{ height: '24px', width: '60%', marginBottom: '16px' }}></div>
              <div className="skeleton" style={{ height: '32px', width: '90%', marginBottom: '24px' }}></div>
              <div className="skeleton" style={{ height: '40px', width: '100%' }}></div>
            </div>
          ))}
        </div>
      ) : polls.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <Vote size={48} color="var(--primary)" style={{ marginBottom: '16px', opacity: 0.7 }} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>No Polls Created Yet</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 24px' }}>
            Get started by creating your first interactive question and share it with your audience!
          </p>
          <Link to="/create-poll" className="btn btn-primary">
            <PlusCircle size={18} />
            Create Your First Poll
          </Link>
        </div>
      ) : filteredPolls.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>No polls match your search criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {filteredPolls.map((poll) => (
            <PollCard
              key={poll.pollId}
              poll={poll}
              onDelete={handleDelete}
              onToggleStatus={handleToggleStatus}
              onCopyShareLink={(code) => setToast({ message: `Poll code "${code || ''}" copied to clipboard!`, type: 'success' })}
            />
          ))}
        </div>
      )}
    </div>
  );
};


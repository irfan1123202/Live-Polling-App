const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getVoterToken() {
  let voterToken = localStorage.getItem('pollify_voter_token');
  if (!voterToken) {
    voterToken = 'voter_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem('pollify_voter_token', voterToken);
  }
  return voterToken;
}

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    'X-Voter-Token': getVoterToken(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  signup: (userData) => request('/auth/signup', { method: 'POST', body: JSON.stringify(userData) }),
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  resetPassword: (data) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/auth/me'),

  // Polls
  createPoll: (pollData) => request('/polls', { method: 'POST', body: JSON.stringify(pollData) }),
  getUserPolls: () => request('/polls'),
  getPollById: (id) => request(`/polls/${id}`),
  getPollByShareCode: (code) => request(`/polls/share/${code}`),
  deletePoll: (id) => request(`/polls/${id}`, { method: 'DELETE' }),
  togglePollStatus: (id, status) => request(`/polls/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Voting
  castVote: (pollId, optionId) => request(`/polls/${pollId}/vote`, { method: 'POST', body: JSON.stringify({ optionId }) }),
  getPollResults: (pollId) => request(`/polls/${pollId}/results`),
};

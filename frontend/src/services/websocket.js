const getWSUrl = (pollId) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  let host = import.meta.env.VITE_WS_HOST;
  if (!host || host === 'localhost:8080') {
    host = window.location.host;
  }
  return `${protocol}//${host}/api/polls/${pollId}/live`;
};

export class PollWebSocket {
  constructor(pollId, onMessage, onStatusChange) {
    this.pollId = pollId;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
    this.ws = null;
    this.reconnectTimer = null;
    this.isClosedManually = false;
  }

  connect() {
    if (!this.pollId) return;

    this.isClosedManually = false;
    const url = getWSUrl(this.pollId);
    
    if (this.onStatusChange) this.onStatusChange('CONNECTING');

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        if (this.onStatusChange) this.onStatusChange('CONNECTED');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (this.onMessage) {
            this.onMessage(data);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
      };

      this.ws.onclose = () => {
        if (this.onStatusChange) this.onStatusChange('DISCONNECTED');
        if (!this.isClosedManually) {
          // Attempt reconnect in 3 seconds
          this.reconnectTimer = setTimeout(() => {
            this.connect();
          }, 3000);
        }
      };
    } catch (err) {
      console.error('WebSocket connection setup error:', err);
      if (this.onStatusChange) this.onStatusChange('DISCONNECTED');
    }
  }

  disconnect() {
    this.isClosedManually = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

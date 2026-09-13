class SpaceWebSocketService {
  constructor() {
    this.ws = null;
    this.url = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WS_URL)
      ? import.meta.env.VITE_WS_URL
      : 'ws://localhost:8000/ws/alerts';
    this.listeners = [];
    this.statusListeners = [];
    this.reconnectTimer = null;
    this.isConnected = false;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.notifyStatus('connected');
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.listeners.forEach((callback) => callback(data));
        } catch (e) {
          console.error('Failed parsing WebSocket message:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyStatus('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.isConnected = false;
        this.notifyStatus('error');
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 5000);
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  onStatusChange(callback) {
    this.statusListeners.push(callback);
    callback(this.isConnected ? 'connected' : 'disconnected');
    return () => {
      this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
    };
  }

  notifyStatus(status) {
    this.statusListeners.forEach((cb) => cb(status));
  }
}

export const spaceWS = new SpaceWebSocketService();

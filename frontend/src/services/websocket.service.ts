export class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private subscriptions = new Map<string, Set<Function>>();
  
  connect(token: string): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    this.socket = new WebSocket(wsUrl);
    
    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      
      // Authenticate
      this.send('auth', { token });
    };
    
    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    this.socket.onclose = () => {
      console.log('WebSocket disconnected');
      this.attemptReconnect(token);
    };
    
    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
  
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.subscriptions.clear();
    this.reconnectAttempts = 0;
  }
  
  private handleMessage(message: any): void {
    const { type, data } = message;
    
    // Notify all subscribers for this message type
    const subscribers = this.subscriptions.get(type);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket subscriber for ${type}:`, error);
        }
      });
    }
  }
  
  subscribe(type: string, callback: Function): () => void {
    if (!this.subscriptions.has(type)) {
      this.subscriptions.set(type, new Set());
    }
    
    this.subscriptions.get(type)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(type);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscriptions.delete(type);
        }
      }
    };
  }
  
  send(type: string, data: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, data }));
    } else {
      console.warn('WebSocket is not connected. Unable to send message.');
    }
  }
  
  private attemptReconnect(token: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      setTimeout(() => {
        console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        const currentToken = localStorage.getItem('access_token');
        if (currentToken) {
          this.connect(currentToken);
        }
      }, delay);
    } else {
      console.error('Max reconnection attempts reached. WebSocket connection failed.');
    }
  }
  
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
export const websocketService = new WebSocketService();
import { WebSocketService } from '../websocket.service';

// Mock WebSocket
class MockWebSocket {
  readyState: number = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  
  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 0);
  }
  
  send(data: string) {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }
  
  close() {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
}

global.WebSocket = MockWebSocket as any;

describe('WebSocketService', () => {
  let service: WebSocketService;
  let mockLocalStorage: { [key: string]: string } = {};
  
  beforeEach(() => {
    service = new WebSocketService();
    jest.clearAllMocks();
    mockLocalStorage = {};
    
    Storage.prototype.getItem = jest.fn((key) => mockLocalStorage[key] || null);
    Storage.prototype.setItem = jest.fn((key, value) => {
      mockLocalStorage[key] = value;
    });
    
    // Reset console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });
  
  afterEach(() => {
    service.disconnect();
    jest.clearAllTimers();
  });
  
  describe('Connection Management', () => {
    test('should establish WebSocket connection with correct URL', () => {
      const token = 'test-token-123';
      service.connect(token);
      
      expect(service.isConnected()).toBe(false); // Not yet connected
      
      // Wait for async connection
      return new Promise(resolve => {
        setTimeout(() => {
          expect(service.isConnected()).toBe(true);
          resolve(undefined);
        }, 10);
      });
    });
    
    test('should authenticate after connection', (done) => {
      const token = 'test-token-123';
      const sendSpy = jest.spyOn(service, 'send');
      
      service.connect(token);
      
      setTimeout(() => {
        expect(sendSpy).toHaveBeenCalledWith('auth', { token });
        done();
      }, 10);
    });
    
    test('should handle connection errors gracefully', () => {
      const token = 'test-token-123';
      service.connect(token);
      
      const ws = (service as any).socket as MockWebSocket;
      ws.onerror?.(new Event('error'));
      
      expect(console.error).toHaveBeenCalledWith('WebSocket error:', expect.any(Event));
    });
    
    test('should disconnect and clear subscriptions', () => {
      const token = 'test-token-123';
      const callback = jest.fn();
      
      service.connect(token);
      service.subscribe('test-event', callback);
      
      service.disconnect();
      
      expect(service.isConnected()).toBe(false);
      expect((service as any).subscriptions.size).toBe(0);
    });
  });
  
  describe('Message Handling', () => {
    test('should parse and handle valid JSON messages', (done) => {
      const token = 'test-token-123';
      const callback = jest.fn();
      
      service.connect(token);
      service.subscribe('user:update', callback);
      
      setTimeout(() => {
        const ws = (service as any).socket as MockWebSocket;
        const testData = { id: 1, name: 'Test User' };
        
        ws.onmessage?.(new MessageEvent('message', {
          data: JSON.stringify({ type: 'user:update', data: testData })
        }));
        
        expect(callback).toHaveBeenCalledWith(testData);
        done();
      }, 10);
    });
    
    test('should handle malformed JSON gracefully', (done) => {
      const token = 'test-token-123';
      service.connect(token);
      
      setTimeout(() => {
        const ws = (service as any).socket as MockWebSocket;
        
        ws.onmessage?.(new MessageEvent('message', {
          data: 'invalid json {'
        }));
        
        expect(console.error).toHaveBeenCalledWith(
          'Failed to parse WebSocket message:',
          expect.any(Error)
        );
        done();
      }, 10);
    });
    
    test('should not crash when subscriber throws error', (done) => {
      const token = 'test-token-123';
      const errorCallback = jest.fn(() => {
        throw new Error('Subscriber error');
      });
      const normalCallback = jest.fn();
      
      service.connect(token);
      service.subscribe('test-event', errorCallback);
      service.subscribe('test-event', normalCallback);
      
      setTimeout(() => {
        const ws = (service as any).socket as MockWebSocket;
        
        ws.onmessage?.(new MessageEvent('message', {
          data: JSON.stringify({ type: 'test-event', data: { test: true } })
        }));
        
        expect(errorCallback).toHaveBeenCalled();
        expect(normalCallback).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith(
          'Error in WebSocket subscriber for test-event:',
          expect.any(Error)
        );
        done();
      }, 10);
    });
  });
  
  describe('Subscription Management', () => {
    test('should allow multiple subscribers for same event', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      service.subscribe('test-event', callback1);
      service.subscribe('test-event', callback2);
      
      const subscribers = (service as any).subscriptions.get('test-event');
      expect(subscribers?.size).toBe(2);
    });
    
    test('should unsubscribe correctly', () => {
      const callback = jest.fn();
      const unsubscribe = service.subscribe('test-event', callback);
      
      expect((service as any).subscriptions.get('test-event')?.size).toBe(1);
      
      unsubscribe();
      
      expect((service as any).subscriptions.has('test-event')).toBe(false);
    });
    
    test('should handle unsubscribe for non-existent subscription', () => {
      const callback = jest.fn();
      const unsubscribe = service.subscribe('test-event', callback);
      
      unsubscribe();
      unsubscribe(); // Second call should not throw
      
      expect((service as any).subscriptions.has('test-event')).toBe(false);
    });
  });
  
  describe('Reconnection Logic', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    
    afterEach(() => {
      jest.useRealTimers();
    });
    
    test('should attempt reconnection with exponential backoff', () => {
      const token = 'test-token-123';
      mockLocalStorage['access_token'] = token;
      
      service.connect(token);
      const connectSpy = jest.spyOn(service, 'connect');
      
      // Simulate connection close
      const ws = (service as any).socket as MockWebSocket;
      ws.close();
      
      // First reconnect attempt (1 second)
      jest.advanceTimersByTime(1000);
      expect(connectSpy).toHaveBeenCalledTimes(2);
      
      // Simulate another close
      ws.close();
      
      // Second reconnect attempt (2 seconds)
      jest.advanceTimersByTime(2000);
      expect(connectSpy).toHaveBeenCalledTimes(3);
    });
    
    test('should stop reconnecting after max attempts', () => {
      const token = 'test-token-123';
      mockLocalStorage['access_token'] = token;
      
      service.connect(token);
      const connectSpy = jest.spyOn(service, 'connect');
      
      // Simulate multiple connection failures
      for (let i = 0; i < 5; i++) {
        const ws = (service as any).socket as MockWebSocket;
        ws.close();
        jest.advanceTimersByTime(30000); // Max delay
      }
      
      // Should have attempted max reconnects + 1 initial
      expect(connectSpy).toHaveBeenCalledTimes(6);
      
      // Simulate one more close - should not reconnect
      const ws = (service as any).socket as MockWebSocket;
      ws.close();
      jest.advanceTimersByTime(30000);
      
      expect(connectSpy).toHaveBeenCalledTimes(6); // No additional attempt
      expect(console.error).toHaveBeenCalledWith(
        'Max reconnection attempts reached. WebSocket connection failed.'
      );
    });
    
    test('should not reconnect if no token available', () => {
      const token = 'test-token-123';
      service.connect(token);
      
      // Remove token from storage
      delete mockLocalStorage['access_token'];
      
      const connectSpy = jest.spyOn(service, 'connect');
      
      // Simulate connection close
      const ws = (service as any).socket as MockWebSocket;
      ws.close();
      
      jest.advanceTimersByTime(1000);
      
      // Should not attempt reconnect without token
      expect(connectSpy).not.toHaveBeenCalled();
    });
    
    test('should reset reconnection attempts on successful connection', () => {
      const token = 'test-token-123';
      mockLocalStorage['access_token'] = token;
      
      service.connect(token);
      
      // Set reconnect attempts to simulate previous failures
      (service as any).reconnectAttempts = 3;
      
      // Trigger successful connection
      const ws = (service as any).socket as MockWebSocket;
      ws.onopen?.(new Event('open'));
      
      expect((service as any).reconnectAttempts).toBe(0);
    });
  });
  
  describe('Send Functionality', () => {
    test('should send message when connected', (done) => {
      const token = 'test-token-123';
      service.connect(token);
      
      setTimeout(() => {
        const ws = (service as any).socket as MockWebSocket;
        const sendSpy = jest.spyOn(ws, 'send');
        
        service.send('test-message', { data: 'test' });
        
        expect(sendSpy).toHaveBeenCalledWith(
          JSON.stringify({ type: 'test-message', data: { data: 'test' } })
        );
        done();
      }, 10);
    });
    
    test('should warn when trying to send while disconnected', () => {
      service.send('test-message', { data: 'test' });
      
      expect(console.warn).toHaveBeenCalledWith(
        'WebSocket is not connected. Unable to send message.'
      );
    });
    
    test('should handle send errors gracefully', (done) => {
      const token = 'test-token-123';
      service.connect(token);
      
      setTimeout(() => {
        const ws = (service as any).socket as MockWebSocket;
        ws.readyState = WebSocket.CLOSED;
        
        service.send('test-message', { data: 'test' });
        
        expect(console.warn).toHaveBeenCalledWith(
          'WebSocket is not connected. Unable to send message.'
        );
        done();
      }, 10);
    });
  });
  
  describe('Edge Cases', () => {
    test('should handle rapid connect/disconnect cycles', () => {
      const token = 'test-token-123';
      
      for (let i = 0; i < 10; i++) {
        service.connect(token);
        service.disconnect();
      }
      
      expect(service.isConnected()).toBe(false);
      expect((service as any).subscriptions.size).toBe(0);
    });
    
    test('should handle duplicate subscriptions from same callback', () => {
      const callback = jest.fn();
      
      service.subscribe('test-event', callback);
      service.subscribe('test-event', callback);
      
      const subscribers = (service as any).subscriptions.get('test-event');
      expect(subscribers?.size).toBe(2); // Set allows duplicates
    });
    
    test('should maintain subscriptions across reconnections', (done) => {
      const token = 'test-token-123';
      mockLocalStorage['access_token'] = token;
      const callback = jest.fn();
      
      service.connect(token);
      service.subscribe('test-event', callback);
      
      setTimeout(() => {
        // Simulate disconnect and reconnect
        const ws = (service as any).socket as MockWebSocket;
        ws.close();
        
        // Subscriptions should persist
        expect((service as any).subscriptions.get('test-event')?.size).toBe(1);
        done();
      }, 10);
    });
  });
  
  describe('Memory Leak Prevention', () => {
    test('should clean up all resources on disconnect', () => {
      const token = 'test-token-123';
      const callbacks = Array.from({ length: 100 }, () => jest.fn());
      
      service.connect(token);
      
      // Create many subscriptions
      callbacks.forEach((cb, i) => {
        service.subscribe(`event-${i}`, cb);
      });
      
      expect((service as any).subscriptions.size).toBe(100);
      
      service.disconnect();
      
      expect((service as any).subscriptions.size).toBe(0);
      expect((service as any).socket).toBeNull();
      expect((service as any).reconnectAttempts).toBe(0);
    });
    
    test('should prevent memory leaks from unsubscribed callbacks', () => {
      const callbacks = Array.from({ length: 100 }, () => jest.fn());
      const unsubscribes: (() => void)[] = [];
      
      // Subscribe many callbacks
      callbacks.forEach((cb) => {
        unsubscribes.push(service.subscribe('test-event', cb));
      });
      
      expect((service as any).subscriptions.get('test-event')?.size).toBe(100);
      
      // Unsubscribe all
      unsubscribes.forEach(unsub => unsub());
      
      expect((service as any).subscriptions.has('test-event')).toBe(false);
    });
  });
});
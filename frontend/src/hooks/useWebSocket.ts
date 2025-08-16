import { useEffect, useRef } from 'react';
import { websocketService } from '@/services/websocket.service';

export const useWebSocket = (type: string, callback: (data: any) => void) => {
  const callbackRef = useRef(callback);
  
  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  useEffect(() => {
    // Create a stable callback that uses the ref
    const stableCallback = (data: any) => {
      callbackRef.current(data);
    };
    
    const unsubscribe = websocketService.subscribe(type, stableCallback);
    
    return () => {
      unsubscribe();
    };
  }, [type]);
  
  return websocketService;
};
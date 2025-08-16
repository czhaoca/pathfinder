import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  endTime: Date;
  onComplete?: () => void;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ endTime, onComplete }) => {
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  
  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      const difference = end - now;
      
      if (difference <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        if (onComplete) {
          onComplete();
        }
        return false;
      }
      
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      
      setTimeRemaining({ days, hours, minutes, seconds });
      return true;
    };
    
    calculateTimeRemaining();
    const interval = setInterval(() => {
      if (!calculateTimeRemaining()) {
        clearInterval(interval);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [endTime, onComplete]);
  
  const formatNumber = (num: number) => num.toString().padStart(2, '0');
  
  const isUrgent = timeRemaining.days === 0 && timeRemaining.hours < 24;
  const isCritical = timeRemaining.days === 0 && timeRemaining.hours < 1;
  
  return (
    <div className={`flex items-center space-x-4 p-4 rounded-lg ${
      isCritical ? 'bg-red-100' : isUrgent ? 'bg-yellow-100' : 'bg-gray-100'
    }`}>
      <Clock className={`h-5 w-5 ${
        isCritical ? 'text-red-600' : isUrgent ? 'text-yellow-600' : 'text-gray-600'
      }`} />
      <div className="flex items-center space-x-2">
        <div className="text-center">
          <div className={`text-2xl font-bold ${
            isCritical ? 'text-red-600' : isUrgent ? 'text-yellow-600' : 'text-gray-900'
          }`}>
            {formatNumber(timeRemaining.days)}
          </div>
          <div className="text-xs text-gray-600">Days</div>
        </div>
        <span className="text-xl text-gray-400">:</span>
        <div className="text-center">
          <div className={`text-2xl font-bold ${
            isCritical ? 'text-red-600' : isUrgent ? 'text-yellow-600' : 'text-gray-900'
          }`}>
            {formatNumber(timeRemaining.hours)}
          </div>
          <div className="text-xs text-gray-600">Hours</div>
        </div>
        <span className="text-xl text-gray-400">:</span>
        <div className="text-center">
          <div className={`text-2xl font-bold ${
            isCritical ? 'text-red-600' : isUrgent ? 'text-yellow-600' : 'text-gray-900'
          }`}>
            {formatNumber(timeRemaining.minutes)}
          </div>
          <div className="text-xs text-gray-600">Minutes</div>
        </div>
        <span className="text-xl text-gray-400">:</span>
        <div className="text-center">
          <div className={`text-2xl font-bold ${
            isCritical ? 'text-red-600' : isUrgent ? 'text-yellow-600' : 'text-gray-900'
          }`}>
            {formatNumber(timeRemaining.seconds)}
          </div>
          <div className="text-xs text-gray-600">Seconds</div>
        </div>
      </div>
    </div>
  );
};
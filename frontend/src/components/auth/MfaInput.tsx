import React, { useRef, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

interface MfaInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  error?: string;
  method?: 'totp' | 'sms' | 'email';
}

export const MfaInput: React.FC<MfaInputProps> = ({
  value,
  onChange,
  onComplete,
  length = 6,
  autoFocus = true,
  disabled = false,
  error,
  method = 'totp'
}) => {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Split value into digits
    const valueDigits = value.split('').slice(0, length);
    const newDigits = Array(length).fill('');
    valueDigits.forEach((digit, index) => {
      newDigits[index] = digit;
    });
    setDigits(newDigits);
  }, [value, length]);

  const handleChange = (index: number, digit: string) => {
    // Only allow digits
    if (digit && !/^\d$/.test(digit)) return;

    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    const newValue = newDigits.join('');
    onChange(newValue);

    // Auto-focus next input
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Call onComplete when all digits are filled
    if (digit && index === length - 1 && newValue.length === length) {
      if (onComplete) {
        onComplete(newValue);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    // Handle paste
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        const pastedDigits = text.replace(/\D/g, '').slice(0, length);
        if (pastedDigits) {
          const newDigits = Array(length).fill('');
          pastedDigits.split('').forEach((digit, i) => {
            newDigits[i] = digit;
          });
          setDigits(newDigits);
          onChange(newDigits.join(''));
          
          // Focus last input or next empty one
          const lastFilledIndex = newDigits.findLastIndex(d => d !== '');
          if (lastFilledIndex < length - 1) {
            inputRefs.current[lastFilledIndex + 1]?.focus();
          } else {
            inputRefs.current[length - 1]?.focus();
          }

          // Call onComplete if all filled
          if (newDigits.every(d => d !== '')) {
            if (onComplete) {
              onComplete(newDigits.join(''));
            }
          }
        }
      });
    }
  };

  const handleFocus = (index: number) => {
    // Select text on focus
    inputRefs.current[index]?.select();
  };

  const getMethodLabel = () => {
    switch (method) {
      case 'sms':
        return 'Enter the 6-digit code sent to your phone';
      case 'email':
        return 'Enter the 6-digit code sent to your email';
      case 'totp':
      default:
        return 'Enter your authenticator app code';
    }
  };

  return (
    <div className="mfa-input-wrapper space-y-3">
      <p className="text-sm text-gray-600">{getMethodLabel()}</p>
      
      <div className="flex gap-2 justify-center">
        {digits.map((digit, index) => (
          <Input
            key={index}
            ref={el => inputRefs.current[index] = el}
            type="text"
            inputMode="numeric"
            pattern="\d"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onFocus={() => handleFocus(index)}
            disabled={disabled}
            autoFocus={autoFocus && index === 0}
            className={`
              w-12 h-12 text-center text-lg font-semibold
              ${error ? 'border-red-500' : ''}
              ${digit ? 'border-blue-500' : ''}
            `}
            aria-label={`Digit ${index + 1}`}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}

      <div className="text-xs text-gray-500 text-center">
        <button
          type="button"
          className="text-blue-600 hover:text-blue-700 underline"
          onClick={() => {
            // Clear all inputs
            setDigits(Array(length).fill(''));
            onChange('');
            inputRefs.current[0]?.focus();
          }}
        >
          Clear code
        </button>
      </div>
    </div>
  );
};

export default MfaInput;
import React, { useState, forwardRef, useEffect } from 'react';
import { PasswordHasher, PasswordStrengthIndicator } from '@/utils/crypto';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

interface PasswordInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  showStrength?: boolean;
  showRequirements?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  label?: string;
  error?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ 
    value, 
    onChange, 
    onBlur,
    showStrength = false, 
    showRequirements = false,
    label,
    error,
    className = '',
    ...props 
  }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const [validation, setValidation] = useState<any>(null);
    const [isFocused, setIsFocused] = useState(false);

    // Validate password on change
    useEffect(() => {
      if (showStrength && value) {
        const result = PasswordHasher.validatePassword(value);
        setValidation(result);
      } else {
        setValidation(null);
      }
    }, [value, showStrength]);

    // Clear password from memory when component unmounts
    useEffect(() => {
      return () => {
        onChange('');
      };
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    };

    const handleFocus = () => setIsFocused(true);
    
    const handleBlur = () => {
      setIsFocused(false);
      if (onBlur) onBlur();
    };

    return (
      <div className="password-input-wrapper space-y-2">
        {label && (
          <label htmlFor={props.id} className="block text-sm font-medium text-gray-700">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        
        <div className="relative">
          <Input
            ref={ref}
            type={showPassword ? 'text' : 'password'}
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={`pr-10 ${error ? 'border-red-500' : ''} ${className}`}
            {...props}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-gray-500" />
            ) : (
              <Eye className="h-4 w-4 text-gray-500" />
            )}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {error}
          </p>
        )}

        {showStrength && validation && value && (
          <PasswordStrengthBar validation={validation} />
        )}

        {showRequirements && isFocused && value && validation && (
          <PasswordRequirements validation={validation} />
        )}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

// Password strength bar component
const PasswordStrengthBar: React.FC<{ validation: any }> = ({ validation }) => {
  const color = PasswordStrengthIndicator.getColor(validation.score);
  const label = PasswordStrengthIndicator.getLabel(validation.score);
  const width = PasswordStrengthIndicator.getWidth(validation.score);

  return (
    <div className="password-strength space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-600">Password strength:</span>
        <span style={{ color }} className="font-medium">{label}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="h-2 rounded-full transition-all duration-300"
          style={{ 
            width,
            backgroundColor: color 
          }}
        />
      </div>
    </div>
  );
};

// Password requirements checklist
const PasswordRequirements: React.FC<{ validation: any }> = ({ validation }) => {
  const requirements = [
    { 
      met: validation.score >= 10, 
      text: 'At least 8 characters' 
    },
    { 
      met: /[a-z]/.test(validation.password || ''), 
      text: 'Contains lowercase letter' 
    },
    { 
      met: /[A-Z]/.test(validation.password || ''), 
      text: 'Contains uppercase letter' 
    },
    { 
      met: /[0-9]/.test(validation.password || ''), 
      text: 'Contains number' 
    },
    { 
      met: /[^a-zA-Z0-9]/.test(validation.password || ''), 
      text: 'Contains special character' 
    },
  ];

  return (
    <div className="password-requirements bg-gray-50 p-3 rounded-md">
      <p className="text-xs font-medium text-gray-700 mb-2">Password requirements:</p>
      <ul className="space-y-1">
        {requirements.map((req, index) => (
          <li key={index} className="flex items-center gap-2 text-xs">
            {req.met ? (
              <CheckCircle className="h-3 w-3 text-green-600" />
            ) : (
              <AlertCircle className="h-3 w-3 text-gray-400" />
            )}
            <span className={req.met ? 'text-green-700' : 'text-gray-600'}>
              {req.text}
            </span>
          </li>
        ))}
      </ul>
      {validation.feedback && validation.feedback.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <p className="text-xs text-amber-700">
            {validation.feedback[0]}
          </p>
        </div>
      )}
    </div>
  );
};

export default PasswordInput;
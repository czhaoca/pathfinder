---
name: Frontend Feature
about: Implement frontend authentication with client-side hashing
title: 'feat: [Frontend] Implement secure authentication with client-side hashing'
labels: frontend, security, enhancement, priority:critical
assignees: ''

---

## 📋 Description
Implement the complete frontend authentication system supporting the new token-based password system with client-side SHA-256 hashing. This includes login, registration (admin only), password retrieval, password reset, MFA support, and automatic token refresh.

## 🎯 Acceptance Criteria
- [ ] Client-side SHA-256 hashing before password transmission
- [ ] Secure password input with no plain text storage
- [ ] JWT token management with automatic refresh
- [ ] Session timeout warnings and handling
- [ ] MFA/2FA input flow
- [ ] Password strength indicator
- [ ] Password retrieval flow for new users
- [ ] Password reset request flow
- [ ] Force password change on first login
- [ ] Remember me functionality (refresh token)
- [ ] Secure logout clearing all tokens
- [ ] Account deletion request UI with cooling-off display

## 🎨 Frontend Implementation

### Authentication Service
```typescript
// frontend/src/services/auth.service.ts
import { sha256 } from 'js-sha256';
import { BehaviorSubject, Observable } from 'rxjs';

interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
}

export class AuthService {
  private readonly TOKEN_KEY = 'access_token';
  private readonly REFRESH_KEY = 'refresh_token';
  private readonly USER_KEY = 'user_data';
  
  private authState = new BehaviorSubject<AuthState>({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    mustChangePassword: false
  });
  
  private refreshTimer: NodeJS.Timeout | null = null;
  private sessionWarningTimer: NodeJS.Timeout | null = null;
  
  constructor(private http: HttpClient) {
    this.loadStoredAuth();
  }
  
  get currentUser$(): Observable<User | null> {
    return this.authState.asObservable().pipe(
      map(state => state.user)
    );
  }
  
  get isAuthenticated$(): Observable<boolean> {
    return this.authState.asObservable().pipe(
      map(state => state.isAuthenticated)
    );
  }
  
  async login(username: string, password: string, mfaToken?: string): Promise<void> {
    // Generate client salt
    const clientSalt = this.generateSalt();
    
    // Hash password with salt
    const passwordHash = sha256(password + clientSalt);
    
    // Clear password from memory immediately
    password = '';
    
    try {
      const response = await this.http.post<any>('/api/v2/auth/login', {
        username,
        password_hash: passwordHash,
        client_salt: clientSalt,
        mfa_token: mfaToken
      }).toPromise();
      
      if (response.requires_mfa) {
        throw new MfaRequiredError(response.mfa_methods);
      }
      
      if (response.must_change_password) {
        this.authState.next({
          ...this.authState.value,
          mustChangePassword: true
        });
        throw new PasswordChangeRequiredError(response.change_token);
      }
      
      this.handleAuthSuccess(response.data);
      
    } catch (error) {
      this.clearAuth();
      throw error;
    }
  }
  
  private handleAuthSuccess(data: any): void {
    const { user, token, refresh_token, expires_at, permissions } = data;
    
    // Store tokens securely
    this.secureStorage.setItem(this.TOKEN_KEY, token);
    this.secureStorage.setItem(this.REFRESH_KEY, refresh_token);
    this.secureStorage.setItem(this.USER_KEY, JSON.stringify(user));
    
    // Update state
    this.authState.next({
      user: { ...user, permissions },
      token,
      refreshToken: refresh_token,
      isAuthenticated: true,
      mustChangePassword: false
    });
    
    // Schedule token refresh (1 minute before expiry)
    const expiresIn = new Date(expires_at).getTime() - Date.now();
    this.scheduleTokenRefresh(expiresIn - 60000);
    
    // Set session warning (2 minutes before expiry)
    this.scheduleSessionWarning(expiresIn - 120000);
  }
  
  private scheduleTokenRefresh(delay: number): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    this.refreshTimer = setTimeout(() => {
      this.refreshToken();
    }, delay);
  }
  
  private scheduleSessionWarning(delay: number): void {
    if (this.sessionWarningTimer) {
      clearTimeout(this.sessionWarningTimer);
    }
    
    this.sessionWarningTimer = setTimeout(() => {
      this.emitSessionWarning();
    }, delay);
  }
  
  async refreshToken(): Promise<void> {
    const refreshToken = this.authState.value.refreshToken;
    
    if (!refreshToken) {
      this.logout();
      return;
    }
    
    try {
      const response = await this.http.post<any>('/api/v2/auth/refresh', {
        refresh_token: refreshToken
      }).toPromise();
      
      // Update token
      this.secureStorage.setItem(this.TOKEN_KEY, response.data.token);
      this.authState.next({
        ...this.authState.value,
        token: response.data.token
      });
      
      // Reschedule refresh
      const expiresIn = new Date(response.data.expires_at).getTime() - Date.now();
      this.scheduleTokenRefresh(expiresIn - 60000);
      
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.logout();
    }
  }
  
  private generateSalt(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  logout(): void {
    // Clear all tokens and data
    this.secureStorage.removeItem(this.TOKEN_KEY);
    this.secureStorage.removeItem(this.REFRESH_KEY);
    this.secureStorage.removeItem(this.USER_KEY);
    
    // Clear timers
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    if (this.sessionWarningTimer) {
      clearTimeout(this.sessionWarningTimer);
    }
    
    // Reset state
    this.authState.next({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      mustChangePassword: false
    });
    
    // Notify server (optional)
    this.http.post('/api/v2/auth/logout', {}).subscribe();
  }
  
  hasRole(role: string): boolean {
    const user = this.authState.value.user;
    return user?.roles?.includes(role) || false;
  }
  
  hasPermission(permission: string): boolean {
    const user = this.authState.value.user;
    return user?.permissions?.includes(permission) || false;
  }
  
  canAccessRole(targetRole: string): boolean {
    const hierarchy = {
      site_admin: ['site_admin', 'admin', 'user'],
      admin: ['admin', 'user'],
      user: ['user']
    };
    
    const userRoles = this.authState.value.user?.roles || [];
    return userRoles.some(role => 
      hierarchy[role]?.includes(targetRole)
    );
  }
}

// Secure storage wrapper
class SecureStorage {
  setItem(key: string, value: string): void {
    // In production, consider using encrypted storage
    try {
      sessionStorage.setItem(key, btoa(value));
    } catch (e) {
      console.error('Storage error:', e);
    }
  }
  
  getItem(key: string): string | null {
    try {
      const value = sessionStorage.getItem(key);
      return value ? atob(value) : null;
    } catch (e) {
      console.error('Storage error:', e);
      return null;
    }
  }
  
  removeItem(key: string): void {
    sessionStorage.removeItem(key);
  }
}
```

### Login Component
```tsx
// frontend/src/components/auth/LoginForm.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { PasswordInput } from '../common/PasswordInput';
import { MfaInput } from './MfaInput';
import { Alert } from '../common/Alert';

export const LoginForm: React.FC = () => {
  const { login, isLoading, error } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);
  
  // Clear password from memory when component unmounts
  useEffect(() => {
    return () => {
      setPassword('');
      if (passwordRef.current) {
        passwordRef.current.value = '';
      }
    };
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await login(username, password, mfaRequired ? mfaToken : undefined);
      
      // Clear sensitive data immediately after use
      setPassword('');
      setMfaToken('');
      if (passwordRef.current) {
        passwordRef.current.value = '';
      }
      
    } catch (error) {
      if (error.type === 'MFA_REQUIRED') {
        setMfaRequired(true);
      } else if (error.type === 'PASSWORD_CHANGE_REQUIRED') {
        // Redirect to password change
        navigate('/auth/change-password', { 
          state: { changeToken: error.changeToken } 
        });
      }
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="login-form" autoComplete="off">
      <h2>Sign In</h2>
      
      {error && (
        <Alert type="error" dismissible>
          {error.message}
        </Alert>
      )}
      
      <div className="form-group">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
          autoFocus
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="password">Password</label>
        <PasswordInput
          id="password"
          ref={passwordRef}
          value={password}
          onChange={setPassword}
          required
          autoComplete="current-password"
          showStrength={false}
        />
      </div>
      
      {mfaRequired && (
        <div className="form-group">
          <label htmlFor="mfa">Two-Factor Code</label>
          <MfaInput
            value={mfaToken}
            onChange={setMfaToken}
            autoFocus
          />
        </div>
      )}
      
      <div className="form-actions">
        <button 
          type="submit" 
          disabled={isLoading}
          className="btn btn-primary"
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
        
        <a href="/auth/forgot-password" className="forgot-link">
          Forgot Password?
        </a>
      </div>
      
      <SecurityNotice />
    </form>
  );
};

// Security notice component
const SecurityNotice: React.FC = () => (
  <div className="security-notice">
    <p>
      <strong>Security:</strong> Your password is encrypted before transmission.
      We never store or transmit passwords in plain text.
    </p>
  </div>
);
```

### Password Retrieval Component
```tsx
// frontend/src/components/auth/PasswordRetrieval.tsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { CopyButton } from '../common/CopyButton';

export const PasswordRetrieval: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      retrievePassword(token);
    }
  }, [searchParams]);
  
  const retrievePassword = async (token: string) => {
    try {
      const response = await authService.retrievePassword(token);
      setPassword(response.temporary_password);
      setExpiresAt(new Date(response.expires_at));
    } catch (error) {
      setError('Invalid or expired token');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <div>Retrieving password...</div>;
  }
  
  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <p>Please contact your administrator for a new password.</p>
      </div>
    );
  }
  
  return (
    <div className="password-retrieval">
      <h2>Your Temporary Password</h2>
      
      <div className="alert alert-warning">
        <strong>Important:</strong> This password can only be viewed once and 
        expires in 24 hours. You must change it on first login.
      </div>
      
      <div className="password-display">
        <div className="password-field">
          <input
            type="text"
            value={password || ''}
            readOnly
            className="password-input"
          />
          <CopyButton text={password || ''} />
        </div>
        
        <div className="password-info">
          <p>Username: {searchParams.get('username')}</p>
          <p>Expires: {expiresAt?.toLocaleString()}</p>
        </div>
      </div>
      
      <div className="instructions">
        <h3>Next Steps:</h3>
        <ol>
          <li>Copy this password</li>
          <li>Go to the <a href="/login">login page</a></li>
          <li>Sign in with your username and this password</li>
          <li>You will be prompted to create a new password</li>
        </ol>
      </div>
      
      <SecurityWarning />
    </div>
  );
};

const SecurityWarning: React.FC = () => (
  <div className="security-warning">
    <h4>Security Tips:</h4>
    <ul>
      <li>Never share this password with anyone</li>
      <li>Close this window after copying the password</li>
      <li>Use a password manager to store passwords securely</li>
      <li>Create a strong, unique password when you change it</li>
    </ul>
  </div>
);
```

### User Registration Component (Admin)
```tsx
// frontend/src/components/admin/UserRegistration.tsx
import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/user.service';
import { Alert } from '../common/Alert';

export const UserRegistration: React.FC = () => {
  const { hasRole } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    role: 'user'
  });
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Check permissions
  if (!hasRole('admin') && !hasRole('site_admin')) {
    return <div>Unauthorized: Admin access required</div>;
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const response = await userService.registerUser(formData);
      setResult(response);
      
      // Reset form
      setFormData({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        role: 'user'
      });
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="user-registration">
      <h2>Register New User</h2>
      
      {error && <Alert type="error">{error}</Alert>}
      
      {result && (
        <Alert type="success">
          <h3>User Created Successfully!</h3>
          <div className="registration-result">
            <p><strong>Username:</strong> {result.user.username}</p>
            <p><strong>Email:</strong> {result.user.email}</p>
            <p><strong>Role:</strong> {result.user.role}</p>
            
            <div className="token-section">
              <h4>Password Retrieval Token:</h4>
              <div className="token-display">
                <code>{result.password_retrieval_token}</code>
                <CopyButton text={result.password_retrieval_token} />
              </div>
              <p className="token-expiry">
                Token expires: {new Date(result.token_expires_at).toLocaleString()}
              </p>
            </div>
            
            <div className="instructions">
              <h4>Send to User:</h4>
              <ol>
                <li>Username: {result.user.username}</li>
                <li>Password retrieval link:</li>
                <li>
                  <code>
                    {window.location.origin}/auth/retrieve-password?token={result.password_retrieval_token}&username={result.user.username}
                  </code>
                </li>
              </ol>
            </div>
          </div>
        </Alert>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="username">Username *</label>
            <input
              id="username"
              type="text"
              pattern="^[a-z0-9_]{3,30}$"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              required
            />
            <small>Lowercase letters, numbers, underscore only (3-30 chars)</small>
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="first_name">First Name *</label>
            <input
              id="first_name"
              type="text"
              value={formData.first_name}
              onChange={(e) => setFormData({...formData, first_name: e.target.value})}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="last_name">Last Name *</label>
            <input
              id="last_name"
              type="text"
              value={formData.last_name}
              onChange={(e) => setFormData({...formData, last_name: e.target.value})}
              required
            />
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="role">Role *</label>
          <select
            id="role"
            value={formData.role}
            onChange={(e) => setFormData({...formData, role: e.target.value})}
            required
          >
            <option value="user">User</option>
            {hasRole('site_admin') && <option value="admin">Admin</option>}
          </select>
          <small>
            {hasRole('site_admin') 
              ? 'You can create users and admins'
              : 'You can only create regular users'}
          </small>
        </div>
        
        <div className="form-actions">
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Creating User...' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
};
```

### Password Input Component
```tsx
// frontend/src/components/common/PasswordInput.tsx
import React, { useState, forwardRef } from 'react';
import { calculatePasswordStrength } from '../../utils/password';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  showStrength?: boolean;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  id?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ value, onChange, showStrength = true, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const [strength, setStrength] = useState(0);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange(newValue);
      
      if (showStrength) {
        setStrength(calculatePasswordStrength(newValue));
      }
    };
    
    return (
      <div className="password-input-wrapper">
        <div className="password-input-group">
          <input
            ref={ref}
            type={showPassword ? 'text' : 'password'}
            value={value}
            onChange={handleChange}
            className="password-input"
            {...props}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="password-toggle"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? '👁️‍🗨️' : '👁️'}
          </button>
        </div>
        
        {showStrength && value && (
          <PasswordStrengthIndicator strength={strength} />
        )}
      </div>
    );
  }
);

const PasswordStrengthIndicator: React.FC<{ strength: number }> = ({ strength }) => {
  const getStrengthLabel = () => {
    if (strength < 30) return 'Weak';
    if (strength < 60) return 'Fair';
    if (strength < 80) return 'Good';
    return 'Strong';
  };
  
  const getStrengthColor = () => {
    if (strength < 30) return '#ff4444';
    if (strength < 60) return '#ffaa00';
    if (strength < 80) return '#00aa00';
    return '#00ff00';
  };
  
  return (
    <div className="password-strength">
      <div className="strength-bar">
        <div 
          className="strength-fill"
          style={{ 
            width: `${strength}%`,
            backgroundColor: getStrengthColor()
          }}
        />
      </div>
      <span className="strength-label">{getStrengthLabel()}</span>
    </div>
  );
};
```

## 🧪 Testing Requirements
- [ ] Unit tests for password hashing
- [ ] Unit tests for token management
- [ ] Component tests for all auth forms
- [ ] Integration tests for auth flows
- [ ] Security tests for XSS prevention
- [ ] Accessibility tests (WCAG 2.1 AA)
- [ ] Browser compatibility tests

## 📚 Documentation Updates
- [ ] Frontend authentication guide
- [ ] Security best practices for frontend
- [ ] Component API documentation
- [ ] Integration examples

## 🔗 Dependencies
- Depends on: #8 (API endpoints ready)
- Blocks: #13 (E2E testing)

## 📊 Success Metrics
- Zero plain text passwords in memory/storage
- Token refresh success rate > 99%
- Login flow completion < 3 seconds
- WCAG 2.1 AA compliance

---

**Estimated Effort**: 13 story points
**Sprint**: 4 (Frontend Implementation)
**Target Completion**: Week 7
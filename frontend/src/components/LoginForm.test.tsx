import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import LoginForm from './LoginForm';
import * as authService from '@/services/authService';

// Mock auth service
vi.mock('@/services/authService');

const MockedLoginForm = () => (
  <BrowserRouter>
    <LoginForm />
  </BrowserRouter>
);

describe('LoginForm Component', () => {
  const mockLogin = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.login).mockImplementation(mockLogin);
  });

  it('renders login form with all fields', () => {
    render(<MockedLoginForm />);
    
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<MockedLoginForm />);
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/username is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
    
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({
      token: 'mock-token',
      user: { id: '1', username: 'testuser' }
    });
    
    render(<MockedLoginForm />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'TestPassword123!');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'TestPassword123!'
      });
    });
  });

  it('displays error message on login failure', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    
    render(<MockedLoginForm />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('disables form during submission', async () => {
    const user = userEvent.setup();
    mockLogin.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 1000))
    );
    
    render(<MockedLoginForm />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'TestPassword123!');
    await user.click(submitButton);
    
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent(/signing in/i);
    expect(usernameInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    render(<MockedLoginForm />);
    
    const passwordInput = screen.getByLabelText(/password/i);
    const toggleButton = screen.getByRole('button', { name: /show password/i });
    
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    
    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('navigates to register page when clicking sign up link', async () => {
    const user = userEvent.setup();
    render(<MockedLoginForm />);
    
    const signUpLink = screen.getByRole('link', { name: /sign up/i });
    
    await user.click(signUpLink);
    
    expect(window.location.pathname).toBe('/register');
  });

  it('handles remember me checkbox', async () => {
    const user = userEvent.setup();
    render(<MockedLoginForm />);
    
    const rememberCheckbox = screen.getByRole('checkbox', { name: /remember me/i });
    
    expect(rememberCheckbox).not.toBeChecked();
    
    await user.click(rememberCheckbox);
    expect(rememberCheckbox).toBeChecked();
    
    await user.click(rememberCheckbox);
    expect(rememberCheckbox).not.toBeChecked();
  });

  it('clears error message when typing', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    
    render(<MockedLoginForm />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
    
    await user.type(usernameInput, 'a');
    
    expect(screen.queryByText(/invalid credentials/i)).not.toBeInTheDocument();
  });

  it('handles network errors gracefully', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new Error('Network error'));
    
    render(<MockedLoginForm />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'TestPassword123!');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it('validates username format', async () => {
    const user = userEvent.setup();
    render(<MockedLoginForm />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(usernameInput, 'ab'); // Too short
    await user.type(passwordInput, 'TestPassword123!');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/username must be at least 3 characters/i)).toBeInTheDocument();
    });
    
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('validates password strength', async () => {
    const user = userEvent.setup();
    render(<MockedLoginForm />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'weak');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });
    
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('handles successful login redirect', async () => {
    const user = userEvent.setup();
    const mockNavigate = vi.fn();
    
    // Mock useNavigate
    vi.mock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useNavigate: () => mockNavigate
      };
    });
    
    mockLogin.mockResolvedValue({
      token: 'mock-token',
      user: { id: '1', username: 'testuser' }
    });
    
    render(<MockedLoginForm />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'TestPassword123!');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });
});
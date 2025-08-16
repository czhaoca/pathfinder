import React, { useState, useEffect } from 'react';
import { TokenManager } from '../utils/crypto';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';

function RegistrationForm() {
  const navigate = useNavigate();
  const { register, retrievePassword, isLoading, error, clearError } = useAuthStore();
  
  const [step, setStep] = useState('register'); // 'register', 'token', 'success'
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    role: 'user'
  });
  
  const [tokenData, setTokenData] = useState({
    token: '',
    expiresAt: null
  });
  
  const [retrievedPassword, setRetrievedPassword] = useState(null);
  const [registrationError, setRegistrationError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  
  useEffect(() => {
    clearError();
  }, [clearError]);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (error) clearError();
    if (registrationError) setRegistrationError('');
  };
  
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.username || !formData.email || !formData.firstName || !formData.lastName) {
      setRegistrationError('Please fill in all required fields');
      return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setRegistrationError('Please enter a valid email address');
      return;
    }
    
    try {
      const response = await register(formData);
      
      if (response.success) {
        // Store token for retrieval
        setTokenData({
          token: response.data.password_token,
          expiresAt: new Date(response.data.token_expires_at)
        });
        
        // Store in token manager
        TokenManager.storeToken(
          response.data.password_token,
          'retrieval',
          new Date(response.data.token_expires_at)
        );
        
        // Move to token step
        setStep('token');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setRegistrationError(err.message || 'Registration failed');
    }
  };
  
  const handleRetrievePassword = async () => {
    if (!tokenData.token) {
      setRegistrationError('No token available');
      return;
    }
    
    try {
      const response = await retrievePassword(tokenData.token);
      
      if (response.success) {
        setRetrievedPassword(response.data);
        TokenManager.removeToken(tokenData.token);
        setStep('success');
      }
    } catch (err) {
      console.error('Password retrieval error:', err);
      setRegistrationError(err.message || 'Failed to retrieve password');
    }
  };
  
  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  const handleLogin = () => {
    navigate('/login');
  };
  
  if (step === 'token') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Registration Successful!
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              User <strong>{formData.username}</strong> has been created
            </p>
          </div>
          
          <div className="mt-8 space-y-6">
            <div className="rounded-md bg-blue-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Password Retrieval Token
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>Use this one-time token to retrieve the temporary password:</p>
                    <div className="mt-2 flex items-center space-x-2">
                      <code className="flex-1 px-2 py-1 bg-white rounded text-xs break-all">
                        {tokenData.token}
                      </code>
                      <button
                        onClick={() => copyToClipboard(tokenData.token, 'token')}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        {copySuccess === 'token' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="mt-2 text-xs">
                      Expires: {tokenData.expiresAt?.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {registrationError && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      {registrationError}
                    </h3>
                  </div>
                </div>
              </div>
            )}
            
            <button
              onClick={handleRetrievePassword}
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Retrieving...' : 'Retrieve Temporary Password'}
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Account Created Successfully!
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Save these credentials securely
            </p>
          </div>
          
          <div className="mt-8 space-y-6">
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-green-800">
                    Login Credentials
                  </h3>
                  <div className="mt-2 text-sm text-green-700 space-y-2">
                    <div>
                      <strong>Username:</strong>
                      <div className="flex items-center space-x-2 mt-1">
                        <code className="flex-1 px-2 py-1 bg-white rounded text-xs">
                          {retrievedPassword.username}
                        </code>
                        <button
                          onClick={() => copyToClipboard(retrievedPassword.username, 'username')}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          {copySuccess === 'username' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <strong>Temporary Password:</strong>
                      <div className="flex items-center space-x-2 mt-1">
                        <code className="flex-1 px-2 py-1 bg-white rounded text-xs font-mono">
                          {retrievedPassword.temporary_password}
                        </code>
                        <button
                          onClick={() => copyToClipboard(retrievedPassword.temporary_password, 'password')}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          {copySuccess === 'password' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-3 p-2 bg-yellow-100 rounded">
                      <p className="text-xs text-yellow-800">
                        <strong>Important:</strong> This password expires in 24 hours and must be changed on first login.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleLogin}
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Proceed to Login
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create a new account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Register a new user with secure token-based password system
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleRegisterSubmit}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="johndoe"
                value={formData.username}
                onChange={handleInputChange}
                disabled={isLoading}
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="john@example.com"
                value={formData.email}
                onChange={handleInputChange}
                disabled={isLoading}
              />
            </div>
            
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                id="role"
                name="role"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={formData.role}
                onChange={handleInputChange}
                disabled={isLoading}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>
          
          {(error || registrationError) && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    {error || registrationError}
                  </h3>
                </div>
              </div>
            </div>
          )}
          
          <div className="rounded-md bg-blue-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Security Notice
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>No password field - the system generates a secure temporary password</li>
                    <li>You'll receive a one-time token to retrieve the password</li>
                    <li>The temporary password must be changed on first login</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Sign in
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RegistrationForm;
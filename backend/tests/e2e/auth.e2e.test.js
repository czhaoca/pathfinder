/**
 * End-to-End Tests for Authentication Flow
 * Tests complete user authentication journey including registration, login, and session management
 */

const { test, expect } = require('@playwright/test');

const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const TEST_USER = {
  username: `testuser_${Date.now()}`,
  email: `test_${Date.now()}@example.com`,
  password: 'TestPassword123!',
  fullName: 'Test User'
};

test.describe('Authentication E2E Tests', () => {
  let authToken;
  let refreshToken;
  let userId;

  test.describe('User Registration', () => {
    test('should register a new user successfully', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/register`, {
        data: TEST_USER
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data).toHaveProperty('user');
      expect(body.data.user).toHaveProperty('id');
      expect(body.data.user.username).toBe(TEST_USER.username.toLowerCase());
      expect(body.data.user.email).toBe(TEST_USER.email.toLowerCase());
      expect(body.message).toBe('User registered successfully');
      
      userId = body.data.user.id;
    });

    test('should reject duplicate registration', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/register`, {
        data: TEST_USER
      });

      expect(response.status()).toBe(409); // Conflict
      const body = await response.json();
      
      expect(body.success).toBe(false);
      expect(body.message).toBeDefined();
    });

    test('should validate registration input', async ({ request }) => {
      const invalidUser = {
        username: 'a', // Too short
        email: 'invalid-email',
        password: 'weak'
      };

      const response = await request.post(`${API_URL}/auth/register`, {
        data: invalidUser
      });

      expect(response.status()).toBe(400); // Bad Request
      const body = await response.json();
      
      expect(body.success).toBe(false);
      expect(body.errors).toBeDefined();
    });
  });

  test.describe('User Login', () => {
    test('should login with valid credentials', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/login`, {
        data: {
          username: TEST_USER.username,
          password: TEST_USER.password
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      expect(body.message).toBe('Login successful');
      expect(body.data).toHaveProperty('token');
      expect(body.data).toHaveProperty('refreshToken');
      expect(body.data).toHaveProperty('user');
      
      authToken = body.data.token;
      refreshToken = body.data.refreshToken;
    });

    test('should reject invalid password', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/login`, {
        data: {
          username: TEST_USER.username,
          password: 'WrongPassword123!'
        }
      });

      expect(response.status()).toBe(401); // Unauthorized
      const body = await response.json();
      
      expect(body.success).toBe(false);
      expect(body.error).toContain('Invalid credentials');
    });

    test('should reject non-existent user', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/login`, {
        data: {
          username: 'nonexistentuser',
          password: 'SomePassword123!'
        }
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      
      expect(body.success).toBe(false);
    });
  });

  test.describe('Authenticated Requests', () => {
    test('should access protected route with valid token', async ({ request }) => {
      const response = await request.get(`${API_URL}/profile`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('user');
    });

    test('should reject request without token', async ({ request }) => {
      const response = await request.get(`${API_URL}/profile`);

      expect(response.status()).toBe(401);
      const body = await response.json();
      
      expect(body.success).toBe(false);
      expect(body.error).toContain('Authentication required');
    });

    test('should reject request with invalid token', async ({ request }) => {
      const response = await request.get(`${API_URL}/profile`, {
        headers: {
          'Authorization': 'Bearer invalid.token.here'
        }
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      
      expect(body.success).toBe(false);
    });
  });

  test.describe('Token Refresh', () => {
    test('should refresh token successfully', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/refresh`, {
        data: {
          refreshToken: refreshToken
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('token');
      expect(body.data).toHaveProperty('refreshToken');
      
      // Update tokens
      authToken = body.data.token;
      refreshToken = body.data.refreshToken;
    });

    test('should reject invalid refresh token', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/refresh`, {
        data: {
          refreshToken: 'invalid.refresh.token'
        }
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      
      expect(body.success).toBe(false);
    });
  });

  test.describe('Password Reset', () => {
    let resetToken;

    test('should initiate password reset', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/forgot-password`, {
        data: {
          email: TEST_USER.email
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      expect(body.message).toContain('reset email sent');
      
      // In a real test, we'd need to retrieve the reset token from email
      // For now, we'll mock it
      resetToken = 'mock-reset-token';
    });

    test('should reset password with valid token', async ({ request }) => {
      // Skip if no reset token (mock scenario)
      if (resetToken === 'mock-reset-token') {
        test.skip();
        return;
      }

      const newPassword = 'NewTestPassword123!';
      const response = await request.post(`${API_URL}/auth/reset-password`, {
        data: {
          token: resetToken,
          newPassword: newPassword
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      
      // Verify can login with new password
      const loginResponse = await request.post(`${API_URL}/auth/login`, {
        data: {
          username: TEST_USER.username,
          password: newPassword
        }
      });
      
      expect(loginResponse.ok()).toBeTruthy();
    });
  });

  test.describe('Change Password', () => {
    test('should change password for authenticated user', async ({ request }) => {
      const newPassword = 'UpdatedPassword123!';
      
      const response = await request.post(`${API_URL}/auth/change-password`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: {
          currentPassword: TEST_USER.password,
          newPassword: newPassword
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      
      // Update password for future tests
      TEST_USER.password = newPassword;
    });

    test('should reject incorrect current password', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/change-password`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: {
          currentPassword: 'WrongCurrentPassword!',
          newPassword: 'NewPassword123!'
        }
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      
      expect(body.success).toBe(false);
      expect(body.error).toContain('Current password is incorrect');
    });
  });

  test.describe('Logout', () => {
    test('should logout successfully', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/logout`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      
      expect(body.success).toBe(true);
      
      // Verify token is no longer valid
      const profileResponse = await request.get(`${API_URL}/profile`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(profileResponse.status()).toBe(401);
    });
  });

  test.describe('Rate Limiting', () => {
    test('should enforce rate limits on login attempts', async ({ request }) => {
      const attempts = 10;
      const responses = [];
      
      for (let i = 0; i < attempts; i++) {
        const response = await request.post(`${API_URL}/auth/login`, {
          data: {
            username: 'ratelimittest',
            password: 'WrongPassword!'
          }
        });
        responses.push(response.status());
      }
      
      // At least one should be rate limited (429)
      expect(responses).toContain(429);
    });
  });

  test.describe('Session Management', () => {
    test('should track active sessions', async ({ request }) => {
      // Login from multiple "devices"
      const sessions = [];
      
      for (let i = 0; i < 3; i++) {
        const response = await request.post(`${API_URL}/auth/login`, {
          data: {
            username: TEST_USER.username,
            password: TEST_USER.password
          },
          headers: {
            'User-Agent': `TestDevice${i}`
          }
        });
        
        const body = await response.json();
        sessions.push(body.data.token);
      }
      
      // Get active sessions
      const sessionsResponse = await request.get(`${API_URL}/auth/sessions`, {
        headers: {
          'Authorization': `Bearer ${sessions[0]}`
        }
      });
      
      expect(sessionsResponse.ok()).toBeTruthy();
      const body = await sessionsResponse.json();
      
      expect(body.data.sessions).toHaveLength(3);
    });

    test('should revoke specific session', async ({ request }) => {
      // Login to create a session
      const loginResponse = await request.post(`${API_URL}/auth/login`, {
        data: {
          username: TEST_USER.username,
          password: TEST_USER.password
        }
      });
      
      const { token, sessionId } = loginResponse.json().data;
      
      // Revoke the session
      const revokeResponse = await request.delete(`${API_URL}/auth/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(revokeResponse.ok()).toBeTruthy();
      
      // Verify token is no longer valid
      const testResponse = await request.get(`${API_URL}/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      expect(testResponse.status()).toBe(401);
    });
  });
});
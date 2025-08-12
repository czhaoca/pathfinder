const UserService = require('../../../src/services/userService');
const DatabaseService = require('../../../src/services/database');
const { encryptionService } = require('../../../src/services/encryption');
const bcrypt = require('bcrypt');

jest.mock('../../../src/services/database');
jest.mock('../../../src/services/encryption');
jest.mock('bcrypt');

describe('UserService', () => {
  let userService;
  let mockDb;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb = {
      query: jest.fn(),
      transaction: jest.fn()
    };
    
    DatabaseService.mockImplementation(() => mockDb);
    userService = new UserService();
    userService.db = mockDb;
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
      };
      
      bcrypt.hash.mockResolvedValue('hashed_password');
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // Check existing
      mockDb.query.mockResolvedValueOnce({ 
        rows: [{ 
          id: 'user-123',
          ...userData,
          password: 'hashed_password',
          created_at: new Date()
        }] 
      });
      
      const result = await userService.createUser(userData);
      
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 12);
      expect(result).toHaveProperty('id', 'user-123');
      expect(result).toHaveProperty('username', 'testuser');
      expect(result).not.toHaveProperty('password');
    });

    it('should reject duplicate username', async () => {
      const userData = {
        username: 'existinguser',
        email: 'new@example.com',
        password: 'Password123!'
      };
      
      mockDb.query.mockResolvedValueOnce({ 
        rows: [{ id: 'existing-user' }] 
      });
      
      await expect(userService.createUser(userData))
        .rejects.toThrow('Username already exists');
    });

    it('should reject duplicate email', async () => {
      const userData = {
        username: 'newuser',
        email: 'existing@example.com',
        password: 'Password123!'
      };
      
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // No username conflict
        .mockResolvedValueOnce({ rows: [{ id: 'existing-user' }] }); // Email exists
      
      await expect(userService.createUser(userData))
        .rejects.toThrow('Email already registered');
    });

    it('should encrypt sensitive fields', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!',
        phone: '555-1234'
      };
      
      bcrypt.hash.mockResolvedValue('hashed_password');
      encryptionService.encryptField = jest.fn().mockReturnValue('encrypted_phone');
      
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockDb.query.mockResolvedValueOnce({ 
        rows: [{ 
          id: 'user-123',
          phone: 'encrypted_phone'
        }] 
      });
      
      await userService.createUser(userData);
      
      expect(encryptionService.encryptField).toHaveBeenCalledWith('555-1234', expect.any(String));
    });
  });

  describe('getUserById', () => {
    it('should get user by ID', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        phone: 'encrypted_phone'
      };
      
      mockDb.query.mockResolvedValue({ rows: [mockUser] });
      encryptionService.decryptField = jest.fn().mockReturnValue('555-1234');
      
      const result = await userService.getUserById('user-123');
      
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = :id'),
        { id: 'user-123' }
      );
      expect(result).toHaveProperty('username', 'testuser');
      expect(result).not.toHaveProperty('password');
    });

    it('should return null for non-existent user', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      
      const result = await userService.getUserById('non-existent');
      
      expect(result).toBeNull();
    });
  });

  describe('getUserByUsername', () => {
    it('should get user by username', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com'
      };
      
      mockDb.query.mockResolvedValue({ rows: [mockUser] });
      
      const result = await userService.getUserByUsername('testuser');
      
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE username = :username'),
        { username: 'testuser' }
      );
      expect(result).toHaveProperty('id', 'user-123');
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updates = {
        firstName: 'Updated',
        lastName: 'Name',
        phone: '555-5678'
      };
      
      encryptionService.encryptField = jest.fn().mockReturnValue('encrypted_new_phone');
      
      mockDb.query.mockResolvedValue({ 
        rows: [{
          id: 'user-123',
          username: 'testuser',
          first_name: 'Updated',
          last_name: 'Name',
          phone: 'encrypted_new_phone'
        }],
        rowsAffected: 1
      });
      
      const result = await userService.updateUser('user-123', updates);
      
      expect(result).toHaveProperty('first_name', 'Updated');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.objectContaining({
          id: 'user-123',
          firstName: 'Updated',
          lastName: 'Name'
        })
      );
    });

    it('should not allow password update through updateUser', async () => {
      const updates = {
        password: 'NewPassword123!'
      };
      
      await userService.updateUser('user-123', updates);
      
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.objectContaining({ password: expect.anything() })
      );
    });

    it('should return null if user not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowsAffected: 0 });
      
      const result = await userService.updateUser('non-existent', { firstName: 'Test' });
      
      expect(result).toBeNull();
    });
  });

  describe('updatePassword', () => {
    it('should update password with valid current password', async () => {
      const mockUser = {
        id: 'user-123',
        password: 'old_hashed_password'
      };
      
      mockDb.query.mockResolvedValueOnce({ rows: [mockUser] });
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('new_hashed_password');
      mockDb.query.mockResolvedValueOnce({ rowsAffected: 1 });
      
      const result = await userService.updatePassword(
        'user-123',
        'OldPassword123!',
        'NewPassword123!'
      );
      
      expect(bcrypt.compare).toHaveBeenCalledWith('OldPassword123!', 'old_hashed_password');
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 12);
      expect(result).toBe(true);
    });

    it('should reject invalid current password', async () => {
      const mockUser = {
        id: 'user-123',
        password: 'old_hashed_password'
      };
      
      mockDb.query.mockResolvedValue({ rows: [mockUser] });
      bcrypt.compare.mockResolvedValue(false);
      
      await expect(
        userService.updatePassword('user-123', 'WrongPassword', 'NewPassword123!')
      ).rejects.toThrow('Current password is incorrect');
    });
  });

  describe('deleteUser', () => {
    it('should soft delete user', async () => {
      mockDb.query.mockResolvedValue({ rowsAffected: 1 });
      
      const result = await userService.deleteUser('user-123');
      
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.objectContaining({
          id: 'user-123',
          status: 'deleted'
        })
      );
      expect(result).toBe(true);
    });

    it('should hard delete user when specified', async () => {
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockClient = {
          execute: jest.fn().mockResolvedValue({ rowsAffected: 1 })
        };
        return callback(mockClient);
      });
      
      const result = await userService.deleteUser('user-123', true);
      
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('searchUsers', () => {
    it('should search users by query', async () => {
      const mockUsers = [
        { id: 'user-1', username: 'john', email: 'john@example.com' },
        { id: 'user-2', username: 'jane', email: 'jane@example.com' }
      ];
      
      mockDb.query.mockResolvedValue({ 
        rows: mockUsers,
        metaData: { totalCount: 2 }
      });
      
      const result = await userService.searchUsers('john');
      
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        expect.objectContaining({ searchQuery: '%john%' })
      );
      expect(result).toHaveLength(2);
    });

    it('should paginate search results', async () => {
      mockDb.query.mockResolvedValue({ 
        rows: [],
        metaData: { totalCount: 100 }
      });
      
      await userService.searchUsers('test', { page: 2, limit: 20 });
      
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('OFFSET'),
        expect.objectContaining({ 
          limit: 20,
          offset: 20
        })
      );
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      mockDb.query.mockResolvedValueOnce({ 
        rows: [{ 
          id: 'user-123',
          verification_token: 'valid-token',
          token_expires: new Date(Date.now() + 3600000)
        }] 
      });
      
      mockDb.query.mockResolvedValueOnce({ rowsAffected: 1 });
      
      const result = await userService.verifyEmail('valid-token');
      
      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('email_verified = true'),
        expect.any(Object)
      );
    });

    it('should reject expired token', async () => {
      mockDb.query.mockResolvedValue({ 
        rows: [{ 
          id: 'user-123',
          verification_token: 'expired-token',
          token_expires: new Date(Date.now() - 3600000)
        }] 
      });
      
      await expect(userService.verifyEmail('expired-token'))
        .rejects.toThrow('Verification token has expired');
    });

    it('should reject invalid token', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      
      await expect(userService.verifyEmail('invalid-token'))
        .rejects.toThrow('Invalid verification token');
    });
  });

  describe('getUserPreferences', () => {
    it('should get user preferences', async () => {
      const mockPreferences = {
        theme: 'dark',
        notifications: true,
        language: 'en'
      };
      
      mockDb.query.mockResolvedValue({ 
        rows: [{ preferences: JSON.stringify(mockPreferences) }] 
      });
      
      const result = await userService.getUserPreferences('user-123');
      
      expect(result).toEqual(mockPreferences);
    });

    it('should return default preferences if none exist', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      
      const result = await userService.getUserPreferences('user-123');
      
      expect(result).toHaveProperty('theme', 'light');
      expect(result).toHaveProperty('notifications', true);
    });
  });

  describe('updateUserPreferences', () => {
    it('should update user preferences', async () => {
      const preferences = {
        theme: 'dark',
        notifications: false
      };
      
      mockDb.query.mockResolvedValue({ rowsAffected: 1 });
      
      const result = await userService.updateUserPreferences('user-123', preferences);
      
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('preferences = :preferences'),
        expect.objectContaining({
          preferences: JSON.stringify(preferences)
        })
      );
      expect(result).toBe(true);
    });
  });

  describe('getUserStats', () => {
    it('should get user statistics', async () => {
      const mockStats = {
        total_experiences: 10,
        total_skills: 25,
        profile_completeness: 85,
        last_active: new Date()
      };
      
      mockDb.query.mockResolvedValue({ rows: [mockStats] });
      
      const result = await userService.getUserStats('user-123');
      
      expect(result).toHaveProperty('total_experiences', 10);
      expect(result).toHaveProperty('profile_completeness', 85);
    });
  });
});
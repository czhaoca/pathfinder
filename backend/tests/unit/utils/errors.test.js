const { 
  AppError, 
  ValidationError, 
  AuthenticationError,
  NotFoundError,
  ConflictError,
  asyncHandler
} = require('../../../src/utils/errors');

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an error with message and status code', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.isOperational).toBe(true);
    });
  });

  describe('ValidationError', () => {
    it('should create a validation error with fields', () => {
      const fields = { email: 'Invalid email format' };
      const error = new ValidationError('Validation failed', fields);
      
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.fields).toEqual(fields);
    });
  });

  describe('AuthenticationError', () => {
    it('should create an authentication error', () => {
      const error = new AuthenticationError();
      
      expect(error.message).toBe('Authentication failed');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });
    
    it('should accept custom message', () => {
      const error = new AuthenticationError('Invalid token');
      expect(error.message).toBe('Invalid token');
    });
  });

  describe('NotFoundError', () => {
    it('should create a not found error', () => {
      const error = new NotFoundError('User');
      
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.resource).toBe('User');
    });
  });

  describe('ConflictError', () => {
    it('should create a conflict error', () => {
      const error = new ConflictError('Email already exists');
      
      expect(error.message).toBe('Email already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });
  });
});

describe('asyncHandler', () => {
  it('should handle successful async function', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');
    const handler = asyncHandler(mockFn);
    
    const req = {};
    const res = {};
    const next = jest.fn();
    
    await handler(req, res, next);
    
    expect(mockFn).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });
  
  it('should catch errors and pass to next', async () => {
    const error = new Error('Test error');
    const mockFn = jest.fn().mockRejectedValue(error);
    const handler = asyncHandler(mockFn);
    
    const req = {};
    const res = {};
    const next = jest.fn();
    
    await handler(req, res, next);
    
    expect(mockFn).toHaveBeenCalledWith(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});
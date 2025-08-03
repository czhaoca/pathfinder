const { Validator, validate, schemas } = require('../../../src/api/middleware/validation');
const { ValidationError } = require('../../../src/utils/errors');

describe('Validator', () => {
  describe('email', () => {
    it('should validate correct email', () => {
      const email = Validator.email('test@example.com');
      expect(email).toBe('test@example.com');
    });
    
    it('should lowercase and trim email', () => {
      const email = Validator.email('  TEST@EXAMPLE.COM  ');
      expect(email).toBe('test@example.com');
    });
    
    it('should throw ValidationError for invalid email', () => {
      expect(() => Validator.email('invalid')).toThrow(ValidationError);
      expect(() => Validator.email('test@')).toThrow(ValidationError);
      expect(() => Validator.email('@example.com')).toThrow(ValidationError);
    });
  });
  
  describe('username', () => {
    it('should validate correct username', () => {
      expect(Validator.username('user123')).toBe('user123');
      expect(Validator.username('user_name')).toBe('user_name');
      expect(Validator.username('user-name')).toBe('user-name');
    });
    
    it('should lowercase and trim username', () => {
      const username = Validator.username('  UserName  ');
      expect(username).toBe('username');
    });
    
    it('should throw ValidationError for invalid username', () => {
      expect(() => Validator.username('ab')).toThrow(ValidationError); // too short
      expect(() => Validator.username('a'.repeat(31))).toThrow(ValidationError); // too long
      expect(() => Validator.username('user@name')).toThrow(ValidationError); // invalid char
    });
  });
  
  describe('password', () => {
    it('should validate strong password', () => {
      const password = 'Test123!';
      expect(Validator.password(password)).toBe(password);
    });
    
    it('should throw ValidationError for weak password', () => {
      expect(() => Validator.password('weak')).toThrow(ValidationError); // too short
      expect(() => Validator.password('nouppercas3')).toThrow(ValidationError); // no uppercase
      expect(() => Validator.password('NOLOWERCASE3')).toThrow(ValidationError); // no lowercase
      expect(() => Validator.password('NoNumbers!')).toThrow(ValidationError); // no number
    });
  });
  
  describe('required', () => {
    it('should pass for valid values', () => {
      expect(Validator.required('value', 'field')).toBe('value');
      expect(Validator.required(0, 'field')).toBe(0);
      expect(Validator.required(false, 'field')).toBe(false);
    });
    
    it('should throw for null/undefined/empty', () => {
      expect(() => Validator.required(null, 'field')).toThrow(ValidationError);
      expect(() => Validator.required(undefined, 'field')).toThrow(ValidationError);
      expect(() => Validator.required('', 'field')).toThrow(ValidationError);
    });
  });
  
  describe('pagination', () => {
    it('should return default values', () => {
      const result = Validator.pagination();
      expect(result).toEqual({
        page: 1,
        limit: 20,
        offset: 0
      });
    });
    
    it('should validate and sanitize inputs', () => {
      const result = Validator.pagination('3', '50');
      expect(result).toEqual({
        page: 3,
        limit: 50,
        offset: 100
      });
    });
    
    it('should enforce limits', () => {
      const result = Validator.pagination('-1', '200');
      expect(result.page).toBe(1); // min page
      expect(result.limit).toBe(100); // max limit
    });
  });
});

describe('validate middleware', () => {
  let req, res, next;
  
  beforeEach(() => {
    req = { body: {}, query: {}, params: {} };
    res = {};
    next = jest.fn();
  });
  
  it('should validate request body', async () => {
    const schema = {
      email: { required: true, type: 'email' },
      name: { required: true, type: 'string', min: 1, max: 50 }
    };
    
    req.body = {
      email: 'test@example.com',
      name: 'Test User'
    };
    
    const middleware = validate(schema);
    await middleware(req, res, next);
    
    expect(req.validated).toEqual({
      email: 'test@example.com',
      name: 'Test User'
    });
    expect(next).toHaveBeenCalledWith();
  });
  
  it('should call next with ValidationError for invalid data', async () => {
    const schema = {
      email: { required: true, type: 'email' }
    };
    
    req.body = {
      email: 'invalid-email'
    };
    
    const middleware = validate(schema);
    await middleware(req, res, next);
    
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });
  
  it('should check query and params if not in body', async () => {
    const schema = {
      page: { required: false, type: 'number' },
      id: { required: true, type: 'string' }
    };
    
    req.query = { page: '2' };
    req.params = { id: '123' };
    
    const middleware = validate(schema);
    await middleware(req, res, next);
    
    expect(req.validated).toEqual({
      page: 2,
      id: '123'
    });
    expect(next).toHaveBeenCalledWith();
  });
});
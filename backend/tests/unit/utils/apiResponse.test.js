const ApiResponse = require('../../../src/utils/apiResponse');

describe('ApiResponse', () => {
  let res;
  
  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });
  
  describe('success', () => {
    it('should send success response with default values', () => {
      ApiResponse.success(res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Success',
        data: null,
        timestamp: expect.any(String)
      });
    });
    
    it('should send success response with custom data', () => {
      const data = { id: 1, name: 'Test' };
      ApiResponse.success(res, data, 'Custom message', 201);
      
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Custom message',
        data,
        timestamp: expect.any(String)
      });
    });
  });
  
  describe('created', () => {
    it('should send created response', () => {
      const data = { id: 1 };
      ApiResponse.created(res, data);
      
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Resource created successfully',
        data,
        timestamp: expect.any(String)
      });
    });
  });
  
  describe('updated', () => {
    it('should send updated response', () => {
      const data = { id: 1, updated: true };
      ApiResponse.updated(res, data);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Resource updated successfully',
        data,
        timestamp: expect.any(String)
      });
    });
  });
  
  describe('deleted', () => {
    it('should send deleted response', () => {
      ApiResponse.deleted(res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Resource deleted successfully',
        data: null,
        timestamp: expect.any(String)
      });
    });
  });
  
  describe('paginated', () => {
    it('should send paginated response', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const pagination = {
        page: 1,
        limit: 10,
        total: 50
      };
      
      ApiResponse.paginated(res, data, pagination);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Success',
        data,
        pagination: {
          page: 1,
          limit: 10,
          total: 50,
          totalPages: 5
        },
        timestamp: expect.any(String)
      });
    });
  });
  
  describe('error', () => {
    it('should send error response with defaults', () => {
      ApiResponse.error(res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred'
        },
        timestamp: expect.any(String)
      });
    });
    
    it('should send error response with custom values', () => {
      ApiResponse.error(res, 'Not found', 404, 'NOT_FOUND', { id: 'Invalid ID' });
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Not found',
          details: { id: 'Invalid ID' }
        },
        timestamp: expect.any(String)
      });
    });
  });
});
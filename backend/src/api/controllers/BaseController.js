const ApiResponse = require('../../utils/apiResponse');
const { AppError } = require('../middleware/errorHandler');

/**
 * Base Controller Class
 * Provides common functionality for all controllers
 */
class BaseController {
    constructor(service) {
        this.service = service;
    }

    /**
     * Generic get all resources with pagination
     */
    async getAll(req, res, next) {
        try {
            const { page = 1, limit = 20, sort = 'created_at', order = 'DESC', ...filters } = req.query;
            
            const offset = (page - 1) * limit;
            const result = await this.service.findAll({
                filters,
                limit: parseInt(limit),
                offset: parseInt(offset),
                sort,
                order
            });

            if (result.total > 0) {
                return ApiResponse.paginated(res, result.items, {
                    total: result.total,
                    page: parseInt(page),
                    perPage: parseInt(limit)
                }, 'Resources retrieved successfully');
            }

            return ApiResponse.success(res, [], 'No resources found');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Generic get resource by ID
     */
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const resource = await this.service.findById(id);

            if (!resource) {
                throw new AppError('Resource not found', 404);
            }

            return ApiResponse.success(res, resource, 'Resource retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Generic create resource
     */
    async create(req, res, next) {
        try {
            const userId = req.user?.id;
            const data = { ...req.body, created_by: userId };
            
            const resource = await this.service.create(data);
            return ApiResponse.created(res, resource, 'Resource created successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Generic update resource
     */
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user?.id;
            const data = { ...req.body, updated_by: userId };

            const resource = await this.service.update(id, data);
            
            if (!resource) {
                throw new AppError('Resource not found', 404);
            }

            return ApiResponse.updated(res, resource, 'Resource updated successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Generic delete resource
     */
    async delete(req, res, next) {
        try {
            const { id } = req.params;
            const result = await this.service.delete(id);

            if (!result) {
                throw new AppError('Resource not found', 404);
            }

            return ApiResponse.deleted(res, 'Resource deleted successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Generic bulk create resources
     */
    async bulkCreate(req, res, next) {
        try {
            const userId = req.user?.id;
            const items = req.body.items || req.body;
            
            if (!Array.isArray(items)) {
                throw new AppError('Invalid data format. Expected array of items', 400);
            }

            const dataWithUser = items.map(item => ({
                ...item,
                created_by: userId
            }));

            const resources = await this.service.bulkCreate(dataWithUser);
            return ApiResponse.created(res, resources, `${resources.length} resources created successfully`);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Generic bulk update resources
     */
    async bulkUpdate(req, res, next) {
        try {
            const userId = req.user?.id;
            const { ids, data } = req.body;

            if (!Array.isArray(ids) || !data) {
                throw new AppError('Invalid request. Expected ids array and data object', 400);
            }

            const updateData = { ...data, updated_by: userId };
            const result = await this.service.bulkUpdate(ids, updateData);

            return ApiResponse.updated(res, result, `${result.affected} resources updated successfully`);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Generic bulk delete resources
     */
    async bulkDelete(req, res, next) {
        try {
            const { ids } = req.body;

            if (!Array.isArray(ids)) {
                throw new AppError('Invalid request. Expected ids array', 400);
            }

            const result = await this.service.bulkDelete(ids);
            return ApiResponse.deleted(res, `${result.affected} resources deleted successfully`);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Generic search resources
     */
    async search(req, res, next) {
        try {
            const { q, page = 1, limit = 20, ...filters } = req.query;

            if (!q) {
                throw new AppError('Search query is required', 400);
            }

            const offset = (page - 1) * limit;
            const result = await this.service.search({
                query: q,
                filters,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            if (result.total > 0) {
                return ApiResponse.paginated(res, result.items, {
                    total: result.total,
                    page: parseInt(page),
                    perPage: parseInt(limit)
                }, 'Search completed successfully');
            }

            return ApiResponse.success(res, [], 'No results found');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Generic count resources
     */
    async count(req, res, next) {
        try {
            const filters = req.query;
            const count = await this.service.count(filters);

            return ApiResponse.success(res, { count }, 'Count retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Generic exists check
     */
    async exists(req, res, next) {
        try {
            const filters = req.query;
            const exists = await this.service.exists(filters);

            return ApiResponse.success(res, { exists }, 'Existence check completed');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Helper method to validate required fields
     */
    validateRequired(data, fields) {
        const missing = fields.filter(field => !data[field]);
        if (missing.length > 0) {
            throw new AppError(`Missing required fields: ${missing.join(', ')}`, 400);
        }
    }

    /**
     * Helper method to sanitize data
     */
    sanitizeData(data, allowedFields) {
        const sanitized = {};
        allowedFields.forEach(field => {
            if (data[field] !== undefined) {
                sanitized[field] = data[field];
            }
        });
        return sanitized;
    }

    /**
     * Helper method to check ownership
     */
    async checkOwnership(resourceId, userId, errorMessage = 'Unauthorized access to resource') {
        const resource = await this.service.findById(resourceId);
        
        if (!resource) {
            throw new AppError('Resource not found', 404);
        }

        if (resource.user_id !== userId && resource.created_by !== userId) {
            throw new AppError(errorMessage, 403);
        }

        return resource;
    }

    /**
     * Helper method to handle file uploads
     */
    handleFileUpload(req, fieldName = 'file') {
        if (!req.files || !req.files[fieldName]) {
            throw new AppError('No file uploaded', 400);
        }

        const file = req.files[fieldName];
        return {
            filename: file.name,
            mimetype: file.mimetype,
            size: file.size,
            data: file.data
        };
    }
}

module.exports = BaseController;
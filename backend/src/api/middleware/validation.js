/**
 * Input validation middleware
 */

const { ValidationError } = require('../../utils/errors');
const { REGEX, LIMITS } = require('../../utils/constants');

class Validator {
  // Common field validators
  static email(email) {
    if (!email || !REGEX.EMAIL.test(email)) {
      throw new ValidationError('Invalid email format', { email: 'Must be a valid email address' });
    }
    return email.toLowerCase().trim();
  }
  
  static username(username) {
    if (!username || !REGEX.USERNAME.test(username)) {
      throw new ValidationError('Invalid username', { 
        username: 'Must be 3-30 characters, alphanumeric with underscores and hyphens' 
      });
    }
    return username.toLowerCase().trim();
  }
  
  static password(password) {
    if (!password || !REGEX.PASSWORD.test(password)) {
      throw new ValidationError('Invalid password', { 
        password: 'Must be at least 8 characters with uppercase, lowercase, and number' 
      });
    }
    return password;
  }
  
  static required(value, fieldName) {
    if (value === undefined || value === null || value === '') {
      throw new ValidationError(`${fieldName} is required`, { 
        [fieldName]: 'This field is required' 
      });
    }
    return value;
  }
  
  static stringLength(value, fieldName, min = 1, max = 1000) {
    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`, { 
        [fieldName]: 'Must be a string' 
      });
    }
    
    const trimmed = value.trim();
    if (trimmed.length < min || trimmed.length > max) {
      throw new ValidationError(`${fieldName} length invalid`, { 
        [fieldName]: `Must be between ${min} and ${max} characters` 
      });
    }
    
    return trimmed;
  }
  
  static date(value, fieldName) {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new ValidationError(`Invalid ${fieldName}`, { 
        [fieldName]: 'Must be a valid date' 
      });
    }
    return date;
  }
  
  static boolean(value, fieldName) {
    if (typeof value !== 'boolean') {
      throw new ValidationError(`${fieldName} must be boolean`, { 
        [fieldName]: 'Must be true or false' 
      });
    }
    return value;
  }
  
  static arrayOf(array, fieldName, itemValidator) {
    if (!Array.isArray(array)) {
      throw new ValidationError(`${fieldName} must be an array`, { 
        [fieldName]: 'Must be an array' 
      });
    }
    
    return array.map((item, index) => {
      try {
        return itemValidator(item);
      } catch (error) {
        throw new ValidationError(`Invalid item in ${fieldName}[${index}]`, { 
          [`${fieldName}[${index}]`]: error.message 
        });
      }
    });
  }
  
  static pagination(page, limit) {
    const validatedPage = Math.max(1, parseInt(page) || 1);
    const validatedLimit = Math.min(
      LIMITS.MAX_PAGE_SIZE,
      Math.max(1, parseInt(limit) || LIMITS.DEFAULT_PAGE_SIZE)
    );
    
    return {
      page: validatedPage,
      limit: validatedLimit,
      offset: (validatedPage - 1) * validatedLimit
    };
  }
}

// Validation middleware factory
const validate = (schema) => {
  return async (req, res, next) => {
    try {
      const validated = {};
      
      // Validate each field according to schema
      for (const [field, validators] of Object.entries(schema)) {
        const value = req.body[field] ?? req.query[field] ?? req.params[field];
        
        if (validators.required && (value === undefined || value === null || value === '')) {
          throw new ValidationError(`${field} is required`, { 
            [field]: 'This field is required' 
          });
        }
        
        if (value !== undefined && value !== null && value !== '') {
          let validatedValue = value;
          
          // Apply validators in sequence
          if (validators.type) {
            switch (validators.type) {
              case 'email':
                validatedValue = Validator.email(value);
                break;
              case 'username':
                validatedValue = Validator.username(value);
                break;
              case 'password':
                validatedValue = Validator.password(value);
                break;
              case 'string':
                validatedValue = Validator.stringLength(
                  value, 
                  field, 
                  validators.min || 1, 
                  validators.max || 1000
                );
                break;
              case 'number':
                validatedValue = Number(value);
                if (isNaN(validatedValue)) {
                  throw new ValidationError(`${field} must be a number`, { 
                    [field]: 'Must be a number' 
                  });
                }
                break;
              case 'boolean':
                validatedValue = Validator.boolean(value, field);
                break;
              case 'date':
                validatedValue = Validator.date(value, field);
                break;
              case 'array':
                validatedValue = Validator.arrayOf(
                  value, 
                  field, 
                  validators.itemValidator || (x => x)
                );
                break;
            }
          }
          
          // Custom validator
          if (validators.custom) {
            validatedValue = validators.custom(validatedValue, field);
          }
          
          validated[field] = validatedValue;
        }
      }
      
      // Merge validated data back into request
      req.validated = validated;
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Common validation schemas
const schemas = {
  auth: {
    register: {
      username: { required: true, type: 'username' },
      email: { required: true, type: 'email' },
      password: { required: true, type: 'password' },
      firstName: { required: true, type: 'string', min: 1, max: 50 },
      lastName: { required: true, type: 'string', min: 1, max: 50 }
    },
    login: {
      username: { required: true, type: 'string' },
      password: { required: true, type: 'string' }
    },
    changePassword: {
      currentPassword: { required: true, type: 'string' },
      newPassword: { required: true, type: 'password' }
    }
  },
  
  profile: {
    update: {
      firstName: { required: false, type: 'string', min: 1, max: 50 },
      lastName: { required: false, type: 'string', min: 1, max: 50 },
      email: { required: false, type: 'email' },
      phone: { required: false, type: 'string', max: 20 },
      location: { required: false, type: 'string', max: 100 },
      bio: { required: false, type: 'string', max: 1000 }
    }
  },
  
  experience: {
    create: {
      title: { required: true, type: 'string', min: 1, max: 200 },
      company: { required: true, type: 'string', min: 1, max: 200 },
      startDate: { required: true, type: 'date' },
      endDate: { required: false, type: 'date' },
      description: { required: false, type: 'string', max: 5000 },
      responsibilities: { required: false, type: 'array' },
      achievements: { required: false, type: 'array' },
      skills: { required: false, type: 'array' },
      location: { required: false, type: 'string', max: 100 },
      employmentType: { required: false, type: 'string', max: 50 }
    },
    update: {
      title: { required: false, type: 'string', min: 1, max: 200 },
      company: { required: false, type: 'string', min: 1, max: 200 },
      startDate: { required: false, type: 'date' },
      endDate: { required: false, type: 'date' },
      description: { required: false, type: 'string', max: 5000 },
      responsibilities: { required: false, type: 'array' },
      achievements: { required: false, type: 'array' },
      skills: { required: false, type: 'array' },
      location: { required: false, type: 'string', max: 100 },
      employmentType: { required: false, type: 'string', max: 50 }
    }
  },
  
  chat: {
    message: {
      message: { required: true, type: 'string', min: 1, max: 2000 },
      conversationId: { required: false, type: 'string' }
    }
  },
  
  resume: {
    generate: {
      templateId: { required: false, type: 'string' },
      targetRole: { required: false, type: 'string', max: 200 },
      includeSkills: { required: false, type: 'boolean' },
      includeEducation: { required: false, type: 'boolean' },
      includeAchievements: { required: false, type: 'boolean' },
      atsOptimized: { required: false, type: 'boolean' },
      format: { required: false, type: 'string', custom: (value) => {
        const validFormats = ['pdf', 'docx', 'json'];
        if (!validFormats.includes(value)) {
          throw new ValidationError('Invalid format', { format: 'Must be pdf, docx, or json' });
        }
        return value;
      }}
    }
  },
  
  analytics: {
    skillRecommendations: {
      targetRole: { required: true, type: 'string', min: 1, max: 200 },
      currentSkills: { required: false, type: 'array' }
    },
    export: {
      format: { required: false, type: 'string', custom: (value) => {
        const validFormats = ['json', 'csv', 'pdf'];
        if (!validFormats.includes(value)) {
          throw new ValidationError('Invalid format', { format: 'Must be json, csv, or pdf' });
        }
        return value;
      }}
    }
  },
  
  cpaPert: {
    analyzeExperience: {
      experienceId: { required: true, type: 'string' }
    },
    generateResponse: {
      experienceId: { required: true, type: 'string' },
      competencyMappings: { required: true, type: 'array' }
    },
    validateRequirements: {
      experiences: { required: true, type: 'array' }
    }
  },
  
  pagination: {
    page: { required: false, type: 'number' },
    limit: { required: false, type: 'number' },
    sort: { required: false, type: 'string' },
    order: { required: false, type: 'string', custom: (value) => {
      if (!['asc', 'desc'].includes(value)) {
        throw new ValidationError('Invalid order', { order: 'Must be asc or desc' });
      }
      return value;
    }}
  },
  
  search: {
    query: { required: true, type: 'string', min: 1, max: 200 }
  }
};

module.exports = {
  Validator,
  validate,
  schemas
};
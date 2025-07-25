const Joi = require('joi');

const validateExperienceData = (data, isUpdate = false) => {
  const schema = Joi.object({
    title: isUpdate 
      ? Joi.string().min(3).max(200).optional()
      : Joi.string().min(3).max(200).required()
        .messages({
          'string.min': 'Title must be at least 3 characters long',
          'string.max': 'Title must not exceed 200 characters',
          'any.required': 'Title is required'
        }),
    
    organization: Joi.string()
      .min(2)
      .max(200)
      .optional()
      .messages({
        'string.min': 'Organization must be at least 2 characters long',
        'string.max': 'Organization must not exceed 200 characters'
      }),
    
    department: Joi.string()
      .max(100)
      .optional()
      .messages({
        'string.max': 'Department must not exceed 100 characters'
      }),
    
    location: Joi.string()
      .max(200)
      .optional()
      .messages({
        'string.max': 'Location must not exceed 200 characters'
      }),
    
    description: isUpdate
      ? Joi.string().min(10).max(5000).optional()
      : Joi.string().min(10).max(5000).required()
        .messages({
          'string.min': 'Description must be at least 10 characters long',
          'string.max': 'Description must not exceed 5000 characters',
          'any.required': 'Description is required'
        }),
    
    startDate: isUpdate
      ? Joi.date().iso().max('now').optional()
      : Joi.date().iso().max('now').required()
        .messages({
          'date.max': 'Start date cannot be in the future',
          'any.required': 'Start date is required'
        }),
    
    endDate: Joi.date()
      .iso()
      .min(Joi.ref('startDate'))
      .max('now')
      .optional()
      .messages({
        'date.min': 'End date must be after start date',
        'date.max': 'End date cannot be in the future'
      }),
    
    isCurrent: Joi.boolean()
      .optional()
      .default(false),
    
    experienceType: Joi.string()
      .valid('work', 'education', 'volunteer', 'project', 'certification', 'other')
      .optional()
      .default('work')
      .messages({
        'any.only': 'Invalid experience type'
      }),
    
    employmentType: Joi.string()
      .valid('full-time', 'part-time', 'contract', 'freelance', 'internship', 'temporary')
      .optional()
      .when('experienceType', {
        is: 'work',
        then: Joi.required()
      })
      .messages({
        'any.only': 'Invalid employment type',
        'any.required': 'Employment type is required for work experiences'
      }),
    
    extractedSkills: Joi.array()
      .items(Joi.string().max(50))
      .max(20)
      .optional()
      .messages({
        'array.max': 'Maximum 20 skills allowed'
      }),
    
    keyHighlights: Joi.array()
      .items(Joi.string().max(500))
      .max(10)
      .optional()
      .messages({
        'array.max': 'Maximum 10 highlights allowed',
        'string.max': 'Each highlight must not exceed 500 characters'
      }),
    
    quantifiedImpacts: Joi.array()
      .items(Joi.object({
        metric: Joi.string().required(),
        value: Joi.number().required(),
        unit: Joi.string().optional(),
        description: Joi.string().optional()
      }))
      .max(10)
      .optional()
      .messages({
        'array.max': 'Maximum 10 quantified impacts allowed'
      }),
    
    technologiesUsed: Joi.array()
      .items(Joi.string().max(50))
      .max(30)
      .optional()
      .messages({
        'array.max': 'Maximum 30 technologies allowed'
      }),
    
    achievements: Joi.array()
      .items(Joi.string().max(500))
      .max(10)
      .optional()
      .messages({
        'array.max': 'Maximum 10 achievements allowed',
        'string.max': 'Each achievement must not exceed 500 characters'
      }),
    
    teamSize: Joi.number()
      .integer()
      .min(1)
      .max(10000)
      .optional()
      .messages({
        'number.min': 'Team size must be at least 1',
        'number.max': 'Team size seems unrealistic'
      }),
    
    budgetManaged: Joi.number()
      .min(0)
      .max(1000000000)
      .optional()
      .messages({
        'number.min': 'Budget cannot be negative',
        'number.max': 'Budget seems unrealistic'
      }),
    
    revenueImpact: Joi.number()
      .min(0)
      .optional()
      .messages({
        'number.min': 'Revenue impact cannot be negative'
      }),
    
    costSavings: Joi.number()
      .min(0)
      .optional()
      .messages({
        'number.min': 'Cost savings cannot be negative'
      })
  })
  .custom((value, helpers) => {
    // Custom validation: if isCurrent is true, endDate should not be provided
    if (value.isCurrent && value.endDate) {
      return helpers.error('custom.currentWithEndDate');
    }
    // If isCurrent is false and no endDate, require endDate
    if (value.isCurrent === false && !value.endDate) {
      return helpers.error('custom.notCurrentWithoutEndDate');
    }
    return value;
  }, 'Experience date validation')
  .messages({
    'custom.currentWithEndDate': 'Current experiences should not have an end date',
    'custom.notCurrentWithoutEndDate': 'Completed experiences must have an end date'
  });

  return schema.validate(data);
};

const validateExperienceFilters = (filters) => {
  const schema = Joi.object({
    type: Joi.string()
      .valid('work', 'education', 'volunteer', 'project', 'certification', 'other')
      .optional(),
    current: Joi.string()
      .valid('true', 'false')
      .optional(),
    from: Joi.date()
      .iso()
      .optional(),
    to: Joi.date()
      .iso()
      .min(Joi.ref('from'))
      .optional()
      .messages({
        'date.min': 'To date must be after from date'
      }),
    search: Joi.string()
      .max(200)
      .optional(),
    limit: Joi.string()
      .pattern(/^\d+$/)
      .optional()
      .messages({
        'string.pattern.base': 'Limit must be a number'
      })
  });

  return schema.validate(filters);
};

module.exports = {
  validateExperienceData,
  validateExperienceFilters
};
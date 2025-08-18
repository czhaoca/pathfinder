// Mock services for unit testing

module.exports = {
  userService: {
    findByEmail: jest.fn(),
    findByUsername: jest.fn(),
    create: jest.fn(),
    createUserSchema: jest.fn()
  },
  
  emailService: {
    sendVerificationEmail: jest.fn(),
    sendWelcomeEmail: jest.fn(),
    validateEmailDomain: jest.fn()
  },
  
  featureFlagService: {
    evaluateFlag: jest.fn(),
    updateFlag: jest.fn()
  },
  
  auditService: {
    logRegistration: jest.fn(),
    logSecurityEvent: jest.fn()
  }
};
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

class UserService {
  constructor(userRepository, sessionRepository, auditService) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.auditService = auditService;
  }

  async getUserProfile(userId) {
    return await this.userRepository.findById(userId);
  }

  async updateProfile(userId, profileData) {
    // Check if email is already taken by another user
    if (profileData.email) {
      const existingUser = await this.userRepository.findByEmail(profileData.email);
      if (existingUser && existingUser.userId !== userId) {
        const error = new Error('Email already in use');
        error.code = 'DUPLICATE_EMAIL';
        throw error;
      }
    }

    await this.userRepository.updateProfile(userId, profileData);
    
    await this.auditService.logDataAccess({
      userId,
      action: 'PROFILE_UPDATED',
      resourceType: 'user',
      resourceId: userId,
      operation: 'update',
      success: true
    });

    return await this.userRepository.findById(userId);
  }

  async changePassword(userId, { currentPassword, newPassword, ipAddress, userAgent }) {
    const user = await this.userRepository.findById(userId);
    
    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!validPassword) {
      await this.auditService.logAuth({
        userId,
        action: 'PASSWORD_CHANGE_FAILED',
        resourceType: 'user',
        resourceId: userId,
        ipAddress,
        userAgent,
        success: false,
        errorMessage: 'Invalid current password'
      });
      
      const error = new Error('Current password is incorrect');
      error.code = 'INVALID_PASSWORD';
      throw error;
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.updatePassword(userId, passwordHash);

    // Invalidate all sessions
    await this.sessionRepository.invalidateUserSessions(userId);

    await this.auditService.logAuth({
      userId,
      action: 'PASSWORD_CHANGED',
      resourceType: 'user',
      resourceId: userId,
      ipAddress,
      userAgent,
      success: true
    });
  }

  async deleteAccount(userId, { password, ipAddress, userAgent }) {
    const user = await this.userRepository.findById(userId);
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      const error = new Error('Invalid password');
      error.code = 'INVALID_PASSWORD';
      throw error;
    }

    // Soft delete - change account status
    await this.userRepository.updateAccountStatus(userId, 'deleted');
    
    // Invalidate all sessions
    await this.sessionRepository.invalidateUserSessions(userId);

    await this.auditService.logAuth({
      userId,
      action: 'ACCOUNT_DELETED',
      resourceType: 'user',
      resourceId: userId,
      ipAddress,
      userAgent,
      success: true
    });
  }

  async getUserStats(userId) {
    // This would be extended to include actual stats
    return {
      userId,
      experienceCount: 0,
      lastActivity: new Date(),
      profileCompleteness: 50
    };
  }
}

module.exports = UserService;
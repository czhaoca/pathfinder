const logger = require('../../utils/logger');

class ProfileController {
  constructor(userService) {
    this.userService = userService;
  }

  async getProfile(req, res, next) {
    try {
      const user = await this.userService.getUserProfile(req.user.userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        id: user.userId,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        accountStatus: user.accountStatus
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const { firstName, lastName, email } = req.body;
      
      const updatedUser = await this.userService.updateProfile(req.user.userId, {
        firstName,
        lastName,
        email
      });

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.userId,
          username: updatedUser.username,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName
        }
      });
    } catch (error) {
      if (error.code === 'DUPLICATE_EMAIL') {
        return res.status(409).json({ error: error.message });
      }
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      
      await this.userService.changePassword(req.user.userId, {
        currentPassword,
        newPassword,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      if (error.code === 'INVALID_PASSWORD') {
        return res.status(401).json({ error: error.message });
      }
      next(error);
    }
  }

  async deleteAccount(req, res, next) {
    try {
      const { password } = req.body;
      
      await this.userService.deleteAccount(req.user.userId, {
        password,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      if (error.code === 'INVALID_PASSWORD') {
        return res.status(401).json({ error: error.message });
      }
      next(error);
    }
  }
}

module.exports = ProfileController;
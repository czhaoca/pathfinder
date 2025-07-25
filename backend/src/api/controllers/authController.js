const { v4: uuidv4 } = require('uuid');
const AuthService = require('../../services/authService');
const { validateLoginRequest, validateRegisterRequest } = require('../../validators/authValidator');
const logger = require('../../utils/logger');

class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  async register(req, res, next) {
    try {
      const validation = validateRegisterRequest(req.body);
      if (validation.error) {
        return res.status(400).json({ error: validation.error.details[0].message });
      }

      const { username, email, password, firstName, lastName } = validation.value;

      const result = await this.authService.register({
        username,
        email,
        password,
        firstName,
        lastName,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.status(201).json(result);
    } catch (error) {
      if (error.code === 'USER_EXISTS') {
        return res.status(409).json({ error: error.message });
      }
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const validation = validateLoginRequest(req.body);
      if (validation.error) {
        return res.status(400).json({ error: validation.error.details[0].message });
      }

      const { username, password } = validation.value;

      const result = await this.authService.login({
        username,
        password,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json(result);
    } catch (error) {
      if (error.code === 'INVALID_CREDENTIALS' || error.code === 'ACCOUNT_INACTIVE') {
        return res.status(401).json({ error: error.message });
      }
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
      }

      const result = await this.authService.refreshToken(refreshToken);
      res.json(result);
    } catch (error) {
      if (error.code === 'INVALID_TOKEN' || error.code === 'SESSION_NOT_FOUND') {
        return res.status(403).json({ error: error.message });
      }
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      await this.authService.logout({
        sessionId: req.user.sessionId,
        userId: req.user.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
const ApiResponse = require('../../utils/apiResponse');
const { asyncHandler, ValidationError } = require('../../utils/errors');

class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  register = asyncHandler(async (req, res) => {
    const { username, email, password, firstName, lastName } = req.validated || req.body;

    const result = await this.authService.register({
      username,
      email,
      password,
      firstName,
      lastName,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    ApiResponse.created(res, result, 'User registered successfully');
  })

  login = asyncHandler(async (req, res) => {
    const { username, password } = req.validated || req.body;

    const result = await this.authService.login({
      username,
      password,
        ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    ApiResponse.success(res, result, 'Login successful');
  })

  refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('Refresh token required', { refreshToken: 'This field is required' });
    }

    const result = await this.authService.refreshToken(refreshToken);
    ApiResponse.success(res, result, 'Token refreshed successfully');
  })

  logout = asyncHandler(async (req, res) => {
    await this.authService.logout({
      sessionId: req.user.sessionId,
      userId: req.user.userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    ApiResponse.success(res, null, 'Logged out successfully');
  })
}

module.exports = AuthController;
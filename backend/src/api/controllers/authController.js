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

  forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.validated || req.body;

    await this.authService.forgotPassword({
      email,
      ipAddress: req.ip
    });

    ApiResponse.success(res, null, 'Password reset email sent');
  })

  resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword } = req.validated || req.body;

    await this.authService.resetPassword({
      token,
      newPassword,
      ipAddress: req.ip
    });

    ApiResponse.success(res, null, 'Password reset successful');
  })

  verifyEmail = asyncHandler(async (req, res) => {
    const { token } = req.params;

    const result = await this.authService.verifyEmail({
      token,
      ipAddress: req.ip
    });

    ApiResponse.success(res, result, 'Email verified successfully');
  })

  resendVerification = asyncHandler(async (req, res) => {
    const { email } = req.validated || req.body;

    await this.authService.resendVerification({
      email,
      ipAddress: req.ip
    });

    ApiResponse.success(res, null, 'Verification email sent');
  })

  changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.validated || req.body;

    await this.authService.changePassword({
      userId: req.user.userId,
      currentPassword,
      newPassword,
      ipAddress: req.ip
    });

    ApiResponse.success(res, null, 'Password changed successfully');
  })

  getSessions = asyncHandler(async (req, res) => {
    const sessions = await this.authService.getUserSessions(req.user.userId);

    ApiResponse.success(res, { sessions }, 'Sessions retrieved successfully');
  })

  revokeSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    await this.authService.revokeSession({
      userId: req.user.userId,
      sessionId,
      ipAddress: req.ip
    });

    ApiResponse.success(res, null, 'Session revoked successfully');
  })
}

module.exports = AuthController;
const ApiResponse = require('../../utils/apiResponse');
const { asyncHandler, ValidationError } = require('../../utils/errors');

class AuthController {
  constructor(authService, googleOAuthService, ssoService, featureFlagService) {
    this.authService = authService;
    this.googleOAuthService = googleOAuthService;
    this.ssoService = ssoService;
    this.featureFlagService = featureFlagService;
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

  // Google OAuth methods
  googleAuth = asyncHandler(async (req, res) => {
    // Check feature flag
    const isEnabled = await this.featureFlagService.isEnabled('google_oauth_enabled', req.user?.userId);
    if (!isEnabled) {
      return ApiResponse.error(res, 'Google authentication is not available', 403);
    }

    const { returnUrl = '/' } = req.query;
    const userId = req.user?.userId || null;

    const authUrl = await this.googleOAuthService.generateAuthUrl(userId, returnUrl);
    
    ApiResponse.success(res, { authUrl }, 'OAuth URL generated');
  })

  googleCallback = asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;

    // Handle OAuth errors
    if (error) {
      return res.redirect(`/login?error=${encodeURIComponent(error)}`);
    }

    try {
      const result = await this.googleOAuthService.handleCallback(code, state);

      // Generate JWT tokens
      const tokens = await this.authService.generateTokens({
        userId: result.user.id,
        username: result.user.username,
        sessionId: result.sessionId
      });

      // Set cookies
      res.cookie('access_token', tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      res.cookie('refresh_token', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Redirect to return URL or dashboard
      res.redirect(result.returnUrl || '/dashboard');
    } catch (error) {
      if (error.message === 'ACCOUNT_EXISTS_REQUIRES_MERGE') {
        // Redirect to account merge page
        res.redirect('/auth/merge?provider=google');
      } else {
        // Redirect to login with error
        res.redirect(`/login?error=${encodeURIComponent(error.message)}`);
      }
    }
  })

  googleMerge = asyncHandler(async (req, res) => {
    const { password, googleAuthCode } = req.validated || req.body;

    // Exchange code for Google user info
    const googleData = await this.googleOAuthService.exchangeCode(googleAuthCode);

    // Merge accounts with password verification
    const result = await this.googleOAuthService.mergeAccounts(
      req.user.userId,
      password,
      googleData.user,
      googleData.tokens
    );

    ApiResponse.success(res, {
      success: true,
      message: 'Google account successfully linked'
    });
  })

  googleUnlink = asyncHandler(async (req, res) => {
    await this.googleOAuthService.unlinkGoogleAccount(req.user.userId);

    ApiResponse.success(res, {
      success: true,
      message: 'Google account unlinked'
    });
  })

  getLinkedProviders = asyncHandler(async (req, res) => {
    const providers = await this.ssoService.getUserProviders(req.user.userId);
    
    const linkedProviders = providers.map(p => ({
      provider: p.provider,
      email: p.email,
      displayName: p.displayName,
      linkedAt: p.linkedAt,
      isPrimary: p.isPrimary
    }));

    ApiResponse.success(res, { 
      providers: linkedProviders,
      hasPassword: await this.authService.userHasPassword(req.user.userId)
    }, 'Linked providers retrieved');
  })
}

module.exports = AuthController;
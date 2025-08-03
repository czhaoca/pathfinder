const { errorHandler, NotFoundError, asyncHandler } = require('../../utils/errors');

class ErrorHandler {
  static handle() {
    return errorHandler;
  }

  static notFound() {
    return (req, res, next) => {
      next(new NotFoundError(`Route ${req.originalUrl}`));
    };
  }

  static asyncWrapper(fn) {
    return asyncHandler(fn);
  }
}

module.exports = ErrorHandler;
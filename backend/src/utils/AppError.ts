/**
 * Custom application error class
 */

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public data?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, data?: any): AppError {
    return new AppError(message, 400, data);
  }

  static unauthorized(message: string = 'Unauthorized'): AppError {
    return new AppError(message, 401);
  }

  static forbidden(message: string = 'Forbidden'): AppError {
    return new AppError(message, 403);
  }

  static notFound(message: string = 'Not found'): AppError {
    return new AppError(message, 404);
  }

  static conflict(message: string, data?: any): AppError {
    return new AppError(message, 409, data);
  }

  static internal(message: string = 'Internal server error'): AppError {
    return new AppError(message, 500);
  }
}

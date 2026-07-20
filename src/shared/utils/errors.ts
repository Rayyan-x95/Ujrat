export type ErrorType = 
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'NETWORK_ERROR'
  | 'STORAGE_ERROR'
  | 'UNKNOWN_ERROR';

export class AppError extends Error {
  public type: ErrorType;
  public details: unknown;

  constructor(type: ErrorType, message: string, details: unknown = null) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details: unknown = null) {
    super('VALIDATION_ERROR', message, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, details: unknown = null) {
    super('AUTHENTICATION_ERROR', message, details);
  }
}

export class NetworkError extends AppError {
  constructor(message: string, details: unknown = null) {
    super('NETWORK_ERROR', message, details);
  }
}

export class StorageError extends AppError {
  constructor(message: string, details: unknown = null) {
    super('STORAGE_ERROR', message, details);
  }
}

export class UnknownError extends AppError {
  constructor(message: string, details: unknown = null) {
    super('UNKNOWN_ERROR', message, details);
  }
}

export function handleServiceError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  
  // Handlers for Zod validation errors
  if (isZodError(error)) {
    return new ValidationError('Input validation failed', error.format());
  }

  // Supabase/Postgrest errors
  if (isPostgrestError(error)) {
    return new NetworkError(`Database Error (${error.code}): ${error.message}`, error);
  }

  return new UnknownError(getErrorMessage(error), error);
}

function isZodError(error: unknown): error is { name: 'ZodError'; format: () => unknown } {
  return typeof error === 'object' && error !== null && 'name' in error && (error as Record<string, unknown>).name === 'ZodError';
}

function isPostgrestError(error: unknown): error is { code: string; message: string } {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as Record<string, unknown>).message);
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

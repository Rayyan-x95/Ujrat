import { describe, it, expect } from 'vitest';
import { 
  AppError, 
  ValidationError, 
  NetworkError, 
  AuthenticationError, 
  StorageError, 
  UnknownError,
  handleServiceError 
} from '@/shared/utils/errors';

describe('Error Classes and Handler', () => {
  describe('AppError Classes', () => {
    it('should initialize AppError with correct type, message, and details', () => {
      const err = new AppError('VALIDATION_ERROR', 'Validation check failed', { field: 'email' });
      expect(err.name).toBe('AppError');
      expect(err.type).toBe('VALIDATION_ERROR');
      expect(err.message).toBe('Validation check failed');
      expect(err.details).toEqual({ field: 'email' });
    });

    it('should initialize specific subclasses correctly', () => {
      const validationErr = new ValidationError('Invalid name');
      expect(validationErr.type).toBe('VALIDATION_ERROR');
      expect(validationErr.message).toBe('Invalid name');

      const authErr = new AuthenticationError('Unauthorized');
      expect(authErr.type).toBe('AUTHENTICATION_ERROR');

      const networkErr = new NetworkError('Gateway timeout');
      expect(networkErr.type).toBe('NETWORK_ERROR');

      const storageErr = new StorageError('Quota exceeded');
      expect(storageErr.type).toBe('STORAGE_ERROR');
    });
  });

  describe('handleServiceError', () => {
    it('should return the error unmodified if it is already an AppError instance', () => {
      const appErr = new ValidationError('Incorrect payload');
      const result = handleServiceError(appErr);
      expect(result).toBe(appErr);
    });

    it('should translate Zod validation errors to ValidationError', () => {
      const zodMockErr = {
        name: 'ZodError',
        format: () => ({ email: { _errors: ['Required'] } })
      };
      const result = handleServiceError(zodMockErr);
      expect(result).toBeInstanceOf(ValidationError);
      expect(result.message).toBe('Input validation failed');
      expect(result.details).toEqual({ email: { _errors: ['Required'] } });
    });

    it('should translate database/supabase errors with code to NetworkError', () => {
      const dbMockErr = {
        code: '23505',
        message: 'duplicate key value violates unique constraint'
      };
      const result = handleServiceError(dbMockErr);
      expect(result).toBeInstanceOf(NetworkError);
      expect(result.message).toContain('Database Error (23505)');
      expect(result.details).toBe(dbMockErr);
    });

    it('should wrap default generic errors in UnknownError', () => {
      const standardErr = new Error('Something went wrong');
      const result = handleServiceError(standardErr);
      expect(result).toBeInstanceOf(UnknownError);
      expect(result.message).toBe('Something went wrong');
      expect(result.details).toBe(standardErr);
    });
  });
});

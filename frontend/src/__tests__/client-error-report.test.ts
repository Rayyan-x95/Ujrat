import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoggingService, scrubSensitive } from '@/features/auth/services/LoggingService';
import { supabase } from '@/shared/lib/supabaseClient';

vi.mock('@/shared/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const insertMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  insertMock.mockResolvedValue({ error: null });
  vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any);
});

describe('LoggingService.reportClientError', () => {
  it('inserts a client_error row scoped to the workspace', async () => {
    await LoggingService.reportClientError('ws-1', new Error('boom'));
    const call = insertMock.mock.calls[0]?.[0] as any;
    expect(call?.workspace_id).toBe('ws-1');
    expect(call?.action).toBe('client_error');
    const details = call.details as Record<string, unknown>;
    expect(details.message).toBe('boom');
    expect(details.route).toBeDefined();
  });

  it('scrubs portal tokens from messages before persisting', async () => {
    await LoggingService.reportClientError('ws-1', new Error('failed at /portal/abcdef1234567890abcdef12345678/x'));
    const details = (insertMock.mock.calls[0]?.[0] as any).details as Record<string, unknown>;
    expect(details.message).not.toContain('abcdef1234567890');
    expect(details.message).toContain('portal/<token>');
  });

  it('dedupes identical errors within 60s', async () => {
    await LoggingService.reportClientError('ws-1', new Error('same'));
    await LoggingService.reportClientError('ws-1', new Error('same'));
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it('never throws, even when supabase fails', async () => {
    insertMock.mockRejectedValue(new Error('db down'));
    await expect(LoggingService.reportClientError('ws-1', new Error('x'))).resolves.toBeUndefined();
  });

  it('without a workspace, logs locally instead of writing', async () => {
    await LoggingService.reportClientError(null, new Error('pre-auth crash'));
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe('scrubSensitive', () => {
  it('masks portal tokens in URLs', () => {
    expect(scrubSensitive('open /portal/0123456789abcdef0123456789abcdef now')).toBe('open /portal/<token> now');
    expect(scrubSensitive('prefix-portal/abc-def')).toBe('prefix-portal/<token>');
  });

  it('redacts key= style secrets', () => {
    expect(scrubSensitive('apikey=supersecretvalue')).toBe('apikey=<redacted>');
  });
});

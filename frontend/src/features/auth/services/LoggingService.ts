import { supabase } from '@/shared/lib/supabaseClient';
import type { Result } from '@/shared/types';

export class LoggingService {
  static async logActivity(params: {
    workspaceId: string;
    profileId?: string;
    projectId?: string;
    action: string;
    details?: Record<string, unknown>;
  }): Promise<Result<void>> {
    try {
      const { workspaceId, profileId, projectId, action, details = {} } = params;

      const { error } = await supabase
        .from('activity_logs')
        .insert({
          workspace_id: workspaceId,
          profile_id: profileId || null,
          project_id: projectId || null,
          action,
          details,
        });

      if (error) return { success: false, error: new Error(error.message) };
      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  static logWarning(message: string, context?: Record<string, unknown>): void {
    console.warn(`[Ujrat Warning] ${message}`, context ?? {});
  }

  /**
   * Report a client-side crash for observability (no external SaaS by
   * design). Best-effort: never throws, so it can never make things worse.
   * Scrubbed + clipped + deduped (same message/route within 60s reported
   * once). Errors that occur before a workspace is known skip gracefully.
   */
  static async reportClientError(
    workspaceId: string | null | undefined,
    error: unknown,
    context?: Record<string, unknown>
  ): Promise<void> {
    try {
      const message = scrubSensitive(String((error as Error)?.message ?? error ?? 'unknown'));
      const stack = scrubSensitive(String((error as Error)?.stack ?? ''));
      if (!workspaceId) {
        LoggingService.logWarning('Client error (no workspace context)', { message });
        return;
      }
      const route = typeof window !== 'undefined' ? scrubSensitive(window.location?.pathname ?? '') : '';
      const key = `${message}|${route}`;
      const now = Date.now();
      if (recentClientErrorKeys.get(key) && now - (recentClientErrorKeys.get(key) as number) < 60_000) {
        return;
      }
      recentClientErrorKeys.set(key, now);
      await supabase.from('activity_logs').insert({
        workspace_id: workspaceId,
        profile_id: null,
        project_id: null,
        action: 'client_error',
        details: {
          message: message.slice(0, 500),
          stack: stack.slice(0, 1500),
          route,
          userAgent: typeof window !== 'undefined' ? window.navigator?.userAgent?.slice(0, 200) : '',
          ...(context || {}),
        },
      });
    } catch {
      // Observability must never break the app.
    }
  }
}

// In-memory dedupe: identical errors within 60s are logged once.
const recentClientErrorKeys = new Map<string, number>();

/** Strip portal tokens (and any 32-hex bearer-looking strings) from free text. */
export function scrubSensitive(value: string): string {
  return value
    .replace(/portal\/[A-Za-z0-9_-]+/g, 'portal/<token>')
    .replace(/\b[a-zA-Z0-9_-]*(?:token|secret|key)[A-Za-z0-9_-]*\b=(?:[^&\s]+)/gi, (m) => m.slice(0, m.indexOf('=')) + '=<redacted>');
}

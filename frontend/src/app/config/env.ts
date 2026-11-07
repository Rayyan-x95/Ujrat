const getEnvVars = () => {
  const isTest = Boolean((import.meta.env as any)?.VITEST);

  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL ||
    (isTest ? 'http://localhost:54321' : undefined);

  const supabaseAnonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    (isTest ? 'test-anon-key' : undefined);

  const appUrl = import.meta.env.VITE_APP_URL || 'http://localhost:5173';

  let urlValid = false;
  try {
    urlValid = Boolean(supabaseUrl && new URL(supabaseUrl));
  } catch {
    urlValid = false;
  }

  if (!urlValid || !supabaseAnonKey) {
    const missing: string[] = [];
    if (!urlValid) missing.push('VITE_SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');

    const msg =
      `[Ujrat Config Error] Missing or invalid environment variables: ${missing.join(', ')}.\n` +
      `If deploying on Vercel: go to Project Settings -> Environment Variables and ensure both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set for Production and Preview environments.`;
    console.error(msg);

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const showOverlay = () => {
        const root = document.getElementById('root');
        if (root && !root.hasChildNodes()) {
          root.innerHTML = `
            <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#09090b;color:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;padding:24px;box-sizing:border-box;">
              <div style="max-width:540px;width:100%;background:#18181b;border:1px solid #27272a;border-radius:12px;padding:32px;box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                  <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#ef4444;"></span>
                  <h2 style="margin:0;font-size:18px;font-weight:600;color:#f4f4f5;">Environment Configuration Required</h2>
                </div>
                <p style="margin:0 0 16px;font-size:14px;color:#a1a1aa;line-height:1.5;">
                  Ujrat requires the following environment variables to communicate with Supabase:
                </p>
                <div style="background:#27272a;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-family:ui-monospace,monospace;font-size:13px;color:#fca5a5;">
                  ${missing.map((m) => `<div>• ${m}</div>`).join('')}
                </div>
                <div style="background:#141416;border:1px solid #27272a;border-radius:8px;padding:16px;font-size:13px;color:#d4d4d8;line-height:1.6;">
                  <strong style="color:#ffffff;">How to resolve on Vercel:</strong><br/>
                  1. Open your project on <a href="https://vercel.com/dashboard" target="_blank" rel="noopener" style="color:#60a5fa;text-decoration:underline;">Vercel Dashboard</a><br/>
                  2. Go to <strong>Settings &rarr; Environment Variables</strong><br/>
                  3. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code><br/>
                  4. Select <strong>Production</strong> &amp; <strong>Preview</strong><br/>
                  5. Trigger a <strong>Redeploy</strong> under Deployments
                </div>
              </div>
            </div>
          `;
        }
      };

      if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', showOverlay);
      } else {
        setTimeout(showOverlay, 0);
      }
    }

    throw new Error(`Invalid environment configuration: Missing ${missing.join(', ')}`);
  }

  return {
    VITE_SUPABASE_URL: supabaseUrl as string,
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey as string,
    VITE_APP_URL: appUrl,
  };
};

export const env = getEnvVars();
export default env;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const checks: Record<string, { status: 'healthy' | 'degraded' | 'down'; latency_ms: number; details?: string }> = {};

  // 1. Database connectivity
  const dbStart = Date.now();
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    checks.database = {
      status: error ? 'down' : 'healthy',
      latency_ms: Date.now() - dbStart,
      details: error?.message,
    };
  } catch (e) {
    checks.database = { status: 'down', latency_ms: Date.now() - dbStart, details: String(e) };
  }

  // 2. Auth service
  const authStart = Date.now();
  try {
    const { error } = await supabase.auth.getSession();
    checks.auth = {
      status: error ? 'degraded' : 'healthy',
      latency_ms: Date.now() - authStart,
      details: error?.message,
    };
  } catch (e) {
    checks.auth = { status: 'down', latency_ms: Date.now() - authStart, details: String(e) };
  }

  // 3. Storage service
  const storageStart = Date.now();
  try {
    const { error } = await supabase.storage.listBuckets();
    checks.storage = {
      status: error ? 'down' : 'healthy',
      latency_ms: Date.now() - storageStart,
      details: error?.message,
    };
  } catch (e) {
    checks.storage = { status: 'down', latency_ms: Date.now() - storageStart, details: String(e) };
  }

  // 4. Realtime
  const realtimeStart = Date.now();
  try {
    const channel = supabase.channel('health-check');
    const { error } = await channel.subscribe();
    await supabase.removeChannel(channel);
    checks.realtime = {
      status: error ? 'degraded' : 'healthy',
      latency_ms: Date.now() - realtimeStart,
      details: error?.message,
    };
  } catch (e) {
    checks.realtime = { status: 'down', latency_ms: Date.now() - realtimeStart, details: String(e) };
  }

  const overallStatus = Object.values(checks).every(c => c.status === 'healthy') 
    ? 'healthy' 
    : Object.values(checks).some(c => c.status === 'down') 
      ? 'down' 
      : 'degraded';

  return new Response(
    JSON.stringify({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    }),
    {
      status: overallStatus === 'down' ? 503 : 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
});

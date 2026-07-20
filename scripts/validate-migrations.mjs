import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDirectory = join(projectRoot, 'supabase', 'migrations');
const baselineFilename = '000_baseline.sql';
const requiredSchemaMarkers = [
  'CREATE TABLE public.profiles',
  'CREATE TABLE public.workspaces',
  'CREATE TABLE public.projects',
  'CREATE TABLE public.contracts',
  'CREATE TABLE public.invoices',
  'CREATE TABLE public.payments',
];
const portalFunctions = [
  'get_portal_project',
  'get_portal_client',
  'get_portal_settings',
  'get_portal_proposal',
  'get_portal_contract',
];

function fail(message) {
  process.stderr.write(`Migration validation failed: ${message}\n`);
  process.exitCode = 1;
}

function getFunctionBody(sql, functionName) {
  const expression = new RegExp(
    `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${functionName}\\s*\\([^)]*\\)[\\s\\S]*?AS\\s+\\$\\$([\\s\\S]*?)\\$\\$;`,
    'i',
  );
  return sql.match(expression)?.[1];
}

const entries = await readdir(migrationsDirectory, { withFileTypes: true });
const activeMigrations = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
  .map((entry) => entry.name)
  .sort();

if (activeMigrations.length !== 1 || activeMigrations[0] !== baselineFilename) {
  fail(`expected only ${baselineFilename} as an active migration; found ${activeMigrations.join(', ') || 'none'}`);
}

if (entries.some((entry) => entry.isDirectory() && entry.name === 'archive')) {
  fail('legacy migrations must not be retained in supabase/migrations/archive');
}

const baselinePath = join(migrationsDirectory, baselineFilename);
const baseline = await readFile(baselinePath, 'utf8');

if (!baseline.includes('consolidated baseline migration')) {
  fail(`${baselineFilename} must identify itself as the consolidated baseline`);
}

for (const marker of requiredSchemaMarkers) {
  if (!baseline.includes(marker)) {
    fail(`${baselineFilename} is missing required schema marker: ${marker}`);
  }
}

for (const marker of [
  'CREATE TABLE public.edge_function_rate_limits',
  'CREATE OR REPLACE FUNCTION public.consume_edge_rate_limit',
]) {
  if (!baseline.includes(marker)) {
    fail(`${baselineFilename} is missing required security marker: ${marker}`);
  }
}

for (const functionName of portalFunctions) {
  const body = getFunctionBody(baseline, functionName);
  if (!body) {
    fail(`${baselineFilename} is missing portal function ${functionName}`);
    continue;
  }

  if (!body.includes('portal_token_expires_at')) {
    fail(`${functionName} does not enforce portal token expiry`);
  }
}

if (/CREATE POLICY[\s\S]*?FOR SELECT USING \([\s\S]*?auth\.role\(\) = 'anon'/i.test(baseline)) {
  fail('anonymous direct storage SELECT policies are not permitted');
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

process.stdout.write(`Migration validation passed: ${baselineFilename} is the only active migration.\n`);

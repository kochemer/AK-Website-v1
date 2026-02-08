/**
 * Preflight check for required environment variables for weekly digest build
 * Exits with code 1 if required vars are missing, 0 if all OK
 */

const REQUIRED_VARS = [
  'OPENAI_API_KEY', // Required for LLM calls (summaries, translations, reranking, etc.)
];

const OPTIONAL_BUT_RECOMMENDED_VARS = [
  'TAVILY_API_KEY', // Required for discovery step (workflow runs discovery by default)
];

function checkEnvVars(): { ok: boolean; missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required vars
  for (const varName of REQUIRED_VARS) {
    const value = process.env[varName];
    if (!value || value.trim().length === 0) {
      missing.push(varName);
    }
  }

  // Check optional but recommended vars
  for (const varName of OPTIONAL_BUT_RECOMMENDED_VARS) {
    const value = process.env[varName];
    if (!value || value.trim().length === 0) {
      warnings.push(varName);
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    warnings,
  };
}

function main() {
  const { ok, missing, warnings } = checkEnvVars();

  if (!ok) {
    console.error('❌ Preflight check failed: Missing required environment variables');
    console.error('');
    console.error('Missing required variables:');
    missing.forEach(varName => {
      console.error(`  - ${varName}`);
    });
    console.error('');
    console.error('Please set these environment variables before running the digest build.');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Preflight check passed with warnings:');
    warnings.forEach(varName => {
      console.warn(`  - ${varName} is not set (may be required if discovery step runs)`);
    });
    console.warn('');
  }

  console.log('✅ Preflight check passed: All required environment variables are present');
  process.exit(0);
}

main();

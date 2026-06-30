// config/env.js
// Validates all required environment variables at startup.
// The server will refuse to start if anything critical is missing.

const required = [
  'MONGODB_URI',
  'JWT_SECRET',
]

const optional = {
  PORT: '8000',
  NODE_ENV: 'development',
  CLIENT_URL: 'http://localhost:5173',
  JWT_EXPIRES_IN: '7d',
  GROQ_API_KEY: null,
}

export const validateEnv = () => {
  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    console.error('\n[Krimson] Missing required environment variables:')
    missing.forEach((key) => console.error(`  ✗ ${key}`))
    console.error('\nCopy .env.example to .env and fill in the values.\n')
    process.exit(1)
  }

  // Apply defaults for optional vars
  Object.entries(optional).forEach(([key, defaultVal]) => {
    if (!process.env[key] && defaultVal !== null) {
      process.env[key] = defaultVal
    }
  })

  if (!process.env.GROQ_API_KEY) {
    console.warn('[Krimson] GEMINI_API_KEY not set — AI features will be disabled.')
  }

  console.log('[Krimson] Environment validated.')
}

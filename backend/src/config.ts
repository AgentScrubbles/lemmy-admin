import dotenv from 'dotenv';

dotenv.config();

// Debug: Log environment variables
console.log('Loading config with env vars:', {
  DB_CONNECTION_STRING: process.env.DB_CONNECTION_STRING ? '***SET***' : 'not set',
  DB_SSL_REJECT_UNAUTHORIZED: process.env.DB_SSL_REJECT_UNAUTHORIZED,
});

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    // Connection string takes precedence over individual parameters
    connectionString: process.env.DB_CONNECTION_STRING || undefined,
    // Individual parameters as fallback
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'lemmy',
    user: process.env.DB_USER || 'lemmy',
    password: process.env.DB_PASSWORD || '',
    // Pool configuration
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    // SSL configuration (for self-signed certs)
    sslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  },

  lemmy: {
    instanceUrl: process.env.LEMMY_INSTANCE_URL || 'https://poptalk.scrubbles.tech',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
} as const;

// Validate required environment variables
const requiredEnvVars = [
  'DB_PASSWORD',
  'LEMMY_INSTANCE_URL',
];

const missingEnvVars = requiredEnvVars.filter(
  (envVar) => !process.env[envVar]
);

if (missingEnvVars.length > 0 && config.nodeEnv === 'production') {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}`
  );
}

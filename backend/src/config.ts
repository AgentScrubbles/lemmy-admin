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
const requiredEnvVars: string[] = [];

// Database: Either connection string OR individual parameters required
if (!process.env.DB_CONNECTION_STRING) {
  // If no connection string, require individual DB parameters
  if (!process.env.DB_PASSWORD) {
    requiredEnvVars.push('DB_PASSWORD');
  }
  if (!process.env.DB_HOST) {
    requiredEnvVars.push('DB_HOST');
  }
}

// Lemmy instance URL always required
if (!process.env.LEMMY_INSTANCE_URL) {
  requiredEnvVars.push('LEMMY_INSTANCE_URL');
}

if (requiredEnvVars.length > 0 && config.nodeEnv === 'production') {
  throw new Error(
    `Missing required environment variables: ${requiredEnvVars.join(', ')}`
  );
}

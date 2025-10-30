import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'lemmy',
    user: process.env.DB_USER || 'lemmy',
    password: process.env.DB_PASSWORD || '',
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

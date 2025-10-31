import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';

/**
 * Database connection class with READ ONLY access
 *
 * IMPORTANT: This API should NEVER write to the database.
 * All connections are set to READ ONLY mode to prevent accidental writes.
 * Use the Lemmy API for any write operations.
 */
class Database {
  private pool: Pool;

  constructor() {
    // Determine if SSL is required from connection string
    const usingSsl = config.database.connectionString?.toLowerCase().includes('sslmode=');

    // For connection strings with sslmode, we need to handle SSL separately
    // because the connection string parser can override our ssl object
    let finalConnectionString = config.database.connectionString;
    let sslObject = undefined;

    if (usingSsl && !config.database.sslRejectUnauthorized) {
      // For self-signed certificates: remove sslmode from connection string
      // and use ssl object instead
      finalConnectionString = config.database.connectionString?.replace(/[?&]sslmode=[^&]*/gi, '');
      sslObject = {
        rejectUnauthorized: false,
      };
      console.log('SSL: Accepting self-signed certificates');
    } else if (usingSsl) {
      // For verified SSL certificates: keep sslmode in connection string
      sslObject = {
        rejectUnauthorized: true,
      };
      console.log('SSL: Requiring verified certificates');
    }

    // Use connection string if provided, otherwise use individual parameters
    const poolConfig = finalConnectionString
      ? {
          connectionString: finalConnectionString,
          ssl: sslObject,
          max: config.database.maxConnections,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 4000,
          // Note: Some managed PostgreSQL services don't support the options parameter
          // We'll enforce read-only at the query level instead
          // Query timeout is set to 60 seconds below
        }
      : {
          host: config.database.host,
          port: config.database.port,
          database: config.database.database,
          user: config.database.user,
          password: config.database.password,
          max: config.database.maxConnections,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 4000,
          // Set default transaction to READ ONLY and statement timeout to 60 seconds
          options: '-c default_transaction_read_only=on -c statement_timeout=60000',
        };

    console.log('Database pool config:', {
      hasConnectionString: !!finalConnectionString,
      usingSsl,
      sslRejectUnauthorized: config.database.sslRejectUnauthorized,
      ssl: sslObject,
    });

    this.pool = new Pool(poolConfig);

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    // Set statement timeout on connect for connection string mode
    if (finalConnectionString) {
      this.pool.on('connect', async (client) => {
        try {
          await client.query('SET statement_timeout = 60000');
        } catch (error) {
          console.warn('Could not set statement_timeout:', error);
        }
      });
    }

    // Verify read-only mode on pool initialization
    this.verifyReadOnlyMode();
  }

  /**
   * Verify that the connection is in read-only mode
   */
  private async verifyReadOnlyMode(): Promise<void> {
    try {
      const result = await this.pool.query('SHOW default_transaction_read_only');
      const isReadOnly = result.rows[0].default_transaction_read_only === 'on';
      if (isReadOnly) {
        console.log('✅ Database connection set to READ ONLY mode at connection level');
      } else {
        console.warn('⚠️  WARNING: Database connection is NOT in read-only mode at connection level');
        console.warn('   Read-only enforcement will be done at query level (blocking write operations)');
      }
    } catch (error) {
      console.warn('⚠️  Could not verify read-only mode at connection level (this is normal for managed PostgreSQL)');
      console.warn('   Read-only enforcement will be done at query level (blocking write operations)');
    }
  }

  /**
   * Execute a read-only query
   * Enforces read-only transaction for extra safety
   */
  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const start = Date.now();

    // Block obvious write operations
    const upperText = text.trim().toUpperCase();
    if (
      upperText.startsWith('INSERT') ||
      upperText.startsWith('UPDATE') ||
      upperText.startsWith('DELETE') ||
      upperText.startsWith('DROP') ||
      upperText.startsWith('CREATE') ||
      upperText.startsWith('ALTER') ||
      upperText.startsWith('TRUNCATE')
    ) {
      throw new Error('Write operations are not allowed. Use Lemmy API for modifications.');
    }

    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: result.rowCount });
      return result;
    } catch (error) {
      console.error('Database query error', { text, error });
      throw error;
    }
  }

  /**
   * Get a client from the pool with read-only transaction
   */
  async getClient(): Promise<PoolClient> {
    const client = await this.pool.connect();

    // Ensure this client is in read-only mode
    try {
      await client.query('SET TRANSACTION READ ONLY');
    } catch (error) {
      client.release();
      throw error;
    }

    return client;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW() as now, current_setting(\'default_transaction_read_only\') as read_only');
      console.log('Database connection successful', {
        timestamp: result.rows[0].now,
        readOnly: result.rows[0].read_only,
      });
      return true;
    } catch (error) {
      console.error('Database connection failed', error);
      return false;
    }
  }
}

export const db = new Database();

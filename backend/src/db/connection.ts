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
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      // Set default transaction to READ ONLY
      options: '-c default_transaction_read_only=on',
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

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
        console.log('✅ Database connection set to READ ONLY mode');
      } else {
        console.warn('⚠️  WARNING: Database connection is NOT in read-only mode!');
      }
    } catch (error) {
      console.error('Failed to verify read-only mode:', error);
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

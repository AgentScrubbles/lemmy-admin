# Database Setup Guide

## Creating a Read-Only Database User

For maximum security, create a dedicated read-only user for the admin portal:

```sql
-- Connect to your Lemmy database as a superuser
-- Replace 'lemmy' with your actual database name

-- Create read-only user
CREATE USER lemmy_admin_readonly WITH PASSWORD 'your_secure_password';

-- Grant CONNECT privilege
GRANT CONNECT ON DATABASE lemmy TO lemmy_admin_readonly;

-- Grant USAGE on schema
GRANT USAGE ON SCHEMA public TO lemmy_admin_readonly;

-- Grant SELECT on all existing tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO lemmy_admin_readonly;

-- Automatically grant SELECT on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO lemmy_admin_readonly;

-- Verify permissions
\c lemmy
\du lemmy_admin_readonly
```

Then update your `.env`:
```env
DB_USER=lemmy_admin_readonly
DB_PASSWORD=your_secure_password
```

## Docker Networking Scenarios

### Scenario 1: Backend in Docker, Database on Host

**docker-compose.yml:**
```yaml
services:
  backend:
    environment:
      # Mac/Windows
      - DB_HOST=host.docker.internal
      # Linux (uncomment if above doesn't work)
      # - DB_HOST=172.17.0.1
```

### Scenario 2: Both Backend and Lemmy in Docker

If Lemmy is running in a separate Docker Compose stack:

```bash
# Find Lemmy's network
docker network ls | grep lemmy

# Connect backend to Lemmy's network
docker network connect lemmy_default lemmy-admin-backend

# Use Lemmy's postgres service name as DB_HOST
```

**docker-compose.yml:**
```yaml
services:
  backend:
    environment:
      - DB_HOST=postgres  # or whatever Lemmy calls it
    networks:
      - default
      - lemmy_default

networks:
  lemmy_default:
    external: true
```

### Scenario 3: Backend on Host, Database in Docker

**backend/.env:**
```env
DB_HOST=localhost
DB_PORT=5432  # or whatever port you've exposed
```

Make sure PostgreSQL is exposed:
```bash
# Check if port is exposed
docker ps | grep postgres
```

## Connection String Examples

### Local Development
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lemmy
DB_USER=lemmy_admin_readonly
DB_PASSWORD=your_password
```

### Docker to Docker (same network)
```env
DB_HOST=postgres
DB_PORT=5432
DB_NAME=lemmy
DB_USER=lemmy_admin_readonly
DB_PASSWORD=your_password
```

### Docker to Host
```env
# Mac/Windows
DB_HOST=host.docker.internal

# Linux
DB_HOST=172.17.0.1

DB_PORT=5432
DB_NAME=lemmy
DB_USER=lemmy_admin_readonly
DB_PASSWORD=your_password
```

## Testing Connection

### From Host
```bash
# Test with psql
psql -h localhost -p 5432 -U lemmy_admin_readonly -d lemmy -c "SELECT version();"

# Test with backend
cd backend
npm run dev
# Look for: ✅ Database connection set to READ ONLY mode
```

### From Docker Container
```bash
# Exec into the backend container
docker exec -it lemmy-admin-backend sh

# Test connection (if psql is available)
# Or check the logs
docker logs lemmy-admin-backend
```

## Common Issues

### "Connection refused"
- PostgreSQL is not running
- Wrong host or port
- Firewall blocking connection
- PostgreSQL not configured to accept connections from your IP

### "Password authentication failed"
- Wrong username or password
- User doesn't exist
- PostgreSQL pg_hba.conf not configured for your connection method

### "Database does not exist"
- Wrong database name
- Connected to wrong PostgreSQL instance

### "Permission denied"
- User doesn't have SELECT permissions
- User doesn't have CONNECT permission
- User doesn't have USAGE permission on schema

## PostgreSQL Configuration

If PostgreSQL is only accepting local connections, update `postgresql.conf`:

```conf
# Listen on all interfaces (be careful with security!)
listen_addresses = '*'
```

And `pg_hba.conf`:
```conf
# Allow connections from Docker network
host    lemmy    lemmy_admin_readonly    172.17.0.0/16    scram-sha-256

# Or allow from specific IP
host    lemmy    lemmy_admin_readonly    192.168.1.100/32    scram-sha-256
```

**Remember to restart PostgreSQL after changes!**

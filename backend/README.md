# Lemmy Admin Backend API

Backend API server for the Lemmy Admin Portal that provides **READ-ONLY** direct database access for advanced analytics and user behavior analysis.

## Features

- **READ-ONLY** PostgreSQL database access to Lemmy database
- JWT authentication using Lemmy's existing auth tokens
- Admin-only access control
- RESTful API endpoints for user analysis
- CORS support for frontend integration

## Important: Read-Only Design

This backend API is **strictly read-only**:

- All database connections are configured with `default_transaction_read_only=on`
- Write operations (INSERT, UPDATE, DELETE, etc.) are explicitly blocked
- Any modifications should be done via the Lemmy API
- The database user should ideally have only SELECT permissions

**Why?** This prevents accidental data corruption and ensures all writes go through Lemmy's proper validation and business logic.

## Prerequisites

- Node.js 20 or higher
- Access to Lemmy PostgreSQL database
- Lemmy JWT secret

## Configuration

### Environment Variables

Create a `.env` file in the `backend/` directory based on `.env.example`:

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# PostgreSQL Database Configuration
DB_HOST=postgres                    # Your PostgreSQL host
DB_PORT=5432                        # PostgreSQL port
DB_NAME=lemmy                       # Database name
DB_USER=lemmy                       # Database user
DB_PASSWORD=your_database_password  # Database password

# Lemmy Instance Configuration
LEMMY_INSTANCE_URL=https://poptalk.scrubbles.tech  # Your Lemmy instance URL

# CORS Configuration
CORS_ORIGIN=http://localhost:3000   # Frontend URL
```

### Authentication Method

The backend validates authentication tokens by calling the Lemmy API's `/site` endpoint with the provided token. This means:

- **No JWT Secret Required**: The backend doesn't need to know Lemmy's JWT secret
- **Always Up-to-Date**: User status (banned, admin, etc.) is verified in real-time against Lemmy
- **Secure**: Tokens are validated by Lemmy itself, not decoded locally

## Development

### Install Dependencies

```bash
cd backend
npm install
```

### Run Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3001` with hot-reload enabled.

### Build for Production

```bash
npm run build
npm start
```

## API Endpoints

All API endpoints require authentication via Bearer token in the Authorization header.

### Health Check

```
GET /health
```

No authentication required. Returns database connection status.

### User Routes

All user routes require admin authentication.

```
GET /api/users/health
GET /api/users/:userId
GET /api/users/search/:query?limit=20
```

## Authentication

All protected endpoints require a valid Lemmy JWT token:

```
Authorization: Bearer <lemmy_jwt_token>
```

The backend validates:
1. Token is valid and not expired
2. User exists and is not banned
3. User has admin privileges

## Docker Deployment

### Build Image

```bash
docker build -t lemmy-admin-backend .
```

### Run Container

```bash
docker run -d \
  -p 3001:3001 \
  -e DB_HOST=your_postgres_host \
  -e DB_PASSWORD=your_db_password \
  -e LEMMY_JWT_SECRET=your_jwt_secret \
  --name lemmy-admin-backend \
  lemmy-admin-backend
```

### Using Docker Compose

See the root `docker-compose.yml` for full stack deployment.

## Database Schema

The backend expects the standard Lemmy database schema. Key tables used:

- `person` - User information
- `person_aggregates` - User statistics (post/comment counts and scores)
- `post` - Posts
- `comment` - Comments
- `community` - Communities
- Additional tables as needed for advanced queries

## Security Considerations

- Database credentials are never exposed to the frontend
- All queries are parameterized to prevent SQL injection
- Authentication tokens are verified on every request
- Only admins can access the API
- CORS is configured to only allow requests from your frontend

## Troubleshooting

### Database Connection Issues

**When running in Docker:**
- If Lemmy's PostgreSQL is also in Docker, use the service name or container name as DB_HOST
- If Lemmy's PostgreSQL is on the host machine, use `host.docker.internal` (Mac/Windows) or `172.17.0.1` (Linux)
- You may need to connect the backend to Lemmy's Docker network: `docker network connect lemmy_default lemmy-admin-backend`

**When running locally (npm run dev):**
- Use `localhost` or `127.0.0.1` as DB_HOST
- Ensure PostgreSQL is accessible on the specified port
- Check firewall rules if using a remote database

**General checks:**
- Database host and port are correct
- Database credentials are valid
- PostgreSQL is accessible from the backend
- Network connectivity between backend and database
- Database user has SELECT permissions

### Authentication Issues

Check:
- `LEMMY_INSTANCE_URL` is correct and accessible from the backend
- Token is being sent in Authorization header as `Bearer <token>`
- User is an admin in the Lemmy database
- Token hasn't expired
- Lemmy instance is responding to `/api/v3/site` endpoint

## License

MIT

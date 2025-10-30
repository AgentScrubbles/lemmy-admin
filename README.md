# Lemmy Admin Portal

A modern, sleek admin portal for Lemmy instances with both light and dark themes. This full-stack application allows Lemmy administrators to manage users, communities, reports, and view moderation logs with advanced analytics powered by direct database access.

## Features

- **Authentication**: Secure login with Lemmy credentials and 2FA support
- **Admin-Only Access**: Automatic verification of admin privileges
- **Theme Support**: Toggle between light and dark themes
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **User Analysis**: Comprehensive user behavior analytics with voting patterns, community activity, and engagement metrics
- **Community Monitoring**: Track community health and engagement for moderated communities
- **Dashboard**: Site-wide statistics and active user metrics
- **Direct Database Access**: Advanced queries via backend API for detailed analytics

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **UI Library**: Material-UI (MUI) v6
- **Routing**: React Router v6
- **Charts**: Recharts
- **HTTP Client**: Axios
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express with TypeScript
- **Database**: PostgreSQL (direct connection to Lemmy database)
- **Authentication**: JWT validation using Lemmy's secret

### Deployment
- **Containers**: Docker + Docker Compose
- **Web Server**: Nginx (for frontend)
- **Reverse Proxy**: Traefik support (optional)

## Prerequisites

- Node.js 20 or higher (for local development)
- Docker and Docker Compose (for containerized deployment)
- A Lemmy instance with:
  - API access
  - PostgreSQL database access
  - JWT secret
- Admin credentials for your Lemmy instance

## Configuration

### Environment Variables

Create a `.env` file in the root directory (copy from `.env.example`):

```env
# Lemmy Instance Configuration
LEMMY_INSTANCE_URL=https://poptalk.scrubbles.tech
VITE_LEMMY_INSTANCE_URL=https://poptalk.scrubbles.tech

# Backend API Configuration
BACKEND_API_URL=http://localhost:3001
VITE_BACKEND_API_URL=http://localhost:3001

# PostgreSQL Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=lemmy
DB_USER=lemmy
DB_PASSWORD=your_database_password

# Lemmy JWT Secret (must match your Lemmy instance's JWT secret)
LEMMY_JWT_SECRET=your_lemmy_jwt_secret

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

**Important Configuration Notes:**

1. **LEMMY_INSTANCE_URL**: Your Lemmy instance URL (used to validate auth tokens via Lemmy API)

2. **Database Credentials**: Should have read access to your Lemmy PostgreSQL database

3. **CORS_ORIGIN**: Should match your frontend URL (including protocol and port)

**Authentication**: The backend validates tokens by calling your Lemmy instance's API, so no JWT secret is required!

## Local Development

For detailed local development instructions, see [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md).

### Quick Start (Localhost)

```bash
# Install all dependencies
npm install
cd backend && npm install && cd ..

# Configure .env with your database settings
cp .env.example .env
# Edit .env - ensure DB_HOST=localhost

# Terminal 1: Start backend
npm run dev:backend

# Terminal 2: Start frontend
npm run dev
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

### Build for Production

```bash
# Build both frontend and backend
npm run build:all

# Or separately:
npm run build           # Frontend -> dist/
npm run build:backend   # Backend -> backend/dist/
```

Deploy the built artifacts to your Kubernetes cluster or hosting platform.

## Docker Deployment (Optional)

Docker Compose is provided for local development convenience. For production, deploy to Kubernetes or your preferred platform.

### Using Docker Compose

1. Configure your environment variables in the `.env` file:

```env
# Lemmy Instance
LEMMY_INSTANCE_URL=https://poptalk.scrubbles.tech
VITE_LEMMY_INSTANCE_URL=https://poptalk.scrubbles.tech

# Backend API
BACKEND_API_URL=http://backend:3001
VITE_BACKEND_API_URL=http://localhost:3001

# Database (your Lemmy PostgreSQL)
DB_HOST=your-postgres-host
DB_PORT=5432
DB_NAME=lemmy
DB_USER=lemmy
DB_PASSWORD=your_database_password

# CORS
CORS_ORIGIN=http://localhost:3000
```

2. Build and start both services:

```bash
docker-compose up -d
```

Services will be available at:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- Backend health check: `http://localhost:3001/health`

### Using Docker Directly

#### Backend

```bash
cd backend
docker build -t lemmy-admin-backend .
docker run -d \
  -p 3001:3001 \
  -e DB_HOST=your-postgres-host \
  -e DB_PASSWORD=your_db_password \
  -e LEMMY_INSTANCE_URL=https://poptalk.scrubbles.tech \
  --name lemmy-admin-backend \
  lemmy-admin-backend
```

#### Frontend

```bash
docker build -t lemmy-admin-frontend .

2. Run the container:

```bash
docker run -d \
  -p 3000:80 \
  -e VITE_LEMMY_INSTANCE_URL=https://poptalk.scrubbles.tech \
  --name lemmy-admin-view \
  lemmy-admin-view
```

### With Traefik (Reverse Proxy)

The `docker-compose.yml` includes labels for Traefik. Update the `Host` rule to match your domain:

```yaml
- "traefik.http.routers.lemmy-admin.rule=Host(`admin.your-domain.com`)"
```

## Usage

1. Navigate to the application URL
2. Sign in with your Lemmy administrator credentials
3. If 2FA is enabled, enter your TOTP token
4. Access will be granted only if you have admin privileges on the Lemmy instance

## Project Structure

```
lemmy-admin-view/
├── src/
│   ├── components/          # Reusable components
│   │   ├── Layout.tsx       # Main layout with navigation
│   │   └── ProtectedRoute.tsx  # Route protection
│   ├── contexts/            # React contexts
│   │   ├── AuthContext.tsx  # Authentication state
│   │   └── ThemeContext.tsx # Theme management
│   ├── pages/               # Page components
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   ├── Users.tsx
│   │   ├── Communities.tsx
│   │   ├── Reports.tsx
│   │   ├── Modlog.tsx
│   │   └── Unauthorized.tsx
│   ├── services/            # API services
│   │   └── lemmy.ts         # Lemmy API client
│   ├── App.tsx              # Main app component
│   ├── config.ts            # Configuration
│   ├── theme.ts             # MUI theme definition
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
├── Dockerfile               # Docker build configuration
├── docker-compose.yml       # Docker Compose setup
├── nginx.conf               # Nginx configuration
├── vite.config.ts           # Vite configuration
└── package.json             # Dependencies
```

## Security Considerations

- **Frontend-Only**: This application runs entirely in the browser and communicates directly with the Lemmy API
- **Token Storage**: Authentication tokens are stored in localStorage
- **HTTPS Required**: Always use HTTPS in production to protect authentication tokens
- **Admin Verification**: Access is restricted to users with admin privileges
- **CORS**: Ensure your Lemmy instance allows CORS requests from your admin portal domain

## Roadmap

### Phase 1 (Current)
- [x] Authentication and admin verification
- [x] Basic layout and navigation
- [x] Light/dark theme support
- [x] Docker deployment

### Phase 2 (Next)
- [ ] Dashboard with site statistics
- [ ] User search and profile viewing
- [ ] User activity timeline
- [ ] Ban/unban users

### Phase 3
- [ ] Community listing and statistics
- [ ] Community health metrics
- [ ] Engagement graphs

### Phase 4
- [ ] Reports queue management
- [ ] Moderation log viewer
- [ ] Advanced filtering and search

## Contributing

This is an iterative project. Contributions and feature requests are welcome!

## License

MIT

## Support

For issues or questions, please open an issue on the project repository.

# Local Development Guide

This guide is for running the Lemmy Admin Portal locally (without Docker) for development.

## Prerequisites

- Node.js 20+
- Access to Lemmy PostgreSQL database on localhost (port 5432)
- Your Lemmy instance must be accessible (for auth validation)

## Quick Start

### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 2. Configure Environment

Both frontend and backend use the root `.env` file:

```bash
# Copy example if you don't have .env
cp .env.example .env

# Edit .env with your settings
# Key settings for localhost:
# - DB_HOST=localhost
# - DB_PORT=5432
# - VITE_BACKEND_API_URL=http://localhost:3001
```

Your `.env` should look like:
```env
# Lemmy Instance
LEMMY_INSTANCE_URL=https://poptalk.scrubbles.tech
VITE_LEMMY_INSTANCE_URL=https://poptalk.scrubbles.tech

# Backend API (localhost for local dev)
BACKEND_API_URL=http://localhost:3001
VITE_BACKEND_API_URL=http://localhost:3001

# PostgreSQL on localhost
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lemmy
DB_USER=lemmy
DB_PASSWORD=your_actual_password

# CORS
CORS_ORIGIN=http://localhost:3000
```

### 3. Run Backend

In one terminal:
```bash
npm run dev:backend

# Or directly in backend folder:
cd backend
npm run dev
```

You should see:
```
✅ Database connection set to READ ONLY mode
🚀 Lemmy Admin Backend running on port 3001
```

### 4. Run Frontend

In another terminal:
```bash
npm run dev

# Or:
npm run dev:frontend
```

The frontend will be available at: **http://localhost:3000**

## Project Structure

```
lemmy-admin-view/
├── backend/              # Backend API (Node.js/Express)
│   ├── src/
│   │   ├── index.ts     # Server entry point
│   │   ├── config.ts    # Configuration
│   │   ├── db/          # Database connection
│   │   ├── middleware/  # Auth middleware
│   │   └── routes/      # API routes
│   └── .env            # Backend config (symlink to root .env)
├── src/                 # Frontend (React)
│   ├── pages/          # Page components
│   ├── components/     # Reusable components
│   ├── contexts/       # React contexts
│   └── services/       # API clients
└── .env                # Shared environment config
```

## Available Scripts

From the root directory:

```bash
# Frontend
npm run dev              # Start frontend dev server
npm run build            # Build frontend for production

# Backend
npm run dev:backend      # Start backend dev server
npm run build:backend    # Build backend for production

# Both
npm run build:all        # Build both frontend and backend
```

## Testing the Setup

### 1. Test Backend Health
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-10-29T20:45:32.454Z"
}
```

### 2. Test Database Connection
The backend logs should show:
```
✅ Database connection set to READ ONLY mode
Database connection successful { timestamp: ..., readOnly: 'on' }
```

### 3. Test Authentication
1. Open http://localhost:3000
2. Login with your Lemmy admin credentials
3. You should see the dashboard

## Common Issues

### Backend can't connect to database

**Check PostgreSQL is accessible:**
```bash
# Test connection
psql -h localhost -p 5432 -U lemmy -d lemmy -c "SELECT version();"
```

**Check your .env:**
- `DB_HOST=localhost` (not postgres, not an IP)
- `DB_PORT=5432` (or whatever port your PostgreSQL is on)
- Database credentials are correct

**Check PostgreSQL configuration:**
- `postgresql.conf`: `listen_addresses` includes localhost
- `pg_hba.conf`: allows local connections

### Port already in use

**Backend (port 3001):**
```bash
# Find what's using the port
lsof -i :3001

# Kill it if needed
kill -9 <PID>
```

**Frontend (port 3000):**
```bash
# Find what's using the port
lsof -i :3000

# Kill it if needed
kill -9 <PID>
```

### Frontend can't reach backend

Check:
- Backend is running on port 3001
- `VITE_BACKEND_API_URL=http://localhost:3001` in `.env`
- CORS is set to `http://localhost:3000` in backend
- No firewall blocking localhost connections

### Authentication fails

Check:
- `LEMMY_INSTANCE_URL` is correct and accessible
- Your Lemmy instance is running
- You're using admin credentials
- Network can reach your Lemmy instance

## Development Workflow

1. **Start backend** in one terminal: `npm run dev:backend`
2. **Start frontend** in another terminal: `npm run dev`
3. **Make changes** - both will hot-reload
4. **Test in browser** at http://localhost:3000

## Production Build

When you're ready to deploy:

```bash
# Build both
npm run build:all

# Or separately
npm run build           # Frontend -> dist/
npm run build:backend   # Backend -> backend/dist/

# For production deployment, use Kubernetes or your preferred platform
# Frontend: Serve dist/ with nginx or similar
# Backend: Run backend/dist/index.js with Node.js
```

## Notes

- The backend is **read-only** by design - no database writes
- All modifications go through the Lemmy API
- Docker Compose is available but not required for local development
- For production, use Kubernetes or your deployment platform of choice

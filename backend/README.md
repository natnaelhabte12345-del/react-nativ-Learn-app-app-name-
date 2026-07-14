Duolingo Clone — Minimal Backend Sketch

This is a small standalone backend sketch to support user/progress sync for the Duolingo clone app.

Quick start:

1. Install dependencies:

```bash
cd backend
npm install
```

2. Run the server:

```bash
npm run start
```

API endpoints:
- GET /health — health check
- GET /users — list users
- POST /users — create a user { "clerkId": "...", "email": "..." }
- GET /progress?userId=... — list progress for a user
- POST /progress — upsert progress { "userId": 1, "lessonId": "...", "completed": true, "xp": 10 }

DB:
- Uses `better-sqlite3` with a local `data/db.sqlite` file. The DB is initialized automatically on server start.

Notes:
- This is a sketch: production setups need auth, proper migrations, backups, and secure secrets management.

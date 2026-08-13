# IV Innovations - BMI Tracker & Multi-User Management Application (Restructured Full-Stack SPA)

This version is restructured into separate frontend and backend architectures:
- **`backend/`**: A Node.js Express server that serves custom REST API endpoints for user sessions, sub-profiles, and weight history logging, with database persistence in a local `db.json` file.
- **`frontend/`**: The modern Single Page Application (SPA) client interface that makes async `fetch` queries to the backend APIs.

---

## 📂 Directory Structure

```
c:\Users\faisal hasan\Downloads\app\
├── backend/
│   ├── data/
│   │   └── db.json       # Persistent JSON Database file (persists user & profile states)
│   ├── package.json      # Node dependencies config (express, cors)
│   └── server.js         # Express server source code (auth, profile, and logging endpoints)
├── frontend/
│   ├── index.html        # Main dashboard markup structure
│   ├── styles.css        # Layout, styling variables, animations, and typography
│   └── app.js            # Client-side JavaScript (connects UI to backend API endpoints)
└── README.md             # Setup and running instructions (this file)
```

---

## 🛠️ API Endpoints Implemented

### Authentication
- `POST /api/auth/register`: Create a new email/password account.
- `POST /api/auth/login`: Authenticate standard email/password user sessions.
- `POST /api/auth/google`: Simulated Google Login OAuth handler (persists mock Google accounts).

### Profile Switcher
- `GET /api/profiles`: Retrieve list of sub-profiles for the active user.
- `POST /api/profiles`: Add a new family member/sub-profile with custom parameters.
- `PUT /api/profiles/:profileIndex`: Update current height, weight, gender, and log today's metrics.
- `DELETE /api/profiles/:profileIndex`: Delete profile at a specified index.

### Weight Logs
- `POST /api/profiles/:profileIndex/logs`: Log weight metrics for a selected date.
- `DELETE /api/profiles/:profileIndex/logs/:logDate`: Delete weight log entry by date string.

---

## 🚀 How to Build and Run the Application

Since the frontend and backend are decoupled, you run the Node Express server, which serves both the REST API endpoints and static client files on a single port for convenience.

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Setup Steps

1. **Install Backend Dependencies**:
   Open your terminal/command prompt in the `backend/` folder and run:
   ```bash
   cd backend
   npm install
   ```

2. **Start the Unified Server**:
   Launch the Express server by executing the following command in the `backend/` folder:
   ```bash
   npm start
   ```
   *Note: By default, the server listens on port `5000`. You can change the port by setting the `PORT` environment variable (e.g. `$env:PORT=8080; npm start` in PowerShell).*

3. **Open the Application**:
   Open your browser and navigate to:
   👉 **[http://localhost:5000](http://localhost:5000)** (or the custom port if set, e.g. `http://localhost:8080`).

---

## 🔑 Test Credentials
To simplify testing, the database (`backend/data/db.json`) is pre-populated with a demo account:
- **Email**: `user@example.com`
- **Password**: `password123`

You can also register a new account, recover passwords, or sign in using simulated Google authorization.

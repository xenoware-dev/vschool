# vSchool — MERN Stack Application

A full-stack MERN application with JWT authentication, built as a monorepo.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite + Tailwind CSS v4 |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |
| HTTP Client | Axios |
| Routing | React Router DOM v7 |
| Code Quality | ESLint + Prettier |

---

## Project Structure

```
vschool/
├── client/         # React + Vite frontend (port 5173)
└── server/         # Node.js + Express backend (port 5000)
```

---

## Getting Started

### Prerequisites
- Node.js >= 18
- MongoDB (local or [MongoDB Atlas](https://cloud.mongodb.com))

### 1. Clone & Navigate

```bash
git clone <your-repo-url> vschool
cd vschool
```

### 2. Set Up the Server

```bash
cd server
cp .env.example .env     # Edit .env with your MONGO_URI and JWT_SECRET
npm run dev              # Starts on http://localhost:5000
```

### 3. Set Up the Client

```bash
cd ../client
npm run dev              # Starts on http://localhost:5173
```

> The Vite dev server proxies all `/api/*` requests to `http://localhost:5000` automatically.

---

## API Reference

### Auth Routes (`/api/auth`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/login` | Public | Login and receive JWT |
| GET | `/me` | Private | Get current user profile |
| PUT | `/password` | Private | Change own password |

There is no public sign-up. The owner creates branches, admins and therapists; branch admins
create therapists/teachers and parent logins (a parent login can be created while registering a child).

### Other Routes

| Prefix | Purpose |
|---|---|
| `/api/branches` | Branches; `GET /overview` returns per-branch headline numbers (owner) |
| `/api/users` | Staff and parent accounts; `PATCH /:id/toggle`, `PATCH /:id/password` (owner, admin) |
| `/api/patients` | Children; `POST` accepts `parentAccount: { email, password }` |
| `/api/appointments` | Sessions; `GET` supports `date` or `from`/`to`; `PATCH /:id/notes` for therapists |
| `/api/billing` | `payments` (fee receipts/invoices), `payroll` + `payouts` (monthly staff pay), `summary` |

Every non-owner request is limited to the user's own branch.

### Health Check

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server health check |

---

## Environment Variables (Server)

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `5000` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/vschool` |
| `JWT_SECRET` | JWT signing secret | _(required)_ |
| `JWT_EXPIRES_IN` | JWT expiry duration | `7d` |
| `CLIENT_URL` | Allowed CORS origin | `http://localhost:5173` |

---

## Scripts

### Client

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run lint      # Run ESLint
npm run format    # Run Prettier
```

### Server

```bash
npm run dev       # Start with nodemon (hot reload)
npm run start     # Start in production mode
npm run lint      # Run ESLint
npm run format    # Run Prettier
```

---

## Adding New Features

- **New server route**: Create `src/routes/yourRoute.js` + controller, then register in `src/app.js`
- **New protected page**: Add component in `client/src/pages/`, wrap with `<ProtectedRoute>` in `App.jsx`
- **New Mongoose model**: Add to `server/src/models/`

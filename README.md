[![Open in Visual Studio Code](https://classroom.github.com/assets/open-in-vscode-2e0aaae1b6195c2367325f4f02e2d04e9abb55f0b24a779b69b11b9e10269abc.svg)](https://classroom.github.com/online_ide?assignment_repo_id=22883052&assignment_repo_type=AssignmentRepo)

# News Aggregator API

A RESTful news aggregator backend built with **Node.js** and **Express**. It supports user registration & login with JWT authentication, personalised news fetching from the [NewsAPI](https://newsapi.org), in-memory caching, article read/favourite tracking, keyword search, structured console logging, and full input validation.

---

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
  - [Auth](#auth)
  - [Preferences](#preferences)
  - [News](#news)
- [Caching](#caching)
- [Logging](#logging)
- [Error Handling](#error-handling)
- [Running Tests](#running-tests)

---

## Features

- **User Registration & Login** — passwords hashed with `bcryptjs`, JWT tokens issued on login
- **JWT Authentication** — all protected routes verified via `Authorization: Bearer <token>` header
- **User Preferences** — store and update per-user news category/topic preferences (deduplicated & lowercased)
- **News Feed** — fetch articles from NewsAPI based on user preferences, in parallel, with deduplication
- **Configurable Caching** — in-memory cache with env-configurable TTLs and periodic background refresh
- **Keyword Search** — search NewsAPI for any keyword, results cached independently
- **Read & Favourites** — idempotent mark-as-read / mark-as-favourite; retrieve lists per user
- **Strict Input Validation** — unknown fields stripped, type enforcement, empty-body guard, `Content-Type` check
- **Standardised Error Responses** — every error returns `{ status, error, timestamp, details? }`
- **Structured Logging** — plain-text console logging via `winston` + `morgan` (HTTP requests)
- **Global Error Handling** — centralised `AppError` class, 404 catch-all, JWT errors, JSON parse errors

---

## Project Structure

```
news-aggregator-api/
├── app.js                    # Express app entry point
├── .env                      # Environment variables (not committed)
├── .gitignore
├── package.json
│
├── controllers/
│   ├── userController.js     # signup, login, getPreferences, updatePreferences
│   └── newsController.js     # getNews, searchNews, markAsRead, markAsFavorite,
│                             #   getReadArticles, getFavoriteArticles, getCacheStats
│
├── middlewares/
│   ├── auth.js               # JWT verification — attaches req.user
│   ├── validate.js           # requireJson + validateSignup / validateLogin / validatePreferences
│   ├── requestLogger.js      # Morgan → Winston HTTP request logger
│   └── errorHandler.js       # AppError, errorResponse helper, notFound, globalErrorHandler
│
├── models/
│   ├── userModel.js          # In-memory user store (findByEmail, findById, create, updatePreferences)
│   └── articleModel.js       # Global article registry + per-user read / favourite maps
│
├── routes/
│   ├── userRoutes.js         # POST /signup  POST /login  GET|PUT /preferences
│   └── newsRoutes.js         # GET /news  GET /search/:keyword  POST /:id/read|favorite
│                             #   GET /read  GET /favorites  GET /cache/stats
│
├── services/
│   ├── newsService.js        # NewsAPI axios calls, parallel fetch, deduplication
│   └── cacheService.js       # In-memory cache (get/set/invalidate/flush/stats)
│                             #   + configurable TTLs + periodic background refresh
│
├── utils/
│   └── logger.js             # Winston logger — console only, plain text, no colour
│
└── test/
    └── server.test.js        # tap + supertest integration tests (15 assertions)
```

---

## Tech Stack

| Package | Purpose |
|---|---|
| `express` | HTTP server & routing |
| `bcryptjs` | Password hashing |
| `jsonwebtoken` | JWT signing & verification |
| `axios` | HTTP client for NewsAPI |
| `dotenv` | Environment variable loader |
| `winston` | Structured application logging |
| `morgan` | HTTP request logging (piped into winston) |
| `tap` + `supertest` | Integration testing (dev only) |

---

## Getting Started

### Prerequisites

- Node.js **≥ 18**
- A free API key from [newsapi.org](https://newsapi.org/register)

### Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd news-aggregator-api

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env   # then edit .env with your values

# 4. Start the server
node app.js
```

The server starts on `http://localhost:3000` by default.

---

## Environment Variables

Create a `.env` file in the project root (never commit this file):

```env
PORT=3000
JWT_SECRET=your_jwt_secret_here
NEWS_API_KEY=your_newsapi_key_here
NEWS_API_BASE_URL=https://newsapi.org/v2

# Cache TTL in milliseconds (default: 600000 = 10 minutes)
CACHE_TTL_MS=600000

# Search cache TTL in milliseconds (default: 300000 = 5 minutes)
CACHE_SEARCH_TTL_MS=300000

# Periodic refresh interval in milliseconds (default: 900000 = 15 minutes)
CACHE_REFRESH_INTERVAL_MS=900000

# Logging — debug | info | warn | error  (default: debug in dev, warn in test)
LOG_LEVEL=debug
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | Port the server listens on |
| `JWT_SECRET` | **Yes** | — | Secret used to sign and verify JWT tokens |
| `NEWS_API_KEY` | **Yes** | — | API key from [newsapi.org](https://newsapi.org) |
| `NEWS_API_BASE_URL` | No | `https://newsapi.org/v2` | NewsAPI base URL |
| `CACHE_TTL_MS` | No | `600000` | News feed cache TTL in ms (10 min) |
| `CACHE_SEARCH_TTL_MS` | No | `300000` | Search results cache TTL in ms (5 min) |
| `CACHE_REFRESH_INTERVAL_MS` | No | `900000` | Background cache refresh interval in ms (15 min) |
| `LOG_LEVEL` | No | `debug` | Winston log level (`debug` / `info` / `warn` / `error`) |

---

## API Reference

All protected routes require the header:
```
Authorization: Bearer <token>
```

---

### Auth

> All `POST` and `PUT` endpoints require `Content-Type: application/json`. Requests with any other content type are rejected with `415`.

#### `POST /users/signup`
Register a new user.

**Request body:**
```json
{
  "name": "Clark Kent",
  "email": "clark@superman.com",
  "password": "Krypt()n8",
  "preferences": ["technology", "sports"]
}
```

**Validation rules:**
- `name` — required, string, 2–50 characters
- `email` — required, valid email format (trimmed, case-insensitive stored)
- `password` — required, string, 6–72 characters, must contain at least one letter and one number
- `preferences` — optional, array of non-empty strings (max 20 items, each max 50 chars); values are trimmed and lowercased
- Unknown fields are silently stripped before processing

**Response `200`:**
```json
{
  "message": "User registered successfully",
  "user": { "id": 1, "name": "Clark Kent", "email": "clark@superman.com" }
}
```

---

#### `POST /users/login`
Login and receive a JWT token.

**Request body:**
```json
{
  "email": "clark@superman.com",
  "password": "Krypt()n8"
}
```

**Response `200`:**
```json
{
  "token": "<jwt_token>"
}
```

---

### Preferences

#### `GET /users/preferences` 🔒
Retrieve the logged-in user's preferences.

**Response `200`:**
```json
{
  "preferences": ["technology", "sports"]
}
```

---

#### `PUT /users/preferences` 🔒
Replace the logged-in user's preferences. Values are trimmed, lowercased, and deduplicated.

**Request body:**
```json
{
  "preferences": ["movies", "comics", "games"]
}
```

**Validation rules:**
- `preferences` — required, non-empty array, max 20 items, each a non-empty string ≤ 50 chars

**Response `200`:**
```json
{
  "preferences": ["movies", "comics", "games"]
}
```

---

### News

#### `GET /news` 🔒
Fetch news articles based on the user's saved preferences.  
Results are served from cache when available (TTL controlled by `CACHE_TTL_MS`).

**Response `200`:**
```json
{
  "count": 10,
  "news": [
    {
      "id": 1,
      "title": "Article title",
      "description": "...",
      "url": "https://...",
      "source": "BBC News",
      "publishedAt": "2026-02-28T10:00:00Z",
      "urlToImage": "https://..."
    }
  ]
}
```

---

#### `GET /news/search/:keyword` 🔒
Search for news articles by keyword. Results cached independently (TTL controlled by `CACHE_SEARCH_TTL_MS`).  
Keyword must be 1–100 characters.

**Example:** `GET /news/search/artificial%20intelligence`

**Response `200`:**
```json
{
  "keyword": "artificial intelligence",
  "count": 20,
  "news": [ ... ]
}
```

---

#### `POST /news/:id/read` 🔒
Mark an article as read. Use the numeric `id` from the `GET /news` response.  
Idempotent — calling it again on an already-read article returns a descriptive message without error.

**Response `200`:**
```json
{
  "message": "Article marked as read",
  "article": { ... }
}
```

---

#### `POST /news/:id/favorite` 🔒
Mark an article as a favourite.  
Idempotent — calling it again returns a descriptive message without error.

**Response `200`:**
```json
{
  "message": "Article marked as favorite",
  "article": { ... }
}
```

---

#### `GET /news/read` 🔒
Retrieve all articles marked as read by the logged-in user.

**Response `200`:**
```json
{
  "count": 2,
  "articles": [ ... ]
}
```

---

#### `GET /news/favorites` 🔒
Retrieve all articles marked as favourite by the logged-in user.

**Response `200`:**
```json
{
  "count": 1,
  "articles": [ ... ]
}
```

---

#### `GET /news/cache/stats` 🔒
Debug endpoint — returns current in-memory cache state.

**Response `200`:**
```json
{
  "cache": [
    {
      "key": "movies|technology",
      "articles": 10,
      "ageSeconds": 42,
      "ttlSeconds": 600
    }
  ]
}
```

---

## Caching

| Behaviour | Detail |
|---|---|
| Cache key | Sorted, pipe-joined preferences e.g. `movies\|technology` |
| News feed TTL | `CACHE_TTL_MS` env var (default **10 minutes** / `600000` ms) |
| Search TTL | `CACHE_SEARCH_TTL_MS` env var (default **5 minutes** / `300000` ms) |
| Background refresh | Every `CACHE_REFRESH_INTERVAL_MS` ms (default **15 minutes** / `900000` ms) |
| Cache miss | Fetches from NewsAPI, stores result, returns fresh data |
| No preferences | Falls back to top-headlines from NewsAPI |
| Deduplication | Articles merged across topics and de-duped by URL |

---

## Logging

Plain-text console output via `winston` + `morgan`, no colours, no files.

```
2026-02-28 10:00:00 [DEBUG]: signup attempt {"email":"clark@superman.com"}
2026-02-28 10:00:00 [INFO]:  user registered {"userId":1,"email":"clark@superman.com"}
2026-02-28 10:00:00 [HTTP]:  POST /users/signup 200 87ms - 107
2026-02-28 10:00:01 [WARN]:  login failed — wrong password {"email":"clark@superman.com"}
2026-02-28 10:00:02 [DEBUG]: [Cache] HIT  key="movies|technology" age=42s
```

Control log verbosity with the `LOG_LEVEL` env var (`debug` / `info` / `warn` / `error`).

---

## Error Handling

All errors flow through the global error handler in `middlewares/errorHandler.js`.

Every error response follows a consistent shape:

```json
{
  "status": 400,
  "error": "Validation failed",
  "timestamp": "2026-02-28T10:00:00.000Z",
  "details": ["password must contain at least one number"]
}
```

> `details` is only present when there are field-level validation errors.

| Scenario | Status | `error` message |
|---|---|---|
| Wrong `Content-Type` on POST/PUT | `415` | `Content-Type must be application/json` |
| Missing / invalid field | `400` | `Validation failed` (+ `details` array) |
| Malformed JSON body | `400` | `Invalid JSON in request body` |
| Duplicate email on signup | `400` | `A user with that email already exists` |
| Invalid article id (non-integer) | `400` | `Article id must be a positive integer` |
| Wrong credentials | `401` | `Invalid credentials` |
| Missing `Authorization` header | `401` | `Authorization header missing` |
| Malformed `Authorization` header | `401` | `Authorization header must be: Bearer <token>` |
| Invalid JWT | `401` | `Invalid token` |
| Expired JWT | `401` | `Token has expired` |
| Article not found | `404` | `Article <id> not found. Fetch /news first…` |
| Unknown route | `404` | `Route not found: GET /unknown` |
| NewsAPI unreachable | `503` | `Unable to reach the News API.` |
| NewsAPI rate limited | `503` | `News API rate limit exceeded.` |
| NewsAPI request timeout | `503` | `News API request timed out.` |
| Unexpected server error | `500` | `Something went wrong. Please try again later.` |

---

## Running Tests

```bash
npm test
```

Uses `tap` + `supertest`. Runs **15 integration tests** covering:

| # | Test |
|---|---|
| 1 | `POST /users/signup` — success → `200` with user object |
| 2 | `POST /users/signup` — missing email → `400` |
| 3 | `POST /users/login` — success → `200` with JWT token |
| 4 | `POST /users/login` — wrong password → `401` |
| 5–7 | `GET /users/preferences` — with valid token → `200` with preferences |
| 8 | `GET /users/preferences` — without token → `401` |
| 9 | `PUT /users/preferences` — update → `200` |
| 10 | `GET /users/preferences` — verify updated preferences persisted |
| 11–12 | `GET /news` — with valid token → `200` with `news` array |
| 13–15 | `GET /news` — without token → `401` |

> **Note:** Tests run without a real `NEWS_API_KEY`. The `GET /news` endpoint returns `200 { news: [] }` when the key is not configured, so all tests pass in CI without any external API calls.

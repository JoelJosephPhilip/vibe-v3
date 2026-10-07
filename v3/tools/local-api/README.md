# Local API for v3 development

Runs the **existing** ViBe backend locally, unmodified, so the v3 student app
can be developed against real endpoints. Nothing under `backend/` is edited —
it is only installed and compiled (into its git-ignored `build/`).

| Piece | Where | Notes |
|---|---|---|
| Firebase Auth | emulator on `127.0.0.1:9099`, project `demo-vibe` | No real Firebase project or credentials involved |
| Backend | `localhost:4001`, `NODE_ENV=development` | Config in `backend.env` (no secrets) |
| Database | MongoDB Atlas, database **`vibe_v3_local`** | Never point this at `vibe` (staging data) |

## One-time setup

Create `~/.config/vibe-v3/` (chmod 700) with two private files (chmod 600):

- `atlas.env`
  ```
  DB_URL=mongodb+srv://<user>:<password>@<cluster>/?appName=<app>
  DB_NAME=vibe_v3_local
  ```
- `firebase-emulator.env` — a throwaway service-account key; the backend's
  development mode insists on one, but the emulator never checks it:
  ```sh
  key=$(openssl genrsa 2048 2>/dev/null | awk 'BEGIN{ORS="\\n"}1')
  printf 'FIREBASE_CLIENT_EMAIL=emulator@demo-vibe.iam.gserviceaccount.com\nFIREBASE_PRIVATE_KEY="%s"\n' "$key" > ~/.config/vibe-v3/firebase-emulator.env
  ```

## Run

```sh
tools/local-api/start.sh          # emulator + backend; Ctrl-C stops both (emulator accounts persist in tools/local-api/.emulator-data)
node tools/local-api/seed.mjs     # sample instructor/student + one small course (idempotent)
pnpm nx dev student               # http://localhost:4300 — proxies /api and the emulator
```

Sign in as `student@vibe.local` / `Password123!`. The seed refuses to run unless
`DB_NAME` starts with `vibe_v3_local`.

## Refreshing the API types

With the backend running: `pnpm --filter @vibe/api generate` re-reads the spec
from `http://localhost:4001/reference` into `packages/api/openapi.json` and
regenerates `packages/api/src/schema.ts`.

## Backend quirks the frontend works around (backend not changed)

- `GET /users/me` is unreachable: `@Get('/:userId')` is declared before
  `@Get('/me')` in `UserController`, so "me" is parsed as an ObjectId. The app
  uses the Firebase profile instead (as the current frontend does).
- `POST /auth/login` calls Google's live Identity Toolkit, so it cannot work
  with the emulator; the app signs in with Firebase directly. It also served
  as the reCAPTCHA gate — wire that in before production.
- `GET /users/enrollments` requires a `role` query param.
- The spec has 35 dangling `$ref`s and one duplicated operationId;
  `tools/openapi/fetch-spec.mjs` patches those in the generated copy only.
- Blog items need `points` as a decimal *string* and no `tags` (`@IsEmpty`).

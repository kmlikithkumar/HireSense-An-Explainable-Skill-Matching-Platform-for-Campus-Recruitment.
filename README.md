# HireSense

Explainable skill-matching platform for campus recruitment. DBMS Level 3 project.

Students' resumes and job descriptions are embedded as vectors and ranked by cosine similarity
(PostgreSQL + pgvector). Eligibility rules (CGPA, backlogs, department, deadline) are enforced
inside the database by a function and triggers, so no client can bypass them. Every match shows
which required skills the resume has and which it lacks.

## Stack

| Layer | Choice |
|---|---|
| Web UI and API | Next.js 15 (App Router, Route Handlers), React 19 |
| SQL database | PostgreSQL 16 |
| Vector database | pgvector (extension, `vector(384)` columns, HNSW indexes, cosine distance) |
| Auth | bcrypt password hashes, signed JWT in an httpOnly cookie, role checks in middleware and in every API route |
| Embeddings | `Xenova/all-MiniLM-L6-v2` (384 dims) through transformers.js, with an offline fallback (see below) |

## Setup

Requirements: Node 20+ (22 recommended), PostgreSQL 14+ with the `pgvector` extension installed.

```bash
# 1. database (once)
createuser hiresense --pwprompt --createdb
createdb hiresense -O hiresense
# pgvector must be installed on the server, e.g.  sudo apt install postgresql-16-pgvector
# (or Docker: docker run -e POSTGRES_PASSWORD=pw -p 5432:5432 pgvector/pgvector:pg16)

# 2. app
npm install
cp .env.example .env.local        # then edit DATABASE_URL and JWT_SECRET
npm run db:setup                  # schema + triggers + views + sample data + embeddings + sample applications
npm run dev                       # http://localhost:3000
```

`db:setup` drops and recreates all HireSense tables. The first run downloads the MiniLM model (about 23 MB).
The database user needs permission to `CREATE EXTENSION vector` (or run it once as a superuser).

Demo logins (sample data only):

| Role | Email | Password |
|---|---|---|
| Admin | admin@hiresense.test | Admin@123 |
| Student | student01@hiresense.test ... student16@hiresense.test | Student@123 |

New students can self-register. Admin accounts exist only in the database; there is no public admin sign-up.

## Tests

```bash
npm run test:db                        # 33 database tests (rolled back, data untouched)
npm run build && npm start             # in one terminal
npm run test:api                       # 38 end-to-end HTTP tests; MUTATES data, rerun db:setup afterwards
```

## Where each course requirement lives

| Requirement | Where |
|---|---|
| ER diagram, relational schema | `docs/er-diagram.md`, `db/01_schema.sql` |
| CREATE / ALTER / DROP, PK, FK, constraints, indexes | `db/01_schema.sql` |
| Views | `db/03_views.sql` |
| Stored functions, triggers, transaction | `db/02_functions_triggers.sql` |
| Vector similarity search | `match_jobs_for_student`, `match_students_for_job` in `db/02_functions_triggers.sql`; HNSW indexes in `db/01_schema.sql` |
| Full-text search | generated `search_tsv` column + GIN index; used by `GET /api/jobs?q=` |
| DML, JOIN, GROUP BY, HAVING, subqueries | `db/06_queries.sql`, `app/api/admin/dashboard/route.ts` |
| Input validation in the database | CHECK constraints, triggers (`HS001`, `HS002`) |
| Env-based configuration | `lib/db.ts`, `lib/auth.ts`, `.env.example` |
| Roles (student, admin) | `middleware.ts`, `lib/api.ts` (`requireRole`) |
| Test cases | `scripts/db-tests.mjs`, `scripts/api-tests.mjs` |
| Screenshots | `docs/screenshots/` |

Advanced database concepts used: vector similarity search, triggers (4), stored functions, a locking
transaction (`shortlist_candidate`), views (3), indexing (B-tree, partial, GIN, HNSW), full-text search.

## Embeddings: read this before you demo

- Normal mode uses MiniLM, a pre-trained sentence-embedding model run locally. Nothing is trained in this project.
- If the model cannot be downloaded (no internet, blocked network), `EMBEDDING_PROVIDER=auto` falls back to a
  hashing embedder built from word and word-pair overlap. **It is lexical, not semantic**: it will not link
  "trained CNNs on medical imaging" to "computer vision". Similarity scores are also much lower with it.
- Each stored vector records which model made it (`embedding_model`). After switching providers, run
  `npm run db:embed` to re-embed rows made by a different model. Never compare vectors from two models.
- The vectors are only as good as the text. "Explainable" here comes from SQL: the matched and missing skill
  chips are computed by joining a skills dictionary, not by the model.

## Known limits

- Skill tagging uses a fixed dictionary of about 44 skills (`skills` table); a skill not in it is not tagged.
- Resumes are pasted as text. There is no PDF parsing.
- The HNSW indexes help `ORDER BY embedding <=> query LIMIT k` on large tables. With 16 students and 8 postings
  PostgreSQL will scan sequentially, which is correct and faster at that size. The matching functions also filter
  by eligibility, which the planner applies after the vector ordering.
- No rate limiting on login, no password reset, no email. Not production-ready.
- TypeScript is pinned to 5.x in `package.json`; TypeScript 7 (the current default) breaks the `@/` import alias in
  this version of Next.js.

## Project layout

```
app/            pages and API route handlers
components/     shared UI
lib/            db pool, auth, embeddings, API helpers
db/             SQL: schema, functions/triggers, views, seed data, demo queries
scripts/        db-setup, embed, db tests, API tests
docs/           ER diagram, screenshots
```

## Student profile editing and theme

- **Profile page** `/student/profile` (tabs: Details, Resume, Security). Students can edit name, department, CGPA, active backlogs and graduation year, change email and password. SRN and role cannot be changed (strict zod schema, server uses the session id only).
- **Endpoints:** `PATCH /api/student/profile/details`, `POST /api/student/password`, `POST /api/student/email`. Validation errors return 422 with a per-field `fields` map.
- **Audit:** `db/07_profile_audit.sql` adds `student_profile_audit` and a trigger recording every CGPA, backlog or department change. Admins see a "profile edited" badge with old and new values on candidates and applications. Existing applications are not changed by an edit.
- **Theme:** light by default, dark toggle in the header (saved in `localStorage` key `hs-theme`). Inter is vendored in `app/fonts/` so builds work offline.
- **Known limits:** JWT sessions are not invalidated on password change; students can self-edit CGPA (mitigated by the audit trail).
- Screenshots in `docs/screenshots/` cover light and dark at 1200px and 390px.

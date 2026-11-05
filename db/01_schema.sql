-- =====================================================================
-- HireSense: schema (PostgreSQL 16 + pgvector)
-- Demonstrates CREATE, ALTER, DROP, PK/FK, constraints and indexes.
-- Re-runnable: drops everything it owns first.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---- DROP (reset) ---------------------------------------------------
DROP VIEW  IF EXISTS v_job_eligible_students, v_company_placement_summary,
                     v_student_applications CASCADE;
DROP TABLE IF EXISTS application_audit, interview_rounds, applications,
                     job_skills, student_skills, skills,
                     job_eligible_departments, job_postings, companies,
                     students, users, departments CASCADE;

-- ---- CREATE ---------------------------------------------------------
CREATE TABLE departments (
    dept_id   SERIAL PRIMARY KEY,
    code      VARCHAR(10)  NOT NULL UNIQUE,
    name      VARCHAR(100) NOT NULL
);

CREATE TABLE users (
    user_id       SERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    role          VARCHAR(10)  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_users_role  CHECK (role IN ('student', 'admin')),
    CONSTRAINT chk_users_email CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

CREATE TABLE students (
    student_id        SERIAL PRIMARY KEY,
    user_id           INT          NOT NULL UNIQUE
                      REFERENCES users(user_id) ON DELETE CASCADE,
    srn               VARCHAR(16)  NOT NULL UNIQUE,
    full_name         VARCHAR(100) NOT NULL,
    dept_id           INT          NOT NULL REFERENCES departments(dept_id),
    cgpa              NUMERIC(4,2) NOT NULL,
    backlog_count     INT          NOT NULL DEFAULT 0,
    grad_year         INT          NOT NULL,
    resume_text       TEXT,
    resume_embedding  vector(384),
    embedding_model   VARCHAR(80),
    resume_updated_at TIMESTAMPTZ,
    CONSTRAINT chk_students_cgpa    CHECK (cgpa BETWEEN 0 AND 10),
    CONSTRAINT chk_students_backlog CHECK (backlog_count >= 0),
    CONSTRAINT chk_students_year    CHECK (grad_year BETWEEN 2024 AND 2035),
    CONSTRAINT chk_students_srn     CHECK (srn ~ '^PES[0-9][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}$'),
    CONSTRAINT chk_students_name    CHECK (length(trim(full_name)) > 0)
);

CREATE TABLE companies (
    company_id SERIAL PRIMARY KEY,
    name       VARCHAR(120) NOT NULL UNIQUE,
    industry   VARCHAR(80),
    website    VARCHAR(200)
);

CREATE TABLE job_postings (
    job_id          SERIAL PRIMARY KEY,
    company_id      INT          NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    title           VARCHAR(150) NOT NULL,
    jd_text         TEXT         NOT NULL,
    jd_embedding    vector(384),
    embedding_model VARCHAR(80),
    min_cgpa        NUMERIC(4,2) NOT NULL DEFAULT 0,
    max_backlogs    INT          NOT NULL DEFAULT 0,
    ctc_lpa         NUMERIC(5,2),
    deadline        TIMESTAMPTZ  NOT NULL,
    status          VARCHAR(10)  NOT NULL DEFAULT 'open',
    created_by      INT          REFERENCES users(user_id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    -- generated column powering full-text search
    search_tsv      tsvector GENERATED ALWAYS AS
                    (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(jd_text, ''))) STORED,
    CONSTRAINT chk_jobs_min_cgpa CHECK (min_cgpa BETWEEN 0 AND 10),
    CONSTRAINT chk_jobs_backlogs CHECK (max_backlogs >= 0),
    CONSTRAINT chk_jobs_ctc      CHECK (ctc_lpa IS NULL OR ctc_lpa > 0),
    CONSTRAINT chk_jobs_status   CHECK (status IN ('open', 'closed'))
);

-- Many-to-many: which departments a posting accepts.
-- No rows for a job = open to every department.
CREATE TABLE job_eligible_departments (
    job_id  INT NOT NULL REFERENCES job_postings(job_id) ON DELETE CASCADE,
    dept_id INT NOT NULL REFERENCES departments(dept_id) ON DELETE CASCADE,
    PRIMARY KEY (job_id, dept_id)
);

CREATE TABLE skills (
    skill_id SERIAL PRIMARY KEY,
    name     VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE student_skills (
    student_id INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    skill_id   INT NOT NULL REFERENCES skills(skill_id)     ON DELETE CASCADE,
    source     VARCHAR(10) NOT NULL DEFAULT 'resume',
    PRIMARY KEY (student_id, skill_id),
    CONSTRAINT chk_student_skills_source CHECK (source IN ('resume', 'manual'))
);

CREATE TABLE job_skills (
    job_id   INT NOT NULL REFERENCES job_postings(job_id) ON DELETE CASCADE,
    skill_id INT NOT NULL REFERENCES skills(skill_id)     ON DELETE CASCADE,
    PRIMARY KEY (job_id, skill_id)
);

CREATE TABLE applications (
    application_id SERIAL PRIMARY KEY,
    student_id     INT         NOT NULL REFERENCES students(student_id)     ON DELETE CASCADE,
    job_id         INT         NOT NULL REFERENCES job_postings(job_id)     ON DELETE CASCADE,
    status         VARCHAR(12) NOT NULL DEFAULT 'applied',
    match_score    NUMERIC(5,4),
    applied_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_application UNIQUE (student_id, job_id),
    CONSTRAINT chk_app_status CHECK (status IN
        ('applied', 'shortlisted', 'rejected', 'selected', 'withdrawn')),
    CONSTRAINT chk_app_score  CHECK (match_score IS NULL OR match_score BETWEEN -1 AND 1)
);

CREATE TABLE interview_rounds (
    round_id       SERIAL PRIMARY KEY,
    application_id INT         NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
    round_no       INT         NOT NULL,
    round_type     VARCHAR(20) NOT NULL,
    scheduled_at   TIMESTAMPTZ,
    result         VARCHAR(10) NOT NULL DEFAULT 'pending',
    CONSTRAINT uq_round        UNIQUE (application_id, round_no),
    CONSTRAINT chk_round_no    CHECK (round_no >= 1),
    CONSTRAINT chk_round_type  CHECK (round_type IN ('aptitude', 'technical', 'hr', 'group')),
    CONSTRAINT chk_round_result CHECK (result IN ('pending', 'pass', 'fail'))
);

CREATE TABLE application_audit (
    audit_id       BIGSERIAL PRIMARY KEY,
    application_id INT         NOT NULL,   -- no FK: audit rows must outlive deleted applications
    old_status     VARCHAR(12),
    new_status     VARCHAR(12) NOT NULL,
    changed_by     INT,
    changed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- ALTER ----------------------------------------------------------
-- Constraints added after table creation to show ALTER TABLE.
-- A result can only be recorded for a round that has been scheduled.
ALTER TABLE interview_rounds
    ADD CONSTRAINT chk_round_pass_needs_schedule
    CHECK (result = 'pending' OR scheduled_at IS NOT NULL);

-- ---- INDEXES --------------------------------------------------------
-- B-tree: eligibility filtering and common lookups
CREATE INDEX idx_students_dept_cgpa   ON students (dept_id, cgpa);
CREATE INDEX idx_apps_job_status      ON applications (job_id, status);
CREATE INDEX idx_apps_student         ON applications (student_id);
CREATE INDEX idx_audit_application    ON application_audit (application_id, changed_at);
-- Partial index: only open postings are scanned for matching
CREATE INDEX idx_jobs_open_deadline   ON job_postings (deadline) WHERE status = 'open';
-- Full-text search
CREATE INDEX idx_jobs_search          ON job_postings USING GIN (search_tsv);
-- Vector indexes (cosine distance)
CREATE INDEX idx_students_resume_hnsw ON students     USING hnsw (resume_embedding vector_cosine_ops);
CREATE INDEX idx_jobs_jd_hnsw         ON job_postings USING hnsw (jd_embedding     vector_cosine_ops);

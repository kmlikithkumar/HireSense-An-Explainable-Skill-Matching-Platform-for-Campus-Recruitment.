-- =====================================================================
-- HireSense: stored functions, triggers, transactional procedures,
-- and vector-similarity matching functions.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Eligibility rules live here, so no client can bypass them.
-- A job with no rows in job_eligible_departments accepts all departments.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_eligibility(p_student_id INT, p_job_id INT)
RETURNS TABLE (is_eligible BOOLEAN, reason TEXT)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    s students%ROWTYPE;
    j job_postings%ROWTYPE;
BEGIN
    SELECT * INTO s FROM students WHERE student_id = p_student_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Student not found'::TEXT; RETURN;
    END IF;
    SELECT * INTO j FROM job_postings WHERE job_id = p_job_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Posting not found'::TEXT; RETURN;
    END IF;

    IF j.status <> 'open' THEN
        RETURN QUERY SELECT FALSE, 'Posting is closed'::TEXT;
    ELSIF j.deadline < now() THEN
        RETURN QUERY SELECT FALSE, 'Application deadline has passed'::TEXT;
    ELSIF s.cgpa < j.min_cgpa THEN
        RETURN QUERY SELECT FALSE,
            format('CGPA %s is below the minimum %s', s.cgpa, j.min_cgpa);
    ELSIF s.backlog_count > j.max_backlogs THEN
        RETURN QUERY SELECT FALSE,
            format('%s active backlogs exceed the allowed %s', s.backlog_count, j.max_backlogs);
    ELSIF EXISTS (SELECT 1 FROM job_eligible_departments WHERE job_id = j.job_id)
          AND NOT EXISTS (SELECT 1 FROM job_eligible_departments
                          WHERE job_id = j.job_id AND dept_id = s.dept_id) THEN
        RETURN QUERY SELECT FALSE, 'Department is not eligible for this posting'::TEXT;
    ELSE
        RETURN QUERY SELECT TRUE, 'Eligible'::TEXT;
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- Skill extraction: match the skills dictionary against resume text.
-- Word-boundary regex, so "SQL" does not match inside "PostgreSQL"
-- and "Java" does not match inside "JavaScript".
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_student_skills(p_student_id INT)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE n INT;
BEGIN
    DELETE FROM student_skills WHERE student_id = p_student_id AND source = 'resume';

    INSERT INTO student_skills (student_id, skill_id, source)
    SELECT s.student_id, sk.skill_id, 'resume'
    FROM students s
    JOIN skills sk
      ON s.resume_text ~* (
           '(^|[^a-z0-9+#])'
           || regexp_replace(sk.name, '([.+*?()\[\]{}|\\^$])', '\\\1', 'g')
           || '($|[^a-z0-9+#])')
    WHERE s.student_id = p_student_id
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n;
END $$;

-- ---------------------------------------------------------------------
-- TRIGGER 1: BEFORE INSERT on applications
-- Rejects ineligible applications and stamps the semantic match score.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_application_before_insert() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_ok BOOLEAN;
    v_reason TEXT;
    v_score NUMERIC;
BEGIN
    SELECT e.is_eligible, e.reason INTO v_ok, v_reason
    FROM check_eligibility(NEW.student_id, NEW.job_id) e;

    IF NOT v_ok THEN
        RAISE EXCEPTION 'Not eligible: %', v_reason USING ERRCODE = 'HS001';
    END IF;

    SELECT round((1 - (s.resume_embedding <=> j.jd_embedding))::NUMERIC, 4)
      INTO v_score
    FROM students s, job_postings j
    WHERE s.student_id = NEW.student_id AND j.job_id = NEW.job_id
      AND s.resume_embedding IS NOT NULL AND j.jd_embedding IS NOT NULL;

    NEW.match_score := v_score;      -- NULL when an embedding is missing
    NEW.status      := 'applied';    -- new applications always start here
    RETURN NEW;
END $$;

CREATE TRIGGER application_before_insert
BEFORE INSERT ON applications
FOR EACH ROW EXECUTE FUNCTION trg_application_before_insert();

-- ---------------------------------------------------------------------
-- TRIGGER 2: BEFORE UPDATE OF status - only legal transitions allowed
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_application_status_guard() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = OLD.status THEN RETURN NEW; END IF;

    IF NOT (
        (OLD.status = 'applied'     AND NEW.status IN ('shortlisted', 'rejected', 'withdrawn')) OR
        (OLD.status = 'shortlisted' AND NEW.status IN ('selected', 'rejected', 'withdrawn'))
    ) THEN
        RAISE EXCEPTION 'Illegal status change: % -> %', OLD.status, NEW.status
            USING ERRCODE = 'HS002';
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END $$;

CREATE TRIGGER application_status_guard
BEFORE UPDATE OF status ON applications
FOR EACH ROW EXECUTE FUNCTION trg_application_status_guard();

-- ---------------------------------------------------------------------
-- TRIGGER 3: AFTER INSERT / UPDATE OF status - audit trail.
-- The acting user id is passed by the app with
--   SELECT set_config('hiresense.actor', '<user_id>', true)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_application_audit() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE v_actor INT := NULLIF(current_setting('hiresense.actor', TRUE), '')::INT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO application_audit (application_id, old_status, new_status, changed_by)
        VALUES (NEW.application_id, NULL, NEW.status, v_actor);
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO application_audit (application_id, old_status, new_status, changed_by)
        VALUES (NEW.application_id, OLD.status, NEW.status, v_actor);
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER application_audit
AFTER INSERT OR UPDATE OF status ON applications
FOR EACH ROW EXECUTE FUNCTION trg_application_audit();

-- ---------------------------------------------------------------------
-- TRIGGER 4: keep derived skills in sync whenever a resume changes
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_student_resume_changed() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM refresh_student_skills(NEW.student_id);
    RETURN NULL;
END $$;

CREATE TRIGGER student_resume_changed
AFTER INSERT OR UPDATE OF resume_text ON students
FOR EACH ROW EXECUTE FUNCTION trg_student_resume_changed();

-- Stamp the time whenever resume text changes.
CREATE OR REPLACE FUNCTION trg_student_resume_stamp() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.resume_text IS DISTINCT FROM OLD.resume_text THEN
        NEW.resume_updated_at := now();
        -- the stored vector no longer describes this text
        NEW.resume_embedding := NULL;
        NEW.embedding_model  := NULL;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER student_resume_stamp
BEFORE UPDATE OF resume_text ON students
FOR EACH ROW EXECUTE FUNCTION trg_student_resume_stamp();

-- ---------------------------------------------------------------------
-- TRANSACTION: shortlist + create the first interview round atomically.
-- Row lock prevents two admins acting on the same application at once.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION shortlist_candidate(
    p_application_id INT,
    p_round_type     TEXT,
    p_scheduled_at   TIMESTAMPTZ,
    p_admin_user_id  INT
) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
    v_status   TEXT;
    v_round_id INT;
BEGIN
    PERFORM set_config('hiresense.actor', p_admin_user_id::TEXT, TRUE);

    SELECT status INTO v_status
    FROM applications WHERE application_id = p_application_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application % not found', p_application_id USING ERRCODE = 'HS003';
    END IF;
    IF v_status <> 'applied' THEN
        RAISE EXCEPTION 'Only applications in "applied" state can be shortlisted (now: %)', v_status
            USING ERRCODE = 'HS002';
    END IF;

    UPDATE applications SET status = 'shortlisted' WHERE application_id = p_application_id;

    INSERT INTO interview_rounds (application_id, round_no, round_type, scheduled_at)
    VALUES (p_application_id, 1, p_round_type, p_scheduled_at)
    RETURNING round_id INTO v_round_id;

    RETURN v_round_id;   -- any failure above rolls back both changes
END $$;

-- ---------------------------------------------------------------------
-- VECTOR SEARCH: jobs ranked for a student (cosine similarity).
-- similarity = 1 - cosine distance. Explainability comes from the skill
-- overlap arrays, which are computed by SQL joins, not by the model.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_jobs_for_student(p_student_id INT, p_limit INT DEFAULT 10)
RETURNS TABLE (
    job_id INT, title TEXT, company_name TEXT, similarity NUMERIC,
    is_eligible BOOLEAN, reason TEXT,
    matched_skills TEXT[], missing_skills TEXT[]
)
LANGUAGE sql STABLE AS $$
    WITH me AS (SELECT resume_embedding AS e FROM students WHERE student_id = p_student_id)
    SELECT j.job_id,
           j.title::TEXT,
           c.name::TEXT,
           round((1 - (j.jd_embedding <=> me.e))::NUMERIC, 4),
           el.is_eligible,
           el.reason,
           ARRAY(SELECT sk.name::TEXT
                 FROM job_skills js
                 JOIN skills sk ON sk.skill_id = js.skill_id
                 JOIN student_skills ss ON ss.skill_id = js.skill_id AND ss.student_id = p_student_id
                 WHERE js.job_id = j.job_id ORDER BY sk.name),
           ARRAY(SELECT sk.name::TEXT
                 FROM job_skills js
                 JOIN skills sk ON sk.skill_id = js.skill_id
                 WHERE js.job_id = j.job_id
                   AND NOT EXISTS (SELECT 1 FROM student_skills ss
                                   WHERE ss.skill_id = js.skill_id AND ss.student_id = p_student_id)
                 ORDER BY sk.name)
    FROM job_postings j
    JOIN companies c ON c.company_id = j.company_id
    CROSS JOIN me
    CROSS JOIN LATERAL check_eligibility(p_student_id, j.job_id) el
    WHERE j.status = 'open' AND j.jd_embedding IS NOT NULL AND me.e IS NOT NULL
    ORDER BY j.jd_embedding <=> me.e
    LIMIT p_limit;
$$;

-- Candidates ranked for a posting.
CREATE OR REPLACE FUNCTION match_students_for_job(
    p_job_id INT, p_limit INT DEFAULT 20, p_only_eligible BOOLEAN DEFAULT TRUE)
RETURNS TABLE (
    student_id INT, full_name TEXT, srn TEXT, dept_code TEXT, cgpa NUMERIC,
    similarity NUMERIC, is_eligible BOOLEAN, reason TEXT,
    matched_skills TEXT[], missing_skills TEXT[]
)
LANGUAGE sql STABLE AS $$
    WITH q AS (SELECT jd_embedding AS e FROM job_postings WHERE job_id = p_job_id)
    SELECT s.student_id,
           s.full_name::TEXT,
           s.srn::TEXT,
           d.code::TEXT,
           s.cgpa,
           round((1 - (s.resume_embedding <=> q.e))::NUMERIC, 4),
           el.is_eligible,
           el.reason,
           ARRAY(SELECT sk.name::TEXT
                 FROM job_skills js
                 JOIN skills sk ON sk.skill_id = js.skill_id
                 JOIN student_skills ss ON ss.skill_id = js.skill_id AND ss.student_id = s.student_id
                 WHERE js.job_id = p_job_id ORDER BY sk.name),
           ARRAY(SELECT sk.name::TEXT
                 FROM job_skills js
                 JOIN skills sk ON sk.skill_id = js.skill_id
                 WHERE js.job_id = p_job_id
                   AND NOT EXISTS (SELECT 1 FROM student_skills ss
                                   WHERE ss.skill_id = js.skill_id AND ss.student_id = s.student_id)
                 ORDER BY sk.name)
    FROM students s
    JOIN departments d ON d.dept_id = s.dept_id
    CROSS JOIN q
    CROSS JOIN LATERAL check_eligibility(s.student_id, p_job_id) el
    WHERE s.resume_embedding IS NOT NULL AND q.e IS NOT NULL
      AND (NOT p_only_eligible OR el.is_eligible)
    ORDER BY s.resume_embedding <=> q.e
    LIMIT p_limit;
$$;

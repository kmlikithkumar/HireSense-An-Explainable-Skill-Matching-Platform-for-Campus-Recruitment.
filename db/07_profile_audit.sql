-- =====================================================================
-- HireSense: audit trail for eligibility-relevant profile edits.
-- Students may edit cgpa, backlog_count and dept_id; every change is
-- recorded here so placement staff can see it. Additive: no existing
-- object is changed.
-- =====================================================================
DROP TABLE IF EXISTS student_profile_audit CASCADE;

CREATE TABLE student_profile_audit (
    audit_id   BIGSERIAL PRIMARY KEY,
    student_id INT         NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    field      VARCHAR(20) NOT NULL,
    old_value  TEXT,
    new_value  TEXT,
    changed_by INT,                         -- users.user_id of the actor, when the app supplies it
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_profile_audit_field CHECK (field IN ('cgpa', 'backlog_count', 'dept_id'))
);
CREATE INDEX idx_profile_audit_student ON student_profile_audit (student_id, changed_at DESC);

CREATE OR REPLACE FUNCTION trg_student_profile_audit() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE v_actor INT := NULLIF(current_setting('hiresense.actor', TRUE), '')::INT;
BEGIN
    IF NEW.cgpa IS DISTINCT FROM OLD.cgpa THEN
        INSERT INTO student_profile_audit (student_id, field, old_value, new_value, changed_by)
        VALUES (NEW.student_id, 'cgpa', OLD.cgpa::TEXT, NEW.cgpa::TEXT, v_actor);
    END IF;
    IF NEW.backlog_count IS DISTINCT FROM OLD.backlog_count THEN
        INSERT INTO student_profile_audit (student_id, field, old_value, new_value, changed_by)
        VALUES (NEW.student_id, 'backlog_count', OLD.backlog_count::TEXT, NEW.backlog_count::TEXT, v_actor);
    END IF;
    IF NEW.dept_id IS DISTINCT FROM OLD.dept_id THEN
        INSERT INTO student_profile_audit (student_id, field, old_value, new_value, changed_by)
        VALUES (NEW.student_id, 'dept_id',
                (SELECT code FROM departments WHERE dept_id = OLD.dept_id),
                (SELECT code FROM departments WHERE dept_id = NEW.dept_id), v_actor);
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER student_profile_audit
AFTER UPDATE OF cgpa, backlog_count, dept_id ON students
FOR EACH ROW EXECUTE FUNCTION trg_student_profile_audit();

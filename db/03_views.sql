-- =====================================================================
-- HireSense: views
-- =====================================================================

-- Eligible students per open posting (uses the same rules as the trigger).
CREATE OR REPLACE VIEW v_job_eligible_students AS
SELECT j.job_id, j.title, c.name AS company_name,
       s.student_id, s.full_name, s.srn, d.code AS dept_code, s.cgpa, s.backlog_count
FROM job_postings j
JOIN companies c ON c.company_id = j.company_id
CROSS JOIN students s
JOIN departments d ON d.dept_id = s.dept_id
CROSS JOIN LATERAL check_eligibility(s.student_id, j.job_id) el
WHERE j.status = 'open' AND el.is_eligible;

-- Placement funnel per company, for the admin dashboard.
CREATE OR REPLACE VIEW v_company_placement_summary AS
SELECT c.company_id,
       c.name AS company_name,
       count(DISTINCT j.job_id)                                   AS postings,
       count(a.application_id)                                    AS applications,
       count(*) FILTER (WHERE a.status = 'shortlisted')           AS shortlisted,
       count(*) FILTER (WHERE a.status = 'selected')              AS selected,
       round(100.0 * count(*) FILTER (WHERE a.status IN ('shortlisted', 'selected'))
             / NULLIF(count(a.application_id), 0), 1)             AS shortlist_rate_pct,
       round(avg(a.match_score), 3)                               AS avg_match_score
FROM companies c
LEFT JOIN job_postings j ON j.company_id = c.company_id
LEFT JOIN applications a ON a.job_id = j.job_id
GROUP BY c.company_id, c.name;

-- A student's applications with company, role and next interview.
CREATE OR REPLACE VIEW v_student_applications AS
SELECT a.application_id, a.student_id, a.status, a.match_score, a.applied_at,
       j.job_id, j.title, c.name AS company_name,
       (SELECT min(r.scheduled_at) FROM interview_rounds r
        WHERE r.application_id = a.application_id
          AND r.result = 'pending' AND r.scheduled_at >= now())  AS next_interview_at,
       (SELECT count(*) FROM interview_rounds r
        WHERE r.application_id = a.application_id)               AS rounds_total
FROM applications a
JOIN job_postings j ON j.job_id = a.job_id
JOIN companies c    ON c.company_id = j.company_id;

-- =====================================================================
-- HireSense: important queries for the demo (run in psql after db:setup)
-- =====================================================================

-- 1. JOIN + ORDER BY: students ranked for a posting by cosine similarity
SELECT s.full_name, d.code AS dept, round((1 - (s.resume_embedding <=> j.jd_embedding))::numeric, 3) AS similarity
FROM job_postings j
JOIN students s ON TRUE
JOIN departments d ON d.dept_id = s.dept_id
WHERE j.title = 'Computer Vision Engineer' AND s.resume_embedding IS NOT NULL
ORDER BY s.resume_embedding <=> j.jd_embedding
LIMIT 5;

-- 2. Function call: eligible ranked candidates with skill overlap
SELECT full_name, similarity, matched_skills, missing_skills
FROM match_students_for_job((SELECT job_id FROM job_postings WHERE title = 'Backend Engineer'), 5, TRUE);

-- 3. GROUP BY + HAVING: companies whose postings drew at least 2 applications
SELECT c.name, count(a.application_id) AS applications, round(avg(a.match_score), 3) AS avg_score
FROM companies c
JOIN job_postings j ON j.company_id = c.company_id
JOIN applications a ON a.job_id = j.job_id
GROUP BY c.name
HAVING count(a.application_id) >= 2
ORDER BY applications DESC;

-- 4. Subquery: students with a CGPA above the average of their own department
SELECT s.full_name, d.code, s.cgpa
FROM students s JOIN departments d ON d.dept_id = s.dept_id
WHERE s.cgpa > (SELECT avg(s2.cgpa) FROM students s2 WHERE s2.dept_id = s.dept_id)
ORDER BY d.code, s.cgpa DESC;

-- 5. Aggregates + LEFT JOIN: students who have not applied anywhere
SELECT s.full_name, s.cgpa
FROM students s LEFT JOIN applications a ON a.student_id = s.student_id
WHERE a.application_id IS NULL
ORDER BY s.cgpa DESC;

-- 6. Window function: rank of each application within its posting
SELECT j.title, s.full_name, a.match_score,
       rank() OVER (PARTITION BY a.job_id ORDER BY a.match_score DESC) AS rank_in_posting
FROM applications a
JOIN students s ON s.student_id = a.student_id
JOIN job_postings j ON j.job_id = a.job_id
ORDER BY j.title, rank_in_posting;

-- 7. Full-text search
SELECT title, ts_rank(search_tsv, q) AS rank
FROM job_postings, websearch_to_tsquery('english', 'embeddings OR kubernetes') q
WHERE search_tsv @@ q ORDER BY rank DESC;

-- 8. View: placement funnel per company
SELECT * FROM v_company_placement_summary ORDER BY applications DESC;

-- 9. Audit trail for one application
SELECT application_id, old_status, new_status, changed_by, changed_at
FROM application_audit ORDER BY audit_id DESC LIMIT 10;

-- 10. DML examples
-- UPDATE: raise a student's CGPA        UPDATE students SET cgpa = 9.25 WHERE srn = 'PES1UG24CS101';
-- DELETE: remove a withdrawn application DELETE FROM applications WHERE status = 'withdrawn';
-- INSERT is exercised by the app (register, apply, create posting) and by db/04_seed.sql.

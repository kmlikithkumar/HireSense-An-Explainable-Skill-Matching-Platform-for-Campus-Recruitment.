-- =====================================================================
-- Sample applications. Runs AFTER embeddings exist so that the insert
-- trigger can stamp a real match_score. Every row still passes through
-- the eligibility trigger, so only eligible pairs are listed.
-- =====================================================================
SELECT set_config('hiresense.actor',
                  (SELECT user_id::TEXT FROM users WHERE role = 'admin' LIMIT 1), FALSE);

INSERT INTO applications (student_id, job_id)
SELECT s.student_id, j.job_id
FROM (VALUES
 ('PES1UG24CS101', 'Backend Engineer'),
 ('PES1UG24CS107', 'Backend Engineer'),
 ('PES1UG24CS104', 'Cloud and DevOps Engineer'),
 ('PES1UG24CS112', 'Cloud and DevOps Engineer'),
 ('PES1UG24AM102', 'Computer Vision Engineer'),
 ('PES1UG24AM113', 'Data Analyst'),
 ('PES1UG24AM103', 'NLP and Retrieval Engineer'),
 ('PES1UG24AM116', 'NLP and Retrieval Engineer'),
 ('PES1UG24EC105', 'Embedded Firmware Engineer'),
 ('PES1UG24EC106', 'Embedded Firmware Engineer'),
 ('PES1UG24EC105', 'Digital Design Engineer'),
 ('PES1UG24AM108', 'Data Analyst'),
 ('PES1UG24ME110', 'Mechanical Design Engineer')
) AS v(srn, title)
JOIN students s ON s.srn = v.srn
JOIN job_postings j ON j.title = v.title;

-- Move a few applications along using the real transactional function.
SELECT shortlist_candidate(a.application_id, 'technical', now() + interval '3 days',
                           (SELECT user_id FROM users WHERE role = 'admin' LIMIT 1))
FROM applications a
JOIN students s ON s.student_id = a.student_id
JOIN job_postings j ON j.job_id = a.job_id
WHERE (s.srn, j.title) IN (
    ('PES1UG24CS107', 'Backend Engineer'),
    ('PES1UG24AM102', 'Computer Vision Engineer'),
    ('PES1UG24AM116', 'NLP and Retrieval Engineer'),
    ('PES1UG24EC105', 'Embedded Firmware Engineer'));

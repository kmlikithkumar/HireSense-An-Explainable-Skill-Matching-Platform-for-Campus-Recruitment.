-- =====================================================================
-- HireSense: sample data (fictional people and companies, for demo only)
-- Demo logins:  admin@hiresense.test / Admin@123
--               student01@hiresense.test ... student16@hiresense.test / Student@123
-- Embeddings are filled by `npm run db:embed`; applications by 05_seed_applications.sql
-- =====================================================================

INSERT INTO departments (code, name) VALUES
 ('CSE',  'Computer Science and Engineering'),
 ('AIML', 'Computer Science (AI and ML)'),
 ('ECE',  'Electronics and Communication Engineering'),
 ('EEE',  'Electrical and Electronics Engineering'),
 ('ME',   'Mechanical Engineering'),
 ('CE',   'Civil Engineering');

INSERT INTO skills (name) VALUES
 ('Python'), ('Java'), ('JavaScript'), ('TypeScript'), ('C++'), ('SQL'), ('PostgreSQL'),
 ('MongoDB'), ('React'), ('Node.js'), ('Next.js'), ('Docker'), ('Kubernetes'), ('AWS'),
 ('Linux'), ('Git'), ('Machine Learning'), ('Deep Learning'), ('NLP'), ('Computer Vision'),
 ('PyTorch'), ('TensorFlow'), ('scikit-learn'), ('Pandas'), ('Data Structures'),
 ('Algorithms'), ('REST APIs'), ('FastAPI'), ('Django'), ('Spring Boot'), ('CI/CD'),
 ('Embedded C'), ('RTOS'), ('Verilog'), ('VLSI'), ('MATLAB'), ('Networking'),
 ('Cybersecurity'), ('Tableau'), ('Power BI'), ('Excel'), ('Spark'), ('CAD'), ('SolidWorks');

-- ---- users -----------------------------------------------------------
INSERT INTO users (email, password_hash, role)
VALUES ('admin@hiresense.test', crypt('Admin@123', gen_salt('bf', 10)), 'admin');

INSERT INTO users (email, password_hash, role)
SELECT format('student%s@hiresense.test', lpad(n::TEXT, 2, '0')),
       crypt('Student@123', gen_salt('bf', 10)), 'student'
FROM generate_series(1, 16) AS n;

-- ---- students --------------------------------------------------------
INSERT INTO students (user_id, srn, full_name, dept_id, cgpa, backlog_count, grad_year, resume_text)
SELECT u.user_id, v.srn, v.full_name, d.dept_id, v.cgpa, v.backlogs, 2028, v.resume
FROM (VALUES
 (1,  'PES1UG24CS101', 'Aarav Menon',      'CSE',  9.10, 0,
  'Built a REST APIs backend with Node.js and PostgreSQL for a hostel complaints portal. Frontend in React and TypeScript. Solid grounding in Data Structures and Algorithms, 300+ problems solved. Uses Git and Docker daily.'),
 (2,  'PES1UG24AM102', 'Diya Raghunath',   'AIML', 9.40, 0,
  'Trained CNNs on medical imaging data to detect lung nodules using PyTorch. Built a Computer Vision pipeline with data augmentation and evaluation in scikit-learn. Comfortable with Python, Pandas and Linux.'),
 (3,  'PES1UG24AM103', 'Rohan Iyer',       'AIML', 8.70, 0,
  'Fine-tuned transformer models for sentiment and intent classification, an NLP project in Python with PyTorch. Built a retrieval chatbot using embeddings and FastAPI. Machine Learning coursework and Git.'),
 (4,  'PES1UG24CS104', 'Sneha Kulkarni',   'CSE',  8.20, 1,
  'Full stack developer: Next.js, React, TypeScript, MongoDB. Deployed side projects with Docker and CI/CD pipelines. Wrote REST APIs with Node.js.'),
 (5,  'PES1UG24EC105', 'Karthik Shetty',   'ECE',  8.90, 0,
  'Designed RTL modules in Verilog and verified them in simulation; interested in VLSI physical design. Wrote Embedded C firmware for an ARM microcontroller running an RTOS. MATLAB for signal processing.'),
 (6,  'PES1UG24EC106', 'Meera Nair',       'ECE',  7.80, 2,
  'Embedded C and RTOS firmware for sensor nodes, SPI and I2C drivers. Basic Networking and Linux. Built a LoRa weather station.'),
 (7,  'PES1UG24CS107', 'Vikram Rao',       'CSE',  9.00, 0,
  'Backend engineer in the making: Java, Spring Boot, PostgreSQL, SQL query tuning. Built a ticket booking service with transactions and indexing. Data Structures and Algorithms, Git.'),
 (8,  'PES1UG24AM108', 'Ananya Hegde',     'AIML', 9.20, 0,
  'Data scientist profile: Python, Pandas, scikit-learn, Machine Learning on tabular data, XGBoost style gradient boosting. Dashboards in Tableau and Power BI. Spark for large datasets and SQL.'),
 (9,  'PES1UG24CS109', 'Aditya Bhat',      'CSE',  7.40, 0,
  'Cybersecurity enthusiast: CTF player, Linux, Networking, Python scripting for web exploitation. Ran vulnerability scans on a campus web app.'),
 (10, 'PES1UG24ME110', 'Pooja Shenoy',     'ME',   8.50, 0,
  'Mechanical design with CAD and SolidWorks, finite element analysis in MATLAB. Built a 3D printed gripper for a robotics club. Excel for cost analysis.'),
 (11, 'PES1UG24EE111', 'Nikhil Gowda',     'EEE',  8.10, 0,
  'Power electronics and motor control; MATLAB simulations of inverters. Embedded C on a motor driver board. Python for data logging.'),
 (12, 'PES1UG24CS112', 'Ishita Prabhu',    'CSE',  8.80, 0,
  'Cloud and DevOps: AWS, Docker, Kubernetes, CI/CD with GitHub Actions, Linux administration. Python automation scripts and Git.'),
 (13, 'PES1UG24AM113', 'Tejas Murthy',     'AIML', 8.40, 1,
  'Deep Learning and Computer Vision: object detection with TensorFlow, model deployment with FastAPI and Docker. Python, NumPy, Pandas.'),
 (14, 'PES1UG24CS114', 'Kavya Reddy',      'CSE',  9.30, 0,
  'Competitive programmer: C++, Algorithms, Data Structures. Built a distributed key value store prototype for a systems course, with Linux and Networking. Git.'),
 (15, 'PES1UG24CE115', 'Harsh Jain',       'CE',   7.90, 0,
  'Structural analysis and AutoCAD style drafting, Excel for estimation, site visit reports. Learning Python for data analysis with Pandas.'),
 (16, 'PES1UG24AM116', 'Lakshmi Pillai',   'AIML', 9.50, 0,
  'Built a RAG notes assistant: embeddings, hybrid retrieval, Node.js and Express backend, React frontend. NLP and Machine Learning coursework, Python, SQL and MongoDB. Git and Docker.')
) AS v(n, srn, full_name, dept, cgpa, backlogs, resume)
JOIN departments d ON d.code = v.dept
JOIN users u ON u.email = format('student%s@hiresense.test', lpad(v.n::TEXT, 2, '0'));

-- ---- companies and postings -----------------------------------------
INSERT INTO companies (name, industry, website) VALUES
 ('Nimbus Cloud Systems',  'Cloud infrastructure', 'https://nimbus.example.com'),
 ('Arcturus AI Labs',      'Artificial intelligence', 'https://arcturus.example.com'),
 ('Helix Semiconductors',  'Semiconductors',       'https://helix.example.com'),
 ('Vertex FinTech',        'Financial technology', 'https://vertex.example.com'),
 ('Orbit Robotics',        'Robotics',             'https://orbit.example.com');

INSERT INTO job_postings (company_id, title, jd_text, min_cgpa, max_backlogs, ctc_lpa, deadline, created_by)
SELECT c.company_id, v.title, v.jd, v.min_cgpa, v.max_backlogs, v.ctc,
       now() + (v.days || ' days')::INTERVAL,
       (SELECT user_id FROM users WHERE role = 'admin' LIMIT 1)
FROM (VALUES
 ('Nimbus Cloud Systems', 'Backend Engineer',
  'Design and build REST APIs and services on PostgreSQL. You will own database schemas, write efficient SQL, tune queries and indexes, and ship with Docker and CI/CD. Experience with Node.js or Java is a plus.',
  8.0, 0, 14.0, 20),
 ('Nimbus Cloud Systems', 'Cloud and DevOps Engineer',
  'Run and automate our cloud platform on AWS. Containerise services with Docker, operate Kubernetes clusters, build CI/CD pipelines, and keep Linux systems healthy. Python scripting for automation.',
  7.5, 1, 12.0, 25),
 ('Arcturus AI Labs', 'Computer Vision Engineer',
  'Build image understanding models for medical and industrial inspection. Train and evaluate convolutional neural networks, work with imaging datasets, and deploy models behind APIs. PyTorch or TensorFlow required.',
  8.5, 0, 18.0, 18),
 ('Arcturus AI Labs', 'NLP and Retrieval Engineer',
  'Work on language models, embeddings and retrieval augmented generation. Build search and question answering over documents, evaluate relevance, and serve results through FastAPI services. Strong Python and Machine Learning fundamentals.',
  8.5, 0, 20.0, 22),
 ('Helix Semiconductors', 'Embedded Firmware Engineer',
  'Write Embedded C firmware for microcontrollers running an RTOS. Develop peripheral drivers, debug on hardware, and work with Linux build tooling. Electronics background preferred.',
  7.5, 2, 10.0, 15),
 ('Helix Semiconductors', 'Digital Design Engineer',
  'RTL design in Verilog and verification of digital blocks for VLSI products. Simulation, timing analysis and scripting. MATLAB or Python for modelling.',
  8.0, 0, 13.0, 30),
 ('Vertex FinTech', 'Data Analyst',
  'Turn payment and customer data into decisions. Strong SQL, Python with Pandas, dashboards in Tableau or Power BI, and statistical thinking. Spark experience helps at our data volumes.',
  8.0, 1, 11.0, 12),
 ('Orbit Robotics', 'Mechanical Design Engineer',
  'Design robotic grippers and chassis in SolidWorks and CAD, run FEA, and prepare cost estimates. Work with the controls team on prototypes.',
  7.5, 1, 9.0, 28)
) AS v(company, title, jd, min_cgpa, max_backlogs, ctc, days)
JOIN companies c ON c.name = v.company;

-- Department restrictions (jobs not listed here accept every department)
INSERT INTO job_eligible_departments (job_id, dept_id)
SELECT j.job_id, d.dept_id
FROM (VALUES
 ('Computer Vision Engineer',   'CSE'), ('Computer Vision Engineer',   'AIML'), ('Computer Vision Engineer', 'ECE'),
 ('NLP and Retrieval Engineer', 'CSE'), ('NLP and Retrieval Engineer', 'AIML'),
 ('Embedded Firmware Engineer', 'ECE'), ('Embedded Firmware Engineer', 'EEE'), ('Embedded Firmware Engineer', 'CSE'),
 ('Digital Design Engineer',    'ECE'), ('Digital Design Engineer',    'EEE'),
 ('Mechanical Design Engineer', 'ME'),  ('Mechanical Design Engineer', 'EEE')
) AS v(title, dept)
JOIN job_postings j ON j.title = v.title
JOIN departments d  ON d.code = v.dept;

-- Required skills per posting
INSERT INTO job_skills (job_id, skill_id)
SELECT j.job_id, sk.skill_id
FROM (VALUES
 ('Backend Engineer', 'PostgreSQL'), ('Backend Engineer', 'SQL'), ('Backend Engineer', 'REST APIs'),
 ('Backend Engineer', 'Docker'), ('Backend Engineer', 'CI/CD'), ('Backend Engineer', 'Node.js'),
 ('Cloud and DevOps Engineer', 'AWS'), ('Cloud and DevOps Engineer', 'Docker'), ('Cloud and DevOps Engineer', 'Kubernetes'),
 ('Cloud and DevOps Engineer', 'CI/CD'), ('Cloud and DevOps Engineer', 'Linux'), ('Cloud and DevOps Engineer', 'Python'),
 ('Computer Vision Engineer', 'Computer Vision'), ('Computer Vision Engineer', 'Deep Learning'),
 ('Computer Vision Engineer', 'PyTorch'), ('Computer Vision Engineer', 'TensorFlow'), ('Computer Vision Engineer', 'Python'),
 ('NLP and Retrieval Engineer', 'NLP'), ('NLP and Retrieval Engineer', 'Machine Learning'),
 ('NLP and Retrieval Engineer', 'Python'), ('NLP and Retrieval Engineer', 'FastAPI'),
 ('Embedded Firmware Engineer', 'Embedded C'), ('Embedded Firmware Engineer', 'RTOS'), ('Embedded Firmware Engineer', 'Linux'),
 ('Digital Design Engineer', 'Verilog'), ('Digital Design Engineer', 'VLSI'), ('Digital Design Engineer', 'MATLAB'),
 ('Data Analyst', 'SQL'), ('Data Analyst', 'Python'), ('Data Analyst', 'Pandas'),
 ('Data Analyst', 'Tableau'), ('Data Analyst', 'Power BI'), ('Data Analyst', 'Spark'),
 ('Mechanical Design Engineer', 'SolidWorks'), ('Mechanical Design Engineer', 'CAD'), ('Mechanical Design Engineer', 'Excel')
) AS v(title, skill)
JOIN job_postings j ON j.title = v.title
JOIN skills sk      ON sk.name = v.skill;

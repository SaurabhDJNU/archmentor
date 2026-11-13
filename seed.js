// Sample content used in demo mode (no Supabase configured).
// Mentor names, titles and services mirror the current ArchMentor site; bios are shortened.

const now = Date.now();
const day = 86400000;
const iso = (offsetDays, hour = 0) => new Date(now + offsetDays * day + hour * 3600000).toISOString();

const blankProfile = { approved: false, title: '', organisation: '', bio: '', photo_url: '', linkedin_url: '', portfolio_url: '', calendly_url: '', expertise: '', experience: '', works_with: [], stage: '' };

const mentor = (id, email, full_name, title, organisation, expertise, bio, extra = {}) => ({
  ...blankProfile, id, email, full_name, role: 'mentor', approved: true, title, organisation, expertise, experience: '20+ years', bio,
  works_with: ['Architecture students', 'Recent graduates', 'Admission applicants'], created_at: iso(-30), ...extra,
});

const service = (id, mentor_id, category, title, description, duration_min, price_inr = 0, sort = 0) => ({
  id, mentor_id, category, title, description, duration_min, price_inr, active: true, sort, created_at: iso(-20),
});

export const seed = {
  profiles: [
    { ...blankProfile, id: 'u-admin', email: 'admin@demo.archmentor', full_name: 'Site Admin', role: 'admin', approved: true, created_at: iso(-40) },
    { ...blankProfile, id: 'u-student', email: 'student@demo.archmentor', full_name: 'Demo Student', role: 'student', stage: '4th year B.Arch', created_at: iso(-10) },
    { ...blankProfile, id: 'u-pro', email: 'professional@demo.archmentor', full_name: 'Demo Professional', role: 'professional', title: 'Architect', created_at: iso(-8) },
    mentor('m-satish', 'mentor@demo.archmentor', 'Satish Khanna', 'Practising Architect', 'Satish Khanna Associates, Architects', 'Urban Design',
      'Practising architect with extensive experience in Urban Design. I help architecture students strengthen their design thinking, develop academic and urban design projects, improve portfolios, and gain clarity on career and professional practice.',
      { calendly_url: 'https://calendly.com/', portfolio_url: 'https://khanna-architects.vercel.app/' }),
    mentor('m-aruna', 'aruna@demo.archmentor', 'Aruna Ramani Grover', 'Retired Professor of Architecture', 'School of Planning and Architecture, New Delhi', 'Thesis / Dissertation',
      'I am an architect planner who retired as Professor of Architecture from SPA Delhi after 38 years of teaching experience. I enjoy research and writing.'),
    mentor('m-kuldeep', 'kuldeep@demo.archmentor', 'Dr. Kuldeep Kumar', 'Associate Professor', 'Amity University', 'Other',
      'I am an architect, academic and researcher with 20+ years of professional experience across real estate, construction, architectural practice and design.'),
    mentor('m-sanjay', 'sanjay@demo.archmentor', 'Sanjay Mehra', 'Professor, Dean', 'Vastu Kala Academy', 'Thesis / Dissertation',
      'Experienced professor with a long history of working in higher education. Skilled in urban planning, feasibility studies and design.'),
    { ...blankProfile, id: 'm-pending', email: 'newmentor@demo.archmentor', full_name: 'New Mentor (pending)', role: 'mentor', title: 'Architect', expertise: 'Housing', bio: 'Waiting for admin approval.', created_at: iso(-1) },
  ],
  passwords: {
    'admin@demo.archmentor': 'demo1234',
    'student@demo.archmentor': 'demo1234',
    'mentor@demo.archmentor': 'demo1234',
    'professional@demo.archmentor': 'demo1234',
  },
  services: [
    service('sv-1', 'm-satish', 'Career', 'Free Architecture Intro Call', 'A free introductory session to discuss your architecture goals, portfolio, career aspirations, and determine the best mentorship path.', 20, 0, 0),
    service('sv-2', 'm-satish', 'Sustainability', 'Sustainable Architecture Guidance', 'Discuss sustainable architecture principles, climate-responsive design, materials, and environmental strategies.', 30, 0, 1),
    service('sv-3', 'm-satish', 'Sustainability', 'Passive & Energy Efficient Design', 'Learn passive cooling, daylighting, natural ventilation, orientation, shading, and energy-efficient building design.', 30, 0, 2),
    service('sv-4', 'm-satish', 'Housing', 'Affordable & Incremental Housing', 'Explore affordable housing, incremental housing, modular systems, and practical residential design solutions.', 30, 0, 3),
    service('sv-5', 'm-satish', 'Academic', 'Thesis & Research Guidance', 'Guidance for thesis topic selection, research methodology, case studies, literature review, and presentation.', 30, 0, 4),
    service('sv-6', 'm-aruna', 'Academic', 'Free Intro Call', 'A short first conversation about your thesis or research and how I can help.', 20),
    service('sv-7', 'm-kuldeep', 'Career', 'Free Intro Call', 'A short first conversation about your goals in practice, real estate or academia.', 20),
    service('sv-8', 'm-sanjay', 'Academic', 'Free Intro Call', 'A short first conversation about your thesis, studio work or higher studies.', 20),
  ],
  requests: [
    { id: 'r-1', student_id: 'u-student', mentor_id: 'm-satish', service_id: 'sv-1', service: 'Career', service_title: 'Free Architecture Intro Call', duration_min: 20, price_inr: 0, student_name: 'Demo Student', student_email: 'student@demo.archmentor', mentor_name: 'Satish Khanna', stage: '4th year B.Arch', message: 'I am applying for internships next month and want feedback on my portfolio order and layout.', preferred_time: 'Weekday evenings', status: 'pending', meeting_link: '', mentor_note: '', created_at: iso(-2) },
  ],
  sessions: [
    { id: 's-1', slug: 'thesis-dilemma', title: 'The Thesis Dilemma: What to Choose, Why & How?', subtitle: 'An Interactive Online Session for Final-Year Architecture Thesis Students (2026–27)', description: 'An interactive online session for final-year students choosing their thesis. Bring your shortlist of topics and your questions.', kind: 'Thesis Guidance', starts_at: '2026-12-15T12:30:00.000Z', ends_at: '2026-12-15T13:10:00.000Z', platform: 'Zoom', format: 'Online, interactive', capacity: 50, host_name: '', join_link: 'https://zoom.us/', featured: true, published: true, reminder_sent: false, announced: true, created_at: iso(-5) },
  ],
  registrations: [
    { id: 'g-1', session_id: 's-1', user_id: 'x1', name: 'Reg One', email: 'one@example.com', created_at: iso(-3) },
    { id: 'g-2', session_id: 's-1', user_id: 'x2', name: 'Reg Two', email: 'two@example.com', created_at: iso(-3) },
    { id: 'g-3', session_id: 's-1', user_id: 'x3', name: 'Reg Three', email: 'three@example.com', created_at: iso(-3) },
  ],
  posts: [
    {
      id: 'p-1', slug: 'present-to-the-external-jury', title: 'How to Present a Design to the External Jury', dek: 'What visiting critics look for, and how to walk them through your project with confidence.', tag: 'Jury, presentation', author_name: 'ArchMentor', author_id: null, submitted: false, announced: true, cover_url: '', youtube_id: '', published: true, published_at: iso(-6), created_at: iso(-6),
      body: '<p>An external juror meets your project cold. They have not seen your desk crits, and they have a few minutes. Your job is to give them a way in.</p><h2>Start with the idea, not the site</h2><p>Open with one sentence that says what the project is trying to do. Then show the drawing that proves it.</p><h2>Pin up in reading order</h2><ul><li><p>Big idea and key image first, at eye level</p></li><li><p>Plans and sections next, in the order you will talk about them</p></li><li><p>Process and models last, for questions</p></li></ul><blockquote><p>Sample article. Replace it from the admin dashboard.</p></blockquote>',
    },
    {
      id: 'p-2', slug: 'learning-design-through-observation', title: 'Learning Design Through Observation', dek: 'Why looking closely at buildings, streets and people is one of the best design teachers you have.', tag: 'Studio, practice', author_name: 'ArchMentor', author_id: null, submitted: false, announced: true, cover_url: '', youtube_id: '', published: true, published_at: iso(-14), created_at: iso(-14),
      body: '<p>Most of what makes a place work is visible if you stay long enough to see it: where people choose to sit, where light falls at four in the afternoon, which doorway everyone uses.</p><h2>Draw what you see</h2><p>A quick sketch forces you to decide what matters. Keep a small sketchbook and give yourself ten minutes per place.</p><blockquote><p>Sample article. Replace it from the admin dashboard.</p></blockquote>',
    },
  ],
  videos: [
    { id: 'v-1', youtube_id: '', title: 'Is architecture only about design? Full talk', kind: 'full', featured: true, sort: 0, published: true, created_at: iso(0) },
    { id: 'v-2', youtube_id: '', title: 'Studio word: parti', kind: 'short', featured: false, sort: 1, published: true, created_at: iso(0) },
    { id: 'v-3', youtube_id: '', title: 'One tip for your external jury', kind: 'short', featured: false, sort: 2, published: true, created_at: iso(0) },
  ],
  forum_questions: [
    { id: 'q-1', author_id: 'u-student', author_name: 'Demo Student', author_role: 'student', title: 'How many projects should go in an internship portfolio?', body: 'I have eight studio projects. Should I include all of them or only the best few?', category: 'Portfolio', views: 14, answers_count: 1, helpful_total: 2, created_at: iso(-3) },
    { id: 'q-2', author_id: 'u-pro', author_name: 'Demo Professional', author_role: 'professional', title: 'Which software do offices expect interns to know?', body: 'Is Revit essential now, or is AutoCAD with SketchUp still enough for most firms?', category: 'Software', views: 6, answers_count: 0, helpful_total: 0, created_at: iso(-1) },
  ],
  forum_answers: [
    { id: 'a-1', question_id: 'q-1', author_id: 'm-satish', author_name: 'Satish Khanna', author_role: 'mentor', body: 'Fewer than you think. Four or five strong projects, each shown clearly, beat eight thin ones. Put your best project first and your most recent one second.', helpful: 2, created_at: iso(-2) },
  ],
  forum_votes: [{ answer_id: 'a-1', user_id: 'x1' }, { answer_id: 'a-1', user_id: 'x2' }],
  submissions: [],
  subscribers: [],
  settings: { site_name: 'ArchMentor', site_url: '', admin_email: '', sender_email: '', sender_name: 'ArchMentor', reply_to: '', emails_on: true },
  email_log: [],
};

export const terms = [
  { word: 'Parti', say: 'par-TEE', meaning: 'The central idea that organises a design, often shown as a simple diagram. Juries ask for it first.' },
  { word: 'Poché', say: 'poh-SHAY', meaning: 'The solid mass in a plan, such as walls and columns, usually filled in so that the spaces between them read clearly.' },
  { word: 'Charrette', say: 'sha-RET', meaning: 'An intense, time-boxed design push, named after the cart that collected student drawings at the École des Beaux-Arts in Paris.' },
  { word: 'Jury', say: 'JOO-ree', meaning: 'A review where students present their work to a panel of tutors and visiting critics, who respond in public.' },
];

export const SERVICE_CATEGORIES = ['Career', 'Portfolio', 'Admissions', 'Academic', 'Thesis', 'Sustainability', 'Housing', 'Urban Design', 'Software', 'Other'];
export const EXPERTISE = ['Architectural Design', 'Urban Design', 'Thesis / Dissertation', 'Sustainability', 'Housing', 'Conservation', 'Interior Design', 'Landscape', 'Construction & Practice', 'Academics & Research', 'Other'];
export const WORKS_WITH = ['Architecture students', 'Recent graduates', 'Admission applicants', 'Working professionals'];

// Sample content used in demo mode (no Supabase configured).
// Replace or delete freely; the same starter content is in supabase/seed.sql.

const now = Date.now();
const day = 86400000;

export const seed = {
  profiles: [
    { id: 'u-admin', email: 'admin@demo.archmentor', full_name: 'Site Admin', role: 'admin', approved: true, title: '', organisation: '', bio: '', photo_url: '', linkedin_url: '', specialties: [], stage: '', created_at: new Date(now - 40 * day).toISOString() },
    { id: 'u-student', email: 'student@demo.archmentor', full_name: 'Demo Student', role: 'student', approved: false, title: '', organisation: '', bio: '', photo_url: '', linkedin_url: '', specialties: [], stage: '4th year B.Arch', created_at: new Date(now - 10 * day).toISOString() },
    { id: 'm-satish', email: 'mentor@demo.archmentor', full_name: 'Satish Khanna', role: 'mentor', approved: true, title: 'Practising Architect', organisation: '', bio: 'Practising architect. Full profile coming soon.', photo_url: '', linkedin_url: '', specialties: ['portfolio', 'career'], stage: '', created_at: new Date(now - 30 * day).toISOString() },
    { id: 'm-sanjay', email: 'sanjay@demo.archmentor', full_name: 'Sanjay Mehra', role: 'mentor', approved: true, title: 'Professor, Dean', organisation: '', bio: 'Professor and dean. Full profile coming soon.', photo_url: '', linkedin_url: '', specialties: ['admissions', 'career'], stage: '', created_at: new Date(now - 29 * day).toISOString() },
    { id: 'm-kuldeep', email: 'kuldeep@demo.archmentor', full_name: 'Dr. Kuldeep Kumar', role: 'mentor', approved: true, title: 'Associate Professor', organisation: '', bio: 'Associate professor. Full profile coming soon.', photo_url: '', linkedin_url: '', specialties: ['portfolio', 'admissions'], stage: '', created_at: new Date(now - 28 * day).toISOString() },
    { id: 'm-pending', email: 'newmentor@demo.archmentor', full_name: 'New Mentor (pending)', role: 'mentor', approved: false, title: 'Architect', organisation: '', bio: 'Waiting for admin approval.', photo_url: '', linkedin_url: '', specialties: ['career'], stage: '', created_at: new Date(now - 1 * day).toISOString() },
  ],
  passwords: {
    'admin@demo.archmentor': 'demo1234',
    'student@demo.archmentor': 'demo1234',
    'mentor@demo.archmentor': 'demo1234',
  },
  requests: [
    { id: 'r-1', student_id: 'u-student', mentor_id: 'm-satish', student_name: 'Demo Student', student_email: 'student@demo.archmentor', mentor_name: 'Satish Khanna', service: 'portfolio', stage: '4th year B.Arch', message: 'I am applying for internships next month and want feedback on my portfolio order and layout.', preferred_time: 'Weekday evenings', status: 'pending', meeting_link: '', mentor_note: '', created_at: new Date(now - 2 * day).toISOString() },
  ],
  sessions: [
    { id: 's-1', title: 'Is architecture only about design?', description: 'A career talk on the paths beyond conventional design practice, and how the profession keeps changing. Open discussion; bring your questions.', kind: 'Career talk', starts_at: new Date(now + 9 * day).toISOString(), format: 'Online, interactive', join_link: '', featured: true, published: true, created_at: new Date(now - 5 * day).toISOString() },
  ],
  registrations: [],
  posts: [
    {
      id: 'p-1', slug: 'present-to-the-external-jury', title: 'How to present a design to the external jury', dek: 'What visiting critics look for, and how to walk them through your project with confidence.', tag: 'Jury, presentation', author_name: 'ArchMentor', cover_url: '', youtube_id: '', published: true, published_at: new Date(now - 6 * day).toISOString(), created_at: new Date(now - 6 * day).toISOString(),
      body: `An external juror meets your project cold. They have not seen your desk crits, and they have a few minutes. Your job is to give them a way in.\n\n## Start with the idea, not the site\n\nOpen with one sentence that says what the project is trying to do. Then show the drawing that proves it. Site analysis can come after, briefly, as the reason for that idea.\n\n## Pin up in reading order\n\n- Big idea and key image first, at eye level\n- Plans and sections next, in the order you will talk about them\n- Process and models last, for questions\n\n## Leave room for the conversation\n\nStop talking a little earlier than feels comfortable. The most useful part of a jury is the discussion, and a juror who has room to ask will engage with your work more generously.\n\n> Sample article. Replace it from the admin dashboard.`
    },
    {
      id: 'p-2', slug: 'learning-design-through-observation', title: 'Learning design through observation', dek: 'Why looking closely at buildings, streets and people is one of the best design teachers you have.', tag: 'Studio, practice', author_name: 'ArchMentor', cover_url: '', youtube_id: '', published: true, published_at: new Date(now - 14 * day).toISOString(), created_at: new Date(now - 14 * day).toISOString(),
      body: `Most of what makes a place work is visible if you stay long enough to see it: where people choose to sit, where light falls at four in the afternoon, which doorway everyone uses and which one stays shut.\n\n## Draw what you see\n\nA quick sketch forces you to decide what matters. A photograph does not. Keep a small sketchbook and give yourself ten minutes per place.\n\n## Measure with your body\n\nPace out a courtyard. Count steps on a stair. Scale stops being abstract once you have felt it.\n\n## Bring it back to studio\n\nWhen a design decision is stuck, ask where you have seen the problem solved well, and go back and look again.\n\n> Sample article. Replace it from the admin dashboard.`
    },
  ],
  videos: [
    { id: 'v-1', youtube_id: '', title: 'Is architecture only about design? Full talk', kind: 'full', featured: true, sort: 0, published: true, created_at: new Date(now).toISOString() },
    { id: 'v-2', youtube_id: '', title: 'Studio word: parti', kind: 'short', featured: false, sort: 1, published: true, created_at: new Date(now).toISOString() },
    { id: 'v-3', youtube_id: '', title: 'Studio word: poché', kind: 'short', featured: false, sort: 2, published: true, created_at: new Date(now).toISOString() },
    { id: 'v-4', youtube_id: '', title: 'One tip for your external jury', kind: 'short', featured: false, sort: 3, published: true, created_at: new Date(now).toISOString() },
    { id: 'v-5', youtube_id: '', title: 'Learning design by observation', kind: 'short', featured: false, sort: 4, published: true, created_at: new Date(now).toISOString() },
  ],
  questions: [
    { id: 'q-1', name: 'Riya', stage: '3rd year B.Arch', question: 'How many projects should go in an internship portfolio?', show_name: true, answer: 'Fewer than you think. Four or five strong projects, each shown clearly, beat ten thin ones. Put your best project first and your most recent one second.', answered_by: 'ArchMentor mentor', published: true, created_at: new Date(now - 3 * day).toISOString() },
  ],
  submissions: [],
  subscribers: [],
};

export const terms = [
  { word: 'Parti', say: 'par-TEE', meaning: 'The central idea that organises a design, often shown as a simple diagram. Juries ask for it first.' },
  { word: 'Poché', say: 'poh-SHAY', meaning: 'The solid mass in a plan, such as walls and columns, usually filled in so that the spaces between them read clearly.' },
  { word: 'Charrette', say: 'sha-RET', meaning: 'An intense, time-boxed design push, named after the cart that collected student drawings at the École des Beaux-Arts in Paris.' },
  { word: 'Jury', say: 'JOO-ree', meaning: 'A review where students present their work to a panel of tutors and visiting critics, who respond in public.' },
];

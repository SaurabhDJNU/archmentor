import { Link, useParams } from 'react-router-dom';
import * as platform from './platform.js';
import { useLoad, useTitle } from './util.js';
import { CONTACT_EMAIL } from './config.js';
import { T, Img } from './Content.jsx';

// Plain-language DRAFTS. They must be reviewed by a lawyer before payments go live (see README → Before going live).
const PAGES = {
  privacy: {
    title: 'Privacy policy',
    body: (s) => [
      ['Who we are', `${s.business_name || s.site_name || 'ArchMentor'} runs this website${s.business_address ? ` from ${s.business_address}` : ''}. Questions: ${s.support_email || CONTACT_EMAIL || 'see the Contact page'}.`],
      ['What we collect', 'Your name, email and the details you add to your profile; the messages, bookings, questions and files you send us; payment records (we never see or store card, UPI PIN or bank login details — Razorpay handles them); and basic technical logs needed to keep the service secure.'],
      ['Why', 'To run your account, match you with mentors, deliver sessions and reviews, send the emails you need (confirmations, reminders, receipts), handle payments and refunds, keep the platform safe and meet legal duties such as tax records.'],
      ['Who can see it', 'Mentors see what you send them for a booking or review. Our team sees only what their role needs. Portfolio files are private and open through short-lived links. Service providers: Supabase (database and storage), Brevo (email), Razorpay (payments), Cloudflare (hosting). We do not sell your data.'],
      ['Your choices', 'You can update your profile, unsubscribe from news emails with one click, and ask us to export or delete your account. Some payment records must be kept for the period the law requires.'],
      ['Retention', 'Account data is kept while your account is open. Payment and tax records are kept for as long as Indian law requires. Logs are kept for a limited period for security.'],
      ['Grievance officer', `Write to ${s.support_email || CONTACT_EMAIL || 'our support email'} with “Grievance” in the subject. We reply within 30 days.`],
    ],
  },
  terms: {
    title: 'Terms of use',
    body: (s) => [
      ['The service', `${s.site_name || 'ArchMentor'} connects architecture students and graduates with practising mentors for guidance, live sessions, portfolio reviews and community discussion. Mentors are independent professionals; their advice is their own.`],
      ['Accounts', 'Use your real name and keep your password safe. Mentors are verified by our team before they appear publicly. We may suspend accounts that abuse the platform or other members.'],
      ['Bookings and payments', 'Prices are shown before you pay. Payment confirms a booking. Paid amounts are held by us and paid to the mentor after the session is completed and a short safety hold, minus the platform fee shown to mentors.'],
      ['Conduct', 'Be respectful. No harassment, spam, plagiarism or sharing other people’s work as your own. Do not take payments for sessions outside the platform for bookings made here.'],
      ['Content', 'You keep the rights to what you upload. You allow us to store and show it as needed to run the service (for example, to your mentor). Do not upload anything you do not have the right to share.'],
      ['Liability', 'Guidance is educational. We are not responsible for decisions you take based on it, for third-party sites, or for outages beyond our control. Nothing here limits rights you have under Indian consumer law.'],
      ['Changes', 'We will tell you by email before material changes to these terms.'],
    ],
  },
  refunds: {
    title: 'Cancellation and refund policy',
    body: (s) => [
      ['Cancelling a session', `Cancel or move a paid session up to ${s.cancel_hours ?? 24} hours before it starts for a full refund or a free reschedule. Later cancellations are reviewed case by case.`],
      ['If the mentor cancels', 'You get a full refund or a new time of your choice.'],
      ['Portfolio reviews', 'Full refund until a mentor starts the review. After feedback is delivered, refunds are only given if the review was not delivered as described.'],
      ['Live sessions', `Full refund if you cancel your seat at least ${s.cancel_hours ?? 24} hours before the start, or if we cancel the session.`],
      ['How refunds work', 'Request a refund from Dashboard → Payments. Our finance team reviews it; approved refunds go back to the original payment method, usually within 5–7 working days.'],
      ['Contact', `${s.support_email || CONTACT_EMAIL || 'Use the Support page'}`],
    ],
  },
};

export default function Legal() {
  const { page } = useParams();
  const p = PAGES[page] || PAGES.terms;
  useTitle(p.title);
  const { data } = useLoad(platform.publicSettings);
  const s = data || {};
  return (
    <div className="wrap page-top prose-page" style={{ maxWidth: 820 }}>
      <p className="label">Legal</p>
      <h1 className="h-l mt-16">{p.title}</h1>
      <p className="small muted mt-16">Draft for review — last updated {new Date().getFullYear()}.</p>
      <div className="stack gap-32 mt-48">
        {p.body(s).map(([h, t], i) => <section key={h}><h2 className="h-m"><T k={`legal.${page}.${i}.h`}>{h}</T></h2><p className="mt-8" style={{ color: 'var(--ink-2)' }}><T k={`legal.${page}.${i}.t`} block>{t}</T></p></section>)}
      </div>
      <p className="mt-64 small"><Link className="ul" to="/legal/privacy">Privacy</Link> · <Link className="ul" to="/legal/terms">Terms</Link> · <Link className="ul" to="/legal/refunds">Refunds</Link> · <Link className="ul" to="/support">Contact &amp; support</Link></p>
    </div>
  );
}

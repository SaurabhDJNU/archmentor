-- Optional starter content. Run after schema.sql (SQL Editor → New query → Run).
-- Edit or delete any of it later from the admin dashboard. Running it twice does not duplicate anything.

insert into public.sessions (slug, title, subtitle, description, kind, starts_at, ends_at, platform, format, capacity, featured, published, announced)
values ($q$thesis-dilemma$q$, $q$The Thesis Dilemma: What to Choose, Why & How?$q$, $q$An Interactive Online Session for Final-Year Architecture Thesis Students (2026–27)$q$, $q$An interactive online session for final-year students choosing their thesis. Bring your shortlist of topics and your questions.$q$, $q$Thesis Guidance$q$, $q$2026-12-15T12:30:00.000Z$q$, $q$2026-12-15T13:10:00.000Z$q$, $q$Zoom$q$, $q$Online, interactive$q$, 50, true, true, true)
on conflict do nothing;

insert into public.posts (slug, title, dek, body, tag, author_name, published, announced)
values ($q$present-to-the-external-jury$q$, $q$How to Present a Design to the External Jury$q$, $q$What visiting critics look for, and how to walk them through your project with confidence.$q$, $q$<p>An external juror meets your project cold. They have not seen your desk crits, and they have a few minutes. Your job is to give them a way in.</p><h2>Start with the idea, not the site</h2><p>Open with one sentence that says what the project is trying to do. Then show the drawing that proves it.</p><h2>Pin up in reading order</h2><ul><li><p>Big idea and key image first, at eye level</p></li><li><p>Plans and sections next, in the order you will talk about them</p></li><li><p>Process and models last, for questions</p></li></ul><blockquote><p>Sample article. Replace it from the admin dashboard.</p></blockquote>$q$, $q$Jury, presentation$q$, $q$ArchMentor$q$, true, true)
on conflict (slug) do nothing;

insert into public.posts (slug, title, dek, body, tag, author_name, published, announced)
values ($q$learning-design-through-observation$q$, $q$Learning Design Through Observation$q$, $q$Why looking closely at buildings, streets and people is one of the best design teachers you have.$q$, $q$<p>Most of what makes a place work is visible if you stay long enough to see it: where people choose to sit, where light falls at four in the afternoon, which doorway everyone uses.</p><h2>Draw what you see</h2><p>A quick sketch forces you to decide what matters. Keep a small sketchbook and give yourself ten minutes per place.</p><blockquote><p>Sample article. Replace it from the admin dashboard.</p></blockquote>$q$, $q$Studio, practice$q$, $q$ArchMentor$q$, true, true)
on conflict (slug) do nothing;

-- Add the Zoom link for the session in Admin → Live sessions → Edit.
-- Videos need a real YouTube link: add them in Admin → Videos.

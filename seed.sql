-- Optional starter content. Run after schema.sql (SQL Editor → New query → Run).
-- Edit or delete any of it later from the admin dashboard.

insert into public.sessions (title, description, kind, starts_at, format, featured, published)
values ($q$Is architecture only about design?$q$, $q$A career talk on the paths beyond conventional design practice, and how the profession keeps changing. Open discussion; bring your questions.$q$, $q$Career talk$q$, null, $q$Online, interactive$q$, true, true);

insert into public.posts (slug, title, dek, body, tag, author_name, published)
values ($q$present-to-the-external-jury$q$, $q$How to present a design to the external jury$q$, $q$What visiting critics look for, and how to walk them through your project with confidence.$q$, $q$An external juror meets your project cold. They have not seen your desk crits, and they have a few minutes. Your job is to give them a way in.

## Start with the idea, not the site

Open with one sentence that says what the project is trying to do. Then show the drawing that proves it. Site analysis can come after, briefly, as the reason for that idea.

## Pin up in reading order

- Big idea and key image first, at eye level
- Plans and sections next, in the order you will talk about them
- Process and models last, for questions

## Leave room for the conversation

Stop talking a little earlier than feels comfortable. The most useful part of a jury is the discussion, and a juror who has room to ask will engage with your work more generously.

> Sample article. Replace it from the admin dashboard.$q$, $q$Jury, presentation$q$, $q$ArchMentor$q$, true)
on conflict (slug) do nothing;

insert into public.posts (slug, title, dek, body, tag, author_name, published)
values ($q$learning-design-through-observation$q$, $q$Learning design through observation$q$, $q$Why looking closely at buildings, streets and people is one of the best design teachers you have.$q$, $q$Most of what makes a place work is visible if you stay long enough to see it: where people choose to sit, where light falls at four in the afternoon, which doorway everyone uses and which one stays shut.

## Draw what you see

A quick sketch forces you to decide what matters. A photograph does not. Keep a small sketchbook and give yourself ten minutes per place.

## Measure with your body

Pace out a courtyard. Count steps on a stair. Scale stops being abstract once you have felt it.

## Bring it back to studio

When a design decision is stuck, ask where you have seen the problem solved well, and go back and look again.

> Sample article. Replace it from the admin dashboard.$q$, $q$Studio, practice$q$, $q$ArchMentor$q$, true)
on conflict (slug) do nothing;

-- Videos need a real YouTube link: add them from Admin → Videos.

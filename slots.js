// Booking slots from a mentor's weekly hours (India time), minus busy times and time off.
// The database checks every slot again (private.slot_ok), so this is only for display.
const IST_OFFSET_MIN = 330;

// Date → { y, m, d, dow, minutes } in India time
export function istParts(date) {
  const t = new Date(+new Date(date) + IST_OFFSET_MIN * 60000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), dow: t.getUTCDay(), minutes: t.getUTCHours() * 60 + t.getUTCMinutes() };
}
// India-time wall clock → real instant
export function istToDate(y, m, d, minutes) {
  return new Date(Date.UTC(y, m, d, 0, minutes) - IST_OFFSET_MIN * 60000);
}
const toMin = (hhmm) => { const [h, mi] = String(hhmm).split(':').map(Number); return h * 60 + (mi || 0); };

export function buildSlots({ availability = [], busy = [], durationMin = 60, from = new Date(), days = 14, leadMinutes = 120 }) {
  const out = [];
  const start = istParts(from);
  const earliest = +new Date(from) + leadMinutes * 60000;
  for (let i = 0; i < days; i++) {
    const day = new Date(Date.UTC(start.y, start.m, start.d + i));
    const y = day.getUTCFullYear(); const m = day.getUTCMonth(); const d = day.getUTCDate(); const dow = day.getUTCDay();
    const slots = [];
    for (const a of availability.filter((x) => Number(x.weekday) === dow)) {
      const s = toMin(a.start_time); const e = toMin(a.end_time); const step = Number(a.slot_minutes) || 60;
      for (let t = s; t + durationMin <= e; t += step) {
        const at = istToDate(y, m, d, t); const end = +at + durationMin * 60000;
        if (+at < earliest) continue;
        if (busy.some((b) => +new Date(b.start_at) < end && +new Date(b.end_at) > +at)) continue;
        if (!slots.some((x) => +x === +at)) slots.push(at);
      }
    }
    slots.sort((a, b) => a - b);
    if (slots.length) out.push({ date: new Date(Date.UTC(y, m, d, 6, 30)), slots });
  }
  return out;
}

export const fmtSlot = (date) => new Date(date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
export const fmtDay = (date) => new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

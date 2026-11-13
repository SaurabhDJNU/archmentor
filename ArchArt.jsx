// Original monochrome line drawings (drawn for this site — no third-party imagery).
// Lines draw in once; with "reduce motion" they simply appear.
const ART = {
  // building section: ground, floors, stair, roof with skylight, sun angle
  section: (
    <>
      <path d="M10 250 H390" />
      <path d="M60 250 V90 H300 V250" />
      <path d="M60 170 H300 M60 130 H220" />
      <path d="M220 90 V250" />
      <path d="M232 250 l12 -10 h12 l12 -10 h12 l12 -10 h12 l12 -10" />
      <path d="M40 90 L180 30 L320 90" />
      <path d="M150 43 L170 34 L178 50" />
      <path d="M340 40 L250 120" strokeDasharray="4 6" />
      <circle cx="350" cy="32" r="10" />
      <path d="M90 250 v-30 h30 v30 M140 210 h50 M140 150 h40" />
    </>
  ),
  // plan: walls, doors with swing arcs, a court
  plan: (
    <>
      <rect x="40" y="40" width="320" height="200" />
      <path d="M40 140 H170 M230 140 H360 M200 40 V110 M200 170 V240" />
      <rect x="160" y="110" width="80" height="60" strokeDasharray="3 5" />
      <path d="M170 140 A30 30 0 0 1 200 110" />
      <path d="M90 240 v-28 M90 212 A28 28 0 0 1 118 240" />
      <path d="M300 40 v28 M300 68 A28 28 0 0 0 272 40" />
      <path d="M60 60 h40 v20 h-40 z M280 190 h50 v30 h-50 z" />
      <path d="M20 260 h60 M20 255 v10 M50 257 v6 M80 255 v10" />
    </>
  ),
  // axonometric block with grid
  axon: (
    <>
      <path d="M200 40 L340 110 L200 180 L60 110 Z" />
      <path d="M60 110 V200 L200 270 L340 200 V110" />
      <path d="M200 180 V270" />
      <path d="M95 128 V218 M130 145 V235 M165 163 V253 M235 163 V253 M270 145 V235 M305 128 V218" />
      <path d="M130 75 L270 145 M270 75 L130 145" strokeDasharray="2 6" />
      <path d="M200 40 V10 M190 18 L200 8 L210 18" />
    </>
  ),
};

export default function ArchArt({ kind = 'section', className = '', label }) {
  return (
    <svg className={`arch-art ${className}`} viewBox="0 0 400 280" role={label ? 'img' : 'presentation'} aria-label={label} aria-hidden={label ? undefined : true}
      fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      {ART[kind] || ART.section}
    </svg>
  );
}

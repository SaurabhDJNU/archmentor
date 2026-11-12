const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, 'aria-hidden': true };

export const YouTube = () => (<svg {...base}><rect x="2.5" y="5.5" width="19" height="13" rx="3.5" /><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor" stroke="none" /></svg>);
export const Instagram = () => (<svg {...base}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" /></svg>);
export const WhatsApp = () => (<svg {...base}><path d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.3 18.4z" /><path d="M9.2 8.6c.3 2.6 2.4 4.8 5.2 5.4l1-1.2-1.6-.9-.8.8c-1-.4-1.9-1.3-2.4-2.4l.8-.8-.8-1.6z" fill="currentColor" stroke="none" /></svg>);
export const LinkedIn = () => (<svg {...base}><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" /><path d="M8 10.5V16M8 7.8v.1M11.5 16v-5.5M11.5 13c0-1.6 1-2.6 2.3-2.6s2.2.9 2.2 2.6V16" /></svg>);
export const Search = () => (<svg {...base}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>);
export const Share = () => (<svg {...base} width="18" height="18"><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" /></svg>);
export const Close = () => (<svg {...base} width="16" height="16" strokeWidth="1.6"><path d="M5 5l14 14M19 5L5 19" /></svg>);
export const Play = ({ size = 26 }) => (<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>);
export const Menu = () => (<svg {...base}><path d="M4 7h16M4 12h16M4 17h16" /></svg>);

export function Axonometric() {
  return (
    <svg viewBox="0 0 640 280" role="img" aria-label="Line drawing of a building in axonometric view, with dashed paths leading away to: practice, urban design, research, conservation, teaching">
      <g fill="none" stroke="#111" strokeWidth="1" strokeLinejoin="round">
        <path d="M210 210 L290 254 L370 210 L290 166 Z" />
        <path d="M210 210 V122 L290 78 L370 122 V210" />
        <path d="M290 166 V78" />
        <path d="M210 122 L290 166 L370 122" />
        <path d="M236 136 V194 M262 151 V209 M318 151 V209 M344 136 V194" stroke="#9a9a9a" />
      </g>
      <g fill="none" stroke="#9a9a9a" strokeWidth="0.8" strokeDasharray="3 4">
        <path d="M370 166 C430 166 440 96 500 96" />
        <path d="M370 188 C440 188 450 156 510 156" />
        <path d="M370 206 C440 220 460 220 510 220" />
        <path d="M290 254 C290 272 350 272 400 272" />
        <path d="M210 180 C160 180 150 136 120 136" />
      </g>
      <g fontFamily="Hanken Grotesk, Helvetica, Arial, sans-serif" fontSize="11" fill="#3a3a3a">
        <text x="506" y="100">Practice</text>
        <text x="516" y="160">Urban design</text>
        <text x="516" y="224">Research</text>
        <text x="406" y="276">Conservation</text>
        <text x="62" y="140">Teaching</text>
      </g>
    </svg>
  );
}

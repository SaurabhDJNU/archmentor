// Money helpers. All amounts are integer paise (₹1 = 100 paise); percentages are basis points (1% = 100 bps).
// calcCommission mirrors private.calc_commission in schema.sql exactly — the database is the source of truth,
// this copy is only for previews in the browser and for the unit tests.

export const rupees = (paise) => {
  const n = Number(paise || 0) / 100;
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
};
export const toPaise = (rupeeText) => {
  const s = String(rupeeText ?? '').replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return NaN;
  const [r, p = ''] = s.split('.');
  return Number(r) * 100 + Number((p + '00').slice(0, 2));
};
export const bpsToPct = (bps) => `${(Number(bps || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
export const pctToBps = (pct) => Math.round(Number(pct) * 100);

// Postgres round() on numeric rounds half away from zero
const round = (x) => (x < 0 ? -Math.round(-x) : Math.round(x));

export const DEFAULT_FINANCE = { default_commission_bps: 2000, gateway_fee_bps: 200, gst_bps: 1800 };

export function pickRule(rules, { serviceType, mentorId, at = new Date() }) {
  const t = +new Date(at);
  return (rules || [])
    .filter((r) => +new Date(r.effective_from) <= t && (!r.effective_to || +new Date(r.effective_to) > t))
    .filter((r) => (!r.mentor_id || r.mentor_id === mentorId) && (!r.service_type || r.service_type === serviceType))
    .sort((a, b) => (!!b.mentor_id - !!a.mentor_id) || (!!b.service_type - !!a.service_type) || (+new Date(b.effective_from) - +new Date(a.effective_from)))[0] || null;
}

export function calcCommission(pricePaise, rule, settings = DEFAULT_FINANCE) {
  const price = Math.max(0, Math.trunc(Number(pricePaise) || 0));
  const s = { ...DEFAULT_FINANCE, ...settings };
  const bps = rule?.percentage_bps ?? s.default_commission_bps;
  const fixed = rule?.fixed_fee_paise ?? 0;
  const mn = rule?.min_fee_paise ?? 0;
  const mx = rule?.max_fee_paise ?? null;
  const bearer = rule?.gateway_fee_bearer ?? 'platform';
  const incl = rule?.fee_included ?? true;
  let fee = round((price * bps) / 10000) + fixed;
  fee = Math.max(fee, mn);
  if (mx !== null && mx !== undefined && mx !== '') fee = Math.min(fee, Number(mx));
  if (incl) fee = Math.min(fee, price);
  if (price === 0) fee = 0;
  const base = price + (incl ? 0 : fee);
  let gw = round(((base * s.gateway_fee_bps) / 10000) * (1 + s.gst_bps / 10000));
  if (price === 0) gw = 0;
  const total = base + (bearer === 'student' ? gw : 0);
  const net = Math.max((incl ? price - fee : price) - (bearer === 'mentor' ? gw : 0), 0);
  return {
    price_paise: price, percentage_bps: bps, platform_fee_paise: fee, gateway_est_paise: gw,
    customer_total_paise: total, mentor_net_paise: net, platform_net_paise: total - net - gw,
    gateway_fee_bearer: bearer, fee_included: incl,
  };
}

import { describe, expect, it } from 'vitest';
import { calcCommission, pickRule, rupees, toPaise } from './money.js';

const S = { default_commission_bps: 2000, gateway_fee_bps: 200, gst_bps: 1800 };

describe('calcCommission (mirrors private.calc_commission)', () => {
  it('default 20% inside the price, platform pays gateway', () => {
    const c = calcCommission(100000, null, S);
    expect(c).toMatchObject({ platform_fee_paise: 20000, gateway_est_paise: 2360, customer_total_paise: 100000, mentor_net_paise: 80000, platform_net_paise: 17640 });
  });
  it('fee added on top, student pays gateway', () => {
    const c = calcCommission(100000, { percentage_bps: 1000, fee_included: false, gateway_fee_bearer: 'student' }, S);
    expect(c.platform_fee_paise).toBe(10000);
    expect(c.gateway_est_paise).toBe(2596);              // 110000 × 2% × 1.18
    expect(c.customer_total_paise).toBe(112596);
    expect(c.mentor_net_paise).toBe(100000);
  });
  it('mentor pays gateway', () => {
    const c = calcCommission(50000, { percentage_bps: 1500, gateway_fee_bearer: 'mentor' }, S);
    expect(c.mentor_net_paise).toBe(50000 - 7500 - 1180);
  });
  it('min, max and fixed fee', () => {
    expect(calcCommission(10000, { percentage_bps: 1000, min_fee_paise: 5000 }, S).platform_fee_paise).toBe(5000);
    expect(calcCommission(1000000, { percentage_bps: 2000, max_fee_paise: 50000 }, S).platform_fee_paise).toBe(50000);
    expect(calcCommission(10000, { percentage_bps: 1000, fixed_fee_paise: 500 }, S).platform_fee_paise).toBe(1500);
  });
  it('fee never exceeds the price when included, never negative', () => {
    const c = calcCommission(1000, { percentage_bps: 5000, min_fee_paise: 5000 }, S);
    expect(c.platform_fee_paise).toBe(1000);
    expect(c.mentor_net_paise).toBe(0);
  });
  it('free is free', () => {
    expect(calcCommission(0, null, S)).toMatchObject({ platform_fee_paise: 0, gateway_est_paise: 0, customer_total_paise: 0, mentor_net_paise: 0 });
  });
  it('works only in whole paise', () => {
    const c = calcCommission(99999, { percentage_bps: 1234 }, S);
    Object.entries(c).filter(([k]) => k.endsWith('_paise')).forEach(([, v]) => expect(Number.isInteger(v)).toBe(true));
  });
});

describe('pickRule', () => {
  const t0 = '2026-01-01T00:00:00Z';
  const rules = [
    { id: 'all', percentage_bps: 2000, effective_from: t0 },
    { id: 'type', service_type: 'portfolio_review', percentage_bps: 3000, effective_from: t0 },
    { id: 'mentor', mentor_id: 'm1', percentage_bps: 1000, effective_from: t0 },
    { id: 'ended', mentor_id: 'm2', percentage_bps: 500, effective_from: t0, effective_to: '2026-02-01T00:00:00Z' },
    { id: 'future', percentage_bps: 9000, effective_from: '2099-01-01T00:00:00Z' },
  ];
  const at = '2026-06-01T00:00:00Z';
  it('most specific wins', () => {
    expect(pickRule(rules, { serviceType: 'consultation', mentorId: 'm1', at }).id).toBe('mentor');
    expect(pickRule(rules, { serviceType: 'portfolio_review', mentorId: 'm9', at }).id).toBe('type');
    expect(pickRule(rules, { serviceType: 'consultation', mentorId: 'm9', at }).id).toBe('all');
  });
  it('ignores ended and future rules', () => {
    expect(pickRule(rules, { serviceType: 'consultation', mentorId: 'm2', at }).id).toBe('all');
  });
});

describe('formatting', () => {
  it('rupees', () => { expect(rupees(149900)).toBe('₹1,499'); expect(rupees(12345)).toBe('₹123.45'); });
  it('toPaise parses safely', () => {
    expect(toPaise('1,499.5')).toBe(149950);
    expect(toPaise('₹10')).toBe(1000);
    expect(Number.isNaN(toPaise('1.234'))).toBe(true);
    expect(Number.isNaN(toPaise('-5'))).toBe(true);
  });
});

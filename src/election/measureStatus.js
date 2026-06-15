import { STATUS, statusFor } from "./gauge.jsx";

export function parseAmount(str) {
  const m = /\$([\d.]+)\s*([BMK])?/.exec(str || "");
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const mult = { B: 1e9, M: 1e6, K: 1e3 }[m[2]] || 1;
  if (/parcel|sq ft/i.test(str)) return 0;
  return n * mult;
}

export function measureStatus(m, band) {
  if (m.phase === "closed") {
    return { sKey: m.result.passed ? "pass" : "fail", label: m.result.passed ? "Passed" : "Failed", override: m.result.passed ? "pass" : "fail" };
  }
  const sKey = statusFor(m.yesPct, m.threshold.value, band);
  return { sKey, label: STATUS[sKey].label, override: null };
}

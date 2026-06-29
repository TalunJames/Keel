/** TargetSmart / RNC individual voter export column mapping. */

export const VENDOR = "targetsmart";

const PARTY_MAP = {
  D: "D",
  R: "R",
  U: "I",
  T: "I",
  Q: "I",
  C: "I",
  O: "I",
  G: "I",
};

export function normalizeParty(officialParty) {
  const code = String(officialParty || "").trim().toUpperCase();
  return PARTY_MAP[code] || "I";
}

export function titleCaseCounty(name) {
  const s = String(name || "").trim();
  if (!s) return "";
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function turnoutScore(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n <= 1 ? n * 100 : n);
}

export function formatAddressLine(addr1, addr2) {
  return [addr1, addr2].map((s) => String(s || "").trim()).filter(Boolean).join(" ");
}

export function addressKey(addr1, addr2, city, zip) {
  return [addr1, addr2, city, zip]
    .map((s) => String(s || "").trim().toUpperCase())
    .filter(Boolean)
    .join("|");
}

/** Map a parsed CSV row object to the warehouse record shape. */
export function mapTargetSmartRow(row) {
  const id = String(row.rnc_reg_id || row.state_voter_id || "").trim();
  const stateVoterId = String(row.state_voter_id || "").trim();
  const addr1 = String(row.registration_address_1 || "").trim();
  const addr2 = String(row.registration_address_2 || "").trim();
  const city = String(row.registration_address_city || "").trim();
  const state = String(row.registration_address_state || "CO").trim();
  const zip = String(row.registration_address_zip_5 || "").trim();
  return {
    id,
    state_voter_id: stateVoterId,
    first_name: String(row.first_name || "").trim(),
    last_name: String(row.last_name || "").trim(),
    party: normalizeParty(row.official_party),
    raw_party: String(row.official_party || "").trim().toUpperCase(),
    county: titleCaseCounty(row.county_name),
    score: turnoutScore(row.turnout_general_score),
    precinct: String(row.precinct_name || "").trim(),
    zip,
    voter_status: String(row.voter_status || "").trim().toUpperCase(),
    age_range: String(row.age_range || "").trim(),
    household_id: String(row.household_id || "").trim(),
    address_line: formatAddressLine(addr1, addr2),
    address_city: city,
    address_state: state,
    address_key: addressKey(addr1, addr2, city, zip),
  };
}

export function detectVendor(headers) {
  const set = new Set(headers.map((h) => h.toLowerCase()));
  if (set.has("rnc_reg_id") && set.has("turnout_general_score")) return VENDOR;
  return null;
}

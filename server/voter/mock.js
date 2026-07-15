import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import * as turf from "@turf/turf";
import {
  initWarehouseSchema,
  warehousePath,
  clientDir,
  manifestPath,
  DEFAULT_MAP_CONFIG,
} from "./warehouse.js";

// Deterministic-enough mock voter warehouse generator. Places synthetic voters
// inside REAL El Paso County / Colorado Springs precinct polygons so precinct,
// state senate (SENATE), state house (REP) and commissioner (COM_DIST) values
// are internally consistent and the map renders correctly. Every field is
// fabricated — no real voter data.

const FIRST_NAMES_M = ["James","John","Robert","Michael","David","William","Richard","Joseph","Thomas","Charles","Daniel","Matthew","Anthony","Mark","Donald","Steven","Andrew","Joshua","Kenneth","Kevin","Brian","Jose","Carlos","Miguel","Luis","Ethan","Mason","Logan","Jacob","Ryan"];
const FIRST_NAMES_F = ["Mary","Patricia","Jennifer","Linda","Elizabeth","Barbara","Susan","Jessica","Sarah","Karen","Nancy","Lisa","Margaret","Betty","Sandra","Ashley","Emily","Donna","Michelle","Carol","Amanda","Maria","Sofia","Isabella","Olivia","Emma","Ava","Mia","Grace","Hannah"];
const LAST_NAMES = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts"];
const STREET_NAMES = ["Cascade","Nevada","Tejon","Wahsatch","Weber","Corona","Union","Academy","Chelton","Circle","Fillmore","Uintah","Platte","Pikes Peak","Bijou","Boulder","Wood","Cheyenne","Institute","Nichols","Fontanero","Rio Grande","Vermijo","Kiowa","Willamette","Columbia","Cimarron","Constitution","Palmer Park","Austin Bluffs","Barnes","Dublin","Woodmen","Briargate","Research","Stetson Hills","Powers","Marksheffel","Galley","Airport"];
const STREET_TYPES = ["St","Ave","Blvd","Dr","Rd","Ln","Pl","Way","Ct","Cir"];
const CITIES = [
  { name: "Colorado Springs", weight: 82, zips: ["80903","80904","80905","80906","80907","80909","80910","80915","80916","80917","80918","80919","80920","80922","80923","80924"] },
  { name: "Fountain", weight: 8, zips: ["80817"] },
  { name: "Manitou Springs", weight: 4, zips: ["80829"] },
  { name: "Falcon", weight: 3, zips: ["80831"] },
  { name: "Monument", weight: 3, zips: ["80132"] },
];
const ETHNICITIES = [["White", 68], ["Hispanic", 17], ["Black", 6], ["Asian", 4], ["Native American", 2], ["Other", 3]];
const LANGUAGES = [["English", 90], ["Spanish", 7], ["Vietnamese", 1], ["Korean", 1], ["Other", 1]];
const PARTY_WEIGHTS = [["R", 42], ["D", 30], ["I", 28]];
const RAW_PARTY = { R: "REP", D: "DEM", I: "UAF" };

// Election calendar the vote history is drawn from (most recent first by date).
const ELECTIONS = [
  { key: "2024-gen", name: "2024 General", date: "2024-11-05", type: "general", year: 2024 },
  { key: "2024-pri", name: "2024 Primary", date: "2024-06-25", type: "primary", year: 2024 },
  { key: "2023-mun", name: "2023 Municipal", date: "2023-04-04", type: "municipal", year: 2023 },
  { key: "2022-gen", name: "2022 General", date: "2022-11-08", type: "general", year: 2022 },
  { key: "2022-pri", name: "2022 Primary", date: "2022-06-28", type: "primary", year: 2022 },
  { key: "2020-gen", name: "2020 General", date: "2020-11-03", type: "general", year: 2020 },
  { key: "2020-pri", name: "2020 Primary", date: "2020-06-30", type: "primary", year: 2020 },
  { key: "2019-mun", name: "2019 Municipal", date: "2019-04-02", type: "municipal", year: 2019 },
  { key: "2018-gen", name: "2018 General", date: "2018-11-06", type: "general", year: 2018 },
  { key: "2018-pri", name: "2018 Primary", date: "2018-06-26", type: "primary", year: 2018 },
  { key: "2016-gen", name: "2016 General", date: "2016-11-08", type: "general", year: 2016 },
];

function pickWeighted(pairs) {
  const total = pairs.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [val, w] of pairs) {
    r -= w;
    if (r <= 0) return val;
  }
  return pairs[0][0];
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function chance(p) { return Math.random() < p; }

// Random point inside a polygon feature via rejection sampling within its bbox.
function randomPointInPolygon(feature, bbox) {
  const [minX, minY, maxX, maxY] = bbox;
  for (let i = 0; i < 30; i++) {
    const lng = minX + Math.random() * (maxX - minX);
    const lat = minY + Math.random() * (maxY - minY);
    if (turf.booleanPointInPolygon([lng, lat], feature)) return [lng, lat];
  }
  // Fallback: jitter around the centroid.
  const c = turf.centroid(feature).geometry.coordinates;
  return [c[0] + (Math.random() - 0.5) * 0.002, c[1] + (Math.random() - 0.5) * 0.002];
}

function isoDateBetween(startYear, endYear) {
  const y = randInt(startYear, endYear);
  const m = randInt(1, 12);
  const d = randInt(1, 28);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function loadPrecincts() {
  const p = path.join(process.cwd(), "public", "election-data", "Precincts.geojson");
  if (!fs.existsSync(p)) return null;
  const gj = JSON.parse(fs.readFileSync(p, "utf8"));
  return (gj.features || [])
    .filter((f) => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"))
    .map((f) => ({
      feature: f,
      bbox: turf.bbox(f),
      precinct: String(f.properties.PRECINCT ?? "").trim(),
      senate: f.properties.SENATE != null ? `SD ${f.properties.SENATE}` : "",
      house: f.properties.REP != null ? `HD ${f.properties.REP}` : "",
      commissioner: f.properties.COM_DIST != null ? `Comm ${f.properties.COM_DIST}` : "",
      area: f.properties.Shape__Area || 1,
    }))
    .filter((p) => p.precinct);
}

export async function generateMockWarehouse({ clientId, count = 25000, onProgress = null } = {}) {
  if (!clientId) throw new Error("clientId is required");
  const precincts = loadPrecincts();
  if (!precincts || !precincts.length) {
    throw new Error("Could not load public/election-data/Precincts.geojson to place mock voters.");
  }

  const dir = clientDir(clientId);
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = warehousePath(clientId);
  const tmpPath = `${dbPath}.tmp`;
  for (const p of [tmpPath, `${tmpPath}-wal`, `${tmpPath}-shm`]) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  const db = new Database(tmpPath);
  db.pragma("journal_mode = WAL");
  initWarehouseSchema(db);

  const insElection = db.prepare("INSERT INTO elections (key,name,date,type,year,ord) VALUES (?,?,?,?,?,?)");
  ELECTIONS.forEach((e, i) => insElection.run(e.key, e.name, e.date, e.type, e.year, i));

  const insVoter = db.prepare(`
    INSERT INTO voters (
      id, state_voter_id, first_name, middle_name, last_name, suffix, party, raw_party,
      gender, age, birth_year, county, score, support_score, partisan_score, precinct,
      congressional, state_senate, state_house, commissioner, school_district, zip,
      voter_status, registration_date, age_range, ethnicity, language, phone, cell_phone, email,
      general_votes, primary_votes, total_votes, last_voted, household_id, household_size,
      address_line, address_city, address_state, address_key, lat, lng
    ) VALUES (
      @id,@state_voter_id,@first_name,@middle_name,@last_name,@suffix,@party,@raw_party,
      @gender,@age,@birth_year,@county,@score,@support_score,@partisan_score,@precinct,
      @congressional,@state_senate,@state_house,@commissioner,@school_district,@zip,
      @voter_status,@registration_date,@age_range,@ethnicity,@language,@phone,@cell_phone,@email,
      @general_votes,@primary_votes,@total_votes,@last_voted,@household_id,@household_size,
      @address_line,@address_city,@address_state,@address_key,@lat,@lng
    )
  `);
  const insHistory = db.prepare("INSERT INTO vote_history (voter_id, election_key, method) VALUES (?,?,?)");

  const totalArea = precincts.reduce((a, p) => a + p.area, 0);
  const nowYear = 2026;
  const counties = new Set(["El Paso"]);
  const precinctSet = new Set();
  const partyMix = { D: 0, R: 0, I: 0 };
  let produced = 0;
  let seq = 100000;

  const genGeneralKeys = ELECTIONS.filter((e) => e.type === "general").map((e) => e.key);
  const genPrimaryKeys = ELECTIONS.filter((e) => e.type === "primary").map((e) => e.key);
  const genMuniKeys = ELECTIONS.filter((e) => e.type === "municipal").map((e) => e.key);

  const build = db.transaction(() => {
    for (const pr of precincts) {
      if (produced >= count) break;
      const share = pr.area / totalArea;
      const target = Math.max(6, Math.round(count * share));
      let placed = 0;
      precinctSet.add(pr.precinct);

      while (placed < target && produced < count) {
        // One household at a shared address, 1–3 registered adults.
        const [lng, lat] = randomPointInPolygon(pr.feature, pr.bbox);
        const cityInfo = pickWeighted(CITIES.map((c) => [c, c.weight]));
        const city = cityInfo.name;
        const zip = pick(cityInfo.zips);
        const streetNum = randInt(100, 8999);
        const street = `${streetNum} ${pick(STREET_NAMES)} ${pick(STREET_TYPES)}`;
        const addrKey = `${street}|${city}|${zip}`.toUpperCase();
        const householdId = `H${seq}`;
        const lastName = pick(LAST_NAMES);
        const hhSize = pickWeighted([[1, 30], [2, 45], [3, 18], [4, 7]]);

        for (let m = 0; m < hhSize && produced < count; m++) {
          const gender = pickWeighted([["F", 51], ["M", 48], ["U", 1]]);
          const first = gender === "M" ? pick(FIRST_NAMES_M) : gender === "F" ? pick(FIRST_NAMES_F) : pick([...FIRST_NAMES_M, ...FIRST_NAMES_F]);
          const age = pickWeighted([[randInt(18, 24), 8], [randInt(25, 34), 16], [randInt(35, 44), 16], [randInt(45, 54), 17], [randInt(55, 64), 18], [randInt(65, 74), 15], [randInt(75, 92), 10]]);
          const birthYear = nowYear - age;
          const party = pickWeighted(PARTY_WEIGHTS);
          const ethnicity = pickWeighted(ETHNICITIES);
          const language = ethnicity === "Hispanic" ? pickWeighted([["English", 60], ["Spanish", 40]]) : pickWeighted(LANGUAGES);

          // Turnout propensity rises with age; support score leans by party.
          const ageBoost = Math.min(35, Math.max(0, (age - 25) * 0.9));
          const score = Math.max(0, Math.min(100, Math.round(30 + ageBoost + (Math.random() * 40 - 15))));
          const supportBase = party === "D" ? 62 : party === "R" ? 34 : 48;
          const support = Math.max(0, Math.min(100, Math.round(supportBase + (Math.random() * 40 - 20))));
          const partisan = party === "D" ? Math.round(60 + Math.random() * 35) : party === "R" ? Math.round(5 + Math.random() * 35) : Math.round(30 + Math.random() * 40);
          const status = chance(0.9) ? "A" : "I";

          seq += 1;
          const id = `V${seq}`;
          const stateVoterId = `CO${String(seq).padStart(9, "0")}`;

          // Vote history: probability tied to turnout score.
          const p = score / 100;
          const votedGenerals = genGeneralKeys.filter(() => chance(p * 0.95));
          const votedPrimaries = genPrimaryKeys.filter(() => chance(p * 0.55));
          const votedMuni = genMuniKeys.filter(() => chance(p * 0.35));
          const allVoted = [...votedGenerals, ...votedPrimaries, ...votedMuni];
          // Registration cannot postdate first vote; keep it 1998..(age→18yr).
          const earliestReg = Math.max(1998, birthYear + 18);
          const regDate = isoDateBetween(Math.min(earliestReg, nowYear - 1), nowYear - 1);
          const lastVoted = ELECTIONS.find((e) => allVoted.includes(e.key))?.key || "";

          partyMix[party] = (partyMix[party] || 0) + 1;

          insVoter.run({
            id,
            state_voter_id: stateVoterId,
            first_name: first,
            middle_name: chance(0.4) ? pick(FIRST_NAMES_M.concat(FIRST_NAMES_F))[0] : "",
            last_name: lastName,
            suffix: chance(0.03) ? pick(["Jr", "Sr", "III"]) : "",
            party,
            raw_party: RAW_PARTY[party],
            gender,
            age,
            birth_year: birthYear,
            county: "El Paso",
            score,
            support_score: support,
            partisan_score: partisan,
            precinct: pr.precinct,
            congressional: "CO-05",
            state_senate: pr.senate,
            state_house: pr.house,
            commissioner: pr.commissioner,
            school_district: "D-11",
            zip,
            voter_status: status,
            registration_date: regDate,
            age_range: age < 35 ? "18-34" : age < 50 ? "35-49" : age < 65 ? "50-64" : "65+",
            ethnicity,
            language,
            phone: chance(0.45) ? `719-${randInt(200, 899)}-${randInt(1000, 9999)}` : "",
            cell_phone: chance(0.68) ? `719-${randInt(200, 899)}-${randInt(1000, 9999)}` : "",
            email: chance(0.55) ? `${first.toLowerCase()}.${lastName.toLowerCase()}${randInt(1, 99)}@example.com` : "",
            general_votes: votedGenerals.length,
            primary_votes: votedPrimaries.length,
            total_votes: allVoted.length,
            last_voted: lastVoted,
            household_id: householdId,
            household_size: hhSize,
            address_line: street,
            address_city: city,
            address_state: "CO",
            address_key: addrKey,
            lat,
            lng,
          });
          for (const ek of allVoted) {
            insHistory.run(id, ek, pickWeighted([["mail", 70], ["inperson", 22], ["early", 8]]));
          }
          produced += 1;
          placed += 1;
        }
        seq += 1; // advance household counter
      }
      if (onProgress) onProgress(produced);
    }
  });

  build();

  const uniqueAddresses = db.prepare("SELECT COUNT(DISTINCT address_key) AS n FROM voters").get().n;
  db.close();

  for (const p of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  fs.renameSync(tmpPath, dbPath);

  const manifest = {
    clientId,
    vendor: "mock",
    source: "Synthetic demo file (mock)",
    sourceFile: "mock",
    stagedAs: "generated",
    recordCount: produced,
    counties: [...counties].sort(),
    precincts: [...precinctSet].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)),
    ageRanges: ["18-34", "35-49", "50-64", "65+"],
    partyMix,
    uniqueAddresses,
    geocodedCount: produced,
    ingestedAt: new Date().toISOString(),
    geocodedAt: new Date().toISOString(),
    columns: [],
    map: { ...DEFAULT_MAP_CONFIG },
  };
  fs.writeFileSync(manifestPath(clientId), JSON.stringify(manifest, null, 2));
  return manifest;
}

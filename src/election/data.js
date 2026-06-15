/* ============================================================================
 *  ███  SIMULATED DATA — NONE OF THIS IS REAL  ███
 * ----------------------------------------------------------------------------
 *  Every value in this file is invented placeholder data for design purposes.
 *  When wiring real data sources, REPLACE THIS FILE. Conventions to make that
 *  easy:
 *    • Everything hangs off the single global  window.ET  (see bottom).
 *    • Every top-level record carries  __mock: true  — grep for it to find
 *      every simulated entity in the app.
 *    • The UI reads a flag  ET.IS_MOCK  and shows a persistent "Simulated data"
 *      marker in the sidebar + an amber hairline on mock-derived numbers.
 *    • Live Election-Night figures are generated/animated at runtime in
 *      app.jsx from the  liveSeed  fields below — those are the most obviously
 *      fake numbers and are labelled "provisional / simulated" in the UI.
 *
 *  Domain: revenue ballot measures (GO bonds, sales taxes, parcel taxes).
 *  "Election Night" is pinned to the current build date: June 2, 2026.
 * ========================================================================== */

const TODAY = "2026-06-02"; // election night for this simulated cycle

  // Threshold presets — revenue measures are NOT always 50%+1.
  const TH = {
    majority: { value: 50, label: "Simple majority", short: "50%+1" },
    p55: { value: 55, label: "55% supermajority", short: "55%" },
    twothirds: { value: 66.67, label: "Two-thirds", short: "66.7%" },
  };

  // Firm consultants (simulated staff)
  const STAFF = ["D. Whitfield", "M. Cardoza", "L. Okafor", "R. Tan", "J. Mercer"];

  // helper to build polling waves trending toward a landing number
  function waves(spec) {
    // spec: array of [label, dateISO, support, oppose]
    return spec.map(([wave, date, support, oppose]) => ({
      wave, date, support, oppose, undecided: Math.max(0, 100 - support - oppose),
    }));
  }

  /* -------------------------------------------------------------------------
   *  MEASURES  — the portfolio
   *  phase: "active" (on tonight's ballot) | "upcoming" | "closed"
   *  liveSeed: present only for active measures; drives the night-of sim.
   * ----------------------------------------------------------------------- */
  const measures = [
    {
      __mock: true,
      id: "riverside-a",
      code: "Measure A",
      title: "Riverside Unified School Facilities Bond",
      client: "Riverside Unified School District",
      type: "GO Bond",
      category: "Schools",
      jurisdiction: "Riverside, CA",
      state: "CA",
      amount: "$1.2B bond",
      threshold: TH.p55,
      consultant: "D. Whitfield",
      cycle: "June 2026",
      electionDate: TODAY,
      phase: "active",
      yesPct: 58.4,
      liveSeed: { reporting: 41, yesPctStart: 57.1, yesPctEnd: 59.2, totalBallotsEst: 132000, mailShare: 0.62, edayShare: 0.30, lateMailShare: 0.08 },
      polls: waves([
        ["Wave 1 · baseline", "2026-02-18", 54, 31],
        ["Wave 2", "2026-03-24", 56, 30],
        ["Wave 3 · tracking", "2026-05-05", 57, 29],
        ["Wave 4 · final", "2026-05-26", 59, 28],
      ]),
      deliverables: [
        { __mock: true, item: "Voter ID survey (Wave 4)", status: "delivered", owner: "L. Okafor", due: "2026-05-26" },
        { __mock: true, item: "Mail piece #3 — seniors", status: "approved", owner: "M. Cardoza", due: "2026-05-12" },
        { __mock: true, item: "GOTV digital flight", status: "delivered", owner: "R. Tan", due: "2026-05-28" },
        { __mock: true, item: "Election-night reporting kit", status: "in-proofing", owner: "D. Whitfield", due: "2026-06-01" },
      ],
      deadlines: [
        { __mock: true, type: "Resolution", date: "2026-02-05", source: "auto", done: true },
        { __mock: true, type: "Ballot argument", date: "2026-03-13", source: "auto", done: true },
        { __mock: true, type: "Rebuttal", date: "2026-03-20", source: "auto", done: true },
        { __mock: true, type: "Finance report (pre-election)", date: "2026-05-21", source: "auto", done: true },
        { __mock: true, type: "Semi-annual finance report", date: "2026-07-31", source: "manual", done: false },
      ],
      notes: {
        general: "Strong senior support after Wave 2 messaging shift to facilities safety. Opposition is a small fixed-income taxpayer group; limited paid presence.",
        lessons: "55% bonds in this district hold when the ask is framed as repair-not-expansion. Keep the dollar figure paired with a per-household cost in all mail.",
      },
    },
    {
      __mock: true,
      id: "tacoma-1",
      code: "Proposition 1",
      title: "Tacoma Streets & Transit Initiative",
      client: "City of Tacoma",
      type: "Sales Tax",
      category: "Transportation",
      jurisdiction: "Tacoma, WA",
      state: "WA",
      amount: "0.3% sales tax",
      threshold: TH.majority,
      consultant: "M. Cardoza",
      cycle: "June 2026",
      electionDate: TODAY,
      phase: "active",
      yesPct: 50.8,
      liveSeed: { reporting: 33, yesPctStart: 52.4, yesPctEnd: 49.7, totalBallotsEst: 88000, mailShare: 0.78, edayShare: 0.05, lateMailShare: 0.17 },
      polls: waves([
        ["Wave 1 · baseline", "2026-02-25", 49, 38],
        ["Wave 2", "2026-04-02", 51, 37],
        ["Wave 3 · final", "2026-05-20", 50, 39],
      ]),
      deliverables: [
        { __mock: true, item: "Baseline survey", status: "delivered", owner: "L. Okafor", due: "2026-02-25" },
        { __mock: true, item: "Endorsement one-pager", status: "approved", owner: "J. Mercer", due: "2026-04-10" },
        { __mock: true, item: "Late-mail chase plan", status: "draft", owner: "M. Cardoza", due: "2026-06-03" },
      ],
      deadlines: [
        { __mock: true, type: "Resolution", date: "2026-02-10", source: "auto", done: true },
        { __mock: true, type: "Ballot argument", date: "2026-03-18", source: "auto", done: true },
        { __mock: true, type: "Finance report (C-4)", date: "2026-05-22", source: "auto", done: true },
      ],
      notes: {
        general: "WA is a near-all-mail state; late-mail drift historically favors Yes here by 1–2 pts. Do not call on election-night drop alone.",
        lessons: "",
      },
    },
    {
      __mock: true,
      id: "marin-c",
      code: "Measure C",
      title: "Marin Wildfire Prevention Parcel Tax",
      client: "Marin County Fire Safe Council",
      type: "Parcel Tax",
      category: "Fire / Emergency",
      jurisdiction: "Marin County, CA",
      state: "CA",
      amount: "$0.10 / sq ft",
      threshold: TH.twothirds,
      consultant: "R. Tan",
      cycle: "June 2026",
      electionDate: TODAY,
      phase: "active",
      yesPct: 65.1,
      liveSeed: { reporting: 52, yesPctStart: 64.2, yesPctEnd: 66.9, totalBallotsEst: 61000, mailShare: 0.7, edayShare: 0.12, lateMailShare: 0.18 },
      polls: waves([
        ["Wave 1 · baseline", "2026-03-04", 63, 24],
        ["Wave 2", "2026-04-15", 66, 23],
        ["Wave 3 · final", "2026-05-22", 67, 22],
      ]),
      deliverables: [
        { __mock: true, item: "Two-thirds path memo", status: "delivered", owner: "R. Tan", due: "2026-03-10" },
        { __mock: true, item: "Wildfire ad — broadcast cut", status: "approved", owner: "M. Cardoza", due: "2026-05-01" },
        { __mock: true, item: "Spanish-language mail", status: "delivered", owner: "L. Okafor", due: "2026-05-14" },
      ],
      deadlines: [
        { __mock: true, type: "Resolution", date: "2026-02-12", source: "auto", done: true },
        { __mock: true, type: "Ballot argument", date: "2026-03-18", source: "auto", done: true },
        { __mock: true, type: "Rebuttal", date: "2026-03-25", source: "auto", done: true },
      ],
      notes: {
        general: "Two-thirds threshold makes this the marquee watch tonight. Sitting just above the line in tracking; turnout composition decides it.",
        lessons: "",
      },
    },
    {
      __mock: true,
      id: "sanjose-g",
      code: "Measure G",
      title: "San José Schools Quality Parcel Tax",
      client: "San José Unified School District",
      type: "Parcel Tax",
      category: "Schools",
      jurisdiction: "San José, CA",
      state: "CA",
      amount: "$298 / parcel",
      threshold: TH.twothirds,
      consultant: "J. Mercer",
      cycle: "June 2026",
      electionDate: TODAY,
      phase: "active",
      yesPct: 61.9,
      liveSeed: { reporting: 47, yesPctStart: 62.8, yesPctEnd: 61.0, totalBallotsEst: 96000, mailShare: 0.66, edayShare: 0.2, lateMailShare: 0.14 },
      polls: waves([
        ["Wave 1 · baseline", "2026-02-28", 60, 30],
        ["Wave 2", "2026-04-08", 62, 31],
        ["Wave 3 · final", "2026-05-19", 61, 33],
      ]),
      deliverables: [
        { __mock: true, item: "Baseline survey", status: "delivered", owner: "L. Okafor", due: "2026-02-28" },
        { __mock: true, item: "Teacher testimonial video", status: "approved", owner: "R. Tan", due: "2026-04-30" },
        { __mock: true, item: "Renewal-vs-new messaging memo", status: "delivered", owner: "J. Mercer", due: "2026-03-15" },
      ],
      deadlines: [
        { __mock: true, type: "Resolution", date: "2026-02-09", source: "auto", done: true },
        { __mock: true, type: "Ballot argument", date: "2026-03-16", source: "auto", done: true },
      ],
      notes: {
        general: "Short of two-thirds in every wave. Path requires Election-Day surge that mail-heavy electorate is unlikely to deliver. Manage client expectations.",
        lessons: "",
      },
    },
    {
      __mock: true,
      id: "portland-26",
      code: "Measure 26-244",
      title: "Portland Safe Streets Bond",
      client: "City of Portland",
      type: "GO Bond",
      category: "Transportation",
      jurisdiction: "Portland, OR",
      state: "OR",
      amount: "$480M bond",
      threshold: TH.majority,
      consultant: "D. Whitfield",
      cycle: "June 2026",
      electionDate: TODAY,
      phase: "active",
      yesPct: 56.7,
      liveSeed: { reporting: 38, yesPctStart: 55.9, yesPctEnd: 57.4, totalBallotsEst: 154000, mailShare: 0.82, edayShare: 0.03, lateMailShare: 0.15 },
      polls: waves([
        ["Wave 1 · baseline", "2026-03-01", 53, 34],
        ["Wave 2", "2026-04-20", 55, 33],
        ["Wave 3 · final", "2026-05-23", 57, 32],
      ]),
      deliverables: [
        { __mock: true, item: "Baseline survey", status: "delivered", owner: "L. Okafor", due: "2026-03-01" },
        { __mock: true, item: "Coalition endorsement rollout", status: "delivered", owner: "J. Mercer", due: "2026-05-04" },
      ],
      deadlines: [
        { __mock: true, type: "Resolution", date: "2026-02-15", source: "auto", done: true },
        { __mock: true, type: "Voters' pamphlet statement", date: "2026-03-19", source: "auto", done: true },
      ],
      notes: { general: "Comfortable majority measure. All-mail state; expect Yes to firm as late ballots land.", lessons: "" },
    },
    {
      __mock: true,
      id: "sonoma-h",
      code: "Measure H",
      title: "Sonoma County Fire Services Sales Tax",
      client: "Sonoma County Fire District",
      type: "Sales Tax",
      category: "Fire / Emergency",
      jurisdiction: "Sonoma County, CA",
      state: "CA",
      amount: "0.5% sales tax",
      threshold: TH.twothirds,
      consultant: "R. Tan",
      cycle: "June 2026",
      electionDate: TODAY,
      phase: "active",
      yesPct: 67.4,
      liveSeed: { reporting: 29, yesPctStart: 68.9, yesPctEnd: 66.5, totalBallotsEst: 72000, mailShare: 0.64, edayShare: 0.18, lateMailShare: 0.18 },
      polls: waves([
        ["Wave 1 · baseline", "2026-03-06", 65, 26],
        ["Wave 2", "2026-04-22", 68, 24],
        ["Wave 3 · final", "2026-05-24", 67, 25],
      ]),
      deliverables: [
        { __mock: true, item: "Two-thirds feasibility memo", status: "delivered", owner: "R. Tan", due: "2026-03-12" },
        { __mock: true, item: "Direct mail series (3)", status: "delivered", owner: "M. Cardoza", due: "2026-05-16" },
      ],
      deadlines: [
        { __mock: true, type: "Resolution", date: "2026-02-18", source: "auto", done: true },
        { __mock: true, type: "Ballot argument", date: "2026-03-20", source: "auto", done: true },
      ],
      notes: { general: "Hovering right at two-thirds. Early Election-Day drop ran ahead; watch for reversion as mail lands.", lessons: "" },
    },
    {
      __mock: true,
      id: "longbeach-q",
      code: "Measure Q",
      title: "Long Beach Schools Repair Bond",
      client: "Long Beach Unified School District",
      type: "GO Bond",
      category: "Schools",
      jurisdiction: "Long Beach, CA",
      state: "CA",
      amount: "$1.7B bond",
      threshold: TH.p55,
      consultant: "M. Cardoza",
      cycle: "June 2026",
      electionDate: TODAY,
      phase: "active",
      yesPct: 63.2,
      liveSeed: { reporting: 44, yesPctStart: 62.5, yesPctEnd: 63.8, totalBallotsEst: 118000, mailShare: 0.6, edayShare: 0.27, lateMailShare: 0.13 },
      polls: waves([
        ["Wave 1 · baseline", "2026-02-22", 59, 27],
        ["Wave 2", "2026-04-05", 62, 26],
        ["Wave 3 · final", "2026-05-21", 63, 25],
      ]),
      deliverables: [
        { __mock: true, item: "Baseline survey", status: "delivered", owner: "L. Okafor", due: "2026-02-22" },
        { __mock: true, item: "Facilities tour b-roll", status: "approved", owner: "R. Tan", due: "2026-04-18" },
      ],
      deadlines: [
        { __mock: true, type: "Resolution", date: "2026-02-06", source: "auto", done: true },
        { __mock: true, type: "Ballot argument", date: "2026-03-14", source: "auto", done: true },
      ],
      notes: { general: "Comfortably above the 55% line in every wave. Treat as safe-lean; reallocate field resources to Tacoma & Sonoma.", lessons: "" },
    },

    /* ---- UPCOMING (future ballots) ---- */
    {
      __mock: true,
      id: "austin-a",
      code: "Proposition A",
      title: "Austin Transit Expansion Bond",
      client: "Capital Metro",
      type: "GO Bond",
      category: "Transportation",
      jurisdiction: "Austin, TX",
      state: "TX",
      amount: "$7.1B program",
      threshold: TH.majority,
      consultant: "J. Mercer",
      cycle: "November 2026",
      electionDate: "2026-11-03",
      phase: "upcoming",
      yesPct: 48.0,
      polls: waves([["Wave 1 · baseline", "2026-04-30", 47, 41]]),
      deliverables: [
        { __mock: true, item: "Baseline survey", status: "in-proofing", owner: "L. Okafor", due: "2026-06-15" },
        { __mock: true, item: "Message architecture memo", status: "draft", owner: "J. Mercer", due: "2026-06-30" },
      ],
      deadlines: [
        { __mock: true, type: "Council resolution (deadline to file)", date: "2026-08-17", source: "auto", done: false },
        { __mock: true, type: "Ballot language certification", date: "2026-08-24", source: "auto", done: false },
      ],
      notes: { general: "Early days. Baseline under water on cost; testing a phased-delivery frame in next wave.", lessons: "" },
    },
    {
      __mock: true,
      id: "pierce-1",
      code: "Proposition 1",
      title: "Pierce County Public Safety Sales Tax",
      client: "Pierce County",
      type: "Sales Tax",
      category: "Public Safety",
      jurisdiction: "Pierce County, WA",
      state: "WA",
      amount: "0.1% sales tax",
      threshold: TH.majority,
      consultant: "M. Cardoza",
      cycle: "November 2026",
      electionDate: "2026-11-03",
      phase: "upcoming",
      yesPct: 53.0,
      polls: waves([["Wave 1 · baseline", "2026-05-10", 53, 35]]),
      deliverables: [
        { __mock: true, item: "Baseline survey", status: "delivered", owner: "L. Okafor", due: "2026-05-10" },
      ],
      deadlines: [
        { __mock: true, type: "Resolution to place on ballot", date: "2026-08-04", source: "auto", done: false },
      ],
      notes: { general: "Public-safety framing polls well; watch regressivity attack from progressive groups.", lessons: "" },
    },
    {
      __mock: true,
      id: "mesa-1",
      code: "Question 1",
      title: "Mesa Public Safety Facilities Bond",
      client: "City of Mesa",
      type: "GO Bond",
      category: "Public Safety",
      jurisdiction: "Mesa, AZ",
      state: "AZ",
      amount: "$280M bond",
      threshold: TH.majority,
      consultant: "R. Tan",
      cycle: "November 2026",
      electionDate: "2026-11-03",
      phase: "upcoming",
      yesPct: 51.0,
      polls: waves([["Wave 1 · baseline", "2026-05-18", 51, 38]]),
      deliverables: [
        { __mock: true, item: "Feasibility memo", status: "approved", owner: "R. Tan", due: "2026-05-20" },
      ],
      deadlines: [
        { __mock: true, type: "Council referral deadline", date: "2026-07-08", source: "auto", done: false },
      ],
      notes: { general: "", lessons: "" },
    },
    {
      __mock: true,
      id: "boulder-5a",
      code: "Issue 5A",
      title: "Boulder Valley Schools Mill Levy",
      client: "Boulder Valley School District",
      type: "Mill Levy",
      category: "Schools",
      jurisdiction: "Boulder County, CO",
      state: "CO",
      amount: "$0.0044 mill levy",
      threshold: TH.majority,
      consultant: "D. Whitfield",
      cycle: "November 2026",
      electionDate: "2026-11-03",
      phase: "upcoming",
      yesPct: 57.0,
      polls: waves([["Wave 1 · baseline", "2026-05-12", 57, 31]]),
      deliverables: [
        { __mock: true, item: "Baseline survey", status: "delivered", owner: "L. Okafor", due: "2026-05-12" },
      ],
      deadlines: [
        { __mock: true, type: "TABOR notice content due", date: "2026-09-04", source: "auto", done: false },
      ],
      notes: { general: "CO requires TABOR fiscal-impact notice; budget time for content review.", lessons: "" },
    },

    /* ---- CLOSED (past ballots, results in) ---- */
    {
      __mock: true,
      id: "denver-2r",
      code: "Measure 2R",
      title: "Denver Parks & Open Space Sales Tax",
      client: "City & County of Denver",
      type: "Sales Tax",
      category: "Parks",
      jurisdiction: "Denver, CO",
      state: "CO",
      amount: "0.25% sales tax",
      threshold: TH.majority,
      consultant: "D. Whitfield",
      cycle: "November 2025",
      electionDate: "2025-11-04",
      phase: "closed",
      yesPct: 61.3,
      result: { passed: true, finalYes: 61.3, modeledYes: 59.0 },
      polls: waves([
        ["Wave 1 · baseline", "2025-08-12", 56, 30],
        ["Wave 2 · final", "2025-10-20", 59, 31],
      ]),
      deliverables: [
        { __mock: true, item: "Post-election analysis", status: "delivered", owner: "D. Whitfield", due: "2025-11-20" },
      ],
      deadlines: [
        { __mock: true, type: "Final finance report", date: "2025-12-04", source: "auto", done: true },
      ],
      notes: {
        general: "Passed +2.3 over model. Parks framing outperformed.",
        lessons: "Parks/open-space sales taxes beat the model when paired with a named acquisition list. Voters reward specificity over program totals.",
      },
    },
    {
      __mock: true,
      id: "sacramento-k",
      code: "Measure K",
      title: "Sacramento County Library Parcel Tax",
      client: "Sacramento Public Library Authority",
      type: "Parcel Tax",
      category: "Library",
      jurisdiction: "Sacramento County, CA",
      state: "CA",
      amount: "$28 / parcel",
      threshold: TH.twothirds,
      consultant: "J. Mercer",
      cycle: "November 2025",
      electionDate: "2025-11-04",
      phase: "closed",
      yesPct: 64.1,
      result: { passed: false, finalYes: 64.1, modeledYes: 66.0 },
      polls: waves([
        ["Wave 1 · baseline", "2025-08-18", 65, 22],
        ["Wave 2 · final", "2025-10-22", 66, 24],
      ]),
      deliverables: [
        { __mock: true, item: "Post-mortem memo", status: "delivered", owner: "J. Mercer", due: "2025-11-25" },
      ],
      deadlines: [
        { __mock: true, type: "Final finance report", date: "2025-12-04", source: "auto", done: true },
      ],
      notes: {
        general: "Fell 2.6 short of two-thirds despite 64% Yes. The classic two-thirds heartbreak.",
        lessons: "Do not green-light a two-thirds library tax off a 66% final-wave read — undecideds broke No. Need a 70%+ cushion to recommend proceeding at two-thirds.",
      },
    },
    {
      __mock: true,
      id: "fresno-p",
      code: "Measure P",
      title: "Fresno Parks & Arts Sales Tax",
      client: "City of Fresno",
      type: "Sales Tax",
      category: "Parks",
      jurisdiction: "Fresno, CA",
      state: "CA",
      amount: "0.375% sales tax",
      threshold: TH.twothirds,
      consultant: "L. Okafor",
      cycle: "November 2024",
      electionDate: "2024-11-05",
      phase: "closed",
      yesPct: 52.2,
      result: { passed: true, finalYes: 52.2, modeledYes: 50.0, note: "Certified after litigation over majority-vs-two-thirds threshold for citizen initiatives." },
      polls: waves([
        ["Wave 1 · baseline", "2024-08-10", 54, 33],
        ["Wave 2 · final", "2024-10-18", 53, 35],
      ]),
      deliverables: [
        { __mock: true, item: "Threshold litigation brief support", status: "delivered", owner: "L. Okafor", due: "2024-12-15" },
      ],
      deadlines: [],
      notes: {
        general: "Citizen-initiative threshold ambiguity (majority vs two-thirds) resolved in court post-election.",
        lessons: "For citizen-initiated special taxes, flag the threshold-litigation risk in the engagement memo before launch. The 'which threshold' question is now a live strategic variable.",
      },
    },
  ];

  /* -------------------------------------------------------------------------
   *  PIPELINE — business development opportunities
   * ----------------------------------------------------------------------- */
  const pipeline = [
    { __mock: true, id: "bd1", stage: "lead", opportunity: "County transportation tax (renewal)", client: "Stanislaus County", state: "CA", value: 220000, decisionDate: "2026-07-15", owner: "D. Whitfield" },
    { __mock: true, id: "bd2", stage: "lead", opportunity: "Hospital district bond", client: "Salinas Valley Health", state: "CA", value: 180000, decisionDate: "2026-08-01", owner: "R. Tan" },
    { __mock: true, id: "bd3", stage: "rfp", opportunity: "Citywide infrastructure bond", client: "City of Spokane", state: "WA", value: 310000, decisionDate: "2026-06-20", owner: "M. Cardoza" },
    { __mock: true, id: "bd4", stage: "rfp", opportunity: "Community college facilities bond", client: "Pima CCD", state: "AZ", value: 260000, decisionDate: "2026-06-30", owner: "J. Mercer" },
    { __mock: true, id: "bd5", stage: "proposal", opportunity: "Fire district parcel tax", client: "Truckee Meadows FPD", state: "NV", value: 145000, decisionDate: "2026-06-10", owner: "R. Tan" },
    { __mock: true, id: "bd6", stage: "proposal", opportunity: "School mill levy override", client: "Cherry Creek SD", state: "CO", value: 240000, decisionDate: "2026-06-18", owner: "D. Whitfield" },
    { __mock: true, id: "bd7", stage: "won", opportunity: "Transit sales tax", client: "Pierce County", state: "WA", value: 290000, decisionDate: "2026-05-09", owner: "M. Cardoza", reason: "Existing relationship; sole-source after RFI." },
    { __mock: true, id: "bd8", stage: "won", opportunity: "Schools repair bond", client: "Boulder Valley SD", state: "CO", value: 200000, decisionDate: "2026-05-02", owner: "D. Whitfield", reason: "Strongest polling methodology in panel." },
    { __mock: true, id: "bd9", stage: "lost", opportunity: "Water district revenue bond", client: "Coachella Valley WD", state: "CA", value: 175000, decisionDate: "2026-04-22", owner: "L. Okafor", reason: "Lost on price to incumbent firm." },
    { __mock: true, id: "bd10", stage: "lost", opportunity: "Library parcel tax", client: "Alameda County Library", state: "CA", value: 130000, decisionDate: "2026-03-30", owner: "J. Mercer", reason: "Board paused measure to 2028 cycle." },
  ];

  /* -------------------------------------------------------------------------
   *  STANDALONE COMPLIANCE DEADLINES — not tied to a single measure
   * ----------------------------------------------------------------------- */
  const firmDeadlines = [
    { __mock: true, type: "Quarterly lobbying disclosure", date: "2026-06-30", source: "manual", measureId: null },
    { __mock: true, type: "Firm-wide conflict review", date: "2026-06-15", source: "manual", measureId: null },
  ];

export const ET = {
  IS_MOCK: true,
  TODAY,
  TH,
  STAFF,
  measures,
  pipeline,
  firmDeadlines,
  byId: (id) => measures.find((m) => m.id === id),
  active: () => measures.filter((m) => m.phase === "active"),
};

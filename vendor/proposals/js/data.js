/* ============ Fog Signal Proposals — content library ============
   Pre-written, client-curated proposal content. When the platform is
   wired to the production database, this module is the seam: replace
   these constants with API calls and nothing else changes.            */
'use strict';

/* ---------- brand palette (future: pulled from the brand settings table) ---------- */
const BRAND_TEXT_COLORS = [
  ['#0F0F0F', 'Ink'], ['#2A2A2A', 'Ink 700'], ['#5B5B58', 'Gray'], ['#7A7975', 'Gray light'],
  ['#0E2238', 'Navy 900'], ['#1A3A5C', 'Navy'], ['#3F6A99', 'Navy 500'], ['#8AA7C2', 'Navy 300'],
  ['#B8932A', 'Gold 700'], ['#EFC53F', 'Gold'], ['#F4D77A', 'Gold 300'], ['#D3D2C3', 'Bone'],
  ['#2F6B4F', 'Green'], ['#A8341E', 'Red'], ['#FFFFFF', 'White'],
];
const BRAND_HIGHLIGHT_COLORS = [
  ['transparent', 'None'],
  ['#FBECBF', 'Gold tint'], ['#F4D77A', 'Gold 300'], ['#EEF3F8', 'Navy tint'], ['#D9E2EC', 'Navy 100'],
  ['#F1F0E8', 'Bone tint'], ['#E9F1EC', 'Green tint'], ['#F6E9E7', 'Red tint'], ['#FFF9C4', 'Classic yellow'],
];

/* ---------- client types ---------- */
const CLIENTS = {
  school:  { label: 'School District',  short: 'School',  ex: 'Bond & Override Measures',
    lead: 'We help school districts build the community understanding and trust that make bond and override measures succeed.' },
  city:    { label: 'City / Municipal', short: 'City',    ex: 'Municipal Funding Measures',
    lead: 'We help cities communicate clearly with residents about the funding measures that shape daily life.' },
  county:  { label: 'County',           short: 'County',  ex: 'County-wide Sales Tax',
    lead: 'We help counties advance county-wide funding measures with disciplined, geographically distributed public education.' },
  fire:    { label: 'Fire / Public Safety', short: 'Fire', ex: 'Fire District Bond & Levy',
    lead: 'We help fire districts and public-safety agencies build the community trust that turns facility needs into passed measures.' },
  special: { label: 'Special District', short: 'Special', ex: 'Special District Measures',
    lead: 'We help special districts translate technical facility needs into plain-language stories voters trust.' },
  design:  { label: 'Design',           short: 'Design',  ex: 'Graphic Design & Creative',
    lead: 'We help agencies and campaigns translate strategy into clear, on-brand visual systems and production-ready creative.' },
  state:   { label: 'State',            short: 'State',   ex: 'Statewide Initiatives',
    lead: 'We help statewide campaigns and agencies advance public-education efforts across diverse regions, media markets, and audiences.' },
};
const CLIENT_KEYS = ['school', 'city', 'county', 'fire', 'special', 'design', 'state'];

/* ---------- team (future: users table) ---------- */
const USERS = [
  { id: 'me',     name: 'You',                 initials: 'ME', color: '#B8932A' },
  { id: 'carter', name: 'Carter James',        initials: 'CJ', color: '#1A3A5C' },
  { id: 'luke',   name: 'Luke O’Connell', initials: 'LO', color: '#2A527F' },
  { id: 'dana',   name: 'Digital Strategist',  initials: 'DS', color: '#3F6A99' },
  { id: 'em',     name: 'Earned Media Lead',   initials: 'EM', color: '#2F6B4F' },
];
/* Current identity — picked in the topbar until dashboard auth takes over. */
let ME = USERS.find(u => u.id === localStorage.getItem('fss.uid')) || USERS[0];
function setCurrentUser(id) {
  const u = USERS.find(x => x.id === id);
  if (!u) return;
  ME = u;
  localStorage.setItem('fss.uid', id);
}

/* ---------- staff bios (tailored per client type) ---------- */
const STAFF = [
  { id: 'carter', name: 'Carter James', role: 'Managing Partner & Primary Point of Contact', initials: 'CJ', color: '#1A3A5C', rate: 295,
    bio: {
      base: 'Carter James grew up in a rural community, and that background shapes how he approaches every engagement. He understands that trust is built through presence, consistency, and straight talk. He holds degrees from North Dakota State University in Emergency Management and from Johns Hopkins University in Government and Political Communications. Over a career spanning more than 250 campaigns nationwide, Carter has contributed strategy that has supported more than $2 billion in successful ballot initiatives.',
      school:  'Carter currently leads Fog Signal’s engagement with Colorado Springs School District 11 and brings direct, current experience helping school districts pass bond and override measures in tax-sensitive communities.',
      city:    'Carter helps cities engage residents and advance municipal funding measures, with a focus on plain-language cost communication and coalition building.',
      county:  'Carter’s work centers on helping counties engage residents across varied geographies and advance county-wide funding measures, with particular strength in transportation and sales-tax referenda.',
      fire:    'Carter has led successful measures for fire districts and public-safety agencies nationwide, with particular strength in rural communities where relationship-driven, face-to-face outreach is essential.',
      special: 'Carter specializes in helping special districts translate technical facility needs into community trust, with particular strength in rural and small-community settings.',
      design:  'Carter scopes creative engagements so strategy, messaging, and design stay aligned — keeping approvals clear and deliverables production-ready.',
      state:   'Carter has supported statewide public-education and ballot efforts that must land consistently across regions, media markets, and politically diverse audiences.',
    } },
  { id: 'luke', name: 'Luke O’Connell', role: 'Creative Director', initials: 'LO', color: '#2A527F', rate: 250,
    bio: {
      base: 'Luke O’Connell leads all creative and visual strategy at Fog Signal Strategies. She holds a degree from the University of New Hampshire and an MBA from Chapman University and brings a distinctive combination of design expertise and strategic communications acumen to every project. Luke specializes in translating complex policy and community issues into clear, accessible, and engaging visual materials.',
      school:  'Luke’s work translating facility assessments into visual stories is especially valuable when communicating school facility needs and tax impacts to families and taxpayers alike.',
      city:    'Luke develops branded campaign materials that carry a consistent, accessible message across print, digital, and earned media.',
      county:  'Luke excels at turning engineering plans and project lists into visual, tangible stories tied to the corridors and neighborhoods residents use every day.',
      fire:    'Luke translates station assessments and apparatus needs into visual narratives that show communities exactly what a measure will fund and why it matters.',
      special: 'Luke turns technical facility assessments into visual narratives that show communities exactly what a measure will fund and why it matters.',
      design:  'Luke leads brand systems, campaign creative, and multi-channel design production — from identity and templates through print, digital, and motion deliverables.',
      state:   'Luke builds statewide visual systems that stay on-brand while adapting to local markets, languages, and channel mixes.',
    } },
  { id: 'digital', name: 'Senior Digital & Social Strategist', role: 'Digital & Social Media', initials: 'DS', color: '#3F6A99', rate: 225,
    bio: {
      base: 'Leads paid and organic social strategy, content production, email list management, and engagement analytics, ensuring the campaign reaches voters through the channels they already use.',
      school: 'Focuses on reaching parents, staff, and community members through the channels most active in the district.',
      city: '', county: '', fire: '', special: '', design: '', state: '',
    } },
  { id: 'earned', name: 'Earned Media & PR Specialist', role: 'Earned Media & Public Relations', initials: 'EM', color: '#2A527F', rate: 195,
    bio: {
      base: 'Handles media relations strategy, press releases, backgrounders, op-ed and letter-to-the-editor coordination, and spokesperson preparation to ensure accurate, favorable coverage.',
      school: '', city: '', county: '', fire: '', special: '', design: '', state: '',
    } },
  { id: 'designer', name: 'Designer / Video Producer', role: 'Design & Video Production', initials: 'DV', color: '#3F6A99', rate: 150,
    bio: {
      base: 'Produces direct mail, fact sheets, short-form and explainer video, digital graphics, and event collateral that bring the measure to life for every audience.',
      school: '', city: '', county: '', fire: '', special: '',
      design: 'Focuses on production design, file prep, and iteration so creative assets ship on time and print- or publish-ready.',
      state: '',
    } },
  { id: 'coord', name: 'Project Coordinator', role: 'Project Coordination', initials: 'PC', color: '#8AA7C2', rate: 115,
    bio: {
      base: 'Supports scheduling, deliverable tracking, meeting logistics, and day-to-day coordination with your team so nothing slips.',
      school: '', city: '', county: '', fire: '', special: '', design: '', state: '',
    } },
];

/* Settings-aware staff list: admin edits and added members from
   Workspace Settings → Team & Bios win over the built-ins above. */
function staffAll() {
  if (typeof Settings !== 'undefined' && Settings.data) return Settings.staffList();
  return STAFF;
}
function staffById(id) { return staffAll().find(s => s.id === id) || null; }

/* ---------- case studies (tagged by client type) ---------- */
const CASES = [
  { id: 'sacmetro', tags: ['fire', 'special'],
    title: 'Sacramento Metropolitan Fire District, Sacramento County, CA',
    sub: '2024 — General Obligation Bond (Measure O)',
    type: '$415 million general obligation bond for fire station replacement, emergency vehicle acquisition, apparatus, and equipment.',
    demo: 'Large suburban/semi-rural district serving approximately 780,000 residents across unincorporated Sacramento County; economically diverse with significant rural and agricultural areas.',
    scope: 'Full ballot measure consulting including strategic planning, community outreach and education campaign, message development and testing, stakeholder engagement, public meeting facilitation, direct mail and digital communications.',
    outcome: 'Measure O passed with 68.12% approval (required two-thirds supermajority).' },
  { id: 'fargo', tags: ['fire', 'city'],
    title: 'Fargo Fire Department, Cass County, ND',
    sub: '2024 — Sales Tax Measure (Measure #3)',
    type: 'Quarter-cent (0.25%) sales tax for fire and police operations, equipment, and buildings; 20-year term generating approximately $8 million annually.',
    demo: 'Mid-size Great Plains city with a growing population of approximately 130,000; fiscally conservative electorate.',
    scope: 'Community education and public outreach campaign, voter engagement strategy, stakeholder communication, public meeting facilitation, informational materials development.',
    outcome: 'Measure #3 approved by voters (November 2024).' },
  { id: 'oakgrove', tags: ['fire', 'special'],
    title: 'Oak Grove Fire Department, Wagoner County, OK',
    sub: '2025 — Annexation & Fire Station Expansion',
    type: 'Annexation vote to expand fire district coverage area and fund construction of a new fire station, enabling transition from an all-volunteer department to a combination department.',
    demo: 'Rural community in eastern Wagoner County covering approximately 30 square miles; the annexation doubled the district’s service area.',
    scope: 'Community education and public outreach campaign, voter engagement strategy, stakeholder communication, public meeting facilitation, informational materials development.',
    outcome: 'Annexation approved with 69% voter support (March 2025).' },
  { id: 'sfsprings', tags: ['city'],
    title: 'City of Santa Fe Springs, Los Angeles County, CA',
    sub: '2024 — Dedicated Road Repair Parcel Tax (Measure SFS)',
    type: 'Special parcel tax on commercial and industrial properties, 25-year term with 2% annual inflation adjustment, generating approximately $6 million annually exclusively for road maintenance; residential properties exempt.',
    demo: 'Small but economically significant industrial city of approximately 19,000 residents; one of the most freight-impacted jurisdictions in Southern California.',
    scope: 'Full ballot measure consulting including strategic planning, polling and message testing, stakeholder engagement with the business community, public education campaign, citizens’ oversight committee structure development, earned media and digital outreach.',
    outcome: 'Measure SFS approved with 74.2% voter support (exceeded the two-thirds supermajority requirement).' },
  { id: 'boulder', tags: ['county'],
    title: 'Boulder County, Colorado',
    sub: '2022 — Countywide Transportation Sales Tax (Ballot Issue 1C)',
    type: 'Extension of the countywide transportation sales tax; “extension-not-increase” framing with approximately $281 million in projected state/federal matching funds over 15 years.',
    demo: 'Colorado county of approximately 330,000 residents spanning urban, suburban, mountain, and unincorporated communities.',
    scope: 'Voter research and message testing, project list development and validation, broad endorsement coalition building, climate and federal-leverage messaging, public meeting facilitation, digital and earned media.',
    outcome: 'Ballot Issue 1C approved with 80.9% voter support — one of the strongest countywide transportation-tax margins in Colorado in recent memory.' },
  { id: 'napa', tags: ['county'],
    title: 'Napa Valley Transportation Authority, Napa County, CA',
    sub: '2024 — Transportation Sales Tax Renewal (Measure U)',
    type: 'Renewal and extension of the existing ½-cent countywide transportation tax through 2055 with bonding authority; approximately $25 million annually and an estimated $1.2 billion over the life of the measure.',
    demo: 'Napa County, approximately 134,000 residents across five incorporated cities plus unincorporated areas.',
    scope: 'Countywide public education strategy, expenditure plan communication, stakeholder engagement across five cities, earned media, digital outreach.',
    outcome: 'Measure U approved by Napa County voters (November 2024).' },
  { id: 'csd11', tags: ['school'],
    title: 'Colorado Springs School District 11, El Paso County, CO',
    sub: '2026 — Bond Measure Engagement (current)',
    type: 'General obligation bond for facility modernization and safety improvements across the district.',
    demo: 'Urban Colorado school district serving a tax-sensitive, TABOR-constrained electorate.',
    scope: 'Strategic planning, community engagement, message development, materials production, and public education in advance of the bond election.',
    outcome: 'Engagement in progress — current, direct familiarity with Colorado’s political landscape and school-finance environment.' },
  { id: 'brandkit', tags: ['design'],
    title: 'Regional Public Agency Brand & Collateral System',
    sub: '2024 — Identity refresh and multi-channel creative package',
    type: 'Visual identity refresh, template library, and production of print/digital collateral for an ongoing public-facing program.',
    demo: 'Mid-size public agency needing consistent creative across web, social, print, and event uses without building an in-house design team.',
    scope: 'Discovery and creative brief, brand system and templates, campaign collateral design, file packaging, and a lightweight revision workflow with staff stakeholders.',
    outcome: 'Delivered an approved brand kit and production-ready asset library used across subsequent outreach cycles.' },
  { id: 'statewide', tags: ['state'],
    title: 'Statewide Public Education Initiative',
    sub: '2023 — Multi-market education campaign',
    type: 'Coordinated public education effort spanning multiple media markets with shared messaging and localized creative adaptations.',
    demo: 'Statewide electorate with urban, suburban, and rural audiences and uneven prior awareness of the underlying policy need.',
    scope: 'Message architecture, regional creative adaptations, digital and earned media coordination, and partner toolkit distribution across markets.',
    outcome: 'Raised awareness and message consistency statewide while preserving local relevance in priority regions.' },
];

/* ---------- core narrative copy ---------- */
const COPY = {
  about: (ct) => {
    const flavor = {
      school:  'Importantly, we bring direct school-district experience and a particular strength in tax-sensitive communities where clear cost communication decides measures.',
      city:    'Importantly, we bring direct municipal experience and a particular strength in helping cities communicate value to fiscally cautious residents.',
      county:  'Importantly, we bring direct experience with county-wide referenda and a particular strength in fast-growing, geographically diverse, and tax-sensitive communities.',
      fire:    'Importantly, we bring direct experience with fire district and public-safety measures and a particular strength in rural and tax-averse environments.',
      special: 'Importantly, we bring direct special-district experience and a particular strength in rural and small-community settings.',
      design:  'Importantly, we bring an integrated creative practice — strategy, design, and production under one roof — so brand systems and campaign materials stay consistent from brief to final files.',
      state:   'Importantly, we bring experience coordinating statewide public-education efforts that must hold together across regions, media markets, and politically diverse audiences.',
    }[ct] || '';
    return `<p>Fog Signal Strategies is a strategic communications firm headquartered in Southern California, organized as a senior-led consultancy that helps communities, organizations, and campaigns through high-stakes decisions. The firm is structured to deliver principal-level attention on every engagement, with a core team of strategists, creative professionals, digital and earned-media specialists, and project coordinators, scaled to the scope of each project.</p><p>We specialize in building trust and delivering measurable results and have advised public agencies and campaigns at every level — from local special districts and counties to statewide initiatives — cumulatively supporting more than $2 billion in approved public funding. ${flavor}</p><p>Supported by a national team, Fog Signal Strategies offers the capability of an established firm while remaining agile and personally invested in each client’s success. With research, strategy, and creative development integrated under one roof, we provide a streamlined approach that eliminates the coordination headaches of working with multiple vendors.</p>`;
  },
  approach: (ct) => {
    if (ct === 'design') {
      return `<p>We start every creative engagement by listening — to your goals, audiences, brand constraints, and production realities. We don’t believe in one-size-fits-all design systems. Instead, we take time to understand how your materials will be used, who must approve them, and what “done” looks like before we open a layout.</p><p>Our process keeps strategy and craft in the same room: messaging informs visual hierarchy, and production constraints shape concepts early so revisions stay focused and files ship ready to print or publish.</p>`;
    }
    return `<p>We start every engagement by listening — to your goals, your challenges, and your community. We don’t believe in one-size-fits-all solutions. Instead, we take time to understand your specific context, including the values and concerns of your stakeholders, before we craft a single message.</p><p>In the communities we serve, we’ve found that smaller, relationship-driven conversations move opinion further than any advertisement. Our outreach strategies meet community members where they are — both in person and online — and equip trusted local voices to carry an accurate message on the measure’s behalf.</p>`;
  },
  why: (ct) => {
    if (ct === 'design') {
      return `<p>Creative projects most often stall not because teams lack taste, but because of gaps in three areas: a shared brief, a durable visual system, and a clear path from concept to production. Our approach is designed to close all three:</p><p><b>Brief clarity:</b> We lock audience, message hierarchy, must-use assets, and approval paths before design begins — so feedback stays specific.</p><p><b>System thinking:</b> We build templates and rules that scale across channels instead of one-off layouts that drift out of brand.</p><p><b>Production readiness:</b> We package files, specs, and revision rounds so your team (or vendors) can print, post, and reuse without rework.</p>`;
    }
    return `<p>Ballot measures most often fail not because voters oppose the underlying service, but because of gaps in three areas: awareness of the specific need, understanding of the true cost and how it compares to the value received, and clarity about how existing and new tax dollars will be used. Our approach is specifically designed to address all three:</p><p><b>Awareness:</b> We translate plans and project lists into visual, tangible stories — showing residents the specific facilities, corridors, and neighborhoods that will be improved, and what those improvements mean for daily life.</p><p><b>Cost Confidence:</b> We break down costs into clear, relatable terms — what the measure means per household, per month — and frame it alongside the value the projects deliver.</p><p><b>Tax Clarity:</b> We directly address common questions about existing tax dollars — what has been completed, what remains, and how the proposed measure builds on that record — through simple, factual educational materials.</p>`;
  },
  understanding: (doc) => {
    if (doc.clientType === 'design') {
      return `<p>${esc(doc.agency || 'The client')} needs creative work that is on-brand, approval-friendly, and ready for real-world use. Our job is to turn that need into a clear brief, a coherent visual approach, and production-ready deliverables. The scope below is organized into three stages from kickoff through final file handoff.</p>`;
    }
    return `<p>${esc(doc.agency || 'The client')} has already laid important groundwork for this measure. Our job is to take that foundation and build a public education effort that gives voters the information and confidence they need. The scope of work below is organized into three sequential stages and is designed to address each requirement of the RFP between contract award and Election Day.</p>`;
  },
  workplan: (ct) => {
    if (ct === 'design') {
      return `<h3>Our Approach: Three Stages</h3>
<h4>STAGE 1: Discovery &amp; Creative Brief</h4>
<p>We align on audience, message hierarchy, brand constraints, and success criteria before design begins.</p>
<ul>
<li>Kickoff with stakeholders to confirm goals, must-use assets, brand guidelines, and approval workflow</li>
<li>Audit existing materials and competitive/context references</li>
<li>Deliver a written creative brief: audiences, tone, visual direction, deliverable list, and timeline</li>
<li>Confirm file formats, print specs, accessibility expectations, and handoff requirements</li>
</ul>
<h4>STAGE 2: Concept &amp; Design Development</h4>
<p>We explore direction, then refine the selected path into a coherent system and first-round designs.</p>
<ul>
<li>Present concept directions with rationale tied to the brief</li>
<li>Develop the approved direction across priority deliverables (identity elements, templates, key collateral)</li>
<li>Build reusable components so later pieces stay consistent</li>
<li>Run structured revision rounds with consolidated stakeholder feedback</li>
</ul>
<h4>STAGE 3: Production &amp; Delivery</h4>
<p>We finalize assets, package files, and support a clean handoff to your team or vendors.</p>
<ul>
<li>Produce final print- and digital-ready files to agreed specs</li>
<li>Deliver a simple usage guide / template notes where helpful</li>
<li>Support production questions during the launch window</li>
<li>Archive source files and export packages for future reuse</li>
</ul>`;
    }
    return `<h3>Our Approach: Three Stages</h3>
<h4>STAGE 1: Strategic Assessment &amp; Planning</h4>
<p>The first stage builds the strategic foundation for the engagement.</p>
<ul>
<li>Conduct kickoff meeting with staff to establish communication protocols, meeting cadence, and decision-making framework</li>
<li>Review existing polling, assessments, and financial analyses; analyze voter demographics, turnout patterns, and prior election results</li>
<li>Map key stakeholders across government, business, civic, and community sectors</li>
<li>Deliver a written Public Education Campaign Plan: messaging framework, outreach calendar, channel strategy, and measurement framework</li>
<li>Establish a legal and regulatory compliance framework, including clear information-vs.-advocacy boundaries</li>
</ul>
<h4>STAGE 2: Community Awareness &amp; Public Education</h4>
<p>This stage is the heart of the engagement — building awareness, understanding, and trust through sustained, accessible public education.</p>
<ul>
<li>Design and execute a comprehensive community engagement plan with a calendar of events, touchpoints, and outreach activities</li>
<li>Facilitate town halls, listening sessions, and presentations to community groups using clear, easy-to-understand materials</li>
<li>Create and distribute informational materials: print pieces, direct mail, digital graphics, fact sheets, FAQs, and presentation decks</li>
<li>Manage digital and social outreach, earned media, and a speaker’s bureau of informed community messengers</li>
<li>Develop a toolkit for community partners and volunteer advocates so trusted local voices carry an accurate, consistent message</li>
</ul>
<h4>STAGE 3: Final Push, Reporting &amp; Election Readiness</h4>
<p>The final stage concentrates the highest-impact outreach into the weeks before Election Day and closes the loop on reporting.</p>
<ul>
<li>Deliver written progress reports covering activities, coverage, engagement metrics, and the two-week look-ahead</li>
<li>Monitor performance data and recommend mid-campaign adjustments to messaging, channels, or geographic emphasis</li>
<li>Prepare board presentation materials, compliance documentation, and election-week communications</li>
<li>Deliver a written Final Campaign Report within 30 days of Election Day</li>
</ul>`;
  },
  schedule: (ct) => {
    if (ct === 'design') {
      return `<table class="ptable"><thead><tr><th style="width:26%">Phase</th><th style="width:26%">Timeframe</th><th>Key Activities</th></tr></thead><tbody>
<tr><td><b>Stage 1: Discovery &amp; Brief</b></td><td>Weeks 1–2</td><td>Kickoff, audit, creative brief, specs &amp; approval path</td></tr>
<tr><td><b>Stage 2: Concept &amp; Design</b></td><td>Weeks 3–6</td><td>Concepts, refinements, templates, primary deliverables</td></tr>
<tr><td><b>Stage 3: Production &amp; Handoff</b></td><td>Weeks 7–8</td><td>Final files, packaging, usage notes, launch support</td></tr>
<tr><td><b>Optional extensions</b></td><td>As needed</td><td>Additional collateral, motion, or seasonal refresh packages</td></tr>
</tbody></table>`;
    }
    return `<table class="ptable"><thead><tr><th style="width:26%">Phase</th><th style="width:26%">Timeframe</th><th>Key Activities</th></tr></thead><tbody>
<tr><td><b>Stage 1: Assessment &amp; Planning</b></td><td>Months 1–2</td><td>Kickoff, landscape analysis, stakeholder mapping, campaign plan, compliance framework, initial creative concept</td></tr>
<tr><td><b>Stage 2: Education &amp; Engagement</b></td><td>Months 3–6</td><td>Creative and messaging production, digital &amp; social, earned media, community events, speaker’s bureau, regular reporting</td></tr>
<tr><td><b>Stage 3: Final Push &amp; Reporting</b></td><td>Final month</td><td>Final media push, election-week communications, rapid response, reporting</td></tr>
<tr><td><b>Post-Election Wrap-up</b></td><td>Election + 30 days</td><td>Final Campaign Report, asset handover, reconciliation, lessons learned</td></tr>
</tbody></table>`;
  },
  terms: () => `<p>The total project fee is a fixed, not-to-exceed amount covering all labor, materials, supervision, and related resources necessary to deliver the scope of work. Fog Signal Strategies will invoice monthly based on project milestones and deliverables. We are happy to offer flexible payment structures, including monthly billing tied to deliverables or phased payments aligned with the project stages. This proposal, including all pricing, is firm for at least ninety (90) days from the closing date for submission.</p><h4>Insurance</h4><p>Fog Signal Strategies maintains, or will procure prior to commencing work, all insurance coverage necessary to meet the requirements outlined in the RFP. Upon contract award, we will provide all required Certificates of Insurance within five (5) business days of award notification, with the client named as additionally insured and all required endorsements in place.</p>`,
  conclusion: (doc) => {
    if (doc.clientType === 'design') {
      return `<p>Fog Signal Strategies is ready to bring the creative leadership, craft, and project discipline this work requires. ${esc(doc.agency || 'Your team')} deserves design that is clear, on-brand, and ready to use — and that is where we excel.</p><p>We appreciate the opportunity to submit this proposal and look forward to the possibility of partnering with you.</p><p>Thank you.</p>`;
    }
    return `<p>Fog Signal Strategies is ready to bring the expertise, presence, and commitment that this moment requires. ${esc(doc.agency || 'Your team')} has done the hard work of building a credible foundation — what remains is the community conversation, and that is where we excel.</p><p>Our team brings direct experience turning skeptical electorates into informed, confident voters in communities across the country. We understand what it means to earn trust through honest communication and genuine engagement, not just polished materials. We are confident in our approach, committed to your success, and hopeful to be considered as your partner for this effort.</p><p>Thank you.</p>`;
  },
  coverLetter: (doc) => {
    const c = CLIENTS[doc.clientType] || CLIENTS.county;
    if (doc.clientType === 'design') {
      return `<p>Dear Members of the Selection Committee,</p>
<p>Thank you for the opportunity to submit this proposal${doc.rfpNumber ? ' in response to ' + esc(doc.rfpNumber) : ''} for ${esc(doc.serviceTitle || 'Graphic Design & Creative Services')}. ${c.lead} We are eager for the opportunity to partner with ${esc(doc.agency || 'you')} on creative work that is strategic, consistent, and production-ready.</p>
<p>Fog Signal Strategies combines senior creative direction with practical production discipline. Luke O’Connell, our Creative Director, will lead visual strategy and design development, with principal oversight to keep the engagement on brief, on brand, and on schedule.</p>
<p>We appreciate the opportunity to submit this proposal and look forward to the possibility of working with you.</p>
<p>Sincerely,<br><br><b>Carter James</b><br>Managing Partner, Fog Signal Strategies<br>cjames@fogsignalstrategies.com</p>`;
    }
    return `<p>Dear Members of the Selection Committee,</p>
<p>Thank you for the opportunity to submit this proposal${doc.rfpNumber ? ' in response to ' + esc(doc.rfpNumber) : ''} for ${esc(doc.serviceTitle || 'Public Education & Community Outreach Services')}. ${c.lead} We are eager for the opportunity to partner with ${esc(doc.agency || 'you')} to design and execute a community-centered public education campaign.</p>
<p>Fog Signal Strategies combines the expertise of seasoned professionals with decades of public engagement and ballot-measure experience. I will serve as project lead and primary point of contact, drawing on experience from more than 250 campaigns nationwide and strategy supporting more than $2 billion in approved public funding. Luke O’Connell, our Creative Director, will lead all visual design and content development.</p>
<p>In our experience, the challenge is rarely opposition as much as it is uncertainty. Voters want to understand why the need is genuine, what it will cost them, and how their tax dollars will be used. Our entire approach is built around answering those questions in plain language, through the kinds of direct outreach that actually work.</p>
<p>We appreciate the opportunity to submit this proposal and look forward to the possibility of working with you.</p>
<p>Sincerely,<br><br><b>Carter James</b><br>Managing Partner, Fog Signal Strategies<br>cjames@fogsignalstrategies.com</p>`;
  },
};

/* ---------- default cost model (future: pricing database) ---------- */
function defaultCostModel(ct) {
  /* Admin-set pricing defaults (Workspace Settings → Pricing) win. */
  if (typeof Settings !== 'undefined' && Settings.data) {
    const custom = Settings.pricingModel(ct);
    if (custom) return custom;
  }

  /* Graphic design contracts — project-sized creative package, not a ballot engagement. */
  if (ct === 'design') {
    return {
      intro: '',
      months: 2,
      monthlyLabel: 'eight-week engagement',
      cats: [
        { id: uid('k'), name: 'Creative Direction & Project Management', desc: 'Kickoff, brief, stakeholder coordination, revision management, and timeline ownership', fee: 4500, kind: 'flat', rec: 4500 },
        { id: uid('k'), name: 'Brand / Visual System', desc: 'Identity refinements, color/type rules, and reusable templates for print and digital', fee: 12000, kind: 'flat', rec: 11000 },
        { id: uid('k'), name: 'Campaign & Collateral Design', desc: 'Priority print and digital pieces: fact sheets, social sets, presentations, event graphics', fee: 16000, kind: 'flat', rec: 15000 },
        { id: uid('k'), name: 'Production & File Packaging', desc: 'Print-ready and digital exports, naming conventions, and handoff package for vendors/staff', fee: 3500, kind: 'flat', rec: 3500 },
        { id: uid('k'), name: 'Revision Rounds', desc: 'Two consolidated revision rounds included in the scope above', fee: 0, kind: 'included', rec: 0 },
      ],
      addOns: [
        { id: uid('k'), name: 'Explainer / Motion Graphics Spot', desc: 'Short animated or motion piece derived from the approved visual system', fee: 9000, on: false },
        { id: uid('k'), name: 'Additional Collateral Package', desc: 'Extra designed pieces beyond the priority set in the base scope', fee: 4500, on: false },
      ],
      passThroughs: [
        { id: uid('k'), name: 'Print Production', desc: 'Vendor printing billed at cost with no agency markup', fee: 0, on: false },
        { id: uid('k'), name: 'Stock / Licensed Assets', desc: 'Approved stock photography or licensed fonts billed at cost', fee: 0, on: false },
      ],
      personnel: [
        { id: uid('k'), name: 'Luke O’Connell', role: 'Creative Director', amount: 14000 },
        { id: uid('k'), name: 'Designer / Producer', role: 'Design & production', amount: 12000 },
        { id: uid('k'), name: 'Carter James', role: 'Principal oversight', amount: 4500 },
        { id: uid('k'), name: 'Overhead & Indirect', role: 'Administration, technology, PM tools', amount: 2500 },
      ],
      showPersonnel: true,
      showRates: false,
      showPassThroughs: false,
      households: 0,
      measureAnnual: 0,
    };
  }

  const big = (ct === 'county' || ct === 'city' || ct === 'state');
  const k = big ? 1 : 0.4; // scale for smaller engagements
  const r = (n) => Math.round(n * k / 500) * 500;
  return {
    intro: '',
    months: big ? 6 : 14,
    monthlyLabel: big ? 'six-month engagement' : '14-month engagement',
    cats: [
      { id: uid('k'), name: 'Strategic Consulting & Project Management', desc: 'Ongoing strategic direction, project management, regular status updates, kickoff meeting, coordination with staff and financial team', fee: 2500, kind: 'monthly', months: big ? 6 : 14, rec: 2500 },
      { id: uid('k'), name: 'Community Engagement & Public Education', desc: 'Design and execution of public outreach plan, town halls, community meetings, stakeholder engagement, presentations to community groups', fee: r(55000), kind: 'flat', rec: r(50000) },
      { id: uid('k'), name: 'Creative Services & Materials', desc: 'Messaging development, print and digital materials, fact sheets, FAQs, website content, presentation materials, direct mail design', fee: r(90000), kind: 'flat', rec: r(85000) },
      { id: uid('k'), name: 'Digital & Social Media Outreach', desc: 'Paid and organic social strategy, content production, email list management, engagement analytics', fee: r(67500), kind: 'flat', rec: r(62500) },
      { id: uid('k'), name: 'Ballot / Measure Development Support', desc: 'Ballot language guidance, review coordination, resolution preparation support, board presentation materials', fee: 0, kind: 'included', rec: 0 },
      { id: uid('k'), name: 'Travel', desc: 'All travel for community meetings, town halls, board presentations, and stakeholder engagement', fee: big && ct === 'state' ? 12000 : 7500, kind: 'flat', rec: big && ct === 'state' ? 12000 : 7500 },
    ],
    addOns: [
      { id: uid('k'), name: 'Supplemental Voter Research & Polling', desc: 'Survey design and execution, data analysis, voter modeling', fee: 14500, on: false },
      { id: uid('k'), name: 'Explainer Video Production', desc: 'Scripted 90-second animated explainer video', fee: 9000, on: false },
    ],
    passThroughs: [
      { id: uid('k'), name: 'Estimated Paid Media Spend', desc: 'Radio, digital, print, and out-of-home placements; pass-through at net cost, billed only against the approved media plan', fee: big ? (ct === 'state' ? 150000 : 85000) : 0, on: big },
      { id: uid('k'), name: 'Direct Mail Production & Postage', desc: 'Universe-wide direct mail pieces: print production plus USPS postage at government rate; pass-through at vendor cost with no agency markup', fee: big ? (ct === 'state' ? 125000 : 90000) : 0, on: big },
    ],
    personnel: [
      { id: uid('k'), name: 'Carter James', role: 'Managing Partner / Project Lead', amount: r(90000) },
      { id: uid('k'), name: 'Luke O’Connell', role: 'Creative Director', amount: r(34000) },
      { id: uid('k'), name: 'Specialist Team', role: 'Digital, earned media, design & coordination', amount: r(52000) },
      { id: uid('k'), name: 'Overhead & Indirect', role: 'Administration, technology, PM tools', amount: r(7500) },
    ],
    showPersonnel: true,
    showRates: false,
    showPassThroughs: big,
    /* tax-impact helper (internal) */
    households: ct === 'state' ? 2500000 : 38000,
    measureAnnual: ct === 'state' ? 75000000 : 8000000,
  };
}

/* ---------- block catalog (drag-and-drop library) ---------- */
const CATALOG = [
  { cat: 'Front Matter', items: [
    { type: 'cover',       label: 'Cover Page',        desc: 'Title, client, date, and firm lockup', curated: true },
    { type: 'coverLetter', label: 'Cover Letter',      desc: 'Signed letter to the selection committee', curated: true },
    { type: 'toc',         label: 'Table of Contents', desc: 'Reactive — page numbers sync as the doc changes', curated: true },
    { type: 'divider',     label: 'Section Divider',   desc: 'Numbered full-page section break' },
  ]},
  { cat: 'The Firm', items: [
    { type: 'about',    label: 'About Fog Signal',  desc: 'Firm qualifications & overview', curated: true },
    { type: 'approach', label: 'Our Approach',      desc: 'How we work with your community', curated: true },
    { type: 'why',      label: 'Why Measures Fail', desc: 'The three-gap framework', curated: true },
  ]},
  { cat: 'People', items: [
    { type: 'team', label: 'Team Bios Page', desc: 'Pick staff & client tailoring — bios stay editable', curated: true },
  ]},
  { cat: 'Proof', items: [
    { type: 'experience', label: 'Relevant Experience', desc: 'Case studies matched to this client type', curated: true },
  ]},
  { cat: 'The Plan', items: [
    { type: 'understanding', label: 'Project Understanding', desc: 'Opening framing for the work plan' },
    { type: 'workplan',      label: 'Technical Approach',    desc: 'Three-stage work plan', curated: true },
    { type: 'schedule',      label: 'Project Schedule',      desc: 'Phase / timeframe / activities table', curated: true },
  ]},
  { cat: 'Money', items: [
    { type: 'cost', label: 'Cost Proposal', desc: 'Calculator-driven fee tables', curated: true },
  ]},
  { cat: 'Closing', items: [
    { type: 'terms',      label: 'Additional Terms', desc: 'Fixed-fee, invoicing, insurance' },
    { type: 'exceptions', label: 'Exceptions',       desc: 'No-exceptions statement' },
    { type: 'signature',  label: 'Signature',        desc: 'Staff signature with name & title', curated: true },
    { type: 'conclusion', label: 'Conclusion',       desc: 'Closing statement', curated: true },
  ]},
  { cat: 'Content', items: [
    { type: 'heading',   label: 'Heading',       desc: 'Section heading' },
    { type: 'text',      label: 'Text Block',    desc: 'Editable paragraph' },
    { type: 'image',     label: 'Image',         desc: 'Upload a photo or graphic' },
    { type: 'quote',     label: 'Pull Quote',    desc: 'Italic emphasis quote' },
    { type: 'twocol',    label: 'Two Columns',   desc: 'Side-by-side text' },
    { type: 'blankpage', label: 'Blank Page',    desc: 'A fresh empty page' },
    { type: 'pagebreak', label: 'Page Break',    desc: 'Force a new page' },
  ]},
];

/* Block types that exist without a library entry (created by imports etc.) */
const EXTRA_TYPES = {
  pdfpage: { type: 'pdfpage', label: 'Imported Page', desc: 'Page from an uploaded PDF' },
};
function catalogItem(type) {
  const ov = (typeof Settings !== 'undefined' && Settings.data) ? Settings.catalogItemOf(type) : null;
  for (const g of CATALOG) for (const it of g.items) if (it.type === type) return ov ? { ...it, ...ov } : it;
  if (ov) return ov;                     // admin-created custom block
  if (EXTRA_TYPES[type]) return EXTRA_TYPES[type];
  return { type, label: type, desc: '' };
}

/* ---------- default RFP checklist ---------- */
function defaultRfpItems() {
  return [
    { id: uid('r'), label: 'Cover letter to selection committee', section: '1.0', done: false },
    { id: uid('r'), label: 'Firm qualifications & experience',    section: '2.0', done: false },
    { id: uid('r'), label: 'Project team & key personnel',        section: '3.0', done: false },
    { id: uid('r'), label: 'Three relevant references w/ contacts', section: '3.4', done: false },
    { id: uid('r'), label: 'Technical approach & work plan',      section: '4.0', done: false },
    { id: uid('r'), label: 'Itemized cost proposal (not-to-exceed)', section: '5.0', done: false },
    { id: uid('r'), label: 'Conflict-of-interest statement',      section: '5.2', done: false },
    { id: uid('r'), label: 'Certificate of insurance',            section: '6.0', done: false },
  ];
}

/* ---------- document templates ---------- */
const TEMPLATES = {
  full:  { label: 'Full RFP Response', desc: 'Cover, letter, qualifications, team, experience, plan, schedule, cost, terms, conclusion',
    build: (doc) => ([
      Settings.makeCoverBlock(),
      { id: uid('b'), type: 'coverLetter' },
      { id: uid('b'), type: 'toc', pageBreak: true },
      { id: uid('b'), type: 'divider', num: 2, label: 'Firm Qualifications & Experience' },
      { id: uid('b'), type: 'about' },
      { id: uid('b'), type: 'why' },
      { id: uid('b'), type: 'divider', num: 3, label: 'Project Team' },
      { id: uid('b'), type: 'team', staff: ['carter', 'luke', 'digital', 'earned', 'designer', 'coord'], variant: doc.clientType },
      { id: uid('b'), type: 'experience' },
      { id: uid('b'), type: 'divider', num: 4, label: 'Technical Approach & Work Plan' },
      { id: uid('b'), type: 'understanding' },
      { id: uid('b'), type: 'workplan' },
      { id: uid('b'), type: 'schedule' },
      { id: uid('b'), type: 'divider', num: 5, label: 'Cost Proposal' },
      { id: uid('b'), type: 'cost', cost: defaultCostModel(doc.clientType) },
      { id: uid('b'), type: 'terms' },
      { id: uid('b'), type: 'conclusion' },
    ]) },
  design: { label: 'Design Contract', desc: 'Graphic design engagements: cover, letter, approach, team, scope, timeline, cost, conclusion',
    build: (doc) => ([
      Settings.makeCoverBlock(),
      { id: uid('b'), type: 'coverLetter' },
      { id: uid('b'), type: 'about' },
      { id: uid('b'), type: 'approach' },
      { id: uid('b'), type: 'why' },
      { id: uid('b'), type: 'team', staff: ['luke', 'designer', 'carter', 'coord'], variant: doc.clientType || 'design' },
      { id: uid('b'), type: 'understanding' },
      { id: uid('b'), type: 'workplan' },
      { id: uid('b'), type: 'schedule' },
      { id: uid('b'), type: 'cost', cost: defaultCostModel(doc.clientType || 'design') },
      { id: uid('b'), type: 'terms' },
      { id: uid('b'), type: 'conclusion' },
    ]) },
  letter: { label: 'Letter Proposal', desc: 'Compact: cover, letter, about, team, cost, conclusion',
    build: (doc) => ([
      Settings.makeCoverBlock(),
      { id: uid('b'), type: 'coverLetter' },
      { id: uid('b'), type: 'about' },
      { id: uid('b'), type: 'team', staff: doc.clientType === 'design' ? ['luke', 'carter'] : ['carter', 'luke'], variant: doc.clientType },
      { id: uid('b'), type: 'cost', cost: defaultCostModel(doc.clientType) },
      { id: uid('b'), type: 'conclusion' },
    ]) },
  blank: { label: 'Blank Document', desc: 'Start from an empty page',
    build: () => ([{ id: uid('b'), type: 'heading' }, { id: uid('b'), type: 'text' }]) },
};

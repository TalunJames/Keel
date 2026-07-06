/** Proposal templates, block library, and default content — shared seed for API responses. */

export const PROPOSAL_TEMPLATES = [
  {
    id: "ballot-rfp",
    name: "Ballot measure RFP response",
    desc: "Full formal response for public-agency RFPs — cover letter, qualifications, team, experience, fees, and staged work plan.",
    clientTypes: ["Community Outreach", "Public Affairs", "Crisis Communications", "Campaign Services"],
    defaultBlocks: [
      "cover",
      "coverLetter",
      "pagebreak",
      "qualifications",
      "pagebreak",
      "teamBio",
      "pagebreak",
      "caseStudy",
      "caseStudy",
      "caseStudy",
      "pagebreak",
      "workPlan",
      "projectSchedule",
      "pagebreak",
      "feeProposal",
      "optionalServices",
      "personnelCosts",
      "pagebreak",
      "terms",
      "insurance",
      "exceptions",
      "conclusion",
    ],
  },
  {
    id: "boutique",
    name: "Boutique scope memo",
    desc: "Short-form scope of work for a single retainer, single quarter.",
    clientTypes: ["Financial Strategy", "Custom"],
    defaultBlocks: ["cover", "summary", "scope", "deliverables", "timeline", "fees", "signoff"],
  },
  {
    id: "campaign",
    name: "Campaign engagement proposal",
    desc: "Comprehensive proposal for political campaigns — strategy, mail, polling.",
    clientTypes: ["Campaign Services"],
    defaultBlocks: ["cover", "aboutfirm", "situation", "approach", "scope", "team", "caseStudy", "timeline", "fees", "signoff"],
  },
  {
    id: "publicaff",
    name: "Public-affairs RFP response",
    desc: "Formal response to a state-government RFP. Compliance-forward.",
    clientTypes: ["Public Affairs"],
    defaultBlocks: ["cover", "coverLetter", "qualifications", "teamBio", "caseStudy", "workPlan", "feeProposal", "terms", "insurance", "conclusion"],
  },
  {
    id: "coalition",
    name: "Coalition build-out plan",
    desc: "Multi-party coalition with stakeholder map and rollout phases.",
    clientTypes: ["Community Outreach", "Crisis Communications"],
    defaultBlocks: ["cover", "summary", "situation", "stakeholders", "approach", "timeline", "fees", "signoff"],
  },
];

export const PROPOSAL_BLOCK_TYPES = {
  text: { label: "Text", icon: "pen", group: "Utilities" },
  heading: { label: "Section heading", icon: "layout", group: "Utilities" },
  quote: { label: "Pull quote", icon: "comment", group: "Utilities" },
  divider: { label: "Divider", icon: "more", group: "Utilities" },
  pagebreak: { label: "Page break", icon: "layout", group: "Utilities" },
  sectionHeader: { label: "Section divider", icon: "book", group: "Utilities" },
  toc: { label: "Table of contents", icon: "book", group: "Front matter" },
  cover: { label: "Cover page", icon: "image", group: "Front matter" },
  coverLetter: { label: "Cover letter", icon: "pen", group: "Front matter" },
  summary: { label: "Executive summary", icon: "comment", group: "Front matter" },
  executive: { label: "Executive summary", icon: "comment", group: "Front matter" },
  aboutfirm: { label: "About Fog Signal", icon: "lighthouse", group: "Qualifications" },
  qualifications: { label: "Qualifications & experience", icon: "shield", group: "Qualifications" },
  situation: { label: "The situation", icon: "alert", group: "Qualifications" },
  approach: { label: "Our approach", icon: "compass", group: "Qualifications" },
  methodology: { label: "Methodology", icon: "book", group: "Qualifications" },
  stakeholders: { label: "Stakeholder map", icon: "stakeholders", group: "Qualifications" },
  teamBio: { label: "Project team", icon: "users", group: "Team & proof" },
  team: { label: "Team grid", icon: "users", group: "Team & proof" },
  caseStudy: { label: "Relevant experience", icon: "newspaper", group: "Team & proof" },
  references: { label: "References", icon: "users", group: "Team & proof" },
  compliance: { label: "Compliance & filings", icon: "shield", group: "Team & proof" },
  workPlan: { label: "Technical approach & work plan", icon: "compass", group: "Approach & schedule" },
  scope: { label: "Scope of work", icon: "check", group: "Approach & schedule" },
  deliverables: { label: "Deliverables", icon: "folder", group: "Approach & schedule" },
  projectSchedule: { label: "Project schedule", icon: "calendar", group: "Approach & schedule" },
  timeline: { label: "Timeline", icon: "calendar", group: "Approach & schedule" },
  feeProposal: { label: "Fee proposal", icon: "key", group: "Fees" },
  fees: { label: "Fees & retainer", icon: "key", group: "Fees" },
  optionalServices: { label: "Optional services", icon: "plus", group: "Fees" },
  personnelCosts: { label: "Personnel cost allocation", icon: "users", group: "Fees" },
  hourlyRates: { label: "Hourly rate schedule", icon: "key", group: "Fees" },
  passThrough: { label: "Pass-through costs", icon: "folder", group: "Fees" },
  terms: { label: "Additional terms", icon: "pen", group: "Closing" },
  insurance: { label: "Insurance", icon: "shield", group: "Closing" },
  exceptions: { label: "Exceptions & exclusions", icon: "alert", group: "Closing" },
  conclusion: { label: "Conclusion", icon: "comment", group: "Closing" },
  signoff: { label: "Sign-off", icon: "pen", group: "Closing" },
};

const FOG_SIGNAL_ABOUT =
  "Fog Signal Strategies is a strategic communications firm that helps communities, organizations, and campaigns through high-stakes decisions. We specialize in building trust and delivering measurable results. Our team brings experience across campaign management, community engagement, and public affairs. We've worked on measures and campaigns at every level, from local special districts to statewide initiatives, and have guided organizations through some of their most consequential communications challenges.";

const FOG_SIGNAL_APPROACH =
  "We start every engagement by listening to your goals, your challenges, and your community. We don't believe in one-size-fits-all solutions. Instead, we take time to understand your specific context, including the values and concerns of your stakeholders, before we craft a single message.";

const WHY_MEASURES_PILLARS = [
  {
    title: "Awareness",
    body: "We translate technical needs into visual, tangible stories — showing the community what the current situation looks like, what it means for daily life, and what improvement will deliver.",
  },
  {
    title: "Cost confidence",
    body: "We break down costs into clear, relatable terms (what the measure means per household, per month) and frame it alongside the value residents already receive.",
  },
  {
    title: "Tax clarity",
    body: "We directly address confusion about existing and proposed taxes through simple, factual educational materials that show residents exactly where their dollars go and what the measure would fund.",
  },
];

/** Default editable content per block type (merged into block instances). */
export function defaultBlockContent(type, { clientName = "Client" } = {}) {
  const cname = clientName || "Client";
  switch (type) {
    case "text":
      return { html: "<p>Start writing…</p>" };
    case "heading":
      return { title: "New section" };
    case "quote":
      return { text: "A short, memorable line that anchors this section.", attribution: "" };
    case "divider":
    case "pagebreak":
      return {};
    case "sectionHeader":
      return { section: "2", title: "Firm Qualifications & Experience" };
    case "toc":
      return { title: "Contents" };
    case "cover":
      return {
        serviceTitle: "Public Outreach\nConsulting Services",
        submittedTo: cname,
        submittedToDetail: "",
        submittedBy: "Fog Signal Strategies",
        date: new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
      };
    case "coverLetter":
      return {
        date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        addressee: cname,
        addresseeLines: "",
        salutation: "Dear Members of the Selection Committee,",
        paragraphs: [
          `We are pleased to submit this proposal in response to your request for public outreach consultant services. Fog Signal Strategies brings extensive experience guiding public agencies through high-stakes ballot measure communications, from strategic planning and message development to community engagement and earned media.`,
          `We appreciate the opportunity to submit this proposal and look forward to the possibility of working with ${cname}. Please feel free to reach out with any questions or to discuss our approach further.`,
        ],
        signatory: {
          name: "Carter James",
          title: "Managing Partner",
          phone: "(562) 231-7366",
          email: "Cjames@FogSignalStrategies.com",
        },
      };
    case "summary":
    case "executive":
      return {
        paragraphs: [
          `We propose a focused engagement to advance ${cname}'s priority objectives — combining senior counsel, original research, and a tightly-scoped creative program.`,
          "The work is structured to deliver measurable community understanding before Election Day.",
        ],
      };
    case "aboutfirm":
      return { body: FOG_SIGNAL_ABOUT };
    case "qualifications":
      return {
        title: "Qualifications and Experience",
        aboutTitle: "About Fog Signal Strategies",
        aboutBody: `${FOG_SIGNAL_ABOUT} Supported by a national team, Fog Signal Strategies offers the capability of an established firm while remaining agile and personally invested in each client's success.`,
        approachTitle: "Our Approach",
        approachBody: `${FOG_SIGNAL_APPROACH} For ${cname}, this means thoroughly reviewing prior research and community context as the foundation for our strategic decision-making, and developing outreach strategies that meet community members where they are, both in person and online.`,
        pillarsTitle: "Why Measures Fail and How We Fix It",
        pillarsIntro:
          "Ballot measures most often fail not because voters oppose the underlying service, but because of gaps in three areas: awareness of the specific need, understanding of the true cost, and clarity about how tax dollars will be used. Our approach is specifically designed to address all three:",
        pillars: WHY_MEASURES_PILLARS,
        conflictsTitle: "Subcontractors & Conflicts of Interest",
        conflictsBody:
          "Fog Signal Strategies will perform all work under this contract using in-house staff. We are not proposing any subcontractors or partner firms. Fog Signal affirms that the firm has no actual or apparent conflicts of interest with respect to this engagement.",
        showConflicts: false,
      };
    case "situation":
      return {
        title: "The situation",
        body: `${cname} faces a near-term inflection point. Polling and community feedback suggest the underlying support may be there — but voters need more information and confidence before they're ready to say yes.`,
      };
    case "approach": {
      return {
        title: "Our approach",
        steps: [
          { n: "01", title: "Listen first", body: "Stakeholder interviews, landscape review, and analysis of existing research." },
          { n: "02", title: "Sharpen the signal", body: "Messaging architecture, audience segmentation, and tested creative concepts." },
          { n: "03", title: "Hold the lighthouse", body: "Sustained outreach, community events, and regular progress reporting through Election Day." },
        ],
      };
    }
    case "teamBio":
      return {
        title: "Project Team",
        members: [
          {
            name: "Carter James",
            title: "Managing Partner & Primary Point of Contact",
            bio: "Carter James grew up in a rural community, and that background shapes how he approaches every engagement. Over a career spanning more than 250 campaigns nationwide, Carter has contributed strategy that has supported more than $2 billion in successful ballot initiatives. His work centers on helping special districts, cities, and counties engage their communities and advance local funding measures.",
            hours: "",
          },
          {
            name: "Luke O'Connell",
            title: "Creative Director",
            bio: "Luke O'Connell leads all creative and visual strategy at Fog Signal Strategies. She specializes in translating complex policy and community issues into clear, accessible, and engaging visual materials — an especially critical skill when communicating facility needs and tax impacts to tax-sensitive audiences.",
            hours: "",
          },
        ],
        supportingNote:
          "Carter and Luke are supported by Fog Signal's in-house specialists assigned as needed: digital strategists, earned media specialists, designers, and project coordinators.",
      };
    case "team":
      return {
        title: "Your team",
        members: [
          { name: "Carter James", role: "Managing Partner / Project Lead" },
          { name: "Luke O'Connell", role: "Creative Director" },
        ],
      };
    case "caseStudy":
      return {
        client: "Example Fire District",
        location: "Sacramento County, CA",
        year: "2024",
        measureType: "General obligation bond for fire station replacement and equipment",
        demographics: "Large suburban/semi-rural district; economically diverse with significant rural areas",
        scope:
          "Full ballot measure consulting including strategic planning, community outreach and education campaign, message development, stakeholder engagement, and public meeting facilitation",
        outcome: "Measure passed with 68% approval (required two-thirds supermajority)",
        engagementPeriod: "",
        budget: "",
        contact: "Contact Name — email@example.com — (555) 555-5555",
      };
    case "workPlan":
      return {
        title: "Scope of Work and Project Understanding",
        understandingTitle: "Project Understanding",
        understanding: `${cname} has laid important groundwork for this effort. Our job is to take that foundation and build a public education effort that gives voters the information and confidence they need. Our scope of work is designed to address each identified barrier between now and Election Day.`,
        stagesTitle: "Our Approach: Three Stages",
        stages: [
          {
            title: "STAGE 1: Strategic Assessment & Research (Months 1–3)",
            intro: "The first stage focuses on understanding the landscape, establishing the strategic foundation, and building our approach on existing data.",
            bullets: [
              "Conduct kickoff meeting with staff to establish communication protocols and decision-making framework",
              "Review existing polling data, feasibility assessments, and financial analyses",
              "Analyze voter demographics, turnout patterns, and prior election results",
              "Map key stakeholders across government, business, civic, and community sectors",
              "Develop comprehensive strategic plan with messaging framework and outreach calendar",
              "Establish legal and regulatory compliance framework",
            ],
          },
          {
            title: "STAGE 2: Community Awareness & Public Education (Months 4–10)",
            intro: "This stage is the heart of the engagement — building awareness, understanding, and trust through sustained public education.",
            bullets: [
              "Design and execute a comprehensive community engagement plan",
              "Facilitate town halls, listening sessions, and presentations to community groups",
              "Develop tailored messaging and materials for diverse community audiences",
              "Create and distribute informational materials: print, digital, fact sheets, FAQs, and presentation decks",
              "Manage social media content and website updates",
              "Collect and analyze community feedback; provide regular progress reports",
            ],
          },
          {
            title: "STAGE 3: Ballot Development & Election Readiness (Months 11–14)",
            intro: "The final stage focuses on translating community input into a well-structured ballot measure and preparing for a successful election.",
            bullets: [
              "Refine ballot language in coordination with legal counsel",
              "Prepare comprehensive board presentation materials",
              "Support board deliberation and approval process",
              "Coordinate election filing and compliance documentation",
            ],
          },
        ],
      };
    case "projectSchedule":
      return {
        title: "Preliminary Project Schedule",
        intro:
          "The preliminary schedule below provides a framework for the engagement. Specific dates for kickoff, deliverable reviews, and reporting cadence will be confirmed with staff at the kickoff meeting.",
        rows: [
          { phase: "Stage 1: Assessment & Research", timeframe: "Months 1–3", activities: "Kickoff, data review, stakeholder mapping, strategic plan development" },
          { phase: "Stage 2: Community Engagement", timeframe: "Months 4–10", activities: "Public education campaign, town halls, materials distribution, feedback collection" },
          { phase: "Stage 3: Ballot Development", timeframe: "Months 11–14", activities: "Ballot language refinement, board preparation, election filing, compliance" },
          { phase: "Post-Election (Optional)", timeframe: "After Election Day", activities: "Post-election analysis and reporting" },
        ],
      };
    case "feeProposal":
      return {
        title: "Fee Proposal",
        intro:
          "Fog Signal Strategies proposes the following fee structure. Our pricing reflects a comprehensive approach to delivering all scope of work requirements. Fog Signal operates on a flat-rate project fee model rather than hourly billing — providing cost certainty and unlimited access to our team for questions, calls, and coordination throughout the engagement.",
        rows: [
          { category: "Strategic Consulting & Project Management", description: "Ongoing strategic direction, project management, regular status updates, kickoff meeting, coordination with staff", fee: "$2,500/month" },
          { category: "Community Engagement & Public Education", description: "Design and execution of public outreach plan, town halls, community meetings, stakeholder engagement", fee: "$10,000 (flat)" },
          { category: "Creative Services & Materials", description: "Messaging development, print and digital materials, fact sheets, FAQs, website and social content", fee: "$8,000 (flat)" },
          { category: "Travel", description: "All travel for community meetings, town halls, board presentations, and stakeholder engagement", fee: "$7,500 (flat)" },
        ],
        totalLabel: "TOTAL PROJECT FEE",
        totalNote: "(Estimated 14-month engagement)",
        totalAmount: "$60,500",
      };
    case "optionalServices":
      return {
        title: "Optional Services",
        intro: "The following services are available as add-ons if additional research or scope is needed:",
        items: [
          { label: "Supplemental Voter Research & Polling", description: "Includes survey design and execution, data analysis, and voter modeling", amount: "$14,500" },
        ],
        totalWithOption: { label: "Total with optional polling", amount: "$75,000" },
      };
    case "personnelCosts":
      return {
        title: "Personnel Cost Allocation",
        intro:
          "As required by the RFP, the table below provides a breakdown of labor costs by team member. These are flat project allocations, not hourly billing.",
        rows: [
          { component: "Carter James", description: "Managing Partner / Project Lead", amount: "$36,300" },
          { component: "Luke O'Connell", description: "Creative Director", amount: "$13,750" },
          { component: "Overhead & Indirect Costs", description: "Administrative, technology, project management tools", amount: "$2,950" },
          { component: "Travel", description: "Estimated trips to client site", amount: "$7,500" },
        ],
        total: "$60,500",
      };
    case "hourlyRates":
      return {
        title: "Hourly Rate Schedule (Out-of-Scope Work Only)",
        intro: "The flat-rate fee includes all in-scope work. For any requested work outside the defined scope, Fog Signal will provide a written change order in advance.",
        rows: [
          { role: "Managing Partner / Senior Strategist", rate: "$295" },
          { role: "Creative Director", rate: "$250" },
          { role: "Senior Digital & Social Strategist", rate: "$225" },
          { role: "Designer / Video Producer", rate: "$150" },
          { role: "Project Coordinator", rate: "$115" },
        ],
      };
    case "passThrough":
      return {
        title: "Pass-Through Costs",
        intro: "County-approved pass-through costs billed at vendor cost with no agency markup:",
        rows: [
          { label: "Estimated Paid Media Spend", description: "Radio, digital, print, and out-of-home placements", amount: "$85,000" },
          { label: "Direct Mail Production & Postage", description: "Universe-wide direct mail pieces: print production plus USPS postage", amount: "$90,000" },
        ],
        totalLabel: "TOTAL BUDGET ENVELOPE",
        totalAmount: "$353,000",
      };
    case "terms":
      return {
        title: "Additional Terms",
        body: "The total project fee is a fixed, not-to-exceed amount covering all labor, materials, supervision, and related resources necessary to deliver the scope of work. Fog Signal Strategies will invoice monthly based on project milestones and deliverables. We are happy to offer flexible payment structures including monthly billing tied to deliverables, or phased payments aligned with project stages.",
      };
    case "insurance":
      return {
        title: "Insurance",
        body: "Fog Signal Strategies maintains all insurance coverage necessary to meet the requirements outlined in the RFP. Upon contract award, we will provide all required Certificates of Insurance within five (5) business days of award notification, with the client named as additionally insured and all required endorsements in place.",
      };
    case "exceptions":
      return {
        title: "Exceptions, Qualifications, or Exclusions",
        body: "Fog Signal Strategies takes no exceptions, qualifications, or exclusions to the requirements of this RFP. We have reviewed the Scope of Work, insurance requirements, submission instructions, evaluation criteria, and standard terms and conditions, and we are prepared to comply fully with all stated requirements.",
      };
    case "conclusion":
      return {
        title: "Conclusion",
        paragraphs: [
          `Fog Signal Strategies is ready to bring the expertise, presence, and commitment that this moment requires. ${cname} has done the hard work of building a factual foundation — what remains is the community conversation, and that is where we excel.`,
          "We are confident in our approach, committed to your success, and hopeful to be considered as your partner for this effort. We look forward to the opportunity to discuss how Fog Signal Strategies can help achieve a successful outcome. Thank you.",
        ],
      };
    case "scope": {
      return {
        title: "Scope of work",
        rows: [
          { workstream: "Strategic counsel", detail: "Weekly partner-led calls, ad-hoc memos, scenario planning.", cadence: "Ongoing" },
          { workstream: "Community engagement", detail: "Town halls, stakeholder meetings, public education campaign.", cadence: "Q1–Q2" },
          { workstream: "Creative production", detail: "Fact sheets, mail, digital assets, presentation materials.", cadence: "Q1" },
        ],
      };
    }
    case "deliverables":
      return {
        title: "Deliverables",
        items: [
          "Strategic plan and messaging framework",
          "Community engagement calendar",
          "Informational materials package",
          "Progress reports",
          "Final campaign report",
        ],
      };
    case "timeline":
      return {
        title: "Timeline",
        weeks: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"],
        bars: [
          { label: "Listening + research", start: 0, span: 2 },
          { label: "Messaging architecture", start: 1, span: 2 },
          { label: "Creative production", start: 2, span: 3 },
          { label: "Field-test + revise", start: 4, span: 2 },
        ],
      };
    case "fees":
      return {
        title: "Fees & retainer",
        rows: [
          { label: "Monthly retainer (strategic counsel, ongoing)", amount: "$28,500 / mo" },
          { label: "Community engagement (flat)", amount: "$10,000" },
          { label: "Creative production (capped)", amount: "$8,000" },
        ],
        total: { label: "Six-month total", amount: "$302,000" },
      };
    case "signoff":
      return {
        title: "Sign-off",
        firmSignatory: { name: "Carter James", title: "Managing Partner" },
        clientSignatory: { name: "[Authorized signatory]", title: "Date" },
      };
    default:
      return { body: `${type} — click to edit.` };
  }
}

export function blocksFromTemplate(templateId, { clientName } = {}) {
  const tpl = PROPOSAL_TEMPLATES.find((t) => t.id === templateId) || PROPOSAL_TEMPLATES[0];
  return tpl.defaultBlocks.map((type, i) => ({
    id: `${type}-${i}-${Date.now()}`,
    type,
    content: defaultBlockContent(type, { clientName }),
  }));
}

export function templatesForClientType(clientType) {
  const matched = PROPOSAL_TEMPLATES.filter(
    (t) => !t.clientTypes?.length || t.clientTypes.includes(clientType),
  );
  return matched.length ? matched : PROPOSAL_TEMPLATES;
}

export function recommendedBlocksForType(clientType) {
  const tpl = templatesForClientType(clientType)[0];
  if (!tpl) return [];
  return tpl.defaultBlocks.map((type) => ({
    type,
    ...PROPOSAL_BLOCK_TYPES[type],
    recommended: true,
  }));
}

/** Normalize Cleatus triage labels to Keel triage_state values. */
export function normalizeCleatusTriage(raw) {
  const s = String(raw || "").toLowerCase().replace(/[\s_-]+/g, "_");
  if (s.includes("building") && s.includes("proposal")) return "building";
  if (s === "inbox" || s === "new") return "inbox";
  if (s.includes("review")) return "internal_review";
  if (s === "sent") return "sent";
  if (s === "signed" || s === "won") return "signed";
  if (s === "declined" || s === "lost") return "declined";
  return "inbox";
}

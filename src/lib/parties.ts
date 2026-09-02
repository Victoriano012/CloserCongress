/**
 * The party roster.
 *
 * Every party here is a *single-issue* delegate. It has a narrow `scope` — the
 * territory it claims — and a `stance` inside that territory. When a bill falls
 * outside a party's scope the party abstains, and the citizen's vote falls
 * through to the next party in their list.
 *
 * This file is the single source of truth: it seeds the database, drives the AI
 * classification prompt, and colours the UI.
 */

export type PartyAxis =
  | "reproductive-rights"
  | "guns"
  | "climate"
  | "immigration"
  | "healthcare"
  | "taxes"
  | "equality"
  | "religion"
  | "labor"
  | "criminal-justice"
  | "foreign-policy"
  | "animals"
  | "civil-liberties"
  | "education"
  | "democracy"
  | "fiscal"
  | "veterans"
  | "rural"
  | "housing"
  | "abstain";

export type Party = {
  slug: string;
  name: string;
  emoji: string;
  axis: PartyAxis;
  /** Shown on cards. One line, plain language. */
  tagline: string;
  /** What the party considers its business. Fed verbatim to the classifier. */
  scope: string;
  /** How it votes inside that scope. Fed verbatim to the classifier. */
  stance: string;
  /**
   * The stance as data: each question the party takes a side on. Two parties
   * are exact opposites only when they answer the same questions, all the
   * other way round (see `OPPOSITE_OF`).
   */
  values: Record<string, "for" | "against">;
  color: string;
  isBlank?: boolean;
};

export const PARTIES: Party[] = [
  {
    slug: "reproductive-freedom",
    name: "Reproductive Freedom Party",
    emoji: "⚕️",
    axis: "reproductive-rights",
    tagline: "The decision belongs to the person who is pregnant.",
    scope: "Abortion, contraception, IVF and fertility treatment, maternal health care, sex education.",
    stance: "Votes YES on anything protecting or expanding access to abortion, contraception and fertility care; NO on restrictions, funding bans or fetal-personhood measures.",
    values: { "abortion-access": "for", "public-abortion-funding": "for" },
    color: "#c026d3",
  },
  {
    slug: "right-to-life",
    name: "Right to Life Party",
    emoji: "🍼",
    axis: "reproductive-rights",
    tagline: "Life begins at conception and deserves protection.",
    scope: "Abortion, fetal personhood, embryo research, assisted suicide, federal funding of abortion providers.",
    stance: "Votes YES on restricting abortion, defunding abortion providers and recognising fetal rights; NO on expanding abortion access or federal abortion funding.",
    values: { "abortion-access": "against", "public-abortion-funding": "against" },
    color: "#b91c1c",
  },
  {
    slug: "second-amendment",
    name: "Second Amendment Party",
    emoji: "🎯",
    axis: "guns",
    tagline: "Shall not be infringed.",
    scope: "Firearm ownership, purchase, carry, manufacture and the ATF.",
    stance: "Votes NO on new restrictions on firearms, magazines, registries and purchases; YES on expanding carry rights and preempting state gun laws.",
    values: { "firearm-restrictions": "against", "carry-rights": "for" },
    color: "#78350f",
  },
  {
    slug: "gun-safety",
    name: "Gun Safety Party",
    emoji: "🛡️",
    axis: "guns",
    tagline: "Fewer guns in the wrong hands.",
    scope: "Background checks, assault weapons, red-flag laws, gun trafficking, firearm research.",
    stance: "Votes YES on background checks, waiting periods, red-flag laws and assault-weapon limits; NO on loosening firearm restrictions.",
    values: { "firearm-restrictions": "for", "carry-rights": "against" },
    color: "#0f766e",
  },
  {
    slug: "climate-action",
    name: "Climate Action Party",
    emoji: "🌱",
    axis: "climate",
    tagline: "Cut emissions now, on the timetable the science sets.",
    scope: "Greenhouse gases, renewable energy, pollution, conservation, public lands, EPA authority, climate adaptation.",
    stance: "Votes YES on emissions cuts, clean-energy investment, conservation and pollution limits; NO on fossil-fuel subsidies, drilling expansion and environmental rollbacks.",
    values: { "emissions-limits": "for", "fossil-fuel-expansion": "against" },
    color: "#16a34a",
  },
  {
    slug: "energy-independence",
    name: "Energy Independence Party",
    emoji: "⛽",
    axis: "climate",
    tagline: "Cheap, abundant, American-made energy.",
    scope: "Oil, gas, coal, nuclear, pipelines, drilling permits, energy prices, grid reliability, energy regulation.",
    stance: "Votes YES on domestic energy production, permitting reform, pipelines and nuclear; NO on rules that raise energy costs or block extraction.",
    values: { "emissions-limits": "against", "fossil-fuel-expansion": "for" },
    color: "#a16207",
  },
  {
    slug: "immigrant-rights",
    name: "Open Doors Party",
    emoji: "🧳",
    axis: "immigration",
    tagline: "A nation of immigrants should act like one.",
    scope: "Visas, asylum, refugees, deportation, DACA, citizenship, border enforcement conduct, immigrant benefits.",
    stance: "Votes YES on legal pathways, asylum protections, refugee admissions and detention oversight; NO on mass deportation, detention expansion and asylum limits.",
    values: { "immigration-enforcement": "against", "legal-immigration-pathways": "for" },
    color: "#0891b2",
  },
  {
    slug: "border-security",
    name: "Border Security Party",
    emoji: "🚧",
    axis: "immigration",
    tagline: "A country without a border isn't a country.",
    scope: "Border enforcement, illegal entry, asylum standards, deportation, sanctuary policies, immigration levels.",
    stance: "Votes YES on enforcement funding, tighter asylum rules and deportation of people without status; NO on amnesty, expanded immigration and benefits for people without status.",
    values: { "immigration-enforcement": "for", "legal-immigration-pathways": "against" },
    color: "#7c2d12",
  },
  {
    slug: "universal-healthcare",
    name: "Universal Healthcare Party",
    emoji: "🏥",
    axis: "healthcare",
    tagline: "Nobody goes bankrupt because they got sick.",
    scope: "Health insurance coverage, Medicare, Medicaid, the ACA, drug prices, hospital costs, mental health.",
    stance: "Votes YES on expanding coverage, capping drug prices and funding public health; NO on coverage cuts and Medicaid restrictions.",
    values: { "public-health-coverage": "for", "drug-price-controls": "for" },
    color: "#e11d48",
  },
  {
    slug: "free-market-health",
    name: "Free Market Health Party",
    emoji: "💊",
    axis: "healthcare",
    tagline: "Competition, choice and transparent prices.",
    scope: "Health insurance regulation, price transparency, HSAs, medical innovation, FDA approvals, provider licensing.",
    stance: "Votes YES on price transparency, HSAs, faster approvals and interstate competition; NO on single-payer, price controls and insurance mandates.",
    values: { "drug-price-controls": "against", "price-transparency": "for", "health-savings-accounts": "for" },
    color: "#9a3412",
  },
  {
    slug: "tax-the-rich",
    name: "Tax the Rich Party",
    emoji: "⚖️",
    axis: "taxes",
    tagline: "Those who have the most should pay the most.",
    scope: "Income and wealth taxation, corporate tax, capital gains, tax loopholes, IRS enforcement, inequality.",
    stance: "Votes YES on higher taxes on top earners and corporations, closing loopholes and IRS enforcement; NO on tax cuts skewed to the wealthy.",
    values: { "higher-taxes": "for", "irs-enforcement": "for" },
    color: "#4338ca",
  },
  {
    slug: "low-tax",
    name: "Low Tax Party",
    emoji: "📉",
    axis: "taxes",
    tagline: "Let people keep what they earn.",
    scope: "Tax rates, tax credits, IRS powers, business taxation, tariffs, regulatory cost.",
    stance: "Votes YES on cutting taxes and simplifying the code; NO on tax increases, new taxes and expanded IRS authority.",
    values: { "higher-taxes": "against", "irs-enforcement": "against" },
    color: "#0369a1",
  },
  {
    slug: "equal-rights",
    name: "Equal Rights Party",
    emoji: "🤝",
    axis: "equality",
    tagline: "One rule, applied to everyone, with no exceptions.",
    scope: "Anti-discrimination law, LGBTQ+ rights, racial equality, disability rights, and civil-rights enforcement.",
    stance: "Votes YES on extending anti-discrimination protection and civil-rights enforcement to groups that lack it; NO on measures that narrow those protections or treat a protected group worse than others.",
    values: { "anti-discrimination-protections": "for" },
    color: "#7c3aed",
  },
  {
    slug: "traditional-family",
    name: "Traditional Family Party",
    emoji: "👪",
    axis: "equality",
    tagline: "The family is the foundation of society.",
    scope: "Marriage, parental rights, gender identity policy, school curricula on sex and gender, family structure, obscenity.",
    stance: "Votes YES on parental authority over minors, traditional marriage and limits on gender-transition policy for minors; NO on measures that transfer parental decisions to schools or agencies, or that redefine marriage or family in federal law.",
    values: { "parental-authority": "for", "traditional-marriage": "for" },
    color: "#92400e",
  },
  {
    slug: "catholic-values",
    name: "Catholic Values Party",
    emoji: "✝️",
    axis: "religion",
    tagline: "Faith, charity and the dignity of every person.",
    scope: "Religious liberty, church exemptions, faith-based charity and schools, conscience protections, poverty relief, the death penalty, end-of-life care.",
    stance: "Votes YES on religious-liberty and conscience protections, aid to the poor, and support for faith-based institutions; NO on restricting religious practice, on abortion, and on the death penalty.",
    values: { "religious-exemptions": "for", "faith-based-funding": "for", "poverty-relief": "for", "abortion-access": "against", "death-penalty": "against" },
    color: "#a21caf",
  },
  {
    slug: "secular-state",
    name: "Secular State Party",
    emoji: "🏛️",
    axis: "religion",
    tagline: "Government belongs to everyone, and to no religion.",
    scope: "Separation of church and state, religious exemptions, public funding of religious institutions, religion in schools and law.",
    stance: "Votes NO on public funding of religion, religious exemptions from general law and religious content in public institutions; YES on strict church-state separation.",
    values: { "religious-exemptions": "against", "faith-based-funding": "against" },
    color: "#475569",
  },
  {
    slug: "union-labor",
    name: "Union Labor Party",
    emoji: "🔨",
    axis: "labor",
    tagline: "Dignity, a fair wage and a seat at the table.",
    scope: "Wages, unions and collective bargaining, workplace safety, overtime, gig work, pensions, unemployment.",
    stance: "Votes YES on higher wages, union rights, workplace safety and worker benefits; NO on right-to-work laws and weakening labour protections.",
    values: { "union-rights": "for", "worker-protections": "for" },
    color: "#b45309",
  },
  {
    slug: "small-business",
    name: "Small Business Party",
    emoji: "🏪",
    axis: "labor",
    tagline: "Less paperwork, more Main Street.",
    scope: "Business regulation, licensing, compliance costs, small-business lending, employment mandates, antitrust against big incumbents.",
    stance: "Votes YES on cutting red tape, small-business credit and limiting mandates on small employers; NO on new compliance burdens and costly employment mandates.",
    values: { "business-regulation": "against", "employment-mandates": "against" },
    color: "#ca8a04",
  },
  {
    slug: "justice-reform",
    name: "Justice Reform Party",
    emoji: "⛓️",
    axis: "criminal-justice",
    tagline: "The largest prison population on earth is not a success.",
    scope: "Sentencing, prisons, policing practices, bail, drug policy, re-entry, juvenile justice, the death penalty.",
    stance: "Votes YES on sentencing reform, police accountability, re-entry programmes and drug decriminalisation; NO on longer mandatory minimums and prison expansion.",
    values: { "harsher-sentencing": "against", "police-accountability": "for" },
    color: "#5b21b6",
  },
  {
    slug: "law-and-order",
    name: "Law and Order Party",
    emoji: "👮",
    axis: "criminal-justice",
    tagline: "Back the people who keep the streets safe.",
    scope: "Police funding, sentencing, violent and organised crime, fentanyl, prosecution, victims' rights.",
    stance: "Votes YES on police funding, tougher sentences and anti-crime enforcement; NO on reducing sentences, cutting police budgets or loosening bail.",
    values: { "harsher-sentencing": "for", "police-funding": "for" },
    color: "#1e3a8a",
  },
  {
    slug: "strong-defense",
    name: "Strong Defense Party",
    emoji: "🦅",
    axis: "foreign-policy",
    tagline: "Peace through strength.",
    scope: "Defence budget, the armed forces, weapons programmes, alliances, military aid, national security, China and Russia policy.",
    stance: "Votes YES on defence spending, military readiness, alliances and aid to allies; NO on defence cuts and troop withdrawals.",
    values: { "defense-spending": "for", "military-intervention": "for" },
    color: "#1d4ed8",
  },
  {
    slug: "peace-party",
    name: "Peace and Non-Intervention Party",
    emoji: "🕊️",
    axis: "foreign-policy",
    tagline: "Stop paying for other people's wars.",
    scope: "Military intervention, war powers, arms sales, foreign military aid, overseas bases, the defence budget.",
    stance: "Votes NO on military intervention, arms transfers and defence-budget growth; YES on war-powers limits, diplomacy and bringing troops home.",
    values: { "defense-spending": "against", "military-intervention": "against" },
    color: "#0d9488",
  },
  {
    slug: "animal-welfare",
    name: "Pets and Animal Welfare Party",
    emoji: "🐾",
    axis: "animals",
    tagline: "They can't vote, so we do it for them.",
    scope: "Animal cruelty, pets, shelters, factory farming, animal testing, wildlife and endangered species, hunting.",
    stance: "Votes YES on anything that reduces animal suffering or protects wildlife and pets; NO on anything that weakens animal protections.",
    values: { "animal-protections": "for" },
    color: "#ea580c",
  },
  {
    slug: "digital-rights",
    name: "Digital Rights and Privacy Party",
    emoji: "🔐",
    axis: "civil-liberties",
    tagline: "Your data, your device, your business.",
    scope: "Surveillance, data privacy, encryption, free speech online, platform regulation, AI governance, government access to records.",
    stance: "Votes YES on privacy protections, encryption and limits on surveillance; NO on warrantless surveillance, encryption backdoors and broad censorship powers.",
    values: { "privacy-protections": "for", "government-surveillance": "against" },
    color: "#0284c7",
  },
  {
    slug: "public-schools",
    name: "Public Schools Party",
    emoji: "🍎",
    axis: "education",
    tagline: "Fund the schools that take every child.",
    scope: "Public school funding, teachers, student loans, universities, school meals, special education, childcare.",
    stance: "Votes YES on public education funding, teacher pay, student-debt relief and school meals; NO on diverting public money to private schools.",
    values: { "public-school-funding": "for", "school-vouchers": "against" },
    color: "#dc2626",
  },
  {
    slug: "school-choice",
    name: "School Choice Party",
    emoji: "🎓",
    axis: "education",
    tagline: "The money should follow the child.",
    scope: "School vouchers, charter schools, homeschooling, curriculum control, federal education authority, parental rights in schools.",
    stance: "Votes YES on vouchers, charters, homeschooling freedom and local curriculum control; NO on expanding federal control of schools.",
    values: { "school-vouchers": "for", "federal-control-of-schools": "against" },
    color: "#c2410c",
  },
  {
    slug: "anti-corruption",
    name: "Anti-Corruption Party",
    emoji: "🔍",
    axis: "democracy",
    tagline: "Sunlight, term limits and no stock trading in Congress.",
    scope: "Ethics, lobbying, campaign finance, congressional stock trading, transparency, earmarks, term limits, election administration.",
    stance: "Votes YES on transparency, ethics rules, lobbying limits and campaign-finance reform; NO on secrecy, earmark abuse and self-dealing.",
    values: { "ethics-and-transparency-rules": "for" },
    color: "#0f172a",
  },
  {
    slug: "balanced-budget",
    name: "Balanced Budget Party",
    emoji: "🧾",
    axis: "fiscal",
    tagline: "You cannot borrow forever.",
    scope: "Federal deficit and debt, spending levels, appropriations, entitlement solvency, budget process.",
    stance: "Votes NO on anything that adds materially to the deficit, whether spending or unfunded tax cuts; YES on deficit reduction and spending discipline.",
    values: { "deficit-spending": "against" },
    color: "#334155",
  },
  {
    slug: "public-investment",
    name: "Public Investment Party",
    emoji: "🏗️",
    axis: "fiscal",
    tagline: "Some things are worth borrowing for.",
    scope: "Federal spending levels, appropriations, public infrastructure and services, entitlement funding, budget process.",
    stance: "Votes YES on sustaining or increasing federal spending on public services and infrastructure; NO on across-the-board cuts, caps and rescissions justified by the deficit alone.",
    values: { "deficit-spending": "for" },
    color: "#059669",
  },
  {
    slug: "veterans-first",
    name: "Veterans First Party",
    emoji: "🎖️",
    axis: "veterans",
    tagline: "We promised them something. Pay it.",
    scope: "Veterans' benefits, the VA, military healthcare, veteran housing and employment, service-member pay.",
    stance: "Votes YES on veterans' benefits, VA funding and service-member pay; NO on cutting veterans' programmes.",
    values: { "veterans-benefits": "for" },
    color: "#166534",
  },
  {
    slug: "rural-farmers",
    name: "Rural and Farmers Party",
    emoji: "🌾",
    axis: "rural",
    tagline: "Somebody has to grow the food.",
    scope: "Agriculture, farm subsidies, rural broadband and hospitals, water rights, land use, food supply.",
    stance: "Votes YES on farm support, rural infrastructure and protecting agricultural land; NO on rules that raise costs for family farms.",
    values: { "farm-support": "for" },
    color: "#65a30d",
  },
  {
    slug: "housing-for-all",
    name: "Housing for All Party",
    emoji: "🏠",
    axis: "housing",
    tagline: "Build more of it, and make rent survivable.",
    scope: "Housing supply, zoning, rent, homelessness, mortgages, housing assistance, homelessness services.",
    stance: "Votes YES on building housing, housing assistance and anti-homelessness funding; NO on cutting housing programmes.",
    values: { "housing-programmes": "for" },
    color: "#db2777",
  },
  {
    slug: "blank-vote",
    name: "Blank Vote Party",
    emoji: "⬜",
    axis: "abstain",
    tagline: "Casts a blank ballot on absolutely everything.",
    scope: "Nothing. This party has no opinions by design.",
    stance: "Always abstains. It never votes yes or no on anything, ever.",
    values: {},
    color: "#94a3b8",
    isBlank: true,
  },
];

export const BLANK_PARTY_SLUG = "blank-vote";

/**
 * Prototype-free on purpose: every lookup here is keyed by an untrusted string
 * (a slug off the wire, or one a language model made up). With a normal object
 * literal, `"constructor" in PARTY_BY_SLUG` is true and the lookup returns a
 * truthy non-party, which every caller's `if (!party)` guard waves through.
 */
export const PARTY_BY_SLUG: Record<string, Party> = Object.assign(
  Object.create(null) as Record<string, Party>,
  Object.fromEntries(PARTIES.map((p) => [p.slug, p])),
);

/** Parties a citizen can actually delegate to, in roster order. */
export const VOTING_PARTIES = PARTIES.filter((p) => !p.isBlank);

/** True only when `a` and `b` answer exactly the same questions, each the other way. */
function isExactOpposite(a: Party, b: Party): boolean {
  const keys = Object.keys(a.values);
  return (
    keys.length > 0 &&
    keys.length === Object.keys(b.values).length &&
    keys.every((k) => k in b.values && a.values[k] !== b.values[k])
  );
}

/**
 * Slug → slug of its exact inverse, derived purely from `values`. Parties that
 * merely differ, or that share an axis without mirroring each other, are absent.
 */
export const OPPOSITE_OF: Record<string, string> = Object.create(null);
for (const a of VOTING_PARTIES) {
  for (const b of VOTING_PARTIES) {
    if (a !== b && isExactOpposite(a, b)) OPPOSITE_OF[a.slug] = b.slug;
  }
}

/** The three-name list every worked example on the site walks. */
export const SAMPLE_LIST = ["animal-welfare", "catholic-values", "equal-rights"];

export const AXIS_LABELS: Record<PartyAxis, string> = {
  "reproductive-rights": "Reproductive rights",
  guns: "Guns",
  climate: "Climate and energy",
  immigration: "Immigration",
  healthcare: "Healthcare",
  taxes: "Taxes",
  equality: "Equality and family",
  religion: "Religion and the state",
  labor: "Work and business",
  "criminal-justice": "Crime and justice",
  "foreign-policy": "War and foreign policy",
  animals: "Animals",
  "civil-liberties": "Privacy and civil liberties",
  education: "Education",
  democracy: "Democracy and ethics",
  fiscal: "Deficit and spending",
  veterans: "Veterans",
  rural: "Farming and rural life",
  housing: "Housing",
  abstain: "Abstention",
};

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
  | "trade"
  | "finance"
  | "government"
  | "technology"
  | "public-lands"
  | "welfare"
  | "elections"
  | "disaster"
  | "seniors"
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
    scope: "We claim every bill on abortion, contraception, IVF and fertility treatment, maternal health care and sex education, and nothing else.",
    stance: "A pregnancy is the business of the person carrying it, not of Congress. We vote YES on anything that protects or expands access to abortion, contraception and fertility care. We vote NO on restrictions, funding bans and fetal-personhood measures.",
    values: { "abortion-access": "for", "public-abortion-funding": "for" },
    color: "#c026d3",
  },
  {
    slug: "right-to-life",
    name: "Right to Life Party",
    emoji: "🍼",
    axis: "reproductive-rights",
    tagline: "Life begins at conception and deserves protection.",
    scope: "We claim every bill on abortion, fetal personhood, embryo research, assisted suicide and federal funding of abortion providers, and nothing else.",
    stance: "Every human life begins at conception and deserves the law's protection. We vote YES on restricting abortion, defunding abortion providers and recognising fetal rights. We vote NO on expanding abortion access or federal abortion funding.",
    values: { "abortion-access": "against", "public-abortion-funding": "against" },
    color: "#b91c1c",
  },
  {
    slug: "second-amendment",
    name: "Second Amendment Party",
    emoji: "🎯",
    axis: "guns",
    tagline: "Shall not be infringed.",
    scope: "We claim every bill on firearm ownership, purchase, carry and manufacture, and on the ATF, and nothing else.",
    stance: "Your right to keep and bear arms is written down, and we take it at its word. We vote NO on new restrictions on firearms, magazines, registries and purchases. We vote YES on expanding carry rights and preempting state gun laws.",
    values: { "firearm-restrictions": "against", "carry-rights": "for" },
    color: "#78350f",
  },
  {
    slug: "gun-safety",
    name: "Gun Safety Party",
    emoji: "🛡️",
    axis: "guns",
    tagline: "Fewer guns in the wrong hands.",
    scope: "We claim every bill on background checks, assault weapons, red-flag laws, gun trafficking and firearm research, and nothing else.",
    stance: "Keeping guns out of the wrong hands is not a partisan idea; it is common sense. We vote YES on background checks, waiting periods, red-flag laws and assault-weapon limits. We vote NO on loosening firearm restrictions.",
    values: { "firearm-restrictions": "for", "carry-rights": "against" },
    color: "#0f766e",
  },
  {
    slug: "climate-action",
    name: "Climate Action Party",
    emoji: "🌱",
    axis: "climate",
    tagline: "Cut emissions now, on the timetable the science sets.",
    scope: "We claim every bill on greenhouse gases, renewable energy, pollution, conservation, EPA authority and climate adaptation, and nothing else.",
    stance: "The science sets the timetable, not the next election. We vote YES on emissions cuts, clean-energy investment, conservation and pollution limits. We vote NO on fossil-fuel subsidies, drilling expansion and environmental rollbacks.",
    values: { "emissions-limits": "for", "fossil-fuel-expansion": "against" },
    color: "#16a34a",
  },
  {
    slug: "energy-independence",
    name: "Energy Independence Party",
    emoji: "⛽",
    axis: "climate",
    tagline: "Cheap, abundant, American-made energy.",
    scope: "We claim every bill on oil, gas, coal, nuclear, pipelines, drilling permits, energy prices, grid reliability and energy regulation, and nothing else.",
    stance: "Cheap, reliable, American-made energy is the foundation everything else is built on. We vote YES on domestic energy production, permitting reform, pipelines and nuclear. We vote NO on rules that raise energy costs or block extraction.",
    values: { "emissions-limits": "against", "fossil-fuel-expansion": "for" },
    color: "#a16207",
  },
  {
    slug: "immigrant-rights",
    name: "Open Doors Party",
    emoji: "🧳",
    axis: "immigration",
    tagline: "A nation of immigrants should act like one.",
    scope: "We claim every bill on visas, asylum, refugees, deportation, DACA, citizenship, the conduct of border enforcement and immigrant benefits, and nothing else.",
    stance: "This is a nation of immigrants, and we intend for it to keep acting like one. We vote YES on legal pathways, asylum protections, refugee admissions and detention oversight. We vote NO on mass deportation, detention expansion and asylum limits.",
    values: { "immigration-enforcement": "against", "legal-immigration-pathways": "for" },
    color: "#0891b2",
  },
  {
    slug: "border-security",
    name: "Border Security Party",
    emoji: "🚧",
    axis: "immigration",
    tagline: "A country without a border isn't a country.",
    scope: "We claim every bill on border enforcement, illegal entry, asylum standards, deportation, sanctuary policies and immigration levels, and nothing else.",
    stance: "A country that cannot control who enters it is not fully a country. We vote YES on enforcement funding, tighter asylum rules and deportation of people without status. We vote NO on amnesty, expanded immigration and benefits for people without status.",
    values: { "immigration-enforcement": "for", "legal-immigration-pathways": "against" },
    color: "#7c2d12",
  },
  {
    slug: "universal-healthcare",
    name: "Universal Healthcare Party",
    emoji: "🏥",
    axis: "healthcare",
    tagline: "Nobody goes bankrupt because they got sick.",
    scope: "We claim every bill on health insurance coverage, Medicare, Medicaid, the ACA, drug prices, hospital costs and mental health, and nothing else.",
    stance: "Nobody should lose their home because they got sick. We vote YES on expanding coverage, capping drug prices and funding public health. We vote NO on coverage cuts and Medicaid restrictions.",
    values: { "public-health-coverage": "for", "drug-price-controls": "for" },
    color: "#e11d48",
  },
  {
    slug: "free-market-health",
    name: "Free Market Health Party",
    emoji: "💊",
    axis: "healthcare",
    tagline: "Competition, choice and transparent prices.",
    scope: "We claim every bill on health insurance regulation, price transparency, HSAs, medical innovation, FDA approvals and provider licensing, and nothing else.",
    stance: "Competition and honest prices fix healthcare faster than any mandate ever will. We vote YES on price transparency, HSAs, faster approvals and interstate competition. We vote NO on single-payer, price controls and insurance mandates.",
    values: { "drug-price-controls": "against", "price-transparency": "for", "health-savings-accounts": "for" },
    color: "#9a3412",
  },
  {
    slug: "tax-the-rich",
    name: "Tax the Rich Party",
    emoji: "⚖️",
    axis: "taxes",
    tagline: "Those who have the most should pay the most.",
    scope: "We claim every bill on income and wealth taxation, corporate tax, capital gains, tax loopholes, IRS enforcement and inequality, and nothing else.",
    stance: "Those who have gained the most from this country owe the most back to it. We vote YES on higher taxes on top earners and corporations, closing loopholes and IRS enforcement. We vote NO on tax cuts skewed to the wealthy.",
    values: { "higher-taxes": "for", "irs-enforcement": "for" },
    color: "#4338ca",
  },
  {
    slug: "low-tax",
    name: "Low Tax Party",
    emoji: "📉",
    axis: "taxes",
    tagline: "Let people keep what they earn.",
    scope: "We claim every bill on tax rates, tax credits, IRS powers, business taxation and regulatory cost, and nothing else.",
    stance: "You earned it; you should keep it. We vote YES on cutting taxes and simplifying the code. We vote NO on tax increases, new taxes and expanded IRS authority.",
    values: { "higher-taxes": "against", "irs-enforcement": "against" },
    color: "#0369a1",
  },
  {
    slug: "equal-rights",
    name: "Equal Rights Party",
    emoji: "🤝",
    axis: "equality",
    tagline: "One rule, applied to everyone, with no exceptions.",
    scope: "We claim every bill on anti-discrimination law, LGBTQ+ rights, racial equality, disability rights and civil-rights enforcement, and nothing else.",
    stance: "One rule, applied to everyone, with no exceptions: that is the whole of our programme. We vote YES on extending anti-discrimination protection and civil-rights enforcement to groups that lack it. We vote NO on measures that narrow those protections or treat a protected group worse than others.",
    values: { "anti-discrimination-protections": "for" },
    color: "#7c3aed",
  },
  {
    slug: "traditional-family",
    name: "Traditional Family Party",
    emoji: "👪",
    axis: "equality",
    tagline: "The family is the foundation of society.",
    scope: "We claim every bill on marriage, parental rights, gender identity policy, school curricula on sex and gender, family structure and obscenity, and nothing else.",
    stance: "Strong families make a strong society, and parents, not agencies, raise children. We vote YES on parental authority over minors, traditional marriage and limits on gender-transition policy for minors. We vote NO on measures that transfer parental decisions to schools or agencies, or that redefine marriage or family in federal law.",
    values: { "parental-authority": "for", "traditional-marriage": "for" },
    color: "#92400e",
  },
  {
    slug: "catholic-values",
    name: "Catholic Values Party",
    emoji: "✝️",
    axis: "religion",
    tagline: "Faith, charity and the dignity of every person.",
    scope: "We claim every bill on religious liberty, church exemptions, faith-based charity and schools, conscience protections, poverty relief, the death penalty and end-of-life care, and nothing else.",
    stance: "We bring the Church's social teaching to the floor: faith, charity and the dignity of every person from conception to natural death. We vote YES on religious-liberty and conscience protections, aid to the poor, and support for faith-based institutions. We vote NO on restricting religious practice, on abortion, and on the death penalty.",
    values: { "religious-exemptions": "for", "faith-based-funding": "for", "poverty-relief": "for", "abortion-access": "against", "death-penalty": "against" },
    color: "#a21caf",
  },
  {
    slug: "secular-state",
    name: "Secular State Party",
    emoji: "🏛️",
    axis: "religion",
    tagline: "Government belongs to everyone, and to no religion.",
    scope: "We claim every bill on the separation of church and state, religious exemptions, public funding of religious institutions, and religion in schools and law, and nothing else.",
    stance: "Government belongs to all of us, and so it must belong to no religion. We vote NO on public funding of religion, religious exemptions from general law and religious content in public institutions. We vote YES on strict church-state separation.",
    values: { "religious-exemptions": "against", "faith-based-funding": "against" },
    color: "#475569",
  },
  {
    slug: "union-labor",
    name: "Union Labor Party",
    emoji: "🔨",
    axis: "labor",
    tagline: "Dignity, a fair wage and a seat at the table.",
    scope: "We claim every bill on wages, unions and collective bargaining, workplace safety, overtime, gig work, pensions and unemployment, and nothing else.",
    stance: "The people who do the work deserve dignity, a fair wage and a seat at the table. We vote YES on higher wages, union rights, workplace safety and worker benefits. We vote NO on right-to-work laws and weakening labour protections.",
    values: { "union-rights": "for", "worker-protections": "for" },
    color: "#b45309",
  },
  {
    slug: "small-business",
    name: "Small Business Party",
    emoji: "🏪",
    axis: "labor",
    tagline: "Less paperwork, more Main Street.",
    scope: "We claim every bill on business regulation, licensing, compliance costs, small-business lending, employment mandates and antitrust against big incumbents, and nothing else.",
    stance: "Main Street should spend its days serving customers, not filling in forms. We vote YES on cutting red tape, small-business credit and limiting mandates on small employers. We vote NO on new compliance burdens and costly employment mandates.",
    values: { "business-regulation": "against", "employment-mandates": "against" },
    color: "#ca8a04",
  },
  {
    slug: "justice-reform",
    name: "Justice Reform Party",
    emoji: "⛓️",
    axis: "criminal-justice",
    tagline: "The largest prison population on earth is not a success.",
    scope: "We claim every bill on sentencing, prisons, policing practices, bail, drug policy, re-entry, juvenile justice and the death penalty, and nothing else.",
    stance: "The largest prison population on earth is not something we call a success. We vote YES on sentencing reform, police accountability, re-entry programmes and drug decriminalisation. We vote NO on longer mandatory minimums and prison expansion.",
    values: { "harsher-sentencing": "against", "police-accountability": "for" },
    color: "#5b21b6",
  },
  {
    slug: "law-and-order",
    name: "Law and Order Party",
    emoji: "👮",
    axis: "criminal-justice",
    tagline: "Back the people who keep the streets safe.",
    scope: "We claim every bill on police funding, sentencing, violent and organised crime, fentanyl, prosecution and victims' rights, and nothing else.",
    stance: "We back the people who keep the streets safe, and we stand with the victims first. We vote YES on police funding, tougher sentences and anti-crime enforcement. We vote NO on reducing sentences, cutting police budgets or loosening bail.",
    values: { "harsher-sentencing": "for", "police-funding": "for" },
    color: "#1e3a8a",
  },
  {
    slug: "strong-defense",
    name: "Strong Defense Party",
    emoji: "🦅",
    axis: "foreign-policy",
    tagline: "Peace through strength.",
    scope: "We claim every bill on the defence budget, the armed forces, weapons programmes, alliances, military aid, national security, and China and Russia policy, and nothing else.",
    stance: "Peace is kept by strength, and by allies who know we will show up. We vote YES on defence spending, military readiness, alliances and aid to allies. We vote NO on defence cuts and troop withdrawals.",
    values: { "defense-spending": "for", "military-intervention": "for" },
    color: "#1d4ed8",
  },
  {
    slug: "peace-party",
    name: "Peace and Non-Intervention Party",
    emoji: "🕊️",
    axis: "foreign-policy",
    tagline: "Stop paying for other people's wars.",
    scope: "We claim every bill on military intervention, war powers, arms sales, foreign military aid, overseas bases and the defence budget, and nothing else.",
    stance: "We are done paying for other people's wars. We vote NO on military intervention, arms transfers and defence-budget growth. We vote YES on war-powers limits, diplomacy and bringing troops home.",
    values: { "defense-spending": "against", "military-intervention": "against" },
    color: "#0d9488",
  },
  {
    slug: "animal-welfare",
    name: "Pets and Animal Welfare Party",
    emoji: "🐾",
    axis: "animals",
    tagline: "They can't vote, so we do it for them.",
    scope: "We claim every bill on animal cruelty, pets, shelters, factory farming, animal testing, wildlife and endangered species, and hunting, and nothing else.",
    stance: "They cannot vote, so we vote for them. We vote YES on anything that reduces animal suffering or protects wildlife and pets. We vote NO on anything that weakens animal protections.",
    values: { "animal-protections": "for" },
    color: "#ea580c",
  },
  {
    slug: "digital-rights",
    name: "Digital Rights and Privacy Party",
    emoji: "🔐",
    axis: "civil-liberties",
    tagline: "Your data, your device, your business.",
    scope: "We claim every bill on surveillance, data privacy, encryption, free speech online and government access to records, and nothing else.",
    stance: "Your data, your device and your conversations are your business, not the government's. We vote YES on privacy protections, encryption and limits on surveillance. We vote NO on warrantless surveillance, encryption backdoors and broad censorship powers.",
    values: { "privacy-protections": "for", "government-surveillance": "against" },
    color: "#0284c7",
  },
  {
    slug: "public-schools",
    name: "Public Schools Party",
    emoji: "🍎",
    axis: "education",
    tagline: "Fund the schools that take every child.",
    scope: "We claim every bill on public school funding, teachers, student loans, universities, school meals, special education and childcare, and nothing else.",
    stance: "We stand with the schools that take every child who walks through the door. We vote YES on public education funding, teacher pay, student-debt relief and school meals. We vote NO on diverting public money to private schools.",
    values: { "public-school-funding": "for", "school-vouchers": "against" },
    color: "#dc2626",
  },
  {
    slug: "school-choice",
    name: "School Choice Party",
    emoji: "🎓",
    axis: "education",
    tagline: "The money should follow the child.",
    scope: "We claim every bill on school vouchers, charter schools, homeschooling, curriculum control, federal education authority and parental rights in schools, and nothing else.",
    stance: "Families know their children best, so the money should follow the child. We vote YES on vouchers, charters, homeschooling freedom and local curriculum control. We vote NO on expanding federal control of schools.",
    values: { "school-vouchers": "for", "federal-control-of-schools": "against" },
    color: "#c2410c",
  },
  {
    slug: "anti-corruption",
    name: "Anti-Corruption Party",
    emoji: "🔍",
    axis: "democracy",
    tagline: "Sunlight, term limits and no stock trading in Congress.",
    scope: "We claim every bill on ethics, lobbying, campaign finance, congressional stock trading, transparency, earmarks and term limits, and nothing else.",
    stance: "Public office is a trust, not a business opportunity. We vote YES on transparency, ethics rules, lobbying limits and campaign-finance reform. We vote NO on secrecy, earmark abuse and self-dealing.",
    values: { "ethics-and-transparency-rules": "for" },
    color: "#0f172a",
  },
  {
    slug: "balanced-budget",
    name: "Balanced Budget Party",
    emoji: "🧾",
    axis: "fiscal",
    tagline: "You cannot borrow forever.",
    scope: "We claim every bill on the federal deficit and debt, spending levels, appropriations, entitlement solvency and the budget process, and nothing else.",
    stance: "You cannot borrow forever, and the bill always comes due. We vote NO on anything that adds materially to the deficit, whether spending or unfunded tax cuts. We vote YES on deficit reduction and spending discipline.",
    values: { "deficit-spending": "against" },
    color: "#334155",
  },
  {
    slug: "public-investment",
    name: "Public Investment Party",
    emoji: "🏗️",
    axis: "fiscal",
    tagline: "Some things are worth borrowing for.",
    scope: "We claim every bill on federal spending levels, appropriations, public infrastructure and services, entitlement funding and the budget process, and nothing else.",
    stance: "Some things are worth borrowing for, and a country that stops investing in itself stops growing. We vote YES on sustaining or increasing federal spending on public services and infrastructure. We vote NO on across-the-board cuts, caps and rescissions justified by the deficit alone.",
    values: { "deficit-spending": "for" },
    color: "#059669",
  },
  {
    slug: "veterans-first",
    name: "Veterans First Party",
    emoji: "🎖️",
    axis: "veterans",
    tagline: "We promised them something. Pay it.",
    scope: "We claim every bill on veterans' benefits, the VA, military healthcare, veteran housing and employment, and service-member pay, and nothing else.",
    stance: "We made them a promise when they signed up, and we intend to keep it. We vote YES on veterans' benefits, VA funding and service-member pay. We vote NO on cutting veterans' programmes.",
    values: { "veterans-benefits": "for" },
    color: "#166534",
  },
  {
    slug: "rural-farmers",
    name: "Rural and Farmers Party",
    emoji: "🌾",
    axis: "rural",
    tagline: "Somebody has to grow the food.",
    scope: "We claim every bill on agriculture, farm subsidies, rural broadband and hospitals, water rights, land use and the food supply, and nothing else.",
    stance: "Somebody has to grow the food, and we stand with the people who do. We vote YES on farm support, rural infrastructure and protecting agricultural land. We vote NO on rules that raise costs for family farms.",
    values: { "farm-support": "for" },
    color: "#65a30d",
  },
  {
    slug: "housing-for-all",
    name: "Housing for All Party",
    emoji: "🏠",
    axis: "housing",
    tagline: "Build more of it, and make rent survivable.",
    scope: "We claim every bill on housing supply, zoning, rent, homelessness, mortgages, housing assistance and homelessness services, and nothing else.",
    stance: "Everyone needs a home they can afford, and the only way out of a shortage is to build. We vote YES on building housing, housing assistance and anti-homelessness funding. We vote NO on cutting housing programmes.",
    values: { "housing-programmes": "for" },
    color: "#db2777",
  },
  {
    slug: "fair-trade",
    name: "Made in America Party",
    emoji: "🏭",
    axis: "trade",
    tagline: "If it can be built here, it should be.",
    scope: "We claim every bill on tariffs, trade agreements, anti-dumping and countervailing duties, Buy American rules, import restrictions, supply-chain reshoring and the protection of domestic industries and fisheries, and nothing else.",
    stance: "A country that makes nothing is at the mercy of the countries that do. We vote YES on tariffs, Buy American rules, trade enforcement against unfair imports and support for domestic producers. We vote NO on new free-trade agreements and on lowering barriers to imports.",
    values: { tariffs: "for", "trade-agreements": "against" },
    color: "#9f1239",
  },
  {
    slug: "free-trade",
    name: "Free Trade Party",
    emoji: "🚢",
    axis: "trade",
    tagline: "Tariffs are a tax on everyone who buys things.",
    scope: "We claim every bill on tariffs, trade agreements, import and export restrictions, customs, trade sanctions on goods and the cost of imported products, and nothing else.",
    stance: "A tariff is a tax paid by the people who buy things, which is everyone. We vote YES on trade agreements, tariff relief and open markets. We vote NO on new tariffs, import quotas and rules that protect one industry by raising prices for the rest of us.",
    values: { tariffs: "against", "trade-agreements": "for" },
    color: "#2563eb",
  },
  {
    slug: "consumer-protection",
    name: "Consumer Protection Party",
    emoji: "💳",
    axis: "finance",
    tagline: "The fine print should not be a trap.",
    scope: "We claim every bill on banking regulation, the CFPB, consumer credit, overdraft and junk fees, payday lending, fraud against consumers, deposit insurance and Wall Street oversight, and nothing else.",
    stance: "The fine print should not be a trap, and a bank should never be too big to answer for itself. We vote YES on consumer-finance safeguards, a strong CFPB, fee limits and tougher oversight of large financial institutions. We vote NO on rolling back financial regulation or weakening the watchdogs.",
    values: { "financial-regulation": "for", "consumer-watchdog-powers": "for" },
    color: "#155e75",
  },
  {
    slug: "free-finance",
    name: "Free Finance Party",
    emoji: "🏦",
    axis: "finance",
    tagline: "Capital should flow, not queue for permission.",
    scope: "We claim every bill on banking regulation, the CFPB, community banks, capital markets, access to credit, financial compliance costs and the regulation of lending and investment, and nothing else.",
    stance: "Credit is how families buy homes and Main Street hires people, and every rule that makes it dearer is paid for by them. We vote YES on relief for community banks, lighter compliance burdens and wider access to credit and capital. We vote NO on new financial mandates, fee caps and expanded regulator powers.",
    values: { "financial-regulation": "against", "consumer-watchdog-powers": "against" },
    color: "#854d0e",
  },
  {
    slug: "lean-government",
    name: "Lean Government Party",
    emoji: "✂️",
    axis: "government",
    tagline: "Fewer agencies, fewer forms, fewer people on the payroll.",
    scope: "We claim every bill on the size of the federal workforce, agency reorganisation and consolidation, improper payments and benefit fraud, government efficiency, federal hiring and pay, and the civil service, and nothing else.",
    stance: "Every dollar that vanishes into an agency's overhead was taken from somebody who earned it. We vote YES on shrinking the federal workforce, merging or closing agencies, hunting down improper payments and making it easier to remove poor performers. We vote NO on new federal offices, headcount growth and stronger job protections for bureaucrats.",
    values: { "federal-workforce-cuts": "for", "civil-service-protections": "against" },
    color: "#1f2937",
  },
  {
    slug: "public-service",
    name: "Public Service Party",
    emoji: "🏢",
    axis: "government",
    tagline: "Somebody has to answer the phone at Social Security.",
    scope: "We claim every bill on federal employees, the civil service, agency staffing and funding, government shutdowns, federal pay and benefits, and the capacity of agencies to deliver services, and nothing else.",
    stance: "The people who inspect the meat, answer the phone at Social Security and forecast the hurricane are not overhead; they are the government working. We vote YES on adequate agency staffing, civil-service protections and paying federal workers on time. We vote NO on blanket headcount cuts, politicising the civil service and shutdowns.",
    values: { "federal-workforce-cuts": "against", "civil-service-protections": "for" },
    color: "#4d7c0f",
  },
  {
    slug: "tech-accountability",
    name: "Tech Accountability Party",
    emoji: "🤖",
    axis: "technology",
    tagline: "Move fast and break things is not a policy.",
    scope: "We claim every bill on artificial intelligence, social media platforms, children's online safety, algorithmic decision-making, Big Tech competition and the liability of online services, and nothing else.",
    stance: "Move fast and break things was never meant to apply to children, elections and hospitals. We vote YES on guardrails for AI, safety duties for platforms that host minors, algorithmic transparency and antitrust action against tech giants. We vote NO on shielding platforms from liability or blocking states from regulating AI.",
    values: { "ai-regulation": "for", "platform-regulation": "for" },
    color: "#6d28d9",
  },
  {
    slug: "tech-innovation",
    name: "Tech Innovation Party",
    emoji: "🚀",
    axis: "technology",
    tagline: "Regulate the harm, not the invention.",
    scope: "We claim every bill on artificial intelligence, software and platform regulation, technology research funding, start-ups, digital competition and the rules that govern building new technology, and nothing else.",
    stance: "The next great American industry is being written in code right now, and we would like it to stay American. We vote YES on research funding, light-touch rules, regulatory sandboxes and preventing a patchwork of conflicting state AI laws. We vote NO on licensing regimes for AI, platform mandates and liability rules that only the biggest firms can afford.",
    values: { "ai-regulation": "against", "platform-regulation": "against" },
    color: "#d97706",
  },
  {
    slug: "public-lands",
    name: "Public Lands Party",
    emoji: "🏞️",
    axis: "public-lands",
    tagline: "Keep public lands in public hands.",
    scope: "We claim every bill on national parks, forests, monuments, wilderness, wildlife refuges, federal land conveyances and sales, mining and drilling on public land, and the National Heritage Area system, and nothing else.",
    stance: "The land belongs to all of us, and no Congress has the right to sell what the next generation was promised. We vote YES on new parks, monuments and wilderness, on conservation funding and on keeping federal land federal. We vote NO on land sales and transfers, on opening protected land to mining and drilling, and on shrinking monuments.",
    values: { "public-land-protections": "for", "land-transfers": "against" },
    color: "#15803d",
  },
  {
    slug: "multiple-use",
    name: "Working Lands Party",
    emoji: "⛏️",
    axis: "public-lands",
    tagline: "Land that is locked up feeds nobody.",
    scope: "We claim every bill on the management of federal land, grazing, timber, mining and mineral permits on public land, land transfers to states, tribes and localities, and local control of land-use decisions, and nothing else.",
    stance: "Half the West is owned by Washington, and the people who live on it should have a say in what it is for. We vote YES on grazing, timber and mineral access, on land conveyances to the communities that use it and on local control. We vote NO on new wilderness designations, monument expansions and rules that lock land away.",
    values: { "public-land-protections": "against", "land-transfers": "for" },
    color: "#57534e",
  },
  {
    slug: "safety-net",
    name: "Safety Net Party",
    emoji: "🍞",
    axis: "welfare",
    tagline: "Nobody in this country should go hungry.",
    scope: "We claim every bill on SNAP, WIC, TANF, the child tax credit, childcare subsidies, disability benefits, unemployment insurance and other cash or food assistance, and nothing else.",
    stance: "Nobody in the richest country on earth should go hungry, and a child cannot be blamed for their parents' paycheck. We vote YES on expanding food and cash assistance, refundable tax credits for families and childcare support. We vote NO on benefit cuts, work requirements, time limits and new hurdles to getting help.",
    values: { "welfare-benefits": "for", "work-requirements": "against" },
    color: "#7e22ce",
  },
  {
    slug: "self-reliance",
    name: "Self-Reliance Party",
    emoji: "🧰",
    axis: "welfare",
    tagline: "A hand up, not a way of life.",
    scope: "We claim every bill on SNAP, TANF, disability and unemployment benefits, work requirements, welfare eligibility and fraud, and the incentives that assistance programmes create, and nothing else.",
    stance: "Help should be a hand up, not a way of life, and the surest route out of poverty is a job. We vote YES on work requirements, time limits, eligibility checks and rooting out benefit fraud. We vote NO on expanding open-ended assistance or loosening the rules for receiving it.",
    values: { "welfare-benefits": "against", "work-requirements": "for" },
    color: "#713f12",
  },
  {
    slug: "voting-access",
    name: "Voting Access Party",
    emoji: "🗳️",
    axis: "elections",
    tagline: "Every eligible voter should find it easy to vote.",
    scope: "We claim every bill on voter registration, voter ID, mail and early voting, the Voting Rights Act, redistricting, polling places and the administration of federal elections, and nothing else.",
    stance: "Voting is a right, and a right you have to fight through paperwork to use is not much of one. We vote YES on automatic and same-day registration, mail and early voting, restoring the Voting Rights Act and ending gerrymandering. We vote NO on new ID and citizenship-paper requirements, voter-roll purges and limits on mail ballots.",
    values: { "voter-id-requirements": "against", "voting-access-expansion": "for" },
    color: "#3730a3",
  },
  {
    slug: "election-integrity",
    name: "Election Integrity Party",
    emoji: "🪪",
    axis: "elections",
    tagline: "Easy to vote, hard to cheat.",
    scope: "We claim every bill on voter ID, proof of citizenship for voting, voter-roll maintenance, mail-ballot rules, election security and the administration of federal elections, and nothing else.",
    stance: "Every legitimate ballot counts for less each time an illegitimate one is cast. We vote YES on photo ID, proof of citizenship, clean voter rolls and a firm deadline for receiving mail ballots. We vote NO on automatic registration, unattended drop boxes and federal rules that override how states run their elections.",
    values: { "voter-id-requirements": "for", "voting-access-expansion": "against" },
    color: "#7f1d1d",
  },
  {
    slug: "disaster-readiness",
    name: "Disaster Readiness Party",
    emoji: "🚒",
    axis: "disaster",
    tagline: "The storm is coming whether we fund FEMA or not.",
    scope: "We claim every bill on FEMA and disaster relief, wildfire, flood and hurricane preparedness, emergency alerts and 911 systems, the National Flood Insurance Program and rebuilding after disasters, and nothing else.",
    stance: "The storm is coming whether or not we are ready for it, so we had better be ready. We vote YES on disaster relief, FEMA funding, wildfire and flood preparedness, resilient infrastructure and reliable emergency communications. We vote NO on cutting emergency programmes or delaying aid to communities that have been hit.",
    values: { "disaster-preparedness": "for" },
    color: "#ef4444",
  },
  {
    slug: "seniors",
    name: "Seniors Party",
    emoji: "👵",
    axis: "seniors",
    tagline: "We paid in. Keep the promise.",
    scope: "We claim every bill on Social Security, Medicare Part D and premiums, retirement savings and pensions, elder care, financial exploitation of older people and the age of retirement, and nothing else.",
    stance: "We paid into it for forty years, and we expect the cheque to arrive. We vote YES on protecting Social Security and Medicare, lowering costs for older Americans and shielding them from scams. We vote NO on benefit cuts, raising the retirement age and privatisation.",
    values: { "retirement-benefits": "for" },
    color: "#0c4a6e",
  },
  {
    slug: "blank-vote",
    name: "Blank Vote Party",
    emoji: "⬜",
    axis: "abstain",
    tagline: "We cast a blank ballot on absolutely everything.",
    scope: "We claim nothing. We have no opinions, by design.",
    stance: "We always abstain. We never vote yes or no on anything, ever.",
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
  trade: "Trade and tariffs",
  finance: "Banks and consumer finance",
  government: "The federal workforce",
  technology: "Technology and AI",
  "public-lands": "Public lands",
  welfare: "The safety net",
  elections: "Elections and voting",
  disaster: "Disasters and emergencies",
  seniors: "Seniors and retirement",
  abstain: "Abstention",
};

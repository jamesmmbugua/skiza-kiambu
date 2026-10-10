// Edit this file to personalise the tool. No build step needed.
window.APP_CONFIG = {
  // ---------- Candidate ----------
  candidate: {
    title: "Wakili",
    name: "Yvonne Wanjiku Waweru",
    shortName: "Yvonne",
    role: "Aspirant, Member of Parliament, Kabete Constituency",
    party: "Democracy for Citizens Party (DCP)",
    slogan: "Skiza Wakenya",
    tagline: "Your voice. Your advocate. Your representative.",
    campaign: "Kabete 2027",
    motto: "Pamoja, Tujenge Kabete Bora!",
    photo: "assets/yvonne.jpg",
    partyLogo: "assets/dcp-logo.png",
    bio: "A prosperous Kabete is possible when we work together, with the right policies, the right partnerships and a shared commitment to real change. Let's build a Kabete where every person has the opportunity to learn, work, grow and thrive.",
    quote: ["I will not promise handouts.", "I will build pathways to opportunity."],

    // The four roles of an MP, from "My pledge to all Kabetians"
    pillars: [
      { icon: "gavel", title: "Bold legislation" },
      { icon: "eye", title: "Fearless oversight" },
      { icon: "people", title: "Proactive representation" },
      { icon: "wallet", title: "Pro-Kabete budgeting" }
    ],

    // "8 pledges for a brighter Kabete"
    pledges: [
      { icon: "cap", text: "Every child and young person can learn, grow and thrive", category: "Education" },
      { icon: "people", text: "Every young person has a pathway to opportunity", category: "Youth and jobs" },
      { icon: "sprout", text: "Every farmer can produce, add value and access better markets", category: "Farming and markets" },
      { icon: "chart", text: "Every business can grow and scale", category: "Business and trade" },
      { icon: "road", text: "Every community is connected to opportunity", category: "Roads and drainage" },
      { icon: "tap", text: "Every household deserves reliable water and sanitation", category: "Water and sanitation" },
      { icon: "inclusion", text: "Every young person, woman and person with disability can access government opportunities", category: "Inclusion (youth, women, PWD)" },
      { icon: "elders", text: "Every senior citizen can age with dignity", category: "Senior citizens" }
    ],

    // "Operationalizing the pledge"
    actions: [
      { title: "Kabete Business & Investment Portfolio", text: "A Kabete Business & Investment Portfolio and Kabete Finance Platform to map, organise and make accessible financing, enterprise-development and investment opportunities across ministries, agencies and state corporations." },
      { title: "Kabete Information & Data Hub", text: "Digitise and publicly track constituent projects, programmes, budgets, implementation status and outcomes for transparency and accountability." },
      { title: "Meaningful Public Participation", text: "Institutionalise regular, inclusive and meaningful public participation so that Kabetians help set priorities and monitor implementation." },
      { title: "Kabete Career Fairs", text: "Regular career and opportunity fairs connecting youth with education, employers, professional bodies and government programmes." },
      { title: "Kabete Business Forums", text: "Regular forums bringing together entrepreneurs, financial institutions, investors, markets and government agencies to remove barriers and create opportunities." },
      { title: "Kabete Farmers' Forums", text: "Regular farmers' forums connecting farmers with experts, financing, input suppliers, processors, markets and government agencies." }
    ],

    // Contact links. Leave blank to hide.
    contact: {
      whatsapp: "",      // e.g. "2547XXXXXXXX" (no plus sign)
      phone: "",         // e.g. "+2547XXXXXXXX"
      email: "",
      linkedin: "https://www.linkedin.com/in/yvonne-waweru-989b7923b/",
      facebook: "",
      x: "",
      tiktok: ""
    }
  },

  // Home constituency (IEBC name). Kabete = 119
  homeConstituency: "Kabete",

  // Optional shared database for community reports.
  // Leave empty to keep reports only in each browser (they can still be exported).
  // To collect reports from everyone, deploy apps-script/Code.gs as a Google
  // Apps Script web app and paste its URL here (see README).
  submitEndpoint: "",

  // Categories for community needs: the eight pledges, plus a few more
  categories: [
    "Education", "Youth and jobs", "Farming and markets", "Business and trade",
    "Roads and drainage", "Water and sanitation", "Inclusion (youth, women, PWD)", "Senior citizens",
    "Health", "Security", "Electricity and lighting", "Other"
  ],

  // Extra ward indicators to add to the "Colour wards by" menu.
  // Each must be a numeric property in data/wards.geojson.
  extraIndicators: [
    // { key: "polling_stations", label: "Polling stations" }
  ]
};

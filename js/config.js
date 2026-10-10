// Edit this file to personalise the tool. No build step needed.
window.APP_CONFIG = {
  // ---------- Candidate ----------
  candidate: {
    name: "Yvonne Waweru",
    role: "Aspirant, Kiambu County Woman Representative",
    party: "Democracy for Citizens Party (DCP)",
    slogan: "Skiza Wakenya",
    tagline: "Listening to every ward, starting from Kabete.",
    // Put her photo in the assets folder with this exact name (square works best).
    // Until it is added, her initials are shown instead.
    photo: "assets/yvonne.jpg",
    // Optional: the official party logo file, if the party has given you one.
    partyLogo: "assets/dcp-logo.png",
    // Short bio. Replace with her own words.
    bio: "Yvonne Waweru is seeking the Kiambu County Woman Representative seat on a DCP ticket. This tool maps what residents across Kiambu need, ward by ward, so that her agenda is shaped by the people it serves.",
    // Campaign priorities. DRAFTS: confirm or replace with her actual agenda.
    priorities: [
      { title: "Women in business", text: "Access to NGAAF and affordable credit for women groups and table banking." },
      { title: "Water and sanitation", text: "Clean water points and safe sanitation in every ward." },
      { title: "Youth and skills", text: "Bursaries, TVET places and jobs for young people." },
      { title: "Safety and dignity", text: "Gender-based violence support and safe spaces for women and girls." }
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

  // Categories for community needs
  categories: [
    "Water", "Roads and drainage", "Health", "Education", "Security",
    "Women economic empowerment", "Youth and jobs", "Sanitation and waste",
    "Electricity and lighting", "Gender-based violence support", "Markets and trade", "Other"
  ],

  // Extra ward indicators to add to the "Colour wards by" menu.
  // Each must be a numeric property in data/wards.geojson.
  extraIndicators: [
    // { key: "women_groups", label: "Registered women groups" }
  ]
};

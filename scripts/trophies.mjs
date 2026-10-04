// Genera assets/trophies.svg con datos reales de la API de GitHub.
// Reemplaza a github-profile-trophy (sin cuota → 402). Lo ejecuta .github/workflows/metrics.yml.
import { writeFileSync } from "node:fs";

const USER = process.env.GH_USER ?? "SebastianLima-PE";
const TOKEN = process.env.GITHUB_TOKEN;

const query = `query($login: String!) {
  user(login: $login) {
    createdAt
    followers { totalCount }
    pullRequests { totalCount }
    contributionsCollection {
      totalCommitContributions restrictedContributionsCount
      contributionCalendar { weeks { contributionDays { contributionCount } } }
    }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
      totalCount
      nodes { languages(first: 10) { nodes { name } } }
    }
    repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, PULL_REQUEST]) { totalCount }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables: { login: USER } }),
});
const { data, errors } = await res.json();
if (errors) throw new Error(JSON.stringify(errors));
const u = data.user;

const repos = u.repositories.nodes;
const langs = new Set(repos.flatMap((r) => r.languages.nodes.map((l) => l.name)));
const days = u.contributionsCollection.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
const activeDays = days.filter((d) => d.contributionCount > 0).length;
let streak = 0, best = 0;
for (const d of days) { streak = d.contributionCount > 0 ? streak + 1 : 0; best = Math.max(best, streak); }
const commits = u.contributionsCollection.totalCommitContributions + u.contributionsCollection.restrictedContributionsCount;
const years = (Date.now() - new Date(u.createdAt)) / (365.25 * 24 * 3600 * 1000);

// [título, valor, unidad, umbrales para C/B/A/S/SS/SSS]
const trophies = [
  ["Commits", commits, "commits", [1, 50, 200, 500, 1000, 2000]],
  ["Pull Requests", u.pullRequests.totalCount, "PRs", [1, 5, 10, 30, 100, 200]],
  ["Lenguajes", langs.size, "lenguajes", [1, 3, 5, 8, 10, 15]],
  ["Repositorios", u.repositories.totalCount, "repos", [1, 3, 10, 20, 35, 50]],
  ["Colaboración", u.repositoriesContributedTo.totalCount, "repos", [1, 3, 5, 10, 20, 50]],
  ["Días activos", activeDays, "en el último año", [1, 30, 60, 120, 200, 300]],
  ["Racha máxima", best, "días seguidos", [1, 3, 7, 14, 30, 60]],
  ["Experiencia", Math.floor(years * 12), "meses", [1, 6, 12, 24, 48, 72]],
];
const RANKS = ["C", "B", "A", "S", "SS", "SSS"];
const COLOR = { "?": "#525252", C: "#a3a3a3", B: "#10b981", A: "#34d399", S: "#d4af37", SS: "#f5d76e", SSS: "#ffffff" };

const rankOf = (v, t) => {
  let r = "?";
  t.forEach((min, i) => { if (v >= min) r = RANKS[i]; });
  return r;
};

const W = 110, H = 130, GAP = 10, COLS = 4;
const width = COLS * W + (COLS - 1) * GAP;
const height = Math.ceil(8 / COLS) * (H + GAP) - GAP;

const card = ([title, value, unit, t], i) => {
  const rank = rankOf(value, t);
  const c = COLOR[rank];
  const x = (i % COLS) * (W + GAP);
  const y = Math.floor(i / COLS) * (H + GAP);
  const locked = rank === "?";
  return `
  <g transform="translate(${x} ${y})" opacity="0">
    <animate attributeName="opacity" from="0" to="1" begin="${(i * 0.12).toFixed(2)}s" dur="0.5s" fill="freeze"/>
    <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="#111" stroke="#262626"/>
    <text x="${W / 2}" y="20" text-anchor="middle" class="t" fill="${c}">${title.toUpperCase()}</text>
    <g transform="translate(${W / 2} 52)" fill="${c}" opacity="${locked ? 0.35 : 1}">
      <circle r="24" fill="${c}" opacity="0.12"/>
      <path d="M-13 -14 H13 V-4 C13 6 6 11 0 11 C-6 11 -13 6 -13 -4 Z"/>
      <path d="M-13 -11 H-19 C-19 -2 -16 1 -12 1 M13 -11 H19 C19 -2 16 1 12 1" fill="none" stroke="${c}" stroke-width="2.5"/>
      <rect x="-3" y="10" width="6" height="6"/>
      <rect x="-10" y="16" width="20" height="5" rx="1.5"/>
      <text y="1" text-anchor="middle" class="r" fill="#0a0a0a">${rank}</text>
    </g>
    <text x="${W / 2}" y="100" text-anchor="middle" class="v" fill="#f5f5f0">${value}</text>
    <text x="${W / 2}" y="116" text-anchor="middle" class="u" fill="#8a8a8a">${unit}</text>
  </g>`;
};

const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Trofeos de GitHub de ${USER}">
  <style>
    .t{font:700 9px 'Segoe UI',Ubuntu,sans-serif;letter-spacing:.8px}
    .r{font:800 10px 'Segoe UI',Ubuntu,sans-serif}
    .v{font:700 18px 'Segoe UI',Ubuntu,sans-serif}
    .u{font:400 10px 'Segoe UI',Ubuntu,sans-serif}
  </style>${trophies.map(card).join("")}
</svg>
`;

writeFileSync("assets/trophies.svg", svg);
console.log(Object.fromEntries(trophies.map(([t, v, , th]) => [t, `${v} (${rankOf(v, th)})`])));

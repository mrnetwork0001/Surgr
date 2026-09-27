export interface DrugDef {
  name: string;
  aliases: string[];
  category: string;
}

export const DRUGS: DrugDef[] = [
  { name: "propofol", aliases: ["diprivan"], category: "induction agent" },
  { name: "etomidate", aliases: ["amidate"], category: "induction agent" },
  { name: "ketamine", aliases: ["ketalar"], category: "induction agent" },
  { name: "midazolam", aliases: ["versed"], category: "sedative" },
  { name: "dexmedetomidine", aliases: ["precedex"], category: "sedative" },
  { name: "fentanyl", aliases: ["sublimaze"], category: "opioid" },
  { name: "remifentanil", aliases: ["ultiva"], category: "opioid" },
  { name: "morphine", aliases: [], category: "opioid" },
  { name: "hydromorphone", aliases: ["dilaudid"], category: "opioid" },
  { name: "rocuronium", aliases: ["roc", "zemuron"], category: "neuromuscular blocker" },
  { name: "vecuronium", aliases: ["vec"], category: "neuromuscular blocker" },
  { name: "succinylcholine", aliases: ["sux", "anectine"], category: "neuromuscular blocker" },
  { name: "sugammadex", aliases: ["bridion"], category: "reversal agent" },
  { name: "neostigmine", aliases: [], category: "reversal agent" },
  { name: "glycopyrrolate", aliases: ["robinul"], category: "anticholinergic" },
  { name: "atropine", aliases: [], category: "anticholinergic" },
  { name: "lidocaine", aliases: ["xylocaine"], category: "local anesthetic" },
  { name: "bupivacaine", aliases: ["marcaine", "sensorcaine"], category: "local anesthetic" },
  { name: "ropivacaine", aliases: ["naropin"], category: "local anesthetic" },
  { name: "ondansetron", aliases: ["zofran"], category: "antiemetic" },
  { name: "dexamethasone", aliases: ["decadron"], category: "steroid" },
  { name: "cefazolin", aliases: ["ancef", "kefzol"], category: "antibiotic" },
  { name: "vancomycin", aliases: ["vanc", "vanco"], category: "antibiotic" },
  { name: "clindamycin", aliases: ["cleocin"], category: "antibiotic" },
  { name: "gentamicin", aliases: [], category: "antibiotic" },
  { name: "heparin", aliases: [], category: "anticoagulant" },
  { name: "protamine", aliases: [], category: "reversal agent" },
  { name: "tranexamic acid", aliases: ["txa"], category: "antifibrinolytic" },
  { name: "epinephrine", aliases: ["epi", "adrenaline"], category: "vasopressor" },
  { name: "phenylephrine", aliases: ["neo", "neosynephrine"], category: "vasopressor" },
  { name: "ephedrine", aliases: [], category: "vasopressor" },
  { name: "norepinephrine", aliases: ["levophed", "levo"], category: "vasopressor" },
  { name: "labetalol", aliases: [], category: "antihypertensive" },
  { name: "esmolol", aliases: ["brevibloc"], category: "antihypertensive" },
  { name: "ketorolac", aliases: ["toradol"], category: "analgesic" },
  { name: "acetaminophen", aliases: ["tylenol", "ofirmev", "paracetamol"], category: "analgesic" },
  { name: "insulin", aliases: [], category: "endocrine" },
  { name: "oxytocin", aliases: ["pitocin"], category: "uterotonic" },
  { name: "naloxone", aliases: ["narcan"], category: "reversal agent" },
  { name: "flumazenil", aliases: ["romazicon"], category: "reversal agent" },
  { name: "adenosine", aliases: [], category: "antiarrhythmic" },
  { name: "amiodarone", aliases: [], category: "antiarrhythmic" },
  { name: "magnesium sulfate", aliases: ["magnesium", "mag"], category: "electrolyte" },
  { name: "calcium gluconate", aliases: [], category: "electrolyte" },
  { name: "calcium chloride", aliases: ["calcium"], category: "electrolyte" },
  { name: "sodium bicarbonate", aliases: ["bicarb"], category: "electrolyte" },
  { name: "potassium chloride", aliases: ["potassium"], category: "electrolyte" },
];

const ALIAS_TO_NAME: Record<string, string> = {};
for (const d of DRUGS) {
  ALIAS_TO_NAME[d.name] = d.name;
  for (const a of d.aliases) ALIAS_TO_NAME[a] = d.name;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const DRUG_ALTERNATION = Object.keys(ALIAS_TO_NAME)
  .sort((a, b) => b.length - a.length)
  .map(escapeRegex)
  .join("|");

/** Matches any known drug name or alias. Group 1 is the raw match. */
export const DRUG_REGEX = new RegExp(`\\b(${DRUG_ALTERNATION})\\b`, "i");

export function canonicalDrug(raw: string): string {
  const key = raw.toLowerCase().trim();
  return ALIAS_TO_NAME[key] ?? key;
}

export function drugCategory(name: string): string | undefined {
  return DRUGS.find((d) => d.name === name)?.category;
}

// ---------- Units ----------

export const UNIT_PATTERN =
  "(?:milligrams?\\s*(?:per|/)\\s*(?:kilo(?:gram)?|kg)|mg\\s*/\\s*kg|mg\\s*per\\s*kg|micrograms?\\s*(?:per|/)\\s*(?:kilo(?:gram)?|kg)|mcg\\s*/\\s*kg|mcg\\s*per\\s*kg|milligrams?|mg|micrograms?|mcg|µg|ug|mics?|mikes?|grams?|g|international units?|units?|iu|milliliters?|millilitres?|ml|cc|milliequivalents?|meq)";

export type CanonicalUnit = "mg" | "mcg" | "g" | "units" | "mL" | "mEq" | "mg/kg" | "mcg/kg";

export function normalizeUnit(raw?: string | null): CanonicalUnit | undefined {
  if (!raw) return undefined;
  const u = raw.toLowerCase().replace(/\s+/g, "");
  if (/(kg|kilo)/.test(u)) {
    return /^(mc|mic|µ|u)/.test(u) ? "mcg/kg" : "mg/kg";
  }
  if (/^(mg|milligram)/.test(u)) return "mg";
  if (/^(mcg|microgram|µg|ug|mic|mike)/.test(u)) return "mcg";
  if (/^(g|gram)/.test(u)) return "g";
  if (/^(unit|iu|international)/.test(u)) return "units";
  if (/^(ml|millilit|cc)/.test(u)) return "mL";
  if (/^(meq|milliequiv)/.test(u)) return "mEq";
  return undefined;
}

/** Converts a mass dose to micrograms when the unit is a mass unit; otherwise null. */
export function toMicrograms(dose: number, unit?: string): number | null {
  switch (unit) {
    case "mcg":
      return dose;
    case "mg":
      return dose * 1000;
    case "g":
      return dose * 1_000_000;
    default:
      return null;
  }
}

export function spokenUnit(unit?: string, dose?: number): string {
  const plural = dose !== 1;
  switch (unit) {
    case "mg":
      return plural ? "milligrams" : "milligram";
    case "mcg":
      return plural ? "micrograms" : "microgram";
    case "g":
      return plural ? "grams" : "gram";
    case "units":
      return plural ? "units" : "unit";
    case "mL":
      return plural ? "milliliters" : "milliliter";
    case "mEq":
      return "milliequivalents";
    case "mg/kg":
      return "milligrams per kilogram";
    case "mcg/kg":
      return "micrograms per kilogram";
    default:
      return "";
  }
}

export function formatDose(dose?: number, unit?: string): string {
  if (dose === undefined) return unit ?? "dose not stated";
  return unit ? `${dose} ${unit}` : `${dose}`;
}

export function spokenDose(dose?: number, unit?: string): string {
  if (dose === undefined) return "an unstated dose";
  const u = spokenUnit(unit, dose);
  return u ? `${dose} ${u}` : `${dose}`;
}

// ---------- Routes ----------

const ROUTE_MAP: [RegExp, string][] = [
  [/\b(?:iv|i\.v\.|intravenous(?:ly)?)\b/, "IV"],
  [/\b(?:im|intramuscular(?:ly)?)\b/, "IM"],
  [/\b(?:po|by mouth|oral(?:ly)?)\b/, "PO"],
  [/\b(?:sub ?q|subcutaneous(?:ly)?|subcut)\b/, "SC"],
  [/\bepidural(?:ly)?\b/, "epidural"],
  [/\bintrathecal(?:ly)?\b/, "intrathecal"],
  [/\btopical(?:ly)?\b/, "topical"],
  [/\b(?:inhaled|nebulized)\b/, "inhaled"],
  [/\bsublingual\b/, "SL"],
  [/\b(?:pr|rectal(?:ly)?)\b/, "PR"],
];

export function extractRoute(text: string): string | undefined {
  for (const [re, route] of ROUTE_MAP) {
    if (re.test(text)) return route;
  }
  return undefined;
}

// ---------- Number words ----------

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

function isNumberWord(w: string): boolean {
  const base = w.toLowerCase().replace(/[^a-z-]/g, "");
  return base.split("-").every((p) => p in ONES || p in TENS || p === "hundred" || p === "thousand");
}

interface ParsedNumber {
  value: string;
  suffix: string;
  next: number;
}

function parseNumberWords(words: string[], start: number): ParsedNumber | null {
  let i = start;
  let total = 0;
  let current = 0;
  let any = false;
  let inDecimal = false;
  let decimal = "";
  let suffix = "";

  while (i < words.length) {
    const raw = words[i];
    const m = raw.match(/^([a-zA-Z-]+)([^a-zA-Z]*)$/);
    if (!m) break;
    const w = m[1].toLowerCase();
    const trail = m[2];
    const parts = w.split("-").filter(Boolean);
    let handled = parts.length > 0;
    for (const part of parts) {
      if (inDecimal) {
        if (part in ONES && ONES[part] < 10) decimal += String(ONES[part]);
        else handled = false;
      } else if (part in ONES) current += ONES[part];
      else if (part in TENS) current += TENS[part];
      else if (part === "hundred") current = (current || 1) * 100;
      else if (part === "thousand") {
        total += (current || 1) * 1000;
        current = 0;
      } else if (part === "point" && any) inDecimal = true;
      else if (part === "a" && !any && /^hundred/i.test(words[i + 1] ?? "")) current = 1;
      else if (part === "and" && any && !trail && i + 1 < words.length && isNumberWord(words[i + 1])) {
        // "one hundred and fifty"
      } else handled = false;
      if (!handled) break;
    }
    if (!handled) break;
    if (!(w === "a" || w === "and")) any = true;
    i++;
    if (trail) {
      suffix = trail;
      break;
    }
  }
  if (!any) return null;
  const value = total + current;
  return { value: decimal ? `${value}.${decimal}` : String(value), suffix, next: i };
}

/** Rewrites spoken numbers ("fifty", "one hundred", "two point five") as digits. */
export function normalizeNumbers(input: string): string {
  const words = input.split(/\s+/);
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    const parsed = parseNumberWords(words, i);
    if (parsed) {
      out.push(parsed.value + parsed.suffix);
      i = parsed.next;
    } else {
      out.push(words[i]);
      i++;
    }
  }
  return out.join(" ");
}

// ---------- Medication extraction ----------

export interface MedicationMention {
  drug: string;
  rawDrug: string;
  dose?: number;
  unit?: CanonicalUnit;
  route?: string;
}

const NUM = "(\\d+(?:[.,]\\d+)?)";
const RE_NUM_FIRST = new RegExp(
  `\\b${NUM}\\s*(?:(${UNIT_PATTERN})\\b)?\\s*(?:of\\s+)?(?:the\\s+)?(?:iv\\s+|im\\s+)?(${DRUG_ALTERNATION})\\b`,
  "i",
);
const RE_DRUG_FIRST = new RegExp(
  `\\b(${DRUG_ALTERNATION})\\b\\s*(?:,|:|at|-|of)?\\s*${NUM}\\s*(?:(${UNIT_PATTERN})\\b)?`,
  "i",
);

function parseNum(s: string): number {
  return parseFloat(s.replace(",", "."));
}

/** Extracts the first medication mention (drug + optional dose/unit/route) from normalized text. */
export function extractMedication(text: string): MedicationMention | null {
  const route = extractRoute(text);
  const a = RE_NUM_FIRST.exec(text);
  if (a) {
    return {
      drug: canonicalDrug(a[3]),
      rawDrug: a[3],
      dose: parseNum(a[1]),
      unit: normalizeUnit(a[2]),
      route,
    };
  }
  const b = RE_DRUG_FIRST.exec(text);
  if (b) {
    return {
      drug: canonicalDrug(b[1]),
      rawDrug: b[1],
      dose: parseNum(b[2]),
      unit: normalizeUnit(b[3]),
      route,
    };
  }
  const c = DRUG_REGEX.exec(text);
  if (c) {
    return { drug: canonicalDrug(c[1]), rawDrug: c[1], route };
  }
  return null;
}

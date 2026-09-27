import type { Phase } from "./types";

export interface ChecklistItemDef {
  id: string;
  phase: Phase;
  label: string;
  short: string;
  patterns: RegExp[];
}

export const PHASES: { id: Phase; label: string; when: string }[] = [
  { id: "sign_in", label: "Sign In", when: "before induction of anaesthesia" },
  { id: "time_out", label: "Time Out", when: "before skin incision" },
  { id: "sign_out", label: "Sign Out", when: "before the patient leaves the OR" },
];

export const CHECKLIST: ChecklistItemDef[] = [
  // ---- Sign In ----
  {
    id: "si_identity",
    phase: "sign_in",
    label: "Patient identity confirmed",
    short: "Identity",
    patterns: [
      /\bpatient (?:is |has been |was )?(?:confirmed|verified|identified)\b/,
      /\bconfirm(?:ed|s|ing)? (?:the )?patient(?:'s)? (?:identity|name|id)\b/,
      /\b(?:identity|name and date of birth|id band|wristband|date of birth)\b.*\b(?:confirm|verif|correct|check|match)/,
      /\bpatient (?:is|name is) [a-z]+ [a-z]+\b/,
    ],
  },
  {
    id: "si_site_marked",
    phase: "sign_in",
    label: "Surgical site marked",
    short: "Site marked",
    patterns: [/\bsite (?:is |has been )?marked\b/, /\bmarking (?:is )?(?:confirmed|visible|correct)\b/, /\bmarked (?:the )?(?:site|side|limb|knee|hip|leg|arm)\b/],
  },
  {
    id: "si_consent",
    phase: "sign_in",
    label: "Consent verified",
    short: "Consent",
    patterns: [/\bconsent\b/],
  },
  {
    id: "si_anesthesia_check",
    phase: "sign_in",
    label: "Anaesthesia machine and medication check complete",
    short: "Machine check",
    patterns: [/\b(?:anesthesia|anaesthesia|machine|medication) (?:safety )?check\b/, /\bmachine (?:is |has been )?checked\b/],
  },
  {
    id: "si_pulse_ox",
    phase: "sign_in",
    label: "Pulse oximeter on patient and functioning",
    short: "Pulse ox",
    patterns: [/\bpulse ox(?:imeter)?\b/, /\boximeter\b/, /\bsats? (?:are |is )?(?:on|reading|good|at)\b/],
  },
  {
    id: "si_allergies",
    phase: "sign_in",
    label: "Known allergies reviewed",
    short: "Allergies",
    patterns: [/\ballerg/, /\bnkda\b/],
  },
  {
    id: "si_airway",
    phase: "sign_in",
    label: "Difficult airway or aspiration risk assessed",
    short: "Airway",
    patterns: [/\bairway\b/, /\baspiration\b/],
  },
  {
    id: "si_blood_loss",
    phase: "sign_in",
    label: "Risk of >500 mL blood loss addressed",
    short: "Blood loss",
    patterns: [/\bblood loss\b/, /\bblood (?:is )?(?:available|needed|not needed)\b/, /\btype and (?:cross|screen)\b/, /\bunits? (?:of blood )?(?:available|cross-?matched)\b/],
  },
  // ---- Time Out ----
  {
    id: "to_team",
    phase: "time_out",
    label: "Team members introduced by name and role",
    short: "Introductions",
    patterns: [
      /\bintroduc/,
      /\bnames? and roles?\b/,
      /\b(?:i'?m|i am|this is) (?:dr\.?|doctor|nurse)?\s*[a-z]+,? (?:the |your )?(?:surgeon|attending|anesthesia|anesthesiologist|anaesthetist|scrub|circulat|resident|nurse)\b/,
      /\b(?:dr\.?|doctor)\s+[a-z]+,?\s+(?:surgeon|surgery|anesthesia|anaesthesia|anesthesiologist|attending|resident)\b/,
      /\b[a-z]+,\s*(?:scrub|circulating|circulator)(?: nurse| tech)?\b/,
    ],
  },
  {
    id: "to_confirm",
    phase: "time_out",
    label: "Patient, procedure and site confirmed",
    short: "Patient/procedure/site",
    patterns: [
      /\bconfirm\w*\b.*\b(?:patient|procedure|site)\b/,
      /\b(?:patient|procedure|site)\b.*\bconfirm/,
      /\bpatient (?:is|name is) [a-z]+.*\bprocedure\b/,
      /\bprocedure (?:is|will be)\b/,
    ],
  },
  {
    id: "to_antibiotic",
    phase: "time_out",
    label: "Antibiotic prophylaxis given within the last 60 minutes",
    short: "Antibiotics",
    patterns: [/\bantibiotic/, /\bprophyla/, /\b(?:cefazolin|ancef|vancomycin|vanco|clindamycin|gentamicin)\b.*\b(?:given|in|on board|administered|infus|hung|running)/],
  },
  {
    id: "to_critical_surgeon",
    phase: "time_out",
    label: "Surgeon: critical steps, duration and anticipated blood loss",
    short: "Critical steps",
    patterns: [/\bcritical (?:or unexpected )?steps?\b/, /\b(?:anticipated|expected) (?:blood loss|duration)\b/, /\b(?:case|procedure) (?:should|will) take\b/, /\bblood loss (?:should be |is |will be )?(?:minimal|expected|less)\b/],
  },
  {
    id: "to_critical_anesthesia",
    phase: "time_out",
    label: "Anaesthesia: patient-specific concerns",
    short: "Anesthesia concerns",
    patterns: [/\bpatient[- ]specific concerns?\b/, /\bno (?:anesthesia|anaesthesia|anesthetic) concerns?\b/, /\bconcerns? from (?:anesthesia|anaesthesia)\b/, /\b(?:anesthesia|anaesthesia) (?:has |have )?no concerns?\b/],
  },
  {
    id: "to_sterility",
    phase: "time_out",
    label: "Sterility indicators confirmed",
    short: "Sterility",
    patterns: [/\bsterility\b/, /\bsterile\b.*\b(?:confirm|indicator|good|verified)/, /\bindicators? (?:are |have )?(?:confirmed|passed|good|verified)\b/],
  },
  {
    id: "to_equipment",
    phase: "time_out",
    label: "Equipment issues or concerns addressed",
    short: "Equipment",
    patterns: [/\bequipment (?:issues?|concerns?|is ready|ready|checked)\b/, /\bno equipment (?:issues?|concerns?|problems?)\b/, /\bimplants? (?:are )?(?:available|ready|in the room)\b/],
  },
  {
    id: "to_imaging",
    phase: "time_out",
    label: "Essential imaging displayed",
    short: "Imaging",
    patterns: [/\bimag(?:ing|es)\b/, /\b(?:x-?rays?|scans?|mri|ct)\b.*\b(?:up|displayed|on the screen|available)\b/, /\bfilms? (?:are )?up\b/],
  },
  // ---- Sign Out ----
  {
    id: "so_procedure",
    phase: "sign_out",
    label: "Name of the procedure recorded",
    short: "Procedure recorded",
    patterns: [/\bprocedure (?:performed|recorded|was|completed|done)\b/, /\bwe (?:performed|completed|did) (?:a|an|the)\b/, /\brecorded (?:as|the procedure)\b/],
  },
  {
    id: "so_counts",
    phase: "sign_out",
    label: "Instrument, sponge and needle counts correct",
    short: "Counts",
    patterns: [/\bcounts? (?:is |are )?correct\b/, /\b(?:sponge|needle|instrument|sharps?) counts?\b/, /\bcounts? (?:are |is )?(?:complete|reconciled|good|verified)\b/, /\bfinal count\b/],
  },
  {
    id: "so_specimen",
    phase: "sign_out",
    label: "Specimen labelled",
    short: "Specimen",
    patterns: [/\bspecimens?\b/],
  },
  {
    id: "so_equipment",
    phase: "sign_out",
    label: "Equipment problems identified",
    short: "Equipment",
    patterns: [/\bequipment (?:problems?|issues?|malfunction)\b/, /\bno equipment (?:problems?|issues?)\b/],
  },
  {
    id: "so_recovery",
    phase: "sign_out",
    label: "Key concerns for recovery and management",
    short: "Recovery plan",
    patterns: [/\brecovery\b/, /\bpost-?op(?:erative)? (?:concerns?|plan|management|instructions)\b/, /\bhand-?off\b/, /\bpacu\b/, /\bkey concerns?\b/],
  },
];

export const CHECKLIST_BY_ID: Record<string, ChecklistItemDef> = Object.fromEntries(
  CHECKLIST.map((i) => [i.id, i]),
);

export function itemsForPhase(phase: Phase): ChecklistItemDef[] {
  return CHECKLIST.filter((i) => i.phase === phase);
}

export function phaseLabel(phase: Phase): string {
  return PHASES.find((p) => p.id === phase)?.label ?? phase;
}

/** Returns ids of all checklist items whose patterns match the lowercased text. */
export function matchChecklist(text: string): string[] {
  const ids: string[] = [];
  for (const item of CHECKLIST) {
    if (item.patterns.some((re) => re.test(text))) ids.push(item.id);
  }
  return ids;
}

const PHASE_START: [RegExp, Phase][] = [
  [/\b(?:sign[- ]?in|before induction|pre-?induction (?:check|briefing))\b/, "sign_in"],
  [/\btime[- ]?out\b/, "time_out"],
  [/\b(?:sign[- ]?out|debrief)\b/, "sign_out"],
];

const PHASE_END: [RegExp, Phase][] = [
  [/\b(?:induc(?:e|ing|tion)|patient(?:'s| is) asleep|going (?:off )?to sleep)\b/, "sign_in"],
  [/\b(?:incision|knife|scalpel|(?:let'?s|we'?ll|we will) (?:begin|start|cut)|starting the (?:case|procedure))\b/, "time_out"],
  [/\b(?:to (?:the )?pacu|to recovery|leaving the (?:room|or)|transport(?:ing)? the patient)\b/, "sign_out"],
];

export function detectPhaseStart(text: string): Phase | undefined {
  for (const [re, phase] of PHASE_START) if (re.test(text)) return phase;
  return undefined;
}

export function detectPhaseEnd(text: string): Phase | undefined {
  for (const [re, phase] of PHASE_END) if (re.test(text)) return phase;
  return undefined;
}

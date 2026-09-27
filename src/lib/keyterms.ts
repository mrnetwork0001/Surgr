import { DRUGS } from "./drugs";

/** Keyterms boost recognition of drug names and checklist phrases (max 100 terms, 50 chars each). */
export const KEYTERMS: string[] = [
  "Surgr",
  ...DRUGS.map((d) => d.name),
  "milligrams",
  "micrograms",
  "read back",
  "confirmed",
  "time out",
  "sign in",
  "sign out",
  "site marked",
  "antibiotic prophylaxis",
  "sterility indicators",
  "sponge count",
  "needle count",
  "instrument count",
  "specimen labeled",
  "pulse oximeter",
  "difficult airway",
  "blood loss",
  "PACU",
  "incision",
].slice(0, 100);

export const STT_PROMPT =
  "Operating room conversation between a surgeon, an anesthesiologist and a scrub nurse. Medication orders with doses in milligrams or micrograms, closed-loop read-backs, and WHO Surgical Safety Checklist items.";

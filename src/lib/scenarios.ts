import type { Role } from "./types";

export type SimSpeaker = "S1" | "S2" | "S3";

export const SIM_SPEAKERS: Record<SimSpeaker, { label: string; role: Role; name: string }> = {
  S1: { label: "S1", role: "surgeon", name: "Dr. Alvarez" },
  S2: { label: "S2", role: "anesthesiologist", name: "Dr. Chen" },
  S3: { label: "S3", role: "nurse", name: "Maria" },
};

export interface ScenarioLine {
  speaker: SimSpeaker;
  text: string;
  /** Delay before this line is spoken, in ms. */
  delayMs: number;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  expected: string;
  lines: ScenarioLine[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: "correct_readback",
    name: "Correct closed loop",
    description: "Surgeon orders, anesthesia reads back the same drug, dose and route.",
    expected: "Order confirmed within seconds. No alert.",
    lines: [
      { speaker: "S1", text: "Let's give 50 milligrams of propofol IV.", delayMs: 800 },
      { speaker: "S2", text: "50 milligrams propofol IV, confirmed.", delayMs: 2500 },
    ],
  },
  {
    id: "wrong_dose",
    name: "Dose mismatch",
    description: "Anesthesia reads back a tenth of the ordered fentanyl dose, then corrects it.",
    expected: "Critical mismatch alert is spoken into the room; the corrected read-back clears it.",
    lines: [
      { speaker: "S1", text: "Push 100 micrograms of fentanyl.", delayMs: 800 },
      { speaker: "S2", text: "Pushing 10 micrograms fentanyl.", delayMs: 2500 },
      { speaker: "S2", text: "Correction. 100 micrograms fentanyl, confirmed.", delayMs: 8000 },
    ],
  },
  {
    id: "no_readback",
    name: "No read-back",
    description: "An antibiotic order goes unanswered while the team talks about instruments.",
    expected: "Timeout alert after 10 seconds, then a late confirmation closes the loop.",
    lines: [
      { speaker: "S1", text: "Give 2 grams of cefazolin before we start.", delayMs: 800 },
      { speaker: "S3", text: "Retractor coming up.", delayMs: 3000 },
      { speaker: "S1", text: "Thank you. Suction please.", delayMs: 3000 },
      { speaker: "S2", text: "Sorry, 2 grams cefazolin, confirmed, going in now.", delayMs: 8500 },
    ],
  },
  {
    id: "unit_conversion",
    name: "Equivalent units",
    description: "Order in milligrams, read-back in micrograms.",
    expected: "0.1 mg and 100 mcg are recognised as the same dose. Confirmed, no alert.",
    lines: [
      { speaker: "S1", text: "Give 0.1 milligrams of epinephrine IV.", delayMs: 800 },
      { speaker: "S2", text: "100 micrograms epi IV, confirmed.", delayMs: 2500 },
    ],
  },
  {
    id: "wrong_drug",
    name: "Wrong drug read back",
    description: "Surgeon orders rocuronium, anesthesia confirms succinylcholine.",
    expected: "Critical drug mismatch alert.",
    lines: [
      { speaker: "S1", text: "Let's give 50 milligrams of rocuronium.", delayMs: 800 },
      { speaker: "S2", text: "50 milligrams succinylcholine, confirmed.", delayMs: 2500 },
    ],
  },
  {
    id: "time_out",
    name: "WHO Time Out",
    description: "A complete Time Out led by the scrub nurse.",
    expected: "All eight Time Out items tick off as they are spoken.",
    lines: [
      { speaker: "S3", text: "Time out. Everyone please introduce yourselves.", delayMs: 800 },
      { speaker: "S1", text: "Dr. Alvarez, surgeon.", delayMs: 2000 },
      { speaker: "S2", text: "Dr. Chen, anesthesia.", delayMs: 1500 },
      { speaker: "S3", text: "Maria, scrub nurse.", delayMs: 1500 },
      { speaker: "S3", text: "Confirm the patient is John Doe, procedure is right knee arthroscopy, site is marked on the right knee.", delayMs: 2500 },
      { speaker: "S1", text: "Confirmed.", delayMs: 2000 },
      { speaker: "S2", text: "Antibiotic prophylaxis: cefazolin 2 grams was given 10 minutes ago.", delayMs: 2500 },
      { speaker: "S1", text: "Critical steps are a standard diagnostic arthroscopy. Expected duration 45 minutes, blood loss minimal.", delayMs: 3000 },
      { speaker: "S2", text: "No patient specific concerns from anesthesia.", delayMs: 2500 },
      { speaker: "S3", text: "Sterility indicators confirmed. No equipment issues.", delayMs: 2500 },
      { speaker: "S1", text: "Imaging is up on the screen. Thank you, knife please.", delayMs: 2500 },
    ],
  },
  {
    id: "skipped_items",
    name: "Rushed Time Out",
    description: "The team skips introductions, antibiotics, sterility and imaging and calls for the knife.",
    expected: "Checklist alert lists the unconfirmed items before incision.",
    lines: [
      { speaker: "S3", text: "Time out. Patient is John Doe, procedure is right knee arthroscopy, site is marked.", delayMs: 800 },
      { speaker: "S1", text: "Confirmed. Anything from your side?", delayMs: 2500 },
      { speaker: "S2", text: "No patient specific concerns.", delayMs: 2000 },
      { speaker: "S1", text: "Great. Knife please.", delayMs: 2500 },
    ],
  },
  {
    id: "no_timeout",
    name: "No Time Out at all",
    description: "The surgeon calls for the knife without any Time Out.",
    expected: "Critical alert: incision called without a Time Out.",
    lines: [{ speaker: "S1", text: "Everyone ready? Knife please.", delayMs: 800 }],
  },
  {
    id: "full_case",
    name: "Full case (3 min)",
    description: "Sign In, induction orders, Time Out, intra-op orders with one mismatch, and Sign Out.",
    expected: "All three checklist phases complete, four confirmed orders, one mismatch alert that is corrected.",
    lines: [
      { speaker: "S3", text: "Let's do the sign in. Patient confirmed as John Doe, right knee arthroscopy, consent is signed, site is marked.", delayMs: 800 },
      { speaker: "S2", text: "Anesthesia machine check complete, pulse oximeter is on and reading 98. No known allergies. Airway assessed, no difficult airway anticipated.", delayMs: 4000 },
      { speaker: "S1", text: "Blood loss expected under 500 mL, no blood needed.", delayMs: 3500 },
      { speaker: "S1", text: "Let's induce. Give 200 milligrams of propofol.", delayMs: 3000 },
      { speaker: "S2", text: "200 milligrams propofol going in.", delayMs: 2500 },
      { speaker: "S1", text: "Then push 100 micrograms of fentanyl.", delayMs: 3000 },
      { speaker: "S2", text: "100 micrograms fentanyl, confirmed.", delayMs: 2500 },
      { speaker: "S2", text: "Patient is asleep.", delayMs: 4000 },
      { speaker: "S3", text: "Time out. Everyone please introduce yourselves.", delayMs: 3000 },
      { speaker: "S1", text: "Dr. Alvarez, surgeon.", delayMs: 2000 },
      { speaker: "S2", text: "Dr. Chen, anesthesia.", delayMs: 1500 },
      { speaker: "S3", text: "Maria, scrub nurse.", delayMs: 1500 },
      { speaker: "S3", text: "Confirm the patient is John Doe, procedure right knee arthroscopy, site marked right knee.", delayMs: 2500 },
      { speaker: "S1", text: "Confirmed.", delayMs: 2000 },
      { speaker: "S2", text: "Antibiotic prophylaxis: cefazolin 2 grams was given 10 minutes ago.", delayMs: 2500 },
      { speaker: "S1", text: "Critical steps are standard diagnostic arthroscopy with possible meniscectomy. Expected duration 45 minutes, blood loss minimal.", delayMs: 3500 },
      { speaker: "S2", text: "No patient specific concerns from anesthesia.", delayMs: 2500 },
      { speaker: "S3", text: "Sterility indicators confirmed. No equipment issues. Imaging is up on the screen.", delayMs: 3000 },
      { speaker: "S1", text: "Thank you. Knife please.", delayMs: 2500 },
      { speaker: "S1", text: "Give 30 milligrams of ketorolac IV.", delayMs: 5000 },
      { speaker: "S2", text: "30 milligrams ketorolac IV, confirmed.", delayMs: 2500 },
      { speaker: "S1", text: "Let's give 4 milligrams of ondansetron.", delayMs: 4000 },
      { speaker: "S2", text: "Giving 8 milligrams ondansetron.", delayMs: 2500 },
      { speaker: "S2", text: "Correction, 4 milligrams ondansetron, confirmed.", delayMs: 7000 },
      { speaker: "S3", text: "Sign out. Procedure performed was right knee arthroscopy with partial meniscectomy.", delayMs: 5000 },
      { speaker: "S3", text: "Sponge, needle and instrument counts are correct.", delayMs: 3000 },
      { speaker: "S3", text: "Specimen labeled: right medial meniscus.", delayMs: 2500 },
      { speaker: "S1", text: "No equipment problems.", delayMs: 2000 },
      { speaker: "S2", text: "Key concerns for recovery: monitor for nausea, standard post-op analgesia.", delayMs: 3000 },
      { speaker: "S1", text: "Great, let's take the patient to PACU.", delayMs: 3000 },
    ],
  },
];

export function findScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

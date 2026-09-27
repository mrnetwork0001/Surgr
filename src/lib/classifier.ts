import { extractMedication, normalizeNumbers } from "./drugs";
import { detectPhaseEnd, detectPhaseStart, matchChecklist } from "./checklist";
import type { Classification, ClassificationKind } from "./types";

const ORDER_VERB =
  /\b(?:give|administer|push|start|bolus|hang|run|draw up|let'?s (?:give|push|start|go with|do|bolus)|go ahead (?:and|with)|i(?:'d| would)? (?:want|need|like)|please (?:give|push|administer|start)|can (?:you|we) (?:give|push|start)|we'?ll (?:give|do|push|start)|order(?:ing)?|dose (?:him|her|the patient) with)\b/;

const READBACK_CUE =
  /\b(?:confirm(?:ed|ing)?|confirmation|copy(?: that)?|roger|read(?:ing)? (?:that )?back|got it|understood|heard|giving|administering|pushing|going in|is in|are in|drawn up|in the line|noted|on board|acknowledged|will do|correction)\b/;

const EXPLICIT_CONFIRM = /\b(?:confirm(?:ed|ing)?|confirmation|copy(?: that)?|roger|read(?:ing)? (?:that )?back|acknowledged|correction)\b/;

const PAST_TENSE =
  /\b(?:was given|were given|has been given|have been given|already (?:given|in|administered)|given .{0,25}\bago\b|administered .{0,25}\bago\b|was administered|infused)\b/;

/** Prepares transcript text for pattern matching. */
export function normalizeText(raw: string): string {
  return normalizeNumbers(raw.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ").trim());
}

/**
 * Fast, deterministic classification of one spoken utterance.
 * Runs in well under a millisecond so the read-back state machine can react immediately.
 */
export function ruleClassify(rawText: string): Classification {
  const text = normalizeText(rawText);
  const checklistItemIds = matchChecklist(text);
  const phaseStart = detectPhaseStart(text);
  const phaseEnd = detectPhaseEnd(text);
  const med = extractMedication(text);

  let kind: ClassificationKind = "other";
  let confidence = 0.5;
  let readBackExplicit = false;

  if (med) {
    const orderIdx = text.search(ORDER_VERB);
    const cueIdx = text.search(READBACK_CUE);
    const hasOrder = orderIdx >= 0;
    const hasCue = cueIdx >= 0;
    const past = PAST_TENSE.test(text);
    readBackExplicit = EXPLICIT_CONFIRM.test(text);

    if (hasOrder && hasCue) {
      kind = orderIdx < cueIdx && !readBackExplicit ? "drug_order" : orderIdx < cueIdx ? "drug_order" : "read_back";
      confidence = 0.7;
    } else if (hasCue) {
      kind = "read_back";
      confidence = readBackExplicit ? 0.9 : 0.8;
    } else if (past) {
      kind = "drug_mention";
      confidence = 0.6;
    } else if (hasOrder) {
      kind = "drug_order";
      confidence = med.dose !== undefined ? 0.9 : 0.6;
    } else {
      kind = "drug_mention";
      confidence = 0.5;
    }
  }

  if ((kind === "other" || kind === "drug_mention") && checklistItemIds.length > 0) {
    kind = "checklist_item";
    confidence = Math.max(confidence, 0.8);
  }
  if (kind === "other" && (phaseStart || phaseEnd)) {
    confidence = 0.8;
  }

  return {
    kind,
    drug: med?.drug,
    dose: med?.dose,
    unit: med?.unit,
    route: med?.route,
    readBackExplicit: kind === "read_back" ? readBackExplicit : undefined,
    checklistItemIds: checklistItemIds.length ? checklistItemIds : undefined,
    phaseStart,
    phaseEnd,
    confidence,
    by: "rules",
  };
}

/** JSON-schema client-side tools the Voice Agent can call to answer questions about the case. */
export const SURGR_TOOLS = [
  {
    type: "function",
    name: "get_open_orders",
    description: "List verbal medication orders that have not been confirmed by a correct read-back: pending, mismatched or timed out. Use for questions like 'what is still open', 'anything outstanding', 'was the cefazolin confirmed'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "function",
    name: "get_last_order",
    description: "The most recent verbal medication order and its read-back status.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "function",
    name: "get_checklist_status",
    description: "WHO Surgical Safety Checklist status: the current phase, items confirmed and items still missing. Optionally for a specific phase.",
    parameters: {
      type: "object",
      properties: { phase: { type: "string", enum: ["sign_in", "time_out", "sign_out"], description: "Phase to report on; omit for the current phase." } },
      required: [],
    },
  },
  {
    type: "function",
    name: "get_session_summary",
    description: "Case summary so far: elapsed time, orders given and closed, closed-loop rate, alerts raised, current checklist phase.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "function",
    name: "get_recent_alerts",
    description: "The most recent safety alerts, newest first, with whether each was resolved.",
    parameters: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 5 } }, required: [] },
  },
  {
    type: "function",
    name: "acknowledge_alerts",
    description: "Mark all currently displayed alerts as acknowledged by the team. Only call when explicitly asked to acknowledge, clear or dismiss alerts.",
    parameters: { type: "object", properties: {}, required: [] },
  },
] as const;

export type SurgrToolName = (typeof SURGR_TOOLS)[number]["name"];

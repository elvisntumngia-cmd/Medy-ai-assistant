import fs from "node:fs";
import path from "node:path";
import {
  AssistantResponseSchema,
  type AssistantResponse,
  type EmployeeProfile,
  type Mode,
} from "@medy/shared";
import { knowledgeFor, type KnowledgeEntry } from "./knowledge.js";

export type ConversationState = {
  currentDomain: Mode;
  currentTopic: string | null;
  activeIntent: string | null;
  priorUserRequest: string | null;
  collectedFields: Record<string, string>;
  missingRequiredFields: string[];
  lastAssistantQuestion: string | null;
  completedWorkflow: boolean;
  escalationStatus: "none" | "offered" | "requested";
  activeEntryId: string | null;
};
export type IntentMatch = {
  selectedIntent: string | null;
  confidence: number;
  alternativeIntents: string[];
  matchingKnowledgeEntryIds: string[];
  entry: KnowledgeEntry | null;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const tokens = (value: string) =>
  new Set(normalize(value).split(" ").filter(Boolean));
const similarity = (a: string, b: string) => {
  const left = tokens(a);
  const right = tokens(b);
  const common = [...left].filter((word) => right.has(word)).length;
  return common / Math.max(1, new Set([...left, ...right]).size);
};

export class DeterministicIntentMatcher {
  match(mode: Mode, input: string, state?: ConversationState): IntentMatch {
    const query = normalize(input);
    const queryTokens = tokens(query);
    const ranked = knowledgeFor(mode)
      .map((item) => {
        let score = 0;
        for (const phrase of [
          item.intent.replaceAll("_", " "),
          ...item.exampleQuestions,
        ]) {
          const normalizedPhrase = normalize(phrase);
          if (query === normalizedPhrase) score += 12;
          else if (
            query.includes(normalizedPhrase) ||
            normalizedPhrase.includes(query)
          )
            score += 5;
        }
        for (const keyword of item.keywords) {
          const key = normalize(keyword);
          if (query.includes(key)) score += key.includes(" ") ? 5 : 2.5;
        }
        for (const [term, values] of Object.entries(item.synonyms)) {
          if (query.includes(normalize(term))) score += 2;
          for (const synonym of values)
            if (query.includes(normalize(synonym))) score += 2.5;
        }
        score +=
          Math.max(
            ...item.exampleQuestions.map((q) => similarity(query, q)),
            0,
          ) * 6;
        if (query.includes(normalize(item.category))) score += 2;
        if (state?.activeIntent === item.intent) score += 1.8;
        if (state?.currentTopic === item.category) score += 1;
        if (
          item.intent === "event_security_quote" &&
          /\b(event|concert|conference|festival|wedding|venue)\b/.test(query)
        )
          score += 7;
        if (
          item.emergencyFlag &&
          /\b(non emergency|not an emergency|no immediate danger)\b/.test(query)
        )
          score -= 20;
        for (const negative of item.negativeKeywords)
          if (queryTokens.has(normalize(negative))) score -= 5;
        return { item, score };
      })
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const confidence = best ? Math.min(0.99, best.score / 12) : 0;
    const accepted = Boolean(
      best &&
      (best.score >= 3.2 ||
        (state?.activeIntent === best.item.intent && best.score >= 1.5)),
    );
    return {
      selectedIntent: accepted ? best.item.intent : null,
      confidence: accepted ? confidence : Math.min(confidence, 0.39),
      alternativeIntents: ranked
        .slice(accepted ? 1 : 0, accepted ? 4 : 3)
        .filter((x) => x.score > 0)
        .map((x) => x.item.intent),
      matchingKnowledgeEntryIds: ranked
        .filter((x) => x.score > 0)
        .slice(0, 3)
        .map((x) => x.item.id),
      entry: accepted ? best.item : null,
    };
  }
}

const blankState = (mode: Mode): ConversationState => ({
  currentDomain: mode,
  currentTopic: null,
  activeIntent: null,
  priorUserRequest: null,
  collectedFields: {},
  missingRequiredFields: [],
  lastAssistantQuestion: null,
  completedWorkflow: false,
  escalationStatus: "none",
  activeEntryId: null,
});
const fieldPrompt: Record<string, string> = {
  "payroll issue type":
    "Which payroll issue best describes this: missing hours, incorrect rate, overtime, missing paycheck, or deductions?",
  "affected pay period": "Which pay period or work date is affected?",
  "affected date": "What date was affected?",
  "issue summary": "Briefly, what happened?",
  "schedule issue":
    "Is the schedule missing, incorrect, or are you requesting a shift change?",
  "affected shift": "Which date and shift are affected?",
  "supervisor notification status": "Have you notified your supervisor?",
  "estimated arrival or absence":
    "What is your estimated arrival time, or will you miss the full shift?",
  "leave type":
    "Is this planned leave, emergency absence, sick leave, or a leave-status question?",
  "start date": "What date should the leave begin?",
  "uniform issue type":
    "Is the item damaged, lost, the wrong size, never received, or a new issue?",
  item: "Which item is affected?",
  "equipment issue type":
    "Is the equipment lost, damaged, not received, or due for replacement?",
  "immediate danger status":
    "Is anyone in immediate danger or in need of emergency help right now?",
  "incident type":
    "Is this an injury, vehicle accident, client-site incident, damaged property, or lost equipment?",
  "fleet issue type":
    "Is this a vehicle breakdown, fuel-card issue, collision, or another fleet problem?",
  "immediate safety status": "Is everyone currently in a safe location?",
  "affected system":
    "Which system is affected—M3dyHub, Outlook, Teams, or something else?",
  "affected application": "Is the problem with Outlook or Teams?",
  "problem summary": "What happens when you try to use it?",
  "access problem":
    "Is the account locked, is the password forgotten, or does sign-in fail another way?",
  "request or item": "Which request or item do you need help with?",
  "department or issue":
    "Which department or issue should the escalation concern?",
  "service location": "What city and state is the requested service location?",
  "event location": "Where will the event take place?",
  "event date": "What is the event date?",
  "estimated attendance": "Approximately how many people are expected?",
  "requested coverage": "What type and hours of security coverage do you need?",
  name: "What name should the team use for the inquiry?",
  organization: "What organization is this for?",
  "contact method": "Would you prefer contact by email or phone?",
  inquiry: "What would you like the team to know?",
  "request summary": "Briefly, what service do you need?",
  "location or account":
    "Which location or account does the concern relate to?",
  "concern summary": "Briefly, what is the concern?",
  "capability summary":
    "Briefly, what services or capabilities does your organization offer?",
};

const statusDisclaimer = (entry: KnowledgeEntry) => {
  if (entry.sourceStatus === "approved") return undefined;
  if (entry.sourceStatus === "provisional")
    return "PROVISIONAL DEMONSTRATION GUIDANCE — confirm against the current approved SecureMedy source.";
  if (entry.sourceStatus === "demo_only")
    return "DEMONSTRATION-ONLY CONTENT — this is fictional local demo information, not an official SecureMedy record or policy.";
  return "REQUIRES SECUREMEDY CONFIRMATION — an authorized department must confirm this information.";
};
const source = (entry: KnowledgeEntry) => ({
  id: entry.id,
  title: entry.title,
  domain: entry.domain,
  snippet: entry.responseSummary,
  label: entry.sourceLabel,
  status: entry.sourceStatus,
});
const emergencyPattern =
  /\b(911|fire|active threat|active shooter|weapon|gun|violence|violent|immediate danger|life threatening|not breathing|severe bleeding|medical emergency)\b/i;
const greetings = [
  "Hello—how can I help today?",
  "Hi. What can I help you with?",
  "Welcome. Tell me what you need help with.",
];
const inferFields = (entry: KnowledgeEntry, input: string) => {
  const q = normalize(input);
  const values: Record<string, string> = {};
  if (entry.intent === "payroll_issue") {
    for (const value of [
      "missing hours",
      "incorrect rate",
      "overtime",
      "missing paycheck",
      "deductions",
      "paystub access",
    ])
      if (
        q.includes(value) ||
        (value === "paystub access" && q.includes("paystub"))
      )
        values["payroll issue type"] = value;
  }
  if (entry.intent === "uniform_request") {
    for (const value of [
      "damaged item",
      "lost item",
      "wrong size",
      "never received",
      "new issue",
    ])
      if (q.includes(value.replace(" item", "")))
        values["uniform issue type"] = value;
    for (const item of ["pants", "shirt", "jacket", "boots"])
      if (q.includes(item)) values.item = item;
  }
  if (entry.intent === "leave_request") {
    for (const value of [
      "planned leave",
      "emergency absence",
      "sick leave",
      "leave status",
    ])
      if (q.includes(value) || (value === "sick leave" && q.includes("sick")))
        values["leave type"] = value;
  }
  if (entry.intent === "incident_report") {
    for (const value of [
      "injury",
      "vehicle accident",
      "client site incident",
      "damaged property",
      "lost equipment",
    ])
      if (q.includes(value)) values["incident type"] = value;
  }
  if (entry.intent === "fleet_issue") {
    if (/breakdown|broke down/.test(q))
      values["fleet issue type"] = "vehicle breakdown";
    if (/fuel card|fuelcard|gas card/.test(q))
      values["fleet issue type"] = "fuel-card issue";
  }
  if (
    /\b(today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(
      q,
    )
  ) {
    const date =
      q.match(
        /\b(today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
      )?.[0] || "";
    for (const field of [
      "affected pay period",
      "affected date",
      "affected shift",
      "start date",
      "event date",
    ])
      if (entry.requiredFields.includes(field)) values[field] = date;
  }
  return values;
};

export class ConversationEngine {
  private states = new Map<string, ConversationState>();
  readonly matcher = new DeterministicIntentMatcher();
  constructor(
    private unansweredFile = path.resolve(
      fs.existsSync(path.resolve(process.cwd(), "data"))
        ? process.cwd()
        : path.resolve(process.cwd(), "../.."),
      "data/unanswered-questions.json",
    ),
  ) {}
  getState(key: string, mode: Mode) {
    return this.states.get(key) || blankState(mode);
  }
  reset(key?: string) {
    if (key) this.states.delete(key);
    else this.states.clear();
  }
  private saveUnanswered(mode: Mode, question: string, alternatives: string[]) {
    let current: unknown[] = [];
    try {
      current = JSON.parse(fs.readFileSync(this.unansweredFile, "utf8"));
    } catch {
      /* empty local log */
    }
    fs.mkdirSync(path.dirname(this.unansweredFile), { recursive: true });
    fs.writeFileSync(
      this.unansweredFile,
      JSON.stringify(
        [
          {
            id: `UN-${Date.now()}`,
            mode,
            question,
            alternatives,
            createdAt: new Date().toISOString(),
            status: "demo_only",
          },
          ...current,
        ].slice(0, 250),
        null,
        2,
      ),
    );
  }
  respond(
    mode: Mode,
    key: string,
    input: string,
    user?: EmployeeProfile,
  ): AssistantResponse {
    const normalized = normalize(input);
    if (
      /^(reset|start over|reset conversation|clear conversation)$/.test(
        normalized,
      )
    ) {
      this.reset(key);
      return AssistantResponseSchema.parse({
        message:
          "The conversation has been reset. What would you like help with?",
        intent: "conversation_reset",
        confidence: 1,
        actions: [],
        suggestedQuestions:
          mode === "public"
            ? ["Explore services", "Request a quote", "Careers"]
            : ["Payroll", "Schedule", "Uniforms", "IT Support"],
        escalation: null,
        sources: [],
      });
    }
    const explicitlyNonEmergency =
      /\b(non[ -]?emergency|not an emergency|no immediate danger)\b/i.test(
        input,
      );
    if (emergencyPattern.test(input) && !explicitlyNonEmergency) {
      const emergency = knowledgeFor(mode).find(
        (x) => x.intent === "emergency",
      )!;
      return this.build(
        emergency,
        {
          selectedIntent: "emergency",
          confidence: 1,
          alternativeIntents: [],
          matchingKnowledgeEntryIds: [emergency.id],
          entry: emergency,
        },
        [],
        emergency.responseSummary,
      );
    }
    if (
      /^(hi|hello|hey|good morning|good afternoon|good evening)[.! ]*$/.test(
        normalized,
      )
    ) {
      const index =
        (this.states.get(key)?.priorUserRequest?.length || 0) %
        greetings.length;
      return AssistantResponseSchema.parse({
        message: `${greetings[index]}${user ? `, ${user.firstName}` : ""}`,
        intent: "greeting",
        confidence: 1,
        actions: [],
        suggestedQuestions:
          mode === "public"
            ? ["Explore services", "Request a quote", "Careers"]
            : ["Payroll", "My schedule", "Uniforms", "IT Support"],
        escalation: null,
        sources: [],
      });
    }
    const state = this.getState(key, mode);
    const active = state.activeEntryId
      ? knowledgeFor(mode).find((x) => x.id === state.activeEntryId)
      : undefined;
    const prospective = this.matcher.match(mode, input, state);
    const isNewStrongIntent = Boolean(
      prospective.entry &&
      prospective.entry.id !== active?.id &&
      prospective.confidence >= 0.75 &&
      /\b(help|need|want|show|find|what|how|where|can|question|problem|issue)\b/.test(
        normalized,
      ),
    );
    if (
      active &&
      state.missingRequiredFields.length &&
      input.length <= 120 &&
      !isNewStrongIntent
    ) {
      const field = state.missingRequiredFields[0];
      state.collectedFields[field] = input.trim();
      state.missingRequiredFields = active.requiredFields.filter(
        (x) => !state.collectedFields[x],
      );
      state.priorUserRequest = input;
      if (state.missingRequiredFields.length) {
        const question =
          fieldPrompt[state.missingRequiredFields[0]] ||
          `Please provide ${state.missingRequiredFields[0]}.`;
        state.lastAssistantQuestion = question;
        this.states.set(key, state);
        return this.build(
          active,
          {
            selectedIntent: active.intent,
            confidence: 0.92,
            alternativeIntents: [],
            matchingKnowledgeEntryIds: [active.id],
            entry: active,
          },
          state.missingRequiredFields,
          `Thanks. ${question}`,
        );
      }
      state.completedWorkflow = true;
      state.lastAssistantQuestion = null;
      this.states.set(key, state);
      return this.build(
        active,
        {
          selectedIntent: active.intent,
          confidence: 0.94,
          alternativeIntents: [],
          matchingKnowledgeEntryIds: [active.id],
          entry: active,
        },
        [],
        `Thanks—I have the demonstration details needed to start this workflow. ${active.responseSummary}`,
      );
    }
    const match = prospective;
    if (!match.entry) {
      const alternatives = match.alternativeIntents.slice(0, 3);
      this.saveUnanswered(mode, input, alternatives);
      const labels = alternatives
        .map(
          (intent) =>
            knowledgeFor(mode).find((x) => x.intent === intent)?.title,
        )
        .filter(Boolean) as string[];
      return AssistantResponseSchema.parse({
        message: labels.length
          ? `I’m not confident enough to answer that safely. Did you mean ${labels.join(", ")}, or would you like department assistance?`
          : "I’m not confident enough to answer that safely. Please choose a supported topic or ask for department assistance.",
        intent: "low_confidence_clarification",
        confidence: match.confidence,
        actions: [
          {
            id: "handoff",
            type: "escalate",
            label: "Request Department Help",
            requiresConfirmation: false,
          },
        ],
        suggestedQuestions: labels,
        escalation: "Department routing available",
        sources: [],
        alternativeIntents: alternatives,
        matchingKnowledgeEntryIds: match.matchingKnowledgeEntryIds,
      });
    }
    const selected = match.entry;
    state.currentDomain = mode;
    state.currentTopic = selected.category;
    state.activeIntent = selected.intent;
    state.activeEntryId = selected.id;
    state.priorUserRequest = input;
    state.completedWorkflow = false;
    state.collectedFields = inferFields(selected, input);
    state.missingRequiredFields = selected.requiredFields.filter(
      (field) => !state.collectedFields[field],
    );
    if (selected.escalationDepartment) state.escalationStatus = "offered";
    const firstMissing = state.missingRequiredFields[0];
    const question = firstMissing
      ? fieldPrompt[firstMissing] || `Please provide ${firstMissing}.`
      : null;
    state.lastAssistantQuestion = question;
    this.states.set(key, state);
    const message = question
      ? `${selected.responseSummary}\n\n${question}`
      : selected.responseSummary;
    return this.build(selected, match, state.missingRequiredFields, message);
  }
  private build(
    entry: KnowledgeEntry,
    match: IntentMatch,
    missing: string[],
    message: string,
  ) {
    const disclaimer = statusDisclaimer(entry);
    return AssistantResponseSchema.parse({
      message: disclaimer ? `${disclaimer}\n\n${message}` : message,
      intent: entry.intent,
      confidence: match.confidence,
      actions: entry.availableActions,
      suggestedQuestions: entry.suggestedReplies,
      escalation: entry.escalationDepartment,
      sources: [source(entry)],
      alternativeIntents: match.alternativeIntents,
      matchingKnowledgeEntryIds: match.matchingKnowledgeEntryIds,
      disclaimer,
      missingRequiredFields: missing,
    });
  }
}

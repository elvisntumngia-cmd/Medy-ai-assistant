import {
  AssistantResponseSchema,
  type AssistantResponse,
  type AssistantAction,
} from "./index.js";
export const welcome =
  "Hi! I'm Medy, Securemedy's AI assistant. How can I help you today?";
export const companyCopy = (text: string) =>
  text.replace(/https?:\/\/\S+|\bsecuremedy\b/gi, (value) =>
    /^https?:/i.test(value) ? value : "Securemedy",
  );
export function supportedPublicUrl(value: string) {
  try {
    const url = new URL(value);
    const path = decodeURIComponent(decodeURIComponent(url.pathname));
    return (
      url.protocol === "https:" &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      [
        "securemedy.ng",
        "www.securemedy.ng",
        "securemedy.com",
        "www.securemedy.com",
        "my.securemedy.com",
      ].includes(url.hostname) &&
      !/wp-admin|wp-json|wp-login|xmlrpc|logout|\.(?:zip|exe)$/i.test(path)
    );
  } catch {
    return false;
  }
}
export function linkLabel(url: string) {
  const parsed = new URL(url);
  if (parsed.hostname === "my.securemedy.com") return "Employee Portal";
  if (parsed.pathname === "/careers/") return "View Current Job Openings";
  if (parsed.pathname.includes("/careers/jobs/"))
    return "View Role and Application Details";
  if (parsed.pathname === "/contact/") return "Contact Our Team";
  if (parsed.pathname === "/services/") return "View Our Services";
  const name = parsed.pathname
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.replace(/-/g, " ");
  return name ? "Explore " + name : "Visit Our Website";
}
export function extractPublicLinks(text: string) {
  const actions: AssistantAction[] = [];
  const add = (url: string) => {
    if (supportedPublicUrl(url))
      actions.push({
        id: "text-link-" + actions.length,
        type: "open_external",
        label: linkLabel(url),
        target: url,
        requiresConfirmation: false,
      });
  };
  let message = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi,
    (_all, label, url) => {
      add(url);
      return label;
    },
  );
  message = message.replace(/https?:\/\/[^\s<>]+/gi, (raw) => {
    const url = raw.replace(/[.,;!?)]+$/, "");
    add(url);
    return supportedPublicUrl(url)
      ? "the button below"
      : "[unsupported link removed]";
  });
  return { message: companyVoice(message), actions };
}
export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  response?: AssistantResponse;
};
export type ChatSession = {
  id: string;
  turns: ChatTurn[];
  savedAt: number;
  open: boolean;
};
export const newConversationId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "medy-" + Date.now() + "-" + Math.random().toString(36).slice(2);
export const sessionKey = (api: string) =>
  "medy:public:v3:" + new URL(api, location.href).href.replace(/\/$/, "");
const privateDetails =
  /password|verification code|one[- ]time code|access code|social security|\bssn\b|bank account|routing number|api[_ -]?key|\bsk-[a-z0-9_-]{12,}/i;
export function safeSessionText(text: string) {
  if (privateDetails.test(text))
    return "[Sensitive message omitted from saved chat]";
  return text
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?1[- .]?)?\(?\d{3}\)?[- .]\d{3}[- .]\d{4}|\b\d{9,15}\b|\+\d[\d ()-]{6,18}\d/gi,
      "[contact detail omitted]",
    )
    .slice(0, 2000);
}
function sanitizeTurn(turn: ChatTurn): ChatTurn {
  const content = safeSessionText(turn.content);
  const response = turn.response
    ? {
        ...turn.response,
        message: content,
        data: undefined,
        escalation: null,
        actions: turn.response.actions
          .filter(
            (a) =>
              (a.type === "start_form" &&
                a.id === "request-security-services") ||
              (a.type === "open_external" &&
                !!a.target &&
                supportedPublicUrl(a.target)),
          )
          .map((a) => ({
            ...a,
            data: undefined,
            label: safeSessionText(a.label),
          })),
        sources: turn.response.sources
          .map((s) => ({
            ...s,
            snippet: "Approved public source",
            title: safeSessionText(s.title),
          }))
          .filter((s) => !s.url || supportedPublicUrl(s.url)),
        suggestedQuestions:
          turn.response.suggestedQuestions.map(safeSessionText),
      }
    : undefined;
  return { role: turn.role, content, response };
}
export function saveChatSession(key: string, session: ChatSession) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        ...session,
        savedAt: Date.now(),
        turns: session.turns.slice(-40).map(sanitizeTurn),
      }),
    );
  } catch {
    /* Storage is optional. */
  }
}
export function loadChatSession(key: string): ChatSession | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    if (raw.length > 180000) throw new Error("Too large");
    const value = JSON.parse(raw);
    if (
      typeof value.id !== "string" ||
      value.id.length > 120 ||
      !Array.isArray(value.turns) ||
      value.turns.length > 40 ||
      !Number.isFinite(value.savedAt) ||
      Date.now() - value.savedAt > 12 * 60 * 60 * 1000 ||
      value.savedAt > Date.now() + 60000
    )
      throw new Error("Invalid session");
    const turns = value.turns.map((turn: ChatTurn) => {
      if (
        !["user", "assistant"].includes(turn.role) ||
        typeof turn.content !== "string"
      )
        throw new Error("Invalid turn");
      return sanitizeTurn({
        ...turn,
        response: turn.response
          ? AssistantResponseSchema.parse(turn.response)
          : undefined,
      });
    });
    return {
      id: value.id,
      turns,
      savedAt: value.savedAt,
      open: value.open === true,
    };
  } catch {
    clearChatSession(key);
    return;
  }
}
export function clearChatSession(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* optional */
  }
}
export function revealText(
  node: HTMLElement,
  text: string,
  signal: AbortSignal,
  scroll: () => void = () => {},
) {
  if (signal.aborted)
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  if (
    typeof matchMedia !== "function" ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    node.textContent = text;
    scroll();
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    let count = 0;
    const characters = Array.from(text);
    node.setAttribute("aria-live", "off");
    const stop = () => {
      clearInterval(timer);
      signal.removeEventListener("abort", abort);
      node.removeAttribute("aria-live");
    };
    const abort = () => {
      stop();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setInterval(() => {
      count += Math.max(12, Math.ceil(characters.length / 12));
      node.textContent = characters.slice(0, count).join("");
      scroll();
      if (count >= characters.length) {
        stop();
        resolve();
      }
    }, 25);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export function companyVoice(text: string) {
  return companyCopy(text)
    .replace(/Securemedy[\u2019']s team/g, "Our team")
    .replace(
      /\bSecuremedy (provides|offers|serves|supports|lists|can|is|has)\b/g,
      (_all, verb: string) =>
        "We " +
        {
          provides: "provide",
          offers: "offer",
          serves: "serve",
          supports: "support",
          lists: "list",
          can: "can",
          is: "are",
          has: "have",
        }[verb],
    );
}

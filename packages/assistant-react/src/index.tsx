import { useEffect, useMemo, useState, useRef } from "react";
import { ApiClient, type NavigationAdapter } from "@medy/assistant-core";
import {
  welcome,
  companyCopy,
  supportedPublicUrl,
  sessionKey,
  loadChatSession,
  saveChatSession,
  clearChatSession,
  newConversationId,
  revealText,
  type ChatTurn,
  type AssistantAction,
  type AssistantResponse,
  type EmployeeProfile,
  type Mode,
} from "@medy/shared";
import "./styles.css";

type Message = {
  role: "user" | "assistant";
  content: string;
  response?: AssistantResponse;
};
export type MedyAssistantProps = {
  mode: Mode;
  apiUrl: string;
  sessionId?: string;
  user?: EmployeeProfile;
  navigation: NavigationAdapter;
  variant?: "floating" | "workspace";
  quickActions?: string[];
  onRequestServices?: () => void;
};
export function MedyAssistant({
  mode,
  apiUrl,
  sessionId = "demo-default",
  user,
  navigation,
  variant = "floating",
  quickActions,
  onRequestServices,
}: MedyAssistantProps) {
  const client = useMemo(
    () => new ApiClient(apiUrl, sessionId),
    [apiUrl, sessionId],
  );
  const [open, setOpen] = useState(variant === "workspace");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyActions, setBusyActions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | undefined>(undefined);
  const messagesRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(newConversationId());
  const key = mode === "public" ? sessionKey(apiUrl) : "";
  const greeting =
    mode === "employee"
      ? `Hello, ${user?.firstName || "there"}. How can I help with M3dyHub today?`
      : welcome;
  useEffect(() => {
    const saved = key ? loadChatSession(key) : undefined;
    if (saved) {
      idRef.current = saved.id;
      client.setConversationId(saved.id);
      setMessages([{ role: "assistant", content: greeting }, ...saved.turns]);
    } else {
      client.setConversationId(idRef.current);
      setMessages([{ role: "assistant", content: greeting }]);
    }
    return () => {
      requestRef.current?.abort();
    };
  }, [greeting, key, client]);
  useEffect(() => {
    messagesRef.current?.scrollTo?.(0, messagesRef.current.scrollHeight);
  }, [messages, busy]);
  const persist = (turns: Message[]) => {
    if (key)
      saveChatSession(key, {
        id: idRef.current,
        turns: turns.slice(1) as ChatTurn[],
        savedAt: Date.now(),
        open: true,
      });
  };
  function reset() {
    requestRef.current?.abort();
    requestRef.current = undefined;
    idRef.current = newConversationId();
    client.setConversationId(idRef.current);
    if (key) clearChatSession(key);
    setMessages([{ role: "assistant", content: greeting }]);
    setBusy(false);
    setInput("");
    setError("");
  }
  async function send(text = input) {
    if (!text.trim() || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    persist(next);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const response = await client.chat(
        mode,
        next.map(({ role, content }) => ({ role, content })),
        undefined,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const complete = [
        ...next,
        { role: "assistant" as const, content: response.message, response },
      ];
      const node = document.createElement("span");
      const observer = new MutationObserver(() => {
        if (!controller.signal.aborted)
          setMessages([
            ...next,
            { role: "assistant", content: node.textContent || "" },
          ]);
      });
      observer.observe(node, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      try {
        await revealText(node, response.message, controller.signal);
      } finally {
        observer.disconnect();
      }
      if (controller.signal.aborted) return;
      setMessages(complete);
      persist(complete);
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error ? error.message : "Assistant unavailable",
        );
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = undefined;
        setBusy(false);
      }
    }
  }
  async function act(action: AssistantAction) {
    if (
      mode === "public" &&
      !(
        action.type === "start_form" &&
        action.id === "request-security-services"
      ) &&
      !(
        action.type === "open_external" &&
        action.target &&
        supportedPublicUrl(action.target)
      )
    )
      return;
    if (action.type === "start_form") {
      if (onRequestServices) onRequestServices();
      else navigation.openExternal("https://securemedy.ng/contact/");
      return;
    }
    if (action.type === "navigate" && action.target)
      return navigation.navigate(action.target);
    if (
      action.type === "open_external" &&
      action.target &&
      supportedPublicUrl(action.target)
    ) {
      if (
        mode === "public" &&
        new URL(action.target).origin === location.origin
      ) {
        persist(messages);
        location.assign(action.target);
        return;
      }
      return navigation.openExternal(action.target);
    }
    if (
      action.requiresConfirmation &&
      !window.confirm("This is a simulated write action. Continue?")
    )
      return;
    if (busyActions.includes(action.id)) return;
    if (action.type === "show_data") {
      setMessages((value) => [
        ...value,
        {
          role: "assistant",
          content: "The available details are shown above.",
        },
      ]);
      return;
    }
    setBusyActions((value) => [...value, action.id]);
    try {
      await client.post("/demo/actions", { action, confirmed: true });
      if (action.type === "submit_mock_request")
        setMessages((value) => [
          ...value,
          {
            role: "assistant",
            content: `${action.label} was submitted as a fictional demonstration request.`,
          },
        ]);
      if (action.type === "contact_department" || action.type === "escalate")
        setMessages((v) => [
          ...v,
          {
            role: "assistant",
            content: `Demonstration handoff recorded for ${action.target || action.label}.`,
          },
        ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyActions((value) => value.filter((id) => id !== action.id));
    }
  }
  if (!open)
    return (
      <button
        className="medy-launch"
        aria-label="Open Medy Assistant"
        onClick={() => setOpen(true)}
      >
        <span className="medy-launch-icon" aria-hidden="true">
          ✦
        </span>
        <span className="medy-launch-copy">
          <strong>Ask Medy</strong>
          <small>Employee support</small>
        </span>
      </button>
    );
  return (
    <section
      className={`medy-assistant medy-${variant}`}
      aria-label="Medy Assistant"
    >
      <header>
        <div>
          <strong>Medy Assistant</strong>
          <small>
            {mode === "employee" ? "Employee support" : "Securemedy support"}
          </small>
        </div>
        {variant === "floating" && (
          <button aria-label="Close assistant" onClick={() => setOpen(false)}>
            ×
          </button>
        )}
      </header>
      <div
        ref={messagesRef}
        className="medy-messages"
        aria-live="polite"
        role="log"
      >
        {messages.map((m, i) => (
          <article key={i} className={m.role}>
            {m.role === "assistant" && (
              <span className="medy-avatar" aria-hidden="true">
                M
              </span>
            )}
            <p>{companyCopy(m.content)}</p>
            {m.response?.data && (
              <pre>{JSON.stringify(m.response.data, null, 2)}</pre>
            )}
            <div className="medy-actions">
              {m.response?.actions.map((a) => (
                <button
                  key={a.id}
                  disabled={busyActions.includes(a.id)}
                  onClick={() => void act(a)}
                >
                  {companyCopy(a.label)}
                </button>
              ))}
            </div>
            {m.response?.sources.map((s) => (
              <small className="medy-source" key={s.id}>
                Source:{" "}
                {s.url && supportedPublicUrl(s.url) ? (
                  <a
                    href={s.url}
                    target={
                      new URL(s.url).origin === location.origin
                        ? "_self"
                        : "_blank"
                    }
                    rel="noopener noreferrer"
                  >
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
              </small>
            ))}
            {m.response?.suggestedQuestions.map((q) => (
              <button
                className="medy-suggestion"
                key={q}
                onClick={() => void send(q)}
              >
                {q}
              </button>
            ))}
            {m.response?.escalation && <aside>{m.response.escalation}</aside>}
          </article>
        ))}
        {busy && messages.at(-1)?.role === "user" && (
          <p className="medy-typing" role="status" aria-label="Medy is typing">
            <span />
            <span />
            <span />
          </p>
        )}
        {error && <p className="medy-error">{error}</p>}
      </div>
      {messages.length === 1 && (
        <div className="medy-quick">
          {(
            quickActions || [
              ...(mode === "public"
                ? ["Explore services", "Request security services", "Careers"]
                : [
                    "My Requests",
                    "Payroll",
                    "Uniforms",
                    "Training",
                    "IT Support",
                  ]),
            ]
          ).map((q) => (
            <button key={q} onClick={() => void send(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          rows={2}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void send();
            }
          }}
          maxLength={2000}
          aria-label="Message Medy Assistant"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question…"
        />
        <button disabled={busy}>Send</button>
        <button type="button" onClick={reset}>
          New conversation
        </button>
      </form>
      {mode === "public" && (
        <details className="medy-disclosure">
          <summary>Privacy &amp; safety</summary>
          <p>
            AI-assisted chat may use OpenAI. Keep questions public; use the
            consent form for contact details. For immediate danger, call local
            emergency services. Medy cannot dispatch help.
          </p>
          <a
            href="https://securemedy.ng/privacy-policy/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy Policy
          </a>
        </details>
      )}
    </section>
  );
}
export default MedyAssistant;

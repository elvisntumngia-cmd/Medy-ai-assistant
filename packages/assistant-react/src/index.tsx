import { useEffect, useMemo, useState } from "react";
import { ApiClient, type NavigationAdapter } from "@medy/assistant-core";
import type {
  AssistantAction,
  AssistantResponse,
  EmployeeProfile,
  Mode,
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
};
export function MedyAssistant({
  mode,
  apiUrl,
  sessionId = "demo-default",
  user,
  navigation,
  variant = "floating",
  quickActions,
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
  const greeting =
    mode === "employee"
      ? `Hello, ${user?.firstName || "there"}. How can I help with M3dyHub today?`
      : "Hello. I’m Medy Assistant. I can help with SecureMedy services or support requests.";
  useEffect(
    () => setMessages([{ role: "assistant", content: greeting }]),
    [greeting],
  );
  async function send(text = input) {
    if (!text.trim() || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const response = await client.chat(
        mode,
        next.map(({ role, content }) => ({ role, content })),
      );
      setMessages((v) => [
        ...v,
        { role: "assistant", content: response.message, response },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assistant unavailable");
    } finally {
      setBusy(false);
    }
  }
  async function resetConversation() {
    if (busy) return;
    setBusy(true);
    try {
      await client.chat(mode, [
        { role: "user", content: "reset conversation" },
      ]);
      setMessages([{ role: "assistant", content: greeting }]);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset unavailable");
    } finally {
      setBusy(false);
    }
  }
  async function act(action: AssistantAction) {
    if (action.type === "navigate" && action.target)
      return navigation.navigate(action.target);
    if (action.type === "open_external" && action.target)
      return navigation.openExternal(action.target);
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
            {mode === "employee" ? "Employee support" : "SecureMedy support"}
          </small>
        </div>
        {variant === "floating" && (
          <button aria-label="Close assistant" onClick={() => setOpen(false)}>
            ×
          </button>
        )}
      </header>
      <div className="medy-messages" aria-live="polite">
        {messages.map((m, i) => (
          <article key={i} className={m.role}>
            <p>{m.content}</p>
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
                  {a.label}
                </button>
              ))}
            </div>
            {m.response?.sources.map((s) => (
              <small key={s.id}>
                Source: {s.title} · demonstration content
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
        {busy && <p>Reviewing your request…</p>}
        {error && <p className="medy-error">{error}</p>}
      </div>
      {messages.length === 1 && (
        <div className="medy-quick">
          {(
            quickActions || [
              "My Requests",
              "Payroll",
              "Uniforms",
              "Training",
              "IT Support",
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
        <input
          aria-label="Message Medy Assistant"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question…"
        />
        <button disabled={busy}>Send</button>
        <button type="button" onClick={() => void resetConversation()}>
          Reset
        </button>
      </form>
    </section>
  );
}
export default MedyAssistant;

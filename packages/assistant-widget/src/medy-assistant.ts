import {
  AssistantResponseSchema,
  type AssistantAction as Action,
  type AssistantResponse as Reply,
} from "@medy/shared";
const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
class MedyAssistantWidget extends HTMLElement {
  root = this.attachShadow({ mode: "open" });
  api = "http://localhost:4180/api";
  messages = el("div", "messages");
  panel = el("section", "panel");
  input = el("input");
  conversationId = `public-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  connectedCallback() {
    this.api = this.dataset.apiUrl || this.api;
    const style = el("style");
    style.textContent = `:host{--blue:#1478d4;--navy:#071c34;font-family:system-ui;color:#172638}.launch{position:fixed;right:24px;bottom:24px;border:0;border-radius:999px;padding:15px 20px;background:var(--blue);color:#fff;font-weight:700;z-index:30}.panel{display:none;position:fixed;right:24px;bottom:24px;width:390px;height:min(650px,calc(100vh - 48px));background:#fff;border:1px solid #dce5ec;border-radius:14px;box-shadow:0 24px 70px #001b3830;z-index:31;overflow:hidden}.open{display:flex;flex-direction:column}header{background:var(--navy);color:#fff;padding:16px;display:flex;justify-content:space-between}header button{background:none;color:#fff;border:0}.messages{flex:1;overflow:auto;padding:16px;background:#f5f8fb}.messages p{background:#fff;padding:10px;border-radius:8px}.actions,.suggestions{display:flex;flex-wrap:wrap;gap:6px}.actions button,.suggestions button{border:1px solid #b8d5ec;background:#fff;color:#0d64ad;border-radius:7px;padding:8px}.composer{display:flex;gap:7px;padding:12px}.composer input{flex:1;min-width:0;padding:10px}.composer button,.primary{border:0;background:var(--blue);color:#fff;border-radius:6px;padding:9px}.lead{padding:16px;overflow:auto}.lead label{display:flex;flex-direction:column;margin:8px 0;font-size:12px}.lead input,.lead select{padding:8px}.summary{white-space:pre-wrap;background:#f5f8fb;padding:10px}@media(max-width:500px){.panel{inset:0;width:100%;height:100%;border-radius:0}}`;
    const launch = el("button", "launch", "Ask Medy");
    launch.setAttribute("aria-label", "Open Medy Assistant");
    const header = el("header");
    header.append(el("strong", "", "Medy Assistant"));
    const close = el("button", "", "×");
    close.setAttribute("aria-label", "Close Medy Assistant");
    header.append(close);
    this.panel.setAttribute("aria-label", "Medy Assistant");
    this.panel.append(header, this.messages);
    const form = el("form", "composer");
    this.input.setAttribute("aria-label", "Message Medy Assistant");
    this.input.placeholder = "Type your question…";
    const send = el("button", "", "Send");
    form.append(this.input, send);
    this.panel.append(form);
    this.root.append(style, launch, this.panel);
    this.addMessage(
      "Hello. I’m Medy Assistant. I can help with SecureMedy services or a demonstration service request.",
    );
    this.suggestions([
      "Request security services",
      "Explore services",
      "Careers",
      "Emergency help",
    ]);
    launch.onclick = () => {
      this.panel.classList.add("open");
      launch.hidden = true;
      this.input.focus();
    };
    close.onclick = () => {
      this.panel.classList.remove("open");
      launch.hidden = false;
      launch.focus();
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      void this.send(this.input.value);
    };
  }
  addMessage(text: string) {
    this.messages.append(el("p", "", text));
    this.messages.scrollTop = this.messages.scrollHeight;
  }
  suggestions(items: string[]) {
    const row = el("div", "suggestions");
    items.forEach((q) => {
      const b = el("button", "", q);
      b.onclick = () => void this.send(q);
      row.append(b);
    });
    this.messages.append(row);
  }
  async send(text: string) {
    if (!text.trim()) return;
    this.addMessage(text);
    this.input.value = "";
    this.input.disabled = true;
    const loading = el("p", "loading", "Reviewing your request…");
    this.messages.append(loading);
    try {
      const r = await fetch(`${this.api}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "public",
          conversationId: this.conversationId,
          messages: [{ role: "user", content: text }],
        }),
      });
      const payload: unknown = await r.json();
      if (!r.ok) throw new Error();
      const reply: Reply = AssistantResponseSchema.parse(payload);
      loading.remove();
      this.addMessage(reply.message);
      const actions = el("div", "actions");
      reply.actions?.forEach((a) => {
        const b = el("button", "", a.label);
        b.dataset.action = a.id;
        b.onclick = () => this.action(a);
        actions.append(b);
      });
      this.messages.append(actions);
      this.suggestions(reply.suggestedQuestions || []);
    } catch {
      loading.textContent =
        "Medy Assistant is temporarily unavailable. Please try again.";
    } finally {
      this.input.disabled = false;
      this.input.focus();
    }
  }
  action(action: Action) {
    if (action.type === "start_form") return this.leadForm();
    if (action.type === "open_external" && action.target)
      return window.open(action.target, "_blank", "noopener");
    if (action.type === "escalate")
      this.addMessage(
        "A demonstration handoff was noted. No real message was sent.",
      );
  }
  leadForm() {
    this.messages.hidden = true;
    const old = this.panel.querySelector(".lead");
    old?.remove();
    const form = el("form", "lead");
    const fields = [
      ["fullName", "Full name"],
      ["organization", "Organization"],
      ["email", "Email"],
      ["phone", "Phone"],
      ["serviceLocation", "Service location"],
      ["propertyType", "Facility or property type"],
      ["requestedService", "Requested service"],
      ["armedPreference", "Armed preference"],
      ["officerCount", "Number of officers"],
      ["coverageSchedule", "Coverage schedule"],
      ["desiredStartDate", "Desired start date"],
      ["additionalDetails", "Additional details"],
      ["preferredContactMethod", "Preferred contact method"],
    ];
    const inputs: Record<string, HTMLInputElement> = {};
    fields.forEach(([name, label]) => {
      const wrap = el("label", "", label);
      const input = el("input");
      input.name = name;
      input.required = name !== "additionalDetails";
      if (name === "email") input.type = "email";
      if (name === "officerCount") input.type = "number";
      if (name === "desiredStartDate") input.type = "date";
      inputs[name] = input;
      wrap.append(input);
      form.append(wrap);
    });
    inputs.armedPreference.value = "Not sure";
    inputs.officerCount.value = "1";
    inputs.preferredContactMethod.value = "Email";
    const consent = el("input");
    consent.type = "checkbox";
    consent.required = true;
    const consentLabel = el(
      "label",
      "",
      "I consent to be contacted about this demonstration request.",
    );
    consentLabel.prepend(consent);
    const summary = el("pre", "summary");
    const review = el("button", "primary", "Review request");
    review.type = "button";
    review.onclick = () => {
      const value = Object.fromEntries(
        Object.entries(inputs).map(([k, v]) => [k, v.value]),
      );
      summary.textContent = JSON.stringify(value, null, 2);
    };
    const submit = el("button", "primary", "Save request");
    form.append(consentLabel, review, summary, submit);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const body = {
        ...Object.fromEntries(
          Object.entries(inputs).map(([k, v]) => [k, v.value]),
        ),
        consent: consent.checked,
      };
      const r = await fetch(`${this.api}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        summary.textContent = "Please correct the highlighted information.";
        return;
      }
      form.remove();
      this.messages.hidden = false;
      this.addMessage(
        `Demonstration request ${data.id} was saved locally. No real service was dispatched.`,
      );
    };
    this.panel.insertBefore(form, this.panel.querySelector(".composer"));
    inputs.fullName.focus();
  }
}
if (!customElements.get("medy-assistant"))
  customElements.define("medy-assistant", MedyAssistantWidget);

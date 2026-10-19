import {
  AssistantResponseSchema,
  presentResponse,
  welcome,
  companyCopy,
  supportedPublicUrl,
  safeSessionText,
  sessionKey,
  loadChatSession,
  saveChatSession,
  clearChatSession,
  newConversationId,
  revealText,
  type ChatTurn,
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
  input = el("textarea");
  conversationId = newConversationId();
  history: { role: "user" | "assistant"; content: string }[] = [];
  turns: ChatTurn[] = [];
  storageKey = "";
  request?: AbortController;
  connectedCallback() {
    if (this.root.childElementCount) return;
    this.api = (
      this.getAttribute("api-url") ||
      this.dataset.apiUrl ||
      this.api
    ).replace(/\/$/, "");
    this.storageKey = sessionKey(this.api);
    const saved = loadChatSession(this.storageKey);
    if (saved) {
      this.conversationId = saved.id;
      this.turns = saved.turns;
      this.history = this.turns
        .map(({ role, content }) => ({ role, content }))
        .slice(-20);
    }
    const style = el("style");
    style.textContent = `
:host{--blue:#1268b6;--navy:#071c34;font-family:system-ui,sans-serif;color:#172638;line-height:1.5}*{box-sizing:border-box}button,a,textarea{font:inherit}button,a{touch-action:manipulation}button:focus-visible,a:focus-visible,textarea:focus-visible{outline:3px solid #73b9f3;outline-offset:2px}.launch{position:fixed;right:24px;bottom:24px;border:0;border-radius:999px;padding:15px 20px;background:var(--blue);color:white;font-weight:700;cursor:pointer;z-index:2147483646;box-shadow:0 10px 30px #001b3840}.panel{display:none;position:fixed;right:24px;bottom:24px;width:min(420px,calc(100vw - 32px));height:min(700px,calc(100dvh - 40px));background:white;border:1px solid #dce5ec;border-radius:16px;box-shadow:0 24px 70px #001b3830;z-index:2147483647;overflow:hidden}.open{display:flex;flex-direction:column}header{background:var(--navy);color:white;padding:14px;display:flex;align-items:center;gap:8px}header strong{margin-right:auto}header button{background:none;color:white;border:0;cursor:pointer;font-size:12px}header .close{font-size:24px}.messages{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:18px 12px;background:#f3f7fb;scroll-behavior:smooth}.message{margin:0 0 14px;min-width:0;max-width:96%;display:grid;grid-template-columns:26px minmax(0,1fr);gap:6px}.avatar{width:25px;height:25px;display:grid;place-items:center;border-radius:50%;background:#deebf8;color:#124a79;font-size:12px;font-weight:700}.bubble{grid-column:2;margin:0;padding:11px 13px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal;min-width:0;background:white;border:1px solid #dce5ec;border-radius:3px 14px 14px 14px;line-height:1.6;font-size:14px}.message.user{display:block;margin-left:auto;max-width:86%}.user .bubble{background:#1268b6;border-color:#1268b6;color:white;border-radius:14px 3px 14px 14px}.actions,.suggestions,.form-actions{display:flex;flex-wrap:wrap;gap:7px;grid-column:2;min-width:0}.actions button,.suggestions button,.source{border:1px solid #9fc4e4;background:white;color:#104e83;border-radius:8px;padding:8px 10px;cursor:pointer;white-space:normal;overflow-wrap:anywhere;text-decoration:none;font-size:13px}.source{display:inline-block;grid-column:2}.composer{display:flex;align-items:flex-end;gap:8px;padding:12px;background:white;border-top:1px solid #e1e9f0}.composer textarea{flex:1;min-width:0;resize:vertical;min-height:44px;max-height:120px;padding:10px;border:1px solid #a7b8c7;border-radius:8px;line-height:1.4}.composer button,.primary{border:0;background:var(--blue);color:white;border-radius:8px;padding:11px;cursor:pointer}button:disabled{opacity:.6;cursor:wait}.secondary{border:1px solid #789;background:white;color:#234;border-radius:6px;padding:9px;cursor:pointer}.lead{padding:16px;overflow:auto;min-height:0}.lead label{display:flex;flex-direction:column;margin:8px 0;font-size:12px}.lead input,.lead select{padding:8px;max-width:100%}.summary{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f8fb;padding:10px}.disclosure{padding:5px 12px;font-size:11px;border-top:1px solid #e1e9f0;background:white}.disclosure summary{cursor:pointer}.disclosure p{margin:5px 0}.typing{display:flex;gap:5px;align-items:center;width:62px;height:40px}.typing span{width:7px;height:7px;border-radius:50%;background:#577895;animation:medy-dot 900ms ease-in-out infinite}.typing span:nth-child(2){animation-delay:150ms}.typing span:nth-child(3){animation-delay:300ms}@keyframes medy-dot{50%{opacity:.35;transform:translateY(-3px)}}@media(prefers-reduced-motion:reduce){.typing span{animation:none}.messages{scroll-behavior:auto}}@media(max-width:500px){.panel{inset:0;width:100%;height:100dvh;border-radius:0}.bubble{font-size:16px}.composer textarea{font-size:16px}}
`;
    const launch = el("button", "launch", "Ask Medy");
    launch.setAttribute("aria-label", "Open Medy Assistant");
    const header = el("header");
    header.append(el("strong", "", "Medy Assistant"));
    const reset = el("button", "", "New conversation");
    reset.type = "button";
    reset.onclick = () => this.reset();
    const close = el("button", "close", "\u00d7");
    close.setAttribute("aria-label", "Close Medy Assistant");
    header.append(reset, close);
    this.panel.setAttribute("aria-label", "Medy Assistant");
    this.messages.setAttribute("role", "log");
    this.messages.setAttribute("aria-live", "polite");
    this.messages.setAttribute("aria-relevant", "additions");
    this.panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close.click();
    });
    this.panel.append(header, this.messages);
    const form = el("form", "composer");
    this.input.setAttribute("aria-label", "Message Medy Assistant");
    this.input.maxLength = 2000;
    this.input.rows = 2;
    this.input.placeholder = "Type your question...";
    this.input.onkeydown = (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        void this.send(this.input.value);
      }
    };
    const send = el("button", "", "Send");
    form.append(this.input, send);
    this.panel.append(form);
    const disclosure = el("details", "disclosure");
    disclosure.append(
      el("summary", "", "Privacy & safety"),
      el(
        "p",
        "",
        "AI-assisted chat may use OpenAI. Keep questions public; use the consent form for contact details. For immediate danger, call your local emergency services. Medy cannot dispatch help.",
      ),
    );
    const privacy = el("a", "", "Privacy Policy");
    privacy.href = "https://securemedy.ng/privacy-policy/";
    privacy.target = "_blank";
    privacy.rel = "noopener noreferrer";
    disclosure.append(privacy);
    this.panel.append(disclosure);
    this.root.append(style, launch, this.panel);
    this.addMessage(welcome);
    for (const turn of this.turns) {
      if (turn.response) this.renderReply(presentResponse(turn.response));
      else this.addMessage(turn.content, turn.role);
    }
    if (!this.turns.length)
      this.suggestions([
        "Request security services",
        "Explore services",
        "Careers",
        "Emergency help",
      ]);
    launch.onclick = () => {
      this.panel.classList.add("open");
      launch.hidden = true;
      this.persist();
      this.input.focus();
    };
    close.onclick = () => {
      this.panel.classList.remove("open");
      launch.hidden = false;
      this.persist();
      launch.focus();
    };
    if (saved?.open) {
      this.panel.classList.add("open");
      launch.hidden = true;
    }
    form.onsubmit = (event) => {
      event.preventDefault();
      void this.send(this.input.value);
    };
  }
  disconnectedCallback() {
    this.request?.abort();
    this.request = undefined;
    this.input.disabled = false;
  }
  persist() {
    if (this.storageKey)
      saveChatSession(this.storageKey, {
        id: this.conversationId,
        turns: this.turns,
        savedAt: Date.now(),
        open: this.panel.classList.contains("open"),
      });
  }
  reset() {
    this.request?.abort();
    this.request = undefined;
    this.input.disabled = false;
    const send =
      this.panel.querySelector<HTMLButtonElement>(".composer button");
    if (send) send.disabled = false;
    this.conversationId = newConversationId();
    this.history = [];
    this.turns = [];
    clearChatSession(this.storageKey);
    this.panel.querySelector(".lead")?.remove();
    this.messages.hidden = false;
    this.messages.setAttribute("aria-busy", "false");
    this.messages.replaceChildren();
    this.addMessage("Conversation cleared. " + welcome);
    this.suggestions(["Explore services", "Careers"]);
    this.input.value = "";
    this.input.focus();
  }
  scroll() {
    this.messages.scrollTop = this.messages.scrollHeight;
  }
  addMessage(text: string, role: "user" | "assistant" = "assistant") {
    const article = el("article", "message " + role);
    article.setAttribute("aria-label", role === "user" ? "You" : "Medy");
    if (role === "assistant") {
      const avatar = el("span", "avatar", "M");
      avatar.setAttribute("aria-hidden", "true");
      article.append(avatar);
    }
    const bubble = el("p", "bubble", companyCopy(text));
    article.append(bubble);
    this.messages.append(article);
    this.scroll();
    return { article, bubble };
  }
  suggestions(items: string[]) {
    const row = el("div", "suggestions");
    items.forEach((question) => {
      const button = el("button", "", companyCopy(question));
      button.onclick = () => void this.send(question);
      row.append(button);
    });
    this.messages.append(row);
  }
  renderLinks(reply: Reply, article: HTMLElement) {
    const actions = el("div", "actions");
    for (const action of reply.actions) {
      if (
        action.type !== "start_form" &&
        !(
          action.type === "open_external" &&
          action.target &&
          this.safeLink(action.target)
        )
      )
        continue;
      const button = el("button", "", companyCopy(action.label));
      button.dataset.action = action.id;
      button.onclick = () => this.action(action);
      actions.append(button);
    }
    article.append(actions);
    for (const source of reply.sources) {
      if (source.url && this.safeLink(source.url)) {
        const link = el("a", "source", "Source: " + source.title);
        link.href = source.url;
        link.target =
          new URL(source.url).origin === location.origin ? "_self" : "_blank";
        link.rel = "noopener noreferrer";
        article.append(link);
      }
    }
    this.suggestions(reply.suggestedQuestions);
    this.scroll();
  }
  renderReply(reply: Reply) {
    const { article } = this.addMessage(reply.message);
    this.renderLinks(reply, article);
  }
  async send(text: string) {
    if (!text.trim() || this.input.disabled) return;
    if (
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?1[- .]?)?\(?\d{3}\)?[- .]\d{3}[- .]\d{4}|\b\d{10,15}\b|\+\d[\d ()-]{6,18}\d/i.test(
        text,
      )
    ) {
      this.input.value = "";
      this.addMessage(
        "Please use the optional consent form before sharing contact details. No request was sent.",
      );
      const button = el("button", "primary", "Request Security Services");
      button.onclick = () => this.leadForm();
      this.messages.append(button);
      return;
    }
    const controller = new AbortController();
    this.request = controller;
    this.input.disabled = true;
    const send =
      this.panel.querySelector<HTMLButtonElement>(".composer button");
    if (send) send.disabled = true;
    this.messages.setAttribute("aria-busy", "true");
    this.addMessage(text, "user");
    this.input.value = "";
    this.history = [
      ...this.history.map((turn) => ({
        ...turn,
        content: safeSessionText(turn.content),
      })),
      { role: "user" as const, content: text },
    ].slice(-20);
    this.turns.push({ role: "user" as const, content: text });
    this.persist();
    const loading = this.addMessage("");
    loading.article.classList.add("loading");
    loading.bubble.classList.add("typing");
    loading.article.setAttribute("role", "status");
    loading.article.setAttribute("aria-label", "Medy is typing");
    for (let i = 0; i < 3; i++) loading.bubble.append(el("span"));
    try {
      const response = await fetch(this.api + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          mode: "public",
          conversationId: this.conversationId,
          messages: this.history,
        }),
      });
      const payload = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) {
        const code = payload?.error?.code;
        throw new Error(
          code === "AI_DAILY_BUDGET"
            ? "Medy has reached its daily AI limit. Please use the Contact page."
            : response.status === 429
              ? "Please wait before sending another message."
              : "Medy Assistant is temporarily unavailable. Please try again.",
        );
      }
      const reply = presentResponse(AssistantResponseSchema.parse(payload));
      loading.article.remove();
      const rendered = this.addMessage("");
      await revealText(rendered.bubble, reply.message, controller.signal, () =>
        this.scroll(),
      );
      if (controller.signal.aborted) return;
      this.history = [
        ...this.history,
        { role: "assistant" as const, content: reply.message },
      ].slice(-20);
      this.turns.push({
        role: "assistant",
        content: reply.message,
        response: reply,
      });
      this.persist();
      this.renderLinks(reply, rendered.article);
    } catch (error) {
      if (controller.signal.aborted) return;
      loading.article.setAttribute("role", "alert");
      loading.bubble.classList.remove("typing");
      loading.bubble.textContent =
        error instanceof Error &&
        [
          "Medy has reached its daily AI limit. Please use the Contact page.",
          "Please wait before sending another message.",
        ].includes(error.message)
          ? error.message
          : "Medy Assistant is temporarily unavailable. Please try again.";
    } finally {
      if (this.request === controller) {
        this.request = undefined;
        this.messages.setAttribute("aria-busy", "false");
        this.input.disabled = false;
        if (send) send.disabled = false;
        this.input.focus();
      }
    }
  }
  safeLink(value: string) {
    return supportedPublicUrl(value);
  }
  action(action: Action) {
    if (
      action.type === "start_form" &&
      action.id === "request-security-services"
    )
      return this.leadForm();
    if (
      action.type === "open_external" &&
      action.target &&
      this.safeLink(action.target)
    ) {
      const url = new URL(action.target);
      if (url.origin === location.origin) {
        this.persist();
        location.assign(url.href);
        return;
      }
      return window.open(url.href, "_blank", "noopener,noreferrer");
    }
  }
  leadForm() {
    this.messages.hidden = true;
    const old = this.panel.querySelector(".lead");
    old?.remove();
    const form = el("form", "lead");
    form.append(
      el(
        "p",
        "",
        "Provide only city/state and general requirements. Details stay in this browser until you consent and submit; do not include access codes or sensitive security information.",
      ),
    );
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
      input.required = ![
        "additionalDetails",
        "organization",
        "email",
        "phone",
      ].includes(name);
      input.maxLength = name === "additionalDetails" ? 1000 : 150;
      if (name === "phone") input.type = "tel";
      if (name === "serviceLocation") input.placeholder = "City and state";
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
    summary.setAttribute("role", "status");
    summary.setAttribute("aria-live", "polite");
    const review = el("button", "primary", "Review request");
    review.type = "button";
    review.onclick = () => {
      const value = Object.fromEntries(
        Object.entries(inputs).map(([k, v]) => [k, v.value]),
      );
      summary.textContent = JSON.stringify(value, null, 2);
    };
    const submit = el("button", "primary", "Save request");
    const cancel = el("button", "secondary", "Cancel");
    cancel.type = "button";
    cancel.onclick = () => {
      form.remove();
      this.messages.hidden = false;
      this.addMessage(
        "Request form closed. You can continue asking questions.",
      );
      this.input.focus();
    };
    const formActions = el("div", "form-actions");
    formActions.append(review, submit, cancel);
    form.append(consentLabel, summary, formActions);
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (submit.disabled) return;
      if (!consent.checked) {
        summary.textContent =
          "Please consent before submitting contact details.";
        return;
      }
      if (!form.reportValidity()) return;
      submit.disabled = true;
      try {
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
          summary.textContent =
            "Please check the form fields, consent and your selected contact method.";
          return;
        }
        if (typeof data.id !== "string")
          throw new Error("Missing acknowledgment");
        form.remove();
        this.messages.hidden = false;
        this.addMessage(
          `Request ${data.id} was saved locally. No email notification or service dispatch has occurred.`,
        );
      } catch {
        summary.textContent =
          "We could not confirm that your request was saved. Please try again or use the Contact page.";
      } finally {
        submit.disabled = false;
      }
    };
    this.panel.insertBefore(form, this.panel.querySelector(".composer"));
    inputs.fullName.focus();
  }
}
if (!customElements.get("medy-assistant"))
  customElements.define("medy-assistant", MedyAssistantWidget);

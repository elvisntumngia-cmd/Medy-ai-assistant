// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "./medy-assistant";

afterEach(() => {
  document.body.replaceChildren();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function submitWith(response: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => response }),
  );
  const widget = document.createElement("medy-assistant");
  document.body.append(widget);
  const root = widget.shadowRoot!;
  (root.querySelector(".launch") as HTMLButtonElement).click();
  const input = root.querySelector("textarea")!;
  input.value = "hello";
  root
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(root.textContent).toContain("Medy Assistant"));
  return root;
}

describe("standalone widget response validation", () => {
  it("uses the explicit public API URL without exposing employee controls", () => {
    const widget = document.createElement("medy-assistant");
    widget.setAttribute("api-url", "https://example.test/api/");
    document.body.append(widget);
    const root = widget.shadowRoot!;
    expect((widget as HTMLElement & { api: string }).api).toBe(
      "https://example.test/api",
    );
    expect(root.textContent).not.toMatch(/employee|dashboard|sign in/i);
  });
  it("renders a valid structured response", async () => {
    const root = await submitWith({
      message: "Validated response",
      intent: "test",
      confidence: 0.9,
      actions: [],
      suggestedQuestions: ["Next question"],
      escalation: null,
      sources: [],
    });
    await vi.waitFor(() =>
      expect(root.textContent).toContain("Validated response"),
    );
    expect(root.textContent).toContain("Next question");
  });

  it("fails safely and exposes no action for malformed responses", async () => {
    const root = await submitWith({
      message: "Do not trust this",
      actions: [{ id: "bad", type: "start_form", label: "Unsafe" }],
    });
    await vi.waitFor(() =>
      expect(root.textContent).toContain("temporarily unavailable"),
    );
    expect(root.textContent).not.toContain("Unsafe");
  });

  it("cancels the optional lead form and returns to normal chat", () => {
    const widget = document.createElement("medy-assistant") as HTMLElement & {
      leadForm: () => void;
    };
    document.body.append(widget);
    widget.leadForm();
    const root = widget.shadowRoot!;
    expect(root.querySelector(".messages")?.hasAttribute("hidden")).toBe(true);
    (root.querySelector(".secondary") as HTMLButtonElement).click();
    expect(root.querySelector(".lead")).toBeNull();
    expect(root.querySelector(".messages")?.hasAttribute("hidden")).toBe(false);
    expect(root.textContent).toContain("form closed");
  });
});

describe("standalone widget conversation context", () => {
  it("sends successful previous turns and prevents parallel sends", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: "Please confirm with the team.",
        intent: "ai_public",
        confidence: 0.7,
        actions: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const widget = document.createElement("medy-assistant") as HTMLElement & {
      send: (text: string) => Promise<void>;
    };
    document.body.append(widget);
    const first = widget.send("I need unarmed officers in Maryland");
    await widget.send("duplicate click");
    await first;
    await widget.send("Actually cameras; same location");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).messages).toEqual([
      { role: "user", content: "I need unarmed officers in Maryland" },
      { role: "assistant", content: "Please confirm with the team." },
      { role: "user", content: "Actually cameras; same location" },
    ]);
  });
});

describe("public widget privacy and accessible failures", () => {
  it("renders source links safely and clears bounded context on reset", async () => {
    const root = await submitWith({
      message: "A public answer",
      intent: "ai_public",
      confidence: 0.7,
      actions: [],
      sources: [
        {
          id: "s",
          title: "SecureMedy Services",
          domain: "public",
          snippet: "Services",
          url: "https://securemedy.ng/services/",
        },
      ],
    });
    await vi.waitFor(() =>
      expect(root.querySelector("a.source")?.getAttribute("href")).toBe(
        "https://securemedy.ng/services/",
      ),
    );
    expect(root.querySelector(".messages")?.getAttribute("role")).toBe("log");
    (root.querySelector("header button") as HTMLButtonElement).click();
    expect(root.textContent).toContain("Conversation cleared");
  });
  it("blocks unsafe external targets", () => {
    const widget = document.createElement("medy-assistant") as HTMLElement & {
      action: (a: unknown) => void;
    };
    document.body.append(widget);
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    widget.action({ type: "open_external", target: "javascript:alert(1)" });
    widget.action({
      type: "open_external",
      target: "https://securemedy.ng.evil.test/",
    });
    expect(open).not.toHaveBeenCalled();
  });
  it("retains the form and announces a network failure without inventing persistence", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);
    const widget = document.createElement("medy-assistant") as HTMLElement & {
      leadForm: () => void;
    };
    document.body.append(widget);
    widget.leadForm();
    const root = widget.shadowRoot!;
    const form = root.querySelector(".lead") as HTMLFormElement;
    const values: Record<string, string> = {
      fullName: "Test Visitor",
      email: "test@example.test",
      serviceLocation: "City State",
      propertyType: "Warehouse",
      requestedService: "Cameras",
      coverageSchedule: "Weekdays",
      desiredStartDate: "2026-12-01",
    };
    for (const [name, value] of Object.entries(values))
      (form.querySelector('[name="' + name + '"]') as HTMLInputElement).value =
        value;
    (form.querySelector('[type="checkbox"]') as HTMLInputElement).checked =
      true;
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() =>
      expect(root.textContent).toContain("could not confirm"),
    );
    expect(root.querySelector(".lead")).not.toBeNull();
    expect(root.textContent).not.toContain("was saved locally");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("public response presentation and recovery", () => {
  it("shows each destination once across navigation and citations", async () => {
    const root = await submitWith({
      message: "Official pages",
      intent: "ai_public",
      confidence: 0.7,
      actions: [
        {
          id: "careers",
          type: "open_external",
          label: "View Careers",
          target: "https://securemedy.ng/careers/",
        },
        {
          id: "duplicate",
          type: "open_external",
          label: "Careers again",
          target: "https://securemedy.ng/careers/",
        },
      ],
      sources: [
        {
          id: "one",
          title: "Careers",
          domain: "public",
          snippet: "Applications",
          url: "https://securemedy.ng/careers/",
        },
        {
          id: "two",
          title: "Services",
          domain: "public",
          snippet: "Services",
          url: "https://securemedy.ng/services/",
        },
        {
          id: "three",
          title: "Services again",
          domain: "public",
          snippet: "Services",
          url: "https://securemedy.ng/services",
        },
      ],
    });
    await vi.waitFor(() =>
      expect(root.textContent).toContain("Official pages"),
    );
    expect(root.querySelectorAll(".actions button")).toHaveLength(1);
    expect(root.querySelectorAll("a.source")).toHaveLength(1);
  });
  it("preserves an unanswered language request without inserting an earlier answer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: { code: "AI_UNAVAILABLE" } }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          message: "Bẹ́ẹ̀ni",
          intent: "ai_public",
          confidence: 0.7,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const widget = document.createElement("medy-assistant") as HTMLElement & {
      send: (text: string) => Promise<void>;
    };
    document.body.append(widget);
    await widget.send("How about Yoruba?");
    await widget.send("Try again please");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).messages).toEqual([
      { role: "user", content: "How about Yoruba?" },
      { role: "user", content: "Try again please" },
    ]);
    expect(widget.shadowRoot!.textContent).toContain("Bẹ́ẹ̀ni");
  });
});

describe("polished public browsing session", () => {
  const response = {
    message: "We can discuss your warehouse.\nWhat coverage hours do you need?",
    intent: "ai_public",
    confidence: 0.8,
    actions: [],
  };
  const mount = () => {
    const widget = document.createElement("medy-assistant") as HTMLElement & {
      send: (text: string) => Promise<void>;
      reset: () => void;
      conversationId: string;
      history: unknown[];
    };
    document.body.append(widget);
    return widget;
  };
  it("restores messages, context and conversation ID after refresh/navigation and clears them on reset", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal("fetch", fetchMock);
    const first = mount();
    await first.send("We have cameras at our warehouse.");
    const id = first.conversationId;
    first.remove();
    const restored = mount();
    expect(restored.conversationId).toBe(id);
    expect(restored.shadowRoot!.textContent).toContain(
      "cameras at our warehouse",
    );
    await restored.send("Weekends only.");
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.conversationId).toBe(id);
    expect(body.messages[0].content).toContain("cameras");
    restored.reset();
    expect(restored.conversationId).not.toBe(id);
    expect(restored.history).toEqual([]);
    expect(sessionStorage.length).toBe(0);
  });
  it("supports Shift+Enter without submitting and Enter to send multiline text", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal("fetch", fetchMock);
    const widget = mount();
    const input = widget.shadowRoot!.querySelector("textarea")!;
    input.value = "Warehouse\nNight coverage";
    const shift = new KeyboardEvent("keydown", {
      key: "Enter",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(shift);
    expect(shift.defaultPrevented).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(
      JSON.parse(fetchMock.mock.calls[0][1].body).messages.at(-1).content,
    ).toBe("Warehouse\nNight coverage");
    await vi.waitFor(() => expect(input.disabled).toBe(false));
    expect(
      widget.shadowRoot!.querySelector("article.user .bubble")!.textContent,
    ).toContain("\n");
  });
  it("never resurrects a late response after New conversation", async () => {
    let finish!: (value: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const widget = mount();
    const request = widget.send("Hello");
    expect(widget.shadowRoot!.querySelectorAll(".typing span")).toHaveLength(3);
    widget.reset();
    finish({
      ok: true,
      json: async () => ({ ...response, message: "Late response" }),
    });
    await request;
    expect(widget.shadowRoot!.textContent).not.toContain("Late response");
    expect(widget.history).toEqual([]);
  });
  it("survives unavailable browser storage", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => response }),
    );
    const widget = mount();
    await widget.send("Hi");
    expect(widget.shadowRoot!.textContent).toContain("We can discuss");
  });
  it("welcomes visitors without placing the lengthy notice in the conversation", () => {
    const widget = mount();
    const root = widget.shadowRoot!;
    expect(root.querySelector(".messages")!.textContent).toContain(
      "Securemedy's AI assistant",
    );
    expect(root.querySelector(".messages")!.textContent).not.toContain(
      "AI-assisted chat may use OpenAI",
    );
    expect(root.querySelector("details summary")!.textContent).toBe(
      "Privacy & safety",
    );
  });
});

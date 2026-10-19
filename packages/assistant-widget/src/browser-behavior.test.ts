// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  companyCopy,
  extractPublicLinks,
  supportedPublicUrl,
  saveChatSession,
  loadChatSession,
  sessionKey,
  revealText,
} from "@medy/shared";
afterEach(() => {
  sessionStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("shared safe public presentation", () => {
  it("uses Securemedy branding while preserving official URLs", () => {
    expect(companyCopy("SecureMedy: https://securemedy.ng/")).toBe(
      "Securemedy: https://securemedy.ng/",
    );
  });
  it("turns supported text links into inert navigation actions only", () => {
    const value = extractPublicLinks(
      "See [services](https://securemedy.ng/services/) or https://evil.test/.",
    );
    expect(value.message).not.toContain("https:");
    expect(value.actions).toHaveLength(1);
    expect(value.actions[0]).toMatchObject({
      type: "open_external",
      label: "View Our Services",
      target: "https://securemedy.ng/services/",
    });
    for (const url of [
      "javascript:alert(1)",
      "https://securemedy.ng.evil.test/",
      "https://user:pass@securemedy.ng/",
      "https://securemedy.ng:444/",
      "https://securemedy.ng/wp-admin/",
    ])
      expect(supportedPublicUrl(url)).toBe(false);
  });
  it("excludes contact details, secrets, form data and sensitive snippets from persistence", () => {
    const key = sessionKey("/api");
    saveChatSession(key, {
      id: "safe-session",
      savedAt: Date.now(),
      open: true,
      turns: [
        { role: "user", content: "My password is private-password" },
        {
          role: "assistant",
          content: "Contact person@example.test",
          response: {
            message: "Contact person@example.test",
            intent: "test",
            confidence: 1,
            actions: [],
            sources: [
              {
                id: "x",
                title: "Source",
                domain: "public",
                snippet: "private-source-content",
                url: "https://securemedy.ng/contact/",
              },
            ],
            suggestedQuestions: [],
            data: { email: "secret@example.test" },
            escalation: null,
          },
        },
      ],
    });
    const raw = sessionStorage.getItem(key)!;
    expect(raw).not.toMatch(
      /private-password|person@example|private-source-content|secret@example/,
    );
    expect(loadChatSession(key)?.turns).toHaveLength(2);
  });
  it("rejects malformed and expired saved sessions", () => {
    const key = sessionKey("/api");
    sessionStorage.setItem(key, "invalid JSON");
    expect(loadChatSession(key)).toBeUndefined();
    sessionStorage.setItem(
      key,
      JSON.stringify({
        id: "old",
        turns: [],
        savedAt: Date.now() - 13 * 3600000,
      }),
    );
    expect(loadChatSession(key)).toBeUndefined();
    expect(sessionStorage.getItem(key)).toBeNull();
  });
  it("reveals text progressively and cancels timers", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const node = document.createElement("p");
    const controller = new AbortController();
    const pending = revealText(
      node,
      "A long response\n".repeat(30),
      controller.signal,
    );
    expect(node.textContent).toBe("");
    await vi.advanceTimersByTimeAsync(50);
    expect(node.textContent!.length).toBeGreaterThan(0);
    expect(node.textContent!.length).toBeLessThan(480);
    await vi.advanceTimersByTimeAsync(400);
    await pending;
    expect(vi.getTimerCount()).toBe(0);
    const next = new AbortController();
    const animation = revealText(node, "More", next.signal);
    const rejected = expect(animation).rejects.toMatchObject({
      name: "AbortError",
    });
    next.abort();
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("reveals immediately with reduced motion", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const node = document.createElement("p");
    await revealText(
      node,
      "Line one\n- Line two",
      new AbortController().signal,
    );
    expect(node.textContent).toBe("Line one\n- Line two");
  });
});

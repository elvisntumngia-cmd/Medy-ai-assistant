// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "./medy-assistant";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
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
  const input = root.querySelector("input")!;
  input.value = "hello";
  root
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(root.textContent).toContain("Medy Assistant"));
  return root;
}

describe("standalone widget response validation", () => {
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
});

// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MedyAssistant } from "./index";
const navigation = {
  navigate: vi.fn(),
  openExternal: vi.fn(),
  currentPage: () => "/dashboard",
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("MedyAssistant", () => {
  it("safely renders provider text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: "<img src=x onerror=alert(1)>",
          intent: "test",
          confidence: 0.9,
          actions: [],
          suggestedQuestions: [],
          escalation: null,
          sources: [],
        }),
      }),
    );
    render(
      <MedyAssistant
        mode="public"
        apiUrl="/api"
        navigation={navigation}
        variant="workspace"
      />,
    );
    fireEvent.change(screen.getByLabelText("Message Medy Assistant"), {
      target: { value: "hello" },
    });
    fireEvent.click(screen.getByText("Send"));
    expect(
      await screen.findByText("<img src=x onerror=alert(1)>"),
    ).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
  it("supports reset", () => {
    render(
      <MedyAssistant
        mode="public"
        apiUrl="/api"
        navigation={navigation}
        variant="workspace"
      />,
    );
    expect(screen.getByText("Reset")).toBeInTheDocument();
  });
});

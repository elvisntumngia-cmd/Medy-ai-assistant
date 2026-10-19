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
  sessionStorage.clear();
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
    expect(screen.getByText("New conversation")).toBeInTheDocument();
  });
});

it("restores public context and conversation ID across remount and clears the session", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        message: "We can help with your warehouse.",
        intent: "ai_public",
        confidence: 0.8,
        actions: [],
        sources: [],
      }),
    });
  vi.stubGlobal("fetch", fetchMock);
  const props = {
    mode: "public" as const,
    apiUrl: "/api",
    navigation,
    variant: "workspace" as const,
  };
  const view = render(<MedyAssistant {...props} />);
  fireEvent.change(screen.getByLabelText("Message Medy Assistant"), {
    target: { value: "We have cameras" },
  });
  fireEvent.keyDown(screen.getByLabelText("Message Medy Assistant"), {
    key: "Enter",
    shiftKey: true,
  });
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByLabelText("Message Medy Assistant"), {
    key: "Enter",
  });
  await screen.findByText("We can help with your warehouse.");
  const id = JSON.parse(fetchMock.mock.calls[0][1].body).conversationId;
  view.unmount();
  render(<MedyAssistant {...props} />);
  expect(screen.getByText("We have cameras")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Message Medy Assistant"), {
    target: { value: "Weekends only" },
  });
  fireEvent.click(screen.getByText("Send"));
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).conversationId).toBe(id);
  fireEvent.click(screen.getByText("New conversation"));
  expect(sessionStorage.length).toBe(0);
  expect(screen.queryByText("We have cameras")).toBeNull();
});

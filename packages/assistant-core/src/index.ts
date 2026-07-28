import {
  AssistantResponseSchema,
  DemoConfigSchema,
  type AssistantResponse,
  type DemoConfig,
  type EmployeeProfile,
  type Mode,
} from "@medy/shared";

export class ApiClient {
  private conversationId: string;
  constructor(
    public apiUrl: string,
    private sessionId = "demo-default",
  ) {
    this.conversationId = `${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  private headers() {
    return {
      "Content-Type": "application/json",
      "x-demo-session": this.sessionId,
    };
  }
  async chat(
    mode: Mode,
    messages: { role: "user" | "assistant"; content: string }[],
    config?: Partial<DemoConfig>,
  ): Promise<AssistantResponse> {
    const body = {
      mode,
      messages,
      conversationId: this.conversationId,
      ...config,
    };
    const response = await fetch(`${this.apiUrl}/chat`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!response.ok)
      throw new Error(
        (await response.json()).error?.message || "Assistant unavailable",
      );
    return AssistantResponseSchema.parse(await response.json());
  }
  async get<T>(path: string): Promise<T> {
    const r = await fetch(`${this.apiUrl}${path}`, { headers: this.headers() });
    if (!r.ok) throw new Error("Request failed");
    return r.json() as Promise<T>;
  }
  async post<T>(path: string, body: unknown): Promise<T> {
    const r = await fetch(`${this.apiUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok)
      throw Object.assign(new Error(data.error?.message || "Request failed"), {
        status: r.status,
      });
    return data;
  }
  employee() {
    return this.get<EmployeeProfile>("/demo/employee");
  }
  config() {
    return this.get<DemoConfig>("/demo/config");
  }
  setConfig(value: unknown) {
    return this.post<DemoConfig>("/demo/config", DemoConfigSchema.parse(value));
  }
}

export interface NavigationAdapter {
  navigate(target: string): void;
  openExternal(target: string): void;
  currentPage(): string;
}
export class DemoNavigationAdapter implements NavigationAdapter {
  constructor(private onNavigate: (target: string) => void) {}
  navigate(target: string) {
    this.onNavigate(target);
  }
  openExternal(target: string) {
    window.open(target, "_blank", "noopener");
  }
  currentPage() {
    return window.location.pathname;
  }
}
export class ReactRouterNavigationAdapter extends DemoNavigationAdapter {}
export type { AssistantResponse, DemoConfig, EmployeeProfile, Mode };

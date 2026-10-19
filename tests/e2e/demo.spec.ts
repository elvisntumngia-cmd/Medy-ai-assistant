import { test, expect } from "@playwright/test";
test("public lead intake completes and persists", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Medy Assistant" }).click();
  const assistant = page.getByRole("region", { name: "Medy Assistant" });
  await assistant
    .getByRole("button", { name: "Request security services" })
    .click();
  await expect(
    assistant.getByRole("button", { name: "Request Security Services" }),
  ).toBeVisible();
  await assistant
    .getByRole("button", { name: "Request Security Services", exact: true })
    .click();
  await page.getByLabel("Full name").fill("Alex Morgan");
  await page.getByLabel("Organization").fill("Demo Health Center");
  await page.getByLabel("Email").fill("alex@example.test");
  await page.getByLabel("Phone").fill("202-555-0188");
  await page.getByLabel("Service location").fill("Washington DC");
  await page
    .getByLabel("Facility or property type")
    .fill("Healthcare facility");
  await page.getByLabel("Requested service").fill("Unarmed security officers");
  await page.getByLabel("Number of officers").fill("2");
  await page.getByLabel("Coverage schedule").fill("Weekday evenings");
  await page.getByLabel("Desired start date").fill("2026-08-20");
  await page
    .getByLabel("Additional details")
    .fill("Demonstration lead created by browser test.");
  await page.getByLabel(/I consent/).check();
  await page.getByRole("button", { name: "Review request" }).click();
  await page.getByRole("button", { name: "Save request" }).click();
  await expect(page.getByText(/saved locally/)).toBeVisible();
});
test("public assistant supports independent topic changes without qualification", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Medy Assistant" }).click();
  const input = page.getByLabel("Message Medy Assistant");
  const send = async (message: string) => {
    await input.fill(message);
    await page.getByRole("button", { name: "Send" }).click();
  };
  await send("I need security for my warehouse");
  await expect(page.getByText(/physical security services/i)).toBeVisible();
  await send("Are you hiring?");
  await expect(page.getByText(/Careers page/i)).toBeVisible();
  await send("Do you install cameras?");
  await expect(page.getByText(/CCTV design and installation/i)).toBeVisible();
  await send("What's your phone number?");
  await expect(page.getByText(/\(240\) 419-3125/i)).toBeVisible();
});
test("explicit public lead form can be cancelled back to chat", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Medy Assistant" }).click();
  await page.getByRole("button", { name: "Request security services" }).click();
  await page
    .getByRole("button", { name: "Request Security Services", exact: true })
    .click();
  await expect(page.getByLabel("Full name")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Message Medy Assistant")).toBeVisible();
  await expect(page.getByText(/form closed/i)).toBeVisible();
});
test("employee uniform request routes through config", async ({ page }) => {
  await page.goto("/employee/assistant");
  await page.getByLabel("Message Medy Assistant").fill("I need a new uniform");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(
    page.getByRole("button", { name: "Open Uniform Request" }),
  ).toBeVisible();
});
test("employee payroll flow", async ({ page }) => {
  await page.goto("/employee/assistant");
  await page
    .getByLabel("Message Medy Assistant")
    .fill("My overtime is missing");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(
    page.getByRole("button", { name: "Start Payroll Issue" }),
  ).toBeVisible();
});
test("payroll confirmation controls submission and creates one audit record", async ({
  page,
  request,
}) => {
  await page.goto("/employee/assistant");
  await page
    .getByLabel("Message Medy Assistant")
    .fill("My overtime is missing");
  await page.getByRole("button", { name: "Send" }).click();
  const action = page.getByRole("button", { name: "Start Payroll Issue" });
  await expect(action).toBeVisible();
  const headers = { "x-demo-session": "stakeholder-demo" };
  const before = await request.get("http://127.0.0.1:4281/api/demo/actions", {
    headers,
  });
  const beforeCount = (await before.json()).length;

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("simulated write action");
    await dialog.dismiss();
  });
  await action.click();
  expect(
    (
      await request.get("http://127.0.0.1:4281/api/demo/actions", { headers })
    ).json(),
  ).resolves.toHaveLength(beforeCount);

  let submissions = 0;
  await page.route("**/api/demo/actions", async (route) => {
    submissions += 1;
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.continue();
  });
  page.once("dialog", (dialog) => dialog.accept());
  const pending = action.click();
  await expect(action).toBeDisabled();
  await pending;
  await expect(page.getByText(/fictional demonstration request/)).toBeVisible();
  expect(submissions).toBe(1);
  const after = await request.get("http://127.0.0.1:4281/api/demo/actions", {
    headers,
  });
  expect(await after.json()).toHaveLength(beforeCount + 1);
});
test("policy lookup is labeled", async ({ page }) => {
  await page.goto("/employee/assistant");
  await page
    .getByLabel("Message Medy Assistant")
    .fill("Find attendance policy");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(
    page.getByText(/NOT AN OFFICIAL SECUREMEDY POLICY/),
  ).toBeVisible();
});
test("implemented data, department contact, and escalation actions respond", async ({
  page,
}) => {
  await page.goto("/employee/assistant");
  await page
    .getByLabel("Message Medy Assistant")
    .fill("When does my license expire?");
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByRole("button", { name: "View License Details" }).click();
  await expect(
    page.getByText("The available details are shown above."),
  ).toBeVisible();

  await page.getByLabel("Message Medy Assistant").fill("I need IT support");
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByRole("button", { name: "Contact IT Support" }).click();
  await expect(page.getByText(/handoff recorded for IT Support/)).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Open Medy Assistant" }).click();
  await page
    .getByLabel("Message Medy Assistant")
    .fill("I want someone to call me");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(
    page.getByRole("button", { name: "Contact SecureMedy" }),
  ).toBeVisible();
});
test("mobile widget opens and closes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open Medy Assistant" }).click();
  await expect(
    page.getByRole("region", { name: "Medy Assistant" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close Medy Assistant" }).click();
  await expect(
    page.getByRole("region", { name: "Medy Assistant" }),
  ).toHaveCount(0);
});
test("demo provider control changes chat behavior", async ({ page }) => {
  await page.goto("/control");
  await page
    .locator("label")
    .filter({ hasText: /^Provider/ })
    .locator("select")
    .selectOption("bedrock");
  await page.goto("/employee/assistant");
  await page.getByLabel("Message Medy Assistant").fill("Help with training");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/assigned demonstration courses/i)).toBeVisible();
});
test("mock role selection updates the portal", async ({ page }) => {
  await page.goto("/control");
  await page
    .getByLabel("Mock employee role")
    .selectOption({ label: "Operations Manager" });
  await page.goto("/employee/dashboard");
  await expect(
    page.getByText("Operations Manager", { exact: true }).first(),
  ).toBeVisible();
});

test("roles change identity, dashboard data, permissions, and quick actions", async ({
  page,
}) => {
  await page.goto("/control");
  await page
    .getByLabel("Mock employee role")
    .selectOption({ label: "Operations Manager" });
  await page.goto("/employee/dashboard");
  await expect(page.getByText("Patricia Johnson")).toBeVisible();
  await expect(
    page
      .locator(".metric-grid article")
      .filter({ hasText: "APPROVALS" })
      .getByText("2", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Approvals" })).toBeVisible();
  await page.getByRole("button", { name: "Open Medy Assistant" }).click();
  await expect(page.getByRole("button", { name: "Approvals" })).toBeVisible();

  await page.goto("/control");
  await page
    .getByLabel("Mock employee role")
    .selectOption({ label: "HR Administrator" });
  await page.goto("/employee/dashboard");
  await expect(page.getByText("Renee Brooks")).toBeVisible();
  await expect(page.getByRole("link", { name: "Approvals" })).toHaveCount(0);
  await page.getByRole("button", { name: "Open Medy Assistant" }).click();
  await expect(page.getByRole("button", { name: "HR Support" })).toBeVisible();
});

test("widget shadow DOM resists hostile host styles", async ({ page }) => {
  await page.goto("/");
  await page.addStyleTag({
    content: "button { background: rgb(255, 0, 0) !important; }",
  });
  const isolated = await page.locator("medy-assistant").evaluate((host) => {
    const button = host.shadowRoot?.querySelector("button");
    return (
      Boolean(host.shadowRoot) &&
      getComputedStyle(button!).backgroundColor !== "rgb(255, 0, 0)"
    );
  });
  expect(isolated).toBe(true);
});

test("standalone widget loads on an independent host and calls the public API", async ({
  page,
}) => {
  await page.goto("/wordpress-host.html");
  await page.getByRole("button", { name: "Open Medy Assistant" }).click();
  await expect(page.getByText(/I’m Medy/)).toBeVisible();
  await page
    .getByLabel("Message Medy Assistant")
    .fill("What services do you offer?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/security/i).last()).toBeVisible();
  await expect(page.getByText(/employee|dashboard|sign in/i)).toHaveCount(0);
});

test("captured lead is visible in the local admin view", async ({ page }) => {
  await page.goto("/admin/leads");
  await expect(page.getByText("Alex Morgan")).toBeVisible();
});

test("WordPress widget renders AI citations and retains corrections with a mocked API", async ({
  page,
}) => {
  const sent: { messages: { role: string; content: string }[] }[] = [];
  await page.route("**/api/chat", async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message:
          "Electronic-security services include CCTV and access-control systems. The team can confirm suitability.",
        intent: "ai_public",
        confidence: 0.7,
        actions: [],
        sources: [
          {
            id: "electronic-security",
            title: "Electronic Security",
            domain: "public",
            snippet: "Approved services",
            url: "https://securemedy.ng/service/electronic-security/",
          },
        ],
      }),
    });
  });
  await page.goto("/wordpress-host.html");
  await page.getByRole("button", { name: "Open Medy Assistant" }).click();
  const input = page.getByLabel("Message Medy Assistant");
  await input.fill("We already have cameras at the loading dock");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Source: Electronic Security" }),
  ).toBeVisible();
  await input.fill("Correction: I am the property manager, not the homeowner");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1].messages.map((m) => m.content).join(" ")).toContain(
    "already have cameras",
  );
  expect(sent[1].messages.at(-1)?.content).toContain("property manager");
});
test("mobile chat keeps volunteered contacts in the browser and offers the consent form", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let calls = 0;
  await page.route("**/api/chat", async (route) => {
    calls++;
    await route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open Medy Assistant" }).click();
  await page
    .getByLabel("Message Medy Assistant")
    .fill("Email me at visitor@example.test");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText(/optional consent form before sharing/),
  ).toBeVisible();
  expect(calls).toBe(0);
  await page
    .getByRole("button", { name: "Request Security Services", exact: true })
    .click();
  await expect(page.getByLabel("Full name")).toBeVisible();
});

test("public widget deduplicates destinations and recovers an unanswered language request", async ({
  page,
}) => {
  const sent: { messages: { role: string; content: string }[] }[] = [];
  await page.route("**/api/chat", async (route) => {
    sent.push(route.request().postDataJSON());
    if (sent.length === 1)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "AI_UNAVAILABLE" } }),
      });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message:
          "Bẹ́ẹ̀ni. Use the official Careers page for application guidance.",
        intent: "ai_public",
        confidence: 0.7,
        actions: [
          {
            id: "career",
            type: "open_external",
            label: "View Careers",
            target: "https://securemedy.ng/careers/",
          },
          {
            id: "career-again",
            type: "open_external",
            label: "Duplicate",
            target: "https://securemedy.ng/careers/",
          },
        ],
        sources: [
          {
            id: "careers",
            title: "Careers",
            domain: "public",
            snippet: "Application guidance",
            url: "https://securemedy.ng/careers/",
          },
        ],
      }),
    });
  });
  await page.goto("/wordpress-host.html");
  await page.getByRole("button", { name: "Open Medy Assistant" }).click();
  const input = page.getByLabel("Message Medy Assistant");
  await input.fill("How about Yoruba?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await input.fill("Try again please");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "View Careers", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Duplicate", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Source: Careers" })).toHaveCount(
    0,
  );
  expect(sent[1].messages).toEqual([
    { role: "user", content: "How about Yoruba?" },
    { role: "user", content: "Try again please" },
  ]);
});

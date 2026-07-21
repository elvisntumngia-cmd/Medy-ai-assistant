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
  await page.getByLabel("Message Medy Assistant").fill("I want a handoff");
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByRole("button", { name: "Speak with Someone" }).click();
  await expect(
    page.getByText(/demonstration handoff was noted/i),
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

test("captured lead is visible in the local admin view", async ({ page }) => {
  await page.goto("/admin/leads");
  await expect(page.getByText("Alex Morgan")).toBeVisible();
});

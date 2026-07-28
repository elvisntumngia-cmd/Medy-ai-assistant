import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError, z } from "zod";
import {
  ActionSchema,
  ChatRequestSchema,
  DemoConfigSchema,
  LeadSchema,
} from "@medy/shared";
import {
  LocalLeadProvider,
  MockActionProvider,
  MockAuthAdapter,
  employeeData,
} from "./providers.js";
import { ConversationEngine } from "./conversation.js";

type AppOptions = {
  serveFrontend?: boolean;
  demoDistPath?: string;
};

export function resolveDemoDistPath() {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Compiled API: apps/api/dist/src/app.js -> apps/demo/dist
    path.resolve(moduleDirectory, "../../../demo/dist"),
    // Source/tsx execution: apps/api/src/app.ts -> apps/demo/dist
    path.resolve(moduleDirectory, "../../demo/dist"),
    // Monorepo root working directory
    path.resolve(process.cwd(), "apps/demo/dist"),
    // apps/api working directory
    path.resolve(process.cwd(), "../demo/dist"),
  ];
  return (
    candidates.find((candidate) =>
      fs.existsSync(path.join(candidate, "index.html")),
    ) || candidates[0]
  );
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const auth = new MockAuthAdapter();
  const conversation = new ConversationEngine();
  const leads = new LocalLeadProvider();
  const actions = new MockActionProvider();
  const session = (req: express.Request) => req.header("x-demo-session");
  const demoOnly: express.RequestHandler = (_req, res, next) => {
    if (process.env.DEMO_MODE !== "true")
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Route not found" },
      });
    next();
  };
  app.use(helmet());
  app.use(
    cors({
      origin: (process.env.CLIENT_ORIGIN || "http://localhost:5180")
        .split(",")
        .map((x) => x.trim()),
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use("/api", rateLimit({ windowMs: 60_000, limit: 120 }));
  app.get("/api/health", (_req, res) =>
    res.json({
      status: "ok",
      provider: "deterministic-local",
    }),
  );
  app.post("/api/chat", async (req, res, next) => {
    try {
      const body = ChatRequestSchema.parse(req.body);
      const user =
        body.mode === "employee" ? await auth.getUser(session(req)) : undefined;
      if (body.mode === "employee" && !user)
        return res.status(401).json({
          error: {
            code: "UNAUTHENTICATED",
            message: "Employee demo identity required",
          },
        });
      const config = auth.getConfig(session(req)) || {
        role: "officer" as const,
        provider: "mock" as const,
        delay: false,
        providerError: false,
      };
      if (config.delay) await new Promise((r) => setTimeout(r, 800));
      if (config.providerError || body.triggerError)
        throw new Error("Triggered provider error");
      const conversationKey = `${body.mode}:${body.conversationId || session(req) || "anonymous-demo"}`;
      res.json(
        conversation.respond(
          body.mode,
          conversationKey,
          body.messages.at(-1)!.content,
          user || undefined,
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/leads", (req, res, next) => {
    try {
      res.status(201).json(leads.create(LeadSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/leads", demoOnly, (_req, res) => res.json(leads.list()));
  app.get("/api/leads/:id", demoOnly, (req, res) => {
    const lead = leads.get(String(req.params.id));
    res
      .status(lead ? 200 : 404)
      .json(
        lead || { error: { code: "NOT_FOUND", message: "Lead not found" } },
      );
  });
  const employeeRoute =
    (key: ReturnType<typeof employeeData> extends infer T ? keyof T : never) =>
    async (req: express.Request, res: express.Response) => {
      const user = await auth.getUser(session(req));
      if (!user)
        return res.status(401).json({
          error: {
            code: "UNAUTHENTICATED",
            message: "Employee demo identity required",
          },
        });
      res.json(employeeData(user)[key]);
    };
  app.get("/api/demo/employee", employeeRoute("profile"));
  app.get("/api/demo/employee/profile", employeeRoute("profile"));
  app.get("/api/demo/employee/leave", employeeRoute("leave"));
  app.get("/api/demo/employee/requests", employeeRoute("requests"));
  app.get("/api/demo/employee/training", employeeRoute("training"));
  app.get("/api/demo/employee/approvals", employeeRoute("approvals"));
  app.get("/api/demo/employee/uniform", employeeRoute("uniform"));
  app.get("/api/demo/employee/equipment", employeeRoute("equipment"));
  app.get("/api/demo/employee/license", employeeRoute("license"));
  app.get("/api/demo/employee/recent", employeeRoute("recent"));
  app.get("/api/demo/config", demoOnly, (req, res) => {
    const config = auth.getConfig(session(req));
    return config
      ? res.json(config)
      : res.status(401).json({
          error: {
            code: "UNAUTHENTICATED",
            message: "Valid demo session required",
          },
        });
  });
  app.post("/api/demo/config", demoOnly, (req, res, next) => {
    try {
      const id = session(req);
      const config = id
        ? auth.setConfig(id, DemoConfigSchema.parse(req.body))
        : null;
      return config
        ? res.json(config)
        : res.status(401).json({
            error: {
              code: "UNAUTHENTICATED",
              message: "Valid demo session required",
            },
          });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/demo/actions", demoOnly, (_req, res) =>
    res.json(actions.list()),
  );
  app.post("/api/demo/actions", demoOnly, async (req, res, next) => {
    try {
      const parsed = z
        .object({ action: ActionSchema, confirmed: z.boolean() })
        .parse(req.body);
      const user = await auth.getUser(session(req));
      if (!user)
        return res.status(401).json({
          error: {
            code: "UNAUTHENTICATED",
            message: "Employee demo identity required",
          },
        });
      const result = actions.execute(parsed.action, user, parsed.confirmed);
      if ("error" in result)
        return res.status(result.status).json({
          error: {
            code:
              result.status === 409
                ? "CONFIRMATION_REQUIRED"
                : "DISALLOWED_ACTION",
            message: result.error,
          },
        });
      res.status(201).json(result.record);
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/demo/reset", demoOnly, (req, res) => {
    const body = z
      .object({
        leads: z.boolean().default(true),
        actions: z.boolean().default(true),
        session: z.boolean().default(true),
      })
      .parse(req.body || {});
    if (body.leads) leads.reset();
    if (body.actions) actions.reset();
    if (body.session) auth.reset();
    if (body.session) conversation.reset();
    res.json({ reset: true, ...body });
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "API route not found" },
    }),
  );
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const validation = error instanceof ZodError;
      res.status(validation ? 400 : 503).json({
        error: {
          code: validation ? "VALIDATION_ERROR" : "PROVIDER_ERROR",
          message: validation
            ? "Please check the submitted information."
            : "Medy Assistant is temporarily unavailable. Please try again.",
          details: validation ? error.flatten() : undefined,
        },
      });
    },
  );
  const serveFrontend =
    options.serveFrontend ??
    (process.env.NODE_ENV === "production" || process.env.RENDER === "true");
  if (serveFrontend) {
    const demoDist = options.demoDistPath || resolveDemoDistPath();
    const indexFile = path.join(demoDist, "index.html");
    if (!fs.existsSync(indexFile))
      throw new Error(
        `Built demo frontend was not found at ${indexFile}. Run the monorepo build before starting the API.`,
      );
    app.use(express.static(demoDist));
    app.get("*", (_req, res) => res.sendFile(indexFile));
  }
  return app;
}

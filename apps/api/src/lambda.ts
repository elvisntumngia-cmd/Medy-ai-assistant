import { configure } from "@codegenie/serverless-express";
import { createApp } from "./app.js";

// Initialization is intentionally outside the handler so Lambda can reuse clients and parsed knowledge.
export const handler = configure({ app: createApp({ serveFrontend: false }) });

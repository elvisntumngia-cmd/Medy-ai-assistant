import "./local-env.js";
process.env.DEMO_MODE ??= "true";
await import("./server.js");

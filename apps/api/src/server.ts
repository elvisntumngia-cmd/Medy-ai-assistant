import { createApp } from "./app.js";
process.env.CLIENT_ORIGIN ??= "http://localhost:5180";
const port = Number(process.env.PORT || 4180);
createApp().listen(
  port,
  process.env.MEDY_LOCAL_AI === "true" ? "127.0.0.1" : "0.0.0.0",
  () => console.log(`Medy API ready at http://localhost:${port}`),
);

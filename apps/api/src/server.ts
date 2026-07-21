import { createApp } from "./app.js";
process.env.CLIENT_ORIGIN ??= "http://localhost:5180";
const port = Number(process.env.PORT || 4180);
createApp().listen(port, () =>
  console.log(`Medy API ready at http://localhost:${port}`),
);

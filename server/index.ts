import express from "express";
import { config } from "./config.js";
import { router } from "./routes.js";

const app = express();
app.use(express.json());
app.use("/api", router);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Nonce issuer listening on ${config.port}`);
});

import { config } from "./config.js";
import app from "./app.js";

app.listen(config.port, () => {
  console.log(`Quarterly inspection app listening on port ${config.port}`);
});

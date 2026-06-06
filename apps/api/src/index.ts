import "dotenv/config";
import app from "./app.js";
import { config } from "./config.js";

app.listen(config.PORT, () => {
  console.log(`API running on http://localhost:${config.PORT}`);
});

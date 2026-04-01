import { createApp } from "./app/create-app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`portnonio-api listening on http://localhost:${env.PORT}`);
});
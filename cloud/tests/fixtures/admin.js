import { env } from "cloudflare:workers";
import { client } from "./client.js";
import { seedMinimal } from "./database.js";

export async function adminClient() {
  await seedMinimal(env.DB);
  const c = client();
  const credentials = await c.register();
  await env.DB.prepare("UPDATE users SET role_id=2 WHERE email=?")
    .bind(credentials.email).run();
  return { c, credentials };
}

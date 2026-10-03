import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const BUCKETS = ["knowledge-files", "avatars"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Permanently deletes the CALLER's own account. The user id always comes from the
// verified JWT — never from the request body — so nobody can delete someone else.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "DELETE") return json({ error: "Confirmation missing" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Not authenticated" }, 401);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Don't delete someone who is still being billed (Stripe isn't wired up to cancel yet).
  const { data: sub } = await admin
    .from("subscriptions")
    .select("is_active, plan_tier")
    .eq("user_id", user.id)
    .maybeSingle();
  if (sub?.is_active && sub.plan_tier && sub.plan_tier !== "free") {
    return json(
      { error: "Please cancel your subscription before deleting your account.", code: "active_subscription" },
      409
    );
  }

  // Remove uploaded files first. If this fails we stop, so no personal files are orphaned.
  try {
    for (const bucket of BUCKETS) {
      for (let i = 0; i < 20; i++) {
        const { data: files, error } = await admin.storage.from(bucket).list(user.id, { limit: 1000 });
        if (error) throw error;
        if (!files || files.length === 0) break;
        const { error: rmErr } = await admin.storage
          .from(bucket)
          .remove(files.map((f) => `${user.id}/${f.name}`));
        if (rmErr) throw rmErr;
      }
    }
  } catch (err) {
    console.error("delete-account: storage cleanup failed:", (err as Error).message);
    return json({ error: "Could not remove your files. Please try again." }, 500);
  }

  // All user tables reference auth.users with ON DELETE CASCADE, so this removes the data too.
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    console.error("delete-account: deleteUser failed:", delErr.message);
    return json({ error: "Could not delete your account. Please try again." }, 500);
  }
  return json({ ok: true });
});

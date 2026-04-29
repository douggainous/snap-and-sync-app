import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.0";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("rate"), dishId: z.string().uuid(), rating: z.number().min(1).max(5), review: z.string().trim().max(1200).optional().nullable() }),
  z.object({ type: z.literal("toggle_action"), dishId: z.string().uuid(), action: z.enum(["want_to_try", "favorite"]), enabled: z.boolean() }),
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authentication required." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return json({ error: "Backend is not configured." }, 500);

    const authClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return json({ error: "Authentication required." }, 401);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid interaction payload.", details: parsed.error.flatten().fieldErrors }, 400);

    const input = parsed.data;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    await supabase.from("users").upsert({
      id: user.id,
      email: user.email ?? null,
      display_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      avatar_url: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    });

    const { data: dish } = await supabase.from("dishes").select("id,is_published").eq("id", input.dishId).maybeSingle();
    if (!dish) return json({ error: "Dish not found." }, 404);

    if (input.type === "rate") {
      const { data: rating, error: ratingError } = await supabase
        .from("ratings")
        .upsert({ dish_id: input.dishId, user_id: user.id, rating: input.rating, is_public: true }, { onConflict: "user_id,dish_id" })
        .select("id,rating")
        .single();
      if (ratingError) {
        console.error("Rating upsert failed", ratingError);
        return json({ error: "Could not save rating." }, 500);
      }

      let review = null;
      if (input.review?.trim()) {
        const { data: reviewRow, error: reviewError } = await supabase
          .from("reviews")
          .upsert({ dish_id: input.dishId, user_id: user.id, rating_id: rating.id, body: input.review.trim(), is_public: true }, { onConflict: "rating_id" })
          .select("id,body")
          .single();
        if (reviewError) {
          console.error("Review upsert failed", reviewError);
          return json({ error: "Could not save review." }, 500);
        }
        review = reviewRow;
      }

      const { data: updatedDish } = await supabase.from("dishes").select("id,aggregate_rating,rating_count,review_count,want_to_try_count,favorite_count,trending_score").eq("id", input.dishId).single();
      return json({ rating, review, dish: updatedDish });
    }

    if (input.enabled) {
      const { error } = await supabase
        .from("saved_items")
        .upsert({ user_id: user.id, dish_id: input.dishId, action_type: input.action }, { onConflict: "user_id,dish_id,action_type" });
      if (error) {
        console.error("Action upsert failed", error);
        return json({ error: "Could not save dish action." }, 500);
      }
    } else {
      const { error } = await supabase
        .from("saved_items")
        .delete()
        .eq("user_id", user.id)
        .eq("dish_id", input.dishId)
        .eq("action_type", input.action);
      if (error) {
        console.error("Action delete failed", error);
        return json({ error: "Could not remove dish action." }, 500);
      }
    }

    const { data: updatedDish } = await supabase.from("dishes").select("id,aggregate_rating,rating_count,review_count,want_to_try_count,favorite_count,trending_score").eq("id", input.dishId).single();
    return json({ action: input.action, enabled: input.enabled, dish: updatedDish });
  } catch (error) {
    console.error("dish-interaction error", error);
    return json({ error: "Unexpected error." }, 500);
  }
});

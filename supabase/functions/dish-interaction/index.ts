import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.0";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("rate"),
    dishId: z.string().uuid(),
    rating: z.number().min(1).max(5),
    review: z.string().trim().max(1200).optional().nullable(),
    pricePaid: z.number().min(0).max(10000).optional().nullable(),
    tags: z.array(z.string().trim().min(1).max(60)).max(8).optional().default([]),
    metrics: z.object({
      wouldOrderAgain: z.boolean().optional(),
      temperature: z.number().int().min(1).max(5).optional(),
      spiciness: z.number().int().min(0).max(5).optional(),
      sweetSavory: z.number().int().min(1).max(5).optional(),
      flavorIntensity: z.number().int().min(1).max(5).optional(),
    }).optional(),
  }),
  z.object({ type: z.literal("toggle_action"), dishId: z.string().uuid(), action: z.enum(["want_to_try", "favorite"]), enabled: z.boolean() }),
  z.object({ type: z.literal("share"), dishId: z.string().uuid(), channel: z.string().trim().min(1).max(40).optional().default("native") }),
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "tag";
const cleanTag = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

async function refreshTasteProfile(supabase: ReturnType<typeof createClient>, userId: string) {
  const cuisineScores: Record<string, number> = {};
  const tagScores: Record<string, number> = {};
  const engagementCounts: Record<string, number> = {};
  const addCuisine = (value?: string | null, score = 1) => {
    const key = value?.toLowerCase().trim();
    if (key) cuisineScores[key] = Number(((cuisineScores[key] ?? 0) + score).toFixed(2));
  };
  const addTag = (value?: string | null, score = 1) => {
    const key = value?.toLowerCase().trim();
    if (key) tagScores[key] = Number(((tagScores[key] ?? 0) + score).toFixed(2));
  };

  const { data: profile } = await supabase.from("profiles").select("favorite_cuisines").eq("user_id", userId).maybeSingle();
  for (const cuisine of ((profile?.favorite_cuisines ?? []) as string[])) addCuisine(cuisine, 5);

  const { data: saved } = await supabase.from("saved_items").select("action_type,updated_at,dishes(id,cuisine)").eq("user_id", userId).in("action_type", ["saved", "want_to_try", "favorite"]).order("updated_at", { ascending: false }).limit(140);
  const engagedDishIds = new Set<string>();
  let lastInteractionAt: string | null = null;
  for (const row of (saved ?? []) as { action_type: string; updated_at?: string | null; dishes?: { id?: string; cuisine?: string | null } | null }[]) {
    const weight = row.action_type === "favorite" ? 4 : row.action_type === "want_to_try" ? 2.4 : 1.6;
    addCuisine(row.dishes?.cuisine, weight);
    if (row.dishes?.id) engagedDishIds.add(row.dishes.id);
    engagementCounts[row.action_type] = (engagementCounts[row.action_type] ?? 0) + 1;
    if (!lastInteractionAt && row.updated_at) lastInteractionAt = row.updated_at;
  }

  const { data: ratings } = await supabase.from("ratings").select("dish_id,rating,updated_at,dishes(cuisine)").eq("user_id", userId).order("updated_at", { ascending: false }).limit(120);
  for (const row of (ratings ?? []) as { dish_id: string; rating: number; updated_at?: string | null; dishes?: { cuisine?: string | null } | null }[]) {
    const score = Math.max(-2, Number(row.rating) - 3) * 2.6;
    addCuisine(row.dishes?.cuisine, score);
    if (Number(row.rating) >= 4) engagedDishIds.add(row.dish_id);
    engagementCounts.ratings = (engagementCounts.ratings ?? 0) + 1;
    if (!lastInteractionAt && row.updated_at) lastInteractionAt = row.updated_at;
  }

  if (engagedDishIds.size) {
    const { data: tags } = await supabase.from("dish_tags").select("dish_id,category,confidence,tags(name)").in("dish_id", [...engagedDishIds]).gte("confidence", 0.55).limit(300);
    for (const row of (tags ?? []) as { confidence?: number | null; category?: string | null; tags?: { name?: string | null } | null }[]) {
      const base = row.category === "dish_type" ? 2.2 : row.category === "flavor" ? 1.8 : row.category === "cuisine" ? 1.2 : 0.8;
      addTag(row.tags?.name, base * Number(row.confidence ?? 0.7));
    }
  }

  const topEntries = (obj: Record<string, number>, limit: number) => Object.fromEntries(Object.entries(obj).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, limit));
  await supabase.from("user_taste_profiles").upsert({ user_id: userId, cuisine_affinity: topEntries(cuisineScores, 12), tag_affinity: topEntries(tagScores, 24), engagement_counts: engagementCounts, last_interaction_at: lastInteractionAt, refreshed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return json({ error: "Backend is not configured." }, 500);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid interaction payload.", details: parsed.error.flatten().fieldErrors }, 400);

    const input = parsed.data;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let user: { id: string; email?: string; user_metadata?: Record<string, string> } | null = null;
    if (authHeader) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
      const { data, error: userError } = await authClient.auth.getUser();
      if (!userError && data.user) user = data.user;
    }

    if (input.type !== "share" && !user) return json({ error: "Authentication required." }, 401);

    if (user) await supabase.from("users").upsert({
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
        .upsert({
          dish_id: input.dishId,
          user_id: user!.id,
          rating: input.rating,
          would_order_again: input.metrics?.wouldOrderAgain ?? null,
          temperature_rating: input.metrics?.temperature ?? null,
          spiciness_rating: input.metrics?.spiciness ?? null,
          sweet_savory_rating: input.metrics?.sweetSavory ?? null,
          flavor_intensity_rating: input.metrics?.flavorIntensity ?? null,
          is_public: true,
        }, { onConflict: "user_id,dish_id" })
        .select("id,rating")
        .single();
      if (ratingError) {
        console.error("Rating upsert failed", ratingError);
        return json({ error: "Could not save rating." }, 500);
      }

      let review = null;
      if (input.review?.trim() || input.pricePaid != null) {
        const { data: reviewRow, error: reviewError } = await supabase
          .from("reviews")
          .upsert({ dish_id: input.dishId, user_id: user!.id, rating_id: rating.id, body: input.review?.trim() || null, price_paid: input.pricePaid ?? null, currency: "USD", is_public: true }, { onConflict: "rating_id" })
          .select("id,body,price_paid")
          .single();
        if (reviewError) {
          console.error("Review upsert failed", reviewError);
          return json({ error: "Could not save review." }, 500);
        }
        review = reviewRow;
      }

      const tags = [...new Set((input.tags ?? []).map(cleanTag).filter(Boolean))].slice(0, 8);
      for (const tagName of tags) {
        const tagSlug = slugify(tagName);
        const { data: tag } = await supabase.from("tags").upsert({ name: tagName, slug: tagSlug }, { onConflict: "slug" }).select("id").single();
        if (tag?.id) await supabase.from("dish_tags").upsert({ dish_id: input.dishId, tag_id: tag.id, created_by: user!.id });
      }

      const { data: updatedDish } = await supabase.from("dishes").select("id,aggregate_rating,rating_count,review_count,want_to_try_count,favorite_count,trending_score").eq("id", input.dishId).single();
      EdgeRuntime.waitUntil(refreshTasteProfile(supabase, user!.id).catch((error) => console.error("taste profile refresh failed", error)));
      return json({ rating, review, dish: updatedDish });
    }

    if (input.type === "share") {
      const { error } = await supabase.from("dish_share_events").insert({ dish_id: input.dishId, user_id: user?.id ?? null, share_channel: input.channel });
      if (error) {
        console.error("Share event insert failed", error);
        return json({ error: "Could not record share." }, 500);
      }
      const { data: trend } = await supabase.from("dish_trend_metrics").select("*").eq("dish_id", input.dishId).maybeSingle();
      return json({ shared: true, trend });
    }

    if (input.enabled) {
      const { error } = await supabase
        .from("saved_items")
        .upsert({ user_id: user!.id, dish_id: input.dishId, action_type: input.action }, { onConflict: "user_id,dish_id,action_type" });
      if (error) {
        console.error("Action upsert failed", error);
        return json({ error: "Could not save dish action." }, 500);
      }
    } else {
      const { error } = await supabase
        .from("saved_items")
        .delete()
        .eq("user_id", user!.id)
        .eq("dish_id", input.dishId)
        .eq("action_type", input.action);
      if (error) {
        console.error("Action delete failed", error);
        return json({ error: "Could not remove dish action." }, 500);
      }
    }

    const { data: updatedDish } = await supabase.from("dishes").select("id,aggregate_rating,rating_count,review_count,want_to_try_count,favorite_count,trending_score").eq("id", input.dishId).single();
    EdgeRuntime.waitUntil(refreshTasteProfile(supabase, user!.id).catch((error) => console.error("taste profile refresh failed", error)));
    return json({ action: input.action, enabled: input.enabled, dish: updatedDish });
  } catch (error) {
    console.error("dish-interaction error", error);
    return json({ error: "Unexpected error." }, 500);
  }
});

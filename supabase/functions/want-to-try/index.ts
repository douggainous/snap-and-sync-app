import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.0";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

const BodySchema = z.object({
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  limit: z.number().int().min(1).max(100).default(60),
});

type Restaurant = {
  id?: string;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  cuisine?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  website_url?: string | null;
  maps_url?: string | null;
};

type Dish = {
  id: string;
  name: string;
  slug: string;
  cuisine?: string | null;
  section?: string | null;
  aggregate_rating?: number | null;
  review_count?: number | null;
  want_to_try_count?: number | null;
  favorite_count?: number | null;
  typical_price?: number | null;
  price_min?: number | null;
  price_max?: number | null;
  currency?: string | null;
  restaurant_id?: string | null;
  restaurants?: Restaurant | null;
};

type SavedRow = {
  dish_id: string;
  updated_at?: string | null;
  created_at?: string | null;
  dishes?: Dish | null;
};

type PlannedDish = Dish & {
  saved_at?: string | null;
  cover_image_url?: string | null;
  distance_miles?: number | null;
  location_group: string;
  plan_group: "Plan to visit" | "Nearby" | "Saved for later";
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function distanceMiles(from: { latitude: number; longitude: number } | null, to?: Restaurant | null) {
  if (!from || !to?.latitude || !to?.longitude) return null;
  const rad = Math.PI / 180;
  const dLat = (to.latitude - from.latitude) * rad;
  const dLon = (to.longitude - from.longitude) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(from.latitude * rad) * Math.cos(to.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function groupBy<T>(rows: T[], keyFor: (row: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) grouped.set(keyFor(row), [...(grouped.get(keyFor(row)) ?? []), row]);
  return [...grouped.entries()].map(([label, items]) => ({ label, items, count: items.length }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid want-to-try request.", details: parsed.error.flatten().fieldErrors }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return json({ error: "Backend is not configured." }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authentication required." }, 401);

    const authClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return json({ error: "Authentication required." }, 401);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const origin = parsed.data.latitude != null && parsed.data.longitude != null ? { latitude: parsed.data.latitude, longitude: parsed.data.longitude } : null;

    const { data: savedRows, error: savedError } = await supabase
      .from("saved_items")
      .select("dish_id,updated_at,created_at,dishes(id,name,slug,cuisine,section,aggregate_rating,review_count,want_to_try_count,favorite_count,typical_price,price_min,price_max,currency,restaurant_id,restaurants(id,name,address,city,cuisine,latitude,longitude,phone,website_url,maps_url))")
      .eq("user_id", user.id)
      .eq("action_type", "want_to_try")
      .order("updated_at", { ascending: false })
      .limit(parsed.data.limit);

    if (savedError) {
      console.error("want-to-try saved lookup failed", savedError);
      return json({ error: "Could not load want-to-try dishes." }, 500);
    }

    const rows = (savedRows ?? []) as SavedRow[];
    const dishIds = rows.map((row) => row.dish_id).filter(Boolean);
    const photosByDishId = new Map<string, string>();

    if (dishIds.length) {
      const { data: photos, error: photoError } = await supabase
        .from("photos")
        .select("dish_id,image_url,storage_path,storage_bucket,created_at")
        .in("dish_id", dishIds)
        .eq("is_public", true)
        .order("created_at", { ascending: false });
      if (photoError) console.error("want-to-try photo lookup failed", photoError);

      const photoRows = (photos ?? []) as { dish_id: string; image_url?: string | null; storage_path?: string | null; storage_bucket?: string | null }[];
      const signedPaths = photoRows.filter((photo) => photo.storage_bucket === "dish-photos" && photo.storage_path).map((photo) => photo.storage_path!);
      const signedUrlByPath = new Map<string, string>();
      if (signedPaths.length) {
        const signed = await supabase.storage.from("dish-photos").createSignedUrls(signedPaths, IMAGE_SIGNED_URL_TTL_SECONDS);
        for (const item of signed.data ?? []) if (item.path && item.signedUrl) signedUrlByPath.set(item.path, item.signedUrl);
      }

      for (const photo of photoRows) {
        if (photosByDishId.has(photo.dish_id)) continue;
        const imageUrl = photo.storage_path ? signedUrlByPath.get(photo.storage_path) ?? photo.image_url : photo.image_url;
        if (imageUrl) photosByDishId.set(photo.dish_id, imageUrl);
      }
    }

    const dishes = rows
      .map((row) => {
        if (!row.dishes) return null;
        const distance = distanceMiles(origin, row.dishes.restaurants);
        const restaurant = row.dishes.restaurants;
        const city = restaurant?.city?.trim();
        const locationGroup = city || restaurant?.name?.trim() || "Location pending";
        const planGroup = distance == null ? "Saved for later" : distance <= 5 ? "Plan to visit" : "Nearby";
        return {
          ...row.dishes,
          saved_at: row.updated_at ?? row.created_at ?? null,
          cover_image_url: photosByDishId.get(row.dish_id) ?? null,
          distance_miles: distance,
          location_group: locationGroup,
          plan_group: planGroup,
        } as PlannedDish;
      })
      .filter(Boolean) as PlannedDish[];

    const sorted = dishes.sort((a, b) => {
      const aDistance = a.distance_miles ?? Number.POSITIVE_INFINITY;
      const bDistance = b.distance_miles ?? Number.POSITIVE_INFINITY;
      if (aDistance !== bDistance) return aDistance - bDistance;
      return new Date(b.saved_at ?? 0).getTime() - new Date(a.saved_at ?? 0).getTime();
    });

    return json({
      dishes: sorted,
      groups: groupBy(sorted, (dish) => dish.location_group),
      plan_groups: groupBy(sorted, (dish) => dish.plan_group),
      calculation: {
        sort: origin ? "distance_miles asc, saved_at desc" : "saved_at desc with location groups retained",
        location_group: "restaurant city, otherwise restaurant name, otherwise Location pending",
        plan_group: "≤5 miles = Plan to visit, farther with coordinates = Nearby, missing coordinates = Saved for later",
      },
    });
  } catch (error) {
    console.error("want-to-try error", error);
    return json({ error: "Unexpected error." }, 500);
  }
});

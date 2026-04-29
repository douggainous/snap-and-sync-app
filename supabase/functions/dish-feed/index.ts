import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.0";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;
const VELOCITY_WINDOW_DAYS = 14;
const LOW_QUALITY_RATING_FLOOR = 3.2;
const STALE_DAYS = 180;
const DEFAULT_WEIGHTS = {
  quality: 0.38,
  popularity: 0.27,
  trending: 0.22,
  personalization: 0.13,
};

const BodySchema = z.object({
  mode: z.enum(["trending", "nearby", "recent"]).default("trending"),
  query: z.string().trim().max(100).optional().default(""),
  limit: z.number().int().min(1).max(30).default(10),
  offset: z.number().int().min(0).max(500).default(0),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  radiusMiles: z.number().min(1).max(250).default(50),
  rankingWeights: z.object({
    quality: z.number().min(0).max(1).optional(),
    popularity: z.number().min(0).max(1).optional(),
    trending: z.number().min(0).max(1).optional(),
    personalization: z.number().min(0).max(1).optional(),
  }).optional().default({}),
});

type Restaurant = {
  id: string;
  name: string;
  slug?: string | null;
  address?: string | null;
  city?: string | null;
  cuisine?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  website_url?: string | null;
  email?: string | null;
  google_place_id?: string | null;
  rating?: number | null;
  review_count?: number | null;
  price_level?: number | null;
  business_status?: string | null;
  maps_url?: string | null;
  photo_reference?: string | null;
};

type DishRow = {
  id: string;
  restaurant_id: string | null;
  name: string;
  slug: string;
  description?: string | null;
  section?: string | null;
  cuisine?: string | null;
  typical_price?: number | null;
  price_min?: number | null;
  price_max?: number | null;
  currency: string;
  aggregate_rating: number;
  rating_count: number;
  review_count: number;
  photo_count: number;
  save_count: number;
  want_to_try_count: number;
  favorite_count: number;
  like_count: number;
  trending_score: number;
  created_at: string;
  cover_photo_id?: string | null;
};

type RecentEngagement = {
  ratings: number;
  wantToTry: number;
  favorites: number;
  saves: number;
  lastEventAt?: string | null;
};

type UserSignals = {
  preferredCuisines: Set<string>;
  cuisineRatings: Map<string, { total: number; count: number }>;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function distanceMiles(from: { latitude: number; longitude: number }, to?: Restaurant | null) {
  if (!to?.latitude || !to?.longitude) return null;
  const rad = Math.PI / 180;
  const dLat = (to.latitude - from.latitude) * rad;
  const dLon = (to.longitude - from.longitude) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(from.latitude * rad) * Math.cos(to.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function recencyBoost(createdAt: string) {
  const ageDays = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  return Math.max(0, 30 - ageDays) * 1.5;
}

function engagementScore(dish: DishRow) {
  return Number(dish.aggregate_rating ?? 0) * 20
    + Number(dish.rating_count ?? 0) * 3
    + Number(dish.review_count ?? 0) * 4
    + Number(dish.photo_count ?? 0) * 3
    + Number(dish.want_to_try_count ?? 0) * 2
    + Number(dish.favorite_count ?? 0) * 3
    + Number(dish.save_count ?? 0)
    + recencyBoost(dish.created_at);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid feed request.", details: parsed.error.flatten().fieldErrors }, 400);

    const input = parsed.data;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Backend is not configured." }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader && supabaseAnonKey) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await authClient.auth.getUser();
      userId = user?.id ?? null;
    }
    const fetchCount = input.mode === "nearby" ? Math.min(250, input.offset + input.limit * 8) : input.limit;
    const fetchOffset = input.mode === "nearby" ? 0 : input.offset;

    let query = supabase
      .from("dishes")
      .select("id,restaurant_id,name,slug,description,section,cuisine,typical_price,price_min,price_max,currency,aggregate_rating,rating_count,review_count,photo_count,save_count,want_to_try_count,favorite_count,like_count,trending_score,created_at,cover_photo_id")
      .eq("is_published", true);

    const search = input.query.toLowerCase().replace(/[^a-z0-9\s'&/-]/g, " ").replace(/\s+/g, " ").trim();
    if (search) query = query.or(`normalized_name.ilike.%${search}%,description.ilike.%${search}%,cuisine.ilike.%${search}%`);

    if (input.mode === "recent") query = query.order("created_at", { ascending: false });
    else query = query.order("trending_score", { ascending: false }).order("created_at", { ascending: false });

    const { data: dishRows, error: dishError } = await query.range(fetchOffset, fetchOffset + fetchCount - 1);
    if (dishError) {
      console.error("dish feed query failed", dishError);
      return json({ error: "Could not load dish feed." }, 500);
    }

    const dishes = (dishRows ?? []) as DishRow[];
    const dishIds = dishes.map((dish) => dish.id);
    const restaurantIds = [...new Set(dishes.map((dish) => dish.restaurant_id).filter(Boolean))] as string[];

    const restaurantsById = new Map<string, Restaurant>();
    if (restaurantIds.length) {
      const { data: restaurants, error } = await supabase
        .from("restaurants")
        .select("id,name,slug,address,city,cuisine,latitude,longitude,phone,website_url,email,google_place_id,rating,review_count,price_level,business_status,maps_url,photo_reference")
        .in("id", restaurantIds);
      if (error) console.error("restaurant feed lookup failed", error);
      for (const restaurant of (restaurants ?? []) as Restaurant[]) restaurantsById.set(restaurant.id, restaurant);
    }

    const photosByDishId = new Map<string, { image_url?: string | null; storage_path?: string | null; storage_bucket?: string | null }>();
    if (dishIds.length) {
      const { data: photos, error } = await supabase
        .from("photos")
        .select("dish_id,image_url,storage_path,storage_bucket,created_at")
        .in("dish_id", dishIds)
        .eq("is_public", true)
        .order("created_at", { ascending: false });
      if (error) console.error("photo feed lookup failed", error);

      const photoRows = (photos ?? []) as { dish_id: string; image_url?: string | null; storage_path?: string | null; storage_bucket?: string | null }[];
      const signedPaths = photoRows.filter((photo) => photo.storage_bucket === "dish-photos" && photo.storage_path).map((photo) => photo.storage_path!)
      const signedUrlByPath = new Map<string, string>();
      if (signedPaths.length) {
        const signed = await supabase.storage.from("dish-photos").createSignedUrls(signedPaths, IMAGE_SIGNED_URL_TTL_SECONDS);
        for (const item of signed.data ?? []) if (item.path && item.signedUrl) signedUrlByPath.set(item.path, item.signedUrl);
      }

      for (const photo of photoRows) {
        if (photosByDishId.has(photo.dish_id)) continue;
        photosByDishId.set(photo.dish_id, {
          ...photo,
          image_url: photo.storage_path ? signedUrlByPath.get(photo.storage_path) ?? photo.image_url : photo.image_url,
        });
      }
    }

    const tagsByDishId = new Map<string, string[]>();
    if (dishIds.length) {
      const { data: dishTags, error } = await supabase.from("dish_tags").select("dish_id,tag_id").in("dish_id", dishIds);
      if (error) console.error("dish tag lookup failed", error);
      const tagRows = (dishTags ?? []) as { dish_id: string; tag_id: string }[];
      const tagIds = [...new Set(tagRows.map((row) => row.tag_id))];
      const tagNamesById = new Map<string, string>();
      if (tagIds.length) {
        const { data: tags, error: tagError } = await supabase.from("tags").select("id,name").in("id", tagIds);
        if (tagError) console.error("tag lookup failed", tagError);
        for (const tag of (tags ?? []) as { id: string; name: string }[]) tagNamesById.set(tag.id, tag.name);
      }
      for (const row of tagRows) {
        const tagName = tagNamesById.get(row.tag_id);
        if (!tagName) continue;
        tagsByDishId.set(row.dish_id, [...(tagsByDishId.get(row.dish_id) ?? []), tagName]);
      }
    }

    const actionsByDishId = new Map<string, Set<string>>();
    if (userId && dishIds.length) {
      const { data: savedActions, error } = await supabase.from("saved_items").select("dish_id,action_type").eq("user_id", userId).in("dish_id", dishIds).in("action_type", ["want_to_try", "favorite"]);
      if (error) console.error("saved action lookup failed", error);
      for (const action of (savedActions ?? []) as { dish_id: string; action_type: string }[]) actionsByDishId.set(action.dish_id, new Set([...(actionsByDishId.get(action.dish_id) ?? []), action.action_type]));
    }

    const origin = input.latitude != null && input.longitude != null ? { latitude: input.latitude, longitude: input.longitude } : null;
    let ranked = dishes.map((dish) => {
      const restaurant = dish.restaurant_id ? restaurantsById.get(dish.restaurant_id) ?? null : null;
      const distance = origin ? distanceMiles(origin, restaurant) : null;
      const score = input.mode === "nearby" && distance != null
        ? engagementScore(dish) - distance * 2
        : input.mode === "recent"
          ? recencyBoost(dish.created_at) + engagementScore(dish) * 0.2
          : engagementScore(dish);
      const photo = photosByDishId.get(dish.id);
      return {
        ...dish,
        tags: tagsByDishId.get(dish.id) ?? [],
        dietary_tags: [],
        cover_image_url: photo?.image_url ?? null,
        restaurants: restaurant,
        user_want_to_try: actionsByDishId.get(dish.id)?.has("want_to_try") ?? false,
        user_favorite: actionsByDishId.get(dish.id)?.has("favorite") ?? false,
        distance_miles: distance,
        feed_score: Number(score.toFixed(2)),
      };
    });

    if (input.mode === "nearby") {
      ranked = ranked
        .filter((dish) => dish.distance_miles != null && dish.distance_miles <= input.radiusMiles)
        .sort((a, b) => b.feed_score - a.feed_score)
        .slice(input.offset, input.offset + input.limit);
    }

    return json({ items: ranked, nextOffset: input.offset + ranked.length, hasMore: ranked.length === input.limit, mode: input.mode });
  } catch (error) {
    console.error("dish-feed error", error);
    return json({ error: "Unexpected error." }, 500);
  }
});

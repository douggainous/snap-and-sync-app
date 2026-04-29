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
  savedCuisines: Map<string, number>;
  affinityTags: Map<string, number>;
  savedDishIds: Set<string>;
};

type TrendMetric = {
  dish_id: string;
  recent_save_count: number;
  recent_rating_count: number;
  recent_share_count: number;
  save_velocity: number;
  rating_velocity: number;
  share_velocity: number;
  spike_score: number;
  trend_score: number;
  status: string;
  is_hot_nearby: boolean;
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

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function normalizeWeights(input: Partial<typeof DEFAULT_WEIGHTS>) {
  const raw = { ...DEFAULT_WEIGHTS, ...input };
  const total = Object.values(raw).reduce((sum, value) => sum + Number(value || 0), 0) || 1;
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Number(value || 0) / total])) as typeof DEFAULT_WEIGHTS;
}

function ageDays(date?: string | null) {
  if (!date) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - new Date(date).getTime()) / 86_400_000);
}

function scoreDish(dish: DishRow, dishTags: string[], recent: RecentEngagement, userSignals: UserSignals, weights: typeof DEFAULT_WEIGHTS) {
  const rating = Number(dish.aggregate_rating ?? 0);
  const ratingCount = Number(dish.rating_count ?? 0);
  const engagementTotal = Number(dish.want_to_try_count ?? 0) + Number(dish.favorite_count ?? 0) + Number(dish.save_count ?? 0) + Number(dish.like_count ?? 0) + Number(dish.review_count ?? 0) + Number(dish.photo_count ?? 0);
  const qualityScore = clamp((rating / 5) * 78 + Math.min(22, Math.log1p(ratingCount) * 7));
  const popularityScore = clamp(Math.log1p(engagementTotal * 1.2 + ratingCount * 1.5 + Number(dish.favorite_count ?? 0) * 2 + Number(dish.want_to_try_count ?? 0) * 1.7) * 16);
  const velocityEvents = recent.ratings * 2.4 + recent.favorites * 2.8 + recent.wantToTry * 2.1 + recent.saves * 1.2;
  const velocityFreshness = Math.max(0, 1 - ageDays(recent.lastEventAt) / VELOCITY_WINDOW_DAYS);
  const trendingScore = clamp(Math.log1p(velocityEvents) * 26 * (0.65 + velocityFreshness * 0.35) + recencyBoost(dish.created_at) * 0.45);
  const cuisine = dish.cuisine?.toLowerCase().trim() ?? "";
  const cuisineHistory = cuisine ? userSignals.cuisineRatings.get(cuisine) : undefined;
  const cuisineAffinity = cuisineHistory ? clamp(((cuisineHistory.total / cuisineHistory.count) / 5) * 80 + Math.min(20, cuisineHistory.count * 4)) : 0;
  const statedPreference = cuisine && userSignals.preferredCuisines.has(cuisine) ? 28 : 0;
  const savedCuisineAffinity = cuisine ? Math.min(28, (userSignals.savedCuisines.get(cuisine) ?? 0) * 7) : 0;
  const tagAffinity = Math.min(34, dishTags.reduce((sum, tag) => sum + (userSignals.affinityTags.get(tag.toLowerCase().trim()) ?? 0), 0) * 5);
  const alreadySavedPenalty = userSignals.savedDishIds.has(dish.id) ? -12 : 0;
  const personalizationScore = clamp(cuisineAffinity + statedPreference + savedCuisineAffinity + tagAffinity + alreadySavedPenalty);
  const score = qualityScore * weights.quality + popularityScore * weights.popularity + trendingScore * weights.trending + personalizationScore * weights.personalization;
  return { score, qualityScore, popularityScore, trendingScore, personalizationScore };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid feed request.", details: parsed.error.flatten().fieldErrors }, 400);

    const input = parsed.data;
    const rankingWeights = normalizeWeights(input.rankingWeights);
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
    const fetchCount = input.mode === "nearby" ? Math.min(250, input.offset + input.limit * 8) : Math.min(120, input.offset + input.limit * 6);
    const fetchOffset = input.mode === "nearby" ? 0 : input.offset;

    let query = supabase
      .from("dishes")
      .select("id,restaurant_id,name,slug,description,section,cuisine,typical_price,price_min,price_max,currency,aggregate_rating,rating_count,review_count,photo_count,save_count,want_to_try_count,favorite_count,like_count,trending_score,created_at,cover_photo_id")
      .eq("is_published", true);

    const search = input.query.toLowerCase().replace(/[^a-z0-9\s'&/-]/g, " ").replace(/\s+/g, " ").trim();
    if (search) query = query.or(`normalized_name.ilike.%${search}%,description.ilike.%${search}%,cuisine.ilike.%${search}%`);

    query = query.or(`rating_count.lt.3,aggregate_rating.gte.${LOW_QUALITY_RATING_FLOOR},created_at.gte.${new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString()}`);

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
    const recentByDishId = new Map<string, RecentEngagement>();
    const trendByDishId = new Map<string, TrendMetric>();
    const userSignals: UserSignals = { preferredCuisines: new Set(), cuisineRatings: new Map() };
    if (userId && dishIds.length) {
      const { data: savedActions, error } = await supabase.from("saved_items").select("dish_id,action_type").eq("user_id", userId).in("dish_id", dishIds).in("action_type", ["want_to_try", "favorite"]);
      if (error) console.error("saved action lookup failed", error);
      for (const action of (savedActions ?? []) as { dish_id: string; action_type: string }[]) actionsByDishId.set(action.dish_id, new Set([...(actionsByDishId.get(action.dish_id) ?? []), action.action_type]));

      const { data: profile } = await supabase.from("profiles").select("favorite_cuisines").eq("user_id", userId).maybeSingle();
      for (const cuisine of ((profile?.favorite_cuisines ?? []) as string[])) userSignals.preferredCuisines.add(cuisine.toLowerCase().trim());

      const { data: pastRatings, error: pastError } = await supabase.from("ratings").select("rating,dishes(cuisine)").eq("user_id", userId).order("updated_at", { ascending: false }).limit(80);
      if (pastError) console.error("user preference lookup failed", pastError);
      for (const row of (pastRatings ?? []) as { rating: number; dishes?: { cuisine?: string | null } | null }[]) {
        const cuisine = row.dishes?.cuisine?.toLowerCase().trim();
        if (!cuisine) continue;
        const current = userSignals.cuisineRatings.get(cuisine) ?? { total: 0, count: 0 };
        userSignals.cuisineRatings.set(cuisine, { total: current.total + Number(row.rating || 0), count: current.count + 1 });
      }
    }

    if (dishIds.length) {
      const since = new Date(Date.now() - VELOCITY_WINDOW_DAYS * 86_400_000).toISOString();
      const [recentRatingsResult, recentSavesResult, trendResult] = await Promise.all([
        supabase.from("ratings").select("dish_id,created_at").in("dish_id", dishIds).gte("created_at", since),
        supabase.from("saved_items").select("dish_id,action_type,created_at").in("dish_id", dishIds).gte("created_at", since),
        supabase.from("dish_trend_metrics").select("dish_id,recent_save_count,recent_rating_count,recent_share_count,save_velocity,rating_velocity,share_velocity,spike_score,trend_score,status,is_hot_nearby").in("dish_id", dishIds),
      ]);
      if (recentRatingsResult.error) console.error("recent rating velocity lookup failed", recentRatingsResult.error);
      if (recentSavesResult.error) console.error("recent save velocity lookup failed", recentSavesResult.error);
      if (trendResult.error) console.error("trend metric lookup failed", trendResult.error);
      for (const row of (trendResult.data ?? []) as TrendMetric[]) trendByDishId.set(row.dish_id, row);
      for (const row of (recentRatingsResult.data ?? []) as { dish_id: string; created_at: string }[]) {
        const current = recentByDishId.get(row.dish_id) ?? { ratings: 0, wantToTry: 0, favorites: 0, saves: 0 };
        current.ratings += 1;
        if (!current.lastEventAt || row.created_at > current.lastEventAt) current.lastEventAt = row.created_at;
        recentByDishId.set(row.dish_id, current);
      }
      for (const row of (recentSavesResult.data ?? []) as { dish_id: string; action_type: string; created_at: string }[]) {
        const current = recentByDishId.get(row.dish_id) ?? { ratings: 0, wantToTry: 0, favorites: 0, saves: 0 };
        if (row.action_type === "want_to_try") current.wantToTry += 1;
        else if (row.action_type === "favorite") current.favorites += 1;
        else current.saves += 1;
        if (!current.lastEventAt || row.created_at > current.lastEventAt) current.lastEventAt = row.created_at;
        recentByDishId.set(row.dish_id, current);
      }
    }

    const origin = input.latitude != null && input.longitude != null ? { latitude: input.latitude, longitude: input.longitude } : null;
    let ranked = dishes.map((dish) => {
      const restaurant = dish.restaurant_id ? restaurantsById.get(dish.restaurant_id) ?? null : null;
      const distance = origin ? distanceMiles(origin, restaurant) : null;
      const scoreParts = scoreDish(dish, recentByDishId.get(dish.id) ?? { ratings: 0, wantToTry: 0, favorites: 0, saves: 0 }, userSignals, rankingWeights);
      const score = input.mode === "nearby" && distance != null
        ? scoreParts.score - distance * 2
        : input.mode === "recent"
          ? recencyBoost(dish.created_at) + scoreParts.score * 0.35
          : scoreParts.score;
      const photo = photosByDishId.get(dish.id);
      const trend = trendByDishId.get(dish.id);
      const trendStatus = trend?.status === "viral" || scoreParts.trendingScore >= 80 ? "viral" : trend?.status === "trending" || scoreParts.trendingScore >= 45 ? "trending" : "normal";
      const trendLabels = [trendStatus === "viral" ? "Viral" : trendStatus === "trending" ? "Trending" : null, trend?.is_hot_nearby && input.mode === "nearby" ? "Hot near you" : null].filter(Boolean);
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
        ranking_signals: {
          quality: Number(scoreParts.qualityScore.toFixed(2)),
          popularity: Number(scoreParts.popularityScore.toFixed(2)),
          trending: Number(scoreParts.trendingScore.toFixed(2)),
          personalization: Number(scoreParts.personalizationScore.toFixed(2)),
        },
        trend_status: trendStatus,
        trend_labels: trendLabels,
        trend_metrics: trend ?? null,
      };
    });

    ranked = ranked
      .filter((dish) => input.mode !== "nearby" || (dish.distance_miles != null && dish.distance_miles <= input.radiusMiles))
      .sort((a, b) => b.feed_score - a.feed_score)
      .slice(input.mode === "nearby" ? input.offset : 0, (input.mode === "nearby" ? input.offset : 0) + input.limit);

    return json({ items: ranked, nextOffset: input.offset + ranked.length, hasMore: ranked.length === input.limit, mode: input.mode, rankingWeights });
  } catch (error) {
    console.error("dish-feed error", error);
    return json({ error: "Unexpected error." }, 500);
  }
});

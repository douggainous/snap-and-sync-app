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
const BOOST_DECAY_DAYS = 14;
const MAX_BOOST_MODIFIER = 8;
const DEFAULT_WEIGHTS = {
  quality: 0.34,
  popularity: 0.26,
  trending: 0.24,
  personalization: 0.16,
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
  boost_score?: number | null;
  boost_starts_at?: string | null;
  boost_ends_at?: string | null;
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
  recent_favorite_count?: number;
  recent_rating_count: number;
  recent_review_count?: number;
  recent_share_count: number;
  save_velocity: number;
  favorite_velocity?: number;
  rating_velocity: number;
  review_velocity?: number;
  share_velocity: number;
  spike_score: number;
  location_spike_score?: number;
  trend_score: number;
  status: string;
  is_hot_nearby: boolean;
};

type Sponsorship = {
  dish_id: string;
  label: string;
  sponsor_name?: string | null;
  boost_score: number;
  target_cuisine?: string | null;
  target_city?: string | null;
};

type DishTagRow = { dish_id: string; category?: string | null; confidence?: number | null; tags?: { name?: string | null } | null };

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

function dishBoostModifier(dish: DishRow, qualityScore: number) {
  const rawBoost = Number(dish.boost_score ?? 0);
  if (rawBoost <= 0) return 0;
  const now = Date.now();
  const startsAt = dish.boost_starts_at ? new Date(dish.boost_starts_at).getTime() : now;
  const endsAt = dish.boost_ends_at ? new Date(dish.boost_ends_at).getTime() : null;
  if (startsAt > now || (endsAt && endsAt <= now)) return 0;

  const rating = Number(dish.aggregate_rating ?? 0);
  const ratingCount = Number(dish.rating_count ?? 0);
  const trustMultiplier = ratingCount < 3 ? 0.45 : rating < LOW_QUALITY_RATING_FLOOR ? 0.25 : qualityScore >= 62 ? 1 : 0.65;
  const decayMultiplier = Math.max(0.2, 1 - ageDays(dish.boost_starts_at) / BOOST_DECAY_DAYS);
  return Math.min(MAX_BOOST_MODIFIER, rawBoost * 0.42 * trustMultiplier * decayMultiplier);
}

function sponsorshipMatches(sponsor: Sponsorship | undefined, dish: DishRow, restaurant?: Restaurant | null) {
  if (!sponsor) return false;
  const cuisine = (dish.cuisine ?? restaurant?.cuisine ?? "").toLowerCase();
  const city = (restaurant?.city ?? "").toLowerCase();
  return (!sponsor.target_cuisine || cuisine.includes(sponsor.target_cuisine.toLowerCase()))
    && (!sponsor.target_city || city.includes(sponsor.target_city.toLowerCase()));
}

function tagRankingBoost(tags: DishTagRow[], trend?: TrendMetric) {
  let boost = 0;
  const seen = new Set<string>();
  for (const row of tags) {
    const name = row.tags?.name?.toLowerCase().trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const confidence = Math.min(1, Math.max(0, Number(row.confidence ?? 0.7)));
    if (row.category === "cuisine" || row.category === "dish_type") boost += 1.6 * confidence;
    if (row.category === "flavor") boost += 1.1 * confidence;
  }
  if (trend?.status === "viral") boost += 3;
  else if (trend?.status === "trending") boost += 1.5;
  return Math.min(8, boost);
}

function scoreDish(dish: DishRow, dishTags: string[], recent: RecentEngagement, userSignals: UserSignals, weights: typeof DEFAULT_WEIGHTS, trend?: TrendMetric) {
  const rating = Number(dish.aggregate_rating ?? 0);
  const ratingCount = Number(dish.rating_count ?? 0);
  const ratingConfidence = 1 - Math.exp(-ratingCount / 6);
  const qualityScore = clamp((rating / 5) * 72 * ratingConfidence + Math.min(28, Math.log1p(ratingCount) * 10));
  const engagementTotal = Number(dish.favorite_count ?? 0) * 3.4 + Number(dish.want_to_try_count ?? 0) * 2.2 + Number(dish.save_count ?? 0) * 1.5 + Number(dish.like_count ?? 0) + Number(dish.review_count ?? 0) * 1.4 + Number(dish.photo_count ?? 0) * 1.1 + ratingCount * 1.8;
  const popularityScore = clamp(Math.log1p(engagementTotal) * 18);
  const persistedVelocity = Number(trend?.trend_score ?? 0) * 1.15 + Number(trend?.spike_score ?? 0) * 1.8 + Number(trend?.location_spike_score ?? 0) * 0.8 + Number(trend?.recent_rating_count ?? 0) * 2.2 + Number(trend?.recent_review_count ?? 0) * 2 + Number(trend?.recent_save_count ?? 0) * 1.8 + Number(trend?.recent_favorite_count ?? 0) * 3 + Number(trend?.recent_share_count ?? 0) * 2.8 + Math.max(0, Number(trend?.rating_velocity ?? 0)) * 2.4 + Math.max(0, Number(trend?.review_velocity ?? 0)) * 2 + Math.max(0, Number(trend?.save_velocity ?? 0)) * 2 + Math.max(0, Number(trend?.favorite_velocity ?? 0)) * 3;
  const recentVelocity = recent.ratings * 2.4 + recent.favorites * 3 + recent.wantToTry * 2.2 + recent.saves * 1.4;
  const velocityFreshness = Math.max(0, 1 - ageDays(recent.lastEventAt) / VELOCITY_WINDOW_DAYS);
  const statusBoost = trend?.status === "viral" ? 24 : trend?.status === "trending" ? 12 : 0;
  const trendingScore = clamp(Math.log1p(persistedVelocity + recentVelocity) * 22 * (0.72 + velocityFreshness * 0.28) + recencyBoost(dish.created_at) * 0.5 + statusBoost);
  const cuisine = dish.cuisine?.toLowerCase().trim() ?? "";
  const cuisineHistory = cuisine ? userSignals.cuisineRatings.get(cuisine) : undefined;
  const cuisineAffinity = cuisineHistory ? clamp(((cuisineHistory.total / cuisineHistory.count) / 5) * 74 + Math.min(26, cuisineHistory.count * 5)) : 0;
  const statedPreference = cuisine && userSignals.preferredCuisines.has(cuisine) ? 36 : 0;
  const savedCuisineAffinity = cuisine ? Math.min(32, (userSignals.savedCuisines.get(cuisine) ?? 0) * 8) : 0;
  const tagAffinity = Math.min(34, dishTags.reduce((sum, tag) => sum + (userSignals.affinityTags.get(tag.toLowerCase().trim()) ?? 0), 0) * 5);
  const alreadySavedPenalty = userSignals.savedDishIds.has(dish.id) ? -10 : 0;
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
        .select("id,restaurant_id,name,slug,description,section,cuisine,typical_price,price_min,price_max,currency,aggregate_rating,rating_count,review_count,photo_count,save_count,want_to_try_count,favorite_count,like_count,trending_score,boost_score,boost_starts_at,boost_ends_at,created_at,cover_photo_id")
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
      const firstPhotoRows: typeof photoRows = [];
      const seenPhotoDishIds = new Set<string>();
      for (const photo of photoRows) {
        if (seenPhotoDishIds.has(photo.dish_id)) continue;
        seenPhotoDishIds.add(photo.dish_id);
        firstPhotoRows.push(photo);
      }
      const signedPaths = firstPhotoRows.filter((photo) => photo.storage_bucket === "dish-photos" && photo.storage_path).map((photo) => photo.storage_path!)
      const signedUrlByPath = new Map<string, string>();
      if (signedPaths.length) {
        const signed = await supabase.storage.from("dish-photos").createSignedUrls(signedPaths, IMAGE_SIGNED_URL_TTL_SECONDS);
        for (const item of signed.data ?? []) if (item.path && item.signedUrl) signedUrlByPath.set(item.path, item.signedUrl);
      }

      for (const photo of firstPhotoRows) {
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
    const trendByDishId = new Map<string, TrendMetric>();
    const sponsorshipByDishId = new Map<string, Sponsorship>();
    const userSignals: UserSignals = { preferredCuisines: new Set(), cuisineRatings: new Map(), savedCuisines: new Map(), affinityTags: new Map(), savedDishIds: new Set() };
    if (userId && dishIds.length) {
      const { data: savedActions, error } = await supabase.from("saved_items").select("dish_id,action_type,dishes(cuisine)").eq("user_id", userId).in("action_type", ["saved", "want_to_try", "favorite"]).order("updated_at", { ascending: false }).limit(120);
      if (error) console.error("saved action lookup failed", error);
      for (const action of (savedActions ?? []) as { dish_id: string; action_type: string; dishes?: { cuisine?: string | null } | null }[]) {
        if (dishIds.includes(action.dish_id)) actionsByDishId.set(action.dish_id, new Set([...(actionsByDishId.get(action.dish_id) ?? []), action.action_type]));
        userSignals.savedDishIds.add(action.dish_id);
        const cuisine = action.dishes?.cuisine?.toLowerCase().trim();
        if (cuisine) userSignals.savedCuisines.set(cuisine, (userSignals.savedCuisines.get(cuisine) ?? 0) + (action.action_type === "favorite" ? 2 : 1));
      }

      const { data: profile } = await supabase.from("profiles").select("favorite_cuisines").eq("user_id", userId).maybeSingle();
      for (const cuisine of ((profile?.favorite_cuisines ?? []) as string[])) userSignals.preferredCuisines.add(cuisine.toLowerCase().trim());

      const { data: pastRatings, error: pastError } = await supabase.from("ratings").select("dish_id,rating,dishes(cuisine)").eq("user_id", userId).gte("rating", 4).order("updated_at", { ascending: false }).limit(80);
      if (pastError) console.error("user preference lookup failed", pastError);
      const highlyRatedDishIds: string[] = [];
      for (const row of (pastRatings ?? []) as { dish_id: string; rating: number; dishes?: { cuisine?: string | null } | null }[]) {
        highlyRatedDishIds.push(row.dish_id);
        const cuisine = row.dishes?.cuisine?.toLowerCase().trim();
        if (!cuisine) continue;
        const current = userSignals.cuisineRatings.get(cuisine) ?? { total: 0, count: 0 };
        userSignals.cuisineRatings.set(cuisine, { total: current.total + Number(row.rating || 0), count: current.count + 1 });
      }
      if (highlyRatedDishIds.length) {
        const { data: likedTags, error: likedTagsError } = await supabase.from("dish_tags").select("tag_id,tags(name)").in("dish_id", highlyRatedDishIds);
        if (likedTagsError) console.error("liked tag lookup failed", likedTagsError);
        for (const row of (likedTags ?? []) as { tags?: { name?: string | null } | null }[]) {
          const tag = row.tags?.name?.toLowerCase().trim();
          if (tag) userSignals.affinityTags.set(tag, (userSignals.affinityTags.get(tag) ?? 0) + 1);
        }
      }
    }

    if (dishIds.length) {
      const { data: trends, error } = await supabase.from("dish_trend_metrics").select("dish_id,recent_save_count,recent_favorite_count,recent_rating_count,recent_review_count,recent_share_count,save_velocity,favorite_velocity,rating_velocity,review_velocity,share_velocity,spike_score,location_spike_score,trend_score,status,is_hot_nearby").in("dish_id", dishIds);
      if (error) console.error("trend metric lookup failed", error);
      for (const trend of (trends ?? []) as TrendMetric[]) trendByDishId.set(trend.dish_id, trend);

      const { data: sponsorships, error: sponsorError } = await supabase.from("dish_sponsorships").select("dish_id,label,sponsor_name,boost_score,target_cuisine,target_city").in("dish_id", dishIds).eq("is_active", true).lte("starts_at", new Date().toISOString()).or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`).order("boost_score", { ascending: false });
      if (sponsorError) console.error("sponsorship lookup failed", sponsorError);
      for (const sponsor of (sponsorships ?? []) as Sponsorship[]) if (!sponsorshipByDishId.has(sponsor.dish_id)) sponsorshipByDishId.set(sponsor.dish_id, sponsor);
    }

    const origin = input.latitude != null && input.longitude != null ? { latitude: input.latitude, longitude: input.longitude } : null;
    let ranked = dishes.map((dish) => {
      const restaurant = dish.restaurant_id ? restaurantsById.get(dish.restaurant_id) ?? null : null;
      const distance = origin ? distanceMiles(origin, restaurant) : null;
      const itemTags = tagsByDishId.get(dish.id) ?? [];
      const trend = trendByDishId.get(dish.id);
      const sponsor = sponsorshipByDishId.get(dish.id);
      const isRelevantSponsor = sponsorshipMatches(sponsor, dish, restaurant);
      const recentFromTrend = { ratings: Number(trend?.recent_rating_count ?? 0), wantToTry: Number(trend?.recent_save_count ?? 0), favorites: Number(trend?.recent_favorite_count ?? 0), saves: Number(trend?.recent_save_count ?? 0) };
      const scoreParts = scoreDish(dish, itemTags, recentFromTrend, userSignals, rankingWeights, trend);
      const nativeBoost = dishBoostModifier(dish, scoreParts.qualityScore);
      const score = input.mode === "nearby" && distance != null
        ? scoreParts.score - distance * 2 + nativeBoost + (isRelevantSponsor ? Math.min(12, Number(sponsor?.boost_score ?? 0)) : 0)
        : input.mode === "recent"
          ? recencyBoost(dish.created_at) + scoreParts.score * 0.35 + nativeBoost * 0.5 + (isRelevantSponsor ? Math.min(6, Number(sponsor?.boost_score ?? 0)) : 0)
          : scoreParts.score + nativeBoost + (isRelevantSponsor ? Math.min(12, Number(sponsor?.boost_score ?? 0)) : 0);
      const photo = photosByDishId.get(dish.id);
      const trendStatus = trend?.status === "viral" ? "viral" : trend?.status === "trending" ? "trending" : "normal";
      const trendLabels = [trendStatus === "viral" ? "Viral" : trendStatus === "trending" ? "Trending" : null, trend?.is_hot_nearby ? "Hot near you" : null].filter(Boolean);
      return {
        ...dish,
        tags: itemTags,
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
          boost: Number(nativeBoost.toFixed(2)),
        },
        trend_status: trendStatus,
        trend_labels: isRelevantSponsor ? [sponsor?.label || "Sponsored", ...trendLabels] : trendLabels,
        trend_metrics: trend ?? null,
        is_sponsored: isRelevantSponsor,
        sponsorship: isRelevantSponsor ? sponsor : null,
      };
    });

    const sorted = ranked
      .filter((dish) => input.mode !== "nearby" || (dish.distance_miles != null && dish.distance_miles <= input.radiusMiles))
      .sort((a, b) => b.feed_score - a.feed_score);
    const organic = sorted.filter((dish) => !dish.is_sponsored);
    const sponsored = sorted.filter((dish) => dish.is_sponsored).slice(0, 1);
    const blended = input.offset === 0 && sponsored.length && organic.length >= 4
      ? [...organic.slice(0, 9), sponsored[0], ...organic.slice(9)]
      : sorted;
    ranked = blended.slice(input.mode === "nearby" ? input.offset : 0, (input.mode === "nearby" ? input.offset : 0) + input.limit);

    return json({ items: ranked, nextOffset: input.offset + ranked.length, hasMore: ranked.length === input.limit, mode: input.mode, rankingWeights });
  } catch (error) {
    console.error("dish-feed error", error);
    return json({ error: "Unexpected error." }, 500);
  }
});

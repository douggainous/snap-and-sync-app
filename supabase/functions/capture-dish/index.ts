import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.0";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;
declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const BodySchema = z.object({
  dishName: z.string().trim().min(2).max(120),
  restaurantName: z.string().trim().max(120).optional().nullable(),
  imageBase64: z.string().min(100).max(12_000_000).optional(),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]).optional(),
  fileName: z.string().trim().max(160).optional(),
  images: z.array(z.object({ imageBase64: z.string().min(100).max(12_000_000), mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]), fileName: z.string().trim().max(160).optional() })).max(6).optional(),
  forceNewDish: z.boolean().default(false),
  rating: z.number().min(1).max(5).optional(),
  review: z.string().trim().max(1200).optional().nullable(),
  pricePaid: z.number().min(0).max(10000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
  metrics: z.object({
    wouldOrderAgain: z.boolean().optional(),
    temperature: z.number().int().min(1).max(5).optional(),
    spiciness: z.number().int().min(0).max(5).optional(),
    sweetSavory: z.number().int().min(1).max(5).optional(),
    flavorIntensity: z.number().int().min(1).max(5).optional(),
  }).optional(),
}).superRefine((value, ctx) => {
  if (!value.images?.length && (!value.imageBase64 || !value.mimeType)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one image is required.", path: ["images"] });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "dish";
const extFor = (mimeType: string) => mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : mimeType === "image/heic" ? "heic" : mimeType === "image/heif" ? "heif" : "jpg";
const cleanTag = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
const confidenceLevel = (confidence?: number | null) => confidence != null && confidence >= 0.82 ? "high" : confidence != null && confidence >= 0.55 ? "medium" : "low";
const normalizeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const tokenSet = (value: string) => new Set(normalizeName(value).split(" ").filter((token) => token.length > 1));
const jaccard = (a: Set<string>, b: Set<string>) => {
  const union = new Set([...a, ...b]);
  if (!union.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / union.size;
};
const sha256Hex = async (bytes: Uint8Array) => {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

async function recognizeDish(imageBase64: string, mimeType: string, context: { dishName: string; restaurantName?: string | null }) {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) return { status: "failed", dishName: null, cuisine: null, tags: [], ingredients: [], confidence: null, confidenceLevel: "low", rawResult: {}, error: "Lovable AI is not configured." };

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
      messages: [
          { role: "system", content: "Recognize the primary prepared food dish in the image. Return only tool output. Be conservative: if uncertain, lower confidence. Include cuisine and ingredients only when visually supported. Tags should be short and useful for discovery." },
        { role: "user", content: [{ type: "text", text: `Identify this dish. User context: ${JSON.stringify(context)}` }, { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } }] },
      ],
        tools: [{ type: "function", function: { name: "recognize_dish", description: "Return dish recognition suggestions for a food photo.", parameters: { type: "object", properties: { dishName: { type: "string" }, cuisine: { type: "string" }, tags: { type: "array", items: { type: "string" }, maxItems: 8 }, ingredients: { type: "array", items: { type: "string" }, maxItems: 8 }, confidence: { type: "number", minimum: 0, maximum: 1 } }, required: ["dishName", "cuisine", "tags", "ingredients", "confidence"], additionalProperties: false } } }],
      tool_choice: { type: "function", function: { name: "recognize_dish" } },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) return { status: "rate_limited", dishName: null, cuisine: null, tags: [], ingredients: [], confidence: null, confidenceLevel: "low", rawResult: {}, error: "AI rate limit reached. Dish was saved without AI suggestions." };
    if (response.status === 402) return { status: "payment_required", dishName: null, cuisine: null, tags: [], ingredients: [], confidence: null, confidenceLevel: "low", rawResult: {}, error: "AI credits are exhausted. Dish was saved without AI suggestions." };
    console.error("Lovable AI dish recognition failed", response.status, await response.text());
    return { status: "failed", dishName: null, cuisine: null, tags: [], ingredients: [], confidence: null, confidenceLevel: "low", rawResult: {}, error: "AI recognition failed. Dish was saved without AI suggestions." };
  }

  const data = await response.json();
  const toolArgs = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!toolArgs) return { status: "failed", dishName: null, cuisine: null, tags: [], ingredients: [], confidence: null, confidenceLevel: "low", rawResult: {}, error: "AI returned no dish suggestion." };
  const parsed = JSON.parse(toolArgs) as { dishName?: string; cuisine?: string; tags?: string[]; ingredients?: string[]; confidence?: number };
  const confidence = typeof parsed.confidence === "number" ? parsed.confidence : null;
  return { status: "completed", dishName: parsed.dishName?.trim().slice(0, 120) || null, cuisine: parsed.cuisine?.trim().slice(0, 80) || null, tags: [...new Set((parsed.tags ?? []).map(cleanTag).filter(Boolean))].slice(0, 8), ingredients: [...new Set((parsed.ingredients ?? []).map(cleanTag).filter(Boolean))].slice(0, 8), confidence, confidenceLevel: confidenceLevel(confidence), rawResult: parsed, error: null };
}

async function findDishMatch(supabase: ReturnType<typeof createClient>, input: { dishName: string; tags: string[]; restaurantId: string | null; imageHash: string | null }) {
  const inputName = normalizeName(input.dishName);
  const inputTokens = tokenSet(input.dishName);
  const inputTags = new Set(input.tags.map(cleanTag).filter(Boolean));
  const candidates = new Map<string, { id: string; name: string; restaurant_id: string | null; aggregate_rating?: number | null; rating_count?: number | null; tags: string[]; imageExact: boolean }>();

  if (input.imageHash) {
    const { data } = await supabase.from("photos").select("dish_id,dishes(id,name,restaurant_id,aggregate_rating,rating_count,is_published)").eq("image_hash", input.imageHash).limit(6);
    for (const row of data ?? []) {
      const dish = Array.isArray(row.dishes) ? row.dishes[0] : row.dishes;
      if (dish?.id && dish.is_published) candidates.set(dish.id, { id: dish.id, name: dish.name, restaurant_id: dish.restaurant_id, aggregate_rating: dish.aggregate_rating, rating_count: dish.rating_count, tags: [], imageExact: true });
    }
  }

  let query = supabase.from("dishes").select("id,name,restaurant_id,aggregate_rating,rating_count,dish_tags(tags(name))").eq("is_published", true).limit(18);
  if (input.restaurantId) query = query.eq("restaurant_id", input.restaurantId);
  else query = query.ilike("normalized_name", `%${inputName.slice(0, 48)}%`);
  const { data: nameRows } = await query;
  for (const row of nameRows ?? []) {
    const tags = ((row.dish_tags ?? []) as Array<{ tags?: { name?: string } | null }>).map((item) => item.tags?.name).filter(Boolean) as string[];
    const existing = candidates.get(row.id);
    candidates.set(row.id, { id: row.id, name: row.name, restaurant_id: row.restaurant_id, aggregate_rating: row.aggregate_rating, rating_count: row.rating_count, tags: existing?.tags?.length ? existing.tags : tags, imageExact: existing?.imageExact ?? false });
  }

  let best: { dishId: string; score: number; reasons: string[]; dishName: string } | null = null;
  for (const candidate of candidates.values()) {
    const candidateName = normalizeName(candidate.name);
    const nameScore = candidateName === inputName ? 0.5 : jaccard(inputTokens, tokenSet(candidate.name)) * 0.42;
    const restaurantScore = input.restaurantId && candidate.restaurant_id === input.restaurantId ? 0.24 : 0;
    const tagOverlap = candidate.tags.map(cleanTag).filter((tag) => inputTags.has(tag)).length;
    const tagScore = Math.min(0.16, tagOverlap * 0.06);
    const imageScore = candidate.imageExact ? 0.4 : 0;
    const qualityFloor = (candidate.aggregate_rating ?? 0) >= 3.5 || (candidate.rating_count ?? 0) === 0 ? 0.02 : -0.08;
    const score = Math.max(0, Math.min(1, nameScore + restaurantScore + tagScore + imageScore + qualityFloor));
    const reasons = [candidate.imageExact ? "same image" : null, nameScore >= 0.42 ? "same dish name" : nameScore >= 0.24 ? "similar dish name" : null, restaurantScore ? "same restaurant" : null, tagOverlap ? "matching tags" : null].filter(Boolean) as string[];
    if (score >= 0.72 && (!best || score > best.score)) best = { dishId: candidate.id, score, reasons, dishName: candidate.name };
  }
  return best;
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
    if (!parsed.success) return json({ error: "Invalid dish capture payload.", details: parsed.error.flatten().fieldErrors }, 400);

    const input = parsed.data;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    await supabase.from("users").upsert({
      id: user.id,
      email: user.email ?? null,
      display_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      avatar_url: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    });

    let restaurantId: string | null = null;
    if (input.restaurantName) {
      const restaurantSlug = `${slugify(input.restaurantName)}-${crypto.randomUUID().slice(0, 8)}`;
      const { data: restaurant, error } = await supabase
        .from("restaurants")
        .insert({ name: input.restaurantName, slug: restaurantSlug, normalized_name: input.restaurantName.toLowerCase(), created_by: user.id })
        .select("id,name,slug")
        .single();
      if (error) {
        console.error("Restaurant creation failed", error);
        return json({ error: "Could not save restaurant." }, 500);
      }
      restaurantId = restaurant.id;
    }

    const dishSlug = `${slugify(input.dishName)}-${crypto.randomUUID().slice(0, 8)}`;
    const { data: dish, error: dishError } = await supabase
      .from("dishes")
      .insert({
        restaurant_id: restaurantId,
        created_by: user.id,
        name: input.dishName,
        slug: dishSlug,
        normalized_name: input.dishName.toLowerCase(),
        typical_price: input.pricePaid ?? null,
        currency: "USD",
        is_published: true,
      })
      .select("id,name,slug,restaurant_id,created_at")
      .single();
    if (dishError) {
      console.error("Dish creation failed", dishError);
      return json({ error: "Could not save dish." }, 500);
    }

    const images = input.images?.length ? input.images : [{ imageBase64: input.imageBase64!, mimeType: input.mimeType!, fileName: input.fileName }];
    const photos = [];
    let firstImageHash: string | null = null;
    for (const [index, image] of images.entries()) {
      const binary = Uint8Array.from(atob(image.imageBase64), (char) => char.charCodeAt(0));
      if (binary.byteLength > 8 * 1024 * 1024) return json({ error: "Each image must be 8MB or smaller." }, 413);
      const imageHash = await sha256Hex(binary);
      if (index === 0) firstImageHash = imageHash;
      const path = `${user.id}/dishes/${dish.id}/${Date.now()}-${index}-${slugify(image.fileName ?? input.dishName)}.${extFor(image.mimeType)}`;
      const upload = await supabase.storage.from("dish-photos").upload(path, binary, { contentType: image.mimeType, cacheControl: "31536000", upsert: false });
      if (upload.error) return json({ error: "Could not upload photo." }, 500);
      const signed = await supabase.storage.from("dish-photos").createSignedUrl(path, IMAGE_SIGNED_URL_TTL_SECONDS);
      const { data: photo, error: photoError } = await supabase.from("photos").insert({ dish_id: dish.id, user_id: user.id, storage_bucket: "dish-photos", storage_path: path, image_url: signed.data?.signedUrl ?? null, alt_text: `${input.dishName} photo ${index + 1}`, is_public: true, image_hash: imageHash, ai_status: index === 0 ? "pending" : "not_requested" }).select("id,dish_id,storage_path,image_url,alt_text,created_at,ai_dish_name,ai_tags,ai_confidence,ai_status,ai_error,image_hash,ai_cuisine,ai_ingredients").single();
      if (photoError) {
        await supabase.storage.from("dish-photos").remove([path]);
        return json({ error: "Could not save photo record." }, 500);
      }
      photos.push(photo);
    }

    await supabase.from("dishes").update({ cover_photo_id: photos[0]?.id ?? null }).eq("id", dish.id);

    let cachedAi: { status: string; dish_name?: string | null; cuisine?: string | null; tags?: string[] | null; ingredients?: string[] | null; confidence?: number | null; confidence_level?: string | null; error?: string | null } | null = null;
    if (firstImageHash && photos[0]) {
      const { data: existing } = await supabase.from("dish_ai_recognitions").select("status,dish_name,cuisine,tags,ingredients,confidence,confidence_level,error").eq("image_hash", firstImageHash).maybeSingle();
      if (existing?.status === "completed") {
        cachedAi = existing;
        await supabase.from("photos").update({ ai_dish_name: existing.dish_name ?? null, ai_cuisine: existing.cuisine ?? null, ai_tags: existing.tags ?? [], ai_ingredients: existing.ingredients ?? [], ai_confidence: existing.confidence ?? null, ai_status: "completed", ai_error: null }).eq("id", photos[0].id);
      } else {
        await supabase.from("dish_ai_recognitions").upsert({ user_id: user.id, dish_id: dish.id, photo_id: photos[0].id, image_hash: firstImageHash, status: "pending" }, { onConflict: "image_hash" });
        EdgeRuntime.waitUntil((async () => {
          const ai = await recognizeDish(images[0].imageBase64, images[0].mimeType, { dishName: input.dishName, restaurantName: input.restaurantName });
          await supabase.from("dish_ai_recognitions").update({ status: ai.status, dish_name: ai.dishName, cuisine: ai.cuisine, tags: ai.tags, ingredients: ai.ingredients, confidence: ai.confidence, confidence_level: ai.confidenceLevel, raw_result: ai.rawResult, error: ai.error }).eq("image_hash", firstImageHash);
          await supabase.from("photos").update({ ai_dish_name: ai.dishName, ai_cuisine: ai.cuisine, ai_tags: ai.tags, ai_ingredients: ai.ingredients, ai_confidence: ai.confidence, ai_status: ai.status, ai_error: ai.error }).eq("id", photos[0].id);
          if (ai.status === "completed" && ai.confidenceLevel === "high") {
            const allTags = [...new Set([...(input.tags ?? []), ...ai.tags].map(cleanTag).filter(Boolean))].slice(0, 8);
            for (const tagName of allTags) {
              const tagSlug = slugify(tagName);
              const { data: tag } = await supabase.from("tags").upsert({ name: tagName, slug: tagSlug }, { onConflict: "slug" }).select("id").single();
              if (tag?.id) await supabase.from("dish_tags").upsert({ dish_id: dish.id, tag_id: tag.id, created_by: user.id });
            }
            await supabase.from("dishes").update({ cuisine: ai.cuisine ?? null }).eq("id", dish.id).is("cuisine", null);
          }
        })());
      }
    }

    let rating = null;
    let review = null;
    if (input.rating) {
      const { data: ratingRow, error: ratingError } = await supabase
        .from("ratings")
        .insert({
          dish_id: dish.id,
          user_id: user.id,
          rating: input.rating,
          would_order_again: input.metrics?.wouldOrderAgain ?? null,
          temperature_rating: input.metrics?.temperature ?? null,
          spiciness_rating: input.metrics?.spiciness ?? null,
          sweet_savory_rating: input.metrics?.sweetSavory ?? null,
          flavor_intensity_rating: input.metrics?.flavorIntensity ?? null,
          is_public: true,
        })
        .select("id,rating")
        .single();
      if (ratingError) console.error("Rating save failed", ratingError);
      else rating = ratingRow;

      if (ratingRow && (input.review || input.pricePaid !== undefined)) {
        const { data: reviewRow, error: reviewError } = await supabase
          .from("reviews")
          .insert({ dish_id: dish.id, user_id: user.id, rating_id: ratingRow.id, body: input.review ?? null, price_paid: input.pricePaid ?? null, currency: "USD", is_public: true })
          .select("id,body,price_paid")
          .single();
        if (reviewError) console.error("Review save failed", reviewError);
        else review = reviewRow;
      }
    }

    const allTags = [...new Set(input.tags.map(cleanTag).filter(Boolean))].slice(0, 8);
    for (const tagName of allTags) {
      const tagSlug = slugify(tagName);
      const { data: tag } = await supabase.from("tags").upsert({ name: tagName, slug: tagSlug }, { onConflict: "slug" }).select("id").single();
      if (tag?.id) await supabase.from("dish_tags").upsert({ dish_id: dish.id, tag_id: tag.id, created_by: user.id });
    }

    return json({ dish, photo: photos[0] ?? null, photos, rating, review, url: photos[0]?.image_url ?? null, aiSuggestion: cachedAi ? { dishName: cachedAi.dish_name, cuisine: cachedAi.cuisine, tags: cachedAi.tags ?? [], ingredients: cachedAi.ingredients ?? [], confidence: cachedAi.confidence, confidenceLevel: cachedAi.confidence_level, status: cachedAi.status, error: cachedAi.error } : { status: "pending", confidenceLevel: "low", dishName: null, cuisine: null, tags: [], ingredients: [], confidence: null, error: null } });
  } catch (error) {
    console.error("capture-dish error", error);
    return json({ error: "Unexpected error." }, 500);
  }
});

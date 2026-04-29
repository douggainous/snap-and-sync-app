import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.0";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  dishName: z.string().trim().min(2).max(120),
  restaurantName: z.string().trim().max(120).optional().nullable(),
  imageBase64: z.string().min(100).max(12_000_000).optional(),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
  fileName: z.string().trim().max(160).optional(),
  images: z.array(z.object({ imageBase64: z.string().min(100).max(12_000_000), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), fileName: z.string().trim().max(160).optional() })).max(6).optional(),
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
const extFor = (mimeType: string) => mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
const cleanTag = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

async function recognizeDish(imageBase64: string, mimeType: string, context: { dishName: string; restaurantName?: string | null }) {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) return { status: "failed", dishName: null, tags: [], confidence: null, error: "Lovable AI is not configured." };

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: "Recognize the primary prepared food dish in the image. Return only tool output. Be conservative: if uncertain, use the user's typed dish as a hint and lower confidence. Tags should describe cuisine, ingredients, dietary style, preparation, flavor, and course." },
        { role: "user", content: [{ type: "text", text: `Identify this dish. User context: ${JSON.stringify(context)}` }, { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } }] },
      ],
      tools: [{ type: "function", function: { name: "recognize_dish", description: "Return dish recognition suggestions for a food photo.", parameters: { type: "object", properties: { dishName: { type: "string" }, tags: { type: "array", items: { type: "string" }, maxItems: 8 }, confidence: { type: "number", minimum: 0, maximum: 1 } }, required: ["dishName", "tags", "confidence"], additionalProperties: false } } }],
      tool_choice: { type: "function", function: { name: "recognize_dish" } },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) return { status: "rate_limited", dishName: null, tags: [], confidence: null, error: "AI rate limit reached. Dish was saved without AI suggestions." };
    if (response.status === 402) return { status: "payment_required", dishName: null, tags: [], confidence: null, error: "AI credits are exhausted. Dish was saved without AI suggestions." };
    console.error("Lovable AI dish recognition failed", response.status, await response.text());
    return { status: "failed", dishName: null, tags: [], confidence: null, error: "AI recognition failed. Dish was saved without AI suggestions." };
  }

  const data = await response.json();
  const toolArgs = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!toolArgs) return { status: "failed", dishName: null, tags: [], confidence: null, error: "AI returned no dish suggestion." };
  const parsed = JSON.parse(toolArgs) as { dishName?: string; tags?: string[]; confidence?: number };
  return { status: "completed", dishName: parsed.dishName?.trim().slice(0, 120) || null, tags: [...new Set((parsed.tags ?? []).map(cleanTag).filter(Boolean))].slice(0, 8), confidence: typeof parsed.confidence === "number" ? parsed.confidence : null, error: null };
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
    const ai = await recognizeDish(images[0].imageBase64, images[0].mimeType, { dishName: input.dishName, restaurantName: input.restaurantName });
    const photos = [];
    for (const [index, image] of images.entries()) {
      const binary = Uint8Array.from(atob(image.imageBase64), (char) => char.charCodeAt(0));
      if (binary.byteLength > 8 * 1024 * 1024) return json({ error: "Each image must be 8MB or smaller." }, 413);
      const path = `${user.id}/dishes/${dish.id}/${Date.now()}-${index}-${slugify(image.fileName ?? input.dishName)}.${extFor(image.mimeType)}`;
      const upload = await supabase.storage.from("dish-photos").upload(path, binary, { contentType: image.mimeType, cacheControl: "31536000", upsert: false });
      if (upload.error) return json({ error: "Could not upload photo." }, 500);
      const signed = await supabase.storage.from("dish-photos").createSignedUrl(path, 60 * 60 * 24 * 7);
      const { data: photo, error: photoError } = await supabase.from("photos").insert({ dish_id: dish.id, user_id: user.id, storage_bucket: "dish-photos", storage_path: path, image_url: signed.data?.signedUrl ?? null, alt_text: `${input.dishName} photo ${index + 1}`, is_public: true, ai_dish_name: index === 0 ? ai.dishName : null, ai_tags: index === 0 ? ai.tags : [], ai_confidence: index === 0 ? ai.confidence : null, ai_status: index === 0 ? ai.status : "not_requested", ai_error: index === 0 ? ai.error : null }).select("id,dish_id,storage_path,image_url,alt_text,created_at,ai_dish_name,ai_tags,ai_confidence,ai_status,ai_error").single();
      if (photoError) {
        await supabase.storage.from("dish-photos").remove([path]);
        return json({ error: "Could not save photo record." }, 500);
      }
      photos.push(photo);
    }

    await supabase.from("dishes").update({ cover_photo_id: photos[0]?.id ?? null }).eq("id", dish.id);

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

    const allTags = [...new Set([...input.tags, ...ai.tags].map(cleanTag).filter(Boolean))].slice(0, 8);
    for (const tagName of allTags) {
      const tagSlug = slugify(tagName);
      const { data: tag } = await supabase.from("tags").upsert({ name: tagName, slug: tagSlug }, { onConflict: "slug" }).select("id").single();
      if (tag?.id) await supabase.from("dish_tags").upsert({ dish_id: dish.id, tag_id: tag.id, created_by: user.id });
    }

    return json({ dish, photo, rating, review, url: signed.data?.signedUrl ?? null, aiSuggestion: { dishName: ai.dishName, tags: ai.tags, confidence: ai.confidence, status: ai.status, error: ai.error } });
  } catch (error) {
    console.error("capture-dish error", error);
    return json({ error: "Unexpected error." }, 500);
  }
});

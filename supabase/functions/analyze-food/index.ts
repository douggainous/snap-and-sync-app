import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.0";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  imageBase64: z.string().min(100).max(12_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
  context: z.object({
    restaurantName: z.string().trim().max(160).optional(),
    dishName: z.string().trim().max(140).optional(),
    visibleTextHint: z.string().trim().max(500).optional(),
  }).optional(),
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Please sign in before analyzing food photos." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!supabaseUrl || !supabaseAnonKey) return json({ error: "Backend auth is not configured." }, 500);
    if (!lovableApiKey) return json({ error: "Lovable AI is not configured." }, 500);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Please sign in before analyzing food photos." }, 401);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid image payload.", details: parsed.error.flatten().fieldErrors }, 400);

    const { imageBase64, mimeType, context } = parsed.data;
    const systemPrompt = `You analyze restaurant food, menu, and receipt images for a social food discovery app. Return only tool output. Be conservative when uncertain. Extract OCR text when visible, but do not invent prices or restaurant names.`;
    const userText = `Analyze this image for a food review post. Context: ${JSON.stringify(context ?? {})}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_food_post_metadata",
              description: "Extract structured metadata from a restaurant food, menu, or receipt image.",
              parameters: {
                type: "object",
                properties: {
                  restaurantName: { type: "string" },
                  dishName: { type: "string" },
                  cuisine: { type: "string" },
                  foodTags: { type: "array", items: { type: "string" } },
                  dietaryTags: { type: "array", items: { type: "string" } },
                  ingredients: { type: "array", items: { type: "string" } },
                  price: { type: "number" },
                  ocrText: { type: "string" },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  notes: { type: "string" }
                },
                required: ["foodTags", "dietaryTags", "ingredients", "ocrText", "confidence"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_food_post_metadata" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return json({ error: "AI rate limit reached. Please wait a moment and try again." }, 429);
      if (response.status === 402) return json({ error: "AI credits are exhausted. Please add credits in Workspace Usage." }, 402);
      const details = await response.text();
      console.error("Lovable AI error", response.status, details);
      return json({ error: "AI analysis failed. Please try again." }, 500);
    }

    const data = await response.json();
    const toolArgs = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!toolArgs) return json({ error: "AI analysis returned no structured result." }, 500);

    return json({ result: JSON.parse(toolArgs) });
  } catch (error) {
    console.error("analyze-food error", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

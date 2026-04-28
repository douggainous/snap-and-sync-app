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
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Please sign in before scanning menus." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!supabaseUrl || !supabaseAnonKey) return json({ error: "Backend auth is not configured." }, 500);
    if (!lovableApiKey) return json({ error: "Lovable AI is not configured." }, 500);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Please sign in before scanning menus." }, 401);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid image payload.", details: parsed.error.flatten().fieldErrors }, 400);

    const { imageBase64, mimeType, context } = parsed.data;
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Extract structured menu items and prices from restaurant menu, receipt, or dish photos. Return only tool output. Be conservative and preserve uncertainty with confidence scores." },
          { role: "user", content: [{ type: "text", text: `Extract menu items for confirmation. Context: ${JSON.stringify(context ?? {})}` }, { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } }] },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_menu_items",
            description: "Extract multiple menu items from a menu/receipt/photo for user confirmation.",
            parameters: {
              type: "object",
              properties: {
                restaurantName: { type: "string" },
                currency: { type: "string" },
                ocrText: { type: "string" },
                items: { type: "array", items: { type: "object", properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  section: { type: "string" },
                  price: { type: "number" },
                  currency: { type: "string" },
                  tags: { type: "array", items: { type: "string" } },
                  dietaryTags: { type: "array", items: { type: "string" } },
                  confidence: { type: "number", minimum: 0, maximum: 1 }
                }, required: ["name", "confidence"], additionalProperties: false } }
              },
              required: ["items", "ocrText"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_menu_items" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return json({ error: "AI rate limit reached. Please wait a moment and try again." }, 429);
      if (response.status === 402) return json({ error: "AI credits are exhausted. Please add credits in Workspace Usage." }, 402);
      console.error("Lovable AI error", response.status, await response.text());
      return json({ error: "Menu extraction failed. Please try again." }, 500);
    }

    const data = await response.json();
    const toolArgs = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!toolArgs) return json({ error: "AI extraction returned no structured result." }, 500);
    return json({ result: JSON.parse(toolArgs) });
  } catch (error) {
    console.error("analyze-food error", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

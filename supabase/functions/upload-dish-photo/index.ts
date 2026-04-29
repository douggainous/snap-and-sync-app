import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.0";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  dishId: z.string().uuid(),
  imageBase64: z.string().min(100).max(12_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]),
  fileName: z.string().trim().max(160).optional(),
  altText: z.string().trim().max(200).optional(),
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const extensionFor = (mimeType: string) => mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : mimeType === "image/heic" ? "heic" : mimeType === "image/heif" ? "heif" : "jpg";
const safeName = (value?: string) => (value ?? "food-photo").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "food-photo";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authentication required." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return json({ error: "Backend storage is not configured." }, 500);

    const authClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return json({ error: "Authentication required." }, 401);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid image upload payload.", details: parsed.error.flatten().fieldErrors }, 400);

    const { dishId, imageBase64, mimeType, fileName, altText } = parsed.data;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: dish, error: dishError } = await supabase
      .from("dishes")
      .select("id,name,is_published")
      .eq("id", dishId)
      .maybeSingle();
    if (dishError) {
      console.error("Dish lookup failed", dishError);
      return json({ error: "Could not verify dish." }, 500);
    }
    if (!dish) return json({ error: "Dish not found." }, 404);

    const binary = Uint8Array.from(atob(imageBase64), (char) => char.charCodeAt(0));
    if (binary.byteLength > 8 * 1024 * 1024) return json({ error: "Image must be 8MB or smaller." }, 413);

    const ext = extensionFor(mimeType);
    const path = `${user.id}/dishes/${dishId}/${Date.now()}-${safeName(fileName ?? dish.name)}.${ext}`;
    const upload = await supabase.storage.from("dish-photos").upload(path, binary, {
      contentType: mimeType,
      cacheControl: "31536000",
      upsert: false,
    });

    if (upload.error) {
      console.error("Storage upload failed", upload.error);
      return json({ error: "Could not upload image." }, 500);
    }

    const signed = await supabase.storage.from("dish-photos").createSignedUrl(path, 60 * 60 * 24 * 7);
    const { data: photo, error: photoError } = await supabase
      .from("photos")
      .insert({
        dish_id: dishId,
        user_id: user.id,
        storage_bucket: "dish-photos",
        storage_path: path,
        image_url: signed.data?.signedUrl ?? null,
        alt_text: altText ?? `${dish.name} photo`,
        is_public: true,
      })
      .select("id,dish_id,storage_bucket,storage_path,image_url,alt_text,created_at")
      .single();

    if (photoError) {
      console.error("Photo record insert failed", photoError);
      await supabase.storage.from("dish-photos").remove([path]);
      return json({ error: "Could not save photo record." }, 500);
    }

    await supabase.from("dishes").update({ cover_photo_id: photo.id }).eq("id", dishId).is("cover_photo_id", null);
    return json({ photo, url: signed.data?.signedUrl ?? null, path });
  } catch (error) {
    console.error("upload-dish-photo error", error);
    return json({ error: "Unexpected error." }, 500);
  }
});

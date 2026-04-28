import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.0";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMiles: z.number().min(1).max(50).default(50),
  query: z.string().trim().max(80).optional(),
});

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  businessStatus?: string;
  googleMapsUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  primaryTypeDisplayName?: { text?: string };
  photos?: { name?: string }[];
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const priceLevelNumber = (priceLevel?: string) => {
  const map: Record<string, number> = { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 };
  return priceLevel ? map[priceLevel] ?? null : null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid location payload.", details: parsed.error.flatten().fieldErrors }, 400);

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) return json({ error: "Google Maps API key is not configured yet.", needsSecret: "GOOGLE_MAPS_API_KEY" }, 503);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Backend database is not configured." }, 500);

    const radiusMeters = Math.min(80467, Math.round(parsed.data.radiusMiles * 1609.34));
    const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.businessStatus,places.googleMapsUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.primaryTypeDisplayName,places.photos",
      },
      body: JSON.stringify({
        includedTypes: ["restaurant"],
        maxResultCount: 20,
        rankPreference: "POPULARITY",
        locationRestriction: { circle: { center: { latitude: parsed.data.latitude, longitude: parsed.data.longitude }, radius: radiusMeters } },
      }),
    });

    const data = await response.json();
    if (!response.ok) return json({ error: "Google Maps lookup failed.", status: response.status, details: data }, response.status);

    const places: GooglePlace[] = data.places ?? [];
    const rows = places.map((place) => {
      const address = place.formattedAddress ?? null;
      const parts = address?.split(",").map((part) => part.trim()) ?? [];
      return {
        google_place_id: place.id,
        name: place.displayName?.text ?? "Unnamed restaurant",
        address,
        city: parts.length >= 2 ? parts[parts.length - 3] ?? parts[1] : null,
        cuisine: place.primaryTypeDisplayName?.text ?? "Restaurant",
        latitude: place.location?.latitude ?? null,
        longitude: place.location?.longitude ?? null,
        phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
        website_url: place.websiteUri ?? null,
        rating: place.rating ?? null,
        review_count: place.userRatingCount ?? null,
        price_level: priceLevelNumber(place.priceLevel),
        business_status: place.businessStatus ?? null,
        maps_url: place.googleMapsUri ?? null,
        photo_reference: place.photos?.[0]?.name ?? null,
        created_by: null,
      };
    }).filter((row) => row.google_place_id && row.name);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: saved, error } = await supabase
      .from("restaurants")
      .upsert(rows, { onConflict: "google_place_id" })
      .select("id,name,address,city,cuisine,latitude,longitude,phone,website_url,google_place_id,rating,review_count,price_level,business_status,maps_url,photo_reference");

    if (error) return json({ error: "Could not save nearby restaurants.", details: error.message }, 500);
    return json({ restaurants: saved ?? [] });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

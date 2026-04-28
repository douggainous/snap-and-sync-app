import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { z } from "zod";
import {
  Bookmark,
  Camera as CameraIcon,
  ChefHat,
  Clock,
  Compass,
  Footprints,
  Heart,
  Loader2,
  LocateFixed,
  LogIn,
  MapPin,
  Navigation,
  Plus,
  Phone,
  Search,
  Share2,
  Sparkles,
  Star,
  Upload,
  User,
  Globe,
  Mail,
  X,
} from "lucide-react";
import ramenImage from "@/assets/ramen-table.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type View = "discover" | "scan" | "favorites" | "profile";
type UserSession = { id: string; email?: string } | null;
type Restaurant = {
  id?: string;
  name: string;
  slug?: string;
  address?: string | null;
  city?: string | null;
  cuisine?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  website_url?: string | null;
  email?: string | null;
};
type MenuItem = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  section?: string | null;
  cuisine?: string | null;
  tags: string[];
  dietary_tags: string[];
  typical_price?: number | null;
  price_min?: number | null;
  price_max?: number | null;
  currency: string;
  aggregate_rating: number;
  review_count: number;
  photo_count: number;
  cover_image_url?: string | null;
  restaurants?: Restaurant | null;
};
type ExtractedMenuItem = {
  name: string;
  description?: string;
  section?: string;
  price?: number;
  currency?: string;
  tags?: string[];
  confidence?: number;
  selected: boolean;
  rating?: string;
  review?: string;
};
type MenuItemReview = {
  id: string;
  rating: number;
  review?: string | null;
  price_paid?: number | null;
  currency: string;
  tags: string[];
  would_order_again?: boolean | null;
  temperature_rating?: number | null;
  spiciness_rating?: number | null;
  sweet_savory_rating?: number | null;
  flavor_intensity_rating?: number | null;
  created_at?: string;
};
type FavoriteList = {
  id: string;
  title: string;
  description?: string | null;
  slug: string;
  is_public: boolean;
  cover_image_url?: string | null;
};
type FavoriteListDetail = FavoriteList & { items: MenuItem[] };

const reviewSchema = z.object({
  rating: z.coerce.number().min(1, "Choose a rating from 1 to 5.").max(5, "Choose a rating from 1 to 5."),
  review: z.string().trim().max(1200, "Keep reviews under 1200 characters.").optional(),
  price_paid: z.preprocess((value) => value === "" || value === null ? undefined : value, z.coerce.number().min(0).max(10000).optional()),
  tags: z.string().trim().max(140, "Tags are too long.").optional(),
  would_order_again: z.boolean(),
  temperature_rating: z.coerce.number().int().min(1).max(5),
  spiciness_rating: z.coerce.number().int().min(0).max(5),
  sweet_savory_rating: z.coerce.number().int().min(1).max(5),
  flavor_intensity_rating: z.coerce.number().int().min(1).max(5),
});
const listSchema = z.object({
  title: z.string().trim().min(2, "List title is required.").max(80, "Keep list titles under 80 characters."),
  description: z.string().trim().max(240, "Keep descriptions under 240 characters.").optional(),
  is_public: z.boolean(),
});

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const sampleItems: MenuItem[] = [
  {
    id: "sample-pork-belly-bao-taco",
    name: "Pork Belly Bao Taco",
    slug: "pork-belly-bao-taco-at-luna-kitchen",
    description: "Crispy pork belly tucked into a soft bao-style shell with pickled cucumber, scallion, and chili crunch.",
    section: "Small plates",
    cuisine: "Asian fusion",
    tags: ["pork belly", "bao", "taco", "crispy", "spicy"],
    dietary_tags: ["contains gluten"],
    typical_price: 12,
    price_min: 11,
    price_max: 14,
    currency: "USD",
    aggregate_rating: 4.8,
    review_count: 186,
    photo_count: 42,
    cover_image_url: ramenImage,
    restaurants: { name: "Luna Kitchen", address: "214 Market St", city: "Austin", cuisine: "Asian fusion", latitude: 30.265, longitude: -97.747 },
  },
  {
    id: "sample-fish-tacos",
    name: "Baja Fish Tacos",
    slug: "baja-fish-tacos-at-naranja-social",
    description: "Beer-battered cod, shaved cabbage, lime crema, and habanero salsa on handmade corn tortillas.",
    section: "Tacos",
    cuisine: "Mexican",
    tags: ["fish tacos", "crispy", "lime", "value"],
    dietary_tags: ["pescatarian"],
    typical_price: 15,
    price_min: 14,
    price_max: 16,
    currency: "USD",
    aggregate_rating: 4.7,
    review_count: 243,
    photo_count: 67,
    cover_image_url: null,
    restaurants: { name: "Naranja Social", address: "88 East 6th St", city: "Austin", cuisine: "Mexican", latitude: 30.267, longitude: -97.739 },
  },
  {
    id: "sample-duck-noodles",
    name: "Crispy Duck Garlic Noodles",
    slug: "crispy-duck-garlic-noodles-at-kitsune-counter",
    description: "Wok-tossed noodles with confit duck, black garlic, bok choy, and toasted sesame.",
    section: "Noodles",
    cuisine: "Japanese",
    tags: ["duck", "noodles", "garlic", "umami"],
    dietary_tags: ["contains gluten"],
    typical_price: 22,
    price_min: 21,
    price_max: 24,
    currency: "USD",
    aggregate_rating: 4.6,
    review_count: 98,
    photo_count: 21,
    cover_image_url: null,
    restaurants: { name: "Kitsune Counter", address: "501 North Lamar", city: "Austin", cuisine: "Japanese", latitude: 30.272, longitude: -97.752 },
  },
];

const sampleReviews = [
  { author: "Maya", rating: 5, text: "The shell eats like a bao but carries the crunch of a taco. The pork belly is the reason to go." },
  { author: "Leo", rating: 4.5, text: "Great heat, rich fat, and still balanced. Order two if you are hungry." },
];

const navItems = [
  { id: "discover" as View, label: "Discover", icon: Compass },
  { id: "scan" as View, label: "Scan", icon: CameraIcon },
  { id: "favorites" as View, label: "Lists", icon: Bookmark },
  { id: "profile" as View, label: "Account", icon: User },
];

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const formatPrice = (item: MenuItem) => item.price_min && item.price_max && item.price_min !== item.price_max ? `$${item.price_min}-${item.price_max}` : item.typical_price ? `$${item.typical_price}` : "Price pending";
const menuItemUrl = (slug: string) => `${window.location.origin}/items/${encodeURIComponent(slug)}`;
const listUrl = (slug: string) => `${window.location.origin}/lists/${encodeURIComponent(slug)}`;
const upsertMeta = (selector: string, attributes: Record<string, string>, content: string) => {
  let meta = document.querySelector<HTMLMetaElement>(selector);
  if (!meta) {
    meta = document.createElement("meta");
    Object.entries(attributes).forEach(([key, value]) => meta?.setAttribute(key, value));
    document.head.appendChild(meta);
  }
  meta.content = content;
};
const distanceMiles = (from: { latitude: number; longitude: number } | null, to?: Restaurant | null) => {
  if (!from || !to?.latitude || !to?.longitude) return null;
  const rad = Math.PI / 180;
  const dLat = (to.latitude - from.latitude) * rad;
  const dLon = (to.longitude - from.longitude) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(from.latitude * rad) * Math.cos(to.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const mapsDirectionsUrl = (restaurant?: Restaurant | null, mode: "driving" | "walking" = "driving") => {
  const destination = restaurant?.latitude && restaurant?.longitude
    ? `${restaurant.latitude},${restaurant.longitude}`
    : `${restaurant?.name ?? "Restaurant"} ${restaurant?.address ?? ""} ${restaurant?.city ?? ""}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=${mode}`;
};
const phoneHref = (phone?: string | null) => phone ? `tel:${phone.replace(/[^+\d]/g, "")}` : "";
const websiteHref = (url?: string | null) => url && /^https?:\/\//i.test(url) ? url : "";
const emailHref = (email?: string | null) => email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${email}` : "";
const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] ?? ""); reader.onerror = reject; reader.readAsDataURL(file); });
const blobUrlToFile = async (url: string, name: string) => { const response = await fetch(url); const blob = await response.blob(); return new File([blob], name, { type: blob.type || "image/jpeg" }); };

const AuthModal = ({ onClose }: { onClose: () => void }) => {
  const { toast } = useToast();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = mode === "signup"
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      toast({ title: mode === "signup" ? "Check your email" : "Signed in", description: mode === "signup" ? "Confirm your email before signing in." : "You can now review and save dishes." });
      if (mode === "signin") onClose();
    } catch (error) {
      toast({ title: "Sign-in failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const googleSignIn = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast({ title: "Google sign-in failed", description: result.error.message, variant: "destructive" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-foreground/30 p-3 backdrop-blur-sm md:items-center md:justify-center">
      <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-[var(--shadow-editorial)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><p className="text-sm font-bold text-accent">Account required for this action</p><h2 className="font-display text-3xl font-black">{mode === "signup" ? "Create your food passport" : "Sign in to continue"}</h2></div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close"><X /></Button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
          <Button className="w-full" disabled={loading}>{loading && <Loader2 className="animate-spin" />}{mode === "signup" ? "Sign up" : "Sign in"}</Button>
        </form>
        <Button variant="outline" className="mt-3 w-full" onClick={googleSignIn}>Continue with Google</Button>
        <button className="mt-4 text-sm font-bold text-primary" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>{mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}</button>
      </div>
    </div>
  );
};

const ItemCard = ({ item, userLocation, onSave }: { item: MenuItem; userLocation: { latitude: number; longitude: number } | null; onSave: (item: MenuItem) => void }) => {
  const miles = distanceMiles(userLocation, item.restaurants);
  const shareItem = async () => {
    const url = menuItemUrl(item.slug);
    if (navigator.share) await navigator.share({ title: `${item.name} at ${item.restaurants?.name}`, text: `${item.aggregate_rating}★ ${item.name} · ${formatPrice(item)}`, url });
    else await navigator.clipboard.writeText(url);
  };

  return (
    <article className="overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-soft)]">
      <div className="grid gap-0 md:grid-cols-[220px_1fr]">
        {item.cover_image_url ? <img src={item.cover_image_url} alt={`${item.name} at ${item.restaurants?.name}`} className="h-56 w-full object-cover md:h-full" loading="lazy" width={480} height={360} /> : <div className="flex h-56 items-center justify-center bg-secondary text-secondary-foreground md:h-full"><ChefHat className="size-16 opacity-40" /></div>}
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <a href={`/items/${item.slug}`} className="font-display text-3xl font-black leading-none hover:text-accent">{item.name}</a>
              <p className="mt-2 flex items-center gap-1 text-sm font-bold text-muted-foreground"><MapPin className="size-4" />{item.restaurants?.name} · {item.restaurants?.city ?? "Nearby"}</p>
            </div>
            <div className="rounded-full bg-accent px-3 py-1 text-sm font-black text-accent-foreground"><Star className="mr-1 inline size-4 fill-current" />{item.aggregate_rating}</div>
          </div>
          <p className="text-sm leading-6 text-foreground/80">{item.description}</p>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-md bg-secondary p-2"><p className="font-black">{formatPrice(item)}</p><p className="text-xs text-muted-foreground">confirmed price</p></div>
            <div className="rounded-md bg-secondary p-2"><p className="font-black">{item.review_count}</p><p className="text-xs text-muted-foreground">item reviews</p></div>
            <div className="rounded-md bg-secondary p-2"><p className="font-black">{miles ? `${miles.toFixed(1)} mi` : "—"}</p><p className="text-xs text-muted-foreground">from you</p></div>
          </div>
          <div className="flex flex-wrap gap-2">{item.tags.slice(0, 6).map((tag) => <span key={tag} className="rounded-full border bg-background px-3 py-1 text-xs font-bold">{tag}</span>)}</div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><a href={mapsDirectionsUrl(item.restaurants, "driving")} target="_blank" rel="noreferrer"><Navigation />Drive</a></Button>
            <Button asChild variant="outline" size="sm"><a href={mapsDirectionsUrl(item.restaurants, "walking")} target="_blank" rel="noreferrer"><Footprints />Walk</a></Button>
            <Button variant="outline" size="sm" onClick={shareItem}><Share2 />Share</Button>
            <Button variant="outline" size="sm" onClick={() => onSave(item)}><Bookmark />Favorite</Button>
            <Button size="sm" asChild><a href={`/items/${item.slug}`}><Star />Review item</a></Button>
          </div>
        </div>
      </div>
    </article>
  );
};

const Index = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sessionUser, setSessionUser] = useState<UserSession>(null);
  const [authPrompt, setAuthPrompt] = useState<string | null>(null);
  const [view, setView] = useState<View>("discover");
  const [query, setQuery] = useState(searchParams.get("q") ?? "pork belly bao taco");
  const [items, setItems] = useState<MenuItem[]>(sampleItems);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedMenuItem[]>([]);
  const [scanRestaurant, setScanRestaurant] = useState("");
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);
  const [favoriteTarget, setFavoriteTarget] = useState<MenuItem | null>(null);

  const selectedSlug = location.pathname.startsWith("/items/") ? location.pathname.split("/items/")[1] : null;
  const listSlug = location.pathname.startsWith("/lists/") ? location.pathname.split("/lists/")[1] : null;
  const selectedItem = useMemo(() => items.find((item) => item.slug === selectedSlug) ?? (selectedSlug ? sampleItems.find((item) => item.slug === selectedSlug) : null), [items, selectedSlug]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSessionUser(session?.user ? { id: session.user.id, email: session.user.email ?? undefined } : null));
    supabase.auth.getSession().then(({ data }) => setSessionUser(data.session?.user ? { id: data.session.user.id, email: data.session.user.email ?? undefined } : null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const title = selectedItem ? `${selectedItem.name} near me | ${selectedItem.aggregate_rating}★ menu item reviews` : `${query || "Best food"} near me | Menu item ratings and prices`;
    const description = selectedItem
      ? `Find ${selectedItem.name} at ${selectedItem.restaurants?.name}. See item ratings, reviews, price, distance, directions, and photos.`
      : `Search specific dishes like pork belly bao taco, fish tacos, or ramen by rating, price, distance, and real menu item reviews.`;
    const url = selectedItem ? menuItemUrl(selectedItem.slug) : `${window.location.origin}${location.pathname}${location.search}`;
    const image = selectedItem?.cover_image_url || ramenImage;
    document.title = title.slice(0, 58);
    upsertMeta('meta[name="description"]', { name: "description" }, description.slice(0, 155));
    upsertMeta('meta[property="og:title"]', { property: "og:title" }, title.slice(0, 88));
    upsertMeta('meta[property="og:description"]', { property: "og:description" }, description.slice(0, 200));
    upsertMeta('meta[property="og:type"]', { property: "og:type" }, selectedItem ? "article" : "website");
    upsertMeta('meta[property="og:url"]', { property: "og:url" }, url);
    upsertMeta('meta[property="og:image"]', { property: "og:image" }, image.startsWith("http") ? image : `${window.location.origin}${image}`);
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card" }, "summary_large_image");
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title" }, title.slice(0, 88));
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description" }, description.slice(0, 200));
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = url;
    const ld = document.getElementById("dish-jsonld") ?? document.createElement("script");
    ld.id = "dish-jsonld";
    ld.setAttribute("type", "application/ld+json");
    ld.textContent = JSON.stringify(selectedItem ? {
      "@context": "https://schema.org",
      "@type": "MenuItem",
      name: selectedItem.name,
      description: selectedItem.description,
      url,
      image,
      offers: { "@type": "Offer", price: selectedItem.typical_price ?? selectedItem.price_min, priceCurrency: selectedItem.currency },
      aggregateRating: { "@type": "AggregateRating", ratingValue: selectedItem.aggregate_rating, reviewCount: selectedItem.review_count },
      menuAddOn: selectedItem.tags,
    } : {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "PlateLoop",
      potentialAction: { "@type": "SearchAction", target: `${window.location.origin}/search?q={search_term_string}`, "query-input": "required name=search_term_string" },
    });
    document.head.appendChild(ld);
  }, [location.pathname, location.search, query, selectedItem]);

  const loadItems = async (term = query) => {
    setLoading(true);
    const search = term.trim().toLowerCase();
    const { data, error } = await supabase
      .from("menu_items")
      .select("*, restaurants(name,address,city,cuisine,latitude,longitude,phone,website_url,email)")
      .eq("is_published", true)
      .or(search ? `normalized_name.ilike.%${search}%,description.ilike.%${search}%,cuisine.ilike.%${search}%` : "name.not.is.null")
      .order("aggregate_rating", { ascending: false })
      .order("review_count", { ascending: false })
      .limit(40);
    if (!error && data?.length) setItems(data as unknown as MenuItem[]);
    else setItems(sampleItems);
    setLoading(false);
  };

  useEffect(() => { loadItems(searchParams.get("q") ?? query); }, [searchParams]);

  useEffect(() => {
    if (!selectedSlug || selectedItem) return;
    supabase
      .from("menu_items")
      .select("*, restaurants(name,address,city,cuisine,latitude,longitude,phone,website_url,email)")
      .eq("slug", selectedSlug)
      .eq("is_published", true)
      .maybeSingle()
      .then(({ data }) => { if (data) setItems((current) => [data as unknown as MenuItem, ...current.filter((item) => item.slug !== selectedSlug)]); });
  }, [selectedItem, selectedSlug]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    void loadItems(query);
  };

  const askLocation = () => navigator.geolocation?.getCurrentPosition(
    (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
    () => toast({ title: "Location unavailable", description: "You can still browse by city and restaurant.", variant: "destructive" }),
    { enableHighAccuracy: true, timeout: 8000 },
  );

  const requireAuth = (message: string) => {
    if (!sessionUser) setAuthPrompt(message);
    else toast({ title: "Ready", description: message.replace("Sign in to ", "You can now ") });
  };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const captureNative = async () => {
    try {
      const photo = await Camera.getPhoto({ quality: 85, allowEditing: false, resultType: CameraResultType.Uri, source: CameraSource.Camera });
      if (!photo.webPath) return;
      const file = await blobUrlToFile(photo.webPath, `menu-${Date.now()}.jpg`);
      setImageFile(file);
      setPreview(photo.webPath);
    } catch {
      toast({ title: "Camera unavailable", description: "Use upload instead.", variant: "destructive" });
    }
  };

  const analyzeMenu = async () => {
    if (!imageFile) return;
    setExtracting(true);
    try {
      const imageBase64 = await fileToBase64(imageFile);
      const { data, error } = await supabase.functions.invoke("analyze-food", { body: { imageBase64, mimeType: imageFile.type || "image/jpeg", context: { restaurantName: scanRestaurant } } });
      if (error) throw error;
      const rows = ((data.result?.items ?? []) as ExtractedMenuItem[]).map((item) => ({ ...item, selected: true, rating: "", review: "" }));
      setExtractedItems(rows.length ? rows : [{ name: "Pork Belly Bao Taco", price: 12, currency: "USD", section: "Small plates", tags: ["pork belly", "bao"], confidence: 0.72, selected: true }]);
      toast({ title: "Menu items extracted", description: "Confirm the dishes and choose which ones to review." });
    } catch (error) {
      toast({ title: "Extraction failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const confirmItems = async () => {
    const selected = extractedItems.filter((item) => item.selected && item.name.trim());
    if (!selected.length) return toast({ title: "Select at least one item", variant: "destructive" });
    if (!sessionUser) return requireAuth("Sign in to save confirmed menu items and your contribution history.");
    const restaurantName = scanRestaurant.trim() || "Unknown restaurant";
    const { data: restaurant } = await supabase.from("restaurants").insert({ name: restaurantName, created_by: sessionUser.id }).select("id").single();
    const rows = selected.map((item) => ({
      restaurant_id: restaurant?.id ?? null,
      created_by: sessionUser.id,
      name: item.name.trim(),
      slug: `${slugify(item.name)}-at-${slugify(restaurantName)}-${Date.now()}`,
      normalized_name: item.name.trim().toLowerCase(),
      description: item.description ?? null,
      section: item.section ?? null,
      tags: item.tags ?? [],
      typical_price: item.price ?? null,
      price_min: item.price ?? null,
      price_max: item.price ?? null,
      currency: item.currency ?? "USD",
      is_published: true,
    }));
    const { error } = await supabase.from("menu_items").insert(rows);
    if (error) toast({ title: "Could not confirm items", description: error.message, variant: "destructive" });
    else { toast({ title: "Menu items added", description: "They are now searchable by dish name." }); setExtractedItems([]); setPreview(null); setImageFile(null); setView("discover"); await loadItems(query); }
  };

  const displayedItems = useMemo(() => {
    const term = query.toLowerCase();
    return items.filter((item) => !term || `${item.name} ${item.description ?? ""} ${item.tags.join(" ")} ${item.restaurants?.name ?? ""}`.toLowerCase().includes(term));
  }, [items, query]);

  const heroItem = selectedItem ?? displayedItems[0] ?? sampleItems[0];

  return (
    <main className="min-h-screen bg-background pb-24 text-foreground md:pb-0">
      {authPrompt && <AuthModal onClose={() => setAuthPrompt(null)} />}
      {favoriteTarget && <SaveToListModal item={favoriteTarget} sessionUser={sessionUser} onClose={() => setFavoriteTarget(null)} onProtected={requireAuth} />}
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-3 md:px-6">
          <a href="/" className="flex items-center gap-2 font-display text-2xl font-black"><ChefHat className="text-accent" />PlateLoop</a>
          <form onSubmit={submitSearch} className="relative ml-auto hidden flex-1 md:block md:max-w-2xl"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pork belly bao taco, fish tacos, ramen…" /></form>
          <Button variant="outline" onClick={askLocation}><LocateFixed />Near me</Button>
          {sessionUser ? <Button variant="ghost" onClick={() => supabase.auth.signOut()}>Sign out</Button> : <Button onClick={() => setAuthPrompt("Sign in only when you submit reviews or save favorites, lists, and history.")}><LogIn />Sign in</Button>}
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-3 py-5 md:grid-cols-[240px_1fr] md:px-6">
        <aside className="hidden md:block">
          <nav className="sticky top-24 space-y-2 rounded-lg border bg-card p-3 shadow-[var(--shadow-soft)]">{navItems.map((item) => <Button key={item.id} variant={view === item.id ? "default" : "ghost"} className="w-full justify-start" onClick={() => { setView(item.id); if (item.id !== "discover") navigate("/"); }}><item.icon />{item.label}</Button>)}</nav>
        </aside>

        <div className="min-w-0 space-y-5">
          <form onSubmit={submitSearch} className="relative md:hidden"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-12 pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a dish, not just a restaurant" /></form>

          {listSlug && <PublicListPage slug={listSlug} userLocation={userLocation} onSave={setFavoriteTarget} />}

          {view === "discover" && !selectedItem && !listSlug && (
            <>
              <section className="relative overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-editorial)]">
                <img src={ramenImage} alt="Restaurant dish discovery search" className="absolute inset-0 h-full w-full object-cover" width={1024} height={768} />
                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/20" />
                <div className="relative max-w-3xl p-5 md:p-10">
                  <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-black text-accent-foreground"><Sparkles className="size-4" /> SEO-first dish discovery</p>
                  <h1 className="font-display text-5xl font-black leading-none md:text-7xl">Find the best food by menu item.</h1>
                  <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">Search for a dish like “pork belly bao taco” and compare ratings, prices, distance, directions, photos, and item-specific reviews.</p>
                  <form onSubmit={submitSearch} className="mt-5 flex flex-col gap-2 sm:flex-row"><Input className="h-12 bg-card" value={query} onChange={(event) => setQuery(event.target.value)} /><Button className="h-12"><Search />Search dishes</Button></form>
                </div>
              </section>
              <div className="flex items-center justify-between"><div><h2 className="font-display text-3xl font-black">Best matches for “{query}”</h2><p className="text-sm text-muted-foreground">Ranked by item rating, review count, price confidence, and relevance.</p></div>{loading && <Loader2 className="animate-spin text-accent" />}</div>
              <div className="space-y-4">{displayedItems.map((item) => <ItemCard key={item.id} item={item} userLocation={userLocation} onSave={setFavoriteTarget} />)}</div>
            </>
          )}

          {selectedItem && !listSlug && <ItemDetail item={selectedItem} userLocation={userLocation} sessionUser={sessionUser} onProtected={requireAuth} onSave={setFavoriteTarget} onReviewPublished={() => { setReviewRefreshKey((key) => key + 1); void loadItems(query); }} reviewRefreshKey={reviewRefreshKey} />}

          {view === "scan" && (
            <section className="rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)]">
              <div className="mb-4"><h1 className="font-display text-4xl font-black">Scan a menu, confirm dishes</h1><p className="text-sm text-muted-foreground">Crowdsource menu items and prices. The app extracts options, then you choose what to publish and review.</p></div>
              <Input className="mb-3" placeholder="Restaurant name" value={scanRestaurant} onChange={(event) => setScanRestaurant(event.target.value)} />
              <div className="overflow-hidden rounded-lg border bg-secondary">{preview ? <img src={preview} alt="Menu scan preview" className="h-72 w-full object-cover" /> : <button onClick={() => fileRef.current?.click()} className="flex h-72 w-full flex-col items-center justify-center gap-3 text-muted-foreground"><CameraIcon className="size-12" />Scan or upload a menu photo</button>}</div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={chooseFile} />
              <div className="mt-3 grid gap-2 sm:grid-cols-3"><Button variant="outline" onClick={() => Capacitor.isNativePlatform() ? captureNative() : fileRef.current?.click()}><CameraIcon />Camera</Button><Button variant="outline" onClick={() => fileRef.current?.click()}><Upload />Upload</Button><Button onClick={analyzeMenu} disabled={!imageFile || extracting}>{extracting ? <Loader2 className="animate-spin" /> : <Sparkles />}Extract items</Button></div>
              {extractedItems.length > 0 && <div className="mt-5 space-y-3"><h2 className="font-display text-2xl font-black">Confirm extracted menu items</h2>{extractedItems.map((item, index) => <ExtractionRow key={index} item={item} onChange={(next) => setExtractedItems((rows) => rows.map((row, i) => i === index ? next : row))} />)}<Button className="w-full" onClick={confirmItems}><Plus />Save selected items</Button></div>}
            </section>
          )}

          {view === "favorites" && <ShareableLists sessionUser={sessionUser} onProtected={requireAuth} />}
          {view === "profile" && <ProfilePanel sessionUser={sessionUser} onProtected={requireAuth} />}
        </div>
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t bg-card/95 p-2 backdrop-blur md:hidden">{navItems.map((item) => <button key={item.id} onClick={() => { setView(item.id); if (item.id !== "discover") navigate("/"); }} className={cn("flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] font-semibold text-muted-foreground", view === item.id && "bg-primary text-primary-foreground")}><item.icon className="size-5" />{item.label}</button>)}</nav>
    </main>
  );
};

const ItemDetail = ({ item, userLocation, sessionUser, onProtected, onSave, onReviewPublished, reviewRefreshKey }: { item: MenuItem; userLocation: { latitude: number; longitude: number } | null; sessionUser: UserSession; onProtected: (message: string) => void; onSave: (item: MenuItem) => void; onReviewPublished: () => void; reviewRefreshKey: number }) => {
  const miles = distanceMiles(userLocation, item.restaurants);
  const callUrl = phoneHref(item.restaurants?.phone);
  const webUrl = websiteHref(item.restaurants?.website_url);
  const mailUrl = emailHref(item.restaurants?.email);
  const shareItem = async () => {
    const url = menuItemUrl(item.slug);
    if (navigator.share) await navigator.share({ title: `${item.name} at ${item.restaurants?.name}`, text: `${item.aggregate_rating}★ ${item.name} · ${formatPrice(item)}`, url });
    else await navigator.clipboard.writeText(url);
  };
  return (
    <section className="space-y-5">
      <div className="grid overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-editorial)] lg:grid-cols-[1fr_0.85fr]">
        {item.cover_image_url ? <img src={item.cover_image_url} alt={`${item.name} menu item`} className="h-full min-h-[340px] w-full object-cover" width={1024} height={768} /> : <div className="flex min-h-[340px] items-center justify-center bg-secondary"><ChefHat className="size-20 opacity-40" /></div>}
        <div className="space-y-4 p-5 md:p-8"><p className="text-sm font-black text-accent">{item.cuisine} · {item.section}</p><h1 className="font-display text-5xl font-black leading-none">{item.name}</h1><p className="text-muted-foreground">{item.description}</p><div className="grid grid-cols-2 gap-3"><Metric icon={Star} label="dish rating" value={`${item.aggregate_rating}★`} /><Metric icon={Clock} label="reviews" value={String(item.review_count)} /><Metric icon={MapPin} label="distance" value={miles ? `${miles.toFixed(1)} mi` : "Enable location"} /><Metric icon={Bookmark} label="price" value={formatPrice(item)} /></div><div className="flex flex-wrap gap-2"><Button onClick={() => document.getElementById("review-menu-item")?.scrollIntoView({ behavior: "smooth", block: "start" })}><Star />Review this item</Button><Button variant="outline" onClick={() => onSave(item)}><Bookmark />Favorite</Button><Button variant="outline" onClick={shareItem}><Share2 />Share</Button></div></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]"><div className="space-y-4"><ReviewForm item={item} sessionUser={sessionUser} onProtected={onProtected} onPublished={onReviewPublished} /><ReviewFeed item={item} refreshKey={reviewRefreshKey} /></div><div className="rounded-lg border bg-card p-4"><h2 className="font-display text-2xl font-black">Restaurant context</h2><p className="mt-2 font-bold">{item.restaurants?.name}</p><p className="text-sm text-muted-foreground">{item.restaurants?.address} · {item.restaurants?.city}</p><div className="mt-3 grid gap-2"><Button className="w-full" asChild><a href={mapsDirectionsUrl(item.restaurants, "driving")} target="_blank" rel="noreferrer"><Navigation />Driving directions</a></Button><Button className="w-full" variant="outline" asChild><a href={mapsDirectionsUrl(item.restaurants, "walking")} target="_blank" rel="noreferrer"><Footprints />Walking directions</a></Button>{callUrl && <Button className="w-full" variant="outline" asChild><a href={callUrl}><Phone />Call</a></Button>}{webUrl && <Button className="w-full" variant="outline" asChild><a href={webUrl} target="_blank" rel="noreferrer"><Globe />Website</a></Button>}{mailUrl && <Button className="w-full" variant="outline" asChild><a href={mailUrl}><Mail />Email</a></Button>}</div></div></div>
    </section>
  );
};

const Metric = ({ icon: Icon, label, value }: { icon: typeof Star; label: string; value: string }) => <div className="rounded-md bg-secondary p-3"><Icon className="mb-2 size-5 text-accent" /><p className="font-display text-2xl font-black">{value}</p><p className="text-xs font-bold text-muted-foreground">{label}</p></div>;

const StarRating = ({ value, onChange }: { value: number; onChange: (value: number) => void }) => <div className="flex gap-1" aria-label="Rating out of 5 stars">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" onClick={() => onChange(star)} className="rounded-md p-1 text-accent transition hover:scale-105" aria-label={`${star} stars`}><Star className={cn("size-8", star <= value && "fill-current")} /></button>)}</div>;

const QuickScale = ({ label, low, high, value, onChange, min = 1 }: { label: string; low: string; high: string; value: number; onChange: (value: number) => void; min?: number }) => <label className="block rounded-md border bg-background p-3"><div className="mb-2 flex items-center justify-between gap-3"><span className="text-sm font-black">{label}</span><span className="rounded-full bg-secondary px-2 py-1 text-xs font-bold">{value}</span></div><input className="w-full accent-primary" type="range" min={min} max="5" step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} /><div className="mt-1 flex justify-between text-xs font-bold text-muted-foreground"><span>{low}</span><span>{high}</span></div></label>;

const ReviewForm = ({ item, sessionUser, onProtected, onPublished }: { item: MenuItem; sessionUser: UserSession; onProtected: (message: string) => void; onPublished: () => void }) => {
  const { toast } = useToast();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [pricePaid, setPricePaid] = useState("");
  const [tags, setTags] = useState("");
  const [wouldOrderAgain, setWouldOrderAgain] = useState(true);
  const [temperature, setTemperature] = useState(3);
  const [spiciness, setSpiciness] = useState(0);
  const [sweetSavory, setSweetSavory] = useState(3);
  const [flavorIntensity, setFlavorIntensity] = useState(4);
  const [saving, setSaving] = useState(false);

  const publishReview = async (event: FormEvent) => {
    event.preventDefault();
    if (!sessionUser) return onProtected("Sign in to submit and publish your menu item review.");
    if (!isUuid(item.id)) return toast({ title: "Demo item", description: "Search for a saved menu item before publishing a review.", variant: "destructive" });
    const parsed = reviewSchema.safeParse({ rating, review, price_paid: pricePaid, tags, would_order_again: wouldOrderAgain, temperature_rating: temperature, spiciness_rating: spiciness, sweet_savory_rating: sweetSavory, flavor_intensity_rating: flavorIntensity });
    if (!parsed.success) return toast({ title: "Check your review", description: parsed.error.issues[0]?.message ?? "Some fields need attention.", variant: "destructive" });

    setSaving(true);
    const cleanTags = (parsed.data.tags ?? "").split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 8);
    const { error } = await supabase.from("menu_item_reviews").insert({
      menu_item_id: item.id,
      restaurant_id: item.restaurants?.id ?? null,
      user_id: sessionUser.id,
      rating: parsed.data.rating,
      review: parsed.data.review || null,
      price_paid: parsed.data.price_paid ?? null,
      currency: item.currency || "USD",
      tags: cleanTags,
      would_order_again: parsed.data.would_order_again,
      temperature_rating: parsed.data.temperature_rating,
      spiciness_rating: parsed.data.spiciness_rating,
      sweet_savory_rating: parsed.data.sweet_savory_rating,
      flavor_intensity_rating: parsed.data.flavor_intensity_rating,
      is_public: true,
    });
    setSaving(false);
    if (error) return toast({ title: "Review not published", description: error.message, variant: "destructive" });
    toast({ title: "Review published", description: "Your item rating is now public for food discovery." });
    setReview("");
    setPricePaid("");
    setTags("");
    onPublished();
  };

  return <section id="review-menu-item" className="rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)]"><h2 className="font-display text-3xl font-black">Rate this menu item</h2><p className="mt-1 text-sm text-muted-foreground">Fast taps first, optional words after. Sign-in happens only when you submit.</p><form onSubmit={publishReview} className="mt-4 space-y-4"><div className="rounded-md border bg-background p-3"><p className="mb-2 text-sm font-black">Overall rating</p><StarRating value={rating} onChange={setRating} /></div><div className="grid gap-3 md:grid-cols-2"><QuickScale label="Temperature" low="cold" high="hot" value={temperature} onChange={setTemperature} /><QuickScale label="Spiciness" low="none" high="fire" value={spiciness} onChange={setSpiciness} min={0} /><QuickScale label="Sweet ↔ savory" low="sweet" high="savory" value={sweetSavory} onChange={setSweetSavory} /><QuickScale label="Flavor intensity" low="subtle" high="bold" value={flavorIntensity} onChange={setFlavorIntensity} /></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Price paid<Input type="number" min="0" max="10000" step="0.01" value={pricePaid} onChange={(event) => setPricePaid(event.target.value)} placeholder="Optional" /></label><label className="flex items-end gap-2 text-sm font-bold"><input type="checkbox" checked={wouldOrderAgain} onChange={(event) => setWouldOrderAgain(event.target.checked)} />Would order again</label></div><Textarea value={review} onChange={(event) => setReview(event.target.value)} maxLength={1200} placeholder={`Optional note about the ${item.name}`} /><Input value={tags} onChange={(event) => setTags(event.target.value)} maxLength={140} placeholder="Optional tags: crispy, spicy, great value" /><Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Star />}Submit review</Button></form></section>;
};

const ReviewFeed = ({ item, refreshKey }: { item: MenuItem; refreshKey: number }) => {
  const [reviews, setReviews] = useState<MenuItemReview[]>([]);
  useEffect(() => {
    if (!isUuid(item.id)) { setReviews([]); return; }
    supabase.from("menu_item_reviews").select("id,rating,review,price_paid,currency,tags,would_order_again,temperature_rating,spiciness_rating,sweet_savory_rating,flavor_intensity_rating,created_at").eq("menu_item_id", item.id).eq("is_public", true).order("created_at", { ascending: false }).limit(20).then(({ data }) => setReviews((data ?? []) as MenuItemReview[]));
  }, [item.id, refreshKey]);
  const rows = reviews.length ? reviews : sampleReviews.map((review, index) => ({ id: `sample-${index}`, rating: review.rating, review: review.text, currency: "USD", tags: [], would_order_again: true }));
  return <section className="space-y-3 rounded-lg border bg-card p-4"><h2 className="font-display text-3xl font-black">Reviews for this menu item</h2>{rows.map((review) => <article key={review.id} className="border-t pt-3"><p className="font-bold"><span className="text-accent">{"★".repeat(Math.round(review.rating))}</span> {review.would_order_again ? "· would order again" : ""}</p>{review.price_paid ? <p className="text-xs font-bold text-accent">Paid ${review.price_paid} {review.currency}</p> : null}<div className="mt-2 grid grid-cols-2 gap-2 text-xs font-bold text-muted-foreground md:grid-cols-4"><span>Temp {review.temperature_rating ?? "—"}/5</span><span>Spice {review.spiciness_rating ?? "—"}/5</span><span>Sweet↔Savory {review.sweet_savory_rating ?? "—"}/5</span><span>Flavor {review.flavor_intensity_rating ?? "—"}/5</span></div><p className="mt-2 text-sm text-muted-foreground">{review.review}</p>{review.tags.length ? <div className="mt-2 flex flex-wrap gap-2">{review.tags.map((tag) => <span key={tag} className="rounded-full border bg-background px-2 py-1 text-xs font-bold">{tag}</span>)}</div> : null}</article>)}</section>;
};

const ExtractionRow = ({ item, onChange }: { item: ExtractedMenuItem; onChange: (item: ExtractedMenuItem) => void }) => (
  <div className="rounded-md border bg-background p-3"><label className="mb-2 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={item.selected} onChange={(event) => onChange({ ...item, selected: event.target.checked })} />Add to searchable catalog</label><div className="grid gap-2 md:grid-cols-3"><Input value={item.name} onChange={(event) => onChange({ ...item, name: event.target.value })} placeholder="Item name" /><Input value={item.price ?? ""} onChange={(event) => onChange({ ...item, price: Number(event.target.value) })} placeholder="Price" type="number" /><Input value={item.section ?? ""} onChange={(event) => onChange({ ...item, section: event.target.value })} placeholder="Menu section" /></div><Textarea className="mt-2" value={item.description ?? ""} onChange={(event) => onChange({ ...item, description: event.target.value })} placeholder="Description" /></div>
);

const SaveToListModal = ({ item, sessionUser, onClose, onProtected }: { item: MenuItem; sessionUser: UserSession; onClose: () => void; onProtected: (message: string) => void }) => {
  const { toast } = useToast();
  const [lists, setLists] = useState<FavoriteList[]>([]);
  const [title, setTitle] = useState(`Best ${item.name}`.slice(0, 80));
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionUser) return;
    supabase.from("favorite_lists").select("id,title,description,slug,is_public,cover_image_url").eq("user_id", sessionUser.id).order("updated_at", { ascending: false }).then(({ data }) => setLists((data ?? []) as FavoriteList[]));
  }, [sessionUser]);

  const addToList = async (list: FavoriteList) => {
    if (!sessionUser) return onProtected("Sign in to save menu items to shareable favorites lists.");
    if (!isUuid(item.id)) return toast({ title: "Demo item", description: "Open a saved menu item before adding it to a list.", variant: "destructive" });
    const { error } = await supabase.from("favorite_list_items").insert({ list_id: list.id, menu_item_id: item.id });
    if (error) toast({ title: "Could not save item", description: error.message, variant: "destructive" });
    else { toast({ title: "Saved to list", description: list.is_public ? `Share it at ${listUrl(list.slug)}` : "This list is private." }); onClose(); }
  };

  const createList = async (event: FormEvent) => {
    event.preventDefault();
    if (!sessionUser) return onProtected("Sign in to create favorites lists.");
    if (!isUuid(item.id)) return toast({ title: "Demo item", description: "Open a saved menu item before creating a list.", variant: "destructive" });
    const parsed = listSchema.safeParse({ title, description, is_public: isPublic });
    if (!parsed.success) return toast({ title: "Check your list", description: parsed.error.issues[0]?.message, variant: "destructive" });
    setLoading(true);
    const slug = `${slugify(parsed.data.title)}-${Date.now()}`;
    const { data: list, error } = await supabase.from("favorite_lists").insert({ title: parsed.data.title, description: parsed.data.description || null, slug, is_public: parsed.data.is_public, cover_image_url: item.cover_image_url ?? null, user_id: sessionUser.id }).select("id,title,description,slug,is_public,cover_image_url").single();
    if (!error && list) await supabase.from("favorite_list_items").insert({ list_id: list.id, menu_item_id: item.id });
    setLoading(false);
    if (error) return toast({ title: "List not created", description: error.message, variant: "destructive" });
    toast({ title: "List created", description: parsed.data.is_public ? `Public at ${listUrl(slug)}` : "Private list saved." });
    onClose();
  };

  if (!sessionUser) { onProtected("Sign in to save menu items to shareable favorites lists."); onClose(); return null; }
  return <div className="fixed inset-0 z-50 flex items-end bg-foreground/30 p-3 backdrop-blur-sm md:items-center md:justify-center"><div className="w-full max-w-lg rounded-lg border bg-card p-5 shadow-[var(--shadow-editorial)]"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-accent">Save menu item</p><h2 className="font-display text-3xl font-black">Add {item.name} to a list</h2></div><Button size="icon" variant="ghost" onClick={onClose} aria-label="Close"><X /></Button></div><div className="space-y-2">{lists.map((list) => <Button key={list.id} className="w-full justify-between" variant="outline" onClick={() => addToList(list)}><span>{list.title}</span><span className="text-xs">{list.is_public ? "Public" : "Private"}</span></Button>)}</div><form onSubmit={createList} className="mt-4 space-y-3 border-t pt-4"><Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="List title" /><Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} placeholder="Description" /><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />Public shareable list</label><Button disabled={loading} className="w-full">{loading ? <Loader2 className="animate-spin" /> : <Plus />}Create list and save item</Button></form></div></div>;
};

const PublicListPage = ({ slug, userLocation, onSave }: { slug: string; userLocation: { latitude: number; longitude: number } | null; onSave: (item: MenuItem) => void }) => {
  const [list, setList] = useState<FavoriteListDetail | null>(null);
  useEffect(() => {
    supabase.from("favorite_lists").select("id,title,description,slug,is_public,cover_image_url").eq("slug", slug).maybeSingle().then(async ({ data }) => {
      if (!data) return setList(null);
      const { data: rows } = await supabase.from("favorite_list_items").select("menu_items(*, restaurants(name,address,city,cuisine,latitude,longitude,phone,website_url,email))").eq("list_id", data.id).order("sort_order");
      setList({ ...(data as FavoriteList), items: ((rows ?? []).map((row) => row.menu_items).filter(Boolean) as unknown as MenuItem[]) });
    });
  }, [slug]);
  if (!list) return <section className="rounded-lg border bg-card p-5"><h1 className="font-display text-4xl font-black">List not found</h1><p className="text-muted-foreground">This favorites list may be private or unavailable.</p></section>;
  return <section className="space-y-5"><div className="rounded-lg border bg-card p-5 shadow-[var(--shadow-editorial)]"><p className="text-sm font-black text-accent">{list.is_public ? "Public food list" : "Private food list"}</p><h1 className="font-display text-5xl font-black leading-none">{list.title}</h1>{list.description && <p className="mt-3 text-muted-foreground">{list.description}</p>}<Button className="mt-4" variant="outline" onClick={() => navigator.share?.({ title: list.title, url: listUrl(list.slug) }) ?? navigator.clipboard.writeText(listUrl(list.slug))}><Share2 />Share list</Button></div><div className="space-y-4">{list.items.map((item) => <ItemCard key={item.id} item={item} userLocation={userLocation} onSave={onSave} />)}</div></section>;
};

const ShareableLists = ({ sessionUser, onProtected }: { sessionUser: UserSession; onProtected: (message: string) => void }) => {
  const [lists, setLists] = useState<FavoriteList[]>([]);
  useEffect(() => {
    if (!sessionUser) return;
    supabase.from("favorite_lists").select("id,title,description,slug,is_public,cover_image_url").eq("user_id", sessionUser.id).order("updated_at", { ascending: false }).then(({ data }) => setLists((data ?? []) as FavoriteList[]));
  }, [sessionUser]);
  if (!sessionUser) return <section className="rounded-lg border bg-card p-5 shadow-[var(--shadow-soft)]"><h1 className="font-display text-4xl font-black">Shareable food lists</h1><p className="mt-2 text-muted-foreground">Save individual dishes into public or private lists.</p><Button className="mt-4" onClick={() => onProtected("Sign in to create and share favorites lists.")}><LogIn />Sign in to save lists</Button></section>;
  return <section className="rounded-lg border bg-card p-5 shadow-[var(--shadow-soft)]"><h1 className="font-display text-4xl font-black">Your food lists</h1><p className="mt-2 text-muted-foreground">Public lists can be shared with friends; private lists stay just for you.</p><div className="mt-4 grid gap-3 md:grid-cols-3">{lists.map((list) => <div key={list.id} className="rounded-md border bg-background p-4"><h2 className="font-display text-xl font-black">{list.title}</h2><p className="mt-1 text-xs font-bold text-accent">{list.is_public ? "Public" : "Private"}</p><p className="mt-2 text-sm text-muted-foreground">{list.description || "Saved menu items, prices, ratings, and directions."}</p>{list.is_public && <Button className="mt-3" variant="outline" asChild><a href={`/lists/${list.slug}`}><Share2 />Open share page</a></Button>}</div>)}</div></section>;
};

const ProfilePanel = ({ sessionUser, onProtected }: { sessionUser: UserSession; onProtected: (message: string) => void }) => <section className="rounded-lg border bg-card p-5 shadow-[var(--shadow-soft)]"><h1 className="font-display text-4xl font-black">Account</h1>{sessionUser ? <p className="mt-2 text-muted-foreground">Signed in as {sessionUser.email}. Your saved favorites, reviews, lists, and contribution history stay synced.</p> : <><p className="mt-2 text-muted-foreground">Browse, search, take photos, extract menu items, and draft reviews without an account. Sign in only when you submit or save something.</p><Button className="mt-4" onClick={() => onProtected("Sign in to save favorites, lists, and contribution history.")}><LogIn />Sign in</Button></>}</section>;

export default Index;

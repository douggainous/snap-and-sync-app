import { ChangeEvent, FormEvent, MouseEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
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
  LogOut,
  MapPin,
  MessageSquareText,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AppUser, useAuthSession } from "@/hooks/useAuthSession";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type View = "discover" | "scan" | "favorites" | "profile";
type FeedMode = "trending" | "nearby" | "recent";
type SearchSort = "relevance" | "trending" | "rating" | "nearby" | "recent";
type UserSession = AppUser | null;
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
  google_place_id?: string | null;
  rating?: number | null;
  review_count?: number | null;
  price_level?: number | null;
  business_status?: string | null;
  maps_url?: string | null;
  photo_reference?: string | null;
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
  rating_count?: number;
  review_count: number;
  photo_count: number;
  want_to_try_count?: number;
  favorite_count?: number;
  cover_image_url?: string | null;
  restaurants?: Restaurant | null;
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

const photoReviewSchema = reviewSchema.extend({
  restaurant_name: z.string().trim().max(120, "Keep restaurant names under 120 characters.").optional(),
  dish_name: z.string().trim().min(2, "Dish name is required.").max(120, "Keep dish names under 120 characters."),
});

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const DISCOVERY_PAGE_SIZE = 10;

const navItems = [
  { id: "discover" as View, label: "Discover", icon: Compass },
  { id: "scan" as View, label: "Scan", icon: CameraIcon },
  { id: "favorites" as View, label: "Lists", icon: Bookmark },
  { id: "profile" as View, label: "Account", icon: User },
];

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const parseSearchSort = (value: string | null): SearchSort => ["relevance", "trending", "rating", "nearby", "recent"].includes(value ?? "") ? value as SearchSort : "relevance";
const formatPrice = (item: MenuItem) => item.price_min && item.price_max && item.price_min !== item.price_max ? `$${item.price_min}-${item.price_max}` : item.typical_price ? `$${item.typical_price}` : "Price pending";
const sanitizePostgrestSearch = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9\s'&/-]/g, " ")
  .replace(/\s+/g, " ")
  .slice(0, 80);
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
const optimizeImageFile = async (file: File) => {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = URL.createObjectURL(file); });
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(image.src);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Image optimization failed")), "image/jpeg", 0.86));
  return new File([blob], `${slugify(file.name.replace(/\.[^.]+$/, "")) || "food-photo"}.jpg`, { type: "image/jpeg" });
};
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
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/` });
    if (result.redirected) return;
    if (result.error) toast({ title: "Google sign-in failed", description: result.error.message, variant: "destructive" });
    else onClose();
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

const FeedItemCard = ({ item, userLocation, onSave, onFirstReview, onDishAction }: { item: MenuItem; userLocation: { latitude: number; longitude: number } | null; onSave: (item: MenuItem) => void; onFirstReview?: (item: MenuItem) => void; onDishAction?: (item: MenuItem, action: "want_to_try" | "favorite") => void }) => {
  const miles = distanceMiles(userLocation, item.restaurants);
  const shareItem = async () => {
    const url = menuItemUrl(item.slug);
    if (navigator.share) await navigator.share({ title: `${item.name} at ${item.restaurants?.name}`, text: `${item.aggregate_rating}★ ${item.name} · ${formatPrice(item)}`, url });
    else await navigator.clipboard.writeText(url);
  };

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-editorial)]">
      <a href={`/items/${item.slug}`} className="group relative block overflow-hidden bg-secondary">
        {item.cover_image_url ? <img src={item.cover_image_url} alt={`${item.name} at ${item.restaurants?.name}`} className="h-[420px] w-full object-cover transition duration-500 group-hover:scale-105 sm:h-[520px]" loading="lazy" width={960} height={720} /> : <div className="flex h-[420px] w-full items-center justify-center bg-gradient-to-br from-accent/35 via-primary/25 to-destructive/25 text-secondary-foreground sm:h-[520px]"><ChefHat className="size-24 opacity-50" /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        <div className="absolute left-4 top-4 rounded-full bg-accent px-4 py-2 text-xl font-black text-accent-foreground shadow-[var(--shadow-soft)]"><Star className="mr-1 inline size-6 fill-current" />{item.aggregate_rating}</div>
        <div className="absolute bottom-0 left-0 right-0 p-4 text-foreground sm:p-6">
          <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-3 py-1 text-xs font-black text-accent"><MapPin className="size-3" />{item.restaurants?.name} · {miles ? `${miles.toFixed(1)} mi` : item.restaurants?.city ?? "Nearby"}</p>
          <h2 className="font-display text-4xl font-black leading-none sm:text-6xl">{item.name}</h2>
          <p className="mt-3 line-clamp-2 max-w-2xl text-sm font-semibold text-foreground/85 sm:text-base">{item.description}</p>
        </div>
      </a>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-md bg-secondary p-3"><p className="font-black">{formatPrice(item)}</p><p className="text-xs text-muted-foreground">price</p></div>
          <div className="rounded-md bg-secondary p-3"><p className="font-black">{item.review_count}</p><p className="text-xs text-muted-foreground">reviews</p></div>
          <div className="rounded-md bg-secondary p-3"><p className="font-black">{item.photo_count}</p><p className="text-xs text-muted-foreground">photos</p></div>
        </div>
        <div className="flex flex-wrap gap-2">{item.tags.slice(0, 6).map((tag) => <span key={tag} className="rounded-full border bg-background px-3 py-1 text-xs font-bold">{tag}</span>)}</div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {item.review_count > 0 ? <Button size="sm" asChild><a href={`/items/${item.slug}`}><Star />Review</a></Button> : <Button size="sm" onClick={() => onFirstReview?.(item)}><Star />Be first to review this!</Button>}
          <Button variant="outline" size="sm" onClick={() => onDishAction?.(item, "want_to_try")}><Bookmark />Want to try {item.want_to_try_count ? `· ${item.want_to_try_count}` : ""}</Button>
          <Button variant="outline" size="sm" onClick={() => onDishAction?.(item, "favorite")}><Heart />Favorite {item.favorite_count ? `· ${item.favorite_count}` : ""}</Button>
          <Button asChild variant="outline" size="sm"><a href={mapsDirectionsUrl(item.restaurants, "driving")} target="_blank" rel="noreferrer"><Navigation />Drive</a></Button>
          <Button variant="outline" size="sm" onClick={shareItem}><Share2 />Share</Button>
        </div>
      </div>
    </article>
  );
};

const ItemCard = FeedItemCard;

const Index = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoLibraryInputRef = useRef<HTMLInputElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { user: sessionUser, signOut } = useAuthSession();
  const [authPrompt, setAuthPrompt] = useState<string | null>(null);
  const [view, setView] = useState<View>("discover");
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [feedMode, setFeedMode] = useState<FeedMode>("trending");
  const [searchSort, setSearchSort] = useState<SearchSort>(parseSearchSort(searchParams.get("sort")));
  const [cuisineFilter, setCuisineFilter] = useState(searchParams.get("cuisine") ?? "all");
  const [minRating, setMinRating] = useState(searchParams.get("rating") ?? "0");
  const [nearbyRestaurants, setNearbyRestaurants] = useState<Restaurant[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [scanRestaurant, setScanRestaurant] = useState("");
  const [scanDish, setScanDish] = useState("");
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);
  const [favoriteTarget, setFavoriteTarget] = useState<MenuItem | null>(null);

  const selectedSlug = location.pathname.startsWith("/items/") ? location.pathname.split("/items/")[1] : null;
  const listSlug = location.pathname.startsWith("/lists/") ? location.pathname.split("/lists/")[1] : null;
  const selectedItem = useMemo(() => items.find((item) => item.slug === selectedSlug) ?? null, [items, selectedSlug]);

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

  const loadItems = async (
    term = query,
    append = false,
    mode = feedMode,
    locationPoint = userLocation,
    filters = { cuisine: cuisineFilter, rating: minRating, sort: searchSort },
  ) => {
    const offset = append ? items.length : 0;
    if (append) setLoadingMore(true);
    else setLoading(true);

    const cleanTerm = sanitizePostgrestSearch(term);
    const useSearchEndpoint = Boolean(cleanTerm || filters.cuisine !== "all" || filters.rating !== "0" || filters.sort !== "relevance");
    const sort = filters.sort === "relevance" ? (mode === "nearby" ? "nearby" : mode === "recent" ? "recent" : "trending") : filters.sort;

    const { data, error } = await supabase.functions.invoke(useSearchEndpoint ? "dish-search" : "dish-feed", {
      body: {
        mode,
        query: cleanTerm,
        sort,
        cuisine: filters.cuisine === "all" ? null : filters.cuisine,
        minRating: Number(filters.rating),
        limit: DISCOVERY_PAGE_SIZE,
        offset,
        latitude: locationPoint?.latitude ?? null,
        longitude: locationPoint?.longitude ?? null,
        radiusMiles: 50,
      },
    });

    if (error || data?.error) {
      toast({ title: "Feed unavailable", description: data?.error ?? error?.message ?? "Try again.", variant: "destructive" });
      if (!append) setItems([]);
      setHasMoreItems(false);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const rows = ((data?.items ?? []) as MenuItem[]);
    setHasMoreItems(Boolean(data?.hasMore));
    if (append) setItems((current) => [...current, ...rows.filter((row) => !current.some((item) => item.id === row.id))]);
    else setItems(rows);
    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    const nextQuery = searchParams.get("q") ?? "";
    const nextSort = parseSearchSort(searchParams.get("sort"));
    const nextCuisine = searchParams.get("cuisine") ?? "all";
    const nextRating = searchParams.get("rating") ?? "0";
    setQuery(nextQuery);
    setSearchSort(nextSort);
    setCuisineFilter(nextCuisine);
    setMinRating(nextRating);
    void loadItems(nextQuery, false, feedMode, userLocation, { cuisine: nextCuisine, rating: nextRating, sort: nextSort });
  }, [searchParams, feedMode]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || view !== "discover" || selectedItem || listSlug || !hasMoreItems || loading || loadingMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadItems(query, true, feedMode, userLocation);
    }, { rootMargin: "700px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [view, selectedItem, listSlug, hasMoreItems, loading, loadingMore, query, items.length, feedMode, userLocation]);

  useEffect(() => {
    if (!selectedSlug || selectedItem) return;
    supabase
      .from("dishes")
      .select("*, restaurants(name,address,city,cuisine,latitude,longitude,phone,website_url,email,google_place_id,rating,review_count,price_level,business_status,maps_url,photo_reference)")
      .eq("slug", selectedSlug)
      .eq("is_published", true)
      .maybeSingle()
      .then(({ data }) => { if (data) setItems((current) => [data as unknown as MenuItem, ...current.filter((item) => item.slug !== selectedSlug)]); });
  }, [selectedItem, selectedSlug]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setSearchPanelOpen(false);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (searchSort !== "relevance") params.set("sort", searchSort);
    if (cuisineFilter !== "all") params.set("cuisine", cuisineFilter);
    if (minRating !== "0") params.set("rating", minRating);
    navigate(`/search?${params.toString()}`);
    void loadItems(query, false, feedMode, userLocation);
  };

  const loadNearbyRestaurants = async (locationPoint: { latitude: number; longitude: number }) => {
    setLoadingNearby(true);
    const { data, error } = await supabase.functions.invoke("nearby-restaurants", { body: { ...locationPoint, radiusMiles: 50, query } });
    setLoadingNearby(false);
    if (error || data?.error) {
      setNearbyRestaurants([]);
      toast({ title: "Nearby restaurants unavailable", description: "Dish feed still uses saved restaurant locations when available." });
      return;
    }
    const restaurants = ((data.restaurants ?? []) as Restaurant[]);
    setNearbyRestaurants(restaurants);
    toast({ title: restaurants.length ? "Nearby restaurants loaded" : "No nearby restaurants yet", description: restaurants.length ? `Found ${restaurants.length} restaurants within 50 miles.` : "Create dishes with restaurants to populate nearby places." });
  };

  const askLocation = () => navigator.geolocation?.getCurrentPosition(
    (pos) => {
      const locationPoint = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setUserLocation(locationPoint);
      setFeedMode("nearby");
      void loadItems(query, false, "nearby", locationPoint);
      void loadNearbyRestaurants(locationPoint);
    },
    () => toast({ title: "Location unavailable", description: "You can still browse by city and restaurant.", variant: "destructive" }),
    { enableHighAccuracy: true, timeout: 8000 },
  );

  const requireAuth = (message: string) => {
    if (!sessionUser) setAuthPrompt(message);
    else toast({ title: "Ready", description: message.replace("Sign in to ", "You can now ") });
  };

  const toggleDishAction = async (item: MenuItem, action: "want_to_try" | "favorite") => {
    if (!sessionUser) return setAuthPrompt(`Sign in to ${action === "favorite" ? "favorite" : "save"} dishes.`);
    if (!isUuid(item.id)) return toast({ title: "Seed item", description: "Open or create a real dish before saving it.", variant: "destructive" });
    const { data, error } = await supabase.functions.invoke("dish-interaction", { body: { type: "toggle_action", dishId: item.id, action, enabled: true } });
    if (error || data?.error) return toast({ title: "Action not saved", description: data?.error ?? error?.message ?? "Try again.", variant: "destructive" });
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, ...data.dish } : row));
    toast({ title: action === "favorite" ? "Favorited" : "Saved to want to try", description: "Your dish interaction is stored." });
  };

  const startFirstReview = (item: MenuItem) => {
    setScanRestaurant(item.restaurants?.name ?? "");
    setScanDish(item.name);
    setView("scan");
    navigate("/");
    requestAnimationFrame(() => document.getElementById("photo-review-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const addReviewPhotos = (files: File[], previews: string[]) => {
    setImageFiles((current) => [...current, ...files].slice(0, 6));
    setPhotoPreviews((current) => [...current, ...previews].slice(0, 6));
  };

  const chooseReviewPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    addReviewPhotos(files, files.map((file) => URL.createObjectURL(file)));
    event.target.value = "";
  };

  const captureReviewPhoto = async () => {
    if (!Capacitor.isNativePlatform()) return cameraInputRef.current?.click();
    try {
      const photo = await Camera.getPhoto({ quality: 85, allowEditing: false, resultType: CameraResultType.Uri, source: CameraSource.Camera });
      if (!photo.webPath) return;
      const file = await blobUrlToFile(photo.webPath, `food-review-${Date.now()}.jpg`);
      addReviewPhotos([file], [photo.webPath]);
    } catch {
      toast({ title: "Camera unavailable", description: "Select photos instead.", variant: "destructive" });
    }
  };

  const selectPhotos = async () => {
    if (!Capacitor.isNativePlatform()) return photoLibraryInputRef.current?.click();
    try {
      const result = await Camera.pickImages({ quality: 85, limit: 6 });
      const photos = result.photos.filter((photo) => photo.webPath);
      const files = await Promise.all(photos.map((photo, index) => blobUrlToFile(photo.webPath!, `food-review-${Date.now()}-${index}.jpg`)));
      addReviewPhotos(files, photos.map((photo) => photo.webPath!));
    } catch {
      toast({ title: "Photo library unavailable", description: "Try selecting photos from the browser picker.", variant: "destructive" });
    }
  };

  const removeReviewPhoto = (index: number) => {
    setImageFiles((current) => current.filter((_, photoIndex) => photoIndex !== index));
    setPhotoPreviews((current) => current.filter((_, photoIndex) => photoIndex !== index));
  };

  const startPhotoReview = async () => {
    if (!imageFiles.length) return toast({ title: "Add a food photo first", description: "Take or select at least one dish photo to start a review.", variant: "destructive" });
    document.getElementById("photo-review-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const resetPhotoReview = () => {
    setImageFiles([]);
    setPhotoPreviews([]);
    setScanRestaurant("");
    setScanDish("");
  };

  const displayedItems = items;

  return (
    <main className="min-h-screen bg-background pb-24 text-foreground md:pb-0">
      {authPrompt && <AuthModal onClose={() => setAuthPrompt(null)} />}
      {favoriteTarget && <SaveToListModal item={favoriteTarget} sessionUser={sessionUser} onClose={() => setFavoriteTarget(null)} onProtected={requireAuth} />}
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-3 md:px-6">
          <a href="/" className="flex items-center gap-2 font-display text-2xl font-black"><ChefHat className="text-accent" />PlateLoop</a>
          <form onSubmit={submitSearch} className="relative ml-auto hidden flex-1 md:block md:max-w-2xl"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9 pr-12" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pork belly bao taco, fish tacos, ramen…" /><button type="button" onClick={askLocation} className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="Use my location"><LocateFixed className="size-4" /></button></form>
          {sessionUser ? <AccountMenu sessionUser={sessionUser} onSignOut={signOut} onSelectView={(nextView) => { setView(nextView); navigate("/"); }} /> : <Button onClick={() => setAuthPrompt("Sign in only when you submit reviews or save favorites, lists, and history.")}><LogIn />Sign in</Button>}
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-3 py-5 md:grid-cols-[240px_1fr] md:px-6">
        <aside className="hidden md:block">
          <nav className="sticky top-24 space-y-2 rounded-lg border bg-card p-3 shadow-[var(--shadow-soft)]">{navItems.map((item) => <Button key={item.id} variant={view === item.id ? "default" : "ghost"} className="w-full justify-start" onClick={() => { setView(item.id); if (item.id !== "discover") navigate("/"); }}><item.icon />{item.label}</Button>)}</nav>
        </aside>

        <div className="min-w-0 space-y-5">
          {searchPanelOpen && (
            <div className="fixed inset-x-0 bottom-[76px] z-40 border-t bg-card p-3 shadow-[var(--shadow-editorial)] md:hidden">
              <form onSubmit={submitSearch} className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus className="h-12 pl-9 pr-24" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dishes, cravings, restaurants" /><button type="button" onClick={askLocation} className="absolute right-12 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="Use my location"><LocateFixed className="size-5" /></button><Button type="submit" size="icon" className="absolute right-1 top-1/2 size-10 -translate-y-1/2" aria-label="Search"><Search className="size-4" /></Button></form>
            </div>
          )}

          {listSlug && <PublicListPage slug={listSlug} userLocation={userLocation} onSave={setFavoriteTarget} />}

          {view === "discover" && !selectedItem && !listSlug && (
            <>
              <section className="rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)]">
                <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-black text-accent-foreground"><Sparkles className="size-4" /> Discovery feed</p>
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div><h1 className="font-display text-4xl font-black leading-none md:text-6xl">Scroll until something looks good.</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">Large food photos, clear ratings, and quick actions for dishes near you.</p></div>
                  <form onSubmit={submitSearch} className="flex min-w-0 flex-1 gap-2 md:max-w-md"><Input className="h-12 bg-background" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cravings…" /><Button className="h-12"><Search />Search</Button></form>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-4">
                  <Select value={searchSort} onValueChange={(value) => setSearchSort(value as SearchSort)}><SelectTrigger className="bg-background"><SelectValue placeholder="Rank by" /></SelectTrigger><SelectContent><SelectItem value="relevance">Best match</SelectItem><SelectItem value="trending">Trending</SelectItem><SelectItem value="rating">Top rated</SelectItem><SelectItem value="nearby">Nearest</SelectItem><SelectItem value="recent">Newest</SelectItem></SelectContent></Select>
                  <Select value={cuisineFilter} onValueChange={setCuisineFilter}><SelectTrigger className="bg-background"><SelectValue placeholder="Cuisine" /></SelectTrigger><SelectContent><SelectItem value="all">All cuisines</SelectItem><SelectItem value="American">American</SelectItem><SelectItem value="Italian">Italian</SelectItem><SelectItem value="Japanese">Japanese</SelectItem><SelectItem value="Mexican">Mexican</SelectItem><SelectItem value="Thai">Thai</SelectItem><SelectItem value="Dessert">Dessert</SelectItem></SelectContent></Select>
                  <Select value={minRating} onValueChange={setMinRating}><SelectTrigger className="bg-background"><SelectValue placeholder="Rating" /></SelectTrigger><SelectContent><SelectItem value="0">Any rating</SelectItem><SelectItem value="3.5">3.5★+</SelectItem><SelectItem value="4">4★+</SelectItem><SelectItem value="4.5">4.5★+</SelectItem></SelectContent></Select>
                  <Button type="button" variant="outline" onClick={askLocation}><LocateFixed />Location</Button>
                </div>
              </section>
              <div className="grid grid-cols-3 gap-2 rounded-lg border bg-card p-2 shadow-[var(--shadow-soft)]">
                {([{ id: "trending", label: "Trending", icon: Sparkles }, { id: "nearby", label: "Nearby", icon: MapPin }, { id: "recent", label: "Recent", icon: Clock }] as const).map((mode) => <Button key={mode.id} variant={feedMode === mode.id ? "default" : "ghost"} onClick={() => { if (mode.id === "nearby" && !userLocation) askLocation(); else setFeedMode(mode.id); }}><mode.icon />{mode.label}</Button>)}
              </div>
              <RestaurantDirectory restaurants={nearbyRestaurants} loading={loadingNearby} />
              <div className="flex items-center justify-between"><div><h2 className="font-display text-3xl font-black">{query ? `Dish search: ${query}` : feedMode === "nearby" ? "Nearby dishes" : feedMode === "recent" ? "Recently added" : "Trending dishes"}</h2><p className="text-sm text-muted-foreground">Backend-ranked with full-text dish search, ratings, saves, location, recency, and engagement.</p></div>{loading && <Loader2 className="animate-spin text-accent" />}</div>
              {loading ? <SearchResultsLoader /> : <div className="space-y-6">{displayedItems.length ? displayedItems.map((item) => <FeedItemCard key={item.id} item={item} userLocation={userLocation} onSave={setFavoriteTarget} onFirstReview={startFirstReview} onDishAction={toggleDishAction} />) : <div className="rounded-lg border border-dashed bg-card p-6 text-center"><ChefHat className="mx-auto mb-3 size-10 text-accent" /><h2 className="font-display text-2xl font-black">No real dishes yet</h2><p className="text-sm text-muted-foreground">Capture a dish photo to create the first feed item.</p><Button className="mt-4" onClick={() => setView("scan")}><CameraIcon />Add dish</Button></div>}<div ref={loadMoreRef} className="flex min-h-24 items-center justify-center rounded-lg border border-dashed bg-card/70 p-4 text-sm font-bold text-muted-foreground">{loadingMore ? <><Loader2 className="mr-2 size-4 animate-spin text-accent" />Loading more cravings…</> : hasMoreItems ? "Scroll for more" : "You’re all caught up"}</div></div>}
            </>
          )}

          {selectedItem && !listSlug && <ItemDetail item={selectedItem} userLocation={userLocation} sessionUser={sessionUser} onProtected={requireAuth} onSave={setFavoriteTarget} onReviewPublished={() => { setReviewRefreshKey((key) => key + 1); void loadItems(query, false, feedMode, userLocation); }} reviewRefreshKey={reviewRefreshKey} />}

          {view === "scan" && (
            <section className="rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)]">
              <div className="mb-4"><h1 className="font-display text-4xl font-black">Start a food review</h1><p className="text-sm text-muted-foreground">Take one or more photos of the dish, then find the menu item and post your review.</p></div>
              <div className="grid gap-3 md:grid-cols-2"><Input placeholder="Restaurant name" value={scanRestaurant} onChange={(event) => setScanRestaurant(event.target.value)} /><Input placeholder="Dish name" value={scanDish} onChange={(event) => setScanDish(event.target.value)} /></div>
              <div className="mt-3 overflow-hidden rounded-lg border bg-secondary">{photoPreviews.length ? <div className="grid gap-2 p-2 sm:grid-cols-2 lg:grid-cols-3">{photoPreviews.map((photo, index) => <div key={photo} className="relative overflow-hidden rounded-md border bg-background"><img src={photo} alt={`Food review photo ${index + 1}`} className="h-48 w-full object-cover sm:h-44" /><div className="absolute inset-x-2 top-2 flex justify-between gap-2"><span className="rounded-full bg-background/90 px-2 py-1 text-xs font-black text-foreground">{index + 1}/{photoPreviews.length}</span><Button type="button" size="icon" variant="secondary" className="size-8" onClick={() => removeReviewPhoto(index)} aria-label="Remove photo"><X className="size-4" /></Button></div></div>)}</div> : <button onClick={captureReviewPhoto} className="flex h-80 w-full flex-col items-center justify-center gap-3 text-muted-foreground"><span className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"><CameraIcon className="size-10" /></span><span className="font-bold">Take a food photo</span><span className="text-xs font-semibold">Preview it here before posting</span></button>}</div>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={chooseReviewPhotos} />
              <input ref={photoLibraryInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="hidden" onChange={chooseReviewPhotos} />
              <div className="mt-3 grid gap-2 sm:grid-cols-3"><Button type="button" className="h-12" onClick={captureReviewPhoto}><CameraIcon />{photoPreviews.length ? "Add photo" : "Take photo"}</Button><Button type="button" className="h-12" variant="outline" onClick={selectPhotos}><Upload />Select photos</Button><Button type="button" className="h-12" onClick={startPhotoReview} disabled={!imageFiles.length}><Star />Start review</Button></div>
              {imageFiles.length > 0 && <PhotoReviewComposer imageFiles={imageFiles} photoPreviews={photoPreviews} restaurantName={scanRestaurant} dishName={scanDish} onRestaurantNameChange={setScanRestaurant} onDishNameChange={setScanDish} sessionUser={sessionUser} onProtected={requireAuth} onPublished={resetPhotoReview} />}
            </section>
          )}

          {view === "favorites" && <ShareableLists sessionUser={sessionUser} onProtected={requireAuth} />}
          {view === "profile" && <ProfilePanel sessionUser={sessionUser} onProtected={requireAuth} />}
        </div>
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 items-center border-t bg-card/95 p-2 backdrop-blur md:hidden">
        {navItems.slice(0, 2).map((item) => <button key={item.id} onClick={() => { setSearchPanelOpen(false); setView(item.id); if (item.id !== "discover") navigate("/"); }} className={cn("flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] font-semibold text-muted-foreground", view === item.id && "bg-primary text-primary-foreground")}><item.icon className="size-5" />{item.label}</button>)}
        <button onClick={() => setSearchPanelOpen((open) => !open)} className={cn("mx-auto -mt-7 flex size-16 flex-col items-center justify-center rounded-full border-4 border-background bg-accent text-accent-foreground shadow-[var(--shadow-editorial)] transition hover:scale-105", searchPanelOpen && "bg-primary text-primary-foreground")} aria-label="Open search"><Search className="size-7" /></button>
        {navItems.slice(2).map((item) => <button key={item.id} onClick={() => { setSearchPanelOpen(false); setView(item.id); if (item.id !== "discover") navigate("/"); }} className={cn("flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] font-semibold text-muted-foreground", view === item.id && "bg-primary text-primary-foreground")}><item.icon className="size-5" />{item.label}</button>)}
      </nav>
    </main>
  );
};

const AccountMenu = ({ sessionUser, onSelectView, onSignOut }: { sessionUser: NonNullable<UserSession>; onSelectView: (view: View) => void; onSignOut: () => Promise<unknown> }) => {
  const initial = (sessionUser.displayName ?? sessionUser.email)?.trim().charAt(0).toUpperCase() || "U";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="rounded-full outline-none ring-offset-background transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label="Open account menu">
          <Avatar className="size-10 border border-primary/30 shadow-[var(--shadow-soft)]">
            {sessionUser.avatarUrl && <AvatarImage src={sessionUser.avatarUrl} alt={sessionUser.displayName ?? sessionUser.email ?? "Account"} />}
            <AvatarFallback className="bg-gradient-to-br from-accent via-primary to-destructive text-sm font-black text-primary-foreground">{initial}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{sessionUser.displayName || sessionUser.email || "Signed in"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onSelectView("profile")}><User className="mr-2 size-4" />Profile</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelectView("favorites")}><Bookmark className="mr-2 size-4" />Favorites</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelectView("profile")}><MessageSquareText className="mr-2 size-4" />Reviews</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => { void onSignOut(); }}><LogOut className="mr-2 size-4" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
        <div className="space-y-4 p-5 md:p-8"><p className="text-sm font-black text-accent">{item.cuisine} · {item.section}</p><h1 className="font-display text-5xl font-black leading-none">{item.name}</h1><p className="text-muted-foreground">{item.description}</p><div className="grid grid-cols-2 gap-3"><Metric icon={Star} label="dish rating" value={`${item.aggregate_rating}★`} /><Metric icon={Clock} label="reviews" value={String(item.review_count)} /><Metric icon={MapPin} label="distance" value={miles ? `${miles.toFixed(1)} mi` : "Enable location"} /><Metric icon={Bookmark} label="price" value={formatPrice(item)} /></div><div className="flex flex-wrap gap-2"><Button onClick={() => document.getElementById("review-menu-item")?.scrollIntoView({ behavior: "smooth", block: "start" })}><Star />{item.review_count > 0 ? "Review this item" : "Be first to review this!"}</Button><Button variant="outline" onClick={() => onSave(item)}><Bookmark />Favorite</Button><Button variant="outline" onClick={shareItem}><Share2 />Share</Button></div></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]"><div className="space-y-4"><ReviewForm item={item} sessionUser={sessionUser} onProtected={onProtected} onPublished={onReviewPublished} /><ReviewFeed item={item} refreshKey={reviewRefreshKey} /></div><div className="rounded-lg border bg-card p-4"><h2 className="font-display text-2xl font-black">Restaurant context</h2><p className="mt-2 font-bold">{item.restaurants?.name}</p><p className="text-sm text-muted-foreground">{item.restaurants?.address} · {item.restaurants?.city}</p><div className="mt-3 grid gap-2"><Button className="w-full" asChild><a href={mapsDirectionsUrl(item.restaurants, "driving")} target="_blank" rel="noreferrer"><Navigation />Driving directions</a></Button><Button className="w-full" variant="outline" asChild><a href={mapsDirectionsUrl(item.restaurants, "walking")} target="_blank" rel="noreferrer"><Footprints />Walking directions</a></Button>{callUrl && <Button className="w-full" variant="outline" asChild><a href={callUrl}><Phone />Call</a></Button>}{webUrl && <Button className="w-full" variant="outline" asChild><a href={webUrl} target="_blank" rel="noreferrer"><Globe />Website</a></Button>}{mailUrl && <Button className="w-full" variant="outline" asChild><a href={mailUrl}><Mail />Email</a></Button>}</div></div></div>
    </section>
  );
};

const Metric = ({ icon: Icon, label, value }: { icon: typeof Star; label: string; value: string }) => <div className="rounded-md bg-secondary p-3"><Icon className="mb-2 size-5 text-accent" /><p className="font-display text-2xl font-black">{value}</p><p className="text-xs font-bold text-muted-foreground">{label}</p></div>;

const SearchResultsLoader = () => <div className="space-y-4" aria-label="Loading search results" aria-live="polite">{[0, 1, 2].map((item) => <div key={item} className="grid overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-soft)] md:grid-cols-[220px_1fr]"><div className="h-56 animate-pulse bg-gradient-to-br from-accent/35 via-primary/25 to-destructive/25 md:h-full" /><div className="space-y-4 p-4"><div className="h-4 w-28 animate-pulse rounded-full bg-accent/40" /><div className="h-8 w-2/3 animate-pulse rounded-md bg-primary/25" /><div className="h-4 w-full animate-pulse rounded-md bg-muted" /><div className="h-4 w-4/5 animate-pulse rounded-md bg-muted" /><div className="flex gap-2"><span className="h-9 w-24 animate-pulse rounded-md bg-accent/40" /><span className="h-9 w-24 animate-pulse rounded-md bg-primary/30" /></div></div></div>)}</div>;


const RestaurantDirectory = ({ restaurants, loading }: { restaurants: Restaurant[]; loading: boolean }) => {
  if (loading) return <section className="rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)]"><div className="flex items-center gap-2 font-bold text-accent"><Loader2 className="size-4 animate-spin" />Loading Google Maps restaurants within 50 miles…</div></section>;
  if (!restaurants.length) return null;
  return <section className="space-y-3 rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)]"><div><h2 className="font-display text-3xl font-black">Nearby restaurants from Google Maps</h2><p className="text-sm text-muted-foreground">Places within 50 miles of your location. Add the first dish review when something looks good.</p></div><div className="grid gap-3 md:grid-cols-2">{restaurants.map((restaurant) => <article key={restaurant.google_place_id ?? restaurant.id ?? restaurant.name} className="rounded-md border bg-background p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-display text-xl font-black">{restaurant.name}</h3><p className="mt-1 text-sm text-muted-foreground">{restaurant.address || restaurant.city || "Nearby"}</p></div>{restaurant.rating ? <span className="rounded-full bg-accent px-3 py-1 text-sm font-black text-accent-foreground"><Star className="mr-1 inline size-4 fill-current" />{restaurant.rating}</span> : null}</div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" asChild><a href={`/search?q=${encodeURIComponent(restaurant.name)}`}>Be first to review this!</a></Button>{restaurant.maps_url && <Button size="sm" variant="outline" asChild><a href={restaurant.maps_url} target="_blank" rel="noreferrer"><Navigation />Maps</a></Button>}{restaurant.website_url && <Button size="sm" variant="outline" asChild><a href={restaurant.website_url} target="_blank" rel="noreferrer"><Globe />Website</a></Button>}</div></article>)}</div></section>;
};

const StarRating = ({ value, onChange }: { value: number; onChange: (value: number) => void }) => {
  const chooseRating = (star: number, event: MouseEvent<HTMLButtonElement>) => {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const isHalf = event.clientX - left < width / 2;
    onChange(star - (isHalf ? 0.5 : 0));
  };
  const nudgeRating = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const delta = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -0.5 : 0.5;
    onChange(Math.min(5, Math.max(1, value + delta)));
  };
  return (
    <div className="flex gap-1" aria-label={`Rating: ${value} out of 5 stars`} onKeyDown={nudgeRating}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fillPercent = value >= star ? 100 : value >= star - 0.5 ? 50 : 0;
        return (
          <button
            key={star}
            type="button"
            onClick={(event) => chooseRating(star, event)}
            className={cn(
              "group relative rounded-md p-1 transition duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              fillPercent ? "text-accent drop-shadow-sm" : "text-muted-foreground/35 hover:text-primary",
            )}
            aria-label={`${star - 0.5} or ${star} stars`}
            aria-pressed={fillPercent > 0}
          >
            <span className="relative block size-8">
              <Star className="absolute inset-0 size-8 transition-colors duration-200" />
              <span className="absolute inset-0 overflow-hidden transition-all duration-200 ease-out" style={{ width: `${fillPercent}%` }}>
                <Star className="size-8 fill-current text-accent transition-transform duration-200 group-hover:scale-110" />
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

const QuickScale = ({ label, low, high, value, onChange, min = 1 }: { label: string; low: string; high: string; value: number; onChange: (value: number) => void; min?: number }) => <label className="block rounded-md border bg-background p-3 shadow-[var(--shadow-soft)]"><div className="mb-2 flex items-center justify-between gap-3"><span className="text-sm font-black">{label}</span><span className={cn("rounded-full px-2 py-1 text-xs font-black", value >= 4 ? "bg-destructive text-destructive-foreground" : value >= 3 ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground")}>{value}</span></div><input className="w-full accent-primary" type="range" min={min} max="5" step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} /><div className="mt-1 flex justify-between text-xs font-bold"><span className="text-accent">{low}</span><span className="text-destructive">{high}</span></div></label>;

const PhotoReviewComposer = ({ imageFiles, photoPreviews, restaurantName, dishName, onRestaurantNameChange, onDishNameChange, sessionUser, onProtected, onPublished }: { imageFiles: File[]; photoPreviews: string[]; restaurantName: string; dishName: string; onRestaurantNameChange: (value: string) => void; onDishNameChange: (value: string) => void; sessionUser: UserSession; onProtected: (message: string) => void; onPublished: () => void }) => {
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

  const publishPhotoReview = async (event: FormEvent) => {
    event.preventDefault();
    if (!sessionUser) return onProtected("Sign in to publish your photo review.");
    if (!imageFiles.length) return toast({ title: "Add a food photo first", variant: "destructive" });
    const parsed = photoReviewSchema.safeParse({ restaurant_name: restaurantName, dish_name: dishName, rating, review, price_paid: pricePaid, tags, would_order_again: wouldOrderAgain, temperature_rating: temperature, spiciness_rating: spiciness, sweet_savory_rating: sweetSavory, flavor_intensity_rating: flavorIntensity });
    if (!parsed.success) return toast({ title: "Check your review", description: parsed.error.issues[0]?.message ?? "Some fields need attention.", variant: "destructive" });

    setSaving(true);
    const optimizedFiles = await Promise.all(imageFiles.slice(0, 6).map((file) => optimizeImageFile(file)));
    const images = await Promise.all(optimizedFiles.map(async (file) => ({ imageBase64: await fileToBase64(file), mimeType: file.type, fileName: file.name })));
    const cleanTags = (parsed.data.tags ?? "").split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 8);
    const { data, error } = await supabase.functions.invoke("capture-dish", { body: { dishName: parsed.data.dish_name, restaurantName: parsed.data.restaurant_name || null, images, rating: parsed.data.rating, review: parsed.data.review || null, pricePaid: parsed.data.price_paid ?? null, tags: cleanTags, metrics: { wouldOrderAgain: parsed.data.would_order_again, temperature: parsed.data.temperature_rating, spiciness: parsed.data.spiciness_rating, sweetSavory: parsed.data.sweet_savory_rating, flavorIntensity: parsed.data.flavor_intensity_rating } } });
    setSaving(false);
    if (error || data?.error) return toast({ title: "Dish not saved", description: data?.error ?? error?.message ?? "Try again.", variant: "destructive" });
    const aiSuggestion = data?.aiSuggestion;
    toast({ title: aiSuggestion?.dishName ? `AI suggests: ${aiSuggestion.dishName}` : "Dish saved", description: aiSuggestion?.status === "completed" ? `Tags: ${(aiSuggestion.tags ?? []).join(", ") || "none"}` : aiSuggestion?.error ?? "Your photo, dish, rating, and review are stored." });
    setReview(""); setPricePaid(""); setTags(""); onPublished();
  };

  return <form id="photo-review-form" onSubmit={publishPhotoReview} className="mt-5 space-y-4 border-t pt-4"><h2 className="font-display text-3xl font-black">Create dish</h2><div className="grid gap-3 md:grid-cols-2"><label className="text-sm font-bold">Dish<Input value={dishName} onChange={(event) => onDishNameChange(event.target.value)} maxLength={120} placeholder="Dish name" required /></label><label className="text-sm font-bold">Restaurant optional<Input value={restaurantName} onChange={(event) => onRestaurantNameChange(event.target.value)} maxLength={120} placeholder="Restaurant name" /></label></div><p className="rounded-md border bg-secondary p-3 text-sm font-bold text-secondary-foreground"><Sparkles className="mr-2 inline size-4 text-accent" />The uploaded photo is sent to AI on save; suggestions and tags are stored with the photo while your dish name stays editable.</p><div className="rounded-md border bg-background p-3"><p className="mb-2 text-sm font-black">Overall rating</p><StarRating value={rating} onChange={setRating} /></div><div className="grid gap-3 md:grid-cols-2"><QuickScale label="Temperature" low="cold" high="hot" value={temperature} onChange={setTemperature} /><QuickScale label="Spiciness" low="none" high="fire" value={spiciness} onChange={setSpiciness} min={0} /><QuickScale label="Sweet ↔ savory" low="sweet" high="savory" value={sweetSavory} onChange={setSweetSavory} /><QuickScale label="Flavor intensity" low="subtle" high="bold" value={flavorIntensity} onChange={setFlavorIntensity} /></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Price paid<Input type="number" min="0" max="10000" step="0.01" value={pricePaid} onChange={(event) => setPricePaid(event.target.value)} placeholder="Optional" /></label><label className="flex items-end gap-2 text-sm font-bold"><input type="checkbox" checked={wouldOrderAgain} onChange={(event) => setWouldOrderAgain(event.target.checked)} />Would order again</label></div><Textarea value={review} onChange={(event) => setReview(event.target.value)} maxLength={1200} placeholder="Optional note about taste, texture, value, and cravings" /><Input value={tags} onChange={(event) => setTags(event.target.value)} maxLength={140} placeholder="Optional tags: crispy, spicy, great value" /><Button type="submit" className="w-full" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Sparkles />}Save dish + run AI</Button></form>;
};

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
    const { data, error } = await supabase.functions.invoke("dish-interaction", { body: { type: "rate", dishId: item.id, rating: parsed.data.rating, review: parsed.data.review || null } });
    setSaving(false);
    if (error || data?.error) return toast({ title: "Review not published", description: data?.error ?? error?.message ?? "Try again.", variant: "destructive" });
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
    supabase.from("reviews").select("id,body,price_paid,currency,created_at,ratings(rating,would_order_again,temperature_rating,spiciness_rating,sweet_savory_rating,flavor_intensity_rating)").eq("dish_id", item.id).eq("is_public", true).order("created_at", { ascending: false }).limit(20).then(({ data }) => setReviews((data ?? []).map((row: any) => ({ id: row.id, rating: row.ratings?.rating ?? 0, review: row.body, price_paid: row.price_paid, currency: row.currency, tags: [], would_order_again: row.ratings?.would_order_again, temperature_rating: row.ratings?.temperature_rating, spiciness_rating: row.ratings?.spiciness_rating, sweet_savory_rating: row.ratings?.sweet_savory_rating, flavor_intensity_rating: row.ratings?.flavor_intensity_rating, created_at: row.created_at })) as MenuItemReview[]));
  }, [item.id, refreshKey]);
  const rows = reviews;
  return <section className="space-y-3 rounded-lg border bg-card p-4"><h2 className="font-display text-3xl font-black">Reviews for this menu item</h2>{rows.map((review) => <article key={review.id} className="border-t pt-3"><p className="font-bold"><span className="text-accent">{"★".repeat(Math.round(review.rating))}</span> {review.would_order_again ? "· would order again" : ""}</p>{review.price_paid ? <p className="text-xs font-bold text-accent">Paid ${review.price_paid} {review.currency}</p> : null}<div className="mt-2 grid grid-cols-2 gap-2 text-xs font-bold text-muted-foreground md:grid-cols-4"><span>Temp {review.temperature_rating ?? "—"}/5</span><span>Spice {review.spiciness_rating ?? "—"}/5</span><span>Sweet↔Savory {review.sweet_savory_rating ?? "—"}/5</span><span>Flavor {review.flavor_intensity_rating ?? "—"}/5</span></div><p className="mt-2 text-sm text-muted-foreground">{review.review}</p>{review.tags.length ? <div className="mt-2 flex flex-wrap gap-2">{review.tags.map((tag) => <span key={tag} className="rounded-full border bg-background px-2 py-1 text-xs font-bold">{tag}</span>)}</div> : null}</article>)}</section>;
};

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
    const { error } = await supabase.from("favorite_list_items").upsert({ list_id: list.id, dish_id: item.id }, { onConflict: "list_id,dish_id" });
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
    if (!error && list) await supabase.from("favorite_list_items").upsert({ list_id: list.id, dish_id: item.id }, { onConflict: "list_id,dish_id" });
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
      const { data: rows } = await supabase.from("favorite_list_items").select("dishes(*, restaurants(name,address,city,cuisine,latitude,longitude,phone,website_url,email,google_place_id,rating,review_count,price_level,business_status,maps_url,photo_reference))").eq("list_id", data.id).order("sort_order");
      setList({ ...(data as FavoriteList), items: ((rows ?? []).map((row) => row.dishes).filter(Boolean) as unknown as MenuItem[]) });
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

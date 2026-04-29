import { ChangeEvent, FormEvent, KeyboardEvent, lazy, MouseEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import {
  Bookmark,
  Camera as CameraIcon,
  ChefHat,
  Clock,
  Compass,
  Copy,
  Footprints,
  Heart,
  Eye,
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
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const AuthModal = lazy(() => import("@/components/AuthModal"));

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
  user_want_to_try?: boolean;
  user_favorite?: boolean;
  cover_image_url?: string | null;
  restaurants?: Restaurant | null;
  trend_status?: "normal" | "trending" | "viral";
  trend_labels?: string[];
  trend_metrics?: { trend_score?: number; spike_score?: number; recent_share_count?: number; recent_save_count?: number; recent_rating_count?: number } | null;
  is_sponsored?: boolean;
  sponsorship?: { label?: string; sponsor_name?: string | null; boost_score?: number } | null;
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
type ReviewFeedRow = { id: string; body?: string | null; price_paid?: number | null; currency: string; created_at?: string; ratings?: Pick<MenuItemReview, "rating" | "would_order_again" | "temperature_rating" | "spiciness_rating" | "sweet_savory_rating" | "flavor_intensity_rating"> | null };
type FavoriteList = {
  id: string;
  title: string;
  description?: string | null;
  slug: string;
  is_public: boolean;
  cover_image_url?: string | null;
  item_count?: number;
};
type FavoriteListDetail = FavoriteList & { items: MenuItem[] };
type DishListItemInsert = { list_id: string; dish_id: string };
type Collection = {
  id: string;
  name: string;
  description?: string | null;
  slug: string;
  is_public: boolean;
  cover_image_url?: string | null;
  item_count?: number;
};
type CollectionPreview = Collection & { dishes: DashboardDish[] };

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
const collectionSchema = z.object({
  name: z.string().trim().min(1, "Collection name is required.").max(80, "Keep collection names under 80 characters."),
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

const suggestedSearches = ["Best steak near me", "Spicy ramen", "Crispy tacos", "Sushi rolls"];
const trendingQueries = ["Smash burger", "Birria", "Hot chicken", "Matcha dessert"];

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const parseSearchSort = (value: string | null): SearchSort => ["relevance", "trending", "rating", "nearby", "recent"].includes(value ?? "") ? value as SearchSort : "relevance";
const formatPrice = (item: MenuItem) => item.price_min && item.price_max && item.price_min !== item.price_max ? `$${item.price_min}-${item.price_max}` : item.typical_price ? `$${item.typical_price}` : "Price pending";
const normalizeMenuItem = (row: Partial<MenuItem> & Record<string, unknown>, trend?: Record<string, unknown> | null): MenuItem => {
  const trendLabel = trend?.status === "viral" ? "Viral" : trend?.status === "trending" ? "Trending" : null;
  const incomingLabels = Array.isArray(row.trend_labels) ? row.trend_labels.filter((label): label is string => typeof label === "string") : [];
  return {
    ...(row as MenuItem),
    id: String(row.id ?? ""),
    name: String(row.name ?? "Dish"),
    slug: String(row.slug ?? slugify(String(row.name ?? "dish"))),
    tags: Array.isArray(row.tags) ? row.tags as string[] : [],
    dietary_tags: Array.isArray(row.dietary_tags) ? row.dietary_tags as string[] : [],
    currency: typeof row.currency === "string" ? row.currency : "USD",
    aggregate_rating: Number(row.aggregate_rating ?? 0),
    rating_count: Number(row.rating_count ?? 0),
    review_count: Number(row.review_count ?? 0),
    photo_count: Number(row.photo_count ?? 0),
    want_to_try_count: Number(row.want_to_try_count ?? 0),
    favorite_count: Number(row.favorite_count ?? 0),
    is_sponsored: Boolean(row.is_sponsored),
    sponsorship: row.sponsorship && typeof row.sponsorship === "object" ? row.sponsorship as MenuItem["sponsorship"] : null,
    trend_status: trend?.status === "viral" || trend?.status === "trending" ? trend.status : "normal",
    trend_labels: incomingLabels.length ? incomingLabels : [trendLabel, trend?.is_hot_nearby ? "Hot near you" : null].filter(Boolean) as string[],
    trend_metrics: trend ?? null,
  };
};
const sanitizePostgrestSearch = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9\s'&/-]/g, " ")
  .replace(/\s+/g, " ")
  .slice(0, 80);
const menuItemUrl = (slug: string) => `${window.location.origin}/dish/${encodeURIComponent(slug)}`;
const listUrl = (slug: string) => `${window.location.origin}/lists/${encodeURIComponent(slug)}`;
const shareDishLink = async (item: MenuItem, channel: "native" | "clipboard" | "copy_link" = "native") => {
  const url = menuItemUrl(item.slug);
  if (channel === "native" && navigator.share) await navigator.share({ title: `${item.name} at ${item.restaurants?.name ?? "PlateLoop"}`, text: `${item.aggregate_rating.toFixed(1)}★ ${item.name} · ${formatPrice(item)}`, url });
  else await navigator.clipboard.writeText(url);
  void supabase.functions.invoke("dish-interaction", { body: { type: "share", dishId: item.id, channel: channel === "native" && navigator.share ? "native" : channel } });
};
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
const isHeicFile = (file: File) => /image\/(heic|heif)/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
const convertHeicFile = async (file: File) => {
  if (!isHeicFile(file)) return file;
  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.86 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  return new File([blob], `${slugify(file.name.replace(/\.[^.]+$/, "")) || "food-photo"}.jpg`, { type: "image/jpeg" });
};
const optimizeImageFile = async (file: File) => {
  const sourceFile = await convertHeicFile(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = URL.createObjectURL(sourceFile); });
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(image.src);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Image optimization failed")), "image/jpeg", 0.86));
  return new File([blob], `${slugify(sourceFile.name.replace(/\.[^.]+$/, "")) || "food-photo"}.jpg`, { type: "image/jpeg" });
};
const blobUrlToFile = async (url: string, name: string) => { const response = await fetch(url); const blob = await response.blob(); return new File([blob], name, { type: blob.type || "image/jpeg" }); };
const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), ms); });
  try { return await Promise.race([promise, timeout]); }
  finally { if (timeoutId) clearTimeout(timeoutId); }
};

const FeedItemCard = ({ item, userLocation, onSave, onFirstReview, onDishAction }: { item: MenuItem; userLocation: { latitude: number; longitude: number } | null; onSave: (item: MenuItem) => void; onFirstReview?: (item: MenuItem) => void; onDishAction?: (item: MenuItem, action: "want_to_try" | "favorite", enabled: boolean) => void }) => {
  const miles = distanceMiles(userLocation, item.restaurants);
  const trendLabels = item.trend_labels ?? [];
  const labels = item.is_sponsored ? [item.sponsorship?.label || "Sponsored", ...trendLabels.filter((label) => label !== "Sponsored")] : trendLabels;

  return (
    <article className="feed-reel group relative -mx-3 min-h-[calc(100svh-148px)] overflow-hidden bg-secondary shadow-[var(--shadow-editorial)] ring-1 ring-border/55 md:mx-0 md:w-full md:max-w-full md:min-h-[760px] md:rounded-[32px]">
        {item.cover_image_url ? <div className="image-skeleton absolute inset-0"><img src={item.cover_image_url} alt={`${item.name} at ${item.restaurants?.name ?? "dish"}`} className="h-full w-full object-cover transition duration-700 group-active:scale-[1.02] group-hover:scale-105" loading="lazy" decoding="async" sizes="(min-width: 768px) 760px, 100vw" width={720} height={960} /></div> : <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-secondary text-secondary-foreground"><ChefHat className="size-24 opacity-50" /></div>}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/28 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background/55 to-transparent" />
      <a href={`/dish/${item.slug}`} className="absolute inset-0" aria-label={`View details for ${item.name}`} />
      <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2"><span className="soft-chip text-accent"><Star className="size-4 fill-current" />{item.aggregate_rating.toFixed(1)}</span>{labels.map((label) => <span key={label} className="soft-chip text-accent"><Sparkles className="size-4" />{label}</span>)}</div>
      <div className="absolute bottom-0 left-0 right-16 p-4 pb-7 text-foreground sm:p-7">
        <p className="pointer-events-none mb-2 inline-flex max-w-full items-center gap-1 rounded-full bg-background/62 px-3 py-1 text-[11px] font-black text-foreground backdrop-blur-md"><MapPin className="size-3 shrink-0 text-accent" /><span className="truncate">{item.restaurants?.name ?? "Standalone dish"}{miles ? ` · ${miles.toFixed(1)} mi` : item.restaurants?.city ? ` · ${item.restaurants.city}` : ""}</span></p>
        <a href={`/dish/${item.slug}`} className="relative z-10 block min-w-0"><h2 className="break-words font-display text-3xl font-black leading-none sm:text-5xl">{item.name}</h2></a>
        <div className="pointer-events-none mt-2 flex items-center gap-2 text-xs font-bold text-foreground/78"><span>{formatPrice(item)}</span><span>·</span><span>{item.review_count} reviews</span></div>
      </div>
      <div className="absolute bottom-6 right-3 z-10 flex flex-col gap-3">
        <button type="button" className={cn("thumb-action save-pop", item.user_favorite && "bg-primary text-primary-foreground animate-scale-in")} onClick={(event) => { event.preventDefault(); onDishAction?.(item, "favorite", !item.user_favorite); }} aria-label="Save dish"><Heart className={cn("size-5", item.user_favorite && "fill-current")} /></button>
        <button type="button" className={cn("thumb-action save-pop", item.user_want_to_try && "bg-accent text-accent-foreground animate-scale-in")} onClick={(event) => { event.preventDefault(); onDishAction?.(item, "want_to_try", !item.user_want_to_try); }} aria-label="Want to try"><Bookmark className={cn("size-5", item.user_want_to_try && "fill-current")} /></button>
        <button type="button" className="thumb-action" onClick={(event) => { event.preventDefault(); void shareDishLink(item); }} aria-label="Share dish"><Share2 className="size-5" /></button>
        <a className="thumb-action" href={`/dish/${item.slug}`} aria-label="View dish details"><Eye className="size-5" /></a>
        {item.review_count === 0 && <button type="button" className="thumb-action" onClick={(event) => { event.preventDefault(); onFirstReview?.(item); }} aria-label="Review first"><Star className="size-5" /></button>}
      </div>
    </article>
  );
};

const SearchDishCard = ({ item, userLocation, onDishAction }: { item: MenuItem; userLocation: { latitude: number; longitude: number } | null; onDishAction?: (item: MenuItem, action: "want_to_try" | "favorite", enabled: boolean) => void }) => {
  const miles = distanceMiles(userLocation, item.restaurants);
  const trendLabels = item.trend_labels ?? [];
  const labels = item.is_sponsored ? [item.sponsorship?.label || "Sponsored", ...trendLabels.filter((label) => label !== "Sponsored")] : trendLabels;
  return <article className="group min-w-0 max-w-full overflow-hidden rounded-[26px] bg-card shadow-[var(--shadow-soft)] ring-1 ring-border/55 transition duration-200 active:scale-[0.98]"><a href={`/dish/${item.slug}`} className="block"><div className="image-skeleton relative aspect-[4/5] overflow-hidden">{item.cover_image_url ? <img src={item.cover_image_url} alt={`${item.name} at ${item.restaurants?.name ?? "restaurant"}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" decoding="async" sizes="(min-width: 768px) 33vw, 50vw" /> : <div className="flex h-full items-center justify-center"><ChefHat className="size-12 opacity-40" /></div>}<div className="absolute inset-0 bg-gradient-to-t from-background/86 via-transparent to-transparent" /><div className="absolute left-3 top-3 flex max-w-[calc(100%-4rem)] flex-wrap gap-1.5"><span className="soft-chip text-accent"><Star className="size-3 fill-current" />{item.aggregate_rating.toFixed(1)}</span>{labels.map((label) => <span key={label} className="soft-chip text-accent"><Sparkles className="size-3" />{label}</span>)}</div><button type="button" className={cn("absolute right-3 top-3 thumb-action save-pop size-10", item.user_favorite && "bg-primary text-primary-foreground animate-scale-in")} onClick={(event) => { event.preventDefault(); onDishAction?.(item, "favorite", !item.user_favorite); }} aria-label="Save dish"><Heart className={cn("size-4", item.user_favorite && "fill-current")} /></button><button type="button" className="absolute right-3 top-16 thumb-action size-10" onClick={(event) => { event.preventDefault(); void shareDishLink(item); }} aria-label="Share dish"><Share2 className="size-4" /></button><div className="absolute inset-x-0 bottom-0 p-3"><h2 className="line-clamp-2 font-display text-2xl font-black leading-none">{item.name}</h2><p className="mt-1 line-clamp-1 text-xs font-bold text-foreground/72">{item.restaurants?.name ?? "Dish"}{miles ? ` · ${miles.toFixed(1)} mi` : ""}</p></div></div></a></article>;
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
  const feedRequestRef = useRef(0);
  const itemsLengthRef = useRef(0);
  const guestFeedPromptShownRef = useRef(false);
  const { user: sessionUser, signOut } = useAuthSession();
  const [authPrompt, setAuthPrompt] = useState<string | null>(null);
  const [view, setView] = useState<View>("discover");
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
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
  const [sharedDishNudgeDismissed, setSharedDishNudgeDismissed] = useState(false);

  const selectedSlug = location.pathname.startsWith("/dish/") ? location.pathname.split("/dish/")[1] : location.pathname.startsWith("/items/") ? location.pathname.split("/items/")[1] : null;
  const listSlug = location.pathname.startsWith("/lists/") ? location.pathname.split("/lists/")[1] : null;
  const selectedItem = useMemo(() => items.find((item) => item.slug === selectedSlug) ?? null, [items, selectedSlug]);

  useEffect(() => { itemsLengthRef.current = items.length; }, [items.length]);

  useEffect(() => {
    if (selectedSlug || listSlug) feedRequestRef.current += 1;
  }, [selectedSlug, listSlug]);

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

  const loadItems = useCallback(async (
    term = query,
    append = false,
    mode = feedMode,
    locationPoint = userLocation,
    filters = { cuisine: cuisineFilter, rating: minRating, sort: searchSort },
  ) => {
    const requestId = ++feedRequestRef.current;
    const offset = append ? itemsLengthRef.current : 0;
    if (append) setLoadingMore(true);
    else setLoading(true);

    const cleanTerm = sanitizePostgrestSearch(term);
    const useSearchEndpoint = Boolean(cleanTerm || filters.cuisine !== "all" || filters.rating !== "0" || filters.sort !== "relevance");
    const sort = filters.sort === "relevance" ? (mode === "nearby" ? "nearby" : mode === "recent" ? "recent" : "trending") : filters.sort;

    setFeedError(null);
    let result;
    try {
      result = await withTimeout(supabase.functions.invoke(useSearchEndpoint ? "dish-search" : "dish-feed", {
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
      }), 12000, "Feed request");
    } catch (error) {
      if (requestId !== feedRequestRef.current) return;
      const message = error instanceof Error ? error.message : "The feed took too long to respond.";
      setFeedError(message);
      toast({ title: "Feed unavailable", description: message, variant: "destructive" });
      if (!append) setItems([]);
      setHasMoreItems(false);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const { data, error } = result;
    if (requestId !== feedRequestRef.current) return;
    if (error || data?.error) {
      setFeedError(data?.error ?? error?.message ?? "Try again.");
      toast({ title: "Feed unavailable", description: data?.error ?? error?.message ?? "Try again.", variant: "destructive" });
      if (!append) setItems([]);
      setHasMoreItems(false);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const rows = ((data?.items ?? []) as Array<Partial<MenuItem> & Record<string, unknown>>).map((row) => normalizeMenuItem(row, row.trend_metrics as Record<string, unknown> | null));
    setHasMoreItems(Boolean(data?.hasMore));
    if (append) setItems((current) => [...current, ...rows.filter((row) => !current.some((item) => item.id === row.id))]);
    else setItems(rows);
    setLoading(false);
    setLoadingMore(false);
  }, [cuisineFilter, feedMode, minRating, query, searchSort, toast, userLocation]);

  useEffect(() => {
    const nextQuery = searchParams.get("q") ?? "";
    const nextSort = parseSearchSort(searchParams.get("sort"));
    const nextCuisine = searchParams.get("cuisine") ?? "all";
    const nextRating = searchParams.get("rating") ?? "0";
    setQuery(nextQuery);
    setSearchSort(nextSort);
    setCuisineFilter(nextCuisine);
    setMinRating(nextRating);
  }, [searchParams]);

  useEffect(() => {
    if (view !== "discover" || selectedSlug || listSlug) return;
    const handle = window.setTimeout(() => {
      void loadItems(query, false, feedMode, userLocation, { cuisine: cuisineFilter, rating: minRating, sort: searchSort });
    }, 220);
    return () => window.clearTimeout(handle);
  }, [view, selectedSlug, listSlug, query, feedMode, userLocation, cuisineFilter, minRating, searchSort, loadItems]);

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
    if (sessionUser || selectedSlug || listSlug || view !== "discover" || guestFeedPromptShownRef.current || items.length < 4) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting || guestFeedPromptShownRef.current) return;
      guestFeedPromptShownRef.current = true;
      setAuthPrompt("Save dishes you want to try");
      observer.disconnect();
    }, { rootMargin: "120px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [sessionUser, selectedSlug, listSlug, view, items.length]);

  useEffect(() => {
    if (!selectedSlug || selectedItem) return;
    let cancelled = false;
    setLoading(true);
    setFeedError(null);
    withTimeout(
      Promise.resolve(supabase
        .from("dishes")
        .select("*, restaurants(name,address,city,cuisine,latitude,longitude,phone,website_url,email,google_place_id,rating,review_count,price_level,business_status,maps_url,photo_reference)")
        .eq("slug", decodeURIComponent(selectedSlug))
        .eq("is_published", true)
        .maybeSingle()),
      8000,
      "Dish detail",
    ).then(async ({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        setFeedError(error?.message ?? "Dish not found.");
        setLoading(false);
        return;
      }
      const { data: trend } = await (supabase as any).from("dish_trend_metrics").select("trend_score,spike_score,status,is_hot_nearby,recent_share_count,recent_save_count,recent_rating_count").eq("dish_id", data.id).maybeSingle();
      if (!cancelled) setItems((current) => [normalizeMenuItem(data as Record<string, unknown>, trend), ...current.filter((currentItem) => currentItem.slug !== data.slug)]);
    }).catch((error) => {
      if (!cancelled) setFeedError(error instanceof Error ? error.message : "Could not load this dish.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
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
  };

  const applySearchSuggestion = (value: string) => {
    setQuery(value);
    navigate(`/search?q=${encodeURIComponent(value)}`);
  };

  const loadNearbyRestaurants = async (locationPoint: { latitude: number; longitude: number }) => {
    setLoadingNearby(true);
    let result;
    try {
      result = await withTimeout(supabase.functions.invoke("nearby-restaurants", { body: { ...locationPoint, radiusMiles: 50, query } }), 9000, "Nearby restaurants");
    } catch (error) {
      setLoadingNearby(false);
      setNearbyRestaurants([]);
      toast({ title: "Nearby restaurants unavailable", description: error instanceof Error ? error.message : "Try again later.", variant: "destructive" });
      return;
    }
    const { data, error } = result;
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
      void loadNearbyRestaurants(locationPoint);
    },
    () => toast({ title: "Location unavailable", description: "You can still browse by city and restaurant.", variant: "destructive" }),
    { enableHighAccuracy: true, timeout: 8000 },
  );

  const requireAuth = (message: string) => {
    if (!sessionUser) setAuthPrompt(message);
    else toast({ title: "Ready", description: message.replace("Sign in to ", "You can now ") });
  };

  const toggleDishAction = async (item: MenuItem, action: "want_to_try" | "favorite", enabled: boolean) => {
    if (!sessionUser) return setAuthPrompt(`Sign in to ${action === "favorite" ? "favorite" : "save"} dishes.`);
    if (!isUuid(item.id)) return toast({ title: "Seed item", description: "Open or create a real dish before saving it.", variant: "destructive" });
    const { data, error } = await withTimeout(supabase.functions.invoke("dish-interaction", { body: { type: "toggle_action", dishId: item.id, action, enabled } }), 8000, "Save action").catch((error) => ({ data: { error: error instanceof Error ? error.message : "Save timed out." }, error: null }));
    if (error || data?.error) return toast({ title: "Action not saved", description: data?.error ?? error?.message ?? "Try again.", variant: "destructive" });
    if (enabled) {
      const { data: collection } = await (supabase as any).from("collections").upsert({ user_id: sessionUser.id, name: "Saved", slug: "saved", is_public: false, cover_image_url: item.cover_image_url ?? null }, { onConflict: "user_id,slug" }).select("id").single();
      if (collection?.id) await (supabase as any).from("collection_dishes").upsert({ collection_id: collection.id, dish_id: item.id }, { onConflict: "collection_id,dish_id" });
    }
    const flag = action === "favorite" ? "user_favorite" : "user_want_to_try";
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, ...data.dish, [flag]: enabled } : row));
    toast({ title: enabled ? (action === "favorite" ? "Favorited" : "Saved to want to try") : (action === "favorite" ? "Favorite removed" : "Want to try removed"), description: enabled ? "Your dish interaction is stored." : "Your dish interaction was removed." });
    if (enabled) setFavoriteTarget(item);
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

  const chooseReviewPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) { event.target.value = ""; return; }
    try {
      const compatibleFiles = await Promise.all(files.map(convertHeicFile));
      addReviewPhotos(compatibleFiles, compatibleFiles.map((file) => URL.createObjectURL(file)));
    } catch {
      toast({ title: "Photo format not supported", description: "Convert HEIC/HEIF photos to JPEG or choose another image.", variant: "destructive" });
    }
    event.target.value = "";
  };

  const captureReviewPhoto = async () => {
    const [{ Capacitor }, { Camera, CameraResultType, CameraSource }] = await Promise.all([import("@capacitor/core"), import("@capacitor/camera")]);
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
    const [{ Capacitor }, { Camera }] = await Promise.all([import("@capacitor/core"), import("@capacitor/camera")]);
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
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-background pb-28 text-foreground md:pb-8">
      {authPrompt && <Suspense fallback={null}><AuthModal prompt={authPrompt} onClose={() => setAuthPrompt(null)} /></Suspense>}
      {favoriteTarget && <SaveToCollectionModal item={favoriteTarget} sessionUser={sessionUser} onClose={() => setFavoriteTarget(null)} onProtected={requireAuth} />}
      <header className="sticky top-0 z-30 w-full max-w-full border-b border-border/50 bg-background/72 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-3 md:gap-3 md:px-6">
          <a href="/" className="flex min-w-0 flex-1 items-center gap-2 font-display text-lg font-black sm:text-xl md:flex-none"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><ChefHat className="size-5" /></span><span className="truncate">PlateLoop</span></a>
          <form onSubmit={submitSearch} className="relative ml-auto hidden flex-1 md:block md:max-w-xl"><Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-11 rounded-full border-border/70 bg-secondary/70 pl-10 pr-12" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dishes" /><button type="button" onClick={askLocation} className="absolute right-1 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-card hover:text-foreground" aria-label="Use my location"><LocateFixed className="size-4" /></button></form>
          {sessionUser ? <AccountMenu sessionUser={sessionUser} onSignOut={signOut} onSelectView={(nextView) => { setView(nextView); navigate("/"); }} /> : <Button className="shrink-0 rounded-full px-3 sm:px-4" onClick={() => setAuthPrompt("Sign in only when you submit reviews or save favorites, lists, and history.")}><LogIn className="size-4" /><span className="whitespace-nowrap">Sign in</span></Button>}
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-5xl min-w-0 gap-5 px-0 pb-3 pt-0 lg:grid-cols-[180px_minmax(0,1fr)] lg:px-6 lg:py-6">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-2 rounded-3xl glass-surface p-2">{navItems.map((item) => <Button key={item.id} variant={view === item.id ? "default" : "ghost"} className="w-full justify-start rounded-full" onClick={() => { setView(item.id); if (item.id !== "discover") navigate("/"); }}><item.icon />{item.label}</Button>)}</nav>
        </aside>

        <div key={`${view}-${location.pathname}`} className="screen-enter min-w-0 max-w-full space-y-4 overflow-x-hidden px-3 lg:px-0">
          {searchPanelOpen && (
            <div className={cn("z-40 max-w-full rounded-3xl glass-surface p-3 lg:hidden", selectedItem ? "relative w-full" : "fixed inset-x-3 bottom-[88px] max-w-[calc(100vw-1.5rem)]")}>
              <form onSubmit={submitSearch} className="relative"><Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus className="h-12 rounded-full bg-secondary/80 pl-10 pr-24" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dishes" /><button type="button" onClick={askLocation} className="absolute right-12 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-card hover:text-foreground" aria-label="Use my location"><LocateFixed className="size-5" /></button><Button type="submit" size="icon" className="absolute right-1 top-1/2 size-10 -translate-y-1/2 rounded-full" aria-label="Search"><Search className="size-4" /></Button></form>
            </div>
          )}

          {listSlug && <PublicListPage slug={listSlug} userLocation={userLocation} onSave={setFavoriteTarget} />}

          {view === "discover" && !selectedItem && !listSlug && (
            <>
              <section className="relative z-10 -mx-3 mb-3 max-w-[calc(100%+1.5rem)] space-y-3 overflow-hidden border-b border-border/40 bg-background px-3 pb-3 pt-2 backdrop-blur-2xl lg:sticky lg:top-20 lg:mx-0 lg:max-w-full lg:rounded-[28px] lg:border lg:bg-background/72 lg:py-3">
                <form onSubmit={submitSearch} className="relative"><Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" /><Input className="h-14 rounded-full border-foreground/10 bg-secondary/70 pl-12 pr-12 text-lg font-black" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dishes" /><button type="button" onClick={askLocation} className="absolute right-2 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/70 text-muted-foreground" aria-label="Use my location"><LocateFixed className="size-5" /></button></form>
                <div className="flex max-w-full min-w-0 flex-wrap gap-2 overflow-hidden pb-1">{suggestedSearches.map((suggestion) => <button key={suggestion} type="button" onClick={() => applySearchSuggestion(suggestion)} className="soft-chip shrink-0 transition active:scale-95">{suggestion}</button>)}</div>
                <div className="flex max-w-full min-w-0 flex-wrap gap-2 overflow-hidden pb-1">
                  <Select value={searchSort} onValueChange={(value) => setSearchSort(value as SearchSort)}><SelectTrigger className="h-10 min-w-28 rounded-full bg-secondary/70"><SelectValue placeholder="Distance" /></SelectTrigger><SelectContent><SelectItem value="relevance">Best</SelectItem><SelectItem value="nearby">Distance</SelectItem><SelectItem value="trending">Trending</SelectItem><SelectItem value="rating">Rating</SelectItem><SelectItem value="recent">Newest</SelectItem></SelectContent></Select>
                  <Select value={cuisineFilter} onValueChange={setCuisineFilter}><SelectTrigger className="h-10 min-w-28 rounded-full bg-secondary/70"><SelectValue placeholder="Cuisine" /></SelectTrigger><SelectContent><SelectItem value="all">Cuisine</SelectItem><SelectItem value="American">American</SelectItem><SelectItem value="Italian">Italian</SelectItem><SelectItem value="Japanese">Japanese</SelectItem><SelectItem value="Mexican">Mexican</SelectItem><SelectItem value="Thai">Thai</SelectItem><SelectItem value="Dessert">Dessert</SelectItem></SelectContent></Select>
                  <Select value={minRating} onValueChange={setMinRating}><SelectTrigger className="h-10 min-w-24 rounded-full bg-secondary/70"><SelectValue placeholder="Rating" /></SelectTrigger><SelectContent><SelectItem value="0">Any ★</SelectItem><SelectItem value="3.5">3.5★+</SelectItem><SelectItem value="4">4★+</SelectItem><SelectItem value="4.5">4.5★+</SelectItem></SelectContent></Select>
                </div>
              </section>
              {!query && <div className="relative z-0 mt-1 flex max-w-full min-w-0 flex-wrap gap-2 overflow-hidden pb-1">{trendingQueries.map((trend) => <button key={trend} type="button" onClick={() => applySearchSuggestion(trend)} className="soft-chip shrink-0 text-accent"><Sparkles className="size-4" />{trend}</button>)}</div>}
              {!query && <div className="grid grid-cols-3 gap-2 rounded-full glass-surface p-1.5">
                {([{ id: "trending", label: "Hot", icon: Sparkles }, { id: "nearby", label: "Near", icon: MapPin }, { id: "recent", label: "New", icon: Clock }] as const).map((mode) => <Button key={mode.id} variant={feedMode === mode.id ? "default" : "ghost"} className="rounded-full" onClick={() => { if (mode.id === "nearby" && !userLocation) askLocation(); else setFeedMode(mode.id); }}><mode.icon />{mode.label}</Button>)}
              </div>}
              {feedMode === "nearby" && <RestaurantDirectory restaurants={nearbyRestaurants} loading={loadingNearby} />}
              <div className="flex items-center justify-between px-1"><h1 className="font-display text-xl font-black">{query ? query : feedMode === "nearby" ? "Nearby" : feedMode === "recent" ? "New plates" : "Trending"}</h1>{loading && <Loader2 className="animate-spin text-accent" />}</div>
              {loading ? <SearchResultsLoader /> : feedError ? <FeedErrorState message={feedError} onRetry={() => void loadItems(query, false, feedMode, userLocation)} /> : query ? <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3">{displayedItems.length ? displayedItems.map((item) => <SearchDishCard key={item.id} item={item} userLocation={userLocation} onDishAction={toggleDishAction} />) : <div className="col-span-full rounded-3xl border border-dashed bg-card p-6 text-center"><ChefHat className="mx-auto mb-3 size-10 text-accent" /><h2 className="font-display text-2xl font-black">No dishes yet</h2><p className="text-sm text-muted-foreground">Capture the first plate.</p><Button className="mt-4 rounded-full" onClick={() => setView("scan")}><CameraIcon />Add dish</Button></div>}<div ref={loadMoreRef} className="col-span-full flex min-h-20 items-center justify-center rounded-3xl border border-dashed bg-card/55 p-4 text-sm font-bold text-muted-foreground">{loadingMore ? <><Loader2 className="mr-2 size-4 animate-spin text-accent" />Loading…</> : hasMoreItems ? "More dishes loading" : "You’re caught up"}</div></div> : <div className="feed-scroll min-w-0 max-w-full space-y-4 overflow-hidden">{displayedItems.length ? displayedItems.map((item) => <FeedItemCard key={item.id} item={item} userLocation={userLocation} onSave={setFavoriteTarget} onFirstReview={startFirstReview} onDishAction={toggleDishAction} />) : <div className="rounded-3xl border border-dashed bg-card p-6 text-center"><ChefHat className="mx-auto mb-3 size-10 text-accent" /><h2 className="font-display text-2xl font-black">No dishes yet</h2><p className="text-sm text-muted-foreground">Capture the first plate.</p><Button className="mt-4 rounded-full" onClick={() => setView("scan")}><CameraIcon />Add dish</Button></div>}<div ref={loadMoreRef} className="flex min-h-20 items-center justify-center rounded-3xl border border-dashed bg-card/55 p-4 text-sm font-bold text-muted-foreground">{loadingMore ? <><Loader2 className="mr-2 size-4 animate-spin text-accent" />Loading…</> : hasMoreItems ? "Scroll for more" : "You’re caught up"}</div></div>}
            </>
          )}

          {selectedItem && !listSlug && <><ItemDetail item={selectedItem} userLocation={userLocation} sessionUser={sessionUser} onProtected={requireAuth} onSave={setFavoriteTarget} onDishAction={toggleDishAction} onReviewPublished={() => { setReviewRefreshKey((key) => key + 1); void loadItems(query, false, feedMode, userLocation); }} reviewRefreshKey={reviewRefreshKey} />{!sessionUser && !sharedDishNudgeDismissed && <GuestConversionNudge onClose={() => setSharedDishNudgeDismissed(true)} onSignIn={() => setAuthPrompt("Track your favorite meals")} />}</>}

          {view === "scan" && (
            <section className="-mx-3 space-y-3 overflow-hidden md:mx-0">
              <div className="relative min-h-[calc(100svh-164px)] w-full max-w-full overflow-hidden bg-secondary shadow-[var(--shadow-editorial)] ring-1 ring-border/55 md:rounded-[32px]">
                {photoPreviews.length ? <img src={photoPreviews[0]} alt="Captured dish" className="absolute inset-0 h-full w-full object-cover animate-scale-in" decoding="async" /> : <button onClick={captureReviewPhoto} className="absolute inset-0 flex w-full flex-col items-center justify-center gap-6 bg-secondary text-foreground"><span className="flex size-32 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-editorial)] transition active:scale-95"><CameraIcon className="size-14" /></span><span className="soft-chip text-accent"><Sparkles className="size-4" />Point. Snap. Rate.</span></button>}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-background via-background/14 to-background/35" />
                <div className="absolute left-4 top-4 soft-chip text-accent"><CameraIcon className="size-4" />Capture</div>
                {photoPreviews.length > 0 && <div className="absolute right-4 top-4 flex gap-2"><span className="soft-chip text-accent"><Sparkles className="size-4" />AI ready</span><Button type="button" size="icon" variant="secondary" className="size-10 rounded-full bg-background/70 backdrop-blur-xl" onClick={() => removeReviewPhoto(0)} aria-label="Remove photo"><X className="size-4" /></Button></div>}
                <div className="absolute inset-x-0 bottom-0 p-4 pb-6">
                  {photoPreviews.length ? <div className="space-y-3 animate-fade-in"><div className="grid gap-2"><Input className="h-12 rounded-full border-foreground/10 bg-background/72 px-5 text-base font-black backdrop-blur-xl" placeholder="Dish name" value={scanDish} onChange={(event) => setScanDish(event.target.value)} /><Input className="h-12 rounded-full border-foreground/10 bg-background/72 px-5 text-base font-bold backdrop-blur-xl" placeholder="Restaurant optional" value={scanRestaurant} onChange={(event) => setScanRestaurant(event.target.value)} /></div></div> : <div className="flex items-center justify-center gap-3"><Button type="button" variant="outline" className="h-12 rounded-full bg-background/70 px-5 backdrop-blur-xl" onClick={selectPhotos}><Upload />Library</Button><button type="button" onClick={captureReviewPhoto} className="flex size-24 items-center justify-center rounded-full border-4 border-foreground/25 bg-primary text-primary-foreground shadow-[var(--shadow-editorial)] transition active:scale-90" aria-label="Take photo"><CameraIcon className="size-10" /></button></div>}
                </div>
              </div>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={chooseReviewPhotos} />
              <input ref={photoLibraryInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="hidden" onChange={chooseReviewPhotos} />
              {photoPreviews.length > 0 && <div className="sticky bottom-24 z-10 grid grid-cols-2 gap-2 px-3 md:px-0"><Button type="button" className="h-12 rounded-full" onClick={captureReviewPhoto}><CameraIcon />Add photo</Button><Button type="button" className="h-12 rounded-full" variant="outline" onClick={selectPhotos}><Upload />Library</Button></div>}
              {imageFiles.length > 0 && <PhotoReviewComposer imageFiles={imageFiles} photoPreviews={photoPreviews} restaurantName={scanRestaurant} dishName={scanDish} onRestaurantNameChange={setScanRestaurant} onDishNameChange={setScanDish} sessionUser={sessionUser} onProtected={requireAuth} onPublished={resetPhotoReview} />}
            </section>
          )}

          {view === "favorites" && <ShareableLists sessionUser={sessionUser} onProtected={requireAuth} />}
          {view === "profile" && <ProfilePanel sessionUser={sessionUser} userLocation={userLocation} onUseLocation={askLocation} onProtected={requireAuth} />}
        </div>
      </section>

      <nav className="fixed bottom-3 left-3 right-3 z-20 grid min-w-0 grid-cols-5 items-center overflow-hidden rounded-full glass-surface p-1.5 lg:hidden">
        {navItems.slice(0, 2).map((item) => <button key={item.id} onClick={() => { setSearchPanelOpen(false); setView(item.id); if (item.id !== "discover") navigate("/"); }} className={cn("flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[10px] font-bold text-muted-foreground", view === item.id && "bg-primary text-primary-foreground")}><item.icon className="size-5" /><span className="truncate">{item.label}</span></button>)}
        <button onClick={() => setSearchPanelOpen((open) => !open)} className={cn("mx-auto flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[var(--shadow-editorial)] transition active:scale-95 sm:size-14", searchPanelOpen && "bg-primary text-primary-foreground")} aria-label="Open search"><Search className="size-6" /></button>
        {navItems.slice(2).map((item) => <button key={item.id} onClick={() => { setSearchPanelOpen(false); setView(item.id); if (item.id !== "discover") navigate("/"); }} className={cn("flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[10px] font-bold text-muted-foreground", view === item.id && "bg-primary text-primary-foreground")}><item.icon className="size-5" /><span className="truncate">{item.label}</span></button>)}
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

const ItemDetail = ({ item, userLocation, sessionUser, onProtected, onSave, onDishAction, onReviewPublished, reviewRefreshKey }: { item: MenuItem; userLocation: { latitude: number; longitude: number } | null; sessionUser: UserSession; onProtected: (message: string) => void; onSave: (item: MenuItem) => void; onDishAction: (item: MenuItem, action: "want_to_try" | "favorite", enabled: boolean) => void; onReviewPublished: () => void; reviewRefreshKey: number }) => {
  const { toast } = useToast();
  const miles = distanceMiles(userLocation, item.restaurants);
  const callUrl = phoneHref(item.restaurants?.phone);
  const webUrl = websiteHref(item.restaurants?.website_url);
  const mailUrl = emailHref(item.restaurants?.email);
  const shareItem = async () => {
    await shareDishLink(item, "native");
  };
  const copyLink = async () => {
    await shareDishLink(item, "copy_link");
    toast({ title: "Dish link copied" });
  };
  const trendLabels = item.trend_labels ?? [];
  const relatedSearches = [item.cuisine, item.section, ...item.tags].filter(Boolean).slice(0, 5) as string[];
  return (
    <section className="max-w-full space-y-4 overflow-hidden">
      <div className="relative min-h-[calc(100svh-108px)] w-full max-w-full overflow-hidden bg-secondary shadow-[var(--shadow-editorial)] ring-1 ring-border/60 md:min-h-[760px] md:rounded-[32px]">
        <div className="flex h-full max-w-full snap-x snap-mandatory overflow-hidden">
          {[item.cover_image_url].filter(Boolean).map((photo) => <div key={photo} className="image-skeleton h-[calc(100svh-108px)] min-h-[460px] w-full shrink-0 snap-center sm:min-h-[620px] md:h-[760px]"><img src={photo!} alt={`${item.name} menu item`} className="h-full w-full object-cover" loading="eager" decoding="async" fetchPriority="high" sizes="(min-width: 768px) 760px, 100vw" width={900} height={1200} /></div>)}
          {!item.cover_image_url && <div className="flex h-[calc(100svh-108px)] min-h-[460px] w-full shrink-0 snap-center items-center justify-center bg-secondary sm:min-h-[620px] md:h-[760px]"><ChefHat className="size-20 opacity-40" /></div>}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/24 to-background/20" />
        <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-2"><div className="flex min-w-0 flex-wrap gap-2">{trendLabels.length ? trendLabels.map((label) => <span key={label} className="soft-chip text-accent"><Sparkles className="size-4" />{label}</span>) : <span className="soft-chip">{item.cuisine || item.section || "Dish"}</span>}</div><div className="flex shrink-0 gap-2"><Button size="icon" variant="secondary" className="size-11 rounded-full bg-background/70 backdrop-blur-xl" onClick={copyLink} aria-label="Copy dish link"><Copy className="size-5" /></Button><Button size="icon" variant="secondary" className="size-11 rounded-full bg-background/70 backdrop-blur-xl" onClick={shareItem} aria-label="Share dish"><Share2 className="size-5" /></Button></div></div>
        <div className="absolute inset-x-0 bottom-0 space-y-4 p-4 pb-28 md:p-7 lg:pb-7">
          <div className="min-w-0"><h1 className="break-words font-display text-4xl font-black leading-[0.92] sm:text-5xl md:text-7xl">{item.name}</h1>{item.description && <p className="mt-2 line-clamp-2 max-w-2xl text-sm font-semibold text-foreground/75">{item.description}</p>}</div>
          <div className="flex min-w-0 flex-wrap items-end justify-between gap-3"><div className="min-w-0"><p className="font-display text-4xl font-black text-accent sm:text-5xl">{item.aggregate_rating.toFixed(1)}<span className="text-2xl">★</span></p><p className="text-xs font-bold text-foreground/70">{item.review_count} reviews · {formatPrice(item)}</p></div><div className="flex gap-2"><button type="button" className={cn("thumb-action save-pop", item.user_favorite && "bg-primary text-primary-foreground animate-scale-in")} onClick={() => onDishAction(item, "favorite", !item.user_favorite)} aria-label="Save dish"><Heart className={cn("size-5", item.user_favorite && "fill-current")} /></button><button type="button" className={cn("thumb-action save-pop", item.user_want_to_try && "bg-accent text-accent-foreground animate-scale-in")} onClick={() => onDishAction(item, "want_to_try", !item.user_want_to_try)} aria-label="Want to try"><Bookmark className={cn("size-5", item.user_want_to_try && "fill-current")} /></button></div></div>
          <Button className="h-12 w-full rounded-full" onClick={() => document.getElementById("review-menu-item")?.scrollIntoView({ behavior: "smooth", block: "start" })}><Star />Rate this dish</Button>
          {!sessionUser && <Button className="h-11 w-full rounded-full" variant="secondary" onClick={() => onProtected("Save dishes you want to try") }><Bookmark />Save for later</Button>}
        </div>
      </div>
      <div className="max-w-full space-y-4"><div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-4"><ReviewForm item={item} sessionUser={sessionUser} onProtected={onProtected} onPublished={onReviewPublished} /><ReviewFeed item={item} refreshKey={reviewRefreshKey} /></div><div className="space-y-4"><RelatedDishes tags={relatedSearches} currentName={item.name} /><div className="rounded-3xl glass-surface p-4"><h2 className="font-display text-2xl font-black">Place</h2><p className="mt-2 font-bold">{item.restaurants?.name}</p><p className="text-sm text-muted-foreground">{[item.restaurants?.address, item.restaurants?.city, miles ? `${miles.toFixed(1)} mi` : null].filter(Boolean).join(" · ")}</p><div className="mt-3 grid gap-2"><Button className="w-full rounded-full" asChild><a href={mapsDirectionsUrl(item.restaurants, "driving")} target="_blank" rel="noreferrer"><Navigation />Drive</a></Button><Button className="w-full rounded-full" variant="outline" asChild><a href={mapsDirectionsUrl(item.restaurants, "walking")} target="_blank" rel="noreferrer"><Footprints />Walk</a></Button>{callUrl && <Button className="w-full rounded-full" variant="outline" asChild><a href={callUrl}><Phone />Call</a></Button>}{webUrl && <Button className="w-full rounded-full" variant="outline" asChild><a href={webUrl} target="_blank" rel="noreferrer"><Globe />Website</a></Button>}{mailUrl && <Button className="w-full rounded-full" variant="outline" asChild><a href={mailUrl}><Mail />Email</a></Button>}</div></div></div></div></div>
    </section>
  );
};

const Metric = ({ icon: Icon, label, value }: { icon: typeof Star; label: string; value: string }) => <div className="rounded-2xl bg-secondary/80 p-3"><Icon className="mb-2 size-5 text-accent" /><p className="font-display text-xl font-black">{value}</p><p className="text-[11px] font-bold text-muted-foreground">{label}</p></div>;

const RelatedDishes = ({ tags, currentName }: { tags: string[]; currentName: string }) => {
  const suggestions = tags.length ? tags : [currentName];
  return <section className="max-w-full overflow-hidden rounded-3xl glass-surface p-4"><h2 className="font-display text-2xl font-black">You might also like</h2><div className="mt-3 grid w-full max-w-full min-w-0 grid-cols-1 gap-2 lg:grid-cols-1">{suggestions.map((tag) => <a key={tag} href={`/search?q=${encodeURIComponent(tag)}`} className="block w-full min-w-0 max-w-full overflow-hidden rounded-2xl bg-secondary/70 p-3 transition active:scale-95"><p className="text-sm font-black line-clamp-1">{tag}</p><p className="mt-1 text-xs font-bold text-muted-foreground">Explore dishes</p></a>)}</div></section>;
};

const GuestConversionNudge = ({ onClose, onSignIn }: { onClose: () => void; onSignIn: () => void }) => <div className="fixed inset-x-3 bottom-20 z-20 mx-auto max-w-md rounded-lg border bg-card p-4 shadow-[var(--shadow-editorial)] lg:bottom-6"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-display text-xl font-black">Keep this dish handy</p><p className="mt-1 text-sm font-bold text-muted-foreground">Save dishes you want to try and track your favorite meals.</p></div><Button size="icon" variant="ghost" className="shrink-0" onClick={onClose} aria-label="Dismiss"><X className="size-4" /></Button></div><div className="mt-3 flex gap-2"><Button className="flex-1 rounded-full" onClick={onSignIn}><Bookmark className="size-4" />Save later</Button><Button variant="outline" className="rounded-full" onClick={onClose}>Not now</Button></div></div>;

const FeedErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => <section className="rounded-3xl border border-dashed bg-card p-6 text-center"><ChefHat className="mx-auto mb-3 size-10 text-accent" /><h2 className="font-display text-2xl font-black">Could not load dishes</h2><p className="mt-1 text-sm font-semibold text-muted-foreground">{message}</p><Button className="mt-4 rounded-full" onClick={onRetry}>Retry</Button></section>;

const SearchResultsLoader = () => <div className="space-y-5" aria-label="Loading search results" aria-live="polite">{[0, 1].map((item) => <div key={item} className="overflow-hidden rounded-[28px] bg-card shadow-[var(--shadow-soft)] ring-1 ring-border/60"><div className="h-[74vh] min-h-96 animate-pulse bg-secondary" /><div className="flex gap-2 p-3"><span className="h-10 w-24 animate-pulse rounded-full bg-primary/30" /><span className="h-10 w-28 animate-pulse rounded-full bg-muted" /></div></div>)}</div>;


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
    <div className="flex touch-pan-x justify-between gap-1" aria-label={`Rating: ${value} out of 5 stars`} onKeyDown={nudgeRating}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fillPercent = value >= star ? 100 : value >= star - 0.5 ? 50 : 0;
        return (
          <button
            key={star}
            type="button"
            onClick={(event) => chooseRating(star, event)}
            className={cn(
              "group relative rounded-2xl p-1.5 transition duration-200 active:scale-125 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              fillPercent ? "text-accent drop-shadow-sm" : "text-muted-foreground/35 hover:text-primary",
            )}
            aria-label={`${star - 0.5} or ${star} stars`}
            aria-pressed={fillPercent > 0}
          >
            <span className="relative block size-10">
              <Star className="absolute inset-0 size-10 transition-colors duration-200" />
              <span className="absolute inset-0 overflow-hidden transition-all duration-200 ease-out" style={{ width: `${fillPercent}%` }}>
                <Star className="size-10 fill-current text-accent transition-transform duration-200 group-active:scale-125 group-hover:scale-110" />
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

const QuickScale = ({ label, low, high, value, onChange, min = 1 }: { label: string; low: string; high: string; value: number; onChange: (value: number) => void; min?: number }) => <label className="block rounded-2xl bg-secondary/70 p-3"><div className="mb-2 flex items-center justify-between gap-3"><span className="text-sm font-black">{label}</span><span className={cn("rounded-full px-2 py-1 text-xs font-black", value >= 4 ? "bg-destructive text-destructive-foreground" : value >= 3 ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground")}>{value}</span></div><input className="w-full accent-primary" type="range" min={min} max="5" step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} /><div className="mt-1 flex justify-between text-xs font-bold"><span className="text-accent">{low}</span><span className="text-destructive">{high}</span></div></label>;

const EmotionalRating = ({ value, onChange, loved, onLovedChange, wantToTry, onWantToTryChange }: { value: number; onChange: (value: number) => void; loved: boolean; onLovedChange: (value: boolean) => void; wantToTry: boolean; onWantToTryChange: (value: boolean) => void }) => {
  const moods = [{ score: 2, emoji: "🙂", label: "Okay" }, { score: 3.5, emoji: "😋", label: "Good" }, { score: 4.5, emoji: "🤤", label: "Crave" }, { score: 5, emoji: "🔥", label: "Elite" }];
  return <div className="w-full max-w-full min-w-0 space-y-3 overflow-hidden"><div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">{moods.map((mood) => <button key={mood.label} type="button" onClick={() => onChange(mood.score)} className={cn("group flex min-h-20 min-w-0 flex-col items-center justify-center rounded-[26px] border bg-secondary/70 p-2 text-center shadow-[var(--shadow-soft)] transition active:scale-95 sm:min-h-24", value === mood.score ? "border-accent bg-accent text-accent-foreground" : "border-foreground/10 hover:border-primary/60 hover:bg-secondary")} aria-pressed={value === mood.score}><span className="text-3xl transition group-active:scale-125">{mood.emoji}</span><span className="mt-2 text-xs font-black">{mood.label}</span></button>)}</div><div className="grid min-w-0 grid-cols-2 gap-2"><button type="button" onClick={() => { onLovedChange(!loved); if (!loved) onChange(5); }} className={cn("flex h-14 min-w-0 items-center justify-center gap-2 rounded-full border px-2 text-sm font-black transition active:scale-95", loved ? "border-primary bg-primary text-primary-foreground" : "border-foreground/10 bg-secondary/70 text-foreground")}><Heart className={cn("size-5 shrink-0", loved && "fill-current")} /><span className="truncate">Loved it</span></button><button type="button" onClick={() => onWantToTryChange(!wantToTry)} className={cn("flex h-14 min-w-0 items-center justify-center gap-2 rounded-full border px-2 text-sm font-black transition active:scale-95", wantToTry ? "border-accent bg-accent text-accent-foreground" : "border-foreground/10 bg-secondary/70 text-foreground")}><Bookmark className={cn("size-5 shrink-0", wantToTry && "fill-current")} /><span className="truncate">Want to try</span></button></div><div className="flex max-w-full items-center justify-center gap-1 overflow-hidden text-accent" aria-hidden="true">{[1, 2, 3, 4, 5].map((star) => <Star key={star} className={cn("size-5 shrink-0 transition sm:size-6", value >= star ? "fill-current scale-110" : "opacity-25")} />)}</div></div>;
};

const PhotoReviewComposer = ({ imageFiles, photoPreviews, restaurantName, dishName, onRestaurantNameChange, onDishNameChange, sessionUser, onProtected, onPublished }: { imageFiles: File[]; photoPreviews: string[]; restaurantName: string; dishName: string; onRestaurantNameChange: (value: string) => void; onDishNameChange: (value: string) => void; sessionUser: UserSession; onProtected: (message: string) => void; onPublished: () => void }) => {
  const { toast } = useToast();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [pricePaid, setPricePaid] = useState("");
  const [tags, setTags] = useState("");
  const [wouldOrderAgain, setWouldOrderAgain] = useState(true);
  const [wantToTry, setWantToTry] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
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
    const { data, error } = await withTimeout(supabase.functions.invoke("capture-dish", { body: { dishName: parsed.data.dish_name, restaurantName: parsed.data.restaurant_name || null, images, rating: parsed.data.rating, review: parsed.data.review || null, pricePaid: parsed.data.price_paid ?? null, tags: cleanTags, metrics: { wouldOrderAgain: parsed.data.would_order_again, temperature: parsed.data.temperature_rating, spiciness: parsed.data.spiciness_rating, sweetSavory: parsed.data.sweet_savory_rating, flavorIntensity: parsed.data.flavor_intensity_rating } } }), 18000, "Dish capture").catch((error) => ({ data: { error: error instanceof Error ? error.message : "Dish capture timed out." }, error: null }));
    setSaving(false);
    if (error || data?.error) return toast({ title: "Dish not saved", description: data?.error ?? error?.message ?? "Try again.", variant: "destructive" });
    const aiSuggestion = data?.aiSuggestion;
    toast({ title: aiSuggestion?.dishName ? `AI suggests: ${aiSuggestion.dishName}` : "Dish saved", description: aiSuggestion?.status === "completed" ? `Tags: ${(aiSuggestion.tags ?? []).join(", ") || "none"}` : aiSuggestion?.error ?? "Your photo, dish, rating, and review are stored." });
    setReview(""); setPricePaid(""); setTags(""); onPublished();
  };

  return <form id="photo-review-form" onSubmit={publishPhotoReview} className="space-y-3 px-3 animate-fade-in md:px-0"><div className="rounded-[28px] glass-surface p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="soft-chip text-accent"><Sparkles className="size-4" />AI suggestions</p><h2 className="mt-2 font-display text-3xl font-black leading-none">How was it?</h2></div><span className="rounded-full bg-primary px-3 py-1 text-sm font-black text-primary-foreground">{rating}★</span></div><EmotionalRating value={rating} onChange={setRating} loved={wouldOrderAgain} onLovedChange={setWouldOrderAgain} wantToTry={wantToTry} onWantToTryChange={setWantToTry} /></div><div className="grid gap-2 rounded-[28px] glass-surface p-3 md:grid-cols-2"><Input className="h-12 rounded-full bg-secondary/80 px-5 font-black" value={dishName} onChange={(event) => onDishNameChange(event.target.value)} maxLength={120} placeholder="Dish name" required /><Input className="h-12 rounded-full bg-secondary/80 px-5 font-bold" value={restaurantName} onChange={(event) => onRestaurantNameChange(event.target.value)} maxLength={120} placeholder="Restaurant optional" /></div><button type="button" onClick={() => setDetailsOpen((open) => !open)} className="mx-auto flex h-11 items-center justify-center rounded-full bg-secondary/80 px-5 text-sm font-black transition active:scale-95">{detailsOpen ? "Hide details" : "Add details"}</button>{detailsOpen && <div className="space-y-2 animate-fade-in"><div className="grid gap-2 px-3 md:grid-cols-2 md:px-0"><QuickScale label="Temp" low="cold" high="hot" value={temperature} onChange={setTemperature} /><QuickScale label="Spice" low="none" high="fire" value={spiciness} onChange={setSpiciness} min={0} /><QuickScale label="Sweet ↔ savory" low="sweet" high="savory" value={sweetSavory} onChange={setSweetSavory} /><QuickScale label="Flavor" low="subtle" high="bold" value={flavorIntensity} onChange={setFlavorIntensity} /></div><div className="space-y-2 px-3 md:px-0"><Input className="h-12 rounded-full bg-secondary/80 px-5" type="number" min="0" max="10000" step="0.01" value={pricePaid} onChange={(event) => setPricePaid(event.target.value)} placeholder="Price optional" /><Textarea className="min-h-20 rounded-3xl bg-secondary/80" value={review} onChange={(event) => setReview(event.target.value)} maxLength={1200} placeholder="Optional note" /><Input className="h-12 rounded-full bg-secondary/80" value={tags} onChange={(event) => setTags(event.target.value)} maxLength={140} placeholder="Tags: crispy, spicy" /></div></div>}<Button type="submit" className="sticky bottom-24 z-10 h-14 w-full rounded-full text-base shadow-[var(--shadow-editorial)]" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Sparkles />}Save dish</Button></form>;
};

const ReviewForm = ({ item, sessionUser, onProtected, onPublished }: { item: MenuItem; sessionUser: UserSession; onProtected: (message: string) => void; onPublished: () => void }) => {
  const { toast } = useToast();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [pricePaid, setPricePaid] = useState("");
  const [tags, setTags] = useState("");
  const [wouldOrderAgain, setWouldOrderAgain] = useState(true);
  const [wantToTry, setWantToTry] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
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
    const { data, error } = await withTimeout(supabase.functions.invoke("dish-interaction", { body: { type: "rate", dishId: item.id, rating: parsed.data.rating, review: parsed.data.review || null, pricePaid: parsed.data.price_paid ?? null, tags: cleanTags, metrics: { wouldOrderAgain: parsed.data.would_order_again, temperature: parsed.data.temperature_rating, spiciness: parsed.data.spiciness_rating, sweetSavory: parsed.data.sweet_savory_rating, flavorIntensity: parsed.data.flavor_intensity_rating } } }), 10000, "Review submit").catch((error) => ({ data: { error: error instanceof Error ? error.message : "Review submit timed out." }, error: null }));
    setSaving(false);
    if (error || data?.error) return toast({ title: "Review not published", description: data?.error ?? error?.message ?? "Try again.", variant: "destructive" });
    toast({ title: "Review published", description: "Your item rating is now public for food discovery." });
    setReview("");
    setPricePaid("");
    setTags("");
    onPublished();
  };

  return <section id="review-menu-item" className="max-w-full overflow-hidden rounded-3xl glass-surface p-4"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-display text-3xl font-black">Rate it</h2><span className="rounded-full bg-primary px-3 py-1 text-sm font-black text-primary-foreground">{rating}★</span></div><form onSubmit={publishReview} className="space-y-4"><EmotionalRating value={rating} onChange={setRating} loved={wouldOrderAgain} onLovedChange={setWouldOrderAgain} wantToTry={wantToTry} onWantToTryChange={setWantToTry} /><button type="button" onClick={() => setDetailsOpen((open) => !open)} className="mx-auto flex h-11 items-center justify-center rounded-full bg-secondary/80 px-5 text-sm font-black transition active:scale-95">{detailsOpen ? "Hide details" : "Add details"}</button>{detailsOpen && <div className="space-y-3 animate-fade-in"><div className="grid gap-3 md:grid-cols-2"><QuickScale label="Temp" low="cold" high="hot" value={temperature} onChange={setTemperature} /><QuickScale label="Spice" low="none" high="fire" value={spiciness} onChange={setSpiciness} min={0} /><QuickScale label="Sweet ↔ savory" low="sweet" high="savory" value={sweetSavory} onChange={setSweetSavory} /><QuickScale label="Flavor" low="subtle" high="bold" value={flavorIntensity} onChange={setFlavorIntensity} /></div><Input className="h-12 rounded-full bg-secondary/80" type="number" min="0" max="10000" step="0.01" value={pricePaid} onChange={(event) => setPricePaid(event.target.value)} placeholder="Price optional" /><Textarea className="rounded-2xl bg-secondary/80" value={review} onChange={(event) => setReview(event.target.value)} maxLength={1200} placeholder={`Optional note about ${item.name}`} /><Input className="h-12 rounded-full bg-secondary/80" value={tags} onChange={(event) => setTags(event.target.value)} maxLength={140} placeholder="Tags: crispy, spicy" /></div>}<Button type="submit" className="h-12 rounded-full" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Star />}Submit</Button></form></section>;
};

const ReviewFeed = ({ item, refreshKey }: { item: MenuItem; refreshKey: number }) => {
  const [reviews, setReviews] = useState<MenuItemReview[]>([]);
  useEffect(() => {
    if (!isUuid(item.id)) { setReviews([]); return; }
    supabase.from("reviews").select("id,body,price_paid,currency,created_at,ratings(rating,would_order_again,temperature_rating,spiciness_rating,sweet_savory_rating,flavor_intensity_rating)").eq("dish_id", item.id).eq("is_public", true).order("created_at", { ascending: false }).limit(20).then(({ data }) => setReviews(((data ?? []) as ReviewFeedRow[]).map((row) => ({ id: row.id, rating: row.ratings?.rating ?? 0, review: row.body, price_paid: row.price_paid, currency: row.currency, tags: [], would_order_again: row.ratings?.would_order_again, temperature_rating: row.ratings?.temperature_rating, spiciness_rating: row.ratings?.spiciness_rating, sweet_savory_rating: row.ratings?.sweet_savory_rating, flavor_intensity_rating: row.ratings?.flavor_intensity_rating, created_at: row.created_at }))));
  }, [item.id, refreshKey]);
  const rows = reviews;
  return <section className="max-w-full space-y-3 overflow-hidden rounded-3xl glass-surface p-4"><h2 className="font-display text-3xl font-black">Reviews</h2>{rows.length ? rows.map((review) => <article key={review.id} className="max-w-full overflow-hidden rounded-2xl bg-secondary/55 p-3"><p className="font-bold"><span className="text-accent">{"★".repeat(Math.round(review.rating))}</span> {review.would_order_again ? "· would order again" : ""}</p>{review.price_paid ? <p className="text-xs font-bold text-accent">Paid ${review.price_paid} {review.currency}</p> : null}<div className="mt-2 grid min-w-0 grid-cols-1 gap-2 text-xs font-bold text-muted-foreground sm:grid-cols-2 md:grid-cols-4"><span className="min-w-0 truncate">Temp {review.temperature_rating ?? "—"}/5</span><span className="min-w-0 truncate">Spice {review.spiciness_rating ?? "—"}/5</span><span className="min-w-0 truncate">Sweet {review.sweet_savory_rating ?? "—"}/5</span><span className="min-w-0 truncate">Flavor {review.flavor_intensity_rating ?? "—"}/5</span></div>{review.review && <p className="mt-2 text-sm text-muted-foreground">{review.review}</p>}</article>) : <p className="text-sm font-semibold text-muted-foreground">No reviews yet.</p>}</section>;
};

const SaveToCollectionModal = ({ item, sessionUser, onClose, onProtected }: { item: MenuItem; sessionUser: UserSession; onClose: () => void; onProtected: (message: string) => void }) => {
  const { toast } = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionUser) return;
    (supabase as any).from("collections").select("id,name,description,slug,is_public,cover_image_url").eq("user_id", sessionUser.id).order("updated_at", { ascending: false }).limit(20).then(({ data }: { data: Collection[] | null }) => setCollections(data ?? []));
  }, [sessionUser]);

  const addToCollection = async (collection: Collection) => {
    if (!sessionUser) return onProtected("Sign in to save dishes to collections.");
    if (!isUuid(item.id)) return toast({ title: "Demo item", description: "Open a saved dish before adding it to a collection.", variant: "destructive" });
    const { error } = await (supabase as any).from("collection_dishes").upsert({ collection_id: collection.id, dish_id: item.id }, { onConflict: "collection_id,dish_id" });
    if (error) toast({ title: "Could not save dish", description: error.message, variant: "destructive" });
    else { toast({ title: "Saved to collection", description: collection.name }); onClose(); }
  };

  const createCollection = async (event: FormEvent) => {
    event.preventDefault();
    if (!sessionUser) return onProtected("Sign in to create collections.");
    if (!isUuid(item.id)) return toast({ title: "Demo item", description: "Open a saved dish before creating a collection.", variant: "destructive" });
    const parsed = collectionSchema.safeParse({ name, description, is_public: isPublic });
    if (!parsed.success) return toast({ title: "Check your collection", description: parsed.error.issues[0]?.message, variant: "destructive" });
    setLoading(true);
    const slug = `${slugify(parsed.data.name)}-${Date.now()}`;
    const { data: collection, error } = await (supabase as any).from("collections").insert({ name: parsed.data.name, description: parsed.data.description || null, slug, is_public: parsed.data.is_public, cover_image_url: item.cover_image_url ?? null, user_id: sessionUser.id }).select("id,name,description,slug,is_public,cover_image_url").single();
    if (!error && collection) await (supabase as any).from("collection_dishes").upsert({ collection_id: collection.id, dish_id: item.id }, { onConflict: "collection_id,dish_id" });
    setLoading(false);
    if (error) return toast({ title: "Collection not created", description: error.message, variant: "destructive" });
    toast({ title: "Collection created", description: `Saved to ${parsed.data.name}.` });
    onClose();
  };

  if (!sessionUser) { onProtected("Sign in to save dishes to collections."); onClose(); return null; }
  return <div className="fixed inset-0 z-50 flex items-end overflow-x-hidden bg-foreground/30 p-3 backdrop-blur-sm md:items-center md:justify-center"><div className="max-h-[calc(100svh-1.5rem)] w-full max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-lg border bg-card p-5 shadow-[var(--shadow-editorial)] md:max-w-lg"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-accent">Saved</p><h2 className="font-display text-3xl font-black">Add to collection</h2></div><Button size="icon" variant="ghost" onClick={onClose} aria-label="Close"><X /></Button></div><div className="space-y-2">{collections.map((collection) => <Button key={collection.id} className="w-full justify-between" variant="outline" onClick={() => addToCollection(collection)}><span className="truncate">{collection.name}</span><span className="text-xs">{collection.is_public ? "Public" : "Private"}</span></Button>)}</div><form onSubmit={createCollection} className="mt-4 space-y-3 border-t pt-4"><Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="New collection" /><Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} placeholder="Description optional" /><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />Public collection</label><Button disabled={loading || !name.trim()} className="w-full">{loading ? <Loader2 className="animate-spin" /> : <Plus />}Create and add</Button></form></div></div>;
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
  return <section className="space-y-5"><div className="rounded-lg border bg-card p-5 shadow-[var(--shadow-editorial)]"><p className="text-sm font-black text-accent">{list.is_public ? "Public food list" : "Private food list"}</p><h1 className="break-words font-display text-4xl font-black leading-none sm:text-5xl">{list.title}</h1>{list.description && <p className="mt-3 text-muted-foreground">{list.description}</p>}<Button className="mt-4" variant="outline" onClick={() => navigator.share?.({ title: list.title, url: listUrl(list.slug) }) ?? navigator.clipboard.writeText(listUrl(list.slug))}><Share2 />Share list</Button></div><div className="space-y-4">{list.items.map((item) => <ItemCard key={item.id} item={item} userLocation={userLocation} onSave={onSave} />)}</div></section>;
};

const ShareableLists = ({ sessionUser, onProtected }: { sessionUser: UserSession; onProtected: (message: string) => void }) => {
  const [lists, setLists] = useState<FavoriteList[]>([]);
  const [editing, setEditing] = useState<FavoriteList | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  useEffect(() => {
    if (!sessionUser) return;
    supabase.from("favorite_lists").select("id,title,description,slug,is_public,cover_image_url,favorite_list_items(id)").eq("user_id", sessionUser.id).order("updated_at", { ascending: false }).then(({ data }) => setLists(((data ?? []) as (FavoriteList & { favorite_list_items?: { id: string }[] })[]).map((list) => ({ ...list, item_count: list.favorite_list_items?.length ?? 0 }))));
  }, [sessionUser]);
  const startEdit = (list?: FavoriteList) => { setEditing(list ?? { id: "", title: "", description: "", slug: "", is_public: true }); setTitle(list?.title ?? ""); setDescription(list?.description ?? ""); setIsPublic(list?.is_public ?? true); };
  const saveCollection = async (event: FormEvent) => { event.preventDefault(); if (!sessionUser || !editing) return; const parsed = listSchema.safeParse({ title, description, is_public: isPublic }); if (!parsed.success) return; const payload = { title: parsed.data.title, description: parsed.data.description || null, is_public: parsed.data.is_public, user_id: sessionUser.id }; const result = editing.id ? await supabase.from("favorite_lists").update(payload).eq("id", editing.id).select("id,title,description,slug,is_public,cover_image_url").single() : await supabase.from("favorite_lists").insert({ ...payload, slug: `${slugify(parsed.data.title)}-${Date.now()}` }).select("id,title,description,slug,is_public,cover_image_url").single(); if (!result.error && result.data) { setLists((current) => editing.id ? current.map((list) => list.id === editing.id ? { ...list, ...result.data } : list) : [{ ...(result.data as FavoriteList), item_count: 0 }, ...current]); setEditing(null); } };
  if (!sessionUser) return <section className="rounded-lg border bg-card p-5 shadow-[var(--shadow-soft)]"><h1 className="font-display text-4xl font-black">Shareable food lists</h1><p className="mt-2 text-muted-foreground">Save individual dishes into public or private lists.</p><Button className="mt-4" onClick={() => onProtected("Sign in to create and share favorites lists.")}><LogIn />Sign in to save lists</Button></section>;
  return <section className="max-w-full overflow-hidden rounded-lg border bg-card p-5 shadow-[var(--shadow-soft)]"><div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div><h1 className="font-display text-4xl font-black">Collections</h1><p className="mt-2 text-muted-foreground">Organize saved dishes into simple visual collections.</p></div><Button className="rounded-full" onClick={() => startEdit()}><Plus />New</Button></div><div className="mt-4 grid min-w-0 gap-3 md:grid-cols-3">{lists.map((list) => <div key={list.id} className="overflow-hidden rounded-[26px] border bg-background shadow-[var(--shadow-soft)]"><div className="relative aspect-[4/3] bg-secondary">{list.cover_image_url ? <img src={list.cover_image_url} alt={list.title} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center"><Bookmark className="size-12 opacity-40" /></div>}<span className="absolute left-3 top-3 soft-chip text-accent">{list.item_count ?? 0} dishes</span></div><div className="p-4"><h2 className="font-display text-xl font-black">{list.title}</h2><p className="mt-1 text-xs font-bold text-accent">{list.is_public ? "Public" : "Private"}</p><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{list.description || "Saved dishes, prices, ratings, and directions."}</p><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => startEdit(list)}>Edit</Button>{list.is_public && <Button size="sm" variant="outline" asChild><a href={`/lists/${list.slug}`}><Share2 />Open</a></Button>}</div></div></div>)}</div>{editing && <div className="fixed inset-0 z-50 flex items-end overflow-x-hidden bg-foreground/30 p-3 backdrop-blur-sm md:items-center md:justify-center"><form onSubmit={saveCollection} className="max-h-[calc(100svh-1.5rem)] w-full max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-lg border bg-card p-5 shadow-[var(--shadow-editorial)] md:max-w-lg"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-accent">Collection</p><h2 className="font-display text-3xl font-black">{editing.id ? "Edit collection" : "New collection"}</h2></div><Button type="button" size="icon" variant="ghost" onClick={() => setEditing(null)} aria-label="Close"><X /></Button></div><div className="space-y-3"><Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="NYC spots" /><Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} placeholder="Short note" /><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />Public shareable collection</label><Button className="w-full">Save collection</Button></div></form></div>}</section>;
};

type DashboardDish = Pick<MenuItem, "id" | "name" | "slug" | "cuisine" | "section" | "aggregate_rating" | "review_count" | "cover_image_url"> & { restaurant_id?: string | null; restaurant_name?: string | null; user_rating?: number | null; saved_at?: string | null };
type WantToTryDish = MenuItem & { saved_at?: string | null; distance_miles?: number | null; location_group: string; plan_group: "Near you now" | "Plan to visit" | "Nearby" | "Saved for later" };
type SavedActionRow = { dish_id: string; action_type: string; updated_at?: string | null; created_at?: string | null };
type RatingActionRow = { dish_id: string; rating: number; updated_at?: string | null; created_at?: string | null };

const DashboardDishGrid = ({ title, dishes, empty }: { title: string; dishes: DashboardDish[]; empty: string }) => <section className="max-w-full overflow-hidden rounded-[28px] glass-surface p-4"><div className="mb-3 flex min-w-0 items-center justify-between gap-3"><h2 className="min-w-0 truncate font-display text-2xl font-black">{title}</h2><span className="soft-chip">{dishes.length}</span></div>{dishes.length ? <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3">{dishes.slice(0, 6).map((dish) => <a key={`${title}-${dish.id}`} href={`/dish/${dish.slug}`} className="group min-w-0 overflow-hidden rounded-3xl bg-secondary/70 shadow-[var(--shadow-soft)] ring-1 ring-border/50 transition active:scale-[0.98]"><div className="relative aspect-[4/5] overflow-hidden bg-secondary">{dish.cover_image_url ? <img src={dish.cover_image_url} alt={dish.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" decoding="async" sizes="(min-width: 768px) 33vw, 50vw" /> : <div className="flex h-full items-center justify-center"><ChefHat className="size-10 opacity-40" /></div>}<div className="absolute inset-0 bg-gradient-to-t from-background/86 via-transparent to-transparent" /><span className="absolute left-2 top-2 soft-chip text-accent"><Star className="size-3 fill-current" />{(dish.user_rating ?? dish.aggregate_rating ?? 0).toFixed(1)}</span><div className="absolute inset-x-0 bottom-0 p-3"><p className="line-clamp-2 font-display text-xl font-black leading-none">{dish.name}</p><p className="mt-1 line-clamp-1 text-xs font-bold text-foreground/70">{dish.restaurant_name || dish.cuisine || dish.section || "Dish"}</p></div></div></a>)}</div> : <p className="rounded-3xl bg-secondary/60 p-4 text-sm font-bold text-muted-foreground">{empty}</p>}</section>;

const CollectionGrid = ({ collections }: { collections: CollectionPreview[] }) => <section className="max-w-full overflow-hidden rounded-[28px] glass-surface p-4"><div className="mb-3 flex min-w-0 items-center justify-between gap-3"><h2 className="min-w-0 truncate font-display text-2xl font-black">Collections</h2><span className="soft-chip">{collections.length}</span></div>{collections.length ? <div className="grid min-w-0 gap-3 md:grid-cols-2">{collections.map((collection) => <article key={collection.id} className="min-w-0 overflow-hidden rounded-3xl bg-secondary/65 p-3 ring-1 ring-border/50"><div className="grid aspect-[5/3] grid-cols-3 gap-1 overflow-hidden rounded-2xl bg-secondary">{collection.dishes.slice(0, 3).map((dish) => <a key={dish.id} href={`/dish/${dish.slug}`} className="min-w-0 overflow-hidden bg-background/40">{dish.cover_image_url ? <img src={dish.cover_image_url} alt={dish.name} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : <div className="flex h-full items-center justify-center"><ChefHat className="size-6 opacity-40" /></div>}</a>)}{!collection.dishes.length && <div className="col-span-3 flex h-full items-center justify-center"><Bookmark className="size-10 opacity-40" /></div>}</div><div className="mt-3 flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-display text-xl font-black">{collection.name}</h3><p className="mt-1 text-xs font-bold text-accent">{collection.item_count ?? collection.dishes.length} dishes · {collection.is_public ? "Public" : "Private"}</p></div></div>{collection.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{collection.description}</p>}</article>)}</div> : <p className="rounded-3xl bg-secondary/60 p-4 text-sm font-bold text-muted-foreground">Saved dishes land in Saved. Create collections like NYC spots, Best desserts, or Date night.</p>}</section>;

const WantToTryPlanner = ({ dishes, hasLocation, onUseLocation }: { dishes: WantToTryDish[]; hasLocation: boolean; onUseLocation: () => void }) => {
  const groups = useMemo(() => Array.from(dishes.reduce<Map<string, WantToTryDish[]>>((map, dish) => map.set(dish.location_group, [...(map.get(dish.location_group) ?? []), dish]), new Map()).entries()).sort((a, b) => (a[1][0]?.distance_miles ?? 9999) - (b[1][0]?.distance_miles ?? 9999)), [dishes]);
  const nearest = dishes.find((dish) => dish.distance_miles != null);
  return <section className="max-w-full overflow-hidden rounded-[28px] glass-surface p-4"><div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-2xl font-black">Want to try</h2>{nearest && <p className="text-xs font-bold text-muted-foreground">Nearest: {nearest.name} · {nearest.distance_miles?.toFixed(1)} mi</p>}</div><div className="flex items-center gap-2"><span className="soft-chip">{dishes.length}</span>{!hasLocation && <Button size="sm" variant="outline" className="rounded-full" onClick={onUseLocation}><LocateFixed className="size-4" />Sort nearby</Button>}</div></div>{dishes.length ? <div className="space-y-4">{groups.map(([location, items]) => <div key={location} className="rounded-3xl bg-secondary/55 p-3"><div className="mb-3 flex min-w-0 items-center justify-between gap-2"><h3 className="min-w-0 break-words font-display text-xl font-black"><MapPin className="mr-1 inline size-4 text-accent" />{location}</h3><span className="soft-chip text-accent">{items.length}</span></div><div className="grid min-w-0 gap-3 md:grid-cols-2">{items.map((dish) => <a key={dish.id} href={`/dish/${dish.slug}`} className="group grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-2xl bg-background/75 p-2 ring-1 ring-border/45 transition active:scale-[0.98] sm:grid-cols-[84px_minmax(0,1fr)]"><div className="aspect-square overflow-hidden rounded-2xl bg-secondary">{dish.cover_image_url ? <img src={dish.cover_image_url} alt={dish.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" decoding="async" sizes="(min-width: 768px) 33vw, 50vw" /> : <div className="flex h-full items-center justify-center"><ChefHat className="size-8 opacity-40" /></div>}</div><div className="min-w-0 py-1"><div className="mb-1 flex min-w-0 flex-wrap gap-1"><span className="soft-chip text-accent"><Star className="size-3 fill-current" />{Number(dish.aggregate_rating ?? 0).toFixed(1)}</span>{dish.distance_miles != null && <span className="soft-chip">{dish.distance_miles.toFixed(1)} mi</span>}</div><p className="line-clamp-2 font-display text-lg font-black leading-none">{dish.name}</p><p className="mt-1 line-clamp-1 text-xs font-bold text-muted-foreground">{dish.restaurants?.name || dish.cuisine || "Dish"}</p><p className="mt-2 text-xs font-black text-accent">{dish.plan_group}</p></div></a>)}</div></div>)}</div> : <p className="rounded-3xl bg-secondary/60 p-4 text-sm font-bold text-muted-foreground">Save dishes you are craving next.</p>}</section>;
};

const ProfilePanel = ({ sessionUser, userLocation, onUseLocation, onProtected }: { sessionUser: UserSession; userLocation: { latitude: number; longitude: number } | null; onUseLocation: () => void; onProtected: (message: string) => void }) => {
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState<DashboardDish[]>([]);
  const [wantToTry, setWantToTry] = useState<DashboardDish[]>([]);
  const [wantToTryPlan, setWantToTryPlan] = useState<WantToTryDish[]>([]);
  const [recentRated, setRecentRated] = useState<DashboardDish[]>([]);
  const [collections, setCollections] = useState<CollectionPreview[]>([]);

  useEffect(() => {
    if (!sessionUser) return;
    setLoading(true);
    Promise.all([
      supabase.from("saved_items").select("dish_id,action_type,updated_at,created_at").eq("user_id", sessionUser.id).in("action_type", ["favorite", "want_to_try"]).order("updated_at", { ascending: false }).limit(30),
      supabase.from("ratings").select("dish_id,rating,updated_at,created_at").eq("user_id", sessionUser.id).order("updated_at", { ascending: false }).limit(18),
      withTimeout(supabase.functions.invoke("want-to-try", { body: { latitude: userLocation?.latitude ?? null, longitude: userLocation?.longitude ?? null } }), 8000, "Want-to-try").catch((error) => ({ data: { error: error instanceof Error ? error.message : "Want-to-try timed out." }, error: null })),
      (supabase as any).from("collections").select("id,name,description,slug,is_public,cover_image_url,collection_dishes(dishes(id,name,slug,cuisine,section,aggregate_rating,review_count)))").eq("user_id", sessionUser.id).order("updated_at", { ascending: false }).limit(12),
    ]).then(async ([savedResult, ratingsResult, wantToTryResult, collectionsResult]) => {
      if (!wantToTryResult.error && !wantToTryResult.data?.error) setWantToTryPlan((wantToTryResult.data?.dishes ?? []) as WantToTryDish[]);
      else setWantToTryPlan([]);
      const savedRows = (savedResult.data ?? []) as SavedActionRow[];
      const ratingRows = (ratingsResult.data ?? []) as RatingActionRow[];
      const dishIds = Array.from(new Set([...savedRows.map((row) => row.dish_id), ...ratingRows.map((row) => row.dish_id)].filter(Boolean)));
      const collectionRows = (collectionsResult.data ?? []) as Array<Collection & { collection_dishes?: Array<{ dishes?: DashboardDish | null }> }>;
      const collectionDishIds = Array.from(new Set(collectionRows.flatMap((collection) => (collection.collection_dishes ?? []).map((row) => row.dishes?.id).filter(Boolean) as string[])));
      if (collectionDishIds.length) {
        const { data: collectionPhotos } = await supabase.from("photos").select("dish_id,image_url").in("dish_id", collectionDishIds).eq("is_public", true).order("created_at", { ascending: false });
        const collectionPhotoByDish = new Map((collectionPhotos ?? []).filter((photo) => photo.image_url).map((photo) => [photo.dish_id, photo.image_url]));
        setCollections(collectionRows.map((collection) => ({ ...collection, item_count: collection.collection_dishes?.length ?? 0, dishes: (collection.collection_dishes ?? []).map((row) => row.dishes).filter(Boolean).slice(0, 6).map((dish) => ({ ...dish!, cover_image_url: collectionPhotoByDish.get(dish!.id) ?? null })) })));
      } else setCollections(collectionRows.map((collection) => ({ ...collection, item_count: collection.collection_dishes?.length ?? 0, dishes: [] })));
      if (!dishIds.length) { setFavorites([]); setWantToTry([]); setRecentRated([]); setLoading(false); return; }
      const { data: dishRows } = await supabase.from("dishes").select("id,name,slug,cuisine,section,aggregate_rating,review_count,restaurant_id").in("id", dishIds).eq("is_published", true);
      const restaurantIds = Array.from(new Set(((dishRows ?? []) as { restaurant_id?: string | null }[]).map((dish) => dish.restaurant_id).filter(Boolean) as string[]));
      const [{ data: photoRows }, { data: restaurantRows }] = await Promise.all([
        supabase.from("photos").select("dish_id,image_url").in("dish_id", dishIds).eq("is_public", true).order("created_at", { ascending: false }),
        restaurantIds.length ? supabase.from("restaurants").select("id,name").in("id", restaurantIds) : Promise.resolve({ data: [] }),
      ]);
      const photoByDish = new Map((photoRows ?? []).filter((photo) => photo.image_url).map((photo) => [photo.dish_id, photo.image_url]));
      const restaurantById = new Map((restaurantRows ?? []).map((restaurant) => [restaurant.id, restaurant.name]));
      const dishById = new Map(((dishRows ?? []) as Array<Omit<DashboardDish, "cover_image_url" | "restaurant_name">>).map((dish) => [dish.id, { ...dish, cover_image_url: photoByDish.get(dish.id) ?? null, restaurant_name: dish.restaurant_id ? restaurantById.get(dish.restaurant_id) ?? null : null }]));
      setFavorites(savedRows.filter((row) => row.action_type === "favorite").map((row) => ({ ...dishById.get(row.dish_id), saved_at: row.updated_at ?? row.created_at } as DashboardDish)).filter((dish) => dish.id));
      setWantToTry(savedRows.filter((row) => row.action_type === "want_to_try").map((row) => ({ ...dishById.get(row.dish_id), saved_at: row.updated_at ?? row.created_at } as DashboardDish)).filter((dish) => dish.id));
      setRecentRated(ratingRows.map((row) => ({ ...dishById.get(row.dish_id), user_rating: Number(row.rating), saved_at: row.updated_at ?? row.created_at } as DashboardDish)).filter((dish) => dish.id));
      setLoading(false);
    });
  }, [sessionUser, userLocation]);

  const allDishes = useMemo(() => Array.from(new Map([...favorites, ...wantToTry, ...recentRated].map((dish) => [dish.id, dish])).values()), [favorites, wantToTry, recentRated]);
  const topCuisines = useMemo(() => Object.entries(allDishes.reduce<Record<string, number>>((acc, dish) => { const key = dish.cuisine || dish.section || "Discovery"; acc[key] = (acc[key] ?? 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 4), [allDishes]);
  const topRestaurants = useMemo(() => Object.entries(allDishes.reduce<Record<string, number>>((acc, dish) => { if (!dish.restaurant_name) return acc; acc[dish.restaurant_name] = (acc[dish.restaurant_name] ?? 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 4), [allDishes]);
  const averageRating = recentRated.length ? (recentRated.reduce((sum, dish) => sum + Number(dish.user_rating ?? 0), 0) / recentRated.length).toFixed(1) : "—";

  if (!sessionUser) return <section className="rounded-[28px] glass-surface p-5"><h1 className="font-display text-4xl font-black">Your food identity</h1><p className="mt-2 text-muted-foreground">Browse, search, take photos, and draft reviews. Sign in when you want to save your taste.</p><Button className="mt-4 rounded-full" onClick={() => onProtected("Sign in to save favorites, lists, and contribution history.")}><LogIn />Sign in</Button></section>;
  return <section className="space-y-4"><div className="relative overflow-hidden rounded-[32px] bg-secondary p-5 shadow-[var(--shadow-editorial)] ring-1 ring-border/60"><div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/15" /><div className="relative"><p className="soft-chip mb-3 text-accent"><User className="size-4" />Food profile</p><h1 className="break-words font-display text-4xl font-black leading-none sm:text-5xl">Your taste map</h1><p className="mt-2 line-clamp-1 text-sm font-bold text-foreground/70">{sessionUser.email}</p><div className="mt-5 grid grid-cols-3 gap-2"><Metric icon={Heart} label="favorites" value={String(favorites.length)} /><Metric icon={Bookmark} label="want" value={String(wantToTry.length)} /><Metric icon={Star} label="avg" value={averageRating} /></div></div></div>{loading ? <SearchResultsLoader /> : <><CollectionGrid collections={collections} /><ShareableLists sessionUser={sessionUser} onProtected={onProtected} /><DashboardDishGrid title="Favorite dishes" dishes={favorites} empty="Favorite dishes to shape your identity." /><WantToTryPlanner hasLocation={Boolean(userLocation)} onUseLocation={onUseLocation} dishes={wantToTryPlan.length ? wantToTryPlan : wantToTry.map((dish) => ({ ...dish, tags: [], dietary_tags: [], currency: "USD", photo_count: 0, restaurants: dish.restaurant_name ? { name: dish.restaurant_name } : null, location_group: dish.restaurant_name || "Location pending", plan_group: "Saved for later" as const }))} /><DashboardDishGrid title="Recently rated" dishes={recentRated} empty="Rate dishes to build your taste history." /><div className="grid gap-4 md:grid-cols-2"><section className="rounded-[28px] glass-surface p-4"><h2 className="font-display text-2xl font-black">Top cuisines</h2><div className="mt-3 flex flex-wrap gap-2">{topCuisines.length ? topCuisines.map(([name, count]) => <span key={name} className="soft-chip text-accent">{name} · {count}</span>) : <p className="text-sm font-bold text-muted-foreground">Start saving dishes to reveal your cuisine pattern.</p>}</div></section><section className="rounded-[28px] glass-surface p-4"><h2 className="font-display text-2xl font-black">Most visited</h2><div className="mt-3 space-y-2">{topRestaurants.length ? topRestaurants.map(([name, count]) => <div key={name} className="flex items-center justify-between rounded-2xl bg-secondary/70 p-3"><span className="font-black line-clamp-1">{name}</span><span className="soft-chip">{count}</span></div>) : <p className="text-sm font-bold text-muted-foreground">Restaurant patterns appear as you rate and save dishes.</p>}</div></section></div></>}</section>;
};

export default Index;

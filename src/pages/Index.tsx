import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import {
  Bookmark,
  Camera as CameraIcon,
  ChefHat,
  Compass,
  Eye,
  EyeOff,
  Heart,
  Home,
  Loader2,
  LogOut,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Send,
  Share2,
  Sparkles,
  Star,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import ramenImage from "@/assets/ramen-table.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Tab = "feed" | "discover" | "post" | "saved" | "profile";
type Profile = Tables<"profiles">;
type FoodPost = Tables<"food_posts">;
type Comment = Tables<"post_comments">;
type AppPost = FoodPost & {
  profiles?: Pick<Profile, "display_name" | "username" | "avatar_url"> | null;
  post_likes?: { id: string; user_id: string }[];
  post_saves?: { id: string; user_id: string }[];
  post_comments?: (Comment & { profiles?: Pick<Profile, "display_name" | "username"> | null })[];
};

type Extraction = {
  restaurantName?: string;
  dishName?: string;
  cuisine?: string;
  foodTags?: string[];
  dietaryTags?: string[];
  ingredients?: string[];
  price?: number;
  ocrText?: string;
  confidence?: number;
  notes?: string;
};

const samplePosts = [
  {
    id: "sample-1",
    restaurant_name: "Kitsune Counter",
    dish_name: "Shoyu Ramen",
    cuisine: "Japanese",
    rating: 4.8,
    review: "Deep broth, springy noodles, and a perfect jammy egg. Worth crossing town for.",
    image_url: ramenImage,
    ai_tags: ["ramen", "umami", "noodles", "comfort"],
    dietary_tags: ["contains gluten", "egg"],
    profiles: { display_name: "Maya Chen", username: "mayatastes", avatar_url: null },
    likes: 248,
    comments: 32,
  },
  {
    id: "sample-2",
    restaurant_name: "Naranja Social",
    dish_name: "Charred Octopus Tostada",
    cuisine: "Mexican",
    rating: 4.6,
    review: "Smoky edges, citrus heat, and a crispy blue corn base. Best shared with friends.",
    image_url: null,
    ai_tags: ["seafood", "citrus", "spicy"],
    dietary_tags: ["pescatarian"],
    profiles: { display_name: "Leo Park", username: "forktrail", avatar_url: null },
    likes: 121,
    comments: 18,
  },
];

const navItems = [
  { id: "feed" as Tab, label: "Feed", icon: Home },
  { id: "discover" as Tab, label: "Discover", icon: Compass },
  { id: "post" as Tab, label: "Post", icon: CameraIcon },
  { id: "saved" as Tab, label: "Saved", icon: Bookmark },
  { id: "profile" as Tab, label: "Profile", icon: User },
];

const cuisineFilters = ["All", "Japanese", "Italian", "Mexican", "Korean", "Vegan", "Dessert"];

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const blobUrlToFile = async (url: string, name: string) => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
};

const AuthPanel = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        toast({ title: "Reset link sent", description: "Check your email for the password reset link." });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        toast({ title: "Check your email", description: "Confirm your account, then come back to sign in." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      toast({ title: "Authentication failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const googleSignIn = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast({ title: "Google sign-in failed", description: result.error.message, variant: "destructive" });
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-4 py-6 md:grid-cols-[1.1fr_0.9fr] md:px-8">
        <div className="relative flex min-h-[360px] overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-editorial)] md:min-h-[calc(100vh-3rem)]">
          <img src={ramenImage} alt="Steaming ramen bowl at a restaurant table" className="absolute inset-0 h-full w-full object-cover" width={1024} height={768} />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-transparent" />
          <div className="relative mt-auto p-6 md:p-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-background/85 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur">
              <ChefHat className="size-4" /> PlateLoop
            </div>
            <h1 className="max-w-xl font-display text-5xl font-black leading-none tracking-normal md:text-7xl">Follow food worth leaving home for.</h1>
            <p className="mt-4 max-w-md text-base text-muted-foreground md:text-lg">A camera-first restaurant discovery app for sharing dishes with friends, extracting tags, and finding the next table.</p>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="mb-5">
              <p className="text-sm font-semibold text-accent">Friends-first food discovery</p>
              <h2 className="mt-1 font-display text-3xl font-black">{mode === "signup" ? "Create account" : mode === "reset" ? "Reset password" : "Welcome back"}</h2>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <Input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              {mode !== "reset" && <Input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />}
              <Button className="w-full" disabled={loading}>{loading && <Loader2 className="animate-spin" />} {mode === "signup" ? "Sign up" : mode === "reset" ? "Send reset link" : "Sign in"}</Button>
            </form>
            <Button variant="outline" className="mt-3 w-full" onClick={googleSignIn}>Continue with Google</Button>
            <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
              <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="font-semibold text-primary">{mode === "signup" ? "Sign in instead" : "Create account"}</button>
              <button onClick={() => setMode(mode === "reset" ? "signin" : "reset")} className="font-semibold text-primary">{mode === "reset" ? "Back to sign in" : "Forgot password?"}</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

const PostCard = ({ post, userId, onLike, onSave, onComment }: { post: AppPost | typeof samplePosts[number]; userId?: string; onLike?: (post: AppPost) => void; onSave?: (post: AppPost) => void; onComment?: (post: AppPost, body: string) => void }) => {
  const [comment, setComment] = useState("");
  const isReal = "user_id" in post;
  const liked = isReal ? post.post_likes?.some((like) => like.user_id === userId) : false;
  const saved = isReal ? post.post_saves?.some((save) => save.user_id === userId) : false;
  const comments = isReal ? post.post_comments?.length ?? 0 : post.comments;
  const likes = isReal ? post.post_likes?.length ?? 0 : post.likes;

  const share = async () => {
    const text = `${post.dish_name} at ${post.restaurant_name}`;
    if (navigator.share) await navigator.share({ title: text, text, url: window.location.href });
    else await navigator.clipboard.writeText(text);
  };

  return (
    <article className="overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-soft)]">
      {post.image_url ? (
        <img src={post.image_url} alt={`${post.dish_name} at ${post.restaurant_name}`} className="h-72 w-full object-cover" loading="lazy" width={800} height={600} />
      ) : (
        <div className="flex h-64 items-center justify-center bg-secondary text-secondary-foreground"><ChefHat className="size-16 opacity-40" /></div>
      )}
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl font-black leading-tight">{post.dish_name}</h3>
            <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-muted-foreground"><MapPin className="size-4" />{post.restaurant_name}</p>
          </div>
          {post.rating && <div className="flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-sm font-bold text-accent-foreground"><Star className="size-4 fill-current" />{post.rating}</div>}
        </div>
        <p className="text-sm leading-6 text-foreground/85">{post.review}</p>
        <div className="flex flex-wrap gap-2">{post.ai_tags?.slice(0, 5).map((tag) => <span key={tag} className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">#{tag}</span>)}</div>
        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-black">{post.profiles?.display_name?.[0] ?? "P"}</div>@{post.profiles?.username ?? "plater"}</div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => isReal && onLike?.(post)} aria-label="Like"><Heart className={cn(liked && "fill-current text-destructive")} /></Button>
            <span className="min-w-5 text-center text-xs font-bold">{likes}</span>
            <Button size="icon" variant="ghost" onClick={() => isReal && onSave?.(post)} aria-label="Save"><Bookmark className={cn(saved && "fill-current text-accent")} /></Button>
            <Button size="icon" variant="ghost" onClick={share} aria-label="Share"><Share2 /></Button>
          </div>
        </div>
        {isReal && onComment && (
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (comment.trim()) { onComment(post, comment.trim()); setComment(""); } }}>
            <Input value={comment} onChange={(event) => setComment(event.target.value)} placeholder={`${comments} comments · add yours`} maxLength={500} />
            <Button size="icon" aria-label="Send comment"><Send /></Button>
          </form>
        )}
      </div>
    </article>
  );
};

const Index = () => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sessionUser, setSessionUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<AppPost[]>([]);
  const [tab, setTab] = useState<Tab>("feed");
  const [loading, setLoading] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [form, setForm] = useState({ restaurant_name: "", dish_name: "", review: "", rating: "", price: "", cuisine: "", tags: "", dietary: "", ocr_text: "", visibility: "followers" as "followers" | "public" | "private" });
  const [profileForm, setProfileForm] = useState({ username: "", display_name: "", bio: "", dietary_preferences: "", favorite_cuisines: "" });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSessionUser(session?.user ? { id: session.user.id, email: session.user.email ?? undefined } : null));
    supabase.auth.getSession().then(({ data }) => setSessionUser(data.session?.user ? { id: data.session.user.id, email: data.session.user.email ?? undefined } : null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadData = async () => {
    if (!sessionUser) return;
    setLoading(true);
    const [{ data: profiles }, { data: feed }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", sessionUser.id).maybeSingle(),
      supabase.from("food_posts").select("*, profiles(display_name, username, avatar_url), post_likes(id,user_id), post_saves(id,user_id), post_comments(*, profiles(display_name, username))").eq("is_draft", false).order("created_at", { ascending: false }).limit(50),
    ]);
    setProfile(profiles);
    if (profiles) setProfileForm({ username: profiles.username, display_name: profiles.display_name, bio: profiles.bio ?? "", dietary_preferences: profiles.dietary_preferences.join(", "), favorite_cuisines: profiles.favorite_cuisines.join(", ") });
    else setProfileForm({ username: (sessionUser.email?.split("@")[0] ?? "foodie").replace(/\W/g, "").slice(0, 24), display_name: "", bio: "", dietary_preferences: "", favorite_cuisines: "" });
    setPosts((feed as AppPost[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [sessionUser?.id]);

  const visiblePosts = useMemo(() => {
    const source = posts.length ? posts : (samplePosts as unknown as AppPost[]);
    return source.filter((post) => {
      const text = `${post.restaurant_name} ${post.dish_name} ${post.cuisine ?? ""} ${post.ai_tags?.join(" ") ?? ""}`.toLowerCase();
      const matchesQuery = !query || text.includes(query.toLowerCase());
      const matchesFilter = filter === "All" || post.cuisine === filter || post.ai_tags?.includes(filter.toLowerCase());
      return matchesQuery && matchesFilter;
    });
  }, [posts, query, filter]);

  if (!sessionUser) return <AuthPanel />;

  const ensureProfile = async () => {
    if (!profile) {
      toast({ title: "Create your profile first", description: "Add a display name so friends can recognize your posts." });
      setTab("profile");
      return false;
    }
    return true;
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      user_id: sessionUser.id,
      username: profileForm.username.trim(),
      display_name: profileForm.display_name.trim(),
      bio: profileForm.bio.trim() || null,
      dietary_preferences: profileForm.dietary_preferences.split(",").map((x) => x.trim()).filter(Boolean),
      favorite_cuisines: profileForm.favorite_cuisines.split(",").map((x) => x.trim()).filter(Boolean),
    };
    const { error } = profile
      ? await supabase.from("profiles").update(payload).eq("user_id", sessionUser.id)
      : await supabase.from("profiles").insert(payload);
    if (error) toast({ title: "Profile not saved", description: error.message, variant: "destructive" });
    else { toast({ title: "Profile saved" }); await loadData(); }
  };

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const captureNative = async () => {
    try {
      const photo = await Camera.getPhoto({ quality: 85, allowEditing: false, resultType: CameraResultType.Uri, source: CameraSource.Camera });
      if (!photo.webPath) return;
      const file = await blobUrlToFile(photo.webPath, `capture-${Date.now()}.jpg`);
      setImageFile(file);
      setPreview(photo.webPath);
    } catch (error) {
      toast({ title: "Camera unavailable", description: "Use photo upload instead.", variant: "destructive" });
    }
  };

  const getLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => { setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); toast({ title: "Location attached" }); },
      () => toast({ title: "Location unavailable", description: "Permission was denied or unavailable.", variant: "destructive" }),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const analyzeImage = async () => {
    if (!imageFile) return;
    setExtracting(true);
    try {
      const imageBase64 = await fileToBase64(imageFile);
      const { data, error } = await supabase.functions.invoke("analyze-food", { body: { imageBase64, mimeType: imageFile.type || "image/jpeg", context: { restaurantName: form.restaurant_name, dishName: form.dish_name } } });
      if (error) throw error;
      const result = data.result as Extraction;
      setForm((prev) => ({ ...prev, restaurant_name: prev.restaurant_name || result.restaurantName || "", dish_name: prev.dish_name || result.dishName || "", cuisine: prev.cuisine || result.cuisine || "", price: prev.price || (result.price ? String(result.price) : ""), tags: result.foodTags?.join(", ") || prev.tags, dietary: result.dietaryTags?.join(", ") || prev.dietary, ocr_text: result.ocrText || prev.ocr_text }));
      toast({ title: "AI suggestions ready", description: "Review and edit the extracted tags before posting." });
    } catch (error) {
      toast({ title: "Analysis failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const publishPost = async (draft = false) => {
    if (!(await ensureProfile())) return;
    if (!form.restaurant_name.trim() || !form.dish_name.trim()) return toast({ title: "Add restaurant and dish", variant: "destructive" });
    let imagePath: string | null = null;
    let imageUrl: string | null = null;
    if (imageFile) {
      imagePath = `${sessionUser.id}/${Date.now()}-${imageFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "-")}`;
      const { error } = await supabase.storage.from("food-post-images").upload(imagePath, imageFile, { upsert: true });
      if (error) return toast({ title: "Image upload failed", description: error.message, variant: "destructive" });
      const { data } = await supabase.storage.from("food-post-images").createSignedUrl(imagePath, 60 * 60 * 24 * 30);
      imageUrl = data?.signedUrl ?? null;
    }
    const { error } = await supabase.from("food_posts").insert({
      user_id: sessionUser.id,
      restaurant_name: form.restaurant_name.trim(),
      dish_name: form.dish_name.trim(),
      review: form.review.trim() || null,
      rating: form.rating ? Number(form.rating) : null,
      price: form.price ? Number(form.price) : null,
      cuisine: form.cuisine.trim() || null,
      image_path: imagePath,
      image_url: imageUrl,
      visibility: form.visibility,
      is_draft: draft,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      ai_tags: form.tags.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean),
      dietary_tags: form.dietary.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean),
      ocr_text: form.ocr_text.trim() || null,
      extracted_data: { locationAttached: Boolean(location), source: "camera-flow" },
    });
    if (error) toast({ title: "Post not saved", description: error.message, variant: "destructive" });
    else {
      toast({ title: draft ? "Draft saved" : "Posted to friends" });
      setForm({ restaurant_name: "", dish_name: "", review: "", rating: "", price: "", cuisine: "", tags: "", dietary: "", ocr_text: "", visibility: "followers" });
      setImageFile(null); setPreview(null); setLocation(null); setTab("feed"); await loadData();
    }
  };

  const toggleLike = async (post: AppPost) => {
    const existing = post.post_likes?.find((like) => like.user_id === sessionUser.id);
    if (existing) await supabase.from("post_likes").delete().eq("id", existing.id);
    else await supabase.from("post_likes").insert({ post_id: post.id, user_id: sessionUser.id });
    await loadData();
  };

  const toggleSave = async (post: AppPost) => {
    const existing = post.post_saves?.find((save) => save.user_id === sessionUser.id);
    if (existing) await supabase.from("post_saves").delete().eq("id", existing.id);
    else await supabase.from("post_saves").insert({ post_id: post.id, user_id: sessionUser.id });
    await loadData();
  };

  const addComment = async (post: AppPost, body: string) => {
    await supabase.from("post_comments").insert({ post_id: post.id, user_id: sessionUser.id, body });
    await loadData();
  };

  const savedPosts = posts.filter((post) => post.post_saves?.some((save) => save.user_id === sessionUser.id));

  return (
    <main className="min-h-screen bg-background pb-24 text-foreground md:pb-0">
      <div className="mx-auto flex max-w-7xl gap-6 px-3 py-4 md:px-6">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-64 shrink-0 rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)] md:block">
          <div className="mb-8 flex items-center gap-2 font-display text-2xl font-black"><ChefHat className="text-accent" /> PlateLoop</div>
          <nav className="space-y-2">{navItems.map((item) => <Button key={item.id} variant={tab === item.id ? "default" : "ghost"} className="w-full justify-start" onClick={() => setTab(item.id)}><item.icon />{item.label}</Button>)}</nav>
          <div className="mt-auto pt-8"><Button variant="outline" className="w-full justify-start" onClick={() => supabase.auth.signOut()}><LogOut />Sign out</Button></div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="mb-4 flex items-center justify-between rounded-lg border bg-card p-3 shadow-[var(--shadow-soft)] md:hidden">
            <div className="flex items-center gap-2 font-display text-xl font-black"><ChefHat className="text-accent" /> PlateLoop</div>
            <Button size="icon" variant="ghost" onClick={() => supabase.auth.signOut()} aria-label="Sign out"><LogOut /></Button>
          </header>

          {loading ? <div className="flex h-96 items-center justify-center"><Loader2 className="size-10 animate-spin text-accent" /></div> : null}

          {!loading && tab === "feed" && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div className="rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)]"><h2 className="font-display text-3xl font-black">Friends are eating</h2><p className="text-sm text-muted-foreground">Follower-only posts first, with public gems mixed in.</p></div>
                {visiblePosts.map((post) => <PostCard key={post.id} post={post} userId={sessionUser.id} onLike={toggleLike} onSave={toggleSave} onComment={addComment} />)}
              </div>
              <aside className="hidden space-y-4 lg:block"><DiscoverPanel query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} /><ProfileMini profile={profile} /></aside>
            </div>
          )}

          {!loading && tab === "discover" && <div className="space-y-4"><DiscoverPanel query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} /><div className="grid gap-4 md:grid-cols-2">{visiblePosts.map((post) => <PostCard key={post.id} post={post} userId={sessionUser.id} onLike={toggleLike} onSave={toggleSave} onComment={addComment} />)}</div></div>}

          {!loading && tab === "post" && (
            <div className="mx-auto max-w-2xl space-y-4 rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)]">
              <div><h2 className="font-display text-3xl font-black">Capture a craving</h2><p className="text-sm text-muted-foreground">Take a photo, extract tags, attach location, then share with followers.</p></div>
              <div className="overflow-hidden rounded-lg border bg-secondary">
                {preview ? <img src={preview} alt="Selected food preview" className="h-72 w-full object-cover" /> : <button onClick={() => fileRef.current?.click()} className="flex h-72 w-full flex-col items-center justify-center gap-3 text-muted-foreground"><CameraIcon className="size-12" />Add food, menu, or receipt photo</button>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={chooseFile} />
              <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => Capacitor.isNativePlatform() ? captureNative() : fileRef.current?.click()}><CameraIcon />Camera</Button><Button variant="outline" onClick={() => fileRef.current?.click()}><Upload />Upload</Button></div>
              <div className="grid gap-3 md:grid-cols-2"><Input placeholder="Restaurant" value={form.restaurant_name} onChange={(e) => setForm({ ...form, restaurant_name: e.target.value })} maxLength={160} /><Input placeholder="Dish" value={form.dish_name} onChange={(e) => setForm({ ...form, dish_name: e.target.value })} maxLength={140} /><Input placeholder="Cuisine" value={form.cuisine} onChange={(e) => setForm({ ...form, cuisine: e.target.value })} maxLength={80} /><Input placeholder="Rating 0-5" type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} /><Input placeholder="Price" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as typeof form.visibility })}><option value="followers">Followers</option><option value="public">Public discover</option><option value="private">Private draft</option></select></div>
              <Textarea placeholder="Review" value={form.review} onChange={(e) => setForm({ ...form, review: e.target.value })} maxLength={1600} />
              <Input placeholder="AI tags, comma separated" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              <Input placeholder="Dietary tags, comma separated" value={form.dietary} onChange={(e) => setForm({ ...form, dietary: e.target.value })} />
              <Textarea placeholder="OCR text from menu or receipt" value={form.ocr_text} onChange={(e) => setForm({ ...form, ocr_text: e.target.value })} maxLength={6000} />
              <div className="grid gap-2 sm:grid-cols-3"><Button variant="outline" onClick={analyzeImage} disabled={!imageFile || extracting}>{extracting ? <Loader2 className="animate-spin" /> : <Sparkles />}Extract</Button><Button variant="outline" onClick={getLocation}><MapPin />Location</Button><Button variant="outline" onClick={() => publishPost(true)}><EyeOff />Save draft</Button></div>
              <Button className="w-full" onClick={() => publishPost(false)}><Plus />Publish to followers</Button>
            </div>
          )}

          {!loading && tab === "saved" && <div className="space-y-4"><div className="rounded-lg border bg-card p-4"><h2 className="font-display text-3xl font-black">Saved plates</h2><p className="text-sm text-muted-foreground">Meals to revisit later.</p></div>{savedPosts.length ? savedPosts.map((post) => <PostCard key={post.id} post={post} userId={sessionUser.id} onLike={toggleLike} onSave={toggleSave} onComment={addComment} />) : <EmptyState icon={Bookmark} title="No saved posts yet" />}</div>}

          {!loading && tab === "profile" && (
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <form onSubmit={saveProfile} className="space-y-3 rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)]"><h2 className="font-display text-3xl font-black">Your profile</h2><Input placeholder="Username" value={profileForm.username} onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })} required /><Input placeholder="Display name" value={profileForm.display_name} onChange={(e) => setProfileForm({ ...profileForm, display_name: e.target.value })} required /><Textarea placeholder="Bio" value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} maxLength={280} /><Input placeholder="Dietary preferences" value={profileForm.dietary_preferences} onChange={(e) => setProfileForm({ ...profileForm, dietary_preferences: e.target.value })} /><Input placeholder="Favorite cuisines" value={profileForm.favorite_cuisines} onChange={(e) => setProfileForm({ ...profileForm, favorite_cuisines: e.target.value })} /><Button><User />Save profile</Button></form>
              <ProfileMini profile={profile} />
            </div>
          )}
        </section>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-card/95 p-2 backdrop-blur md:hidden">{navItems.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={cn("flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] font-semibold text-muted-foreground", tab === item.id && "bg-primary text-primary-foreground")}><item.icon className="size-5" />{item.label}</button>)}</nav>
    </main>
  );
};

const DiscoverPanel = ({ query, setQuery, filter, setFilter }: { query: string; setQuery: (x: string) => void; filter: string; setFilter: (x: string) => void }) => (
  <div className="rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)]">
    <h2 className="font-display text-3xl font-black">Discover</h2>
    <div className="relative mt-3"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search dishes, tags, restaurants" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
    <div className="mt-3 flex flex-wrap gap-2">{cuisineFilters.map((item) => <button key={item} onClick={() => setFilter(item)} className={cn("rounded-full border px-3 py-1 text-xs font-bold", filter === item ? "bg-accent text-accent-foreground" : "bg-background text-muted-foreground")}>{item}</button>)}</div>
  </div>
);

const ProfileMini = ({ profile }: { profile: Profile | null }) => (
  <div className="rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)]">
    <div className="flex items-center gap-3"><div className="flex size-14 items-center justify-center rounded-full bg-primary font-display text-2xl font-black text-primary-foreground">{profile?.display_name?.[0] ?? "?"}</div><div><h3 className="font-display text-xl font-black">{profile?.display_name ?? "Create profile"}</h3><p className="text-sm text-muted-foreground">@{profile?.username ?? "newfoodie"}</p></div></div>
    <p className="mt-3 text-sm text-muted-foreground">{profile?.bio ?? "Set up your taste profile before posting."}</p>
    <div className="mt-3 flex gap-4 text-sm"><span className="flex items-center gap-1"><Users className="size-4" />Followers</span><span className="flex items-center gap-1"><Eye className="size-4" />Friends-first</span></div>
  </div>
);

const EmptyState = ({ icon: Icon, title }: { icon: typeof Bookmark; title: string }) => <div className="flex h-64 flex-col items-center justify-center rounded-lg border bg-card text-muted-foreground"><Icon className="mb-3 size-10" /><p className="font-semibold">{title}</p></div>;

export default Index;

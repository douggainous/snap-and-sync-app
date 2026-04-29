import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppUser = {
  id: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
};

const userFromAuth = (user: User): AppUser => ({
  id: user.id,
  email: user.email ?? undefined,
  displayName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? undefined,
  avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? undefined,
});

const ensureUserRecord = async (user: User) => {
  const appUser = userFromAuth(user);
  const { error } = await supabase.from("users").upsert({
    id: appUser.id,
    email: appUser.email ?? null,
    display_name: appUser.displayName ?? null,
    avatar_url: appUser.avatarUrl ?? null,
  });
  if (error) console.warn("Profile sync failed", error.message);
};

export const useAuthSession = () => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const syncSession = async (authUser: User | null) => {
      if (!authUser) {
        setUser(null);
        return;
      }

      setUser(userFromAuth(authUser));
      await ensureUserRecord(authUser).catch((error) => console.warn("Profile sync failed", error));
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session?.user ?? null);
    });

    supabase.auth.getSession()
      .then(async ({ data, error }) => {
        if (error) console.warn("Session restore failed", error.message);
        await syncSession(data.session?.user ?? null);
      })
      .catch((error) => {
        console.warn("Session restore failed", error);
        setUser(null);
      })
      .finally(() => setIsAuthReady(true));

    return () => subscription.subscription.unsubscribe();
  }, []);

  return {
    user,
    isAuthReady,
    isSignedIn: !!user,
    signOut: () => supabase.auth.signOut(),
  };
};
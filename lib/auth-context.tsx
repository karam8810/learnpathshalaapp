
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase, type Profile } from "@/lib/supabase/client";

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

const REQUEST_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after 10 seconds`));
    }, REQUEST_TIMEOUT_MS);

    Promise.resolve(promise).then(
      (result) => {
        clearTimeout(timeoutId);
        resolve(result);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const result = await withTimeout(
        supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle(),
        "Profile request"
      );

      if (result.error) {
        console.error("Profile fetch error:", result.error.message);
        setProfile(null);
        return null;
      }

      const nextProfile = result.data as Profile | null;
      setProfile(nextProfile);

      if (!nextProfile) {
        console.warn("No profile found for user:", userId);
      }

      return nextProfile;
    } catch (error) {
      console.error("Profile fetch failed:", error);
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        console.log("[AUTH] Checking Supabase session");

        const result = await withTimeout(
          supabase.auth.getSession(),
          "Session request"
        );

        if (result.error) throw result.error;
        if (!active) return;

        const sessionUser = result.data.session?.user ?? null;
        setUser(sessionUser);

        if (sessionUser) {
          console.log("[AUTH] Session found; loading profile");
          await fetchProfile(sessionUser.id);
        } else {
          setProfile(null);
          console.log("[AUTH] No active session");
        }
      } catch (error) {
        console.error("[AUTH] Initialization failed:", error);

        if (active) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (active) {
          setLoading(false);
          console.log("[AUTH] Initialization finished");
        }
      }
    };

    void initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || event === "INITIAL_SESSION") return;

      if (event === "SIGNED_OUT" || !session?.user) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      const nextUser = session.user;
      setUser(nextUser);

      // Run profile fetching after the auth callback completes.
      Promise.resolve().then(() => {
        if (active) {
          void fetchProfile(nextUser.id);
        }
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Sign out failed:", error.message);
      throw error;
    }

    setUser(null);
    setProfile(null);
    router.push("/");
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

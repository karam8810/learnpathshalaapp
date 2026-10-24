
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
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

function withTimeout<T>(
  promise: PromiseLike<T>,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(
      () => reject(new Error(`${label} timed out after 10 seconds`)),
      REQUEST_TIMEOUT_MS
    );

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

  const mounted = useRef(false);
  const currentUserId = useRef<string | null>(null);
  const profileRequests = useRef(
    new Map<string, Promise<Profile | null>>()
  );

  const fetchProfile = useCallback(async (userId: string) => {
    const existingRequest = profileRequests.current.get(userId);

    if (existingRequest) {
      return existingRequest;
    }

    const request = (async (): Promise<Profile | null> => {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .maybeSingle(),
          "Profile request"
        );

        if (error) {
          console.error("[AUTH] Profile fetch error:", error.message);
          return null;
        }

        if (!data) {
          console.warn("[AUTH] No profile found for user:", userId);
          return null;
        }

        return data as Profile;
      } catch (error) {
        console.error("[AUTH] Profile fetch failed:", error);
        return null;
      }
    })();

    profileRequests.current.set(userId, request);

    try {
      const result = await request;

      if (mounted.current && currentUserId.current === userId) {
        setProfile(result);
      }

      return result;
    } finally {
      if (profileRequests.current.get(userId) === request) {
        profileRequests.current.delete(userId);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    let active = true;

    const applySession = async (nextUser: User | null) => {
      if (!active) return;

      currentUserId.current = nextUser?.id ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        await fetchProfile(nextUser.id);
      } finally {
        if (active && currentUserId.current === nextUser.id) {
          setLoading(false);
        }
      }
    };

    const initialize = async () => {
      try {
        console.log("[AUTH] Checking Supabase session");

        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          "Session request"
        );

        if (error) throw error;
        if (!active) return;

        await applySession(data.session?.user ?? null);
        console.log("[AUTH] Initialization finished");
      } catch (error) {
        console.error("[AUTH] Initialization failed:", error);

        if (active) {
          currentUserId.current = null;
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    };

    // Subscribe before initialization so session changes aren't missed.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || event === "INITIAL_SESSION") return;

      const nextUser = session?.user ?? null;

      if (event === "SIGNED_OUT" || !nextUser) {
        currentUserId.current = null;
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      // Ignore token refreshes and repeated events for the same user.
      if (
        currentUserId.current === nextUser.id &&
        (event === "TOKEN_REFRESHED" || event === "USER_UPDATED")
      ) {
        setUser(nextUser);
        return;
      }

      void applySession(nextUser);
    });

    void initialize();

    return () => {
      active = false;
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[AUTH] Sign out failed:", error.message);
      throw error;
    }

    currentUserId.current = null;
    setUser(null);
    setProfile(null);
    setLoading(false);
    router.replace("/");
  }, [router]);

  const refreshProfile = useCallback(async () => {
    const userId = currentUserId.current;

    if (userId) {
      await fetchProfile(userId);
    }
  }, [fetchProfile]);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

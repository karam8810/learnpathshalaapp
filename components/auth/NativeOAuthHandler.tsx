
"use client";

import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/lib/supabase/client";

export default function NativeOAuthHandler() {
  const processing = useRef(false);
  const processedCodes = useRef(new Set<string>());

  useEffect(() => {
    let mounted = true;

    const handleCallback = async (url: string) => {
      try {
        const callback = new URL(url);

        if (
          callback.protocol !== "com.learnpathshala.app:" ||
          callback.hostname !== "login-callback"
        ) {
          return;
        }

        const error = callback.searchParams.get("error_description");
        if (error) {
          throw new Error(error);
        }

        const code = callback.searchParams.get("code");

        if (!code || processedCodes.current.has(code) || processing.current) {
          return;
        }

        processing.current = true;
        processedCodes.current.add(code);

        // Exchange OAuth authorization code for Supabase session.
        const { error: authError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (authError) {
          throw authError;
        }

        await Browser.close().catch(() => undefined);

        if (!mounted) return;

        // Existing callback page will verify profile and role.
        window.location.replace("/auth/callback?app=student");
      } catch (error) {
        console.error("[NATIVE OAUTH]", error);

        await Browser.close().catch(() => undefined);

        if (mounted) {
          window.location.replace(
            "/login?app=student&oauth_error=1"
          );
        }
      } finally {
        processing.current = false;
      }
    };

    let listener: { remove: () => Promise<void> } | undefined;

    const initialize = async () => {
      // Handle callbacks when the app is already running.
      listener = await App.addListener("appUrlOpen", ({ url }) => {
        void handleCallback(url);
      });

      // Handle callbacks when Android launches the app from closed state.
      const launch = await App.getLaunchUrl();

      if (launch?.url) {
        void handleCallback(launch.url);
      }
    };

    void initialize();

    return () => {
      mounted = false;
      void listener?.remove();
    };
  }, []);

  return null;
}


"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type Token,
} from "@capacitor/push-notifications";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

export default function PushNotificationRegistration() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id || !Capacitor.isNativePlatform()) return;

    let active = true;
    let registering = false;

    type PushListener = Awaited<
      ReturnType<typeof PushNotifications.addListener>
    >;

    let listeners: PushListener[] = [];

    const setup = async () => {
      if (registering) return;
      registering = true;

      try {
        // Listen for the FCM token before registering.
        const registrationListener =
          await PushNotifications.addListener(
            "registration",
            async (token: Token) => {
              if (!active) return;

              const { error } = await supabase
                .from("student_push_tokens")
                .upsert(
                  {
                    user_id: user.id,
                    token: token.value,
                    platform: Capacitor.getPlatform(),
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "token" }
                );

              if (error) {
                console.error(
                  "Saving push token failed:",
                  error.message
                );
              } else {
                console.log("Push token saved successfully.");
              }
            }
          );

        listeners.push(registrationListener);

        const errorListener =
          await PushNotifications.addListener(
            "registrationError",
            (error) => {
              console.error("Push registration failed:", error);
            }
          );

        listeners.push(errorListener);

        const receivedListener =
          await PushNotifications.addListener(
            "pushNotificationReceived",
            (notification) => {
              console.log(
                "Push notification received:",
                notification
              );
            }
          );

        listeners.push(receivedListener);

        const actionListener =
          await PushNotifications.addListener(
            "pushNotificationActionPerformed",
            (action) => {
              console.log("Push notification opened:", action);

              const url = action.notification.data?.url;

              if (
                typeof url === "string" &&
                url.startsWith("/") &&
                !url.startsWith("//")
              ) {
                window.location.href = url;
              } else {
                window.location.href = "/dashboard/student";
              }
            }
          );

        listeners.push(actionListener);

        if (!active) return;

        // Check the existing Android permission first.
        let permission =
          await PushNotifications.checkPermissions();

        if (!active) return;

        // Request permission if it hasn't been granted.
        if (permission.receive !== "granted") {
          permission =
            await PushNotifications.requestPermissions();
        }

        if (!active) return;

        if (permission.receive !== "granted") {
          console.warn(
            "Notification permission was not granted. " +
            "Enable notifications in Android Settings."
          );
          return;
        }

        // Register with Firebase Cloud Messaging.
        await PushNotifications.register();
      } catch (error) {
        console.error(
          "Push notification setup failed:",
          error
        );
      } finally {
        registering = false;
      }
    };

    void setup();

    return () => {
      active = false;

      for (const listener of listeners) {
        void listener.remove();
      }

      listeners = [];
    };
  }, [user?.id]);

  return null;
}

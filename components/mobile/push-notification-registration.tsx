
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

    type PushListener = Awaited<
      ReturnType<typeof PushNotifications.addListener>
    >;

    const listeners: PushListener[] = [];

    const setup = async () => {
      try {
        // Create the Android notification channel.
        if (Capacitor.getPlatform() === "android") {
          await PushNotifications.createChannel({
            id: "learnpathshala_alerts",
            name: "LearnPathshala Alerts",
            description: "Learning and account notifications",
            importance: 5,
            sound: "default",
            vibration: true,
          });
        }

        if (!active) return;

        // Save the Firebase device token in Supabase.
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

        // Runs when a notification arrives while the app is open.
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

        // Runs when the student taps a notification.
        const actionListener =
          await PushNotifications.addListener(
            "pushNotificationActionPerformed",
            (action) => {
              console.log("Push notification opened:", action);

              const url = action.notification.data?.url;

              // Always send live-class notifications to the
              // student live-classes listing.
              if (
                typeof url === "string" &&
                (
                  url.includes("/live-class/") ||
                  url.includes("/dashboard/student/live-classes")
                )
              ) {
                window.location.href =
                  "/dashboard/student/live-classes";
                return;
              }

              // Accept safe relative URLs only.
              if (
                typeof url === "string" &&
                url.startsWith("/") &&
                !url.startsWith("//") &&
                !url.includes("\\")
              ) {
                window.location.href = url;
                return;
              }

              // Safe fallback for missing or invalid URLs.
              window.location.href =
                "/dashboard/student/live-classes";
            }
          );

        listeners.push(actionListener);

        if (!active) return;

        // Check notification permission.
        let permission =
          await PushNotifications.checkPermissions();

        if (!active) return;

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
      }
    };

    void setup();

    return () => {
      active = false;

      for (const listener of listeners) {
        void listener.remove();
      }
    };
  }, [user?.id]);

  return null;
}

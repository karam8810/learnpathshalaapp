
"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

export default function PushNotificationRegistration() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id || !Capacitor.isNativePlatform()) return;

    let active = true;
    let listeners:
      | Awaited<ReturnType<typeof PushNotifications.addListener>>[] = [];

    const setup = async () => {
      try {
        const registrationListener = await PushNotifications.addListener(
          "registration",
          async ({ value: token }) => {
            if (!active) return;

            const { error } = await supabase
              .from("student_push_tokens")
              .upsert(
                {
                  token,
                  user_id: user.id,
                  platform: Capacitor.getPlatform(),
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "token" }
              );

            if (error) {
              console.error("Saving push token failed:", error.message);
            } else {
              console.log("Push token saved successfully.");
            }
          }
        );
        listeners.push(registrationListener);

        const errorListener = await PushNotifications.addListener(
          "registrationError",
          (error) => console.error("Push registration failed:", error)
        );
        listeners.push(errorListener);

        const receivedListener = await PushNotifications.addListener(
          "pushNotificationReceived",
          (notification) => {
            console.log("Push notification received:", notification);
          }
        );
        listeners.push(receivedListener);

        const actionListener = await PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (action) => {
            console.log("Push notification opened:", action);
          }
        );
        listeners.push(actionListener);

        const permission = await PushNotifications.requestPermissions();

        if (!active) return;

        if (permission.receive !== "granted") {
          console.warn("Notification permission was not granted.");
          return;
        }

        await PushNotifications.register();
      } catch (error) {
        console.error("Push notification setup failed:", error);
      }
    };

    void setup();

    return () => {
      active = false;
      listeners.forEach((listener) => void listener.remove());
    };
  }, [user?.id]);

  return null;
}

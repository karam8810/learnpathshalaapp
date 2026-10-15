
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.learnpathshala.app",
  appName: "LearnPathshala",
  webDir: "public",
  server: {
    url: "https://learnpathshala.com/mobileapp/student",
    cleartext: false,
  },
};

export default config;

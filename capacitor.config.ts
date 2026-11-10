
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.learnpathshala.app",
  appName: "LearnPathshala",
  webDir: "public",

  server: {
    url: "https://www.learnpathshala.com/mobileapp/student",
    cleartext: false,
    allowNavigation: [
      "www.learnpathshala.com",
      "learnpathshala.com"
    ],
  },
};

export default config;

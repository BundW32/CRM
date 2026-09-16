import { Config } from "@remotion/cli/config";

// Der passende Browser liegt im Image; Remotion soll keinen eigenen laden.
// Ohne das scheitert der Render in dieser Umgebung am gesperrten Download.
Config.setBrowserExecutable(
  process.env.REMOTION_BROWSER ??
    "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
);

Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setCrf(18);
Config.setConcurrency(4);

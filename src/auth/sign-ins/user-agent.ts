type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";

export type DeviceSummary = Readonly<{
  browser: string;
  os: string;
  deviceType: DeviceType;
}>;

const UNKNOWN_LABEL = "Unknown";

type Rule = readonly [label: string, pattern: RegExp];

// Order matters: Chromium forks and iOS wrappers also carry the token of the engine they embed.
const BROWSER_RULES: readonly Rule[] = [
  ["Samsung Internet", /\bSamsungBrowser\//],
  ["Edge", /\bEdgA?\/|\bEdgiOS\/|\bEdge\//],
  ["Opera", /\bOPR\/|\bOPiOS\/|\bOPT\/|\bOpera\b/],
  ["Firefox", /\bFirefox\/|\bFxiOS\//],
  ["Chrome", /\bChrome\/|\bCriOS\//],
  ["Safari", /\bSafari\//],
];

// Order matters: iPadOS and iOS agents say "like Mac OS X", Android and ChromeOS agents say "Linux".
const OS_RULES: readonly Rule[] = [
  ["iOS", /\b(?:iPhone|iPad|iPod)\b/],
  ["Android", /\bAndroid\b/],
  ["Windows", /\bWindows\b/],
  ["ChromeOS", /\bCrOS\b/],
  ["macOS", /\bMac OS X\b|\bMacintosh\b/],
  ["Linux", /\bLinux\b/],
];

const TABLET_PATTERN = /\biPad\b/;
const ANDROID_PHONE_PATTERN = /\bMobile\b/;

const firstMatch = (rules: readonly Rule[], userAgent: string): string =>
  rules.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? UNKNOWN_LABEL;

const detectDeviceType = (os: string, userAgent: string): DeviceType => {
  if (os === UNKNOWN_LABEL) return "unknown";
  if (TABLET_PATTERN.test(userAgent)) return "tablet";
  if (os === "iOS") return "mobile";
  // Android tablets leave "Mobile" out of the agent; phones keep it.
  if (os === "Android") return ANDROID_PHONE_PATTERN.test(userAgent) ? "mobile" : "tablet";
  return "desktop";
};

/**
 * Derives browser, OS and device type from a raw user agent, for display only:
 * any client can send any agent, so never use the result as a trust signal.
 * Never throws for a string, null or undefined; missing or unmatched parts report "Unknown".
 * Limits of the agent itself: an unlisted Chromium or WebKit browser reports as Chrome or Safari,
 * and iPadOS (default mode) and large Android tablets (desktop-site mode) report as a desktop.
 */
export const parseUserAgent = (userAgent: string | null | undefined): DeviceSummary => {
  const agent = userAgent ?? "";
  const os = firstMatch(OS_RULES, agent);
  return {browser: firstMatch(BROWSER_RULES, agent), os, deviceType: detectDeviceType(os, agent)};
};

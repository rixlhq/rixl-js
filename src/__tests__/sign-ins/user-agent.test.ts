import {describe, it, expect} from "vite-plus/test";
import fc from "fast-check";
import {parseUserAgent, type DeviceSummary} from "../../auth/sign-ins/user-agent";

const CHROME_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const CHROME_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const CHROME_LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const CHROME_ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const CHROME_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1";
const CHROME_OS = "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SAFARI_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
const SAFARI_IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
const FIREFOX_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";
const FIREFOX_LINUX = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";
const FIREFOX_ANDROID = "Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0";
const FIREFOX_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/121.0 Mobile/15E148 Safari/605.1.15";
const SAMSUNG_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36";
const OPERA_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 OPT/4.4.0 Mobile/15E148 Safari/604.1";
// iPadOS 13+ sends a Mac agent by default, so the agent alone can't tell it from a Mac.
const SAFARI_IPAD_DEFAULT = SAFARI_MAC;
const FIREFOX_FREEBSD = "Mozilla/5.0 (X11; FreeBSD amd64; rv:121.0) Gecko/20100101 Firefox/121.0";
const EDGE_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
const EDGE_ANDROID =
  "Mozilla/5.0 (Linux; Android 8.1.0; Pixel Build/OPM4.171019.021.D1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.109 Mobile Safari/537.36 EdgA/42.0.0.2057";
const EDGE_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 12_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.1 EdgiOS/44.5.0.10 Mobile/15E148 Safari/604.1";
const EDGE_LEGACY_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.19582";
const OPERA_MINI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 7_1_1 like Mac OS X) AppleWebKit/537.51.2 (KHTML, like Gecko) OPiOS/8.0.1.80062 Mobile/11D201 Safari/9537.53";
const OPERA_ANDROID =
  "Mozilla/5.0 (Linux; Android; 4.1.2; GT-I9100 Build/000000) AppleWebKit/537.22 (KHTML, like Gecko) Chrome/25.0.1234.12 Mobile Safari/537.22 OPR/14.0.123.123";
const OPERA_LEGACY_WINDOWS = "Opera/9.80 (Windows NT 5.1; U; ru) Presto/2.5.24 Version/10.53";
const OPERA_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0";

const UNKNOWN: DeviceSummary = {browser: "Unknown", os: "Unknown", deviceType: "unknown"};

describe("parseUserAgent", () => {
  it.each<[string, string, DeviceSummary]>([
    ["Chrome on Windows", CHROME_WINDOWS, {browser: "Chrome", os: "Windows", deviceType: "desktop"}],
    ["Chrome on macOS", CHROME_MAC, {browser: "Chrome", os: "macOS", deviceType: "desktop"}],
    ["Chrome on Linux", CHROME_LINUX, {browser: "Chrome", os: "Linux", deviceType: "desktop"}],
    ["Chrome on ChromeOS", CHROME_OS, {browser: "Chrome", os: "ChromeOS", deviceType: "desktop"}],
    ["Chrome on an Android phone", CHROME_ANDROID, {browser: "Chrome", os: "Android", deviceType: "mobile"}],
    ["Chrome on an Android tablet", CHROME_ANDROID_TABLET, {browser: "Chrome", os: "Android", deviceType: "tablet"}],
    ["Chrome on iPhone", CHROME_IOS, {browser: "Chrome", os: "iOS", deviceType: "mobile"}],
    ["Safari on macOS", SAFARI_MAC, {browser: "Safari", os: "macOS", deviceType: "desktop"}],
    ["Safari on iPhone", SAFARI_IPHONE, {browser: "Safari", os: "iOS", deviceType: "mobile"}],
    ["Safari on iPad in mobile-site mode", SAFARI_IPAD, {browser: "Safari", os: "iOS", deviceType: "tablet"}],
    ["Firefox on Windows", FIREFOX_WINDOWS, {browser: "Firefox", os: "Windows", deviceType: "desktop"}],
    ["Firefox on Linux", FIREFOX_LINUX, {browser: "Firefox", os: "Linux", deviceType: "desktop"}],
    ["Firefox on Android", FIREFOX_ANDROID, {browser: "Firefox", os: "Android", deviceType: "mobile"}],
    ["Firefox on iPhone", FIREFOX_IOS, {browser: "Firefox", os: "iOS", deviceType: "mobile"}],
    [
      "Safari on iPad in default desktop mode (indistinguishable from a Mac)",
      SAFARI_IPAD_DEFAULT,
      {browser: "Safari", os: "macOS", deviceType: "desktop"},
    ],
    ["Samsung Internet on Android", SAMSUNG_ANDROID, {browser: "Samsung Internet", os: "Android", deviceType: "mobile"}],
    ["Opera on iPhone", OPERA_IOS, {browser: "Opera", os: "iOS", deviceType: "mobile"}],
    ["Edge on Windows", EDGE_WINDOWS, {browser: "Edge", os: "Windows", deviceType: "desktop"}],
    ["Edge on Android", EDGE_ANDROID, {browser: "Edge", os: "Android", deviceType: "mobile"}],
    ["Edge on iPhone", EDGE_IOS, {browser: "Edge", os: "iOS", deviceType: "mobile"}],
    ["legacy Edge on Windows", EDGE_LEGACY_WINDOWS, {browser: "Edge", os: "Windows", deviceType: "desktop"}],
    ["Opera Mini on iPhone", OPERA_MINI_IOS, {browser: "Opera", os: "iOS", deviceType: "mobile"}],
    ["Opera on Android", OPERA_ANDROID, {browser: "Opera", os: "Android", deviceType: "mobile"}],
    ["Opera on Windows", OPERA_WINDOWS, {browser: "Opera", os: "Windows", deviceType: "desktop"}],
    ["Presto Opera on Windows", OPERA_LEGACY_WINDOWS, {browser: "Opera", os: "Windows", deviceType: "desktop"}],
  ])("labels %s", (_name, userAgent, expected) => {
    expect(parseUserAgent(userAgent)).toEqual(expected);
  });

  it.each<[string, string | null | undefined]>([
    ["an empty agent", ""],
    ["a whitespace agent", "   "],
    ["a missing agent", undefined],
    ["a null agent", null],
    ["an unrecognised agent", "curl/8.4.0"],
    ["gibberish", "\u0000� not a user agent"],
  ])("reports unknown for %s", (_name, userAgent) => {
    expect(parseUserAgent(userAgent)).toEqual(UNKNOWN);
  });

  it("does not report an X11 BSD as Linux", () => {
    expect(parseUserAgent(FIREFOX_FREEBSD)).toEqual({browser: "Firefox", os: "Unknown", deviceType: "unknown"});
  });

  it("keeps a known OS and device type when the browser is unknown", () => {
    expect(parseUserAgent("MyApp/1.0 (Linux; Android 14; Mobile)")).toEqual({browser: "Unknown", os: "Android", deviceType: "mobile"});
  });

  it.each<[string, DeviceSummary]>([
    ["Example/1.0 (iPod touch; CPU like Mac OS X)", {browser: "Unknown", os: "iOS", deviceType: "mobile"}],
    ["Example/1.0 (Macintosh)", {browser: "Unknown", os: "macOS", deviceType: "desktop"}],
    ["Example/1.0 (Mac OS X)", {browser: "Unknown", os: "macOS", deviceType: "desktop"}],
    ["Example/1.0 (iPhone; iPadApp)", {browser: "Unknown", os: "iOS", deviceType: "mobile"}],
    ["Example/1.0 (iPhone; AppiPad)", {browser: "Unknown", os: "iOS", deviceType: "mobile"}],
    ["Example/1.0 (Android; MobileApp)", {browser: "Unknown", os: "Android", deviceType: "tablet"}],
    ["Example/1.0 (Android; AppMobile)", {browser: "Unknown", os: "Android", deviceType: "tablet"}],
  ])("classifies device and OS tokens in %s", (userAgent, expected) => {
    expect(parseUserAgent(userAgent)).toEqual(expected);
  });

  it("never throws and always returns a complete summary", () => {
    fc.assert(
      fc.property(fc.string({maxLength: 400}), (userAgent) => {
        const summary = parseUserAgent(userAgent);
        expect(summary.browser.length).toBeGreaterThan(0);
        expect(summary.os.length).toBeGreaterThan(0);
        expect(["desktop", "mobile", "tablet", "unknown"]).toContain(summary.deviceType);
      })
    );
  });
});

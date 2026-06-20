// Default filter lists to load
export const DEFAULT_FILTER_LISTS = {
  easylist: {
    name: "EasyList",
    url: "https://easylist.to/easylist/easylist.txt",
    description: "Standard advertising list",
  },
  easylistprivacy: {
    name: "EasyPrivacy",
    url: "https://easylist.to/easylist/easyprivacy.txt",
    description: "Privacy tracking protection list",
  },
  ublockfilters: {
    name: "uBlock Filters",
    url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt",
    description: "uBlock Origin ad filters",
  },
};

// Preferences
export const PREFS = {
  ENABLED: "browser.adblock.enabled",
  FILTER_LISTS: "browser.adblock.filterlists",
  CUSTOM_FILTERS: "browser.adblock.customfilters",
  DEBUG: "browser.adblock.debug",
  STATS_ENABLED: "browser.adblock.stats",
  SITE_SETTINGS: "lykon.shield.site.settings",
};

// Resource type categories used in filter matching
export const RESOURCE_TYPES = {
  DOCUMENT: "document",
  SCRIPT: "script",
  STYLESHEET: "stylesheet",
  IMAGE: "image",
  FONT: "font",
  XMLHTTPREQUEST: "xmlhttprequest",
  MEDIA: "media",
  OBJECT: "object",
  OTHER: "other",
};

// Status codes for operations
export const STATUS = {
  SUCCESS: 0,
  ERROR: 1,
  NOT_INITIALIZED: 2,
  INVALID_INPUT: 3,
  FILTER_ERROR: 4,
};

// Logging levels
export const LOG_LEVEL = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Cache settings
export const CACHE_CONFIG = {
  ENABLED: true,
  MAX_SIZE: 10000, // Maximum cached results
  TTL: 3600, // Time-to-live in seconds
};

// Feature flags
export const FEATURES = {
  COSMETIC_FILTERING: true,
  NATIVE_ENGINE: true,
  DYNAMIC_UPDATES: false,
  RESOURCE_REPLACEMENT: false,
  DEBUGGING: true,
};

// Performance thresholds (in milliseconds)
export const PERF_THRESHOLDS = {
  FILTER_LOAD_WARNING: 100,
  URL_CHECK_WARNING: 10,
};

export const MEDIA_ALLOWLIST_DOMAINS = new Set([
  "googlevideo.com",
  "youtube.com",
  "youtu.be",
  "ytimg.com",
  "yt3.ggpht.com",
  "yt3.googleusercontent.com",
  "googleapis.com",
  "gvt1.com",
  "gvt2.com",
  "gvt3.com",
]);

export const MEDIA_STREAM_PATTERNS = [
  "videoplayback",
  "mime=video",
  "mime=audio",
  "itag=",
  "yt_live_broadcast",
  "/api/timedtext",
  "googlevideo.com",
  "live_chat",
  "live_chat_replay",
];

export const SAFE_MEDIA_TYPES = new Set([
  "media",
  "object",
  "xmlhttprequest",
  "subdocument",
  "document",
]);

export default {
  DEFAULT_FILTER_LISTS,
  PREFS,
  RESOURCE_TYPES,
  STATUS,
  LOG_LEVEL,
  CACHE_CONFIG,
  FEATURES,
  PERF_THRESHOLDS,
  MEDIA_ALLOWLIST_DOMAINS,
  MEDIA_STREAM_PATTERNS,
  SAFE_MEDIA_TYPES,
};

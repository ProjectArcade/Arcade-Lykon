/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

import { ctypes } from "resource://gre/modules/ctypes.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  filterManager: "resource:///modules/FilterManager.sys.mjs",
});

// --- Native Engine Constants ---

const MEDIA_ALLOWLIST_DOMAINS = new Set([
  "youtu.be",
  "ytimg.com",
  "yt3.ggpht.com",
  "yt3.googleusercontent.com",
  "googleapis.com",
  "gvt1.com",
  "gvt2.com",
  "gvt3.com",
]);

const MEDIA_STREAM_PATTERNS = [
  "videoplayback",
  "mime=video",
  "mime=audio",
  "itag=",
  "yt_live_broadcast",
  "/api/timedtext",
  "live_chat",
  "live_chat_replay",
];

const SAFE_MEDIA_TYPES = new Set([
  "media",
  "object",
  "xmlhttprequest",
  "subdocument",
  "document",
]);

// --- Native Engine Implementation ---

class _NativeAdblockEngine {
  constructor() {
    this._lib = null;
    this._engine = null;
    this._fns = {};
    this._loaded = false;
    this._rulesLoaded = 0;
  }

  get loaded() {
    return this._loaded && this._engine && !this._engine.isNull();
  }

  init() {
    if (this._loaded) return true;
    try {
      const libPath = this._findLibrary();
      if (!libPath) {
        console.error("[NativeAdblockEngine] libadblock.so not found");
        return false;
      }

      this._lib = ctypes.open(libPath);

      this._fns.create = this._lib.declare(
        "adblock_engine_create",
        ctypes.default_abi,
        ctypes.voidptr_t
      );

      this._fns.destroy = this._lib.declare(
        "adblock_engine_destroy",
        ctypes.default_abi,
        ctypes.void_t,
        ctypes.voidptr_t
      );

      const safeDeclare = (name, abi, ret, ...args) => {
        try {
          return this._lib.declare(name, abi, ret, ...args);
        } catch (e) {
          console.warn(`[NativeAdblockEngine] Function ${name} not found in library:`, e.message);
          return null;
        }
      };

      this._fns.addFilterList = safeDeclare(
        "adblock_engine_add_filter_list",
        ctypes.default_abi,
        ctypes.uint8_t,
        ctypes.voidptr_t,
        ctypes.char.ptr
      );

      this._fns.checkNetworkUrl = safeDeclare(
        "adblock_engine_check_network_url",
        ctypes.default_abi,
        ctypes.uint8_t,
        ctypes.voidptr_t,
        ctypes.char.ptr,
        ctypes.char.ptr,
        ctypes.char.ptr
      );

      this._fns.getCosmeticResources = safeDeclare(
        "adblock_engine_get_cosmetic_resources",
        ctypes.default_abi,
        ctypes.char.ptr,
        ctypes.voidptr_t,
        ctypes.char.ptr
      );

      this._fns.getHiddenClassIdSelectors = safeDeclare(
        "adblock_engine_get_hidden_class_id_selectors",
        ctypes.default_abi,
        ctypes.char.ptr,
        ctypes.voidptr_t,
        ctypes.char.ptr,
        ctypes.char.ptr,
        ctypes.char.ptr
      );

      this._fns.freeString = safeDeclare(
        "adblock_free_string",
        ctypes.default_abi,
        ctypes.void_t,
        ctypes.char.ptr
      );

      this._engine = this._fns.create();
      if (!this._engine || this._engine.isNull()) {
        console.error("[NativeAdblockEngine] adblock_engine_create returned null");
        this._cleanup();
        return false;
      }

      this._loaded = true;
      return true;
    } catch (e) {
      console.error("[NativeAdblockEngine] Failed to load:", e);
      this._cleanup();
      return false;
    }
  }

  _findLibrary() {
    const candidates = [];

    try {
      const greBinDir = Services.dirsvc.get("GreBinD", Ci.nsIFile);
      const f = greBinDir.clone();
      f.append("libadblock.so");
      candidates.push(f.path);

      const fb = greBinDir.clone();
      fb.append("browser");
      fb.append("bin");
      fb.append("libadblock.so");
      candidates.push(fb.path);
    } catch (e) {}

    try {
      const greDir = Services.dirsvc.get("GreD", Ci.nsIFile);
      const f = greDir.clone();
      f.append("libadblock.so");
      candidates.push(f.path);

      const fb = greDir.clone();
      fb.append("browser");
      fb.append("bin");
      fb.append("libadblock.so");
      candidates.push(fb.path);
    } catch (e) {}

    try {
      const xreDir = Services.dirsvc.get("XREExeF", Ci.nsIFile);
      const dir = xreDir.parent;
      const f = dir.clone();
      f.append("libadblock.so");
      candidates.push(f.path);

      const fb = dir.clone();
      fb.append("browser");
      fb.append("bin");
      fb.append("libadblock.so");
      candidates.push(fb.path);
    } catch (e) {}

    for (const path of candidates) {
      try {
        const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        file.initWithPath(path);
        if (file.exists()) {
          return path;
        }
      } catch (e) {}
    }

    console.warn(
      "[NativeAdblockEngine] Library not found in candidates:",
      candidates
    );
    return null;
  }

  addFilterList(rulesText) {
    if (!this.loaded) return false;
    try {
      const result = this._fns.addFilterList(this._engine, rulesText);
      if (result) {
        const lineCount = rulesText.split("\n").length;
        this._rulesLoaded += lineCount;
        return true;
      }
      return false;
    } catch (e) {
      console.error("[NativeAdblockEngine] addFilterList failed:", e);
      return false;
    }
  }

  async loadBuiltinLists() {
    const lists = [
      "resource:///modules/easylist.txt",
      "resource:///modules/easyprivacy.txt",
      "resource:///modules/ublock-filters.txt",
    ];

    let allRules = "";
    for (const url of lists) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const text = await response.text();
          allRules += text + "\n";
        }
      } catch (e) {
        console.warn(`[NativeAdblockEngine] Could not read ${url}:`, e);
      }
    }

    if (allRules.length > 0) {
      try {
        const result = this.addFilterList(allRules);
        if (result) {
          return allRules.split("\n").length;
        }
      } catch (e) {
        console.error("[NativeAdblockEngine] Failed to load combined rules:", e);
      }
    }
    return 0;
  }

  shouldBlock(url, sourceUrl, resourceType) {
    if (!this.loaded) return false;

    if (url.includes("live_chat") || url.includes("live_chat_replay")) {
      return false;
    }

    try {
      const hostname = new URL(url).hostname;
      if (
        SAFE_MEDIA_TYPES.has(resourceType) &&
        this._isMediaAllowlisted(hostname, url)
      ) {
        return false;
      }
    } catch (e) {}

    // Refined Media Stream Handling
    // We allow standard video content but MUST filter if it looks like an ad segment
    if (url.includes("videoplayback")) {
      const isAdSegment = url.includes("adformat") || 
                         url.includes("ptracking") || 
                         url.includes("oad") ||
                         url.includes("ov") ||
                         url.includes("oadid");
      if (!isAdSegment) return false; // Allow pure video content
    }

    // Other media patterns that are safe to allow (e.g. live chat)
    const SAFE_PATTERNS = ["live_chat", "live_chat_replay", "/api/timedtext"];
    for (const pattern of SAFE_PATTERNS) {
      if (url.includes(pattern)) return false;
    }

    try {
      const result = this._fns.checkNetworkUrl(
        this._engine,
        url,
        sourceUrl || "",
        resourceType || "other"
      );
      return !!result;
    } catch (e) {
      console.error("[NativeAdblockEngine] checkNetworkUrl failed:", e);
      return false;
    }
  }

  getCosmeticResources(url) {
    if (!this.loaded || !this._fns.getCosmeticResources) return null;
    try {
      const ptr = this._fns.getCosmeticResources(this._engine, url);
      if (!ptr || ptr.isNull()) return null;
      const json = ptr.readString();
      if (this._fns.freeString) {
        this._fns.freeString(ptr);
      }
      return JSON.parse(json);
    } catch (e) {
      console.error("[NativeAdblockEngine] getCosmeticResources failed:", e);
      return null;
    }
  }

  getHiddenClassIdSelectors(classes, ids, exceptions) {
    if (!this.loaded || !this._fns.getHiddenClassIdSelectors) return [];
    try {
      const ptr = this._fns.getHiddenClassIdSelectors(
        this._engine,
        JSON.stringify(classes),
        JSON.stringify(ids),
        JSON.stringify(exceptions)
      );
      if (!ptr || ptr.isNull()) return [];
      const json = ptr.readString();
      if (this._fns.freeString) {
        this._fns.freeString(ptr);
      }
      return JSON.parse(json);
    } catch (e) {
      console.error("[NativeAdblockEngine] getHiddenClassIdSelectors failed:", e);
      return [];
    }
  }

  _isMediaAllowlisted(hostname, url) {
    for (const domain of MEDIA_ALLOWLIST_DOMAINS) {
      if (hostname === domain || hostname.endsWith("." + domain)) {
        return true;
      }
    }
    return false;
  }

  get rulesLoaded() {
    return this._rulesLoaded;
  }

  _cleanup() {
    try {
      if (this._engine && !this._engine.isNull() && this._fns.destroy) {
        this._fns.destroy(this._engine);
      }
    } catch (e) {}
    this._engine = null;

    try {
      if (this._lib) this._lib.close();
    } catch (e) {}
    this._lib = null;

    this._fns = {};
    this._loaded = false;
    this._rulesLoaded = 0;
  }

  shutdown() {
    this._cleanup();
  }
}

const NativeAdblockEngine = new _NativeAdblockEngine();

// --- Adblock Service Implementation ---

class _AdblockService {
  constructor() {
    this.enabled = true;
    this._initialized = false;
    this._useNative = false;
    this._stats = {
      blocked: 0,
      allowed: 0,
      startTime: Date.now(),
    };
  }

  async init() {
    if (this._initialized) return;

    let nativeOk = false;
    try {
      nativeOk = NativeAdblockEngine.init();
    } catch (e) {
      console.warn("[AdblockService] Native engine load failed:", e);
    }

    if (nativeOk) {
      try {
        const count = await NativeAdblockEngine.loadBuiltinLists();
        if (count > 0) {
          this._useNative = true;
          this._initialized = true;
          console.log(
            `[AdblockService] Native engine initialized with ${count} rules`
          );
          return;
        }
        console.warn(
          "[AdblockService] Native engine loaded 0 rules, falling back to JS"
        );
      } catch (e) {
        console.warn(
          "[AdblockService] Native engine filter load failed:", e
        );
      }
    }

    try {
      await lazy.filterManager.init();
      this._useNative = false;
      this._initialized = true;
      console.log("[AdblockService] Fallback JS FilterManager initialized");
    } catch (e) {
      console.error("[AdblockService] All engines failed to init:", e);
      throw e;
    }
  }

  shouldBlock(url, originUrl, resourceType) {
    if (!this.enabled || !this._initialized) return false;
    try {
      let blocked = false;
      if (this._useNative) {
        blocked = NativeAdblockEngine.shouldBlock(
          url,
          originUrl,
          resourceType
        );
      }
      
      // Fallback to JS engine if native didn't block it
      if (!blocked) {
        blocked = lazy.filterManager.matches(url, originUrl, resourceType);
        if (blocked && this._useNative) {
          // Keep a quiet log for missed native rules
        }
      }
      
      return blocked;
    } catch (e) {
      console.error("[AdblockService] shouldBlock error:", e);
      return false;
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  getStats() {
    return { ...this._stats };
  }

  incrementBlocked() {
    this._stats.blocked++;
  }

  incrementAllowed() {
    this._stats.allowed++;
  }

  async addFilterList(name, rules) {
    if (this._useNative) {
      NativeAdblockEngine.addFilterList(rules);
    }
    await lazy.filterManager.addList(name, rules);
  }

  getCosmeticResources(url) {
    if (!this.enabled || !this._initialized) return null;
    if (this._useNative) {
      return NativeAdblockEngine.getCosmeticResources(url);
    }
    return null; // Fallback JS engine doesn't support this yet
  }

  getHiddenClassIdSelectors(classes, ids, exceptions) {
    if (!this.enabled || !this._initialized) return [];
    if (this._useNative) {
      return NativeAdblockEngine.getHiddenClassIdSelectors(
        classes,
        ids,
        exceptions
      );
    }
    return [];
  }

  get isNative() {
    return this._useNative;
  }

  shutdown() {
    if (this._useNative) {
      try {
        NativeAdblockEngine.shutdown();
      } catch (e) {}
    }
  }
}

export const AdblockService = new _AdblockService();
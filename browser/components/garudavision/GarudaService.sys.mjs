/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

import { ctypes } from "resource://gre/modules/ctypes.sys.mjs";

class _GarudaService {
  constructor() {
    this._lib = null;
    this._loaded = false;
    this._fns = {};
  }

  get loaded() {
    return this._loaded;
  }

  init() {
    if (this._loaded) return true;
    try {
      const libPath = this._findLibrary();
      if (!libPath) {
        console.error("[GarudaVision] libgaruda_ffi.so not found");
        return false;
      }

      this._lib = ctypes.open(libPath);

      this._fns.checkUrl = this._lib.declare(
        "garuda_check_url",
        ctypes.default_abi,
        ctypes.uint8_t,
        ctypes.char.ptr
      );

      this._fns.checkPage = this._lib.declare(
        "garuda_check_page",
        ctypes.default_abi,
        ctypes.uint8_t,
        ctypes.char.ptr,
        ctypes.char.ptr
      );

      this._fns.checkUrlReasons = this._lib.declare(
        "garuda_check_url_reasons",
        ctypes.default_abi,
        ctypes.char.ptr,
        ctypes.char.ptr
      );

      this._fns.freeString = this._lib.declare(
        "garuda_free_string",
        ctypes.default_abi,
        ctypes.void_t,
        ctypes.char.ptr
      );

      this._loaded = true;
      console.log("[GarudaVision] Native Garuda phishing detection engine loaded successfully");
      return true;
    } catch (e) {
      console.error("[GarudaVision] Failed to load native library:", e);
      this._cleanup();
      return false;
    }
  }

  checkUrl(url) {
    if (!this._loaded) {
      console.warn("[GarudaVision] Not initialized, init() called automatically");
      if (!this.init()) return 0; // Return clean score if FFI fails to load
    }
    try {
      return this._fns.checkUrl(url);
    } catch (e) {
      console.error("[GarudaVision] checkUrl failed:", e);
      return 0;
    }
  }

  checkPage(url, html) {
    if (!this._loaded) {
      console.warn("[GarudaVision] Not initialized, init() called automatically");
      if (!this.init()) return 0;
    }
    try {
      return this._fns.checkPage(url, html);
    } catch (e) {
      console.error("[GarudaVision] checkPage failed:", e);
      return 0;
    }
  }

  checkUrlReasons(url) {
    if (!this._loaded) {
      console.warn("[GarudaVision] Not initialized, init() called automatically");
      if (!this.init()) return [];
    }
    try {
      const ptr = this._fns.checkUrlReasons(url);
      if (!ptr || ptr.isNull()) return [];
      const json = ptr.readString();
      if (this._fns.freeString) {
        this._fns.freeString(ptr);
      }
      return JSON.parse(json);
    } catch (e) {
      console.error("[GarudaVision] checkUrlReasons failed:", e);
      return [];
    }
  }

  _findLibrary() {
    const candidates = [];

    try {
      const greBinDir = Services.dirsvc.get("GreBinD", Ci.nsIFile);
      const f = greBinDir.clone();
      f.append("libgaruda_ffi.so");
      candidates.push(f.path);

      const fb = greBinDir.clone();
      fb.append("browser");
      fb.append("bin");
      fb.append("libgaruda_ffi.so");
      candidates.push(fb.path);
    } catch (e) {}

    try {
      const greDir = Services.dirsvc.get("GreD", Ci.nsIFile);
      const f = greDir.clone();
      f.append("libgaruda_ffi.so");
      candidates.push(f.path);

      const fb = greDir.clone();
      fb.append("browser");
      fb.append("bin");
      fb.append("libgaruda_ffi.so");
      candidates.push(fb.path);
    } catch (e) {}

    try {
      const xreDir = Services.dirsvc.get("XREExeF", Ci.nsIFile);
      const dir = xreDir.parent;
      const f = dir.clone();
      f.append("libgaruda_ffi.so");
      candidates.push(f.path);

      const fb = dir.clone();
      fb.append("browser");
      fb.append("bin");
      fb.append("libgaruda_ffi.so");
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
      "[GarudaVision] Library libgaruda_ffi.so not found in candidates:",
      candidates
    );
    return null;
  }

  _cleanup() {
    this._lib = null;
    this._loaded = false;
    this._fns = {};
  }

  shutdown() {
    this._cleanup();
  }
}

export const GarudaService = new _GarudaService();
export default GarudaService;

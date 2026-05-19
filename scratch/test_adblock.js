
const { ctypes } = ChromeUtils.importESModule("resource://gre/modules/ctypes.sys.mjs");

function test() {
  const libPath = "/run/media/notspidey/extra/Arcade-Lykon/obj-x86_64-pc-linux-gnu/dist/bin/libadblock.so";
  const lib = ctypes.open(libPath);
  
  const create = lib.declare("adblock_engine_create", ctypes.default_abi, ctypes.voidptr_t);
  const add = lib.declare("adblock_engine_add_filter_list", ctypes.default_abi, ctypes.bool, ctypes.voidptr_t, ctypes.char.ptr);
  const check = lib.declare("adblock_engine_check_network_url", ctypes.default_abi, ctypes.bool, ctypes.voidptr_t, ctypes.char.ptr, ctypes.char.ptr, ctypes.char.ptr);
  const destroy = lib.declare("adblock_engine_destroy", ctypes.default_abi, ctypes.void_t, ctypes.voidptr_t);

  const engine = create();
  console.log("Engine created:", !engine.isNull());

  const rules = "||media.net^$script\n||doubleclick.net^";
  const added = add(engine, rules);
  console.log("Rules added:", added);

  const result1 = check(engine, "https://hbx.media.net/js/test.js", "https://aljazeera.com/", "script");
  console.log("Check media.net (should be true):", result1);

  const result2 = check(engine, "https://google.com/index.html", "https://aljazeera.com/", "document");
  console.log("Check google.com (should be false):", result2);

  destroy(engine);
  lib.close();
}

test();

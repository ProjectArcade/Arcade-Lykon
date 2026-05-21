const { ctypes } = ChromeUtils.importESModule("resource://gre/modules/ctypes.sys.mjs");

function test() {
  const libPath = "/run/media/notspidey/extra/Arcade-Lykon/obj-x86_64-pc-linux-gnu/dist/bin/libadblock.so";
  const lib = ctypes.open(libPath);
  
  const create = lib.declare("adblock_engine_create", ctypes.default_abi, ctypes.voidptr_t);
  const add = lib.declare("adblock_engine_add_filter_list", ctypes.default_abi, ctypes.bool, ctypes.voidptr_t, ctypes.char.ptr);
  const getCosmetic = lib.declare("adblock_engine_get_cosmetic_resources", ctypes.default_abi, ctypes.char.ptr, ctypes.voidptr_t, ctypes.char.ptr);
  const getHidden = lib.declare("adblock_engine_get_hidden_class_id_selectors", ctypes.default_abi, ctypes.char.ptr, ctypes.voidptr_t, ctypes.char.ptr, ctypes.char.ptr, ctypes.char.ptr);
  const freeStr = lib.declare("adblock_free_string", ctypes.default_abi, ctypes.void_t, ctypes.char.ptr);
  const destroy = lib.declare("adblock_engine_destroy", ctypes.default_abi, ctypes.void_t, ctypes.voidptr_t);

  const engine = create();
  console.log("Engine created:", !engine.isNull());

  const rules = "||media.net^$script\n||doubleclick.net^\n##.ad-slot\n###some-ad-id\nyoutube.com##.yt-ad-class\nyoutube.com#@#.allowed-class";
  const added = add(engine, rules);
  console.log("Rules added:", added);

  // Test getCosmeticResources
  console.log("Calling getCosmeticResources...");
  const ptr1 = getCosmetic(engine, "https://youtube.com/");
  console.log("ptr1 is null:", ptr1.isNull());
  if (!ptr1.isNull()) {
    const res = ptr1.readString();
    console.log("Cosmetic resources string:", res);
    freeStr(ptr1);
  }

  // Test getHiddenClassIdSelectors
  console.log("Calling getHiddenClassIdSelectors...");
  const classesJson = JSON.stringify(["yt-ad-class", "other-class"]);
  const idsJson = JSON.stringify(["some-ad-id", "other-id"]);
  const exceptionsJson = JSON.stringify(["allowed-class"]);
  const ptr2 = getHidden(engine, classesJson, idsJson, exceptionsJson);
  console.log("ptr2 is null:", ptr2.isNull());
  if (!ptr2.isNull()) {
    const res = ptr2.readString();
    console.log("Hidden selectors:", res);
    freeStr(ptr2);
  }

  destroy(engine);
  lib.close();
}

test();

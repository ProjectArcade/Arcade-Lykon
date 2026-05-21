const { ctypes } = ChromeUtils.importESModule("resource://gre/modules/ctypes.sys.mjs");

function readFile(path) {
  const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  file.initWithPath(path);
  const stream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
  stream.init(file, 0x01, 0o444, 0);
  const cvstream = Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(Ci.nsIConverterInputStream);
  cvstream.init(stream, "UTF-8", 0, 0);
  let data = "";
  let str = {};
  while (cvstream.readString(4096, str) !== 0) {
    data += str.value;
  }
  cvstream.close();
  return data;
}

function test() {
  const libPath = "/run/media/notspidey/extra/Arcade-Lykon/obj-x86_64-pc-linux-gnu/dist/bin/libadblock.so";
  const lib = ctypes.open(libPath);
  
  const create = lib.declare("adblock_engine_create", ctypes.default_abi, ctypes.voidptr_t);
  const add = lib.declare("adblock_engine_add_filter_list", ctypes.default_abi, ctypes.bool, ctypes.voidptr_t, ctypes.char.ptr);
  const getCosmetic = lib.declare("adblock_engine_get_cosmetic_resources", ctypes.default_abi, ctypes.char.ptr, ctypes.voidptr_t, ctypes.char.ptr);
  const freeStr = lib.declare("adblock_free_string", ctypes.default_abi, ctypes.void_t, ctypes.char.ptr);
  const destroy = lib.declare("adblock_engine_destroy", ctypes.default_abi, ctypes.void_t, ctypes.voidptr_t);

  const engine = create();
  console.log("Engine created:", !engine.isNull());

  const prefix = "/run/media/notspidey/extra/Arcade-Lykon/browser/components/adblock/";
  const lists = ["easylist.txt", "easyprivacy.txt", "ublock-filters.txt"];
  
  for (const list of lists) {
    console.log("Loading rules from:", list);
    const content = readFile(prefix + list);
    const added = add(engine, content);
    console.log("Rules added:", added);
  }

  // Test getCosmeticResources for pornhub.com
  console.log("Calling getCosmeticResources for pornhub.com...");
  const ptr = getCosmetic(engine, "https://www.pornhub.com/");
  if (!ptr.isNull()) {
    const res = ptr.readString();
    console.log("RESULT_START_COM");
    console.log(res);
    console.log("RESULT_END_COM");
    freeStr(ptr);
  }

  // Test getCosmeticResources for pornhub.org
  console.log("Calling getCosmeticResources for pornhub.org...");
  const ptr2 = getCosmetic(engine, "https://www.pornhub.org/");
  if (!ptr2.isNull()) {
    const res = ptr2.readString();
    console.log("RESULT_START_ORG");
    console.log(res);
    console.log("RESULT_END_ORG");
    freeStr(ptr2);
  }

  destroy(engine);
  lib.close();
}

test();

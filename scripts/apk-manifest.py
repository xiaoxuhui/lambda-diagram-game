"""从 APK 内编译后的 AndroidManifest.xml 读出 package / versionCode / versionName（无需工具链）。

用法:
    python apk-manifest.py <apk>

为什么需要它：核对线上包时，`versionCode` 是**唯一**决定"系统认不认这是更新版本"的字段，
而它只存在于 APK 内部的二进制 Manifest 里 —— 文件名叫什么、tag 叫什么、Release 文案写什么都不算数。
没有 aapt 时，只能自己解析 AXML。

AndroidManifest.xml 在 APK 里是 AXML（编译后的二进制 XML）：
    ResChunk_header = uint16 type + uint16 headerSize + uint32 size
    依次出现：RES_XML_TYPE(0x0003) → RES_STRING_POOL_TYPE(0x0001)
              → RES_XML_RESOURCE_MAP_TYPE(0x0180) → 各 XML 节点
    START_ELEMENT(0x0102) 的载荷：
        ResXMLTree_node（16 字节，含 lineNumber / comment）
        + attrExt: ns u32, name u32, attributeStart u16, attributeSize u16,
                   attributeCount u16, idIndex u16, classIndex u16, styleIndex u16
        + attributeCount × 20 字节的属性
    每个属性 5 个 u32：ns, name, rawValue, typedValue(含 dataType), data

坑：`versionName` 是**字符串**（rawValue 指向字符串池），`versionCode` 是 **int**（取 data 字段）。
字符串池可能是 UTF-8（flags & 0x100）也可能是 UTF-16LE，两种都要处理。
"""

import struct
import sys
import zipfile

WANTED = {"versionCode", "versionName", "package"}


def parse_string_pool(buf, off):
    _type, header_size, size = struct.unpack_from("<HHI", buf, off)
    count, _style_count, flags, strings_start, _styles_start = struct.unpack_from(
        "<IIIII", buf, off + 8
    )
    utf8 = bool(flags & 0x00000100)
    offsets = struct.unpack_from(f"<{count}I", buf, off + header_size)
    base = off + strings_start
    out = []
    for o in offsets:
        p = base + o
        if utf8:
            n = buf[p]
            if n & 0x80:                      # 两字节长度（高位置 1）
                n = ((n & 0x7F) << 8) | buf[p + 1]
                p += 2
            else:
                p += 1
            m = buf[p]                        # UTF-16 长度字段，仅需跳过
            p += 2 if m & 0x80 else 1
            out.append(buf[p:p + n].decode("utf-8", "replace"))
        else:
            n = struct.unpack_from("<H", buf, p)[0]
            p += 2
            out.append(buf[p:p + n * 2].decode("utf-16-le", "replace"))
    return out, size


def extract(buf):
    _t, _hs, _sz = struct.unpack_from("<HHI", buf, 0)
    pos = 8
    strings = []
    while pos < len(buf):
        ctype, _chsize, csize = struct.unpack_from("<HHI", buf, pos)
        if ctype == 0x0001:                   # 字符串池
            strings, _ = parse_string_pool(buf, pos)
        elif ctype == 0x0102:                 # START_ELEMENT
            name_idx, attr_start, _attr_size, attr_count = struct.unpack_from(
                "<IHHH", buf, pos + 20
            )
            if strings[name_idx] == "manifest":
                found = {}
                apos = pos + 16 + attr_start
                for _ in range(attr_count):
                    _ns, aname, raw, tval, data = struct.unpack_from("<IIIII", buf, apos)
                    atype = (tval >> 24) & 0xFF
                    an = strings[aname] if aname < len(strings) else ""
                    if an in WANTED:
                        if an != "versionCode" and raw != 0xFFFFFFFF and raw < len(strings):
                            found[an] = strings[raw]        # 字符串型
                        elif atype == 0x03:                  # TYPE_STRING
                            found[an] = strings[data]
                        else:
                            found[an] = data                 # int 型（versionCode）
                    apos += 20
                return found
        pos += csize
    raise SystemExit("没有在 AXML 里找到 <manifest> 元素")


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    apk = sys.argv[1]
    with zipfile.ZipFile(apk) as z:
        buf = z.read("AndroidManifest.xml")
    m = extract(buf)
    print(f"APK: {apk}")
    print(f"  package     = {m.get('package')}")
    print(f"  versionCode = {m.get('versionCode')}   # 系统据此判断是否更新；必须递增")
    print(f"  versionName = {m.get('versionName')}")


if __name__ == "__main__":
    main()

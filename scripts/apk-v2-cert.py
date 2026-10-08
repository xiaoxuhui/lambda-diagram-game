"""从 APK Signing Block 提取 v2 签名方案里的签名证书 DER（无需 Android 工具链）。

用法:
    python apk-v2-cert.py <apk> <out.der>
    # 再与仓库 keystore 的证书做字节比对：
    openssl pkcs12 -in android/app/debug.keystore -nokeys -clcerts -passin pass:android -out ks.pem
    openssl x509 -in ks.pem -outform DER -out ks.der
    cmp out.der ks.der && echo "签名一致 —— 后续版本可覆盖升级"

这是在**无 JDK / 无 Android 工具链**的机器上，证明「线上包的签名 == 仓库里那把固定
keystore」的唯一办法。它直接回答了「下一个版本还能不能覆盖安装」——不必等到发第二个包才发现。

APK Signing Block 结构（Android apksig / v2 规格）：
    uint64  size            # = 整个块长度 - 8（**含**末尾的 size 与 magic）
    repeat:
        uint64  pair_len    # = 4 + len(value)
        uint32  id
        bytes   value
    uint64  size            # 与开头一致
    bytes   magic           # "APK Sig Block 42"（16 字节）

因此：块起始 P = magic偏移 - 8 - size + 16 = magic偏移 + 8 - size
**漏掉这个 16 字节修正就会整体错位——这是本脚本最容易踩的坑。**

块内所有"带长度前缀的序列"，长度都是 uint32 小端；v2 的 ID 是 0x7109871a。
证书路径：signers[0] → signed_data → certificates[0]（逐层剥长度前缀）。
"""

import struct
import sys

MAGIC = b"APK Sig Block 42"
V2_ID = 0x7109871A


def read_u32(buf, pos):
    return struct.unpack_from("<I", buf, pos)[0], pos + 4


def read_u64(buf, pos):
    return struct.unpack_from("<Q", buf, pos)[0], pos + 8


def read_len_prefixed(buf, pos):
    """读一个 uint32 长度前缀 + 内容，返回 (内容起止) 与下一位置。"""
    length, pos = read_u32(buf, pos)
    return (pos, pos + length), pos + length


def find_signing_block(blob):
    m = blob.rfind(MAGIC)
    if m < 0:
        raise SystemExit("找不到 'APK Sig Block 42'：该 APK 可能只有 v1 签名")
    size, _ = read_u64(blob, m - 8)
    start = m + 8 - size
    if start < 0:
        raise SystemExit(f"块起始算出为负数（{start}），magic/size 定位有误")
    return start, m + 16


def iter_pairs(blob, start, end):
    """遍历 [start,end) 内的 id-value 对；end 指向末尾 size 字段之前。"""
    pos = start
    while pos + 8 <= end:
        pair_len, after = read_u64(blob, pos)
        if pair_len < 4 or after + pair_len > end:
            break
        pid = struct.unpack_from("<I", blob, after)[0]
        yield pid, blob[after + 4: after + pair_len]
        pos = after + pair_len


def extract_v2_cert(apk_path):
    with open(apk_path, "rb") as fh:
        blob = fh.read()

    start, magic_end = find_signing_block(blob)
    pairs_end = magic_end - 16 - 8  # 末尾 size 字段之前

    v2 = None
    for pid, value in iter_pairs(blob, start + 8, pairs_end):
        if pid == V2_ID:
            v2 = value
            break
    if v2 is None:
        raise SystemExit("块里没有 v2 签名（id 0x7109871a）")

    (s_start, _s_end), _ = read_len_prefixed(v2, 0)          # signers
    (sg_start, _sg_end), _ = read_len_prefixed(v2, s_start)  # signers[0]
    (sd_start, _sd_end), nxt = read_len_prefixed(v2, sg_start)  # signed_data
    (_dg_start, _dg_end), nxt2 = read_len_prefixed(v2, sd_start)  # digests
    (cert_start, _cert_end), _ = read_len_prefixed(v2, nxt2)      # certificates
    (der_start, der_end), _ = read_len_prefixed(v2, cert_start)   # certificates[0]

    return v2[der_start:der_end]


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    der = extract_v2_cert(sys.argv[1])
    with open(sys.argv[2], "wb") as fh:
        fh.write(der)
    print(f"提取到 v2 签名证书：{len(der)} 字节 -> {sys.argv[2]}")


if __name__ == "__main__":
    main()

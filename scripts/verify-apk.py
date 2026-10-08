"""核对 APK 的真实版本、固定证书和完整离线网页；无需 Android SDK。"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent

def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('apk', type=Path)
    parser.add_argument('--openssl', default='openssl')
    args = parser.parse_args()
    cert_module = module('apk_certificate', 'apk-v2-cert.py')
    manifest_module = module('apk_manifest', 'apk-manifest.py')
    cert = cert_module.extract_v2_cert(args.apk)
    pem = subprocess.check_output([args.openssl, 'pkcs12', '-in', str(ROOT / 'android/app/debug.keystore'), '-nokeys', '-clcerts', '-passin', 'pass:android'])
    fixed_cert = subprocess.check_output([args.openssl, 'x509', '-outform', 'DER'], input=pem)
    assert cert == fixed_cert, 'APK 签名证书与固定 keystore 不一致'
    with zipfile.ZipFile(args.apk) as archive:
        identity = manifest_module.extract(archive.read('AndroidManifest.xml'))
        webpage = archive.read('assets/lambda-lab.html')
        assert [name for name in archive.namelist() if name.startswith('assets/') and not name.endswith('/')] == ['assets/lambda-lab.html'], 'APK 内出现额外网页资源'
    expected_version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
    assert identity == {'versionCode': 1, 'versionName': expected_version, 'package': 'com.xiaoxuhui.lambda'}, identity
    assert webpage == (ROOT / 'dist/lambda-lab.html').read_bytes(), 'APK 内网页与本次产物不一致'
    certificate_details = subprocess.check_output([args.openssl, 'x509', '-inform', 'DER', '-noout', '-subject', '-dates'], input=cert).decode().strip()
    result = {
        'apk': args.apk.name,
        'apkBytes': args.apk.stat().st_size,
        'apkSha256': hashlib.sha256(args.apk.read_bytes()).hexdigest(),
        'manifest': identity,
        'certificateByteEqual': True,
        'certificateSha256': hashlib.sha256(cert).hexdigest(),
        'certificateDetails': certificate_details,
        'webpageByteEqual': True,
        'webpageBytes': len(webpage),
        'webpageSha256': hashlib.sha256(webpage).hexdigest(),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()

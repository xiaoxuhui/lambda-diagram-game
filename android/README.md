# Lambda 线路实验室 · Android

完整离线 WebView 外壳，使用与网页版相同的 dist/lambda-lab.html。

- 应用名：Lambda 线路实验室
- 包名：com.xiaoxuhui.lambda
- 版本：0.3.1；versionCode 2（上一版为 1）
- minSdk 24 / targetSdk 34 / compileSdk 34
- 权限：无；不申请网络权限
- 签名：项目专属固定公开 debug keystore，必须长期保留

## 构建与测试

npm run build
npm run sync:android
npm run check:android
npm test
npm run test:android-bridge

本地 Android 工具链：JDK 17、Gradle 8.7、AGP 8.5.2、Android SDK 34。
在 android 目录运行 gradlew.bat assembleDebug（Windows）或 ./gradlew assembleDebug（Linux）。
产物位于 app/build/outputs/apk/debug/app-debug.apk。
GitHub Actions 在所有开发分支检查网页和 APK；版本标签触发 Release。

## 文件与状态

内置页面以固定 https://appassets.androidplatform.net/assets/lambda-lab.html 加载，保证 localStorage origin 稳定。
JSON 和 SVG 导出直接调用 LambdaAndroid.saveFile，传入完整文本及正确 MIME；网页普通下载继续有效。
「导出存档并清空」调用 LambdaAndroid.saveFileConfirmed，只有原生文件写入成功才清空现场。
Android 10+ 使用 MediaStore 保存到下载目录，Android 7–9 保存到应用外部文件目录，不请求存储权限。
JSON 导入通过系统文件选择器。转屏不重建 Activity，处理系统栏和键盘 Insets；返回键先退页面历史。

网页与 APK 存储空间独立，迁移请使用导出和导入。应用卸载可能清除其数据，存档可先导出备份。

## 图标

程序化生成 λ 与横竖线路，原图在 icon-source/。使用 Pillow 运行 python tools/make-icons.py 可复现所有密度图标。

## 发布清单

1. 网页与 APK versionName 同线，versionCode 严格增加。
2. android/app/debug.keystore 必须保持不变且入库；gradle 明确引用 PKCS12 签名。
3. 本地和 CI 的构建、同步、单元测试与浏览器测试通过。
4. APK 内网页逐字节等于本次构建产物；解析二进制 Manifest；APK v2 证书与 keystore 字节比对；apksigner 验证签名。
5. 发布后下载线上 APK 再核验，记录在 doc/安卓发版核对报告-v0.3.1.md。
6. 新旧 APK 签名和 versionCode 必须静态核验；实际覆盖安装与存档保留、离线启动、系统导入导出、转屏和杀进程后恢复需设备验证。

debug 签名便于直接分发安装，本次不是应用商店 release 签名包。

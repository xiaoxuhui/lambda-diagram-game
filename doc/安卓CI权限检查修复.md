# APK 权限核验失败定位

日期：2026-10-09。

事实：运行 37846706556 的 APK 构建成功。签名验证、固定证书比对、包内网页比对及 Manifest 版本读取均通过；最终 `aapt dump badging` 的「无 uses-permission」断言失败，发布尚未执行。

根因：官方 Maven 的 `androidx.core:core:1.13.1` AAR 内声明了 `${applicationId}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` 的 signature 权限和 uses-permission；合并器将其加入最终 APK。源应用 Manifest 没有权限声明不足以证明最终包无权限。

本地证据：下载实际版本 AAR 并读取其 AndroidManifest.xml，确认上述两项真实存在。没有本地 Android SDK，本地未运行 aapt；最终产物约束由云端实际构建验证，不能把依赖检查描述成真机验证。

修复：应用未使用 ContextCompat 的动态广播注册功能，在源 Manifest 使用 tools:node="remove" 明确移除这两条依赖声明。源结构检查识别删除标记，继续禁止实际权限申请，并新增删除标记守卫。CI 的最终 APK 无权限断言完整保留，未跳过或弱化。

补充失败产物用于诊断；失败运行不会触发 Release。后续运行的实际结果写入发版核对报告。

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.xiaoxuhui.lambda"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.xiaoxuhui.lambda"
        minSdk = 24
        targetSdk = 34
        versionCode = 2
        versionName = "0.3.1"

        // 应用为单语言中文工具，去掉无用资源以减小体积
        resourceConfigurations += listOf("zh", "en")
    }

    /**
     * 固定 debug 签名 —— **接入新项目时必须保留这一段**。
     *
     * 不配它时，AGP 会给每台构建机随机生成一把 debug key；CI 每次都是全新
     * runner，于是每个发布包的签名都不同，用户覆盖安装新包会被系统拒绝
     * （INSTALL_FAILED_UPDATE_INCOMPATIBLE），现象是「有新版本却一直更新不了」。
     * 这类问题**首个包完全看不出**，要等发下一个版本才炸。
     *
     * `debug.keystore` 随仓库提交：debug key 的密码在 Android 文档里是公开的
     * （android / androiddebugkey），没有保密价值，唯一重要的是**它不能变**。
     * 生成方法见 SKILL.md「关键坑」第一条。
     */
    signingConfigs {
        getByName("debug") {
            storeFile = file("debug.keystore")
            storeType = "PKCS12" // 文件名是 .keystore，不写这行 AGP 会按 JKS 猜
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        debug {
            // 首版使用 debug 签名，便于直接安装
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.2")
    implementation("androidx.webkit:webkit:1.11.0")
}

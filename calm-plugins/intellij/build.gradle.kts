plugins {
    kotlin("jvm") version "2.2.20"
    id("org.jetbrains.intellij.platform") version "2.10.4"
}

group = "dev.calm.intellij"
version = "0.3.3"

repositories {
    mavenCentral()
    intellijPlatform { defaultRepositories() }
}

dependencies {
    intellijPlatform {
        val localIde = providers.gradleProperty("localIdePath").orNull
        if (localIde != null) local(localIde) else intellijIdea("2025.3.6")
    }
    testImplementation("junit:junit:4.13.2")
}

kotlin { jvmToolchain(21) }

intellijPlatform {
    pluginConfiguration {
        name = "CALM Canvas Preview"
        ideaVersion { sinceBuild = "253"; untilBuild = "253.*" }
    }
}

val npmCommand = providers.gradleProperty("npmExecutable").getOrElse("npm")
tasks.withType<Exec>().configureEach {
    if (file(npmCommand).isAbsolute && npmCommand != "npm") {
        environment("PATH", "${file(npmCommand).parent}${File.pathSeparator}${System.getenv("PATH")}")
    }
}
val repositoryRoot = projectDir.resolve("../..").canonicalFile
val buildWebview by tasks.registering(Exec::class) {
    workingDir(repositoryRoot)
    commandLine(npmCommand, "run", "build", "--workspace", "calm-plugins/intellij/webview")
    inputs.dir("webview/src")
    inputs.dir("webview/vendor")
    inputs.files("webview/package.json", "webview/vite.config.ts", "webview/tsconfig.json")
    inputs.files(repositoryRoot.resolve("package.json"), repositoryRoot.resolve("package-lock.json"))
    outputs.dir("webview/dist")
}
tasks.processResources {
    dependsOn(buildWebview)
    from("webview/dist") { into("webview") }
    from(files("webview/vendor/preview-0.6/LICENSE", "webview/vendor/preview-0.6/NOTICE", "webview/vendor/preview-0.6/UPSTREAM.md")) { into("META-INF/calm-upstream") }
}
tasks.test { useJUnit() }
tasks.named("buildSearchableOptions") { enabled = false }
tasks.wrapper { gradleVersion = "8.14.3" }

plugins {
    `kotlin-dsl`
}

gradlePlugin {
    plugins {
        register("rust") {
            id = "rust"
            implementationClass = "RustPlugin"
        }
    }
}

repositories {
    google()
    mavenCentral()
}

dependencies {
    implementation("com.android.tools.build:gradle:8.11.0")
}


import com.android.build.api.dsl.ApplicationExtension
import org.gradle.api.DefaultTask
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register

const val TASK_GROUP = "rust"

open class Config {
    lateinit var rootDirRel: String
}

open class RustPlugin : Plugin<Project> {
    private lateinit var config: Config

    override fun apply(project: Project) = with(project) {
        config = extensions.create("rust", Config::class.java)

        val defaultAbiList = listOf("arm64-v8a", "armeabi-v7a", "x86", "x86_64")
        val abiList = (findProperty("abiList") as? String)?.split(',') ?: defaultAbiList

        val defaultArchList = listOf("arm64", "arm", "x86", "x86_64")
        val archList = (findProperty("archList") as? String)?.split(',') ?: defaultArchList

        val targetsList = (findProperty("targetList") as? String)?.split(',') ?: listOf("aarch64", "armv7", "i686", "x86_64")

        extensions.configure<ApplicationExtension> {
            flavorDimensions += "abi"
            productFlavors {
                create("universal") {
                    dimension = "abi"
                    ndk {
                        abiFilters += abiList
                    }
                }
                archList.forEachIndexed { index, arch ->
                    create(arch) {
                        dimension = "abi"
                        ndk {
                            abiFilters.add(abiList[index])
                        }
                    }
                }
            }
        }

        afterEvaluate {
            for (profile in listOf("debug", "release")) {
                val profileCapitalized = profile.replaceFirstChar { it.uppercase() }

                val buildTaskName = "rustBuildUniversal$profileCapitalized"
                val buildTask = tasks.findByName(buildTaskName) ?: tasks.register(buildTaskName, DefaultTask::class.java) {
                    group = TASK_GROUP
                    description = "Build dynamic library in $profile mode for all targets"
                }.get()

                tasks.named("mergeUniversal${profileCapitalized}JniLibFolders") {
                    dependsOn(buildTask)
                }

                for (targetPair in targetsList.withIndex()) {
                    val targetName = targetPair.value
                    val targetArch = archList[targetPair.index]
                    val targetArchCapitalized = targetArch.replaceFirstChar { it.uppercase() }

                    val targetBuildTaskName = "rustBuild$targetArchCapitalized$profileCapitalized"
                    val targetBuildTask = tasks.findByName(targetBuildTaskName) ?: tasks.register(targetBuildTaskName, BuildTask::class.java) {
                        group = TASK_GROUP
                        description = "Build dynamic library in $profile mode for $targetArch"
                        rootDirRel = config.rootDirRel
                        target = targetName
                        release = profile == "release"
                    }.get()

                    buildTask.dependsOn(targetBuildTask)
                    tasks.named("merge$targetArchCapitalized${profileCapitalized}JniLibFolders") {
                        dependsOn(targetBuildTask)
                    }
                }
            }
        }
    }
}

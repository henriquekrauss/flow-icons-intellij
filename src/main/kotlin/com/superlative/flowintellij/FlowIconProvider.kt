package com.superlative.flowintellij

import com.intellij.ide.FileIconProvider
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.vfs.VirtualFile
import javax.swing.Icon

class FlowIconProvider : FileIconProvider {

    override fun getIcon(file: VirtualFile, flags: Int, project: Project?): Icon? {
        val name = file.name.lowercase()

        if (file.isDirectory) {
            return FlowFolderMappings.NAMED_ICONS[name]?.let { loadIcon(it) }
                ?: loadIcon("folder_gray")
        }

        // 1. Check full filename stems first (highest priority)
        FlowIconMappings.FILE_STEMS[name]?.let { return loadIcon(it) }

        // 2. Check compound suffix — everything after the first dot (e.g. "stories.tsx")
        val firstDot = name.indexOf('.')
        if (firstDot >= 0) {
            val compoundSuffix = name.substring(firstDot + 1)
            if (compoundSuffix.isNotEmpty()) {
                FlowIconMappings.FILE_SUFFIXES[compoundSuffix]?.let { return loadIcon(it) }
            }
        }

        // 3. Check simple extension (e.g. "tsx")
        file.extension?.lowercase()?.let { ext ->
            FlowIconMappings.FILE_SUFFIXES[ext]?.let { return loadIcon(it) }
        }

        // 4. Fall back to generic file icon
        return loadIcon("file")
    }

    private fun loadIcon(iconName: String): Icon? {
        val path = "/icons/flow/$iconName.png"
        return try {
            FlowIconProvider::class.java.getResource(path) ?: return null
            IconLoader.findIcon(path, FlowIconProvider::class.java)
        } catch (_: Exception) {
            null
        }
    }
}

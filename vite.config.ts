import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { createWriteStream, existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import archiver from 'archiver'

// Plugin to bundle the browser extension as a ZIP file
function extensionZipPlugin(): Plugin {
  const extensionDir = resolve(__dirname, '../http-visualizer-extension')
  const outputDir = resolve(__dirname, 'public')
  const zipFileName = 'http-visualizer-extension.zip'

  // Helper to copy directory recursively
  function copyDirSync(src: string, dest: string) {
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true })
    }
    const entries = readdirSync(src, { withFileTypes: true })
    for (const entry of entries) {
      const srcPath = join(src, entry.name)
      const destPath = join(dest, entry.name)
      if (entry.isDirectory()) {
        copyDirSync(srcPath, destPath)
      } else {
        copyFileSync(srcPath, destPath)
      }
    }
  }

  // Create ZIP file
  async function createZip(): Promise<void> {
    if (!existsSync(extensionDir)) {
      console.warn('[extension-zip] Extension directory not found:', extensionDir)
      return
    }

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
    }

    const zipPath = join(outputDir, zipFileName)
    const output = createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    return new Promise((resolvePromise, reject) => {
      output.on('close', () => {
        console.log(`[extension-zip] Created ${zipFileName} (${archive.pointer()} bytes)`)
        resolvePromise()
      })

      archive.on('error', (err) => {
        reject(err)
      })

      archive.pipe(output)
      archive.directory(extensionDir, 'http-visualizer-extension')
      archive.finalize()
    })
  }

  return {
    name: 'extension-zip',
    
    // Create ZIP on build start
    async buildStart() {
      await createZip()
    },

    // Also create ZIP when dev server starts
    async configureServer() {
      await createZip()
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss(), extensionZipPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})

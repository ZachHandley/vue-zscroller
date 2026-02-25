import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/**
 * Custom Vite plugin that injects extracted CSS directly into JavaScript chunks
 * at build time. This eliminates the need for consumers to import a separate CSS
 * file -- styles are automatically applied when the JS is imported.
 *
 * - SSR-safe: checks for `document` before injecting
 * - Idempotent: uses a unique style element ID to prevent duplicate injection
 * - Works across ES, UMD, and IIFE output formats
 */
function cssInjectPlugin(): Plugin {
  const STYLE_ID = 'zvue-virtual-scroller-styles'

  return {
    name: 'zvue-css-inject',
    apply: 'build',
    enforce: 'post',

    generateBundle(_outputOptions, bundle) {
      // 1. Collect all CSS asset content from the bundle
      const cssFileNames: string[] = []
      let combinedCss = ''

      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type === 'asset' && fileName.endsWith('.css')) {
          combinedCss += asset.source
          cssFileNames.push(fileName)
        }
      }

      if (!combinedCss) return

      // 2. Build the injection IIFE -- SSR-safe and idempotent
      const injectionCode = [
        `(function(){`,
        `  if (typeof document === 'undefined') return;`,
        `  if (document.getElementById('${STYLE_ID}')) return;`,
        `  var s = document.createElement('style');`,
        `  s.id = '${STYLE_ID}';`,
        `  s.textContent = ${JSON.stringify(combinedCss)};`,
        `  document.head.appendChild(s);`,
        `})();`,
      ].join('\n')

      // 3. Prepend injection code to every JS chunk
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk') continue
        if (!fileName.endsWith('.js') && !fileName.endsWith('.mjs')) continue

        chunk.code = injectionCode + '\n' + chunk.code
      }

      // 4. Remove CSS assets from the bundle so no separate file is emitted
      for (const cssFileName of cssFileNames) {
        delete bundle[cssFileName]
      }
    },
  }
}

const config = defineConfig({
  plugins: [
    vue({
      include: [/\.vue$/],
      template: {
        compilerOptions: {
          isCustomElement: tag => tag.startsWith('x-')
        }
      }
    }),
    dts({
      outDir: 'dist',
      tsconfigPath: './tsconfig.json',
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
      copyDtsFiles: true,
    }),
    cssInjectPlugin(),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ZachVueVirtualScroller',
      fileName: (format) => {
        switch (format) {
          case 'es':
            return 'zvue-virtual-scroller.esm.mjs'
          case 'umd':
            return 'zvue-virtual-scroller.umd.js'
          case 'iife':
            return 'zvue-virtual-scroller.min.js'
          default:
            return 'zvue-virtual-scroller.js'
        }
      },
      formats: ['es', 'umd', 'iife'],
    },
    rollupOptions: {
      external: ['vue', '@vueuse/core'],
      output: {
        globals: {
          vue: 'Vue',
          '@vueuse/core': 'VueUse',
        },
        exports: 'named',
      },
    },
    cssMinify: true,
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2020',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    VERSION: JSON.stringify(require('./package.json').version),
  },
})

export default config
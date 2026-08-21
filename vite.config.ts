import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      insertTypesEntry: true,
      include: ['src/**/*.ts', 'src/**/*.vue'],
    }),
  ],
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SchemaUI',
      fileName: (format) => {
        if (format === 'es') return 'rest-ui.es.js'
        return 'rest-ui.cjs'
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      // 外部化所有 element-plus 路径,包括深层子路径,避免 ESM barrel 把全量 EP 拽进 bundle。
      // 此前只 external `'element-plus'` 顶层,但 rest-ui 改用 `element-plus/es/components/xxx/index.mjs`
      // 后,这些子路径不在 external 里,会让 vite 把 EP 全量 (1016 KB) 打进 rest-ui.es.js。
      external: [
        'vue',
        /^element-plus(\/.*)?$/,
        '@element-plus/icons-vue',
      ],
      output: {
        globals: {
          vue: 'Vue',
          'element-plus': 'ElementPlus',
        },
      },
    },
  },
})
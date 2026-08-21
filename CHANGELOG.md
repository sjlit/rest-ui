# Changelog

## [Unreleased]

### Bug Fixes

- **修复 `rest-ui` 把 element-plus 全量 (1 MB+) 拽进消费方 vendor chunk 的问题**。
  - 根因:库内原写法是 `import { ElButton } from 'element-plus'`,该入口是聚合 barrel
    (`element-plus/es/index.mjs`),其内 `import` 了全部 60+ 个组件 + 全部 hooks + 全部
    constants。即使消费方用 `import { ElButton }` 这种具名写法,rollup 仍会把 barrel
    文件的执行链全部 treeshake 失败(SASS 主题模块、`useFormSize` 等共享 hook 在
    多组件间形成传递依赖),结果消费方的 `vendor-rest-*.js` 膨胀到 1 MB+。
  - 修复:把 7 个 .vue 文件 (SchemaPage / SchemaGrid / SchemaForm / SchemaViewer /
    parts/Action / parts/Cell / parts/FormItem) 全部改成 **深层路径** import,例如
    `import ElButton from 'element-plus/es/components/button/index.mjs'`。
    这与 `unplugin-vue-components` 的 `ElementPlusResolver` 内部使用的路径一致,
    已被证实可被 rollup/vite/webpack 正确 treeshake。
  - `vite.config.ts` 的 `external` 列表同步从 `'element-plus'` 改为正则
    `/^element-plus(\/.*)?$/`,保证深层子路径也走外部化,库自身产物大小不变 (76 KB ES)。
  - 实测对比(同一最小消费方 demo,只 import `SchemaViewer` 并真实 mount):
    - 1.1.0 修复前 vendor chunk:**~1.1 MB**
    - 本次修复后 vendor chunk:**~670 KB**(gzip ~220 KB),其中 ~600 KB 是 EP 27 个
      按需组件 + 共享 utils + styles 的真实体积,不再有 barrel 副作用。

### Documentation

- `README.md` 在"引入 Element Plus"章节新增**实测体积对比**,并把方式二的
  `ElementPlusResolver()` 改为 `ElementPlusResolver({ importStyle: 'css' })`。
  - 数据来源:Vite 5 + element-plus 2.14,最小消费方 demo。
  - 全量引入 (`app.use(ElementPlus)` + `import 'element-plus/dist/index.css'`)
    → 打包 CSS **363.65 kB** (gzip 49.15 kB)。
  - 按需引入 (`ElementPlusResolver({ importStyle: 'css' })`)
    → 打包 CSS **81.28 kB** (gzip 11.44 kB),节省约 **78%**。
  - 1MB 几乎全部来自 element-plus 全量引入,`rest-ui` 自身只有约 76 kB (gzip 后
    ~25 kB) JS + 8 kB CSS,与全量/按需无关。
  - 新增"消费方页面如果自己写 `<el-*>` 必须二选一"的明确说明,避免漏装 resolver
    导致运行时 `Failed to resolve component`。
  - 明确指出:**升级到本次修复版本后,无需消费方做任何改动,库自身 vendor chunk
    体积就会大幅下降**(只要消费方不主动 `import ElementPlus` 或 `import 'element-plus/dist/index.css'`)。

## [1.1.0] - 2026-08-21

### Refactor

- UI 层 (`SchemaPage.vue` / `SchemaGrid.vue` / `SchemaForm.vue` / `Action.vue` / `Cell.vue` / `FormItem.vue`) 改为**显式** `import { ... } from 'element-plus'`,覆盖 27 个 `<el-*>` 模板标签 + `v-loading` 指令 + `ElMessageBox` 命令式 API。库内不再依赖消费方 `app.use(ElementPlus)` 或构建插件解析模板,任何引入方式都能正常工作。
- `Action.type` / `Action.size` 的类型由 `string` 改为从 `element-plus` 透传的 `ButtonType` / `ComponentSize` 联合,IDE 提示和编译时校验更精确。
- `SchemaGrid.size` 改为 `ComponentSize`,与 `<el-table :size="size">` 严格对齐。
- `core/types.ts` 透传 `ButtonType` / `ComponentSize`,并在 `src/index.ts` 公开导出,让下游可从 `@sjlit/rest-ui` 一处取到 EP 类型,避免散落。`FormItem.vue` 中 `<el-cascader :options>` 用 `CascaderOption` 显式断言替换原本的 `any`,消除一处隐式类型。
- 文档同步:
  - `README.md` 重写"引入 Element Plus"章节,说明显式 import 后方式一（全量注册）和方式二（unplugin-vue-components 按需）均可用,并给出选型表。
  - `Action` / `SchemaGrid.size` 类型说明更新,公开类型清单加入 `ButtonType` / `ComponentSize`。
  - `docs/architecture.md` 中 Action 样例同步。

### 兼容性

- 库 bundle 体积:新打的 `rest-ui.es.js` 体积略增(27 个 EP 组件的引用),但来源单一,消费者端的 tree-shake 不会重复打包,实际体积与之前一致。
- 公开 API:无破坏性变更,`Action` / `SchemaGrid` 的 prop 收紧为 EP 联合类型,若消费方传字符串字面量(`'primary'`、`'default'` 等)仍合法,只有传非 EP 联合的字符串才报错。

## [1.0.7] - 2026-08-20

### Chores

- 构建产物开启 sourcemap（`vite.config.ts` 中 `build.sourcemap = true`），现在发布的 `rest-ui.es.js` / `rest-ui.cjs` 旁会附带 `*.js.map` 文件。前端调试组件库时浏览器 DevTools 会自动加载原 `src/*.ts` 源码，断点和调用栈可直接对应到仓库源码而非压缩后的产物。

  注：体积影响约 `rest-ui.es.js.map 158 kB`、`rest-ui.cjs.map 152 kB`，已在 GitHub Actions 的 `npm pack --dry-run` 步骤可见。如不需要可自行在 `package.json#files` 中加 `"!**/*.map"` 排除。

## [1.0.5] - 2026-08-20

### Bug Fixes

- `codec.encode` 重写：补齐基础类型转换，UI 表单收集到的字符串 / 空值会按 `schema.type` 转成对应类型再提交。
  - `integer` / `decimal` / `float` / `double`：字符串 → 数字；空字符串 / 非法值 → `0`。
  - `boolean`：任意值 → `Boolean(v)`（注意：`Boolean('false') === true`，与上游 quor 行为对齐）。
  - `string`：对象 → `JSON.stringify`；空值 → `''`。
- `codec.decode` 重写：与 `encode` 对称，并补齐三类之前缺失的行为：
  - 日期字段空值（`null` / `undefined` / `''`）现在写入空字符串 `''`，避免前端 `el-date-picker` 取不到字段导致报错。
  - `time_search_range` 在 `search` 场景下按 `'day' | 'week' | 'month' | 'year'` 生成对应 startOf/endOf 默认值（endOf clamp 到当前时间），其他 search 字段空值兜底为 `''`。
  - `create` 场景下 raw 没有的字段使用 `schema.attributes.default_value` 兜底。
- 格式（`schema.format`）分支补齐：`cascader`（按 `live.columns` 拆列 / 合并）、`multiSelect`（`encode` JSON 序列化 / `decode` 解析为数组）、`date` / `datetime` / `timestamp` / `time` 的 daterange 数组（`'start/end'` 字符串 ↔ 数组）。
- 新增 `src/core/codec.test.ts`（31 个用例）覆盖 `mustMarshal` 各类型、`encode` / `decode`、search 默认值、default_value 兜底、cascader / multiSelect / daterange、时间戳、空值、NaN、对称性等。

  受影响版本：1.0.0 ~ 1.0.4。
  修复版本：1.0.5。

  行为对照（节选）：

  | 场景 | 1.0.4 行为 | 1.0.5 行为 |
  | --- | --- | --- |
  | `integer` 字段 UI 提交 `'25'` | 提交 `'25'`（字符串） | 提交 `25`（数字） |
  | `integer` 字段提交 `''` | 提交 `''` | 提交 `0` |
  | `integer` 字段提交 `'abc'` | 提交 `'abc'` | 提交 `0` |
  | `boolean` 字段提交 `'true'` | 提交 `'true'` | 提交 `true` |
  | `date` 字段提交 `['2024-01-01','2024-01-31']` | 提交 `['2024-01-01','2024-01-31']` | 提交 `'2024-01-01/2024-01-31'` |
  | `multiSelect` 字段提交 `[1,2,3]` | 提交 `[1,2,3]` | 提交 `'[1,2,3]'` |
  | `create` 场景 `integer` 字段空 | 不写入 | 写入 `default_value` 转数字 |
  | `search` 场景日期字段空 | `undefined` | `time_search_range` 默认对 |
  | `decode` 日期字段空（`null` / 缺失） | 字段不存在于结果 | 字段为 `''` |

## [1.0.4] - 2026-08-19

### Bug Fixes

- 修复 `CRUD.initialize()` 在 `apiPrefix` 为空时构造出 `//schema/...` 这种 protocol-relative URL 的 bug。改为与 `__buildModelUri` 一致的条件拼接:空 `apiPrefix` 完全省略该段,而不是保留一个空槽。

  影响:1.0.3 把 `apiPrefix` 默认值改成 `''` 之后,凡是依赖远程拉取 schema 的场景(未通过 `config.schemas` 预置),所有请求都会带 `//` 前缀。`httpClient` 如果是 `axios`,`axios.get('//schema/...')` 会被解析成 protocol-relative URL,可能被当作 host=`schema` 的跨主机请求而失败。

  受影响版本:1.0.3。
  修复版本:1.0.4。
  行为对照:

  | 配置 | 1.0.3 URI | 1.0.4 URI |
  | --- | --- | --- |
  | `apiPrefix: ''` | `//schema/{module}/{table}` | `/schema/{module}/{table}` |
  | `apiPrefix: 'rest'` | `/rest/schema/{module}/{table}` | `/rest/schema/{module}/{table}` |

## [1.0.3] - 2026-08-19

### BREAKING CHANGES

- `apiPrefix` 默认值从 `'rest'` 改为 `''`(空字符串)。消费方必须通过 `SchemaUIPlugin` 的 `apiPrefix` 配置,或在 `<SchemaViewer />` 组件 prop 上显式传入,否则请求 URL 将不再带 `/rest/` 前缀。

  ```ts
  // 之前:不传 apiPrefix → 请求会发到 /rest/...
  app.use(SchemaUIPlugin, { httpClient })

  // 之后:不传 apiPrefix → 请求会发到 /...;如需保留 /rest/ 前缀,显式传入:
  app.use(SchemaUIPlugin, { httpClient, apiPrefix: 'rest' })
  ```

### Bug Fixes

- 1.0.2 已修复 `CRUD` 类的默认值,但 `<SchemaViewer />` 组件内部 fallback 仍指向 `'rest'`,导致组件入口与类入口行为不一致。本次提交将两处 fallback 统一为空字符串。

---

## [1.0.0] - 2026-05-17

### 初始版本

#### 核心功能

- **Schema 驱动的 UI 渲染**：基于后端 schema 定义自动渲染搜索表单、数据表格、创建/编辑弹窗
- **全自动 CRUD**：`SchemaViewer` 组件一行代码完成完整的增删改查页面
- **手动编排**：`SchemaPage` 组件提供底层控制，所有数据流通过 props/events
- **响应式表格**：`SchemaGrid` 自动适配桌面端（`el-table`）和移动端（折叠面板）
- **CRUD 类**：封装完整的 RESTful HTTP 操作、分页、排序、查询管理
- **插件化配置**：通过 Vue Plugin 全局注入 HTTP 客户端、权限、路由、国际化

#### 组件

- `SchemaViewer` - 全自动 CRUD 容器组件
- `SchemaPage` - 手动编排布局组件
- `SchemaGrid` - 响应式数据表格
- `SchemaForm` - Schema 驱动表单
- `Action` - 操作按钮
- `Cell` - 表格单元格渲染
- `FormItem` - 表单控件渲染

#### 核心工具

- `Scenarios` - 场景数组扩展类
- `encode` / `decode` - 模型值编解码（日期、数字、布尔值转换）
- `getModelValue` / `getModelLabel` - 模型值获取与标签映射
- `generateSchemaRule` - Element Plus 表单规则生成
- `checkSchemaVisible` - 字段可见性条件检查
- `clearSearchModel` - 搜索模型空值清理

#### 类型定义

完整的 TypeScript 类型定义，与 REST 后端 Go 结构体对齐：

- `Schema` / `SchemaRule` / `SchemaAttribute`
- `Model` / `Action` / `Pagination` / `Sortable`
- `CRUDOptions` / `SchemaUIConfig`

#### 常量

- 数据类型常量：`TypeInteger`, `TypeFloat`, `TypeBoolean`, `TypeString`
- 格式常量：`FormatText`, `FormatDropdown`, `FormatDatetime`, ...
- 场景常量：`ScenarioCreate`, `ScenarioUpdate`, `ScenarioSearch`, ...
- 匹配模式：`MatchExactly`, `MatchFuzzy`
- Live 类型：`LiveTypeDropdown`, `LiveTypeCascader`

#### 技术栈

- Vue 3 + Composition API
- Element Plus 2.x
- TypeScript 5.x
- Vite 5.x (Library Mode)
- ESM + CJS 双格式输出

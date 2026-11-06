# Changelog

## [1.3.0] - 2026-11-05

### Features

- **列表页工作区**：页头压缩为标题/副标题 + 主操作；导出、刷新从批量入口提升到页头，新建按钮增加图标。
- **搜索区可折叠**：默认收起，只保留“筛选”按钮和已生效条件 chips；支持单个条件移除、清空、重置；搜索完成自动收起。
- **批量操作可见化**：工具栏显示已选数量，批量操作直接以按钮呈现；默认提供“批量删除”（可用 `showBatchDelete=false` 关闭）。
- **列设置与密度**：工具条新增列显示/隐藏、默认/紧凑密度；按 `module/table` 持久化到 localStorage。
- **操作列**：增加“操作”表头、固定宽度、固定列不透明背景；图标按钮改为原生 `<button>`，支持键盘焦点、`aria-label`、tooltip 和语义色（查看/编辑/删除）。
- **表格能力**：`row-key` + `reserve-selection` 跨页保留勾选；`tableHeight` 支持表头吸顶；`SchemaViewer` 默认按视口自动计算表格高度（表头吸顶、分页可见），可用 `autoTableHeight=false` 关闭；空态文案 i18n。
- **表单与详情**：`SchemaViewer` 默认改为右侧抽屉；抽屉内默认两列表单、控件铺满列宽、操作栏吸底；详情宽屏两列展示。
- **移动端**：折叠列表改为卡片式外观（选中态高亮）；底部固定批量操作条；分页在移动端收敛为 total + 页码；卡片标题和展开详情都不再显示自增主键，标题优先使用业务字符串字段。
- 新增导出：`buildActiveFilters`、`ActiveFilter`。
- `Action` 新增 `display: 'auto' | 'icon' | 'button'`，允许文字按钮保留左侧图标。

### Fixes

- **编辑保存报 `Cannot find model primary key`**：`SchemaPage` 之前把按场景过滤后的 schema 传给 `SchemaForm`，主键元数据被过滤掉，提交模型丢失 `id`（或其它主键），`CRUD.updateModel` 在发请求前抛错。现在改传完整 schema，由 `SchemaForm` 内部按 `scenario` 过滤展示字段，同时用完整列表里的 `primary_key` 把主键补回提交模型。
- **分页总数一直显示 0**：`CRUD.pagination` 改为 `reactive`，组件 computed 能跟踪 `totalCount` 变化。
- **移除筛选 chip 后不重新查询**：`SchemaForm` 暴露 `runAction()`，执行“校验 + encode + action”完整链路；筛选移除/重置后复用该链路。
- **抽屉表单仍为单列**：`SchemaForm` 用 `ResizeObserver` 跟踪实际容器宽度，抽屉动画结束后正确按两列布局；小于 480px 自动单列。
- **移动端分页被裁切**：移动端不再渲染 sizes/jumper，避免横向溢出。
- **移动端标题显示 1/2/3**：折叠卡片优先使用第一个非主键字符串字段。
- **固定列透底**：提高固定列选择器权重，header/body 均使用不透明背景。

### Behavior Changes

- `SchemaViewer.formMode` 默认值从 `'dialog'` 改为 `'drawer'`。
- `SchemaViewer` 默认启用 `autoTableHeight`（按视口计算表格最大高度，表头吸顶）。
- 导出的默认入口从 `batchActions` 移到页头；`batchActions` 默认注入“批量删除”。
- 搜索区默认收起，搜索后自动收起。
- 表格操作列默认显示“操作”表头，行操作图标带语义色。
- `SchemaForm` 非 inline 模式下输入控件宽度改为 100%，操作栏吸底。
- `SchemaPage` 的 `batchActions` 默认不再包含导出；需要旧行为时仍可显式传 `'export'`。

### Tests

- 新增 `buildActiveFilters` 与 `CRUD.pagination` 响应式回归测试；当前共 106 个测试通过。

## [1.2.0] - 2026-11-05

### Bug Fixes

- **`CRUDOptions.schemas` 预加载完全没有生效**。
  - 根因：构造函数只把 schema 放进 `opts.schemas`，没有赋给 `this.schemas`，`initialize()` 仍然请求 `/schema/:module/:table`。
  - 修复：预加载 schema 现在会正常落到 `this.schemas`，并统一克隆 `attributes/values/live`；`SchemaViewer` 的 `config.schemas` 也会走预加载路径。

- **codec 的 time / date / boolean / timestamp / multiSelect 编解码**。
  - `time` 字段此前 `new Date('10:30')` 得到 Invalid Date，编辑和保存都会丢值；现在支持纯时间解析，表单改用 `el-time-picker` 且保留秒。
  - 纯日期 `YYYY-MM-DD` 改为本地时间解析，修复负时区下编辑日期偏移一天。
  - `'false'` / `'0'` / `'off'` 不再被 `Boolean()` 翻成 `true`，create 的 `default_value: 'false'` 也按 false 处理。
  - `format=timestamp` + 整型字段提交 Unix 秒，不再提交格式化字符串导致 Go int64 反序列化失败。
  - multiSelect 更新时清空会提交 `'[]'`，不再跳过字段导致旧值清不掉。
  - `decode(search)` 正确回显 `start/end`、`start,end` 和单日期。
  - `decode` 自动解包 `__format=both` 的 `{ label, value }` 单元格，列表行可直接进入编辑表单。

- **`CRUD` 响应契约与导出**。
  - `initialize/getModel/searchModel/createModel/deleteModel` 统一兼容“已解包数据”和 AxiosResponse。
  - `getModel` 默认附加 `__format=raw`，避免编辑表单拿到 dropdown 的展示 label。
  - `exportModels` 补上 `fixedQuery`，并兼容 Blob / AxiosResponse / string；修复 admin 等解包 httpClient 下导出必失败的问题。
  - `createModel` 兼容非 `id` 主键（回退 `res.id`）。
  - `deleteModels` 用字符串比较主键，修复数字/字符串主键批量删除后行不移除；返回值新增 `failed`。
  - 主键拼 URL 时做 `encodeURIComponent`，并支持主键 `0`。

- **live 数据源和保存后的刷新**。
  - `__fetchVars` 改为 `Promise.allSettled`，单个 live 接口失败不再让整页初始化失败。
  - 不再用 `schema.id` 合并选项，避免预加载 schema 没有 id 时选项串台。
  - 保存后的详情/live 刷新失败不会再把已经成功的写入报成“保存失败”。

- **`SchemaPage` 响应式行克隆和保存流程**。
  - 修复 Vue `ref/reactive` 行被 `structuredClone` 时抛 `DataCloneError`；统一走 `toRaw` + 安全回退。
  - 默认 save action 的 `formSubmit` 增加第三个参数 `{ resolve, reject, close }`；不传控制句柄的旧用法仍保留 `resolveFormSubmit/rejectFormSubmit`。
  - `readonly` 保留“查看详情”，不再把所有行操作一起隐藏。
  - `rowActions` 字符串引用现在按默认 action 解析；`SchemaPage` 与 `SchemaViewer` 的 action 合并语义统一。
  - `SchemaPage` 默认行操作补充“查看”。

- **`Action`、移动端和 `Cell` 显示**。
  - `Action.permission` / `hasPermission` 真正参与渲染过滤；`hidden` 不再只在点击时判断，异步 hidden 采用 fail-closed。
  - 批量 action 同样做权限/隐藏判断。
  - 移动端折叠列表增加 selection checkbox，批量操作不再永远拿到空选择；同时修复折叠标题内 action 点击冒泡和按索引绑定 key 的问题。
  - `Cell` 修复 `__format=both` 下拉标签/颜色匹配：彩色枚举标签恢复颜色，数字型 live 选项显示 label 而不是原始 ID，数组/multiSelect 逐项映射。
  - `SchemaGrid` 移动端主字段支持数组 label，不再出现 `undefined`。

- **错误处理、竞态与体验**。
  - `SchemaForm` 先校验再 encode，补数字字段的“非空必须是数字”校验，避免非法输入被静默写成 0。
  - `fieldErrors['*']` 现在会在表单内显示，不再只写进一个匹配不到的字段。
  - `SchemaForm` / `SchemaGrid` / `SchemaViewer` 的异步 action 补 `catch`，避免 unhandled rejection。
  - `CRUD.searchModel` 和 `SchemaViewer.init` 增加请求序号，旧请求不会覆盖新请求。
  - 分页补 `showPageSize/pageSizes/sizeChange`，`defaultPageSize` 生效；`SchemaPage.formWidth` 随窗口 resize。
  - 删除确认、保存失败、验证失败、上传按钮接入 i18n。
  - `SchemaUIConfig.upload` 支持注入上传请求头，解决 `el-upload` 绕过 httpClient 导致 JWT 接口 401。
  - 场景过滤兼容后端历史 `view` 场景作为 `detail` 别名（配合 rest v3.1.1）。

### Features

- 新增导出：`FormSubmitControls`、`unwrapCellValue`、`findOptionByValue`、`cloneModel`、`isActionPermitted`、`isActionVisibleSync`、`resolveActions`。
- `SchemaPage` 新增 `showPageSize`、`pageSizes` props 和 `sizeChange` 事件。
- `SchemaUIConfig` 新增 `upload` 配置。

### Behavior Changes

- `CRUD.getModel` 默认附加 `__format=raw`；需要展示格式化值时显式传 `__format`。
- `SchemaPage.readonly` 现在保留 view，只隐藏写操作。
- `SchemaPage` 自定义 `rowActions` 会与默认 action 合并，不再完全替换。
- `SchemaForm` 改为先校验后 encode；`default_value` 只在 create 场景应用。
- `deleteModels` 返回值新增 `failed` 字段。
- `format=timestamp` 的整型字段提交 Unix 秒；multiSelect 更新清空提交 `'[]'`。

## [1.1.6] - 2026-08-24

### Bug Fixes

- **search 场景 el-select 空值显示 `0` 而不是 placeholder（1.1.5 修复未覆盖 search 链路）**。
  - 根因：create 与 search 走的是不同的 codec 分支。create 的空值经 `mustMarshal('' , 'integer')` 兜底成 `0`，被 1.1.5 的 `empty-values` 覆盖；而 search 表单一旦有查询参数回流（presetQuery / URL 同步），`decode(..., 'search')` 对非日期字段原样透传，假 `0` / `'0'` 直接进 v-model。假 0 的源头是 `encode(activeModel, schemas, 'search')` 把未触碰的下拉空串兜底成 `0`，且 `clearSearchModel` 只剔除 `''/null/undefined`，`0` 会作为「筛选 = 0」发给后端再随回显进入表单。
  - 修复：`codec.encode` search 场景空值字段直接跳过（含 cascader 拆列分支），真实选中的 `0` 正常提交；`codec.decode` create/update 分支空值统一落 `''`，search 分支非空值按 `schema.type` 规整（URL 回显的 `'0'` → 数字 `0` 可匹配选项），对象/数组透传。

- **decode(search) 类型规整把 boolean 字符串翻转**（本版本开发过程中发现并修复）。
  - 根因：回显值按类型规整时 boolean 走 `Boolean(v)`，`Boolean('false') === true`，URL 回显 `?enabled=false` 会错误选中"是"。
  - 修复：boolean 仅对字符串字面量 `'true'`/`'false'` 显式映射，其余场景不受影响。

- **`FormItem.vue` 合法 `value: 0` 选项被当成空值**（1.1.5 已知副作用的收敛）。
  - 修复:`empty-values` 改为 computed——选项里存在 `value === 0` 时退回 EP 默认空值集合，选中 0 值选项不再显示 placeholder；无 0 值选项的字段保持并入 `0` 的行为以兼容历史数据回显。

### Behavior Changes

- `decode` 在 create/update 场景对空整型/浮点字段返回 `''` 而非 `0`；依赖 `model.xxx === 0` 判断的消费方需调整。
- required 校验变严：整型下拉必填字段不再被假 `0` 静默通过。
- `SchemaForm.applyDefaults` 开始对整型字段生效：此前 decode 出的 `0` 不在空值判定内挡住了 default_value 回填，现在默认值能正常落到 create 表单。
- visible 联动条件按真实选择评估：父字段为空时不再"意外满足" `values: [0]` 类显示条件。
- search 提交 payload 变稀疏：未选择的字段直接缺 key（后端缺省即不过滤）；直接遍历 `emit('search', model)` key 的消费方需注意。


### Bug Fixes

- **`FormItem.vue` 整型 dropdown 字段初始显示 `0` 而不是 placeholder**。
  - 根因:`codec.decode` 对空值走 `mustMarshal(v, 'integer')` 兜底成 `0`,el-select 默认 `empty-values` 不含 `0`,把 model 里的 `0` 当成已选值直接渲染,placeholder("请选择 xxxx")永远不出现。
  - 修复:dropdown 分支的 el-select 增加 `:empty-values="[0, '', undefined, null]"`,在 EP 默认空值基础上并入 `0`,让下拉正常显示占位文案。
  - 已知副作用:若某下拉存在合法的 `value: 0` 选项(如"未分类"),选中后显示会退回 placeholder;此类 schema 需等待 decode 层职责归位方案。

## [1.1.4] - 2026-08-21

### Bug Fixes

- **`Cell.vue` `multiSelect` 列渲染空白**。
  - 根因:`rawValue` 只对 `{label, value}` 单对象形态做解包,没有 `Array.isArray` 分支。`codec.decode` 会把 `multiSelect` 字段解成对象数组,`typeof [] === 'object'` 且数组没有 `.label`/`.value`,走对象分支会退化成空串,整列显示空白。
  - 修复:新增 `Array.isArray` 分支,把各项的 `label`(兜底 `String(value)`)用 `', '` 拼接后返回。`displayValue` 的 `find` / `formatValueByFormat` 走 default 分支输出。

- **`SchemaPage.handleBatchAction` 漏 `asyncCallback`**。
  - 根因:仅判断 `typeof action.callback === 'function'`,只用 `asyncCallback` 的批量操作(典型:批量导出、批量归档需要 `await httpClient`)按钮静默 no-op。
  - 修复:对齐 `SchemaGrid.handleActionClick` 的双分支写法,callback 同步调用、asyncCallback 链上 `.catch` 防 unhandled rejection。同步分支顺手补传 `props.schemas` 第二参。

- **`FormItem.vue` / `Cell.vue` 漏 `inject(GLOBAL_CONFIG_KEY)`**。
  - 根因:两个叶子组件直接 `createDefaultTranslator()`,即使消费方在 `SchemaUIPlugin` 里配了 `i18n.t`,所有 dropdown placeholder / boolean 选项标签 / file 上传按钮文案 / cell tag 文本都停留默认中文兜底。
  - 修复:与 `SchemaPage` / `SchemaForm` 顶层一致地 `inject(GLOBAL_CONFIG_KEY)`,`t = globalConfig?.i18n?.t || createDefaultTranslator()`。

- **`mustMarshal` 把 `±Infinity` 字面量穿透到 wire payload**。
  - 根因:`parseFloat('Infinity') === Infinity`,而 `Number.isNaN(Infinity) === false`,旧版 `Number.isNaN` 兜底漏掉。`default_value: 'Infinity'` 或上游计算默认值中的 `±Inf` 字面量会直接进 Go decoder 导致失败。
  - 修复:`integer` / `float` / `decimal` 分支统一用 `Number.isFinite` 替换 `Number.isNaN`,同时兜住 `NaN` 与 `±Infinity`。

### Refactor

- 公开 `Scenario` 类型到 `src/index.ts`。`Schema.scenarios` / `SchemaRule.required` / 所有 `scenario` prop 都依赖它,此前消费方只能 inline 字面量联合或走未在 `exports` 中暴露的内部路径。

## [1.1.3] - 2026-08-21

### Bug Fixes

- **`SchemaGrid` 移动折叠列表主字段在 dropdown 列上显示成 `[object Object]`**。
  - 根因:`SchemaGrid.vue#getMobilePrimaryLabel` 两条取值分支都直接对 model 取值做 `String(...)`:
    1. 命中 primary_key schema → `String(model[pkSchema.column])`
    2. 未命中 → 取首个 key,`String(model[firstKey])`
    当该列是 dropdown,后端原始 model 字段有时是 `{ label, value }` 对象形态,`String({...})` 得到 `[object Object]`,折叠面板标题里就显示这个字符串。
  - 修复:两条分支都改用 `src/core/model.ts#getModelLabel(model, column)`,统一处理 `{ label, value }` 对象(返回 label)、原始值(返回 `String(value)`)、`null/undefined`(返回 `''`)。与 PC 端 `findModelPrimaryKey` 解包 `__format=both` 单元格时的语义对齐。
  - 影响范围:仅影响开启 `responsive` + 移动断点下的折叠列表主字段展示,以及任何把 dropdown 列作为 schema 第一列(无 primary_key)的场景。
  - 验证:`npm run typecheck` / `npm run build` (76.99 kB ES) / `npm test` (62/62) 全绿;`getModelLabel` 在 `rest-ui.es.js` 内的引用正常解析。

## [1.1.2] - 2026-08-21

### Bug Fixes

- **`FormItem.vue` 中 schema 下拉 (`format=dropdown` / `multiSelect`) 选项无法渲染**。
  - 根因:上次构建优化 (1.1.1) 把 EP 改成深层路径 import 时,`select` 模块里
    `ElOption` 与 `ElSelect` 写在同一行:
    ```js
    import ElOption from 'element-plus/es/components/select/index.mjs'
    import ElSelect from 'element-plus/es/components/select/index.mjs'
    ```
    但 EP `select/index.mjs` 的 `default` 导出是 `ElSelect`,`ElOption` 是命名导出。
    两次 default import 被 rollup 合并为同一绑定,`ElOption` 实际指向 `ElSelect` 组件
    对象。模板里 `<el-option v-for="item in schema.attributes.values">` 被编译成
    对 ElSelect 的 `createBlock`,每个下拉项都被渲染成嵌套的 ElSelect,导致下拉面板
    打不开 / 不显示选项。
  - 修复:按 1.1.1 已建立的"父+子同源模块用 named import"模式 (SchemaForm /
    SchemaGrid / SchemaPage 都已正确) 改为:
    ```js
    import { ElOption, ElSelect } from 'element-plus/es/components/select/index.mjs'
    ```
  - 影响范围:所有 `format=dropdown` / `format=multiSelect` 的 schema 字段(搜索栏、
    表单、列表筛选都会用到)。其它 `<el-option>` 用法(`search_boolean` 的两个
    true/false 项)同样依赖此绑定,一并修复。
  - 验证:dist 中 `select/index.mjs` 的 import 由合并态 (`import ie from ...`)
    恢复为 `import { ElSelect as Pe, ElOption as ge } from ...`,循环渲染处
    `<el-option>` 现在引用 `ge` (ElOption) 而非 `Pe` (ElSelect)。

## [1.1.1] - 2026-08-21

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

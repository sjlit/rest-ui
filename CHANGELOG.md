# Changelog

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

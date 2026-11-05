import type { Model, Schema, Scenario } from './types'
import { unwrapCellValue } from './model.ts'

// ============ 类型转换核心 ============

/**
 * 按 schema.type 把表单/接口值转换为对应类型。
 * 整数/浮点空值兜底为 0，字符串空值兜底为 ''。
 */
function mustMarshal(v: any, type: string): any {
  switch (type) {
    case 'integer':
      if (v instanceof Date) return Math.floor(v.getTime() / 1000)
      if (v === '' || v === null || v === undefined) return 0
      const n = parseInt(String(v), 10)
      return Number.isFinite(n) ? n : 0
    case 'decimal':
    case 'float':
    case 'double':
      if (v === '' || v === null || v === undefined) return 0
      const f = parseFloat(String(v))
      // Number.isFinite 把 NaN 和 ±Infinity 都视为非法,统一兜底为 0,
      // 防止 'Infinity' / '-Infinity' 字符串或上游计算默认值中的 ±Inf
      // 字面量穿透到 wire payload 导致 Go decoder 失败。
      return Number.isFinite(f) ? f : 0
    case 'boolean':
      return toBoolean(v)
    case 'string':
      if (v !== null && typeof v === 'object') return JSON.stringify(v)
      return v == null ? '' : String(v)
    default:
      return v
  }
}

/**
 * 把 UI / JSON / 查询参数里的布尔表示统一转成 boolean。
 *
 * 不能直接用 Boolean(v)：Boolean('false') === true，会把后端回显或
 * default_value 里的字符串 "false" 翻成“是”。
 */
function toBoolean(v: any): boolean {
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'false' || s === '0' || s === 'off' || s === 'no') return false
    if (s === 'true' || s === '1' || s === 'on' || s === 'yes') return true
  }
  return Boolean(v)
}

function isNumericType(type: string): boolean {
  return ['integer', 'float', 'decimal', 'double'].includes(type)
}

function isEmptyValue(v: any): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
}

// ============ 日期辅助（零依赖） ============

const DATE_FORMATS = ['time', 'date', 'datetime', 'timestamp']

/**
 * 把任意值解析为 Date，无法解析返回 null。
 * 支持秒级/毫秒级时间戳、ISO 字符串、纯日期、纯时间、空值。
 */
function toDate(v: any): Date | null {
  if (v == null) return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  if (typeof v === 'number') {
    // 秒级时间戳 < 1e12，毫秒级 >= 1e12
    const ms = v < 1e12 ? v * 1000 : v
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof v === 'string') {
    const raw = v.trim()
    if (raw === '') return null

    // 纯时间 'HH:mm' / 'HH:mm:ss'：锚定到当天，避免 new Date('10:30') 得到 Invalid Date。
    const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw)
    if (timeMatch) {
      const d = new Date()
      d.setHours(
        Number(timeMatch[1]),
        Number(timeMatch[2]),
        Number(timeMatch[3] || 0),
        0,
      )
      return Number.isNaN(d.getTime()) ? null : d
    }

    // 纯日期 'YYYY-MM-DD'：必须按本地时间解析。new Date('2024-01-01') 按 UTC，
    // 在负时区用本地 getter 格式化会变成前一天。
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
    if (dateMatch) {
      const d = new Date(
        Number(dateMatch[1]),
        Number(dateMatch[2]) - 1,
        Number(dateMatch[3]),
      )
      return Number.isNaN(d.getTime()) ? null : d
    }

    // 兼容 'YYYY-MM-DD HH:mm:ss' / ISO 字符串
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
      ? raw.replace(' ', 'T')
      : raw
    const d = new Date(normalized)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/**
 * 按 format 格式化 Date 为字符串。
 * format: 'date' | 'time' | 'datetime' | 'timestamp'（其他按 datetime 处理）。
 */
function formatByFormat(fmt: string, d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  const ss = pad(d.getSeconds())
  if (fmt === 'date') return `${y}-${m}-${dd}`
  if (fmt === 'time') return `${hh}:${mi}:${ss}`
  return `${y}-${m}-${dd} ${hh}:${mi}:${ss}`
}

/**
 * startOf 用于 time_search_range：'day' | 'week' | 'month' | 'year'
 */
function startOfRange(range: string): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (range === 'week') {
    const day = d.getDay() || 7 // 周日 getDay()=0，转 7
    d.setDate(d.getDate() - (day - 1))
  } else if (range === 'month') {
    d.setDate(1)
  } else if (range === 'year') {
    d.setMonth(0, 1)
  }
  return d
}

function endOfRange(range: string): Date {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  if (range === 'week') {
    const day = d.getDay() || 7
    d.setDate(d.getDate() + (7 - day))
  } else if (range === 'month') {
    d.setMonth(d.getMonth() + 1, 0)
  } else if (range === 'year') {
    d.setMonth(11, 31)
  }
  // 不能超过当前时间
  const now = Date.now()
  return d.getTime() > now ? new Date(now) : d
}

// ============ encode ============

/**
 * 把表单数据编码为提交格式。
 * 遍历 schema 顺序而非 model 的 key，处理 cascader 拆列 / multiSelect 数组 / daterange 等特殊 format。
 */
export function encode(raw: Model, schemas: Schema[], scenario: Scenario): Model {
  const data: Model = {}
  const excludes: string[] = []
  if (!raw || !schemas) return data
  scenario = scenario || 'update'

  for (const schema of schemas) {
    const attrs = (schema.attributes || {}) as any
    const live = attrs.live || {}

    // 1. cascader 多列拆分
    if (live.enable && live.type === 'cascader') {
      const columns: string[] = Array.isArray(live.columns) ? live.columns : []
      const vals = unwrapCellValue(raw[schema.column])
      if (columns.length === 0) {
        data[schema.column] = mustMarshal(vals, 'string')
      } else if (Array.isArray(vals)) {
        for (let i = 0; i < columns.length; i++) {
          // search 场景缺失列跳过，避免 mustMarshal 兜底出假 0（同第 6 步）
          if (scenario === 'search' && vals[i] === undefined) continue
          data[columns[i]] = mustMarshal(vals[i], schema.type)
          excludes.push(columns[i])
        }
      } else {
        // search 场景整体为空时不写任何列
        if (scenario === 'search') continue
        for (let i = 0; i < columns.length; i++) {
          data[columns[i]] = mustMarshal('', schema.type)
          excludes.push(columns[i])
        }
      }
      continue
    }

    // 2. multiSelect 数组（搜索场景不参与，仅靠 schema.format === 'multiSelect' 判定）
    if (schema.format === 'multiSelect') {
      const v = unwrapCellValue(raw[schema.column])
      if (Array.isArray(v)) {
        // 逐元素按 schema.type 规整后再 JSON 序列化：
        // mustMarshal 设计目标是对单值做类型规整，直接套到 JSON 字符串上会让
        // type=integer/float/boolean 走 parseInt/parseFloat/Boolean 触发 NaN → 0，
        // 整组多选值被静默丢弃。逐元素规整保留类型安全网，又不影响正常 type=string 场景。
        if (v.length > 0) {
          const normalized = v.map((x) => mustMarshal(x, schema.type))
          data[schema.column] = JSON.stringify(normalized)
        } else if (scenario === 'update') {
          // 更新时必须显式提交空数组，否则后端会保留旧值，多选永远清不掉。
          // create 保持稀疏（与历史行为一致），search 也不写空数组。
          data[schema.column] = '[]'
        }
      } else if (typeof v === 'string' && v !== '') {
        // 已经是后端返回的 JSON 字符串（例如外部直接调用 encode）原样保留
        data[schema.column] = v
      }
      continue
    }

    // 3. date / datetime / timestamp / time（含 daterange 数组）
    if (DATE_FORMATS.includes(schema.format)) {
      const v = unwrapCellValue(raw[schema.column])
      if (Array.isArray(v)) {
        const parts: string[] = []
        for (const item of v) {
          const d = toDate(item)
          parts.push(d ? formatByFormat(schema.format, d) : '')
        }
        data[schema.column] = parts.join('/')
      } else {
        const d = toDate(v)
        // int64 时间戳列必须提交 Unix 秒，不能提交 'YYYY-MM-DD HH:mm:ss'
        // 字符串，否则 Go 的 json.Unmarshal 会无法写入 int64 字段。
        if (
          schema.format === 'timestamp' &&
          isNumericType(schema.type) &&
          scenario !== 'search'
        ) {
          data[schema.column] = d ? Math.floor(d.getTime() / 1000) : 0
        } else {
          data[schema.column] = d ? formatByFormat(schema.format, d) : ''
        }
      }
      continue
    }

    // 4. bool 字段空值跳过（不写入结果）
    if (['boolean', 'bool'].includes(schema.format)) {
      const v = unwrapCellValue(raw[schema.column])
      if (v === '' || v === undefined) continue
    }

    // 5. 已通过 cascader 写入的列跳过
    if (excludes.includes(schema.column)) continue

    // 6. 其他：default_value 兜底 + mustMarshal
    let v = unwrapCellValue(raw[schema.column])
    if (v === undefined || v === null || v === '') {
      // search 场景空值直接跳过：整型/浮点经 mustMarshal 会兜底成 0，
      // 未选择的下拉字段会被当成「筛选 = 0」发给后端，查询参数回显到表单
      // 后又变成假 0（el-select 显示 "0" 而非 placeholder）。
      if (scenario === 'search') continue
      v = scenario === 'create' ? (attrs.default_value ?? '') : ''
    }
    data[schema.column] = mustMarshal(v, schema.type)
  }
  return data
}

// ============ decode ============

/**
 * 把后端数据解码为表单可用格式。
 * 整型/浮点 → 字符串展示给 UI；日期 → 按 format 格式化；multiSelect → 数组；daterange → 数组。
 */
export function decode(raw: Model, schemas: Schema[], scenario: Scenario): Model {
  const data: Model = {}
  if (!raw || !schemas) return data
  scenario = scenario || 'update'

  for (const schema of schemas) {
    const attrs = (schema.attributes || {}) as any
    const live = attrs.live || {}
    const rawValue = raw ? unwrapCellValue(raw[schema.column]) : undefined
    const defaultProvided =
      scenario === 'create' &&
      attrs.default_value !== undefined &&
      attrs.default_value !== null &&
      attrs.default_value !== ''

    const withCreateDefault = (v: any) => {
      if (isEmptyValue(v) && defaultProvided) return attrs.default_value
      return v
    }

    const parseDateValue = (v: any): string => {
      const d = toDate(v)
      return d ? formatByFormat(schema.format, d) : ''
    }

    const parseDateRange = (v: any): string[] => {
      if (Array.isArray(v)) {
        return v.map((item) => parseDateValue(unwrapCellValue(item)))
      }
      if (typeof v === 'string' && (v.includes('/') || v.includes(','))) {
        const sep = v.includes('/') ? '/' : ','
        const parts = v.split(sep)
        if (parts.length === 2) {
          return [parseDateValue(parts[0]), parseDateValue(parts[1])]
        }
      }
      const single = parseDateValue(v)
      return single ? [single, single] : []
    }

    // search 场景
    if (scenario === 'search') {
      if (DATE_FORMATS.includes(schema.format)) {
        if (isEmptyValue(rawValue)) {
          // time 字段的搜索控件是单个时间选择器，不生成区间。
          if (attrs.time_search_range && schema.format !== 'time') {
            const start = startOfRange(attrs.time_search_range)
            const end = endOfRange(attrs.time_search_range)
            data[schema.column] = [
              formatByFormat(schema.format, start),
              formatByFormat(schema.format, end),
            ]
          } else {
            data[schema.column] = schema.format === 'time' ? '' : []
          }
        } else if (Array.isArray(rawValue)) {
          data[schema.column] = rawValue.map((item) =>
            parseDateValue(unwrapCellValue(item)),
          )
        } else if (schema.format === 'time') {
          data[schema.column] = parseDateValue(rawValue)
        } else {
          // 支持 presetQuery / URL 回显的 'start/end'、'start,end' 以及单日期
          data[schema.column] = parseDateRange(rawValue)
        }
      } else {
        // 空值统一兜底为 ''，非空值才按 schema.type 规整。
        // 不能对空值走 mustMarshal：整型会落成 0，URL/查询参数回显的 '0'
        // 也无法与真实选项区分，el-select 会显示 "0" 而不是 placeholder。
        if (isEmptyValue(rawValue)) {
          data[schema.column] = ''
        } else if (typeof rawValue === 'object') {
          // 数组/对象（如调用方自定义的多值过滤参数）原样透传
          data[schema.column] = rawValue
        } else if (schema.type === 'boolean' && typeof rawValue === 'string') {
          data[schema.column] = toBoolean(rawValue)
        } else {
          data[schema.column] = mustMarshal(rawValue, schema.type)
        }
      }
      continue
    }

    // cascader 多列合并
    if (live.enable && live.type === 'cascader') {
      const columns: string[] = Array.isArray(live.columns) ? live.columns : []
      if (columns.length === 0) {
        const v = withCreateDefault(rawValue)
        if (Array.isArray(v)) {
          data[schema.column] = v.map((item) => unwrapCellValue(item))
        } else if (typeof v === 'string' && v !== '') {
          try {
            const parsed = JSON.parse(v)
            data[schema.column] = Array.isArray(parsed) ? parsed : []
          } catch {
            data[schema.column] = []
          }
        } else {
          data[schema.column] = []
        }
      } else {
        const arr: any[] = []
        for (const col of columns) {
          const v = unwrapCellValue(raw[col])
          if (v === undefined || v === null || v === '') break
          arr.push(mustMarshal(v, schema.type))
        }
        data[schema.column] = arr
      }
      continue
    }

    // multiSelect 数组
    if (schema.format === 'multiSelect') {
      let v = rawValue
      if (isEmptyValue(v) && defaultProvided) v = attrs.default_value
      if (Array.isArray(v)) {
        // 后端直接返回数组的场景：逐项解包后透传
        data[schema.column] = v.map((item) => unwrapCellValue(item))
      } else if (typeof v === 'string' && v !== '') {
        try {
          const parsed = JSON.parse(v)
          data[schema.column] = Array.isArray(parsed)
            ? parsed.map((item) => unwrapCellValue(item))
            : []
        } catch {
          // 解析失败保持 undefined，由 el-select 自行处理
        }
      } else {
        data[schema.column] = []
      }
      continue
    }

    // date / datetime / timestamp / time
    if (DATE_FORMATS.includes(schema.format)) {
      const v = withCreateDefault(rawValue)
      if (isEmptyValue(v)) {
        // 空值也要写入，避免前端组件（如 el-date-picker）找不到字段
        data[schema.column] = ''
      } else if (Array.isArray(v)) {
        data[schema.column] = v.map((item) => parseDateValue(unwrapCellValue(item)))
      } else if (typeof v === 'string' && v.indexOf('/') > -1) {
        const ss = v.split('/', 2)
        const st = toDate(ss[0])
        const et = toDate(ss[1])
        data[schema.column] = st && et
          ? [
            formatByFormat(schema.format, st),
            formatByFormat(schema.format, et),
          ]
          : []
      } else {
        data[schema.column] = parseDateValue(v)
      }
      continue
    }

    // 其他：default_value 兜底 + mustMarshal 转字符串
    let v = withCreateDefault(rawValue)
    if (isEmptyValue(v)) v = ''
    // 空值统一落 ''：el-select / el-input 的空态是 ''/null，
    // 落成 mustMarshal 兜底的 0 会被当成已选值显示 "0" 而非 placeholder。
    // 非空值仍按 schema.type 规整（'25' → 25 等）。
    data[schema.column] =
      v == null || v === '' ? '' : mustMarshal(v, schema.type)
  }
  return data
}
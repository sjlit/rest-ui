import type { Model, Schema, Scenario } from './types'

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
      return Boolean(v)
    case 'string':
      if (v !== null && typeof v === 'object') return JSON.stringify(v)
      return v == null ? '' : String(v)
    default:
      return v
  }
}

// ============ 日期辅助（零依赖） ============

const DATE_FORMATS = ['time', 'date', 'datetime', 'timestamp']

/**
 * 把任意值解析为 Date，无法解析返回 null。
 * 支持秒级/毫秒级时间戳、ISO 字符串、空值。
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
    if (v === '') return null
    // 兼容 'YYYY-MM-DD HH:mm:ss' / 'YYYY-MM-DD' / 'HH:mm:ss'
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)
      ? v.replace(' ', 'T')
      : v
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
      const vals = raw[schema.column]
      if (columns.length === 0) {
        data[schema.column] = mustMarshal(vals, 'string')
      } else if (Array.isArray(vals)) {
        for (let i = 0; i < columns.length; i++) {
          data[columns[i]] = mustMarshal(vals[i], schema.type)
          excludes.push(columns[i])
        }
      } else {
        for (let i = 0; i < columns.length; i++) {
          data[columns[i]] = mustMarshal('', schema.type)
          excludes.push(columns[i])
        }
      }
      continue
    }

    // 2. multiSelect 数组（搜索场景不参与，仅靠 schema.format === 'multiSelect' 判定）
    if (schema.format === 'multiSelect') {
      const v = raw[schema.column]
      if (Array.isArray(v) && v.length > 0) {
        // 逐元素按 schema.type 规整后再 JSON 序列化：
        // mustMarshal 设计目标是对单值做类型规整，直接套到 JSON 字符串上会让
        // type=integer/float/boolean 走 parseInt/parseFloat/Boolean 触发 NaN → 0，
        // 整组多选值被静默丢弃。逐元素规整保留类型安全网，又不影响正常 type=string 场景。
        const normalized = v.map((x) => mustMarshal(x, schema.type))
        data[schema.column] = JSON.stringify(normalized)
      }
      continue
    }

    // 3. date / datetime / timestamp / time（含 daterange 数组）
    if (DATE_FORMATS.includes(schema.format)) {
      const v = raw[schema.column]
      if (Array.isArray(v)) {
        const parts: string[] = []
        for (const item of v) {
          const d = toDate(item)
          parts.push(d ? formatByFormat(schema.format, d) : '')
        }
        data[schema.column] = parts.join('/')
      } else {
        const d = toDate(v)
        data[schema.column] = d ? formatByFormat(schema.format, d) : ''
      }
      continue
    }

    // 4. bool 字段空值跳过（不写入结果）
    if (['boolean', 'bool'].includes(schema.format)) {
      if (raw[schema.column] === '' || raw[schema.column] === undefined) continue
    }

    // 5. 已通过 cascader 写入的列跳过
    if (excludes.includes(schema.column)) continue

    // 6. 其他：default_value 兜底 + mustMarshal
    let v = raw[schema.column]
    if (v === undefined || v === null || v === '') {
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

    // search 场景
    if (scenario === 'search') {
      if (DATE_FORMATS.includes(schema.format)) {
        const v = raw[schema.column]
        if (!v && attrs.time_search_range) {
          const start = startOfRange(attrs.time_search_range)
          const end = endOfRange(attrs.time_search_range)
          data[schema.column] = [
            formatByFormat(schema.format, start),
            formatByFormat(schema.format, end),
          ]
        } else {
          data[schema.column] = []
        }
      } else {
        data[schema.column] = raw[schema.column] != null ? raw[schema.column] : ''
      }
      continue
    }

    // cascader 多列合并
    if (live.enable && live.type === 'cascader') {
      const columns: string[] = Array.isArray(live.columns) ? live.columns : []
      if (columns.length === 0) {
        try {
          data[schema.column] = raw[schema.column] ? JSON.parse(String(raw[schema.column])) : []
        } catch {
          data[schema.column] = []
        }
      } else {
        const arr: any[] = []
        for (const col of columns) {
          const v = raw[col]
          if (v === undefined || v === null || v === '') break
          arr.push(mustMarshal(v, schema.type))
        }
        data[schema.column] = arr
      }
      continue
    }

    // multiSelect 数组
    if (schema.format === 'multiSelect') {
      const v = raw[schema.column]
      if (Array.isArray(v)) {
        // 后端直接返回数组的场景：透传
        data[schema.column] = v
      } else if (typeof v === 'string' && v !== '') {
        try {
          data[schema.column] = JSON.parse(v)
        } catch {
          // 解析失败保持 undefined，由 el-multi-select 自行处理
        }
      }
      continue
    }

    // date / datetime / timestamp / time
    if (DATE_FORMATS.includes(schema.format)) {
      const v = raw[schema.column]
      if (v != null && v !== '') {
        if (typeof v === 'string' && v.indexOf('/') > -1) {
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
          const d = toDate(v)
          data[schema.column] = d ? formatByFormat(schema.format, d) : ''
        }
      } else {
        // 空值也要写入，避免前端组件（如 el-date-picker）找不到字段
        data[schema.column] = ''
      }
      continue
    }

    // 其他：default_value 兜底 + mustMarshal 转字符串
    let v: any = ''
    if (raw && Object.prototype.hasOwnProperty.call(raw, schema.column)) {
      v = raw[schema.column]
    } else if (scenario === 'create') {
      v = attrs.default_value ?? ''
    }
    data[schema.column] = mustMarshal(v == null ? '' : v, schema.type)
  }
  return data
}
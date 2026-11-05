export interface SchemaUIConfig {
  httpClient: {
    get: (url: string, config?: any) => Promise<any>
    post: (url: string, data?: any, config?: any) => Promise<any>
    put: (url: string, data?: any, config?: any) => Promise<any>
    delete: (url: string, data?: any, config?: any) => Promise<any>
  }
  hasPermission?: (permission: string) => boolean
  /** @deprecated 预留，当前未使用 */
  router?: { push: (to: any) => void }
  i18n?: { t: (key: string, ...args: any[]) => string }
  defaultPageSize?: number
  apiPrefix?: string
  /** @deprecated 预留，当前未使用 */
  transformRequest?: (config: any) => any
  /**
   * el-upload 配置。上传走浏览器原生 XHR，不经过 httpClient，
   * 需要鉴权的接口必须在这里注入 Authorization 等请求头。
   */
  upload?: {
    headers?: Record<string, string> | (() => Record<string, string>)
    withCredentials?: boolean
    name?: string
  }
}

export const GLOBAL_CONFIG_KEY = Symbol('rest-ui-config')

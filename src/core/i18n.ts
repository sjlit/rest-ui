export const defaultMessages: Record<string, string | ((...args: string[]) => string)> = {
  'validation.required': (label: string) => `${label}不能为空`,
  'validation.min': (label: string, min: string) => `${label}不能少于${min}个字符`,
  'validation.max': (label: string, max: string) => `${label}不能超过${max}个字符`,
  'validation.pattern': (label: string) => `${label}格式不正确`,
  'validation.type': (label: string) => `${label}格式类型不正确`,

  'action.search': '搜索',
  'action.create': '创建',
  'action.edit': '编辑',
  'action.delete': '删除',
  'action.view': '详情',
  'action.save': '保存',
  'action.export': '导出',
  'action.confirm': '确定',
  'action.cancel': '取消',
  'action.upload': '上传',
  'action.refresh': '刷新',
  'action.batchDelete': '批量删除',

  'search.filter': '筛选',
  'search.hint': '未设置筛选条件，默认展示全部数据',
  'search.clear': '清空',
  'search.reset': '重置',

  'toolbar.selected': (count: string) => `已选 ${count} 项`,
  'toolbar.total': (count: string) => `共 ${count} 条`,
  'toolbar.hint': '勾选行后可批量操作',
  'toolbar.clearSelection': '取消选择',

  'table.actions': '操作',
  'table.empty': '暂无数据',

  'columns.title': '显示列',
  'density.label': '表格密度',
  'density.default': '默认密度',
  'density.compact': '紧凑密度',

  'boolean.true': '是',
  'boolean.false': '否',

  'confirm.delete.title': '提示',
  'confirm.delete.message': '确认删除该数据?',
  'confirm.batchDelete.title': '批量删除',
  'confirm.batchDelete.message': (count: string) => `确认删除选中的 ${count} 条数据吗？该操作不可撤销。`,
  'error.save': '保存失败',
  'error.validation': '验证失败',

  'form.create': '创建',
  'form.edit': '编辑',
  'form.detail': '详情',

  'placeholder.select': (label: string) => `请选择${label}`,
  'placeholder.input': (label: string) => `请输入${label}`,
  'placeholder.start': (label: string) => `开始${label}`,
  'placeholder.end': (label: string) => `结束${label}`,
}

export function createDefaultTranslator(): (key: string, ...args: any[]) => string {
  return (key: string, ...args: any[]) => {
    const message = defaultMessages[key]
    if (typeof message === 'function') {
      return message(...args)
    }
    return message || key
  }
}

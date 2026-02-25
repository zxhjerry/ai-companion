/**
 * AI Companion 数据转换工具
 * 用于确保隐藏属性 (luck) 在向后端发送时被处理，在前端展示时被过滤
 */

/**
 * 清理前端发送的数据 - 保留所有属性
 * 用于前端向后端发送创建角色/用户请求
 */
export function sanitizeRequest(data: any): any {
  return data;
}

/**
 * 清理后端响应数据 - 移除隐藏属性 (luck)
 * 用于将后端响应转换为前端可显示格式
 */
export function sanitizeForFrontend<T extends object>(data: T): Omit<T, 'luck'> {
  const { luck, ...sanitized } = data as any;
  return sanitized;
}

/**
 * 批量清理角色数组 - 移除所有角色的 luck 属性
 */
export function sanitizeCompanionsArray<T extends { luck?: number }>(companions: T[]): Omit<T, 'luck'>[] {
  return companions.map(comp => {
    const { luck, ...rest } = comp as any;
    return rest;
  });
}

/**
 * 检查并清理数据，确保 luck 字段被正确隐藏
 * 开发工具函数，可在控制台调试
 */
export function debugSanitize<Obj extends { luck?: any }>(obj: Obj): {
  original: Obj;
  cleaned: Omit<Obj, 'luck'>;
  hasLuck: boolean;
} {
  return {
    original: obj,
    cleaned: ((obj) => {
      const { luck, ...rest } = obj as any;
      return rest;
    })(),
    hasLuck: !!obj.luck
  };
}

// TypeScript 类型导出
export default {
  sanitizeRequest,
  sanitizeForFrontend,
  sanitizeCompanionsArray,
  debugSanitize
};

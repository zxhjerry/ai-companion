/**
 * Global Type Declarations
 * 全局类型声明
 */

import { WebSocketMessage } from './src/services/websocket';

// ==========================================
// 环境变量类型声明
// ==========================================

interface ImportMetaEnv {
    VITE_API_BASE_URL: string;
    VITE_WS_URL: string;
    VITE_API_TIMEOUT: string;
    VITE_APP_NAME: string;
    VITE_APP_VERSION: string;
    VITE_ENABLE_DEBUG: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// ==========================================
// Window 扩展（全局对象）
// ==========================================

declare global {
    interface Window {
        // 全局配置
        appConfig: {
            apiBaseURL: string;
            wsURL: string;
            appName: string;
            appVersion: string;
        };
    }

    // 服务工作者
    interface ServiceWorkerRegistration {
        readonly active: ServiceWorker | null;
        readonly installing: ServiceWorker | null;
        readonly waiting: ServiceWorker | null;
        readonly scope: string;
        update(): Promise<void>;
        uninstall(): Promise<void>;
        getNotifications(): Promise<Notification[]>;
        showNotification(title: string, options?: NotificationOptions): Promise<void>;
    }

    // WebGL 上下文（用于 4K/8K 纹理渲染）
    interface WebGL2RenderingContext {
        // 扩展的 WebGL 方法
        loadTexture(url: string): Promise<WebGLTexture>;
    }
}

// ==========================================
 * React 扩展
// ==========================================

declare module 'react' {
    interface HTMLAttributes<T> {
        loading?: 'lazy' | 'eager';
        decoding?: 'async' | 'auto' | 'sync';
    }
}

// ==========================================
 * Vite 扩展
// ==========================================

declare module '*.svg' {
    const content: any;
    export default content;
}

declare module '*.png' {
    const content: string;
    export default content;
}

declare module '*.jpg' {
    const content: string;
    export default content;
}

declare module '*.webp' {
    const content: string;
    export default content;
}

declare module '*.css' {
    const content: any;
    export default content;
}

// ==========================================
 * Canvas Context 扩展
 * ==========================================

declare module '@tanstack/react-virtual' {
    export interface UseVirtualizerOptions<TScrollElement, TItemElement> {}
}

// ==========================================
 * 第三方库类型扩展
 * ==========================================

// IntersectionObserver 扩展（自定义支持）
interface IntersectionObserverEntryExtended extends IntersectionObserverEntry {
    isIntersecting?: boolean;
}

// Performance API 扩展
interface PerformanceExtended extends Performance {
    memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
    };
}

declare const performance: PerformanceExtended;

// ==========================================
 * 导出
 * ==========================================

export {};

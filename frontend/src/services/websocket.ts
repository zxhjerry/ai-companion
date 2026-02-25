/**
 * WebSocket Client - WebSocket 客户端
 * 接收后端队列完成的异步剧本和掉落通知
 */

// ==========================================
// 类型定义
// ==========================================

export interface WebSocketMessage {
    type:
        | 'script_generated' // 剧本生成完成
        | 'script_failed' // 剧本生成失败
        | 'gacha_pull' // 抽卡结果
        | 'item_obtained' // 获得物品
        | 'battle_completed' // 战斗完成
        | 'affinity_updated' // 好感度更新
        | 'notification' // 一般通知
        | 'error'; // 错误消息;

    data: any;
    timestamp: string;
    requestId?: string;
}

export interface WebSocketConfig {
    url: string;
    protocols?: string | string[];
    reconnectInterval?: number; // 重连间隔（毫秒）
    maxReconnectAttempts?: number; // 最大重连次数
    heartbeatInterval?: number; // 心跳间隔（毫秒）
}

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

// ==========================================
// WebSocket 客户端类
// ==========================================

export class WebSocketClient {
    private ws: WebSocket | null = null;
    private config: WebSocketConfig;
    private eventHandlers: Map<string, Set<WebSocketEventHandler>> = new Map();
    private reconnectTimer: NodeJS.Timeout | null = null;
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private isManualClose: boolean = false;
    private reconnectAttempts: number = 0;
    private isConnected: boolean = false;

    constructor(config: WebSocketConfig) {
        this.config = {
            reconnectInterval: 5000, // 5 秒
            maxReconnectAttempts: 10, // 最多 10 次
            heartbeatInterval: 30000, // 30 秒
            ...config,
        };
    }

    /**
     * 连接 WebSocket
     */
    connect(): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('✅ WebSocket 已连接');
            return;
        }

        try {
            console.log(`🔌 正在连接 WebSocket: ${this.config.url}`);

            this.ws = new WebSocket(this.config.url, this.config.protocols);

            this.ws.onopen = this.handleOpen.bind(this);
            this.ws.onmessage = this.handleMessage.bind(this);
            this.ws.onerror = this.handleError.bind(this);
            this.ws.onclose = this.handleClose.bind(this);

        } catch (error) {
            console.error('❌ WebSocket 连接失败:', error);
            this.scheduleReconnect();
        }
    }

    /**
     * 断开连接
     */
    disconnect(force: boolean = false): void {
        this.isManualClose = force;

        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.isConnected = false;
        console.log('🔌 WebSocket 已断开连接');
    }

    /**
     * 发送消息
     */
    send(message: any): boolean {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('❌ WebSocket 未连接，无法发送消息');
            return false;
        }

        try {
            const payload = JSON.stringify(message);
            this.ws.send(payload);
            console.log('📤 发送消息:', payload);
            return true;
        } catch (error) {
            console.error('❌ 发送消息失败:', error);
            return false;
        }
    }

    /**
     * 注册事件处理器
     */
    on(eventType: string, handler: WebSocketEventHandler): () => void {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, new Set());
        }

        this.eventHandlers.get(eventType)?.add(handler);

        // 返回取消注册的函数
        return () => {
            this.off(eventType, handler);
        };
    }

    /**
     * 取消事件处理器
     */
    off(eventType: string, handler: WebSocketEventHandler): void {
        const handlers = this.eventHandlers.get(eventType);
        if (handlers) {
            handlers.delete(handler);
        }
    }

    /**
     * 清除所有事件处理器
     */
    clearAllHandlers(): void {
        this.eventHandlers.clear();
    }

    /**
     * 处理连接打开
     */
    private handleOpen(event: Event): void {
        console.log('✅ WebSocket 连接成功');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // 启动心跳
        this.startHeartbeat();

        // 触发连接事件（用于通知 UI）
        this.triggerEvent('connection_open', {
            type: 'connection_open',
            data: { timestamp: new Date().toISOString() },
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * 处理消息
     */
    private handleMessage(event: MessageEvent): void {
        try {
            const message: WebSocketMessage = JSON.parse(event.data);

            console.log('📥 收到消息:', message);

            // 根据消息类型触发对应的事件处理器
            this.triggerEvent(message.type, message);

            // 触发所有消息处理器（通配符）
            this.triggerEvent('*', message);

        } catch (error) {
            console.error('❌ 消息解析失败:', error);
        }
    }

    /**
     * 处理错误
     */
    private handleError(event: Event): void {
        console.error('❌ WebSocket 错误:', event);

        // 触发错误事件
        this.triggerEvent('error', {
            type: 'error',
            data: { error: 'WebSocket error' },
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * 处理连接关闭
     */
    private handleClose(event: CloseEvent): void {
        console.log(`🔌 WebSocket 连接关闭: ${event.code} - ${event.reason}`);
        this.isConnected = false;

        // 停止心跳
        this.stopHeartbeat();

        // 触发关闭事件
        this.triggerEvent('connection_close', {
            type: 'connection_close',
            data: {
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean,
            },
            timestamp: new Date().toISOString(),
        });

        // 如果不是手动关闭，尝试重连
        if (!this.isManualClose) {
            this.scheduleReconnect();
        }
    }

    /**
     * 触发事件处理器
     */
    private triggerEvent(eventType: string, message: WebSocketMessage): void {
        const handlers = this.eventHandlers.get(eventType);

        if (handlers) {
            handlers.forEach((handler) => {
                try {
                    handler(message);
                } catch (error) {
                    console.error(`❌ 事件处理器执行失败: ${eventType}`, error);
                }
            });
        }
    }

    /**
     * 启动心跳
     */
    private startHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }

        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send({ type: 'ping', timestamp: new Date().toISOString() });
                console.log('💓 心跳发送');
            }
        }, this.config.heartbeatInterval);
    }

    /**
     * 停止心跳
     */
    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * 安排重连
     */
    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
            console.error('❌ 达到最大重连次数，停止重连');
            return;
        }

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        this.reconnectAttempts++;
        const delay = this.config.reconnectInterval! * this.reconnectAttempts; // 指数退避

        console.log(`🔄 ${delay}ms 后尝试第 ${this.reconnectAttempts} 次重连...`);

        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, delay);
    }

    /**
     * 获取连接状态
     */
    getState(): {
        connected: boolean;
        reconnectAttempts: number;
        readyState: number;
    } {
        return {
            connected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            readyState: this.ws?.readyState ?? WebSocket.CLOSED,
        };
    }
}

// ==========================================
// React Hook - useWebSocket
// ==========================================

import { useEffect, useRef, useMemo } from 'react';
import { useWebSocketStore } from '../store';

export interface UseWebSocketOptions extends Partial<WebSocketConfig> {
    enabled?: boolean; // 是否自动连接
    onOpen?: () => void;
    onClose?: (event: CloseEvent) => void;
    onError?: (event: Event) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
    const {
        url,
        enabled = true,
        onOpen,
        onClose,
        onError,
        ...rest
    } = options;

    const wsRef = useRef<WebSocketClient | null>(null);
    const handlersRef = useRef<Map<string, Set<WebSocketEventHandler>>>(new Map());
    const setConnected = useWebSocketStore((state) => state.setConnected);
    const addMessage = useWebSocketStore((state) => state.addMessage);

    // 初始化 WebSocket 客户端
    const client = useMemo(() => {
        if (!url) {
            return null;
        }

        return new WebSocketClient({
            url,
            ...rest,
        });
    }, [url]); // 仅在 url 变化时重新创建

    // 连接/断开 WebSocket
    useEffect(() => {
        if (!client || !enabled) {
            return;
        }

        // 注册内置事件处理器
        const offConnectionOpen = client.on('connection_open', () => {
            setConnected(true);
            onOpen?.();
        });

        const offConnectionClose = () => {
            setConnected(false);
            onClose?.();
        };

        const offError = () => {
            onError?.();
        };

        // 接收所有消息并存储到 Zustand store
        const offAllMessages = client.on('*', (message) => {
            addMessage(message);
        });

        // 连接
        client.connect();

        // 清理
        return () => {
            offConnectionOpen();
            offConnectionClose();
            offError();
            offAllMessages();
            client.disconnect(); // 自动重连关闭
            wsRef.current = null;
        };
    }, [client, enabled, setConnected, addMessage, onOpen, onClose, onError]);

    // 注册事件处理器
    useEffect(() => {
        wsRef.current = client;
    }, [client]);

    const sendMessage = (message: any): boolean => {
        if (!client) {
            console.error('❌ WebSocket 客户端未初始化');
            return false;
        }

        return client.send(message);
    };

    const on = (eventType: string, handler: WebSocketEventHandler): () => void => {
        if (!client) {
            console.error('❌ WebSocket 客户端未初始化');
            return () => {};
        }

        return client.on(eventType, handler);
    };

    const off = (eventType: string, handler: WebSocketEventHandler): void => {
        if (!client) {
            console.error('❌ WebSocket 客户端未初始化');
            return;
        }

        client.off(eventType, handler);
    };

    const disconnect = (force: boolean = false): void => {
        if (!client) {
            console.error('❌ WebSocket 客户端未初始化');
            return;
        }

        client.disconnect(force);
    };

    const reconnect = (): void => {
        if (!client) {
            console.error('❌ WebSocket 客户端未初始化');
            return;
        }

        client.disconnect(true);
        client.connect();
    };

    const getState = () => {
        if (!client) {
            return {
                connected: false,
                reconnectAttempts: 0,
                readyState: WebSocket.CLOSED,
            };
        }

        return client.getState();
    };

    return {
        client,
        sendMessage,
        on,
        off,
        disconnect,
        reconnect,
        getState,
    };
}

// ==========================================
// React Hook - useWebSocketMessage
// ==========================================

/**
 * 专门用于监听特定类型消息的 Hook
 */
export function useWebSocketMessage<T = any>(
    messageType: string,
    handler: (message: WebSocketMessage & { data: T }) => void,
    deps: any[] = [],
) {
    const { client } = useWebSocket();

    useEffect(() => {
        if (!client) {
            return;
        }

        const unsubscribe = client.on(messageType, (message) => {
            handler(message as WebSocketMessage & { data: T });
        });

        return () => {
            unsubscribe();
        };
    }, [client, messageType, handler, ...deps]);
}

// ==========================================
// 示例：监听剧本生成完成
// ==========================================

// function ScriptGenerator() {
//     useWebSocketMessage('script_generated', (message) => {
//         console.log('✅ 剧本生成完成:', message.data.nodes);
//
//         // 更新 Zustand store
//         setCurrentScriptNodes(message.data.nodes);
//         setGeneratescript(false);
//     });
//
//     return <div>正在生成剧本...</div>;
// }
//
// // 示例：监听获得物品
// function ItemNotifications() {
//     useWebSocketMessage('item_obtained', (message) => {
//         console.log('🎁 获得物品:', message.data.item);
//
//         // 更新背包
//         addItem(message.data.item);
//
//         // 显示通知
//         toast.success(`获得物品: ${message.data.item.name}`);
//     });
//
//     return <Notifications />;
// }

export default WebSocketClient;

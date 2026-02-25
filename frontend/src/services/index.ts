/**
 * Services Index
 * 统一导出所有服务
 */

// WebSocket Client
export {
    WebSocketClient,
    useWebSocket,
    useWebSocketMessage,
} from './websocket';

export type {
    WebSocketMessage,
    WebSocketConfig,
    WebSocketEventHandler,
    UseWebSocketOptions,
} from './websocket';

// ==========================================
// API Client（REST API）
// ==========================================

export interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    timestamp: string;
}

export interface APIConfig {
    baseURL: string;
    timeout?: number;
    headers?: Record<string, string>;
}

class APIClient {
    private config: APIConfig;

    constructor(config: APIConfig) {
        this.config = config;
    }

    private buildURL(endpoint: string, params?: Record<string, any>): string {
        const url = new URL(this.config.baseURL + endpoint);

        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                url.searchParams.append(key, String(value));
            });
        }

        return url.toString();
    }

    private async request<T>(
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        endpoint: string,
        data?: any,
        params?: Record<string, any>,
    ): Promise<APIResponse<T>> {
        const url = this.buildURL(endpoint, params);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...this.config.headers,
        };

        const config: RequestInit = {
            method,
            headers,
        };

        if (data) {
            config.body = JSON.stringify(data);
        }

        if (this.config.timeout) {
            config.signal = AbortSignal.timeout(this.config.timeout);
        }

        try {
            const response = await fetch(url, config);
            const result: APIResponse<T> = await response.json();

            return result;

        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'NETWORK_ERROR',
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
                timestamp: new Date().toISOString(),
            };
        }
    }

    get<T>(endpoint: string, params?: Record<string, any>): Promise<APIResponse<T>> {
        return this.request<T>('GET', endpoint, undefined, params);
    }

    post<T>(endpoint: string, data?: any): Promise<APIResponse<T>> {
        return this.request<T>('POST', endpoint, data);
    }

    put<T>(endpoint: string, data?: any): Promise<APIResponse<T>> {
        return this.request<T>('PUT', endpoint, data);
    }

    delete<T>(endpoint: string, data?: any): Promise<APIResponse<T>> {
        return this.request<T>('DELETE', endpoint, data);
    }
}

// 初始化 API Client
const apiClient = new APIClient({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000'),
});

export default apiClient;

// ==========================================
// Gacha API
// ==========================================

export interface GachaPullRequest {
    userId: string;
    poolId: string;
    pullCount: number;
    currency: 'gold' | 'gems';
}

export interface GachaPullResponse {
    success: boolean;
    poolId: string;
    pullCount: number;
    currency: string;
    cost: number;
    results: Array<{
        instanceId: string;
        templateId: string;
        name: string;
        rarity: string;
        tier: number;
        isSoulbound: boolean;
        obtainedAt: string;
    }>;
    pityTriggered: boolean;
    pityCounter: number;
    currentPityRate: number;
    assets: {
        goldBalance: number;
        gemsBalance: number;
        inventoryCount: number;
    };
}

export const gachaAPI = {
    pull: async (request: GachaPullRequest): Promise<APIResponse<GachaPullResponse>> => {
        return apiClient.post<GachaPullResponse>('/gacha/pull', request);
    },

    getPools: async (userId: string): Promise<APIResponse<any[]>> => {
        return apiClient.get<any[]>('/gacha/pools', { userId });
    },

    getHistory: async (userId: string, limit: number = 20): Promise<APIResponse<any[]>> => {
        return apiClient.get<any[]>('/gacha/history', { userId, limit });
    },
};

// ==========================================
// Inventory API
// ==========================================

export const inventoryAPI = {
    getInventory: async (userId: string): Promise<APIResponse<any[]>> => {
        return apiClient.get<any[]>('/inventory', { userId });
    },

    equipItem: async (instanceId: string): Promise<APIResponse<any>> => {
        return apiClient.post<any>('/inventory/equip', { instanceId });
    },

    unequipItem: async (instanceId: string): Promise<APIResponse<any>> => {
        return apiClient.post<any>('/inventory/unequip', { instanceId });
    },

    useItem: async (instanceId: string): Promise<APIResponse<any>> => {
        return apiClient.post<any>('/inventory/use', { instanceId });
    },
};

// ==========================================
// Script API
// ==========================================

export interface GenerateScriptRequest {
    userId: string;
    companionId: string;
    scenarioType: 'daily_dialog' | 'battle_intro' | 'battle_outro' | 'gift_response' | 'hidden_event';
    options: {
        includeDialog: boolean;
        includeStatCheck: boolean;
        includeCombat: boolean;
        maxNodes: number;
    };
}

export const scriptAPI = {
    generate: async (request: GenerateScriptRequest): Promise<APIResponse<any>> => {
        return apiClient.post<any>('/script/generate', request);
    },

    getNode: async (nodeId: string): Promise<APIResponse<any>> => {
        return apiClient.get<any>(`/script/nodes/${nodeId}`);
    },
};

// ==========================================
// Battle API
// ==========================================

export interface StartBattleRequest {
    userId: string;
    lineupId: string;
    enemyLineupId?: string;
    battleType: 'pve' | 'pvp';
}

export interface BattleResult {
    battleId: string;
    winner: 'attacker' | 'defender';
    turns: number;
    logs: Array<{
        turn: number;
        actor: string;
        action: string;
        damage?: number;
        heal?: number;
        isCritical?: boolean;
    }>;
    rewards: {
        exp: number;
        gold: number;
        items: Array<{ templateId: string; count: number }>;
    };
}

export const battleAPI = {
    start: async (request: StartBattleRequest): Promise<APIResponse<BattleResult>> => {
        return apiClient.post<BattleResult>('/battle/start', request);
    },

    getResult: async (battleId: string): Promise<APIResponse<BattleResult>> => {
        return apiClient.get<BattleResult>(`/battle/result/${battleId}`);
    },
};

// ==========================================
// Affinity API
// ==========================================

export interface GiftRequest {
    userId: string;
    companionId: string;
    instanceId: string;
    message?: string;
}

export interface GiftResponse {
    success: boolean;
    companionId: string;
    itemName: string;
    itemRarity: string;
    affinityBefore: number;
    affinityAfter: number;
    affinityGained: number;
    stateBefore: string;
    stateAfter: string;
    stateChanged: boolean;
    perks: string[];
}

export const affinityAPI = {
    sendGift: async (request: GiftRequest): Promise<APIResponse<GiftResponse>> => {
        return apiClient.post<GiftResponse>('/affinity/gift', request);
    },

    getAllAffinities: async (userId: string): Promise<APIResponse<any[]>> => {
        return apiClient.get<any[]>('/affinity/all', { userId });
    },

    getAffinity: async (userId: string, companionId: string): Promise<APIResponse<any>> => {
        return apiClient.get<any>('/affinity', { userId, companionId });
    },
};

// ==========================================
// 导出所有 API
// ==========================================

export {
    apiClient,
    gachaAPI,
    inventoryAPI,
    scriptAPI,
    battleAPI,
    affinityAPI,
};

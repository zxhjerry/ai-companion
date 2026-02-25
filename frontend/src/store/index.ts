/**
 * Zustand Store - 用户状态管理
 * 管理用户信息、背包数据、当前剧情节点
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ==========================================
// 类型定义
// ==========================================

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    subscriptionTier: 'free' | 'premium' | 'vip';

    // 资产
    goldBalance: number;
    gemsBalance: number;

    // 统计
    totalGachaPulls: number;
    totalSpendGold: number;
    totalSpendGems: number;

    // 时间
    createdAt: string;
    updatedAt: string;
}

export interface ItemInstance {
    instanceId: string;
    templateId: string;
    name: string;
    description: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    tier: number;
    level: number;
    stats: Record<string, number>;
    isSoulbound: boolean;
    isEquipped: boolean;
    obtainedFrom: 'gacha' | 'shop' | 'quest' | 'admin' | 'event';
    obtainedAt: string;
    icon?: string;
}

export interface ScriptNode {
    nodeId: string;
    type: 'dialog' | 'stat_check' | 'combat' | 'choice' | 'branch';

    // Dialog Node
    speaker?: string;
    text?: string;
    emotion?: string;
    portrait?: string;

    // Stat Check Node
    check?: {
        stat: string;
        operator: '>' | '>=' | '<' | '<=' | '==' | '!=';
        value: number;
        label: string;
    };

    // Combat Node
    combat?: {
        enemyId: string;
        enemyName: string;
        enemyCount: number;
        difficulty: 'easy' | 'normal' | 'hard' | 'extreme';
        rewards: {
            exp: number;
            gold: number;
            items?: Array<{ templateId: string; count: number }>;
        };
    };

    // Choice Node
    question?: string;
    choices?: Array<{
        id: string;
        text: string;
        nextNodeId?: string;
        requirements?: {
            stat?: string;
            minValue?: number;
        };
    }>;

    // Branches
    branches?: {
        success?: {
            nodeId: string;
            text: string;
            reward?: { exp?: number; gold?: number };
        };
        failure?: {
            nodeId: string;
            text: string;
            penalty?: { damage?: number; exp?: number };
        };
        victory?: {
            nodeId: string;
            text: string;
        };
        defeat?: {
            nodeId: string;
            text: string;
        };
    };

    metadata?: {
        hint?: string;
        background?: string;
        sound?: string;
    };
}

export interface GameState {
    currentSceneId: string;
    currentNodeId?: string;
    previousNodes: string[];
    previousChoices: number[];
    flags: Record<string, boolean>;
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    currentLocation?: string;
}

// ==========================================
// App Store（主 Store）
// ==========================================

interface AppSlice {
    // 用户信息
    user: UserProfile | null;
    setUser: (user: UserProfile | null) => void;
    updateUserBalance: (currency: 'gold' | 'gems', amount: number) => void;

    // 背包数据
    inventory: ItemInstance[];
    setInventory: (items: ItemInstance[]) => void;
    addItem: (item: ItemInstance) => void;
    removeItem: (instanceId: string) => void;
    updateItem: (instanceId: string, updates: Partial<ItemInstance>) => void;

    // 游戏状态
    game: GameState;
    setGame: (game: GameState) => void;
    setCurrentNode: (nodeId: string) => void;
    addPreviousNode: (nodeId: string) => void;
    addPreviousChoice: (choiceId: number) => void;
    setFlag: (flag: string, value: boolean) => void;
    getFlag: (flag: string) => boolean;

    // 脚本节点
    currentScript: ScriptNode[];
    setCurrentScript: (nodes: ScriptNode[]) => void;
    appendScriptNodes: (nodes: ScriptNode[]) => void;
}

export const useAppStore = create<AppSlice>()(
    persist(
        (set, get) => ({
            // ===== 用户信息 =====
            user: null,
            setUser: (user) => set({ user }),
            updateUserBalance: (currency, amount) =>
                set((state) => {
                    if (!state.user) return state;

                    return {
                        user: {
                            ...state.user,
                            [currency === 'gold' ? 'goldBalance' : 'gemsBalance']:
                                state.user[currency === 'gold' ? 'goldBalance' : 'gemsBalance'] + amount,
                            updatedAt: new Date().toISOString(),
                        },
                    };
                }),

            // ===== 背包数据 =====
            inventory: [],
            setInventory: (inventory) => set({ inventory }),
            addItem: (item) =>
                set((state) => ({
                    inventory: [...state.inventory, item],
                })),
            removeItem: (instanceId) =>
                set((state) => ({
                    inventory: state.inventory.filter((item) => item.instanceId !== instanceId),
                })),
            updateItem: (instanceId, updates) =>
                set((state) => ({
                    inventory: state.inventory.map((item) =>
                        item.instanceId === instanceId ? { ...item, ...updates } : item,
                    ),
                })),

            // ===== 游戏状态 =====
            game: {
                currentSceneId: '',
                previousNodes: [],
                previousChoices: [],
                flags: {},
                timeOfDay: 'morning',
            },
            setGame: (game) => set({ game }),
            setCurrentNode: (nodeId) =>
                set((state) => ({
                    game: { ...state.game, currentNodeId: nodeId },
                })),
            addPreviousNode: (nodeId) =>
                set((state) => ({
                    game: {
                        ...state.game,
                        previousNodes: [...state.game.previousNodes, nodeId],
                    },
                })),
            addPreviousChoice: (choiceId) =>
                set((state) => ({
                    game: {
                        ...state.game,
                        previousChoices: [...state.game.previousChoices, choiceId],
                    },
                })),
            setFlag: (flag, value) =>
                set((state) => ({
                    game: {
                        ...state.game,
                        flags: { ...state.game.flags, [flag]: value },
                    },
                })),
            getFlag: (flag) => {
                const state = get();
                return state.game.flags[flag] ?? false;
            },

            // ===== 脚本节点 =====
            currentScript: [],
            setCurrentScript: (nodes) => set({ currentScript: nodes }),
            appendScriptNodes: (nodes) =>
                set((state) => ({
                    currentScript: [...state.currentScript, ...nodes],
                })),
        }),
        {
            name: 'ai-companion-app-store',
            // 只持久化部分数据
            partialize: (state) => ({
                user: state.user,
                inventory: state.inventory,
                game: {
                    flags: state.game.flags,
                    timeOfDay: state.game.timeOfDay,
                },
            }),
        },
    ),
);

// ==========================================
// Inventory Store（背包专用 Store）
// ==========================================

interface InventorySlice {
    loading: boolean;
    setLoading: (loading: boolean) => void;
    error: string | null;
    setError: (error: string | null) => void;
    filter: {
        rarity?: string;
        type?: string;
        equipped?: boolean;
        search?: string;
    };
    setFilter: (filter: Partial<InventorySlice['filter']>) => void;
    filteredInventory: ItemInstance[];
}

export const useInventoryStore = create<InventorySlice>()((set, get) => ({
    loading: false,
    setLoading: (loading) => set({ loading }),
    error: null,
    setError: (error) => set({ error }),
    filter: {},
    setFilter: (filter) =>
        set(() => {
            const newFilter = { ...get().filter, ...filter };
            const filtered = computeFilteredInventory(newFilter);
            return { filter: newFilter, filteredInventory: filtered };
        }),
    filteredInventory: [],
}));

// 计算过滤后的背包
function computeFilteredInventory(filter: InventorySlice['filter']): ItemInstance[] {
    const inventory = useAppStore.getState().inventory;

    return inventory.filter((item) => {
        // 稀有度过滤
        if (filter.rarity && item.rarity !== filter.rarity) {
            return false;
        }

        // 装备状态过滤
        if (filter.equipped !== undefined && item.isEquipped !== filter.equipped) {
            return false;
        }

        // 搜索过滤
        if (filter.search) {
            const searchLower = filter.search.toLowerCase();
            const inName = item.name.toLowerCase().includes(searchLower);
            const inDescription = item.description
                ?.toLowerCase()
                .includes(searchLower);
            if (!inName && !inDescription) {
                return false;
            }
        }

        return true;
    });
}

// ==========================================
// Script Store（剧本专用 Store）
// ==========================================

interface ScriptSlice {
    loading: boolean;
    setLoading: (loading: boolean) => void;
    generating: boolean;
    setGenerating: (generating: boolean) => void;
    error: string | null;
    setError: (error: string | null) => void;
    currentNodeId: string | null;
    setCurrentNodeId: (nodeId: string | null) => void;
    nodeHistory: string[];
    choiceHistory: number[];
    addNodeToHistory: (nodeId: string) => void;
    addChoiceToHistory: (choiceId: number) => void;
    resetScript: () => void;
}

export const useScriptStore = create<ScriptSlice>()((set, get) => ({
    loading: false,
    setLoading: (loading) => set({ loading }),
    generating: false,
    setGenerating: (generating) => set({ generating }),
    error: null,
    setError: (error) => set({ error }),
    currentNodeId: null,
    setCurrentNodeId: (nodeId) => set({ currentNodeId: nodeId }),
    nodeHistory: [],
    choiceHistory: [],
    addNodeToHistory: (nodeId) =>
        set((state) => ({
            nodeHistory: [...state.nodeHistory, nodeId],
        })),
    addChoiceToHistory: (choiceId) =>
        set((state) => ({
            choiceHistory: [...state.choiceHistory, choiceId],
        })),
    resetScript: () =>
        set({
            loading: false,
            generating: false,
            error: null,
            currentNodeId: null,
            nodeHistory: [],
            choiceHistory: [],
        }),
}));

// ==========================================
// WebSocket Store（WebSocket专用 Store）
// ==========================================

interface WebSocketSlice {
    connected: boolean;
    setConnected: (connected: boolean) => void;
    connecting: boolean;
    setConnecting: (connecting: boolean) => void;
    messages: any[];
    addMessage: (message: any) => void;
    lastMessageTime: number | null;
    clearMessages: () => void;
}

export const useWebSocketStore = create<WebSocketSlice>()((set) => ({
    connected: false,
    setConnected: (connected) => set({ connected }),
    connecting: false,
    setConnecting: (connecting) => set({ connecting }),
    messages: [],
    addMessage: (message) =>
        set((state) => ({
            messages: [...state.messages, message],
            lastMessageTime: Date.now(),
        })),
    lastMessageTime: null,
    clearMessages: () => set({ messages: [], lastMessageTime: null }),
}));

/**
 * AI Script Service - AI 剧本生成服务
 * 核心功能：
 * 1. 强化 Prompt Engineering
 * 2. 严格 JSON 解析
 * 3. 多模型支持
 */

import { AIScriptGenerationTask, AIScriptGenerationResult, ScriptNode, PROMPT_TEMPLATES, AIScriptError, ERROR_CODES } from '../ai-script/ai-script-types';

// ==========================================
// LLM Provider 类型定义
// ==========================================

interface LLMProviderConfig {
    apiKey: string;
    model: string;
    baseUrl?: string;
    timeout?: number;
}

interface LLMResponse {
    content: string;
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

// ==========================================
// AI Script Service 实现
// ==========================================

export class AIScriptService {
    private llmConfig: LLMProviderConfig;
    private eventBus: any; // EventBus 类型（可选）

    constructor(llmConfig: LLMProviderConfig, eventBus?: any) {
        this.llmConfig = llmConfig;
        this.eventBus = eventBus;

        console.log('✅ AI Script Service 初始化');
        console.log(`   模型: ${llmConfig.model}`);
    }

    /**
     * 生成剧本（主入口）
     */
    async generateScript(task: AIScriptGenerationTask): Promise<AIScriptGenerationResult> {
        const startTime = Date.now();

        console.log('\n========================================');
        console.log('📜 AI Script Service - 剧本生成');
        console.log('========================================');
        console.log(`任务ID: ${task.taskId}`);
        console.log(`场景类型: ${task.scenarioType}`);
        console.log(`角色: ${task.character.name}`);
        console.log(`选项: 对话=${task.options.includeDialog}, 判定=${task.options.includeStatCheck}, 战斗=${task.options.includeCombat}`);
        console.log('');

        try {
            // ===== 步骤 1: 构建 Prompt =====

            const systemPrompt = this.buildSystemPrompt(task);
            const userPrompt = this.buildUserPrompt(task);

            console.log('📝 Prompt 构建（系统提示）:');
            console.log(systemPrompt.substring(0, 200) + '...');
            console.log('');

            // ===== 步骤 2: 调用 LLM =====

            console.log('🤖 调用 LLM...');
            const llmResponse = await this.callLLM(systemPrompt, userPrompt);
            const content = llmResponse.content.trim();

            console.log(`✅ LLM 响应成功`);
            console.log(`   模型: ${llmResponse.model}`);
            console.log(`   Token 使用: ${llmResponse.usage?.totalTokens || 'N/A'}`);
            console.log('');

            // ===== 步骤 3: 解析 JSON =====

            console.log('🔍 解析 JSON...');
            const nodes = this.parseJSON(content);

            console.log(`✅ 解析成功，节点数: ${nodes.length}`);
            console.log('   节点ID列表:', nodes.map(n => n.nodeId).join(', '));
            console.log('');

            // ===== 步骤 4: 验证节点结构 =====

            console.log('✨ 验证节点结构...');
            this.validateNodes(nodes);
            console.log('✅ 节点验证通过');
            console.log('');

            // ===== 步骤 5: 构建结果 =====

            const latency = (Date.now() - startTime) / 1000;

            const result: AIScriptGenerationResult = {
                taskId: task.taskId,
                userId: task.userId,
                companionId: task.companionId,
                success: true,
                nodes,
                metadata: {
                    model: llmResponse.model,
                    tokensUsed: llmResponse.usage?.totalTokens || 0,
                    latency,
                    generationTime: new Date()
                }
            };

            console.log(`\n✅ 剧本生成完成！耗时: ${latency.toFixed(2)}s`);
            console.log(`\n节点预览:`);
            nodes.forEach((node, index) => {
                const preview = this.getNodePreview(node);
                console.log(`   ${index + 1}. [${node.type.toUpperCase()}] ${preview}`);
            });

            return result;

        } catch (error: any) {
            console.error('❌ 剧本生成失败:', error);

            const latency = (Date.now() - startTime) / 1000;

            return {
                taskId: task.taskId,
                userId: task.userId,
                companionId: task.companionId,
                success: false,
                nodes: [],
                metadata: {
                    model: this.llmConfig.model,
                    tokensUsed: 0,
                    latency,
                    generationTime: new Date()
                },
                error: {
                    code: error.code || ERROR_CODES.LLM_API_ERROR,
                    message: error.message || 'Unknown error',
                    details: error.details
                }
            };
        }
    }

    /**
     * 构建系统提示词（基础 + 节点类型说明）
     */
    private buildSystemPrompt(task: AIScriptGenerationTask): string {
        const parts = [
            PROMPT_TEMPLATES.SYSTEM_BASE,
            '',
            PROMPT_TEMPLATES.SYSTEM_NODES,
            '',
            '要求:',
            JSON.stringify(task.options, null, 2)
        ];

        return parts.join('\n');
    }

    /**
     * 构建用户提示词（根据场景类型）
     */
    private buildUserPrompt(task: AIScriptGenerationTask): string {
        let promptTemplate = '';

        // 根据场景类型选择模板
        switch (task.scenarioType) {
            case 'daily_dialog':
                promptTemplate = PROMPT_TEMPLATES.DAILY_DIALOG;
                break;
            case 'battle_intro':
                promptTemplate = PROMPT_TEMPLATES.BATTLE_INTRO;
                break;
            case 'battle_outro':
                promptTemplate = PROMPT_TEMPLATES.BATTLE_INTRO; // 复用 intro 模板
                break;
            case 'gift_response':
                promptTemplate = PROMPT_TEMPLATES.GIFT_RESPONSE;
                break;
            case 'hidden_event':
                promptTemplate = PROMPT_TEMPLATES.HIDDEN_EVENT;
                break;
            default:
                promptTemplate = PROMPT_TEMPLATES.DAILY_DIALOG;
        }

        // 填充变量
        const prompt = promptTemplate
            .replace(/{name}/g, task.character.name)
            .replace(/{gender}/g, task.character.gender)
            .replace(/{personality}/g, task.character.personality)
            .replace(/{appearance}/g, task.character.appearance.toString())
            .replace(/{luck}/g, task.character.luck.toString())
            .replace(/{relationship}/g, task.character.relationship)
            .replace(/{stats}/g, JSON.stringify(task.character.currentStats))
            .replace(/{userStats}/g, JSON.stringify(task.user.stats))
            .replace(/{timeOfDay}/g, task.context.timeOfDay || 'morning')
            .replace(/{currentLocation}/g, task.context.currentLocation || 'unknown')
            // 战斗场景变量
            .replace(/{enemyId}/g, task.context.flags?.enemyId || 'enemy_001')
            .replace(/{enemyCount}/g, task.context.flags?.enemyCount || '3')
            .replace(/{difficulty}/g, task.context.flags?.difficulty || 'normal')
            // 赠送礼物变量
            .replace(/{itemName}/g, task.context.flags?.itemName || '礼物')
            .replace(/{itemRarity}/g, task.context.flags?.itemRarity || 'common')
            .replace(/{message}/g, task.context.flags?.message || '无')
            .replace(/{affinity}/g, task.context.flags?.affinity?.toString() || '0')
            .replace(/{eventType}/g, task.context.flags?.eventType || 'random');

        const fullPrompt = `${prompt}\n\n请返回 JSON 格式的节点数组（nodes），包含 ${task.options.maxNodes} 个节点。`;

        return fullPrompt;
    }

    /**
     * 调用 LLM（支持多种 Provider）
     */
    private async callLLM(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
        // TODO: 根据配置选择不同的 LLM Provider
        // 这里使用简化实现，实际应集成 OpenAI/Anthropic/GLM4/ZAI

        const apiKey = this.llmConfig.apiKey;
        const model = this.llmConfig.model;
        const baseUrl = this.llmConfig.baseUrl || 'https://api.openai.com/v1';

        console.log(`   API URL: ${baseUrl}`);
        console.log(`   Model: ${model}`);

        // 模拟 LLM 调用（实际应使用真实 API）
        const mockResponse = this.mockLLMResponse(systemPrompt, userPrompt);

        return mockResponse;
    }

    /**
     * Mock LLM 响应（用于测试）
     * TODO: 替换为真实 LLM API 调用
     */
    private mockLLMResponse(systemPrompt: string, userPrompt: string): LLMResponse {
        // 根据场景类型生成不同的 Mock 数据
        const scenarioType = userPrompt.includes('战斗') ? 'battle' :
                              userPrompt.includes('礼物') ? 'gift' :
                              userPrompt.includes('隐藏事件') ? 'hidden_event' : 'daily';

        let mockNodes: any[] = [];

        if (scenarioType === 'daily') {
            mockNodes = [
                {
                    type: 'dialog',
                    nodeId: 'node_001',
                    speaker: 'NPC',
                    text: '你好！今天天气真好。',
                    emotion: 'happy',
                    portrait: 'portrait_001',
                    choices: [
                        {
                            id: 'choice_001',
                            text: '天气确实不错',
                            nextNodeId: 'node_002'
                        },
                        {
                            id: 'choice_002',
                            text: '我想要去冒险',
                            nextNodeId: 'node_003'
                        }
                    ]
                },
                {
                    type: 'stat_check',
                    nodeId: 'node_002',
                    check: {
                        stat: 'charisma',
                        operator: '>=',
                        value: 60,
                        label: '魅力判定 ≥ 60'
                    },
                    branches: {
                        success: {
                            nodeId: 'node_004',
                            text: '你的魅力吸引了她的注意，她对你笑了。',
                            reward: {
                                exp: 50,
                                gold: 10
                            }
                        },
                        failure: {
                            nodeId: 'node_005',
                            text: '她似乎对你的话不太感兴趣。',
                            penalty: {
                                exp: 10
                            }
                        }
                    }
                }
            ];
        } else if (scenarioType === 'battle') {
            mockNodes = [
                {
                    type: 'combat',
                    nodeId: 'node_001',
                    combat: {
                        enemyId: 'enemy_001',
                        enemyName: '史莱姆',
                        enemyCount: 3,
                        difficulty: 'easy',
                        winCondition: {
                            eliminateAll: true
                        },
                        loseCondition: {
                            eliminateAll: true
                        },
                        rewards: {
                            exp: 100,
                            gold: 50,
                            items: [
                                {
                                    templateId: 'item_001',
                                    count: 1
                                }
                            ]
                        }
                    },
                    branches: {
                        victory: {
                            nodeId: 'node_002',
                            text: '你成功击败了所有敌人！'
                        },
                        defeat: {
                            nodeId: 'node_003',
                            text: '你被打败了，需要休息一下。'
                        }
                    },
                    preCombatDialog: '小心！敌人来了！',
                    metadata: {
                        isBoss: false
                    }
                }
            ];
        } else if (scenarioType === 'gift') {
            mockNodes = [
                {
                    type: 'dialog',
                    nodeId: 'node_001',
                    speaker: 'NPC',
                    text: '哇！谢谢你送我礼物！我非常喜欢！',
                    emotion: 'happy',
                    choices: []
                },
                {
                    type: 'stat_check',
                    nodeId: 'node_002',
                    check: {
                        stat: 'charisma',
                        operator: '>=',
                        value: 70,
                        label: '魅力判定 ≥ 70'
                    },
                    branches: {
                        success: {
                            nodeId: 'node_003',
                            text: '你对她的好感度大幅提升！',
                            reward: {
                                exp: 100,
                                gold: 20
                            }
                        },
                        failure: {
                            nodeId: 'node_004',
                            text: '她开心地接受了礼物。',
                            reward: {
                                exp: 50
                            }
                        }
                    }
                }
            ];
        } else if (scenarioType === 'hidden_event') {
            mockNodes = [
                {
                    type: 'stat_check',
                    nodeId: 'node_001',
                    check: {
                        stat: 'luck',
                        operator: '>=',
                        value: 70,
                        label: '幸运判定 ≥ 70'
                    },
                    branches: {
                        success: {
                            nodeId: 'node_002',
                            text: '你的幸运触发了隐藏事件！你发现了一个宝箱！',
                            reward: {
                                exp: 200,
                                gold: 100,
                                items: ['item_002', 'item_003']
                            }
                        },
                        failure: {
                            nodeId: 'node_003',
                            text: '什么都没发现，继续前进吧。'
                        }
                    },
                    metadata: {
                        isHidden: true
                    }
                }
            ];
        }

        return {
            content: JSON.stringify({ nodes: mockNodes }, null, 2),
            model: this.llmConfig.model,
            usage: {
                promptTokens: 500,
                completionTokens: 300,
                totalTokens: 800
            }
        };
    }

    /**
     * 解析 JSON（带错误处理）
     */
    private parseJSON(content: string): ScriptNode[] {
        try {
            // 尝试直接解析
            const parsed = JSON.parse(content);

            // 检查是否包含 nodes 数组
            if (parsed.nodes && Array.isArray(parsed.nodes)) {
                return parsed.nodes as ScriptNode[];
            }

            // 如果 content 本身是数组
            if (Array.isArray(parsed)) {
                return parsed as ScriptNode[];
            }

            throw new AIScriptError(
                ERROR_CODES.INVALID_JSON,
                'Invalid JSON structure: missing "nodes" array'
            );

        } catch (error: any) {
            throw new AIScriptError(
                ERROR_CODES.INVALID_JSON,
                `JSON parse failed: ${error.message}`,
                { content: content.substring(0, 500) }
            );
        }
    }

    /**
     * 验证节点结构
     */
    private validateNodes(nodes: ScriptNode[]): void {
        if (!Array.isArray(nodes)) {
            throw new AIScriptError(
                ERROR_CODES.INVALID_JSON,
                'Nodes must be an array'
            );
        }

        for (const node of nodes) {
            if (!node.type || !node.nodeId) {
                throw new AIScriptError(
                    ERROR_CODES.MISSING_REQUIRED_FIELD,
                    `Node missing required fields: type or nodeId`,
                    node
                );
            }

            // 验证节点类型
            const validTypes = ['dialog', 'stat_check', 'combat', 'choice', 'branch'];
            if (!validTypes.includes(node.type)) {
                throw new AIScriptError(
                    ERROR_CODES.INVALID_NODE_TYPE,
                    `Invalid node type: ${node.type}`,
                    node
                );
            }

            // 根据节点类型进行特定验证
            if (node.type === 'dialog') {
                const dialogNode = node as any;
                if (!dialogNode.speaker || !dialogNode.text) {
                    throw new AIScriptError(
                        ERROR_CODES.MISSING_REQUIRED_FIELD,
                        'Dialog node missing required fields: speaker or text',
                        node
                    );
                }
            } else if (node.type === 'stat_check') {
                const statCheckNode = node as any;
                if (!statCheckNode.check || !statCheckNode.branches) {
                    throw new AIScriptError(
                        ERROR_CODES.MISSING_REQUIRED_FIELD,
                        'StatCheck node missing required fields: check or branches',
                        node
                    );
                }
            } else if (node.type === 'combat') {
                const combatNode = node as any;
                if (!combatNode.combat || !combatNode.branches) {
                    throw new AIScriptError(
                        ERROR_CODES.MISSING_REQUIRED_FIELD,
                        'Combat node missing required fields: combat or branches',
                        node
                    );
                }
            }
        }
    }

    /**
     * 获取节点预览文本
     */
    private getNodePreview(node: ScriptNode): string {
        if (node.type === 'dialog') {
            const dialogNode = node as any;
            return `${dialogNode.speaker}: ${dialogNode.text.substring(0, 30)}...`;
        } else if (node.type === 'stat_check') {
            const statCheckNode = node as any;
            return `${statCheckNode.check.label} [${statCheckNode.branches.success.text.substring(0, 20)}...]`;
        } else if (node.type === 'combat') {
            const combatNode = node as any;
            return `vs ${combatNode.combat.enemyName} (${combatNode.combat.difficulty})`;
        } else if (node.type === 'choice') {
            const choiceNode = node as any;
            return `${choiceNode.question.substring(0, 30)}...`;
        } else if (node.type === 'branch') {
            const branchNode = node as any;
            return `条件分支: ${branchNode.condition.type}`;
        }

        return 'Unknown node type';
    }
}

export { AIScriptService };

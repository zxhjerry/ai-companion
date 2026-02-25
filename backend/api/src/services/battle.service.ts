/**
 * Card Battle Engine - 卡牌战斗底层推演引擎
 * 核心要求：
 * 1. 100% 服务器端结算（前端仅提交开战指令+阵容ID）
 * 2. 除法减伤模型（避免不破防或数值爆炸）
 * 3. 回合制战斗 + 技能系统 + 伤害计算公式
 */

import { DatabaseService } from '../database/postgres';
import { EventBus, Event } from '../event-bus/index';

// ==========================================
// 类型定义
// ==========================================

/**
 * 战斗单位属性
 */
export interface BattleUnit {
    unitId: string;
    userId: string;
    companionId?: string;
    name: string;
    team: 'attacker' | 'defender';

    // 基础属性（1-100）
    strength: number;      // 力量（影响物理攻击）
    intelligence: number;  // 智力（影响魔法攻击）
    charisma: number;      // 魅力（影响暴击率）
    defense: number;       // 防御（影响物理减伤）
    magicDefense: number;  // 魔法防御（影响魔法减伤）
    luck: number;          // 幸运（影响暴击伤害）

    // 当前状态
    hp: number;            // 当前生命值
    maxHp: number;         // 最大生命值
    mp: number;            // 当前法力值
    maxMp: number;         // 最大法力值
    isDead: boolean;       // 死亡状态

    // 技能配置（最多 4 个）
    skills: BattleSkill[];

    // 临时Buff/Debuff
    buffs: BattleBuff[];
}

/**
 * 战斗技能
 */
export interface BattleSkill {
    skillId: string;
    name: string;
    description: string;
    skillType: 'physical' | 'magical' | 'heal' | 'buff' | 'debuff';
    damage: number;              // 基础伤害百分比（例：120 = 120%）
    heal: number;                // 基础治疗百分比
    mpCost: number;              // MP 消耗
    cooldown: number;            // 冷却回合数
    currentCooldown: number;     // 当前冷却
    target: 'self' | 'enemy' | 'all_enemies' | 'all_allies';
    isUltimate: boolean;         // 是否终极技能
}

/**
 * Buff/Debuff
 */
export interface BattleBuff {
    buffId: string;
    name: string;
    type: 'buff' | 'debuff';
    duration: number;            // 持续回合数
    effect: {
        attackBonus?: number;    // 攻击加成（百分比）
        defenseBonus?: number;   // 防御加成（百分比）
        magicDefenseBonus?: number;
        healPerTurn?: number;    // 每回合治疗
        damagePerTurn?: number;  // 每回合伤害
    };
}

/**
 * 战斗日志
 */
export interface BattleLog {
    turn: number;
    actor: string;
    target?: string;
    action: string;
    damage?: number;
    heal?: number;
    isCritical?: boolean;
    effect?: string;
    timestamp: Date;
}

/**
 * 战斗结果
 */
export interface BattleResult {
    battleId: string;
    winner: 'attacker' | 'defender';
    turns: number;
    logs: BattleLog[];
    rewards: {
        exp: number;
        gold: number;
        items: Array<{ templateId: string; count: number }>;
    };
    timestamp: Date;
}

/**
 * 开战请求（前端提交）
 */
export interface StartBattleRequest {
    userId: string;
    lineupId: string;      // 阵容ID
    enemyLineupId?: string; // 敌方阵容ID（可选，不提供则自动匹配）
    battleType: 'pve' | 'pvp';
}

/**
 * 阵容配置
 */
export interface Lineup {
    lineupId: string;
    userId: string;
    name: string;
    units: Array<{
        companionId: string;
        position: number;        // 位置 1-6
    }>;
}

// ==========================================
// 除法减伤模型（核心公式）
// ==========================================

/**
 * 计算物理伤害（除法减伤模型）
 * Formula: Damage = Attack * (Defense / (Defense + Constant))
 *
 * 优点：
 * 1. 不会出现不破防（防御高仍然会造成伤害）
 * 2. 不会出现数值爆炸（防御收益递减）
 * 3. 公式简洁，易于调整平衡
 */
export function calculatePhysicalDamage(
    attacker: BattleUnit,
    defender: BattleUnit,
    baseDamage: number,
    isCrit: boolean = false
): { damage: number; isCrit: boolean; logExtra: string } {
    // ===== 步骤 1: 计算攻击力 =====

    // 基础攻击力 = 力量 × 1.5
    let attackPower = attacker.strength * 1.5;

    // 应用Buff（攻/防加成）
    const attackBuff = computeBuffValue(attacker.buffs, 'attackBonus');
    const defenseBuff = computeBuffValue(defender.buffs, 'defenseBonus');

    attackPower *= (1 + attackBuff / 100);

    // ===== 步骤 2: 计算防御力 =====

    let defensePower = defender.defense * 2.0;
    defensePower *= (1 + defenseBuff / 100);

    // ===== 步骤 3: 除法减伤模型 =====

    // 常数：影响伤害衰减速度
    // Constant = 100 时：
    //   防御为 0 → 100% 伤害
    //   防御为 50 → 33% 伤害
    //   防御为 100 → 50% 伤害
    //   防御为 200 → 67% 伤害
    const DEFENSE_CONSTANT = 100;

    const defenseReduction = defensePower / (defensePower + DEFENSE_CONSTANT);
    const reductionPercent = Math.round(defenseReduction * 100);

    // ===== 步骤 4: 计算最终伤害 =====

    let damage = attackPower * baseDamage;
    damage *= (1 - defenseReduction);

    // ===== 步骤 5: 暴击计算 =====

    const critChance = attacker.charisma / 100; // 魅力影响暴击率
    const critRoll = Math.random();
    let isCritResult = isCrit || (critRoll < critChance);

    // 暴击伤害倍率（1.5x - 2.0x）
    let critMultiplier = isCritResult ? (1.5 + attacker.luck / 400) : 1.0; // 幸运影响暴击伤害

    if (isCritResult) {
        damage *= critMultiplier;
    }

    // ===== 步骤 6: 随机浮动（±10%）=====

    const variance = 0.9 + Math.random() * 0.2; // 0.9 - 1.1
    damage *= variance;

    // ===== 步骤 7: 最小伤害保证（避免 0 伤害）=====

    damage = Math.max(1, Math.floor(damage));

    return {
        damage,
        isCrit: isCritResult,
        logExtra: isCritResult
            ? `💥 暴击！(${critMultiplier.toFixed(1)}x)`
            : `🛡️ 防御减免: ${reductionPercent}%`
    };
}

/**
 * 计算魔法伤害（除法减伤模型）
 */
export function calculateMagicalDamage(
    attacker: BattleUnit,
    defender: BattleUnit,
    baseDamage: number,
    isCrit: boolean = false
): { damage: number; isCrit: boolean; logExtra: string } {
    // 魔法攻击力 = 智力 × 1.8
    let attackPower = attacker.intelligence * 1.8;

    const attackBuff = computeBuffValue(attacker.buffs, 'attackBonus');
    const magicDefenseBuff = computeBuffValue(defender.buffs, 'magicDefenseBonus');

    attackPower *= (1 + attackBuff / 100);

    // 魔法防御
    let magicDefensePower = defender.magicDefense * 2.0;
    magicDefensePower *= (1 + magicDefenseBuff / 100);

    // 除法减伤模型（魔法版）
    const MAGIC_DEFENSE_CONSTANT = 90; // 魔法防御常数略低（魔法更容易穿透）
    const defenseReduction = magicDefensePower / (magicDefensePower + MAGIC_DEFENSE_CONSTANT);
    const reductionPercent = Math.round(defenseReduction * 100);

    let damage = attackPower * baseDamage;
    damage *= (1 - defenseReduction);

    // 暴击计算（魅力影响暴击）
    const critChance = attacker.charisma / 100;
    const critRoll = Math.random();
    let isCritResult = isCrit || (critRoll < critChance);

    if (isCritResult) {
        const critMultiplier = 1.5 + attacker.luck / 400;
        damage *= critMultiplier;
    }

    // 随机浮动（±10%）
    const variance = 0.9 + Math.random() * 0.2;
    damage *= variance;

    damage = Math.max(1, Math.floor(damage));

    return {
        damage,
        isCrit: isCritResult,
        logExtra: isCritResult
            ? `✨ 法术暴击！`
            : `🔮 魔法减免: ${reductionPercent}%`
    };
}

/**
 * 计算治疗
 */
export function calculateHeal(
    caster: BattleUnit,
    target: BattleUnit,
    baseHeal: number
): { heal: number; logExtra: string } {
    // 治疗量 = 智力 × 基础百分比
    let healPower = caster.intelligence * baseHeal;
    healPower *= (1 + caster.luck / 200); // 幸运小幅提升治疗

    healPower = Math.floor(healPower);

    return {
        heal: healPower,
        logExtra: `💚 治疗 +${healPower}`
    };
}

/**
 * 计算Buff数值
 */
export function computeBuffValue(buffs: BattleBuff[], effectType: keyof BattleBuff['effect']): number {
    let total = 0;
    for (const buff of buffs) {
        if (buff.effect[effectType] !== undefined) {
            total += buff.effect[effectType] || 0;
        }
    }
    return total;
}

// ==========================================
// Battle Engine 实现
// ==========================================

export class BattleEngine {
    private db: DatabaseService;
    private eventBus: EventBus;

    constructor(db: DatabaseService, eventBus: EventBus) {
        this.db = db;
        this.eventBus = eventBus;
    }

    /**
     * 开战（前端调用）
     * 参数：阵容ID（由前端上传）
     * 返回：战斗结果（完整，前端仅展示）
     */
    async startBattle(request: StartBattleRequest): Promise<BattleResult> {
        const { userId, lineupId, enemyLineupId, battleType } = request;

        console.log('\n========================================');
        console.log('⚔️  Card Battle Engine - 战斗开始');
        console.log('========================================');
        console.log(`用户: ${userId}`);
        console.log(`阵容ID: ${lineupId}`);
        console.log(`战斗类型: ${battleType}`);
        console.log('');

        // ===== 步骤 1: 获取阵容 =====

        const attackerLineup = await this.getLineup(userId, lineupId);
        if (!attackerLineup) {
            throw new Error(`阵容不存在: ${lineupId}`);
        }

        // 获取敌方阵容（匹配或随机）
        let defenderLineup: Lineup | null = null;

        if (enemyLineupId) {
            defenderLineup = await this.getLineup(userId, enemyLineupId);
        } else {
            // 自动匹配敌方（PVE）
            defenderLineup = await this.generateEnemyLineup(userId, battleType);
        }

        if (!defenderLineup) {
            throw new Error('敌方阵容生成失败');
        }

        // ===== 步骤 2: 初始化战斗单位 =====

        const attackerUnits = await this.initializeBattleUnits(
            attackerLineup.units,
            'attacker'
        );

        const defenderUnits = await this.initializeBattleUnits(
            defenderLineup.units,
            'defender'
        );

        // ===== 步骤 3: 战斗循环 =====

        const battleId = `battle_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
        const logs: BattleLog[] = [];
        let turn = 1;
        let winner: 'attacker' | 'defender' | null = null;

        console.log(`\n🎬 战斗开始！`);

        while (winner === null && turn <= 50) {
            console.log(`\n--- 回合 ${turn} ---`);

            const turnLogs = await this.executeTurn(
                attackerUnits,
                defenderUnits,
                turn,
                battleId
            );

            logs.push(...turnLogs);

            // 检查战斗结束条件
            const attackerAlive = attackerUnits.filter(u => !u.isDead).length;
            const defenderAlive = defenderUnits.filter(u => !u.isDead).length;

            if (attackerAlive === 0) {
                winner = 'defender';
                console.log(`\n💀 攻击方全灭，防御方获胜！`);
            } else if (defenderAlive === 0) {
                winner = 'attacker';
                console.log(`\n🎉 防御方全灭，攻击方获胜！`);
            }

            // 回合结束处理（Buff持续、冷却减少）
            this.processTurnEnd(attackerUnits);
            this.processTurnEnd(defenderUnits);

            turn++;
        }

        if (!winner && turn > 50) {
            // 回合上限平局
            const attackerHp = attackerUnits.reduce((sum, u) => sum + u.hp, 0);
            const defenderHp = defenderUnits.reduce((sum, u) => sum + u.hp, 0);
            winner = attackerHp >= defenderHp ? 'attacker' : 'defender';
            console.log(`\n⏰ 回合上限，判定 ${winner} 获胜（HP 优势）`);
        }

        // ===== 步骤 4: 计算奖励 =====

        const rewards = await this.calculateRewards(userId, winner, turn);

        console.log(`\n🎁 战斗奖励:`);
        console.log(`   经验: ${rewards.exp}`);
        console.log(`   金币: ${rewards.gold}`);
        console.log(`   物品: ${rewards.items.length} 个`);

        // ===== 步骤 5: 保存战斗记录 =====

        const battleResult: BattleResult = {
            battleId,
            winner: winner!,
            turns: turn - 1,
            logs,
            rewards,
            timestamp: new Date()
        };

        await this.saveBattleRecord(userId, battleResult);

        // ===== 步骤 6: 发送事件通知 =====

        await this.eventBus.publishGachaPullStart({
            timestamp: new Date(),
            userId,
            characterId: undefined,
            metadata: {
                battleId,
                winner,
                exp: rewards.exp,
                gold: rewards.gold
            }
        });

        console.log(`\n✅ 战斗完成！`);

        return battleResult;
    }

    /**
     * 执行回合
     */
    private async executeTurn(
        attackerUnits: BattleUnit[],
        defenderUnits: BattleUnit[],
        turn: number,
        battleId: string
    ): Promise<BattleLog[]> {
        const logs: BattleLog[] = [];

        // 获取行动顺序（速度排序，简单实现：随机）
        const allUnits = [...attackerUnits, ...defenderUnits].sort(() => Math.random() - 0.5);

        for (const actor of allUnits) {
            if (actor.isDead) continue;

            const teammates = actor.team === 'attacker' ? attackerUnits : defenderUnits;
            const enemies = actor.team === 'attacker' ? defenderUnits : attackerUnits;

            // 执行单位行动
            const actionLogs = await this.executeUnitAction(
                actor,
                enemies,
                teammates,
                turn,
                battleId
            );

            logs.push(...actionLogs);
        }

        return logs;
    }

    /**
     * 执行单位行动
     */
    private async executeUnitAction(
        actor: BattleUnit,
        enemies: BattleUnit[],
        teammates: BattleUnit[],
        turn: number,
        battleId: string
    ): Promise<BattleLog[]> {
        const logs: BattleLog[] = [];

        // ===== 步骤 1: 技能选择 =====

        // 检查可用技能
        const availableSkills = actor.skills.filter(
            skill => skill.currentCooldown === 0 && actor.mp >= skill.mpCost
        );

        let selectedSkill: BattleSkill | null = null;

        if (availableSkills.length > 0) {
            // 优先使用可用技能（随机选择）
            selectedSkill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
        }

        // ===== 步骤 2: 目标选择 =====

        let targets: BattleUnit[] = [];

        if (!selectedSkill) {
            // 普通攻击（选择随机敌人）
            const aliveEnemies = enemies.filter(e => !e.isDead);
            if (aliveEnemies.length > 0) {
                targets = [aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)]];
            }
        } else {
            // 技能目标选择
            if (selectedSkill.target === 'self') {
                targets = [actor];
            } else if (selectedSkill.target === 'enemy') {
                const aliveEnemies = enemies.filter(e => !e.isDead);
                if (aliveEnemies.length > 0) {
                    targets = [aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)]];
                }
            } else if (selectedSkill.target === 'all_enemies') {
                targets = enemies.filter(e => !e.isDead);
            } else if (selectedSkill.target === 'all_allies') {
                targets = teammates.filter(t => !t.isDead);
            }
        }

        if (targets.length === 0) {
            // 无目标可行动
            return logs;
        }

        // ===== 步骤 3: 执行行动 =====

        const primaryTarget = targets[0];

        if (selectedSkill) {
            // 使用技能
            const skillLogs = await this.executeSkill(
                actor,
                selectedSkill,
                targets,
                turn,
                battleId
            );

            logs.push(...skillLogs);

            // 消耗MP
            actor.mp -= selectedSkill.mpCost;

            // 更新冷却
            selectedSkill.currentCooldown = selectedSkill.cooldown;

        } else {
            // 普通攻击
            const damageResult = calculatePhysicalDamage(actor, primaryTarget, 1.0);
            primaryTarget.hp -= damageResult.damage;

            // 检查死亡
            if (primaryTarget.hp <= 0) {
                primaryTarget.hp = 0;
                primaryTarget.isDead = true;
            }

            logs.push({
                turn,
                actor: actor.name,
                target: primaryTarget.name,
                action: '普通攻击',
                damage: damageResult.damage,
                isCritical: damageResult.isCrit,
                effect: damageResult.logExtra,
                timestamp: new Date()
            });
        }

        return logs;
    }

    /**
     * 执行技能
     */
    private async executeSkill(
        actor: BattleUnit,
        skill: BattleSkill,
        targets: BattleUnit[],
        turn: number,
        battleId: string
    ): Promise<BattleLog[]> {
        const logs: BattleLog[] = [];

        const logSuffix = skill.isUltimate ? '（终极技能）' : '';

        // 技能类型处理
        if (skill.skillType === 'physical') {
            // 物理伤害技能
            for (const target of targets) {
                const damageResult = calculatePhysicalDamage(actor, target, skill.damage / 100);
                target.hp -= damageResult.damage;

                if (target.hp <= 0) {
                    target.hp = 0;
                    target.isDead = true;
                }

                logs.push({
                    turn,
                    actor: actor.name,
                    target: target.name,
                    action: `${skill.name}${logSuffix}`,
                    damage: damageResult.damage,
                    isCritical: damageResult.isCrit,
                    effect: damageResult.logExtra,
                    timestamp: new Date()
                });
            }

        } else if (skill.skillType === 'magical') {
            // 魔法伤害技能
            for (const target of targets) {
                const damageResult = calculateMagicalDamage(actor, target, skill.damage / 100);
                target.hp -= damageResult.damage;

                if (target.hp <= 0) {
                    target.hp = 0;
                    target.isDead = true;
                }

                logs.push({
                    turn,
                    actor: actor.name,
                    target: target.name,
                    action: `${skill.name}${logSuffix}`,
                    damage: damageResult.damage,
                    isCritical: damageResult.isCrit,
                    effect: damageResult.logExtra,
                    timestamp: new Date()
                });
            }

        } else if (skill.skillType === 'heal') {
            // 治疗技能
            for (const target of targets) {
                const healResult = calculateHeal(actor, target, skill.heal / 100);
                target.hp = Math.min(target.maxHp, target.hp + healResult.heal);

                logs.push({
                    turn,
                    actor: actor.name,
                    target: target.name,
                    action: `${skill.name}${logSuffix}`,
                    heal: healResult.heal,
                    effect: healResult.logExtra,
                    timestamp: new Date()
                });
            }

        } else if (skill.skillType === 'buff') {
            // Buff技能（简化：攻击力+20%，持续3回合）
            const buff: BattleBuff = {
                buffId: `buff_${Date.now()}`,
                name: skill.name,
                type: 'buff',
                duration: 3,
                effect: {
                    attackBonus: 20
                }
            };

            for (const target of targets) {
                target.buffs.push(buff);

                logs.push({
                    turn,
                    actor: actor.name,
                    target: target.name,
                    action: `${skill.name}${logSuffix}`,
                    effect: `⚡ 攻击力+20%（持续3回合）`,
                    timestamp: new Date()
                });
            }

        } else if (skill.skillType === 'debuff') {
            // Debuff技能（简化：攻击力-20%，持续3回合）
            const buff: BattleBuff = {
                buffId: `debuff_${Date.now()}`,
                name: skill.name,
                type: 'debuff',
                duration: 3,
                effect: {
                    attackBonus: -20
                }
            };

            for (const target of targets) {
                target.buffs.push(buff);

                logs.push({
                    turn,
                    actor: actor.name,
                    target: target.name,
                    action: `${skill.name}${logSuffix}`,
                    effect: `💀 攻击力-20%（持续3回合）`,
                    timestamp: new Date()
                });
            }
        }

        return logs;
    }

    /**
     * 回合结束处理（Buff持续、冷却减少）
     */
    private processTurnEnd(units: BattleUnit[]): void {
        for (const unit of units) {
            // 减少技能冷却
            for (const skill of unit.skills) {
                if (skill.currentCooldown > 0) {
                    skill.currentCooldown--;
                }
            }

            // 更新Buff持续时间
            for (let i = unit.buffs.length - 1; i >= 0; i--) {
                const buff = unit.buffs[i];
                buff.duration--;

                if (buff.duration <= 0) {
                    unit.buffs.splice(i, 1);
                }
            }
        }
    }

    /**
     * 获取阵容
     */
    private async getLineup(userId: string, lineupId: string): Promise<Lineup | null> {
        // TODO: 从数据库读取阵容
        const lineup = await this.db.query<Lineup>(
            'SELECT * FROM lineups WHERE lineup_id = $1 AND user_id = $2',
            [lineupId, userId]
        );
        return lineup || null;
    }

    /**
     * 生成敌方阵容（PVE）
     */
    private async generateEnemyLineup(userId: string, battleType: 'pve' | 'pvp'): Promise<Lineup> {
        const lineupId = `enemy_${Date.now()}`;
        const units = [];

        // 生成3个敌方单位（简化）
        for (let i = 1; i <= 3; i++) {
            units.push({
                companionId: `enemy_${i}`,
                position: i
            });
        }

        return {
            lineupId,
            userId,
            name: '敌方阵容',
            units
        };
    }

    /**
     * 初始化战斗单位
     */
    private async initializeBattleUnits(
        lineupUnits: Array<{ companionId: string; position: number }>,
        team: 'attacker' | 'defender'
    ): Promise<BattleUnit[]> {
        const units: BattleUnit[] = [];

        for (const lineupUnit of lineupUnits) {
            // TODO: 从数据库读取角色属性
            // 简化：随机生成
            const strength = 50 + Math.floor(Math.random() * 50);
            const intelligence = 50 + Math.floor(Math.random() * 50);
            const charisma = 50 + Math.floor(Math.random() * 50);
            const defense = 50 + Math.floor(Math.random() * 50);
            const magicDefense = 50 + Math.floor(Math.random() * 50);
            const luck = 50 + Math.floor(Math.random() * 50);

            const maxHp = strength * 20 + defense * 10;
            const maxMp = intelligence * 5;

            const unit: BattleUnit = {
                unitId: `unit_${Date.now()}_${lineupUnit.position}`,
                userId: '', // TODO
                companionId: lineupUnit.companionId,
                name: `单位 ${lineupUnit.position}`,
                team,

                // 属性
                strength,
                intelligence,
                charisma,
                defense,
                magicDefense,
                luck,

                // 状态
                hp: maxHp,
                maxHp,
                mp: maxMp,
                maxMp,
                isDead: false,

                // 技能（简化：1个普通技能）
                skills: [
                    {
                        skillId: 'skill_001',
                        name: '强力攻击',
                        description: '造成150%物理伤害',
                        skillType: 'physical',
                        damage: 150,
                        heal: 0,
                        mpCost: 20,
                        cooldown: 3,
                        currentCooldown: 0,
                        target: 'enemy',
                        isUltimate: false
                    }
                ],

                buffs: []
            };

            units.push(unit);
        }

        return units;
    }

    /**
     * 计算奖励
     */
    private async calculateRewards(
        userId: string,
        winner: 'attacker' | 'defender',
        turns: number
    ): Promise<BattleResult['rewards']> {
        // 奖励基础值
        const baseExp = winner === 'attacker' ? 100 : 20;
        const baseGold = winner === 'attacker' ? 50 : 10;

        // 回合数影响（越少回合奖励越高）
        const turnMultiplier = Math.max(1, 50 - turns) / 50;

        const exp = Math.floor(baseExp * turnMultiplier);
        const gold = Math.floor(baseGold * turnMultiplier);

        // 物品掉落（简化）
        const items: Array<{ templateId: string; count: number }> = [];

        if (winner === 'attacker' && Math.random() < 0.3) {
            // 30%概率掉落物品
            items.push({
                templateId: 'item_001', // 简化
                count: 1
            });
        }

        return {
            exp,
            gold,
            items
        };
    }

    /**
     * 保存战斗记录
     */
    private async saveBattleRecord(
        userId: string,
        battleResult: BattleResult
    ): Promise<void> {
        // TODO: 保存到数据库
        console.log(`💾 战斗记录已保存: ${battleResult.battleId}`);
    }
}

export { BattleEngine };

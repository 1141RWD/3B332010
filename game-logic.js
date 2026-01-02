/**
 * Antigravity Tactics - Game Logic
 * Ported from PHP to JavaScript
 */

// ==================== 遊戲常數定義 ====================
const BOARD_ROWS = 15;  // Y軸 (長)
const BOARD_COLS = 13;  // X軸 (寬)
const AP_PER_TURN = 6;
const TEAM_RED = 'red';
const TEAM_BLUE = 'blue';

// 單位屬性字典
const UNIT_STATS = {
    'king': { hp: 20, dmg: 10, rng: 1, ap_atk: 3, ap_move: 1 },
    'gen': { hp: 15, dmg: 5, rng: 1, ap_atk: 2, ap_move: 1 },
    'sol': { hp: 8, dmg: 3, rng: 1, ap_atk: 2, ap_move: 1 },
    'arc': { hp: 5, dmg: 3, rng: 5, ap_atk: 2, ap_move: 1 },
    'mage': { hp: 6, dmg: 4, rng: 4, ap_atk: 2, ap_move: 1 },
    'can': { hp: 4, dmg: 8, rng: 7, ap_atk: 4, ap_move: 2 },
};

// 單位中文名稱
const UNIT_NAMES = {
    'king': '國王', 'gen': '將軍', 'sol': '士兵',
    'arc': '弓箭手', 'mage': '法師', 'can': '炮'
};

class GameEngine {
    constructor() {
        this.state = null;
    }

    // ==================== 遊戲狀態初始化 ====================
    initGameState(customSetup = null) {
        this.state = {
            turn_count: 1,
            current_turn: TEAM_RED,
            red_ap: AP_PER_TURN,
            blue_ap: AP_PER_TURN,
            game_over: false,
            winner: null,
            board: {}
        };

        // Red Setup
        if (customSetup && customSetup.red) {
            this.setupCustomUnits({ red: customSetup.red });
        } else {
            this.setupDefaultRed();
        }

        // Blue Setup
        if (customSetup && customSetup.blue) {
            this.setupCustomUnits({ blue: customSetup.blue });
        } else {
            this.setupDefaultBlue();
        }

        // ==================== 障礙物 (石頭) ====================
        // 左側石頭 (3×2): X=2-4, Y=7-8
        this.state.board['2_7'] = { type: 'obstacle' };
        this.state.board['3_7'] = { type: 'obstacle' };
        this.state.board['4_7'] = { type: 'obstacle' };
        this.state.board['2_8'] = { type: 'obstacle' };
        this.state.board['3_8'] = { type: 'obstacle' };
        this.state.board['4_8'] = { type: 'obstacle' };

        // 右側石頭 (3×2): X=8-10, Y=6-7
        this.state.board['8_6'] = { type: 'obstacle' };
        this.state.board['9_6'] = { type: 'obstacle' };
        this.state.board['10_6'] = { type: 'obstacle' };
        this.state.board['8_7'] = { type: 'obstacle' };
        this.state.board['9_7'] = { type: 'obstacle' };
        this.state.board['10_7'] = { type: 'obstacle' };

        return this.state;
    }

    setupCustomUnits(setup) {
        // Red Setup
        if (setup.red) {
            setup.red.forEach((unit, index) => {
                const id = `r_${unit.type}${index}`;
                this.state.board[`${unit.x}_${unit.y}`] = this.createUnit(id, unit.type, TEAM_RED);
            });
        }
        // Blue Setup
        if (setup.blue) {
            setup.blue.forEach((unit, index) => {
                const id = `b_${unit.type}${index}`;
                this.state.board[`${unit.x}_${unit.y}`] = this.createUnit(id, unit.type, TEAM_BLUE);
            });
        }
    }

    setupDefaultRed() {
        // ==================== 紅方單位 (上方) ====================
        // Y=0: 王在中央
        this.state.board['6_0'] = this.createUnit('r_king', 'king', TEAM_RED);

        // Y=1: 法弓法弓將法弓法弓 (2-10列)
        this.state.board['2_1'] = this.createUnit('r_mage1', 'mage', TEAM_RED);
        this.state.board['3_1'] = this.createUnit('r_arc1', 'arc', TEAM_RED);
        this.state.board['4_1'] = this.createUnit('r_mage2', 'mage', TEAM_RED);
        this.state.board['5_1'] = this.createUnit('r_arc2', 'arc', TEAM_RED);
        this.state.board['6_1'] = this.createUnit('r_gen1', 'gen', TEAM_RED);
        this.state.board['7_1'] = this.createUnit('r_mage3', 'mage', TEAM_RED);
        this.state.board['8_1'] = this.createUnit('r_arc3', 'arc', TEAM_RED);
        this.state.board['9_1'] = this.createUnit('r_mage4', 'mage', TEAM_RED);
        this.state.board['10_1'] = this.createUnit('r_arc4', 'arc', TEAM_RED);

        // Y=2: 炮 + 9個兵 + 炮
        this.state.board['0_2'] = this.createUnit('r_can1', 'can', TEAM_RED);
        this.state.board['2_2'] = this.createUnit('r_sol1', 'sol', TEAM_RED);
        this.state.board['3_2'] = this.createUnit('r_sol2', 'sol', TEAM_RED);
        this.state.board['4_2'] = this.createUnit('r_sol3', 'sol', TEAM_RED);
        this.state.board['5_2'] = this.createUnit('r_sol4', 'sol', TEAM_RED);
        this.state.board['6_2'] = this.createUnit('r_sol5', 'sol', TEAM_RED);
        this.state.board['7_2'] = this.createUnit('r_sol6', 'sol', TEAM_RED);
        this.state.board['8_2'] = this.createUnit('r_sol7', 'sol', TEAM_RED);
        this.state.board['9_2'] = this.createUnit('r_sol8', 'sol', TEAM_RED);
        this.state.board['10_2'] = this.createUnit('r_sol9', 'sol', TEAM_RED);
        this.state.board['12_2'] = this.createUnit('r_can2', 'can', TEAM_RED);

        // Y=3: 中間一個兵
        this.state.board['6_3'] = this.createUnit('r_sol10', 'sol', TEAM_RED);
    }

    setupDefaultBlue() {
        // ==================== 藍方單位 (下方) ====================
        // Y=11: 中間一個兵
        this.state.board['6_11'] = this.createUnit('b_sol10', 'sol', TEAM_BLUE);

        // Y=12: 炮 + 9個兵 + 炮
        this.state.board['0_12'] = this.createUnit('b_can1', 'can', TEAM_BLUE);
        this.state.board['2_12'] = this.createUnit('b_sol1', 'sol', TEAM_BLUE);
        this.state.board['3_12'] = this.createUnit('b_sol2', 'sol', TEAM_BLUE);
        this.state.board['4_12'] = this.createUnit('b_sol3', 'sol', TEAM_BLUE);
        this.state.board['5_12'] = this.createUnit('b_sol4', 'sol', TEAM_BLUE);
        this.state.board['6_12'] = this.createUnit('b_sol5', 'sol', TEAM_BLUE);
        this.state.board['7_12'] = this.createUnit('b_sol6', 'sol', TEAM_BLUE);
        this.state.board['8_12'] = this.createUnit('b_sol7', 'sol', TEAM_BLUE);
        this.state.board['9_12'] = this.createUnit('b_sol8', 'sol', TEAM_BLUE);
        this.state.board['10_12'] = this.createUnit('b_sol9', 'sol', TEAM_BLUE);
        this.state.board['12_12'] = this.createUnit('b_can2', 'can', TEAM_BLUE);

        // Y=13: 弓法弓法將弓法弓法 (2-10列)
        this.state.board['2_13'] = this.createUnit('b_arc1', 'arc', TEAM_BLUE);
        this.state.board['3_13'] = this.createUnit('b_mage1', 'mage', TEAM_BLUE);
        this.state.board['4_13'] = this.createUnit('b_arc2', 'arc', TEAM_BLUE);
        this.state.board['5_13'] = this.createUnit('b_mage2', 'mage', TEAM_BLUE);
        this.state.board['6_13'] = this.createUnit('b_gen1', 'gen', TEAM_BLUE);
        this.state.board['7_13'] = this.createUnit('b_arc3', 'arc', TEAM_BLUE);
        this.state.board['8_13'] = this.createUnit('b_mage3', 'mage', TEAM_BLUE);
        this.state.board['9_13'] = this.createUnit('b_arc4', 'arc', TEAM_BLUE);
        this.state.board['10_13'] = this.createUnit('b_mage4', 'mage', TEAM_BLUE);

        // Y=14: 王在中央
        this.state.board['6_14'] = this.createUnit('b_king', 'king', TEAM_BLUE);
    }



    createUnit(id, type, team) {
        const stats = UNIT_STATS[type];
        return {
            id: id,
            type: type,
            team: team,
            hp: stats.hp,
            max_hp: stats.hp,
            attacks_used: 0,
            cooldown: 0,  // 冷卻回合數（用於炮）
            aura_active: false, // 將軍減傷光環是否開啟
            aura_turns: 0,      // 光環剩餘回合數
            aura_cooldown: 0    // 光環冷卻回合數
        };
    }

    // ==================== 工具函數 ====================
    getUnitAt(x, y) {
        const key = `${x}_${y}`;
        return this.state.board[key] || null;
    }

    findUnitPosition(uid) {
        for (const [pos, unit] of Object.entries(this.state.board)) {
            if (unit.id === uid) {
                const [x, y] = pos.split('_').map(Number);
                return [x, y];
            }
        }
        return null;
    }

    distance(x1, y1, x2, y2) {
        return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)); // Chebyshev distance
    }

    isInBounds(x, y) {
        return x >= 0 && x < BOARD_COLS && y >= 0 && y < BOARD_ROWS;
    }

    // 檢查是否在己方將軍的保護範圍內（主動技能 5x5，不含將軍自身）
    isInGeneralProtection(x, y, team) {
        // 尋找己方將軍位置
        for (const [pos, unit] of Object.entries(this.state.board)) {
            if (unit.type === 'gen' && unit.team === team && unit.aura_active) {
                const [gx, gy] = pos.split('_').map(Number);
                // 檢查是否在將軍周圍 5x5 範圍內（半徑 2，不含將軍自身）
                const dx = Math.abs(x - gx);
                const dy = Math.abs(y - gy);
                if (dx <= 2 && dy <= 2 && !(dx === 0 && dy === 0)) {
                    return true;
                }
            }
        }
        return false;
    }

    // ==================== 技能邏輯 ====================
    activateAura(uid) {
        const pos = this.findUnitPosition(uid);
        if (!pos) return { success: false, error: '找不到單位' };

        const [sx, sy] = pos;
        const unit = this.getUnitAt(sx, sy);

        if (unit.type !== 'gen') return { success: false, error: '只有將軍可以使用此技能' };
        if (unit.aura_active) return { success: false, error: '減傷領域已經開啟' };
        if (unit.aura_cooldown > 0) return { success: false, error: `技能冷卻中 (剩餘 ${unit.aura_cooldown} 回合)` };

        const currentAP = this.state.current_turn === TEAM_RED ? this.state.red_ap : this.state.blue_ap;
        if (currentAP < 2) return { success: false, error: 'AP 不足 (需要 2 AP)' };

        // 消耗 AP 並開啟技能
        if (this.state.current_turn === TEAM_RED) {
            this.state.red_ap -= 2;
        } else {
            this.state.blue_ap -= 2;
        }

        unit.aura_active = true;
        unit.aura_turns = 3;

        // 檢查是否需要自動換回合
        const remainingAP = this.state.current_turn === TEAM_RED ? this.state.red_ap : this.state.blue_ap;
        const auto_turn_end = remainingAP === 0;

        return { success: true, message: '開啟了減傷領域 (持續3回合)', ap_used: 2, auto_turn_end: auto_turn_end };
    }

    // ==================== 移動邏輯 ====================
    executeMove(uid, tx, ty, type = 'move') {
        const pos = this.findUnitPosition(uid);
        if (!pos) return { success: false, error: '找不到單位' };

        const [sx, sy] = pos;
        const unit = this.getUnitAt(sx, sy);
        const target = this.getUnitAt(tx, ty);

        const currentAP = this.state.current_turn === TEAM_RED ? this.state.red_ap : this.state.blue_ap;
        const apMove = UNIT_STATS[unit.type].ap_move;

        // 檢查目標位置
        if (!this.isInBounds(tx, ty)) {
            return { success: false, error: '超出邊界' };
        }

        // 交換位置
        if (target && target.team === unit.team) {
            if (currentAP < 2) {
                return { success: false, error: 'AP 不足 (交換需要 2 AP)' };
            }

            // 執行交換
            const tempUnit = this.state.board[`${sx}_${sy}`];
            this.state.board[`${sx}_${sy}`] = this.state.board[`${tx}_${ty}`];
            this.state.board[`${tx}_${ty}`] = tempUnit;

            if (this.state.current_turn === TEAM_RED) {
                this.state.red_ap -= 2;
            } else {
                this.state.blue_ap -= 2;
            }

            // 檢查是否需要自動換回合
            const remainingAP = this.state.current_turn === TEAM_RED ? this.state.red_ap : this.state.blue_ap;
            const auto_turn_end = remainingAP === 0;

            return { success: true, message: '交換位置', ap_used: 2, auto_turn_end: auto_turn_end };
        }

        // 跳躍邏輯
        if (type === 'jump') {
            const jumpResult = this.canJump(unit, sx, sy, tx, ty);
            if (!jumpResult.can_jump) {
                return { success: false, error: jumpResult.error };
            }

            if (currentAP < 1) {
                return { success: false, error: 'AP 不足 (跳躍需要 1 AP)' };
            }

            // 執行跳躍
            this.state.board[`${tx}_${ty}`] = unit;
            delete this.state.board[`${sx}_${sy}`];

            if (this.state.current_turn === TEAM_RED) {
                this.state.red_ap -= 1;
            } else {
                this.state.blue_ap -= 1;
            }

            // 檢查是否需要自動換回合
            const remainingAP = this.state.current_turn === TEAM_RED ? this.state.red_ap : this.state.blue_ap;
            const auto_turn_end = remainingAP === 0;

            return { success: true, message: '跳躍移動', ap_used: 1, auto_turn_end: auto_turn_end };
        }

        // 一般移動
        if (target !== null) {
            return { success: false, error: '目標位置已被佔據' };
        }

        if (this.distance(sx, sy, tx, ty) > 1) {
            return { success: false, error: '移動距離過遠 (基本移動僅限相鄰格)' };
        }

        if (currentAP < apMove) {
            return { success: false, error: `AP 不足 (需要 ${apMove} AP)` };
        }

        // 執行移動
        this.state.board[`${tx}_${ty}`] = unit;
        delete this.state.board[`${sx}_${sy}`];

        if (this.state.current_turn === TEAM_RED) {
            this.state.red_ap -= apMove;
        } else {
            this.state.blue_ap -= apMove;
        }

        // 檢查是否需要自動換回合
        const remainingAP = this.state.current_turn === TEAM_RED ? this.state.red_ap : this.state.blue_ap;
        const auto_turn_end = remainingAP === 0;

        return { success: true, message: '移動', ap_used: apMove, auto_turn_end: auto_turn_end };
    }

    canJump(unit, sx, sy, tx, ty) {
        // 必須是直線
        const dx = tx - sx;
        const dy = ty - sy;

        if (dx !== 0 && dy !== 0) {
            return { can_jump: false, error: '跳躍必須是直線 (水平或垂直)' };
        }

        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist < 2 || dist > 3) {
            return { can_jump: false, error: '跳躍距離必須是 2-3 格' };
        }

        // 檢查目標是否為空
        if (this.getUnitAt(tx, ty) !== null) {
            return { can_jump: false, error: '目標位置已被佔據' };
        }

        // 檢查中間格是否有友方單位
        const stepX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
        const stepY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);

        const midX = sx + stepX;
        const midY = sy + stepY;
        const midUnit = this.getUnitAt(midX, midY);

        if (!midUnit || !midUnit.team || midUnit.team !== unit.team) {
            return { can_jump: false, error: '跳躍路徑中間必須有友方單位' };
        }

        return { can_jump: true };
    }

    // ==================== 攻擊邏輯 ====================
    executeAttack(uid, tx, ty) {
        const pos = this.findUnitPosition(uid);
        if (!pos) return { success: false, error: '找不到單位' };

        const [sx, sy] = pos;
        const attacker = this.getUnitAt(sx, sy);
        let target = this.getUnitAt(tx, ty);

        if (!target || !target.team) {
            return { success: false, error: '目標位置沒有單位' };
        }

        const stats = UNIT_STATS[attacker.type];
        const currentAP = this.state.current_turn === TEAM_RED ? this.state.red_ap : this.state.blue_ap;

        // 檢查 AP
        if (currentAP < stats.ap_atk) {
            return { success: false, error: `AP 不足 (需要 ${stats.ap_atk} AP)` };
        }

        // 檢查炮的冷卻
        if (attacker.type === 'can' && attacker.cooldown > 0) {
            return { success: false, error: `炮處於冷卻中 (剩餘 ${attacker.cooldown} 回合)` };
        }

        // 檢查攻擊次數限制
        if ((attacker.type === 'arc' || attacker.type === 'mage') && attacker.attacks_used >= 2) {
            return { success: false, error: '本回合攻擊次數已達上限 (2次)' };
        }

        // 檢查射程
        const dist = this.distance(sx, sy, tx, ty);
        if (dist > stats.rng) {
            return { success: false, error: '目標超出射程' };
        }

        // 檢查視線 (法師除外)
        if (attacker.type !== 'mage') {
            const losResult = this.checkLineOfSight(attacker, sx, sy, tx, ty);
            if (!losResult.clear) {
                // 攻擊被阻擋的目標
                tx = losResult.blocked_x;
                ty = losResult.blocked_y;
                target = this.getUnitAt(tx, ty);
            }
        }

        const events = [];

        // 造成傷害
        const damage = stats.dmg;
        events.push(this.applyDamage(tx, ty, damage, attacker.team));

        // 濺射傷害
        if (attacker.type === 'mage') {
            // 法師濺射：敵方 2 點，友方 1 點
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const splashX = tx + dx;
                    const splashY = ty + dy;
                    const splashUnit = this.getUnitAt(splashX, splashY);
                    if (splashUnit && splashUnit.team) {
                        const splashDmg = splashUnit.team === attacker.team ? 1 : 2;
                        events.push(this.applyDamage(splashX, splashY, splashDmg, attacker.team));
                    }
                }
            }
        } else if (attacker.type === 'can') {
            // 炮彈濺射：所有單位 3 點
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const splashX = tx + dx;
                    const splashY = ty + dy;
                    const splashUnit = this.getUnitAt(splashX, splashY);
                    if (splashUnit && splashUnit.team) {
                        events.push(this.applyDamage(splashX, splashY, 3, attacker.team));
                    }
                }
            }

            // 檢查自殺攻擊 (近距離炮擊)
            if (this.distance(sx, sy, tx, ty) <= 1) {
                events.push(this.applyDamage(sx, sy, 3, attacker.team));
            }
        }

        // 更新攻擊次數
        if (this.state.board[`${sx}_${sy}`]) {
            this.state.board[`${sx}_${sy}`].attacks_used++;
            // 炮攻擊後設置3回合冷卻
            if (attacker.type === 'can') {
                this.state.board[`${sx}_${sy}`].cooldown = 3;
            }
        }

        // 扣除 AP
        if (this.state.current_turn === TEAM_RED) {
            this.state.red_ap -= stats.ap_atk;
        } else {
            this.state.blue_ap -= stats.ap_atk;
        }

        // 檢查是否需要自動換回合
        const remainingAP = this.state.current_turn === TEAM_RED ? this.state.red_ap : this.state.blue_ap;
        const auto_turn_end = remainingAP === 0;

        return {
            success: true,
            events: events,
            ap_used: stats.ap_atk,
            auto_turn_end: auto_turn_end,
            final_x: tx,
            final_y: ty
        };
    }

    checkLineOfSight(attacker, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // 增加採樣密度，每 0.5 格檢查一次，以確保不漏掉角落
        const steps = Math.ceil(dist * 2);

        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const preciseX = x1 + dx * t;
            const preciseY = y1 + dy * t;

            // 檢查所有可能接觸到的格子（針對 .5 的情況）
            const checkPoints = [];

            // 如果座標接近整數 (誤差 0.01 內)，只檢查該座標
            // 如果座標接近 .5 (誤差 0.01 內)，檢查兩邊
            const isHalfX = Math.abs(preciseX - Math.floor(preciseX) - 0.5) < 0.01;
            const isHalfY = Math.abs(preciseY - Math.floor(preciseY) - 0.5) < 0.01;

            const xIndices = isHalfX ? [Math.floor(preciseX), Math.ceil(preciseX)] : [Math.round(preciseX)];
            const yIndices = isHalfY ? [Math.floor(preciseY), Math.ceil(preciseY)] : [Math.round(preciseY)];

            for (const cx of xIndices) {
                for (const cy of yIndices) {
                    if (cx === x1 && cy === y1) continue; // 忽略起點
                    if (cx === x2 && cy === y2) continue; // 忽略終點

                    checkPoints.push({ x: cx, y: cy });
                }
            }

            // 檢查這些點是否有障礙物
            for (const p of checkPoints) {
                const obstacle = this.getUnitAt(p.x, p.y);
                if (obstacle !== null) {
                    // 弓箭手例外：可穿透相鄰友方單位
                    if (attacker.type === 'arc' &&
                        obstacle.team &&
                        obstacle.team === attacker.team &&
                        this.distance(x1, y1, p.x, p.y) <= 1) {
                        continue;
                    }

                    // 被阻擋
                    return { clear: false, blocked_x: p.x, blocked_y: p.y };
                }
            }
        }

        return { clear: true };
    }

    applyDamage(x, y, damage, attackerTeam) {
        const unit = this.getUnitAt(x, y);
        if (!unit || !unit.team) return null;

        // 檢查是否受將軍保護（僅對敵方攻擊有效）
        let finalDamage = damage;
        if (unit.team !== attackerTeam && this.isInGeneralProtection(x, y, unit.team)) {
            finalDamage = Math.round(damage / 2);
            // 確保最低傷害為1
            if (finalDamage < 1) finalDamage = 1;
        }

        this.state.board[`${x}_${y}`].hp -= finalDamage;

        const event = {
            type: 'damage',
            x: x,
            y: y,
            unit_id: unit.id,
            damage: finalDamage,
            new_hp: this.state.board[`${x}_${y}`].hp,
            protected: finalDamage !== damage  // 標記是否受保護
        };

        // 檢查死亡
        if (this.state.board[`${x}_${y}`].hp <= 0) {
            event.died = true;

            // 檢查勝利條件
            if (unit.type === 'king') {
                this.state.game_over = true;
                this.state.winner = attackerTeam;
            }

            delete this.state.board[`${x}_${y}`];
        }

        return event;
    }

    // ==================== 結束回合 ====================
    endTurn() {
        const expiredEffects = [];

        // 切換回合
        this.state.current_turn = this.state.current_turn === TEAM_RED ? TEAM_BLUE : TEAM_RED;

        // 重置 AP
        this.state.red_ap = AP_PER_TURN;
        this.state.blue_ap = AP_PER_TURN;

        // 重置所有單位的攻擊次數
        for (const unit of Object.values(this.state.board)) {
            if (unit.attacks_used !== undefined) {
                unit.attacks_used = 0;
            }
        }

        // 減少（新回合方）所有單位的冷卻時間和持續時間
        // "下一個自己的回合冷卻減一" -> 現在是新回合的開始
        for (const unit of Object.values(this.state.board)) {
            if (unit.team === this.state.current_turn) {
                if (unit.cooldown > 0) {
                    unit.cooldown--;
                }
                // 減少光環持續時間
                if (unit.aura_active) {
                    unit.aura_turns--;
                    if (unit.aura_turns <= 0) {
                        unit.aura_active = false;
                        unit.aura_cooldown = 2; // 技能結束後進入 2 回合冷卻
                        expiredEffects.push({
                            type: 'aura_end',
                            unit_type: unit.type,
                            team: unit.team,
                            message: '減傷領域已結束'
                        });
                    }
                } else if (unit.aura_cooldown > 0) {
                    unit.aura_cooldown--;
                }
            }
        }

        this.state.turn_count++;

        return { success: true, message: '回合結束', expired_effects: expiredEffects };
    }
}

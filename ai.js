class AIController {
    constructor(gameEngine, team, difficulty) {
        this.engine = gameEngine;
        this.team = team;            // '紅' 或 '藍' (AI 目前設計為紅方)
        this.difficulty = difficulty; // 'easy' 或 'hard'
        this.opponent = team === 'red' ? 'blue' : 'red';
    }

    async decideAndExecute() {
        console.log(`[AI] 思考中... (${this.difficulty})`);

        // 人工延遲以增加真實感 (0.5秒)
        await new Promise(r => setTimeout(r, 500));

        let move = null;
        if (this.difficulty === 'hard') {
            move = this.getHardMove();
        } else if (this.difficulty === 'normal') {
            // 原始的 'hard' 現在是 'normal'
            move = this.getNormalMove();
        } else {
            // 'easy' 簡單模式
            move = this.getRandomMove();
        }

        if (move) {
            console.log(`[AI] 執行移動:`, move);
            return this.executeMove(move);
        } else {
            console.log(`[AI] 沒有找到有效移動。放棄控制。`);
            // 用戶要求移除主動結束回合。返回特殊旗標。
            return { success: true, ai_give_up: true };
        }
    }

    // ================== 策略方法 ==================

    getRandomMove() {
        const myUnits = this.getMyUnits();
        // 隨機打亂單位順序
        this.shuffle(myUnits);

        for (const unit of myUnits) {
            const actions = this.getValidActionsForUnit(unit);
            if (actions.length > 0) {
                const randomAction = actions[Math.floor(Math.random() * actions.length)];
                return { unit, action: randomAction };
            }
        }
        return null;
    }

    getNormalMove() {
        const myUnits = this.getMyUnits();
        let bestMove = null;
        let bestScore = -9999;

        // 評分標準：
        // 擊殺敵人: +100
        // 傷害敵人: +傷害值
        // 向中央/敵人移動: +1 (推進)

        for (const unit of myUnits) {
            const actions = this.getValidActionsForUnit(unit);
            for (const action of actions) {
                let score = this.evaluateActionBasic(unit, action);

                // 添加隨機性以打破平局
                score += Math.random() * 2;

                if (score > bestScore) {
                    bestScore = score;
                    bestMove = { unit, action };
                }
            }
        }

        return bestMove || this.getRandomMove(); // 後備方案
    }

    getHardMove() {
        const myUnits = this.getMyUnits();
        let bestMove = null;
        let bestScore = -9999;

        // 進階評分：
        // 1. 基本評分 (擊殺/傷害/推進)
        // 2. 技能使用 (將軍光環)
        // 3. 陣型集結 (靠近盟友)

        for (const unit of myUnits) {
            const actions = this.getValidActionsForUnit(unit);
            for (const action of actions) {
                let score = this.evaluateActionBasic(unit, action);

                // 困難模式的特殊評分
                if (action.type === 'skill' && action.skillName === 'aura') {
                    // 如果附近有敵人需要防護，給予高優先級
                    const enemies = this.getEnemyUnits();
                    let minDist = 99;
                    enemies.forEach(e => {
                        const d = Math.abs(e.x - unit.x) + Math.abs(e.y - unit.y);
                        if (d < minDist) minDist = d;
                    });

                    // 如果敵人有威脅 (範圍 <= 6)，使用光環
                    if (minDist <= 6) {
                        score += 80;
                    } else {
                        score -= 50; // 如果太遠不要浪費
                    }
                } else if (action.type === 'move') {
                    // Cluster heuristic: Bonus for ending turn near allies
                    const tx = action.target.x;
                    const ty = action.target.y;
                    let alliesNear = 0;
                    myUnits.forEach(ally => {
                        // Don't count self (unit is at old pos, but we check new pos vs other allies)
                        if (ally.id !== unit.id) {
                            const d = Math.max(Math.abs(ally.x - tx), Math.abs(ally.y - ty));
                            if (d <= 2) alliesNear++;
                        }
                    });
                    score += alliesNear * 0.5; // Reduced from 3 to 0.5 to prevent "turtle" behavior

                    // New: Dynamic Advancement - specific logic to close distance to nearest enemy
                    // (Overwrites or adds to the basic +5 directional score)
                    let minEnemyDist = 999;
                    const enemies = this.getEnemyUnits();
                    enemies.forEach(e => {
                        const d = Math.abs(e.x - tx) + Math.abs(e.y - ty);
                        if (d < minEnemyDist) minEnemyDist = d;
                    });

                    // Reward getting closer to enemies.
                    // Max map dim roughly 15+13=28. 
                    if (minEnemyDist < 30) {
                        score += (30 - minEnemyDist) * 1.0; // Reduced multiplier from 1.5
                    }

                    // --- NEW SAFETY RULES ---

                    // 1. 孤立懲罰：不要單獨衝鋒
                    if (alliesNear === 0) {
                        score -= 50; // 遠離所有盟友會受到重罰
                    }

                    // 2. 國王安全與侵略性
                    if (unit.type === 'king') {
                        // A: 安全懲罰（除非健康狀況良好，否則避免深入）
                        let limitY = 2; // 預設安全區 (0-2)

                        // 如果健康 (>60%)，放寬限制至中場 (0-6)
                        if (unit.hp >= unit.max_hp * 0.6) {
                            limitY = 6;
                        }

                        // 對於紅方國王（從頂部開始，Y=0）
                        if (this.team === 'red') {
                            if (ty > limitY) score -= (ty - limitY) * 20;
                        } else {
                            // 藍方國王（從底部開始，Y=14）
                            if (ty < (14 - limitY)) score -= ((14 - limitY) - ty) * 20;
                        }

                        // B: 孤立懲罰（國王需要護衛）
                        if (alliesNear < 2) score -= 30;

                        // C: 交戰獎勵（如果健康，進攻！）
                        // 如果移動後與敵人相鄰（距離=1），下回合有機會攻擊
                        if (minEnemyDist === 1 && unit.hp >= unit.max_hp * 0.6) {
                            score += 40; // 鼓勵交戰
                        }
                    }
                }

                score += Math.random() * 2;

                if (score > bestScore) {
                    bestScore = score;
                    bestMove = { unit, action };
                }
            }
        }

        return bestMove || this.getNormalMove();
    }

    evaluateActionBasic(unit, action) {
        let score = 0;
        if (action.type === 'attack') {
            // 估計傷害
            const target = this.engine.state.board[`${action.target.x}_${action.target.y}`];
            if (target) {
                score += 50;
                if (target.hp <= 30) score += 50; // 斬殺優先
                if (target.type === 'king') score += 200; // 擊殺國王
            }
        } else if (action.type === 'move') {
            // 啟發式：如果是紅方，向 Y=14（藍方）推進
            if (this.team === 'red') {
                if (action.target.y > unit.y) score += 5;
            } else {
                if (action.target.y < unit.y) score += 5;
            }
        }
        return score;
    }

    // ================== 輔助方法 ==================

    getMyUnits() {
        const units = [];
        const board = this.engine.state.board;
        for (const key in board) {
            const u = board[key];
            if (u && u.team === this.team) {
                const [x, y] = key.split('_').map(Number);
                u.x = x;
                u.y = y;
                units.push(u);
            }
        }
        return units;
    }

    getEnemyUnits() {
        const units = [];
        const board = this.engine.state.board;
        for (const key in board) {
            const u = board[key];
            if (u && u.team && u.team !== this.team) {
                const [x, y] = key.split('_').map(Number);
                u.x = x;
                u.y = y;
                units.push(u);
            }
        }
        return units;
    }

    getValidActionsForUnit(unit) {
        const actions = [];
        const stats = UNIT_STATS[unit.type];
        const teamAP = this.team === 'red' ? this.engine.state.red_ap : this.engine.state.blue_ap;

        // 1. 移動動作
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        if (teamAP >= stats.ap_move) {
            dirs.forEach(([dx, dy]) => {
                const tx = unit.x + dx;
                const ty = unit.y + dy;
                // 邊界檢查
                if (tx >= 0 && tx < BOARD_COLS && ty >= 0 && ty < BOARD_ROWS) {
                    if (!this.engine.getUnitAt(tx, ty)) {
                        actions.push({ type: 'move', moveType: 'move', target: { x: tx, y: ty } });
                    }
                }
            });
        }

        // B. 跳躍移動（範圍 2-3）- 固定 1 AP
        if (teamAP >= 1) {
            const jumps = [2, 3, -2, -3];
            jumps.forEach(d => {
                // 水平跳躍
                let tx = unit.x + d;
                let ty = unit.y;
                if (tx >= 0 && tx < BOARD_COLS) {
                    const result = this.engine.canJump(unit, unit.x, unit.y, tx, ty);
                    if (result.can_jump) actions.push({ type: 'move', moveType: 'jump', target: { x: tx, y: ty } });
                }
                // 垂直跳躍
                tx = unit.x;
                ty = unit.y + d;
                if (ty >= 0 && ty < BOARD_ROWS) {
                    const result = this.engine.canJump(unit, unit.x, unit.y, tx, ty);
                    if (result.can_jump) actions.push({ type: 'move', moveType: 'jump', target: { x: tx, y: ty } });
                }
            });
        }

        // 2. 攻擊動作
        if (teamAP >= stats.ap_atk) {
            if (unit.type === 'can' && unit.cooldown > 0) return actions;
            if ((unit.type === 'arc' || unit.type === 'mage') && unit.attacks_used >= 2) return actions;

            const enemies = this.getEnemyUnits();
            enemies.forEach(enemy => {
                const dist = Math.abs(unit.x - enemy.x) + Math.abs(unit.y - enemy.y);
                if (dist <= stats.rng) {
                    let canHit = true;
                    if (unit.type !== 'mage') {
                        const los = this.engine.checkLineOfSight(unit, unit.x, unit.y, enemy.x, enemy.y);
                        if (!los.clear) canHit = false;
                    }
                    if (canHit) {
                        actions.push({ type: 'attack', target: { x: enemy.x, y: enemy.y } });
                    }
                }
            });
        }

        // 3. 技能動作（將軍光環）
        if (unit.type === 'gen' && teamAP >= 2) {
            if (!unit.aura_active && unit.aura_cooldown <= 0) {
                actions.push({ type: 'skill', skillName: 'aura', target: { x: unit.x, y: unit.y } });
            }
        }

        return actions;
    }

    async executeMove(decision) {
        const { unit, action } = decision;
        let result = null;

        if (action.type === 'move') {
            result = this.engine.executeMove(unit.id, action.target.x, action.target.y, action.moveType || 'move');
        } else if (action.type === 'attack') {
            result = this.engine.executeAttack(unit.id, action.target.x, action.target.y);
        } else if (action.type === 'skill' && action.skillName === 'aura') {
            result = this.engine.activateAura(unit.id);
        }

        if (result && result.success) {
            result.ai_context = {
                unit_id: unit.id,
                unit_type: unit.type,
                action_type: action.type,
                target: action.target
            };
        }
        return result;
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}

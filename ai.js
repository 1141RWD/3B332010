class AIController {
    constructor(gameEngine, team, difficulty) {
        this.engine = gameEngine;
        this.team = team;            // 'red' or 'blue' (AI is currently designed for Red)
        this.difficulty = difficulty; // 'easy' or 'hard'
        this.opponent = team === 'red' ? 'blue' : 'red';
    }

    async decideAndExecute() {
        console.log(`[AI] Thinking... (${this.difficulty})`);

        // Artificial delay for realism (0.5s)
        await new Promise(r => setTimeout(r, 500));

        let move = null;
        if (this.difficulty === 'hard') {
            move = this.getHardMove();
        } else if (this.difficulty === 'normal') {
            // Original 'hard' is now 'normal'
            move = this.getNormalMove();
        } else {
            // 'easy'
            move = this.getRandomMove();
        }

        if (move) {
            console.log(`[AI] Executing move:`, move);
            return this.executeMove(move);
        } else {
            console.log(`[AI] No valid moves found. Giving up control.`);
            // User requested to remove active endTurn. Return a special flag.
            return { success: true, ai_give_up: true };
        }
    }

    // ================== STRATEGIES ==================

    getRandomMove() {
        const myUnits = this.getMyUnits();
        // Shuffle units to check randomly
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

        // Scoring:
        // Kill Hostile: +100
        // Damage Hostile: +Damage
        // Move towards center/enemy: +1 (Advancement)

        for (const unit of myUnits) {
            const actions = this.getValidActionsForUnit(unit);
            for (const action of actions) {
                let score = this.evaluateActionBasic(unit, action);

                // Add randomness to break ties
                score += Math.random() * 2;

                if (score > bestScore) {
                    bestScore = score;
                    bestMove = { unit, action };
                }
            }
        }

        return bestMove || this.getRandomMove(); // Fallback
    }

    getHardMove() {
        const myUnits = this.getMyUnits();
        let bestMove = null;
        let bestScore = -9999;

        // Advanced Scoring:
        // 1. Basic (Kill/Damage/Advance)
        // 2. Skill Usage (General Aura)
        // 3. Formation Clustering (Move near allies)

        for (const unit of myUnits) {
            const actions = this.getValidActionsForUnit(unit);
            for (const action of actions) {
                let score = this.evaluateActionBasic(unit, action);

                // Special Scoring for Hard Mode
                if (action.type === 'skill' && action.skillName === 'aura') {
                    // Huge priority if enemies nearby to protect against
                    const enemies = this.getEnemyUnits();
                    let minDist = 99;
                    enemies.forEach(e => {
                        const d = Math.abs(e.x - unit.x) + Math.abs(e.y - unit.y);
                        if (d < minDist) minDist = d;
                    });

                    // Use aura if enemies are threatening (range <= 6)
                    if (minDist <= 6) {
                        score += 80;
                    } else {
                        score -= 50; // Don't waste if far away
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

                    // 1. Isolation Penalty: Don't rush alone
                    if (alliesNear === 0) {
                        score -= 50; // Heavy penalty for ending turn away from ALL allies
                    }

                    // 2. King Safety & Aggression
                    if (unit.type === 'king') {
                        // A: Safety Penalty (Avoid rushing deep unless healthy)
                        let limitY = 2; // Default safe zone (0-2)

                        // If Healthy (>60%), relax limit to mid-field (0-6)
                        if (unit.hp >= unit.max_hp * 0.6) {
                            limitY = 6;
                        }

                        // For Red King (starts at top, Y=0)
                        if (this.team === 'red') {
                            if (ty > limitY) score -= (ty - limitY) * 20;
                        } else {
                            // Blue King (starts at bottom, Y=14)
                            if (ty < (14 - limitY)) score -= ((14 - limitY) - ty) * 20;
                        }

                        // B: Isolation Penalty (King needs guards)
                        if (alliesNear < 2) score -= 30;

                        // C: Engagement Bonus (If Healthy, Attack!)
                        // If moving puts us adjacent to enemy (distance=1), giving a chance to attack next turn
                        if (minEnemyDist === 1 && unit.hp >= unit.max_hp * 0.6) {
                            score += 40; // Encourage engaging
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
            // Estimate damage
            const target = this.engine.state.board[`${action.target.x}_${action.target.y}`];
            if (target) {
                score += 50;
                if (target.hp <= 30) score += 50; // Execute priority
                if (target.type === 'king') score += 200; // Kill King
            }
        } else if (action.type === 'move') {
            // Heuristic: Advance towards Y=14 (Blue side) if Red
            if (this.team === 'red') {
                if (action.target.y > unit.y) score += 5;
            } else {
                if (action.target.y < unit.y) score += 5;
            }
        }
        return score;
    }

    // ================== HELPERS ==================

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

        // 1. Move Actions
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        if (teamAP >= stats.ap_move) {
            dirs.forEach(([dx, dy]) => {
                const tx = unit.x + dx;
                const ty = unit.y + dy;
                // Bounds
                if (tx >= 0 && tx < BOARD_COLS && ty >= 0 && ty < BOARD_ROWS) {
                    if (!this.engine.getUnitAt(tx, ty)) {
                        actions.push({ type: 'move', moveType: 'move', target: { x: tx, y: ty } });
                    }
                }
            });
        }

        // B. Jump Moves (Range 2-3) - Fixed 1 AP
        if (teamAP >= 1) {
            const jumps = [2, 3, -2, -3];
            jumps.forEach(d => {
                // Horizontal
                let tx = unit.x + d;
                let ty = unit.y;
                if (tx >= 0 && tx < BOARD_COLS) {
                    const result = this.engine.canJump(unit, unit.x, unit.y, tx, ty);
                    if (result.can_jump) actions.push({ type: 'move', moveType: 'jump', target: { x: tx, y: ty } });
                }
                // Vertical
                tx = unit.x;
                ty = unit.y + d;
                if (ty >= 0 && ty < BOARD_ROWS) {
                    const result = this.engine.canJump(unit, unit.x, unit.y, tx, ty);
                    if (result.can_jump) actions.push({ type: 'move', moveType: 'jump', target: { x: tx, y: ty } });
                }
            });
        }

        // 2. Attack Actions
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

        // 3. Skill Actions (General Aura)
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

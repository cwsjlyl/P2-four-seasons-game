/* =========================================================================
   四季小探險家 3D — 右上半透明虛擬地圖、動態天氣換裝問答與物理主循環
   ========================================================================= */
(() => {
    'use strict';

    const { PHYSICS, SEASON_META, WEATHER_STATES, QUESTION_BANK, AudioSys, SpeechSys, World } = GameApp;

    /* ── 1. 遊戲全局與四季動態天氣狀態機 ── */
    const state = {
        started: false,
        paused: false,
        highQuality: true,
        score: 0,
        stamina: 100,
        currentZone: 'plaza',
        vx: 0, vy: 0, vz: 0,
        isGrounded: true,
        onBridge: false,
        inWater: false,
        walkCycle: 0,
        camYaw: 0,
        camPitch: 0.44,
        // 每個季節當前天氣索引 (0, 1, 2) 與玩家目前已適應的天氣 ID
        weatherIdx: { spring: 0, summer: 0, autumn: 0, winter: 0 },
        equippedWeatherId: null,
        weatherTimer: PHYSICS.WEATHER_CYCLE_SEC,
        zoneEntryDelay: 0,
        lightningCooldown: 4.5,
        splashCooldown: 0,
        usedQ: { spring: [], summer: [], autumn: [], winter: [] },
        activeQuiz: null,
        gear: { glasses: false, cape: false, crown: false }
    };

    const seasonBadgeEl  = document.getElementById('season-badge');
    const weatherBadgeEl = document.getElementById('weather-badge');
    const physBadgeEl    = document.getElementById('phys-badge');
    const outfitBadgeEl  = document.getElementById('outfit-badge');
    const staminaFillEl  = document.getElementById('stamina-fill');
    const zoneShortEl    = document.getElementById('minimap-zone-short');
    const toastEl        = document.getElementById('weather-toast');
    const toastIconEl    = document.getElementById('weather-toast-icon');
    const toastTitleEl   = document.getElementById('weather-toast-title');
    const toastDescEl    = document.getElementById('weather-toast-desc');
    const flashEl        = document.getElementById('lightning-flash');

    let toastTimer = null;
    function showWeatherToast(icon, title, desc) {
        toastIconEl.textContent  = icon;
        toastTitleEl.textContent = title;
        toastDescEl.textContent  = desc;
        toastEl.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 5200);
    }

    function getCurrentZoneWeather(zone) {
        if (!WEATHER_STATES[zone]) return null;
        return WEATHER_STATES[zone][state.weatherIdx[zone]];
    }

    /* ── 2. 右上方半透明虛擬雷達地圖 (Retina Minimap Canvas) ── */
    const miniCanvas = document.getElementById('minimap-canvas');
    const mctx = miniCanvas.getContext('2d');
    const MW = miniCanvas.width, MH = miniCanvas.height;

    function worldToMini(wx, wz) {
        const half = 98;
        return {
            x: ((wx + half) / (half * 2)) * MW,
            y: ((wz + half) / (half * 2)) * MH
        };
    }

    // 預繪靜態地形底圖（四季象限、高山等高標記、蜿蜒河流、中央廣場與 4 座小橋）以節省每幀運算
    const staticMapCanvas = document.createElement('canvas');
    staticMapCanvas.width = MW; staticMapCanvas.height = MH;
    (() => {
        const g = staticMapCanvas.getContext('2d');
        const mid = MW / 2;

        // 四大季節半透明底色
        g.fillStyle = 'rgba(74, 222, 128, 0.42)'; g.fillRect(0, 0, mid, mid);         // 春 (左上 NW)
        g.fillStyle = 'rgba(251, 191, 36, 0.44)'; g.fillRect(mid, 0, mid, mid);       // 夏 (右上 NE)
        g.fillStyle = 'rgba(251, 146, 60, 0.44)'; g.fillRect(0, mid, mid, mid);       // 秋 (左下 SW)
        g.fillStyle = 'rgba(186, 230, 253, 0.48)'; g.fillRect(mid, mid, mid, mid);    // 冬 (右下 SE)

        // 高山群等高圓與山峰三角標記
        World.MOUNTAIN_PEAKS.forEach(m => {
            if (!m.high) return;
            const p = worldToMini(m.x, m.z);
            const rPx = (m.sigma / 196) * MW * 1.25;
            g.fillStyle = 'rgba(15, 23, 42, 0.24)';
            g.beginPath(); g.arc(p.x, p.y, rPx, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#E2E8F0';
            g.beginPath();
            g.moveTo(p.x, p.y - 7);
            g.lineTo(p.x - 6, p.y + 5);
            g.lineTo(p.x + 6, p.y + 5);
            g.closePath();
            g.fill();
        });

        // 繪製蜿蜒十字河流
        g.strokeStyle = '#22D3EE';
        g.lineWidth = (PHYSICS.RIVER_HALF_W * 2 / 196) * MW;
        g.lineCap = 'round';

        [-1, 1].forEach(sign => {
            g.beginPath();
            for (let d = 22; d <= 96; d += 3) {
                const wz = sign * d;
                const wx = World.riverCenterX(wz);
                const pt = worldToMini(wx, wz);
                if (d === 22) g.moveTo(pt.x, pt.y); else g.lineTo(pt.x, pt.y);
            }
            g.stroke();

            g.beginPath();
            for (let d = 22; d <= 96; d += 3) {
                const wx = sign * d;
                const wz = World.riverCenterZ(wx);
                const pt = worldToMini(wx, wz);
                if (d === 22) g.moveTo(pt.x, pt.y); else g.lineTo(pt.x, pt.y);
            }
            g.stroke();
        });

        // 中央科學廣場圓環
        const cPt = worldToMini(0, 0);
        const plazaR = (21 / 196) * MW;
        g.fillStyle = 'rgba(245, 245, 244, 0.78)';
        g.beginPath(); g.arc(cPt.x, cPt.y, plazaR, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#FACC15'; g.lineWidth = 2.5; g.stroke();

        // 4 座木拱橋清晰圖示
        World.BRIDGES.forEach(b => {
            const bp = worldToMini(b.x, b.z);
            g.save();
            g.translate(bp.x, bp.y);
            g.fillStyle = '#D97706';
            g.strokeStyle = '#FEF08A';
            g.lineWidth = 2;
            if (b.axis === 'x') {
                g.fillRect(-11, -5, 22, 10);
                g.strokeRect(-11, -5, 22, 10);
            } else {
                g.fillRect(-5, -11, 10, 22);
                g.strokeRect(-5, -11, 10, 22);
            }
            g.restore();
        });

        // 5 座地標建築物方塊標記
        World.LANDMARKS.forEach(lm => {
            const lp = worldToMini(lm.x, lm.z);
            g.fillStyle = lm.color;
            g.strokeStyle = '#0F172A';
            g.lineWidth = 3;
            g.beginPath();
            g.rect(lp.x - 8, lp.y - 8, 16, 16);
            g.fill();
            g.stroke();
            // 屋頂小三角裝飾
            g.fillStyle = '#FFFFFF';
            g.fillRect(lp.x - 3, lp.y - 3, 6, 6);
        });
    })();

    const GEM_HEX_STR = { spring: '#F472B6', summer: '#38BDF8', autumn: '#FB923C', winter: '#818CF8' };

    function renderMinimap(elapsed) {
        mctx.clearRect(0, 0, MW, MH);
        mctx.drawImage(staticMapCanvas, 0, 0);

        // 1. 任務點（發光跳動季節寶石菱形）
        const pulse = 1 + Math.sin(elapsed * 5.0) * 0.22;
        for (let i = 0; i < World.treasures.length; i++) {
            const t = World.treasures[i];
            if (!t.active) continue;
            const tp = worldToMini(t.mesh.position.x, t.mesh.position.z);
            mctx.save();
            mctx.translate(tp.x, tp.y);
            mctx.rotate(Math.PI / 4);
            const sz = 5.5 * pulse;
            mctx.fillStyle = GEM_HEX_STR[t.season];
            mctx.strokeStyle = '#FFFFFF';
            mctx.lineWidth = 2;
            mctx.fillRect(-sz, -sz, sz * 2, sz * 2);
            mctx.strokeRect(-sz, -sz, sz * 2, sz * 2);
            mctx.restore();
        }

        // 2. 4 隻百厭小猴子動態圓點
        for (let i = 0; i < World.monkeys.length; i++) {
            const mk = World.monkeys[i];
            const mp = worldToMini(mk.mesh.position.x, mk.mesh.position.z);
            mctx.beginPath();
            mctx.arc(mp.x, mp.y, 6.2, 0, Math.PI * 2);
            mctx.fillStyle = '#F59E0B';
            mctx.fill();
            mctx.lineWidth = 2.2;
            mctx.strokeStyle = '#78350F';
            mctx.stroke();
        }

        // 3. 主角位置與鏡頭視野扇形 (FOV Cone)
        const pp = worldToMini(World.player.position.x, World.player.position.z);
        const lookAngle = Math.atan2(-Math.sin(state.camYaw), -Math.cos(state.camYaw)) - Math.PI / 2;

        mctx.save();
        mctx.translate(pp.x, pp.y);
        mctx.rotate(lookAngle);
        // 視野光錐
        mctx.beginPath();
        mctx.moveTo(0, 0);
        mctx.arc(0, 0, 34, -Math.PI / 2 - 0.42, -Math.PI / 2 + 0.42);
        mctx.closePath();
        mctx.fillStyle = 'rgba(254, 240, 138, 0.36)';
        mctx.fill();

        // 醒目主角箭頭游標
        mctx.beginPath();
        mctx.moveTo(0, -10);
        mctx.lineTo(7.5, 7.5);
        mctx.lineTo(0, 3.5);
        mctx.lineTo(-7.5, 7.5);
        mctx.closePath();
        mctx.fillStyle = '#EF4444';
        mctx.fill();
        mctx.lineWidth = 2.5;
        mctx.strokeStyle = '#FFFFFF';
        mctx.stroke();
        mctx.restore();
    }

    /* ── 3. 問答互動與「天氣轉變衣著及手提物品」必答教學系統 ── */
    const quizModal    = document.getElementById('quiz-modal');
    const quizCard     = document.getElementById('quiz-card');
    const qSeasonTag   = document.getElementById('q-season-tag');
    const qTextEl      = document.getElementById('q-text');
    const qOptionsEl   = document.getElementById('q-options');
    const feedbackBox  = document.getElementById('quiz-feedback-box');
    const feedbackTitle= document.getElementById('feedback-title');
    const feedbackExp  = document.getElementById('feedback-exp');
    const quizNextBtn  = document.getElementById('quiz-next-btn');
    const quizCloseBtn = document.getElementById('quiz-close-btn');
    const autoTtsBtn   = document.getElementById('auto-tts-btn');
    const LETTERS      = ['A', 'B', 'C'];

    function shuffleQuestion(rawQ, expField) {
        const indexed = rawQ.opts.map((text, idx) => ({ text, ok: idx === rawQ.ans }));
        for (let i = indexed.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
        }
        return {
            q: rawQ.q,
            opts: indexed.map(o => o.text),
            ans: indexed.findIndex(o => o.ok),
            exp: rawQ[expField]
        };
    }

    function readQuestionAndAllOptions() {
        if (!state.activeQuiz) return;
        const { qObj, optDomButtons, weatherPrefix } = state.activeQuiz;
        const seq = [{ text: `${weatherPrefix || ''}${qObj.q}`, el: qTextEl }];
        qObj.opts.forEach((optText, i) => {
            seq.push({ text: `選項 ${LETTERS[i]}：${optText}`, el: optDomButtons[i] });
        });
        SpeechSys.speakSequence(seq);
    }

    function mountQuizModal({ tagText, tagBg, tagColor, qObj, isWeatherQuiz, weatherState, sourceRef, isMonkey, weatherPrefix = '' }) {
        state.paused = true;
        quizCard.classList.toggle('weather-quiz-mode', !!isWeatherQuiz);
        qSeasonTag.textContent = tagText;
        qSeasonTag.style.background = tagBg;
        qSeasonTag.style.color = tagColor;

        qTextEl.textContent = qObj.q;
        qOptionsEl.innerHTML = '';
        feedbackBox.style.display = 'none';
        quizNextBtn.style.display = 'none';
        // 天氣轉變換裝題必須答對才換裝（不顯示跳過），一般寶石題可稍後再答
        quizCloseBtn.style.display = isWeatherQuiz ? 'none' : 'inline-block';

        const optDomButtons = [];
        qObj.opts.forEach((optText, idx) => {
            const row = document.createElement('div');
            row.className = 'option-row';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'opt-btn';
            btn.innerHTML = `<span class="opt-letter">${LETTERS[idx]}</span><span>${optText}</span>`;
            btn.addEventListener('click', () => handleAnswer(idx, btn));

            const spk = document.createElement('button');
            spk.type = 'button';
            spk.className = 'opt-speak-btn';
            spk.setAttribute('aria-label', `讀出選項 ${LETTERS[idx]}`);
            spk.innerHTML = `🔊<span>讀${LETTERS[idx]}</span>`;
            spk.addEventListener('click', e => {
                e.stopPropagation();
                SpeechSys.speakSingle(`選項 ${LETTERS[idx]}：${optText}`, btn);
            });

            row.appendChild(btn);
            row.appendChild(spk);
            qOptionsEl.appendChild(row);
            optDomButtons.push(btn);
        });

        state.activeQuiz = { qObj, isWeatherQuiz, weatherState, sourceRef, isMonkey, optDomButtons, solved: false, weatherPrefix };
        quizModal.style.display = 'flex';

        if (SpeechSys.autoRead) {
            readQuestionAndAllOptions();
        }
    }

    // 觸發「天氣轉變衣著與手提物品」應變問答
    function triggerWeatherAdaptation(zone, weatherObj, reasonTitle) {
        AudioSys.playWeatherSFX(weatherObj.sfx);
        showWeatherToast(weatherObj.icon, `${SEASON_META[zone].short}天氣提醒：${weatherObj.name}`, weatherObj.alert);

        const qObj = shuffleQuestion(weatherObj.quiz, 'teach');
        mountQuizModal({
            tagText: `${weatherObj.icon} 天氣轉變換裝挑戰｜${weatherObj.name}`,
            tagBg: '#FEF08A',
            tagColor: '#854D0E',
            qObj,
            isWeatherQuiz: true,
            weatherState: weatherObj,
            sourceRef: null,
            isMonkey: false,
            weatherPrefix: `${reasonTitle}。`
        });
    }

    // 觸發一般季節寶石或百厭小猴子題目
    function openTreasureOrMonkeyQuiz(season, sourceRef, isMonkey) {
        AudioSys.playGem();
        const pool = QUESTION_BANK[season];
        if (state.usedQ[season].length >= pool.length) state.usedQ[season] = [];
        const avail = pool.map((_, idx) => idx).filter(idx => !state.usedQ[season].includes(idx));
        const pickIdx = avail[Math.floor(Math.random() * avail.length)];
        state.usedQ[season].push(pickIdx);

        const meta = SEASON_META[season];
        const qObj = shuffleQuestion(pool[pickIdx], 'exp');
        mountQuizModal({
            tagText: isMonkey ? `🐒 百厭小猴子突擊題｜${meta.short}` : `${meta.name} 寶石挑戰`,
            tagBg: meta.tagBg,
            tagColor: meta.tagColor,
            qObj,
            isWeatherQuiz: false,
            weatherState: null,
            sourceRef,
            isMonkey
        });
    }

    function handleAnswer(idx, btnEl) {
        if (!state.activeQuiz || state.activeQuiz.solved) return;
        const { qObj, isWeatherQuiz, weatherState, sourceRef, isMonkey } = state.activeQuiz;

        if (idx === qObj.ans) {
            state.activeQuiz.solved = true;
            btnEl.classList.add('correct');
            state.activeQuiz.optDomButtons.forEach(b => { b.style.pointerEvents = 'none'; });
            AudioSys.playCorrect();

            feedbackBox.style.display = 'block';
            feedbackBox.style.background = '#ECFDF5';
            feedbackBox.style.borderColor = '#6EE7B7';
            feedbackTitle.style.color = '#15803D';

            if (isWeatherQuiz && weatherState) {
                // 答對後立即為主角換上對應天氣衣著與 3D 手提物品！
                World.applyWeatherOutfit(weatherState.outfit);
                state.equippedWeatherId = weatherState.id;
                outfitBadgeEl.textContent = `👕 ${weatherState.outfit.label}`;
                feedbackTitle.textContent = `🎉 答啱喇！已換上「${weatherState.outfit.label}」＋獲得 1 枚獎章！`;
                feedbackExp.textContent = `💡 天氣小課堂：${qObj.exp}`;
                quizNextBtn.textContent = '✨ 穿好新裝備，繼續探索！';
                SpeechSys.speakSingle(`答啱喇！已經幫你換上${weatherState.outfit.label.replace('＋', '同埋')}喇！${qObj.exp}`);
            } else {
                feedbackTitle.textContent = '🎉 答啱喇！獲得 1 枚季節獎章！';
                feedbackExp.textContent = `💡 科學小知識：${qObj.exp}`;
                quizNextBtn.textContent = '🎉 領取獎章，繼續探索！';
                SpeechSys.speakSingle(`答啱喇，好叻呀！${qObj.exp}`);
                if (!isMonkey && sourceRef) {
                    sourceRef.active = false;
                    sourceRef.mesh.visible = false;
                    sourceRef.shadow.visible = false;
                    setTimeout(() => World.relocateGem(sourceRef), 7500);
                }
            }

            state.score++;
            document.getElementById('score-val').textContent = state.score;
            refreshWardrobeLocks();
            if (state.score >= 10) document.getElementById('cert-open-btn').style.display = 'inline-flex';

            quizCloseBtn.style.display = 'none';
            quizNextBtn.style.display = 'inline-block';
        } else {
            // 答錯：不改變衣著，耐心教導玩家原因並讓玩家重選正確答案！
            btnEl.classList.add('wrong');
            btnEl.style.pointerEvents = 'none';
            AudioSys.playWrong();

            feedbackBox.style.display = 'block';
            feedbackBox.style.background = '#FFFBEB';
            feedbackBox.style.borderColor = '#FACC15';
            feedbackTitle.style.color = '#B45309';
            feedbackTitle.textContent = isWeatherQuiz
                ? '🌤️ 未換裝住！聽完小老師解說再揀選正確裝備啦：'
                : '💪 唔緊要，睇一睇科學提示再揀一次答案！';
            feedbackExp.textContent = `💡 小老師解說：${qObj.exp}`;
            SpeechSys.speakSingle(`呢個唔太合適喎！因為：${qObj.exp} 請再揀選正確嘅答案啦！`);
        }
    }

    document.getElementById('speak-all-btn').addEventListener('click', readQuestionAndAllOptions);
    document.getElementById('speak-q-btn').addEventListener('click', () => {
        if (state.activeQuiz) SpeechSys.speakSingle(state.activeQuiz.qObj.q, qTextEl);
    });
    document.getElementById('speak-stop-btn').addEventListener('click', () => SpeechSys.stop());
    autoTtsBtn.addEventListener('click', () => {
        SpeechSys.autoRead = !SpeechSys.autoRead;
        autoTtsBtn.textContent = SpeechSys.autoRead ? '🔔 自動讀題：開' : '🔕 自動讀題：關';
        autoTtsBtn.classList.toggle('active-toggle', SpeechSys.autoRead);
    });

    function closeQuizModal() {
        SpeechSys.stop();
        quizModal.style.display = 'none';
        const hitTenNow = state.activeQuiz && state.activeQuiz.solved && state.score === 10;
        state.activeQuiz = null;
        if (hitTenNow) openCertModal();
        else state.paused = false;
    }

    quizNextBtn.addEventListener('click', closeQuizModal);
    quizCloseBtn.addEventListener('click', () => {
        if (state.activeQuiz && !state.activeQuiz.isMonkey && state.activeQuiz.sourceRef) {
            World.player.position.x += Math.sin(state.camYaw) * 2.8;
            World.player.position.z += Math.cos(state.camYaw) * 2.8;
        }
        closeQuizModal();
    });

    // 手動「🌦️ 轉換天氣」按鈕（方便課堂即時體驗晴天 -> 驟雨 -> 狂風暴雨等變化）
    document.getElementById('sim-weather-btn').addEventListener('click', () => {
        if (!state.started || state.paused) return;
        if (!WEATHER_STATES[state.currentZone]) {
            showWeatherToast('🧭', '請先走入春、夏、秋、冬園區', '跨過小橋或步道進入任一季節園區，即可體驗動態天氣變化！');
            SpeechSys.speakSingle('請先行入春夏秋冬其中一個園區，就可以體驗天氣轉變同換裝喇！');
            return;
        }
        advanceZoneWeather(state.currentZone, true);
    });

    function advanceZoneWeather(targetZone, forceCurrentOnly = false) {
        if (!forceCurrentOnly) {
            ['spring', 'summer', 'autumn', 'winter'].forEach(z => {
                state.weatherIdx[z] = (state.weatherIdx[z] + 1) % WEATHER_STATES[z].length;
            });
        } else if (WEATHER_STATES[targetZone]) {
            state.weatherIdx[targetZone] = (state.weatherIdx[targetZone] + 1) % WEATHER_STATES[targetZone].length;
        }
        state.weatherTimer = PHYSICS.WEATHER_CYCLE_SEC;

        const curW = getCurrentZoneWeather(state.currentZone);
        if (curW) {
            weatherBadgeEl.textContent = `${curW.icon} ${curW.name}`;
            if (!state.paused && state.equippedWeatherId !== curW.id) {
                triggerWeatherAdaptation(state.currentZone, curW, `注意呀！天氣轉變為${curW.name}`);
            }
        }
    }

    /* ── 4. iPad 雙手獨立 PointerID 觸控與鍵盤控制 ── */
    const input = {
        keys: {}, joyX: 0, joyY: 0,
        joyPid: null, camPid: null, camLastX: 0, camLastY: 0,
        sprintPid: null, sprintKey: false
    };

    window.addEventListener('keydown', e => {
        input.keys[e.code] = true;
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sprintKey = true;
        if (e.code === 'Space' && state.started && !state.paused) triggerJump();
    });
    window.addEventListener('keyup', e => {
        input.keys[e.code] = false;
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sprintKey = false;
    });

    const joyZone = document.getElementById('joystick-zone');
    const joyKnob = document.getElementById('joystick-knob');
    const JOY_R = 44;

    function moveJoy(cxClient, cyClient) {
        const r = joyZone.getBoundingClientRect();
        let dx = cxClient - (r.left + r.width / 2);
        let dy = cyClient - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy);
        if (d > JOY_R) { dx = (dx / d) * JOY_R; dy = (dy / d) * JOY_R; }
        joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        input.joyX = dx / JOY_R;
        input.joyY = dy / JOY_R;
    }

    joyZone.addEventListener('pointerdown', e => {
        e.stopPropagation();
        if (input.joyPid === null) {
            input.joyPid = e.pointerId;
            joyZone.setPointerCapture(e.pointerId);
            moveJoy(e.clientX, e.clientY);
        }
    });
    joyZone.addEventListener('pointermove', e => {
        if (e.pointerId === input.joyPid) moveJoy(e.clientX, e.clientY);
    });
    const endJoy = e => {
        if (e.pointerId === input.joyPid) {
            input.joyPid = null; input.joyX = 0; input.joyY = 0;
            joyKnob.style.transform = 'translate(-50%, -50%)';
        }
    };
    joyZone.addEventListener('pointerup', endJoy);
    joyZone.addEventListener('pointercancel', endJoy);

    function triggerJump() {
        if (state.isGrounded && !state.paused) {
            state.vy = state.inWater ? PHYSICS.JUMP_VELOCITY * 0.82 : PHYSICS.JUMP_VELOCITY;
            state.isGrounded = false;
            AudioSys.playJump();
        }
    }

    const jumpBtn = document.getElementById('jump-btn');
    jumpBtn.addEventListener('pointerdown', e => { e.stopPropagation(); jumpBtn.classList.add('held'); triggerJump(); });
    jumpBtn.addEventListener('pointerup', () => jumpBtn.classList.remove('held'));
    jumpBtn.addEventListener('pointercancel', () => jumpBtn.classList.remove('held'));

    const sprintBtn = document.getElementById('sprint-btn');
    sprintBtn.addEventListener('pointerdown', e => {
        e.stopPropagation();
        input.sprintPid = e.pointerId;
        sprintBtn.setPointerCapture(e.pointerId);
        sprintBtn.classList.add('held');
    });
    const endSprint = e => {
        if (e.pointerId === input.sprintPid) {
            input.sprintPid = null;
            sprintBtn.classList.remove('held');
        }
    };
    sprintBtn.addEventListener('pointerup', endSprint);
    sprintBtn.addEventListener('pointercancel', endSprint);

    const gameCanvas = document.getElementById('game-canvas');
    gameCanvas.addEventListener('pointerdown', e => {
        if (input.camPid === null && !state.paused) {
            input.camPid = e.pointerId;
            input.camLastX = e.clientX;
            input.camLastY = e.clientY;
        }
    });
    window.addEventListener('pointermove', e => {
        if (e.pointerId === input.camPid) {
            state.camYaw   -= (e.clientX - input.camLastX) * 0.0065;
            state.camPitch = THREE.MathUtils.clamp(state.camPitch + (e.clientY - input.camLastY) * 0.0045, 0.22, 0.86);
            input.camLastX = e.clientX;
            input.camLastY = e.clientY;
        }
    });
    const endCam = e => { if (e.pointerId === input.camPid) input.camPid = null; };
    window.addEventListener('pointerup', endCam);
    window.addEventListener('pointercancel', endCam);

    /* ── 5. 自訂配色室與高清 PNG 榮譽證書 ── */
    const vividShirtCols = [0xDC2626, 0x0284C7, 0x16A34A, 0xEA580C, 0x7C3AED, 0xE11D48];
    const vividHatCols   = [0x1D4ED8, 0xFACC15, 0xDC2626, 0x059669, 0x9333EA, 0x0F172A];

    function initSwatches(id, cols, targetMat) {
        const wrap = document.getElementById(id);
        cols.forEach((hex, idx) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'swatch-btn' + (idx === 0 ? ' selected' : '');
            b.style.background = '#' + hex.toString(16).padStart(6, '0');
            b.addEventListener('click', () => {
                wrap.querySelectorAll('.swatch-btn').forEach(el => el.classList.remove('selected'));
                b.classList.add('selected');
                targetMat.color.setHex(hex);
                AudioSys.playGem();
            });
            wrap.appendChild(b);
        });
    }
    initSwatches('shirt-swatches', vividShirtCols, World.coatMat);
    initSwatches('hat-swatches', vividHatCols, World.hatMat);

    function refreshWardrobeLocks() {
        [
            { id: 'gear-glasses', reqId: 'gear-glasses-req', key: 'glasses', need: 2 },
            { id: 'gear-cape',    reqId: 'gear-cape-req',    key: 'cape',    need: 5 },
            { id: 'gear-crown',   reqId: 'gear-crown-req',   key: 'crown',   need: 8 }
        ].forEach(c => {
            const btn = document.getElementById(c.id);
            const req = document.getElementById(c.reqId);
            const ok = state.score >= c.need;
            btn.classList.toggle('locked', !ok);
            btn.classList.toggle('equipped', state.gear[c.key]);
            req.textContent = ok ? (state.gear[c.key] ? '已裝備 ✨' : '點擊裝備') : `${c.need} 枚獎章解鎖`;
        });
    }
    refreshWardrobeLocks();

    function bindGear(id, key, need, mesh) {
        document.getElementById(id).addEventListener('click', () => {
            if (state.score < need) {
                SpeechSys.speakSingle(`仲差 ${need - state.score} 枚獎章就可以解鎖呢件榮譽飾品喇！`);
                return;
            }
            state.gear[key] = !state.gear[key];
            mesh.visible = state.gear[key];
            if (key === 'crown' && state.gear.crown) {
                World.capGroup.visible = World.sunHatGroup.visible = World.rainHoodGroup.visible = World.beanieGroup.visible = false;
            } else if (key === 'crown' && !state.gear.crown) {
                World.capGroup.visible = true;
            }
            AudioSys.playGem();
            refreshWardrobeLocks();
        });
    }
    bindGear('gear-glasses', 'glasses', 2, World.gearGlasses);
    bindGear('gear-cape',    'cape',    5, World.gearCape);
    bindGear('gear-crown',   'crown',   8, World.gearCrown);

    const wardrobeModal = document.getElementById('wardrobe-modal');
    document.getElementById('wardrobe-btn').addEventListener('click', () => {
        state.paused = true; refreshWardrobeLocks(); wardrobeModal.style.display = 'flex';
    });
    document.getElementById('wardrobe-done-btn').addEventListener('click', () => {
        wardrobeModal.style.display = 'none'; state.paused = false;
    });

    // 榮譽證書繪製與下載
    const certModal  = document.getElementById('cert-modal');
    const certCanvas = document.getElementById('cert-canvas');
    const clsInput   = document.getElementById('student-class');
    const nameInput  = document.getElementById('student-name');

    function drawCert() {
        const ctx = certCanvas.getContext('2d');
        const W = certCanvas.width, H = certCanvas.height;
        const bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#FFFBEB'); bg.addColorStop(0.5, '#FEF9C3'); bg.addColorStop(1, '#E0F2FE');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = '#F59E0B'; ctx.lineWidth = 16; ctx.strokeRect(24, 24, W - 48, H - 48);
        ctx.strokeStyle = '#0284C7'; ctx.lineWidth = 5;  ctx.strokeRect(42, 42, W - 84, H - 84);

        ctx.font = '46px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('🌸', 82, 92); ctx.fillText('🏖️', W - 82, 92);
        ctx.fillText('🍁', 82, H - 62); ctx.fillText('⛄', W - 82, H - 62);

        ctx.fillStyle = '#92400E'; ctx.font = '900 46px "Noto Sans TC", sans-serif';
        ctx.fillText('🏆 四季科學小達人榮譽證書 🏆', W / 2, 138);
        ctx.fillStyle = '#0369A1'; ctx.font = '700 25px "Noto Sans TC", sans-serif';
        ctx.fillText('香港小學二年級四季山河與天氣探索挑戰', W / 2, 188);

        const cls = (clsInput.value || '2A').trim();
        const stu = (nameInput.value || '小探險家').trim();
        ctx.fillStyle = '#0F172A'; ctx.font = '900 48px "Noto Sans TC", sans-serif';
        ctx.fillText(`${cls} 班　${stu} 同學`, W / 2, 286);

        ctx.strokeStyle = '#CBD5E1'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(220, 304); ctx.lineTo(W - 220, 304); ctx.stroke();

        ctx.fillStyle = '#334155'; ctx.font = '700 27px "Noto Sans TC", sans-serif';
        ctx.fillText('成功探索高山河流四季園區並應對多變天氣挑戰，', W / 2, 370);
        ctx.fillText(`合共贏得 ${state.score} 枚季節知識獎章，表現非常出色！`, W / 2, 416);

        const today = new Date().toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' });
        ctx.fillStyle = '#64748B'; ctx.font = '700 22px "Noto Sans TC", sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(`頒發日期：${today}`, 110, 525);
    }

    function openCertModal() {
        state.paused = true;
        AudioSys.playFanfare();
        drawCert();
        certModal.style.display = 'flex';
        SpeechSys.speakSingle('恭喜你集齊十枚季節獎章！輸入班別同姓名就可以下載證書圖片喇！');
    }
    clsInput.addEventListener('input', drawCert);
    nameInput.addEventListener('input', drawCert);
    document.getElementById('cert-open-btn').addEventListener('click', openCertModal);
    document.getElementById('cert-continue-btn').addEventListener('click', () => { certModal.style.display = 'none'; state.paused = false; });
    document.getElementById('download-cert-btn').addEventListener('click', () => {
        drawCert();
        const a = document.createElement('a');
        a.download = `四季科學小達人證書_${(nameInput.value || '小探險家').trim()}.png`;
        a.href = certCanvas.toDataURL('image/png');
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    });

    document.getElementById('quality-btn').addEventListener('click', e => {
        state.highQuality = !state.highQuality;
        World.setHighQuality(state.highQuality);
        e.currentTarget.textContent = state.highQuality ? '✨ 高畫質' : '⚡ 省電流暢';
    });
    document.getElementById('sound-btn').addEventListener('click', e => {
        AudioSys.enabled = !AudioSys.enabled;
        e.currentTarget.textContent = AudioSys.enabled ? '🔊 音效' : '🔇 靜音';
    });
    document.getElementById('start-game-btn').addEventListener('click', () => {
        AudioSys.init();
        SpeechSys.unlock();
        AudioSys.playGem();
        document.getElementById('start-overlay').style.display = 'none';
        state.started = true;
        setTimeout(() => { document.getElementById('mission-banner').style.opacity = '0'; }, 8000);
    });

    /* ── 6. 主物理引擎（地形坡度重力、木拱橋通行、河流水阻與動態天氣演變） ── */
    const clock = new THREE.Clock();
    const targetSky = new THREE.Color(SEASON_META.plaza.sky);
    const targetFog = new THREE.Color(SEASON_META.plaza.fog);
    let targetFogD  = SEASON_META.plaza.fogD;
    let targetSunI  = SEASON_META.plaza.sun;
    let targetHemiI = SEASON_META.plaza.hemi;

    document.addEventListener('visibilitychange', () => { if (!document.hidden) clock.getDelta(); });

    function damp(curr, target, lambda, dt) {
        return THREE.MathUtils.lerp(curr, target, 1 - Math.exp(-lambda * dt));
    }

    function detectZone(x, z) {
        if (x * x + z * z < 21.5 * 21.5) return 'plaza';
        if (x < 0 && z < 0) return 'spring';
        if (x >= 0 && z < 0) return 'summer';
        if (x < 0 && z >= 0) return 'autumn';
        return 'winter';
    }

    function animate() {
        requestAnimationFrame(animate);

        const dt = Math.min(clock.getDelta(), PHYSICS.MAX_DT);
        const elapsed = clock.getElapsedTime();

        // 河流流動 UV 動畫、小風扇轉動與場景動態細節
        World.riverFlowTex.offset.y -= dt * 0.45;
        World.fanBlades.rotation.z += dt * 22.0;
        World.updateBurst(dt);

        const curWeather = getCurrentZoneWeather(state.currentZone);
        const windSpeedX = curWeather ? curWeather.windX : 0.8;

        World.weatherVane.rotation.y += dt * (1.8 + Math.abs(windSpeedX) * 0.65);
        World.flameOuter.scale.set(1 + Math.sin(elapsed * 14) * 0.09, 1 + Math.cos(elapsed * 18) * 0.14, 1);
        World.fireLight.intensity = 1.45 + Math.sin(elapsed * 15) * 0.25;

        for (let i = 0; i < World.swayTrees.length; i++) {
            const tr = World.swayTrees[i];
            const swayAmp = tr.userData.season === state.currentZone ? Math.min(0.14, 0.025 + Math.abs(windSpeedX) * 0.012) : 0.025;
            tr.rotation.z = Math.sin(elapsed * 2.2 + tr.userData.phase) * swayAmp;
        }

        if (state.started && !state.paused) {
            // 1. 動態四季天氣計時器與閃電特效
            state.weatherTimer -= dt;
            if (state.weatherTimer <= 0) {
                advanceZoneWeather(state.currentZone, false);
            }

            if (curWeather && curWeather.lightning) {
                state.lightningCooldown -= dt;
                if (state.lightningCooldown <= 0) {
                    state.lightningCooldown = 4.5 + Math.random() * 5.0;
                    flashEl.style.opacity = '0.72';
                    setTimeout(() => { flashEl.style.opacity = '0'; }, 110);
                    AudioSys.playWeatherSFX('storm');
                }
            }

            // 初入新季節園區且尚未換上對應天氣裝備時，緩衝 1.6 秒後提醒玩家換裝
            if (curWeather && state.equippedWeatherId !== curWeather.id) {
                state.zoneEntryDelay += dt;
                if (state.zoneEntryDelay >= 1.6) {
                    state.zoneEntryDelay = 0;
                    triggerWeatherAdaptation(state.currentZone, curWeather, `歡迎來到${SEASON_META[state.currentZone].short}，現在天氣係${curWeather.name}`);
                }
            } else {
                state.zoneEntryDelay = 0;
            }

            // 2. 讀取搖桿／鍵盤輸入並轉換為鏡頭相對方向
            let rawX = input.joyX, rawZ = input.joyY;
            if (input.keys['KeyW'] || input.keys['ArrowUp'])    rawZ -= 1;
            if (input.keys['KeyS'] || input.keys['ArrowDown'])  rawZ += 1;
            if (input.keys['KeyA'] || input.keys['ArrowLeft'])  rawX -= 1;
            if (input.keys['KeyD'] || input.keys['ArrowRight']) rawX += 1;

            const mag = Math.hypot(rawX, rawZ);
            const normMag = Math.min(mag, 1.0);
            if (mag > 1.0) { rawX /= mag; rawZ /= mag; }

            const sinY = Math.sin(state.camYaw), cosY = Math.cos(state.camYaw);
            const wishX = rawX * cosY + rawZ * sinY;
            const wishZ = -rawX * sinY + rawZ * cosY;

            // 衝刺體力更新
            const wantsSprint = (input.sprintPid !== null || input.sprintKey) && normMag > 0.15 && state.stamina > 3 && !state.inWater;
            if (wantsSprint) state.stamina = Math.max(0, state.stamina - PHYSICS.STAMINA_DRAIN * dt);
            else state.stamina = Math.min(100, state.stamina + PHYSICS.STAMINA_REGEN * dt);
            staminaFillEl.style.width = `${state.stamina}%`;

            // 3. 地形坡度重力分量、風阻、涉水流體阻力與地面摩擦物理積分
            const prevX = World.player.position.x;
            const prevZ = World.player.position.z;
            const grad = World.getTerrainGradient(prevX, prevZ);
            const bridgeInfoNow = World.getBridgeDeckHeight(prevX, prevZ);

            const accel = state.isGrounded ? PHYSICS.ACCEL_GROUND : PHYSICS.ACCEL_AIR;
            if (normMag > 0.04) {
                state.vx += wishX * accel * dt;
                state.vz += wishZ * accel * dt;
            }

            // 陸地斜坡真實重力切向分量 (-|g| * dh/dx / (1 + slope²))
            if (state.isGrounded && !bridgeInfoNow && grad.slope > 0.06) {
                const denom = 1 + grad.slope * grad.slope;
                state.vx -= Math.abs(PHYSICS.GRAVITY) * 0.42 * (grad.gx / denom) * dt;
                state.vz -= Math.abs(PHYSICS.GRAVITY) * 0.42 * (grad.gz / denom) * dt;
            }

            // 強風天氣水平風力推拂
            if (curWeather && Math.abs(curWeather.windX) > 2.0) {
                state.vx += curWeather.windX * 0.35 * dt;
            }

            // 河道涉水流體阻力與順流推力
            const rvNow = World.getRiverInfo(prevX, prevZ);
            state.inWater = (!bridgeInfoNow && World.player.position.y < PHYSICS.WATER_LEVEL - 0.05 && rvNow.mask > 0.25);
            if (state.inWater) {
                state.vx += rvNow.flowX * PHYSICS.RIVER_FLOW_SPEED * dt;
                state.vz += rvNow.flowZ * PHYSICS.RIVER_FLOW_SPEED * dt;
                const waterDamp = Math.exp(-PHYSICS.WATER_DRAG * dt);
                state.vx *= waterDamp;
                state.vz *= waterDamp;
                state.splashCooldown -= dt;
                if (Math.hypot(state.vx, state.vz) > 1.2 && state.splashCooldown <= 0) {
                    state.splashCooldown = 0.48;
                    AudioSys.playSplash();
                }
            } else {
                const surfKey = bridgeInfoNow ? 'bridge' : state.currentZone;
                const friction = state.isGrounded ? PHYSICS.SURFACE_FRICTION[surfKey] : 1.4;
                const damping = Math.exp(-friction * dt);
                if (normMag <= 0.04 || state.currentZone === 'winter') {
                    state.vx *= damping;
                    state.vz *= damping;
                }
            }

            const speedCap = (state.inWater ? PHYSICS.WALK_SPEED * 0.58 : (wantsSprint ? PHYSICS.SPRINT_SPEED : PHYSICS.WALK_SPEED)) * Math.max(0.35, normMag || 1);
            const hSpeed = Math.hypot(state.vx, state.vz);
            if (normMag > 0.04 && hSpeed > speedCap) {
                state.vx = (state.vx / hSpeed) * speedCap;
                state.vz = (state.vz / hSpeed) * speedCap;
            }

            // 水平碰撞與陡坡解算
            const candX = prevX + state.vx * dt;
            const candZ = prevZ + state.vz * dt;
            const solved = World.resolveHorizontalWorld(candX, candZ, World.player.position.y, PHYSICS.PLAYER_RADIUS, prevX, prevZ);
            if (Math.abs(solved.x - candX) > 0.0001) state.vx = (solved.x - prevX) / Math.max(dt, 0.001);
            if (Math.abs(solved.z - candZ) > 0.0001) state.vz = (solved.z - prevZ) / Math.max(dt, 0.001);
            World.player.position.x = solved.x;
            World.player.position.z = solved.z;

            // 4. 垂直高度支撐（取地形與拱橋橋面較高者）與拋物線跳躍
            const terrainY = World.getTerrainHeight(solved.x, solved.z);
            const bridgeAfter = World.getBridgeDeckHeight(solved.x, solved.z);
            const supportY = bridgeAfter ? Math.max(terrainY, bridgeAfter.y) : terrainY;
            state.onBridge = !!(bridgeAfter && bridgeAfter.y >= terrainY - 0.05 && World.player.position.y >= bridgeAfter.y - 0.6);

            state.vy += PHYSICS.GRAVITY * dt;
            World.player.position.y += state.vy * dt;

            if (World.player.position.y <= supportY + 0.08 && state.vy <= 0) {
                World.player.position.y = supportY;
                state.vy = 0;
                state.isGrounded = true;
            } else if (World.player.position.y < supportY) {
                World.player.position.y = supportY;
                state.vy = 0;
                state.isGrounded = true;
            }

            // 接觸陰影與涉水漣漪更新
            const airH = Math.max(0, World.player.position.y - supportY);
            const shFactor = Math.max(0.35, 1.0 - airH * 0.2);
            World.playerShadow.position.set(solved.x, supportY + 0.05, solved.z);
            World.playerShadow.scale.set(2.25 * shFactor, 1, 2.25 * shFactor);
            World.playerShadow.material.opacity = state.inWater ? 0.25 : 0.85 * shFactor;

            if (state.inWater) {
                World.waterRipple.position.set(solved.x, PHYSICS.WATER_LEVEL + 0.03, solved.z);
                const ripScale = 0.85 + (elapsed * 1.8 % 1) * 0.85;
                World.waterRipple.scale.setScalar(ripScale);
                World.waterRipple.material.opacity = (1 - (elapsed * 1.8 % 1)) * 0.65;
            } else {
                World.waterRipple.material.opacity = 0;
            }

            // 5. 主角轉向、四肢擺動與手提物品持握姿態
            const moveVel = Math.hypot(state.vx, state.vz);
            if (normMag > 0.06) {
                const targetAng = Math.atan2(wishX, wishZ);
                let dAng = targetAng - World.player.rotation.y;
                while (dAng < -Math.PI) dAng += Math.PI * 2;
                while (dAng >  Math.PI) dAng -= Math.PI * 2;
                World.player.rotation.y += dAng * (1 - Math.exp(-14 * dt));
            }

            const holdingProp = !!World.getActiveProp();
            const rightHoldPitch = World.getActiveProp() === 'umbrella' ? -0.95 : -0.72;

            if (state.isGrounded && moveVel > 0.55) {
                state.walkCycle += dt * moveVel * 1.15;
                const sw = Math.sin(state.walkCycle) * 0.66;
                World.leftLeg.rotation.x  =  sw;
                World.rightLeg.rotation.x = -sw;
                World.leftArm.rotation.x  = -sw * 0.85;
                World.rightArm.rotation.x = holdingProp ? (rightHoldPitch + sw * 0.18) : sw * 0.85;
                World.playerVisual.position.y = Math.abs(Math.sin(state.walkCycle)) * 0.13;
                World.gearCape.rotation.x = 0.36 + Math.abs(sw) * 0.35;
            } else if (!state.isGrounded) {
                World.leftArm.rotation.x  = damp(World.leftArm.rotation.x, -2.1, 12, dt);
                World.rightArm.rotation.x = damp(World.rightArm.rotation.x, holdingProp ? -1.2 : -2.1, 12, dt);
                World.leftLeg.rotation.x  = damp(World.leftLeg.rotation.x,  0.35, 12, dt);
                World.rightLeg.rotation.x = damp(World.rightLeg.rotation.x, -0.25, 12, dt);
            } else {
                World.leftLeg.rotation.x  = damp(World.leftLeg.rotation.x, 0, 12, dt);
                World.rightLeg.rotation.x = damp(World.rightLeg.rotation.x, 0, 12, dt);
                World.leftArm.rotation.x  = damp(World.leftArm.rotation.x, 0, 12, dt);
                World.rightArm.rotation.x = damp(World.rightArm.rotation.x, holdingProp ? rightHoldPitch : 0, 12, dt);
                World.playerVisual.position.y = Math.sin(elapsed * 2.6) * 0.03;
                World.gearCape.rotation.x = damp(World.gearCape.rotation.x, 0.2, 8, dt);
            }

            // 6. 區域切換與 HUD 資訊同步
            const nextZone = detectZone(solved.x, solved.z);
            if (nextZone !== state.currentZone) {
                state.currentZone = nextZone;
                state.zoneEntryDelay = 0;
                const m = SEASON_META[nextZone];
                seasonBadgeEl.textContent = m.name;
                seasonBadgeEl.style.background = m.tagBg;
                seasonBadgeEl.style.color = m.tagColor;
                zoneShortEl.textContent = m.short;
            }

            const activeW = getCurrentZoneWeather(state.currentZone);
            if (activeW) {
                weatherBadgeEl.textContent = `${activeW.icon} ${activeW.name}`;
                targetSky.setHex(activeW.sky);
                targetFog.setHex(activeW.fog);
                targetFogD  = activeW.fogD;
                targetSunI  = activeW.sun;
                targetHemiI = activeW.hemi;
            } else {
                const pm = SEASON_META.plaza;
                weatherBadgeEl.textContent = '🌤️ 舒適微風';
                targetSky.setHex(pm.sky);
                targetFog.setHex(pm.fog);
                targetFogD  = pm.fogD;
                targetSunI  = pm.sun;
                targetHemiI = pm.hemi;
            }

            const surfLabel = state.onBridge ? '🌉 木拱橋面' : (state.inWater ? '🌊 清澈河道（涉水減速）' : SEASON_META[state.currentZone].surface);
            physBadgeEl.textContent = `📐 海拔 ${World.player.position.y.toFixed(1)}m｜${surfLabel}`;

            // 7. 任務寶石拾取偵測
            for (let i = 0; i < World.treasures.length; i++) {
                const t = World.treasures[i];
                if (!t.active) continue;
                t.mesh.rotation.y += dt * 1.8;
                t.ring.rotation.z += dt * 2.4;
                t.mesh.position.y = t.baseY + 1.95 + Math.sin(elapsed * 3.0 + t.phase) * 0.3;
                const d = Math.hypot(solved.x - t.mesh.position.x, solved.z - t.mesh.position.z);
                if (d < 2.55 && Math.abs(World.player.position.y - t.baseY) < 2.8 && !state.paused) {
                    openTreasureOrMonkeyQuiz(t.season, t, false);
                    break;
                }
            }

            // 8. 小猴子地形巡邏（自動避開河道、陡峭山壁與建築物）
            for (let i = 0; i < World.monkeys.length; i++) {
                const mk = World.monkeys[i];
                if (mk.cooldown > 0) mk.cooldown -= dt;

                const dxP = mk.mesh.position.x - solved.x;
                const dzP = mk.mesh.position.z - solved.z;
                const distP = Math.hypot(dxP, dzP);

                let mSpd = 4.5;
                if (distP < 11.5 && mk.cooldown <= 0) {
                    mk.alertBadge.visible = true;
                    mk.dirAngle = Math.atan2(dxP, dzP);
                    mSpd = 8.2;
                } else {
                    mk.alertBadge.visible = false;
                    mk.changeTimer -= dt;
                    if (mk.changeTimer <= 0) {
                        mk.dirAngle = Math.random() * Math.PI * 2;
                        mk.changeTimer = 1.6 + Math.random() * 2.0;
                    }
                }

                let mx = mk.mesh.position.x + Math.sin(mk.dirAngle) * mSpd * dt;
                let mz = mk.mesh.position.z + Math.cos(mk.dirAngle) * mSpd * dt;

                if (mx < mk.zone.xMin || mx > mk.zone.xMax) { mk.dirAngle = -mk.dirAngle; mx = THREE.MathUtils.clamp(mx, mk.zone.xMin, mk.zone.xMax); }
                if (mz < mk.zone.zMin || mz > mk.zone.zMax) { mk.dirAngle = Math.PI - mk.dirAngle; mz = THREE.MathUtils.clamp(mz, mk.zone.zMin, mk.zone.zMax); }

                if (World.getRiverInfo(mx, mz).dist < PHYSICS.RIVER_HALF_W + 1.6 || World.getTerrainGradient(mx, mz).slope > 0.56) {
                    mk.dirAngle += 2.2;
                    mx = mk.mesh.position.x;
                    mz = mk.mesh.position.z;
                } else {
                    const mkSol = World.resolveHorizontalWorld(mx, mz, mk.mesh.position.y, PHYSICS.MONKEY_RADIUS, mk.mesh.position.x, mk.mesh.position.z);
                    if (Math.hypot(mkSol.x - mx, mkSol.z - mz) > 0.02) mk.dirAngle += 1.4;
                    mx = mkSol.x; mz = mkSol.z;
                }

                const mGround = World.getTerrainHeight(mx, mz);
                const hop = Math.abs(Math.sin(elapsed * 8.5 + mk.hopPhase)) * 0.52;
                mk.mesh.position.set(mx, mGround + hop, mz);
                mk.mesh.rotation.y = mk.dirAngle;
                mk.shadow.position.set(mx, mGround + 0.05, mz);

                if (distP < 2.25 && mk.cooldown <= 0 && !state.paused) {
                    mk.cooldown = 9.5;
                    openTreasureOrMonkeyQuiz(mk.season, mk, true);
                    break;
                }
            }

            // 9. 動態天氣粒子運動 (m/s * dt)
            if (activeW && World.P_MODES[activeW.pMode]) {
                const cfg = World.P_MODES[activeW.pMode];
                World.weatherPoints.visible = true;
                World.weatherPoints.material.color.setHex(cfg.color);
                World.weatherPoints.material.size = cfg.size;
                World.weatherPoints.material.opacity = cfg.op;

                const posAttr = World.weatherPoints.geometry.attributes.position;
                const arr = posAttr.array;
                for (let i = 0; i < World.PARTICLE_COUNT; i++) {
                    const fl = cfg.flutter > 0 ? Math.sin(elapsed * 2.8 + World.pSeeds[i]) * cfg.flutter : 0;
                    arr[i * 3]     += (activeW.windX + fl) * dt;
                    arr[i * 3 + 1] -= cfg.fall * dt;
                    if (arr[i * 3 + 1] < World.player.position.y - 2) {
                        arr[i * 3]     = World.player.position.x + (Math.random() - 0.5) * 82;
                        arr[i * 3 + 1] = World.player.position.y + 24 + Math.random() * 10;
                        arr[i * 3 + 2] = World.player.position.z + (Math.random() - 0.5) * 82;
                    }
                }
                posAttr.needsUpdate = true;
            } else {
                World.weatherPoints.visible = false;
            }
        }

        // 10. 環境光影平滑過渡、第三人稱地形防穿模鏡頭與右上雷達地圖繪製
        const envFactor = 1 - Math.exp(-3.0 * dt);
        World.scene.background.lerp(targetSky, envFactor);
        World.scene.fog.color.lerp(targetFog, envFactor);
        World.scene.fog.density = damp(World.scene.fog.density, targetFogD, 2.8, dt);
        World.sunLight.intensity  = damp(World.sunLight.intensity, targetSunI, 3.0, dt);
        World.hemiLight.intensity = damp(World.hemiLight.intensity, targetHemiI, 3.0, dt);

        const camDist = 17.2;
        const hDist = camDist * Math.cos(state.camPitch);
        const vDist = camDist * Math.sin(state.camPitch) + 2.6;
        const desX = World.player.position.x + Math.sin(state.camYaw) * hDist;
        const desZ = World.player.position.z + Math.cos(state.camYaw) * hDist;
        const camGroundMin = World.getTerrainHeight(
            THREE.MathUtils.clamp(desX, -95, 95),
            THREE.MathUtils.clamp(desZ, -95, 95)
        ) + 2.2;
        const desY = Math.max(camGroundMin, World.player.position.y + vDist);

        World.camera.position.x = damp(World.camera.position.x, desX, 10.5, dt);
        World.camera.position.y = damp(World.camera.position.y, desY,  9.5, dt);
        World.camera.position.z = damp(World.camera.position.z, desZ, 10.5, dt);
        World.camera.lookAt(World.player.position.x, World.player.position.y + 2.1, World.player.position.z);

        renderMinimap(elapsed);
        World.renderer.render(World.scene, World.camera);
    }

    window.addEventListener('resize', () => {
        World.camera.aspect = window.innerWidth / window.innerHeight;
        World.camera.updateProjectionMatrix();
        World.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
})();

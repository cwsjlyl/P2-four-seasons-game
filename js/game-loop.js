/* =========================================================================
   四季小探險家 3D — 寶可夢徽章進度、香港動植物箭嘴導航、廣角鏡頭與物理主循環
   ========================================================================= */
(() => {
    'use strict';

    const { PHYSICS, SEASON_META, WEATHER_STATES, QUESTION_BANK, HK_GUARDIANS, AudioSys, SpeechSys, World } = GameApp;

    const ZOOM_MODES = [
        { label: '🔭 遠景', dist: 29.5, pitch: 0.52 },
        { label: '🗺️ 全景', dist: 38.0, pitch: 0.62 },
        { label: '👁️ 標準', dist: 21.0, pitch: 0.44 }
    ];

    const state = {
        started: false,
        paused: false,
        highQuality: true,
        zoomIdx: 0,
        camDist: ZOOM_MODES[0].dist,
        camYaw: 0,
        camPitch: ZOOM_MODES[0].pitch,
        stamina: 100,
        speedBoostTimer: 0,
        currentZone: 'plaza',
        vx: 0, vy: 0, vz: 0,
        isGrounded: true,
        onBridge: false,
        inWater: false,
        walkCycle: 0,
        // 四季各 2 個任務點與寶可夢式大獎章狀態
        seasonProgress: {
            spring: { mDone: [false, false], grandBadge: false },
            summer: { mDone: [false, false], grandBadge: false },
            autumn: { mDone: [false, false], grandBadge: false },
            winter: { mDone: [false, false], grandBadge: false }
        },
        // 動態天氣（95 秒舒適間隔，答對只換外觀，不計獎章）
        weatherIdx: { spring: 0, summer: 0, autumn: 0, winter: 0 },
        weatherTimer: PHYSICS.WEATHER_CYCLE_SEC,
        lightningCooldown: 5.0,
        splashCooldown: 0,
        guardianHintCooldown: 0,
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
    const missionBannerEl= document.getElementById('mission-banner');
    const toastEl        = document.getElementById('weather-toast');
    const toastIconEl    = document.getElementById('weather-toast-icon');
    const toastTitleEl   = document.getElementById('weather-toast-title');
    const toastDescEl    = document.getElementById('weather-toast-desc');
    const flashEl        = document.getElementById('lightning-flash');

    let toastTimer = null;
    function showToast(icon, title, desc, duration = 5000) {
        toastIconEl.textContent  = icon;
        toastTitleEl.textContent = title;
        toastDescEl.textContent  = desc;
        toastEl.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
    }

    function countGrandBadges() {
        return ['spring', 'summer', 'autumn', 'winter'].filter(s => state.seasonProgress[s].grandBadge).length;
    }

    function refreshBadgeCaseUI() {
        ['spring', 'summer', 'autumn', 'winter'].forEach(s => {
            const prog = state.seasonProgress[s];
            document.getElementById(`pip-${s}-0`).classList.toggle('done', prog.mDone[0]);
            document.getElementById(`pip-${s}-1`).classList.toggle('done', prog.mDone[1]);

            const slot = document.getElementById(`slot-${s}`);
            const bothDone = prog.mDone[0] && prog.mDone[1];
            slot.classList.toggle('ready-guardian', bothDone && !prog.grandBadge);
            slot.classList.toggle('unlocked', prog.grandBadge);

            // 同步香港守護動植物金色召喚光柱
            World.guardianNodes[s].beacon.visible = (bothDone && !prog.grandBadge);
        });

        const totalGrand = countGrandBadges();
        if (totalGrand >= 4) {
            document.getElementById('cert-open-btn').style.display = 'inline-flex';
            missionBannerEl.textContent = '🏆 恭喜集齊春、夏、秋、冬四枚香港生態大獎章！可隨時領取榮譽證書！';
            missionBannerEl.style.opacity = '1';
        }
        refreshWardrobeLocks();
    }

    // 尋找目前已完成 2 個任務點、等待前往香港特色動植物領取大獎章的目標（供 3D 金色箭嘴指向）
    function getActiveArrowTarget() {
        // 優先指向當前所在園區已解鎖的香港特色動植物
        if (state.seasonProgress[state.currentZone]) {
            const curP = state.seasonProgress[state.currentZone];
            if (curP.mDone[0] && curP.mDone[1] && !curP.grandBadge) {
                return World.guardianNodes[state.currentZone].data;
            }
        }
        // 否則檢查其他已完成 2 個任務點但未領取大獎章的季節
        const seasons = ['spring', 'summer', 'autumn', 'winter'];
        for (let i = 0; i < seasons.length; i++) {
            const s = seasons[i];
            const p = state.seasonProgress[s];
            if (p.mDone[0] && p.mDone[1] && !p.grandBadge) {
                return World.guardianNodes[s].data;
            }
        }
        return null;
    }

    function getCurrentZoneWeather(zone) {
        if (!WEATHER_STATES[zone]) return null;
        return WEATHER_STATES[zone][state.weatherIdx[zone]];
    }

    /* ── 2. 右上方半透明虛擬雷達地圖（顯示建築物、任務點 ①②、香港動植物、小橋、猴子） ── */
    const miniCanvas = document.getElementById('minimap-canvas');
    const mctx = miniCanvas.getContext('2d');
    const MW = miniCanvas.width, MH = miniCanvas.height;

    function worldToMini(wx, wz) {
        const half = 98;
        return { x: ((wx + half) / (half * 2)) * MW, y: ((wz + half) / (half * 2)) * MH };
    }

    const staticMapCanvas = document.createElement('canvas');
    staticMapCanvas.width = MW; staticMapCanvas.height = MH;
    (() => {
        const g = staticMapCanvas.getContext('2d');
        const mid = MW / 2;
        g.fillStyle = 'rgba(74, 222, 128, 0.42)'; g.fillRect(0, 0, mid, mid);
        g.fillStyle = 'rgba(251, 191, 36, 0.44)'; g.fillRect(mid, 0, mid, mid);
        g.fillStyle = 'rgba(251, 146, 60, 0.44)'; g.fillRect(0, mid, mid, mid);
        g.fillStyle = 'rgba(186, 230, 253, 0.48)'; g.fillRect(mid, mid, mid, mid);

        World.MOUNTAIN_PEAKS.forEach(m => {
            if (!m.high) return;
            const p = worldToMini(m.x, m.z);
            const rPx = (m.sigma / 196) * MW * 1.1;
            g.fillStyle = 'rgba(15, 23, 42, 0.22)';
            g.beginPath(); g.arc(p.x, p.y, rPx, 0, Math.PI * 2); g.fill();
        });

        g.strokeStyle = '#22D3EE';
        g.lineWidth = (PHYSICS.RIVER_HALF_W * 2 / 196) * MW;
        g.lineCap = 'round';
        [-1, 1].forEach(sign => {
            g.beginPath();
            for (let d = 22; d <= 96; d += 3) {
                const wz = sign * d, wx = World.riverCenterX(wz), pt = worldToMini(wx, wz);
                if (d === 22) g.moveTo(pt.x, pt.y); else g.lineTo(pt.x, pt.y);
            }
            g.stroke();
            g.beginPath();
            for (let d = 22; d <= 96; d += 3) {
                const wx = sign * d, wz = World.riverCenterZ(wx), pt = worldToMini(wx, wz);
                if (d === 22) g.moveTo(pt.x, pt.y); else g.lineTo(pt.x, pt.y);
            }
            g.stroke();
        });

        const cPt = worldToMini(0, 0);
        g.fillStyle = 'rgba(245, 245, 244, 0.78)';
        g.beginPath(); g.arc(cPt.x, cPt.y, (21 / 196) * MW, 0, Math.PI * 2); g.fill();

        World.BRIDGES.forEach(b => {
            const bp = worldToMini(b.x, b.z);
            g.fillStyle = '#D97706';
            if (b.axis === 'x') g.fillRect(bp.x - 10, bp.y - 4, 20, 8);
            else g.fillRect(bp.x - 4, bp.y - 10, 8, 20);
        });

        World.LANDMARKS.forEach(lm => {
            const lp = worldToMini(lm.x, lm.z);
            g.fillStyle = lm.color;
            g.strokeStyle = '#0F172A';
            g.lineWidth = 2.5;
            g.fillRect(lp.x - 7, lp.y - 7, 14, 14);
            g.strokeRect(lp.x - 7, lp.y - 7, 14, 14);
        });
    })();

    function renderMinimap(elapsed) {
        mctx.clearRect(0, 0, MW, MH);
        mctx.drawImage(staticMapCanvas, 0, 0);

        const pulse = 1 + Math.sin(elapsed * 5.0) * 0.22;

        // 1. 繪製每季 2 個任務點（未完成：亮藍閃爍菱形；已完成：翠綠小點）
        World.missionNodes.forEach(mn => {
            const mp = worldToMini(mn.x, mn.z);
            mctx.save();
            mctx.translate(mp.x, mp.y);
            if (mn.done) {
                mctx.fillStyle = '#22C55E';
                mctx.beginPath(); mctx.arc(0, 0, 4, 0, Math.PI * 2); mctx.fill();
            } else {
                mctx.rotate(Math.PI / 4);
                const sz = 5.2 * pulse;
                mctx.fillStyle = '#38BDF8';
                mctx.strokeStyle = '#FFFFFF';
                mctx.lineWidth = 2;
                mctx.fillRect(-sz, -sz, sz * 2, sz * 2);
                mctx.strokeRect(-sz, -sz, sz * 2, sz * 2);
            }
            mctx.restore();
        });

        // 2. 繪製 4 大香港守護動植物位置（當 2/2 任務完成時以金色大光環閃爍指引！）
        ['spring', 'summer', 'autumn', 'winter'].forEach(s => {
            const gData = World.guardianNodes[s].data;
            const prog = state.seasonProgress[s];
            const gp = worldToMini(gData.x, gData.z);
            const isTarget = prog.mDone[0] && prog.mDone[1] && !prog.grandBadge;
            if (isTarget) {
                mctx.beginPath();
                mctx.arc(gp.x, gp.y, 11 * pulse, 0, Math.PI * 2);
                mctx.strokeStyle = '#FACC15';
                mctx.lineWidth = 3;
                mctx.stroke();
            }
            mctx.beginPath();
            mctx.arc(gp.x, gp.y, prog.grandBadge ? 4.5 : 6.2, 0, Math.PI * 2);
            mctx.fillStyle = prog.grandBadge ? '#FACC15' : '#4ADE80';
            mctx.fill();
            mctx.lineWidth = 2;
            mctx.strokeStyle = '#0F172A';
            mctx.stroke();
        });

        // 3. 小猴子動態圓點
        World.monkeys.forEach(mk => {
            const mp = worldToMini(mk.mesh.position.x, mk.mesh.position.z);
            mctx.beginPath(); mctx.arc(mp.x, mp.y, 5.2, 0, Math.PI * 2);
            mctx.fillStyle = '#F59E0B'; mctx.fill();
            mctx.lineWidth = 1.8; mctx.strokeStyle = '#78350F'; mctx.stroke();
        });

        // 4. 玩家箭頭與廣角視野扇形
        const pp = worldToMini(World.player.position.x, World.player.position.z);
        const lookAng = Math.atan2(-Math.sin(state.camYaw), -Math.cos(state.camYaw)) - Math.PI / 2;
        mctx.save();
        mctx.translate(pp.x, pp.y);
        mctx.rotate(lookAng);
        mctx.beginPath();
        mctx.moveTo(0, 0);
        mctx.arc(0, 0, 32, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
        mctx.closePath();
        mctx.fillStyle = 'rgba(254, 240, 138, 0.34)';
        mctx.fill();

        mctx.beginPath();
        mctx.moveTo(0, -9); mctx.lineTo(7, 7); mctx.lineTo(0, 3); mctx.lineTo(-7, 7); mctx.closePath();
        mctx.fillStyle = '#EF4444'; mctx.fill();
        mctx.lineWidth = 2.2; mctx.strokeStyle = '#FFFFFF'; mctx.stroke();
        mctx.restore();
    }

    /* ── 3. 四類問答系統：任務點題（小徽章）、香港守護動植物題（大獎章）、天氣題（純換外觀）、小猴子題（加速獎勵） ── */
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
        const { qObj, optDomButtons, voicePrefix } = state.activeQuiz;
        const seq = [{ text: `${voicePrefix || ''}${qObj.q}`, el: qTextEl }];
        qObj.opts.forEach((optText, i) => {
            seq.push({ text: `選項 ${LETTERS[i]}：${optText}`, el: optDomButtons[i] });
        });
        SpeechSys.speakSequence(seq);
    }

    function mountQuiz({ kind, season, tagText, tagBg, tagColor, qObj, payload, voicePrefix = '' }) {
        state.paused = true;
        quizCard.classList.toggle('weather-quiz-mode', kind === 'weather');
        quizCard.classList.toggle('guardian-quiz-mode', kind === 'guardian');

        qSeasonTag.textContent = tagText;
        qSeasonTag.style.background = tagBg;
        qSeasonTag.style.color = tagColor;

        qTextEl.textContent = qObj.q;
        qOptionsEl.innerHTML = '';
        feedbackBox.style.display = 'none';
        quizNextBtn.style.display = 'none';
        quizCloseBtn.style.display = kind === 'weather' ? 'none' : 'inline-block';

        const optDomButtons = [];
        qObj.opts.forEach((optText, idx) => {
            const row = document.createElement('div');
            row.className = 'option-row';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'opt-btn';
            btn.innerHTML = `<span class="opt-letter">${LETTERS[idx]}</span><span>${optText}</span>`;
            btn.addEventListener('click', () => handleSelectAnswer(idx, btn));

            const spk = document.createElement('button');
            spk.type = 'button';
            spk.className = 'opt-speak-btn';
            spk.innerHTML = `🔊<span>讀${LETTERS[idx]}</span>`;
            spk.addEventListener('click', e => {
                e.stopPropagation();
                SpeechSys.speakSingle(`選項 ${LETTERS[idx]}：${optText}`, btn);
            });

            row.appendChild(btn); row.appendChild(spk);
            qOptionsEl.appendChild(row);
            optDomButtons.push(btn);
        });

        state.activeQuiz = { kind, season, qObj, payload, optDomButtons, solved: false, voicePrefix };
        quizModal.style.display = 'flex';
        if (SpeechSys.autoRead) readQuestionAndAllOptions();
    }

    function drawRandomSeasonQ(season) {
        const pool = QUESTION_BANK[season];
        if (state.usedQ[season].length >= pool.length) state.usedQ[season] = [];
        const avail = pool.map((_, idx) => idx).filter(idx => !state.usedQ[season].includes(idx));
        const pick = avail[Math.floor(Math.random() * avail.length)];
        state.usedQ[season].push(pick);
        return shuffleQuestion(pool[pick], 'exp');
    }

    function openMissionQuiz(mNode) {
        AudioSys.playGem();
        const meta = SEASON_META[mNode.season];
        mountQuiz({
            kind: 'mission',
            season: mNode.season,
            tagText: `📍 ${mNode.label}`,
            tagBg: meta.tagBg,
            tagColor: meta.tagColor,
            qObj: drawRandomSeasonQ(mNode.season),
            payload: mNode
        });
    }

    function openGuardianQuiz(gNode) {
        AudioSys.playGem();
        const gData = gNode.data;
        mountQuiz({
            kind: 'guardian',
            season: gData.season,
            tagText: `🌟 香港生態大獎章挑戰｜${gData.name}`,
            tagBg: '#FEF08A',
            tagColor: '#854D0E',
            qObj: shuffleQuestion(gData.quiz, 'teach'),
            payload: gNode,
            voicePrefix: `${gData.intro}`
        });
    }

    function openWeatherQuiz(zone, weatherObj) {
        AudioSys.playWeatherSFX(weatherObj.sfx);
        showToast(weatherObj.icon, `${SEASON_META[zone].short}天氣轉變：${weatherObj.name}`, weatherObj.alert, 6000);
        mountQuiz({
            kind: 'weather',
            season: zone,
            tagText: `${weatherObj.icon} 天氣換裝時間（答對更換衣著及物品）`,
            tagBg: '#E0F2FE',
            tagColor: '#0369A1',
            qObj: shuffleQuestion(weatherObj.quiz, 'teach'),
            payload: weatherObj,
            voicePrefix: `天氣轉變為${weatherObj.name}！`
        });
    }

    function openMonkeyQuiz(mk) {
        AudioSys.playGem();
        const meta = SEASON_META[mk.season];
        mountQuiz({
            kind: 'monkey',
            season: mk.season,
            tagText: `🐒 百厭小猴子突擊題（答對送無限衝刺加速！）`,
            tagBg: meta.tagBg,
            tagColor: meta.tagColor,
            qObj: drawRandomSeasonQ(mk.season),
            payload: mk
        });
    }

    function handleSelectAnswer(idx, btnEl) {
        if (!state.activeQuiz || state.activeQuiz.solved) return;
        const { kind, season, qObj, payload } = state.activeQuiz;

        if (idx === qObj.ans) {
            state.activeQuiz.solved = true;
            btnEl.classList.add('correct');
            state.activeQuiz.optDomButtons.forEach(b => { b.style.pointerEvents = 'none'; });

            feedbackBox.style.display = 'block';
            feedbackBox.style.background = '#ECFDF5';
            feedbackBox.style.borderColor = '#6EE7B7';
            feedbackTitle.style.color = '#15803D';

            if (kind === 'mission') {
                AudioSys.playCorrect();
                payload.done = true;
                payload.cryMat.color.setHex(0x22C55E);
                payload.cryMat.emissive.setHex(0x16A34A);
                state.seasonProgress[season].mDone[payload.idx] = true;
                refreshBadgeCaseUI();

                const prog = state.seasonProgress[season];
                const bothDone = prog.mDone[0] && prog.mDone[1];
                if (bothDone && !prog.grandBadge) {
                    const gData = HK_GUARDIANS[season];
                    feedbackTitle.textContent = `🎉 完成本區 2 個任務點！金色導航箭嘴已開啟！`;
                    feedbackExp.textContent = `💡 ${qObj.exp} 現在請跟隨頭頂【金色箭嘴】前往「${gData.name}」互動贏取大獎章！`;
                    quizNextBtn.textContent = '🧭 跟隨金色箭嘴出發！';
                    missionBannerEl.textContent = `🧭 ${gData.prompt}`;
                    missionBannerEl.style.opacity = '1';
                    SpeechSys.speakSingle(`答啱喇！你已經完成呢一區兩個任務點，快啲跟住頭頂嘅金色箭嘴去搵${gData.name.slice(2)}互動，領取大獎章啦！`);
                } else {
                    feedbackTitle.textContent = `🎉 獲得「${payload.label}」小徽章！`;
                    feedbackExp.textContent = `💡 科學小知識：${qObj.exp}`;
                    quizNextBtn.textContent = '🎉 繼續前往下一個任務點！';
                    SpeechSys.speakSingle(`答啱喇，獲得一枚小徽章！${qObj.exp}`);
                }
            } else if (kind === 'guardian') {
                AudioSys.playBadgeUnlock();
                state.seasonProgress[season].grandBadge = true;
                refreshBadgeCaseUI();
                const gData = payload.data;
                feedbackTitle.textContent = `🏅 恭喜獲得寶可夢級【${gData.badgeName}】！`;
                feedbackExp.textContent = `🌟 ${qObj.exp}`;
                quizNextBtn.textContent = countGrandBadges() >= 4 ? '🎓 集齊四大獎章，領取證書！' : '🏅 收下大獎章，繼續探索！';
                SpeechSys.speakSingle(qObj.exp);
            } else if (kind === 'weather') {
                // 天氣題答對：只更換角色衣著與手提物品，不發放獎章！
                AudioSys.playCorrect();
                World.applyWeatherOutfit(payload.outfit);
                outfitBadgeEl.textContent = `🧥 ${payload.outfit.label}`;
                feedbackTitle.textContent = `✨ 答啱喇！已換上「${payload.outfit.label}」！`;
                feedbackExp.textContent = `💡 天氣小課堂：${qObj.exp}`;
                quizNextBtn.textContent = '✨ 穿好新衣著，繼續探索！';
                SpeechSys.speakSingle(`答啱喇！已經幫你換上新衣著同手提物品喇！`);
            } else if (kind === 'monkey') {
                AudioSys.playCorrect();
                state.speedBoostTimer = 10.0;
                state.stamina = 100;
                feedbackTitle.textContent = '🍌 答啱喇！小猴子送你 10 秒「閃電無限衝刺」！';
                feedbackExp.textContent = `💡 科學小知識：${qObj.exp}`;
                quizNextBtn.textContent = '⚡ 啟動加速繼續跑！';
                SpeechSys.speakSingle(`答啱喇！小猴子送你十秒無限衝刺加速！`);
            }

            quizCloseBtn.style.display = 'none';
            quizNextBtn.style.display = 'inline-block';
        } else {
            btnEl.classList.add('wrong');
            btnEl.style.pointerEvents = 'none';
            AudioSys.playWrong();
            feedbackBox.style.display = 'block';
            feedbackBox.style.background = '#FFFBEB';
            feedbackBox.style.borderColor = '#FACC15';
            feedbackTitle.style.color = '#B45309';
            feedbackTitle.textContent = '💡 小老師提示（聽完再揀選正確答案啦）：';
            feedbackExp.textContent = qObj.exp;
            SpeechSys.speakSingle(`呢個唔太啱喎！提示：${qObj.exp} 請再揀選正確答案啦！`);
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
        const justFinishedGame = state.activeQuiz && state.activeQuiz.kind === 'guardian' && state.activeQuiz.solved && countGrandBadges() >= 4;
        state.activeQuiz = null;
        if (justFinishedGame) openCertModal();
        else state.paused = false;
    }

    quizNextBtn.addEventListener('click', closeQuizModal);
    quizCloseBtn.addEventListener('click', () => {
        if (state.activeQuiz && (state.activeQuiz.kind === 'mission' || state.activeQuiz.kind === 'guardian')) {
            World.player.position.x += Math.sin(state.camYaw) * 3.5;
            World.player.position.z += Math.cos(state.camYaw) * 3.5;
        }
        closeQuizModal();
    });

    /* ── 4. 視野縮放控制（遠景／全景／標準 + 滑鼠滾輪縮放）與天氣切換 ── */
    const zoomBtn = document.getElementById('zoom-btn');
    zoomBtn.addEventListener('click', () => {
        state.zoomIdx = (state.zoomIdx + 1) % ZOOM_MODES.length;
        const zm = ZOOM_MODES[state.zoomIdx];
        state.camDist  = zm.dist;
        state.camPitch = zm.pitch;
        zoomBtn.textContent = zm.label;
    });

    window.addEventListener('wheel', e => {
        state.camDist = THREE.MathUtils.clamp(state.camDist + e.deltaY * 0.02, 16.0, 42.0);
    }, { passive: true });

    document.getElementById('sim-weather-btn').addEventListener('click', () => {
        if (!state.started || state.paused) return;
        if (!WEATHER_STATES[state.currentZone]) {
            showToast('🧭', '請先進入春、夏、秋、冬園區', '走過木拱橋或步道進入季節園區即可轉換天氣！');
            return;
        }
        advanceWeather(true);
    });

    function advanceWeather(currentOnly = false) {
        if (currentOnly && WEATHER_STATES[state.currentZone]) {
            state.weatherIdx[state.currentZone] = (state.weatherIdx[state.currentZone] + 1) % WEATHER_STATES[state.currentZone].length;
        } else {
            ['spring', 'summer', 'autumn', 'winter'].forEach(z => {
                state.weatherIdx[z] = (state.weatherIdx[z] + 1) % WEATHER_STATES[z].length;
            });
        }
        state.weatherTimer = PHYSICS.WEATHER_CYCLE_SEC;
        const curW = getCurrentZoneWeather(state.currentZone);
        if (curW && !state.paused) {
            weatherBadgeEl.textContent = `${curW.icon} ${curW.name}`;
            openWeatherQuiz(state.currentZone, curW);
        }
    }

    /* ── 5. 觸控搖桿、跳躍、衝刺與鏡頭控制 ── */
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
    const JOY_R = 38;

    function moveJoy(cx, cy) {
        const r = joyZone.getBoundingClientRect();
        let dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy);
        if (d > JOY_R) { dx = (dx / d) * JOY_R; dy = (dy / d) * JOY_R; }
        joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        input.joyX = dx / JOY_R; input.joyY = dy / JOY_R;
    }

    joyZone.addEventListener('pointerdown', e => {
        e.stopPropagation();
        if (input.joyPid === null) {
            input.joyPid = e.pointerId; joyZone.setPointerCapture(e.pointerId); moveJoy(e.clientX, e.clientY);
        }
    });
    joyZone.addEventListener('pointermove', e => { if (e.pointerId === input.joyPid) moveJoy(e.clientX, e.clientY); });
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
            state.vy = state.inWater ? PHYSICS.JUMP_VELOCITY * 0.85 : PHYSICS.JUMP_VELOCITY;
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
        e.stopPropagation(); input.sprintPid = e.pointerId; sprintBtn.setPointerCapture(e.pointerId); sprintBtn.classList.add('held');
    });
    const endSprint = e => {
        if (e.pointerId === input.sprintPid) { input.sprintPid = null; sprintBtn.classList.remove('held'); }
    };
    sprintBtn.addEventListener('pointerup', endSprint);
    sprintBtn.addEventListener('pointercancel', endSprint);

    const gameCanvas = document.getElementById('game-canvas');
    gameCanvas.addEventListener('pointerdown', e => {
        if (input.camPid === null && !state.paused) {
            input.camPid = e.pointerId; input.camLastX = e.clientX; input.camLastY = e.clientY;
        }
    });
    window.addEventListener('pointermove', e => {
        if (e.pointerId === input.camPid) {
            state.camYaw   -= (e.clientX - input.camLastX) * 0.0065;
            state.camPitch = THREE.MathUtils.clamp(state.camPitch + (e.clientY - input.camLastY) * 0.0045, 0.24, 0.88);
            input.camLastX = e.clientX; input.camLastY = e.clientY;
        }
    });
    const endCam = e => { if (e.pointerId === input.camPid) input.camPid = null; };
    window.addEventListener('pointerup', endCam);
    window.addEventListener('pointercancel', endCam);

    /* ── 6. 深色系換裝室與四季生態大獎章證書 ── */
    const darkShirtCols = [0x172554, 0x14532D, 0x7F1D1D, 0x581C87, 0x78350F, 0x0F172A];
    const darkHatCols   = [0x7F1D1D, 0x1E3A8A, 0x064E3B, 0x451A03, 0x312E81, 0x18181B];

    function initSwatches(id, cols, mat) {
        const wrap = document.getElementById(id);
        cols.forEach((hex, idx) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'swatch-btn' + (idx === 0 ? ' selected' : '');
            b.style.background = '#' + hex.toString(16).padStart(6, '0');
            b.addEventListener('click', () => {
                wrap.querySelectorAll('.swatch-btn').forEach(el => el.classList.remove('selected'));
                b.classList.add('selected');
                mat.color.setHex(hex);
                AudioSys.playGem();
            });
            wrap.appendChild(b);
        });
    }
    initSwatches('shirt-swatches', darkShirtCols, World.coatMat);
    initSwatches('hat-swatches', darkHatCols, World.hatMat);

    function refreshWardrobeLocks() {
        const gCount = countGrandBadges();
        [
            { id: 'gear-glasses', reqId: 'gear-glasses-req', key: 'glasses', need: 1 },
            { id: 'gear-cape',    reqId: 'gear-cape-req',    key: 'cape',    need: 2 },
            { id: 'gear-crown',   reqId: 'gear-crown-req',   key: 'crown',   need: 3 }
        ].forEach(c => {
            const btn = document.getElementById(c.id), req = document.getElementById(c.reqId);
            const ok = gCount >= c.need;
            btn.classList.toggle('locked', !ok);
            btn.classList.toggle('equipped', state.gear[c.key]);
            req.textContent = ok ? (state.gear[c.key] ? '已裝備 ✨' : '點擊裝備') : `${c.need} 枚大獎章解鎖`;
        });
    }

    function bindGear(id, key, need, mesh) {
        document.getElementById(id).addEventListener('click', () => {
            if (countGrandBadges() < need) {
                SpeechSys.speakSingle(`收集夠 ${need} 枚季節大獎章就可以解鎖呢件榮譽飾品喇！`);
                return;
            }
            state.gear[key] = !state.gear[key];
            mesh.visible = state.gear[key];
            AudioSys.playGem();
            refreshWardrobeLocks();
        });
    }
    bindGear('gear-glasses', 'glasses', 1, World.gearGlasses);
    bindGear('gear-cape',    'cape',    2, World.gearCape);
    bindGear('gear-crown',   'crown',   3, World.gearCrown);

    const wardrobeModal = document.getElementById('wardrobe-modal');
    document.getElementById('wardrobe-btn').addEventListener('click', () => {
        state.paused = true; refreshWardrobeLocks(); wardrobeModal.style.display = 'flex';
    });
    document.getElementById('wardrobe-done-btn').addEventListener('click', () => {
        wardrobeModal.style.display = 'none'; state.paused = false;
    });

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
        ctx.strokeStyle = '#1E3A8A'; ctx.lineWidth = 5;  ctx.strokeRect(42, 42, W - 84, H - 84);

        ctx.fillStyle = '#92400E'; ctx.font = '900 44px "Noto Sans TC", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('🏆 四季生態大獎章大師榮譽證書 🏆', W / 2, 126);

        ctx.fillStyle = '#0369A1'; ctx.font = '700 24px "Noto Sans TC", sans-serif';
        ctx.fillText('香港小學二年級四季科學與本土動植物探索挑戰', W / 2, 174);

        const cls = (clsInput.value || '2A').trim();
        const stu = (nameInput.value || '小探險家').trim();
        ctx.fillStyle = '#0F172A'; ctx.font = '900 46px "Noto Sans TC", sans-serif';
        ctx.fillText(`${cls} 班　${stu} 同學`, W / 2, 260);

        // 繪製四枚已解鎖寶可夢風格榮譽徽章圖示列
        const badges = [
            { x: 240, col: '#DB2777', lbl: '🌺 紫荊大獎章' },
            { x: 395, col: '#0284C7', lbl: '🐢 綠龜大獎章' },
            { x: 565, col: '#EA580C', lbl: '🦩 琵鷺大獎章' },
            { x: 720, col: '#4F46E5', lbl: '🦔 穿山甲大獎章' }
        ];
        badges.forEach(b => {
            ctx.beginPath(); ctx.arc(b.x, 345, 34, 0, Math.PI * 2);
            ctx.fillStyle = b.col; ctx.fill();
            ctx.lineWidth = 4; ctx.strokeStyle = '#FACC15'; ctx.stroke();
            ctx.fillStyle = '#1E293B'; ctx.font = '900 18px "Noto Sans TC", sans-serif';
            ctx.fillText(b.lbl, b.x, 402);
        });

        ctx.fillStyle = '#334155'; ctx.font = '700 25px "Noto Sans TC", sans-serif';
        ctx.fillText('成功完成四季山河任務並與香港珍貴動植物完成互動，集齊全部四大獎章！', W / 2, 468);

        const today = new Date().toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' });
        ctx.fillStyle = '#64748B'; ctx.font = '700 21px "Noto Sans TC", sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(`頒發日期：${today}`, 100, 545);
    }

    function openCertModal() {
        state.paused = true;
        AudioSys.playBadgeUnlock();
        drawCert();
        certModal.style.display = 'flex';
        SpeechSys.speakSingle('太厲害喇！恭喜你集齊春夏秋冬全部四枚香港生態大獎章，輸入班別同姓名就可以下載證書圖片喇！');
    }

    clsInput.addEventListener('input', drawCert);
    nameInput.addEventListener('input', drawCert);
    document.getElementById('cert-open-btn').addEventListener('click', openCertModal);
    document.getElementById('cert-continue-btn').addEventListener('click', () => { certModal.style.display = 'none'; state.paused = false; });
    document.getElementById('download-cert-btn').addEventListener('click', () => {
        drawCert();
        const a = document.createElement('a');
        a.download = `四季生態大獎章證書_${(nameInput.value || '小探險家').trim()}.png`;
        a.href = certCanvas.toDataURL('image/png');
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    });

    document.getElementById('quality-btn').addEventListener('click', e => {
        state.highQuality = !state.highQuality;
        World.setHighQuality(state.highQuality);
        e.currentTarget.textContent = state.highQuality ? '✨ 畫質' : '⚡ 流暢';
    });
    document.getElementById('sound-btn').addEventListener('click', e => {
        AudioSys.enabled = !AudioSys.enabled;
        e.currentTarget.textContent = AudioSys.enabled ? '🔊' : '🔇';
    });
    document.getElementById('start-game-btn').addEventListener('click', () => {
        AudioSys.init(); SpeechSys.unlock(); AudioSys.playGem();
        document.getElementById('start-overlay').style.display = 'none';
        state.started = true;
        refreshBadgeCaseUI();
    });

    /* ── 7. 主物理、登山力學、香港動植物互動與 3D 箭嘴導航循環 ── */
    const clock = new THREE.Clock();
    const targetSky = new THREE.Color(SEASON_META.plaza.sky);
    const targetFog = new THREE.Color(SEASON_META.plaza.fog);
    let targetFogD  = SEASON_META.plaza.fogD;
    let targetSunI  = SEASON_META.plaza.sun;
    let targetHemiI = SEASON_META.plaza.hemi;

    document.addEventListener('visibilitychange', () => { if (!document.hidden) clock.getDelta(); });
    function damp(curr, target, lambda, dt) { return THREE.MathUtils.lerp(curr, target, 1 - Math.exp(-lambda * dt)); }

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

        World.riverFlowTex.offset.y -= dt * 0.45;
        World.fanBlades.rotation.z += dt * 22.0;
        World.updateEcologyAnim(elapsed);

        const curWeather = getCurrentZoneWeather(state.currentZone);
        const windX = curWeather ? curWeather.windX : 0.8;
        World.weatherVane.rotation.y += dt * (1.8 + Math.abs(windX) * 0.6);

        for (let i = 0; i < World.swayTrees.length; i++) {
            const tr = World.swayTrees[i];
            tr.rotation.z = Math.sin(elapsed * 2.1 + tr.userData.phase) * 0.03;
        }

        if (state.started && !state.paused) {
            if (state.speedBoostTimer > 0) state.speedBoostTimer -= dt;
            if (state.guardianHintCooldown > 0) state.guardianHintCooldown -= dt;

            // 1. 舒適節奏天氣自動變化（每 95 秒才轉變一次，不打斷探索！）
            state.weatherTimer -= dt;
            if (state.weatherTimer <= 0) {
                advanceWeather(false);
            }

            if (curWeather && curWeather.lightning) {
                state.lightningCooldown -= dt;
                if (state.lightningCooldown <= 0) {
                    state.lightningCooldown = 5.5 + Math.random() * 6.0;
                    flashEl.style.opacity = '0.68';
                    setTimeout(() => { flashEl.style.opacity = '0'; }, 100);
                    AudioSys.playWeatherSFX('storm');
                }
            }

            // 2. 讀取輸入與登山運動物理（上山輕鬆順暢不倒退！）
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

            const hasBoost = state.speedBoostTimer > 0;
            const wantsSprint = (hasBoost || input.sprintPid !== null || input.sprintKey) && normMag > 0.15 && state.stamina > 3 && !state.inWater;
            if (wantsSprint && !hasBoost) state.stamina = Math.max(0, state.stamina - PHYSICS.STAMINA_DRAIN * dt);
            else state.stamina = Math.min(100, state.stamina + PHYSICS.STAMINA_REGEN * dt);
            staminaFillEl.style.width = `${state.stamina}%`;

            const prevX = World.player.position.x, prevZ = World.player.position.z;
            const grad = World.getTerrainGradient(prevX, prevZ);
            const bridgeNow = World.getBridgeDeckHeight(prevX, prevZ);

            const accel = state.isGrounded ? PHYSICS.ACCEL_GROUND : PHYSICS.ACCEL_AIR;
            if (normMag > 0.04) {
                state.vx += wishX * accel * dt;
                state.vz += wishZ * accel * dt;
            }

            // 涉水與地面摩擦
            const rvNow = World.getRiverInfo(prevX, prevZ);
            state.inWater = (!bridgeNow && World.player.position.y < PHYSICS.WATER_LEVEL - 0.05 && rvNow.mask > 0.25);
            if (state.inWater) {
                state.vx += rvNow.flowX * PHYSICS.RIVER_FLOW_SPEED * dt;
                state.vz += rvNow.flowZ * PHYSICS.RIVER_FLOW_SPEED * dt;
                const wd = Math.exp(-PHYSICS.WATER_DRAG * dt);
                state.vx *= wd; state.vz *= wd;
                state.splashCooldown -= dt;
                if (Math.hypot(state.vx, state.vz) > 1.2 && state.splashCooldown <= 0) {
                    state.splashCooldown = 0.48; AudioSys.playSplash();
                }
            } else {
                const surfKey = bridgeNow ? 'bridge' : state.currentZone;
                const friction = state.isGrounded ? PHYSICS.SURFACE_FRICTION[surfKey] : 1.4;
                const damping = Math.exp(-friction * dt);
                if (normMag <= 0.04 || state.currentZone === 'winter') {
                    state.vx *= damping; state.vz *= damping;
                }
            }

            // 上坡自然微調極速（上大斜坡約 88% 速度，真實且保證輕鬆登頂！）
            const uphillDot = wishX * grad.gx + wishZ * grad.gz;
            const slopeSpeedFactor = uphillDot > 0 ? Math.max(0.84, 1 - uphillDot * 0.22) : 1.04;
            const baseMax = hasBoost ? PHYSICS.SPRINT_SPEED * 1.15 : (wantsSprint ? PHYSICS.SPRINT_SPEED : PHYSICS.WALK_SPEED);
            const speedCap = (state.inWater ? PHYSICS.WALK_SPEED * 0.6 : baseMax * slopeSpeedFactor) * Math.max(0.35, normMag || 1);
            const hSpd = Math.hypot(state.vx, state.vz);
            if (normMag > 0.04 && hSpd > speedCap) {
                state.vx = (state.vx / hSpd) * speedCap;
                state.vz = (state.vz / hSpd) * speedCap;
            }

            const candX = prevX + state.vx * dt, candZ = prevZ + state.vz * dt;
            const solved = World.resolveHorizontalWorld(candX, candZ, World.player.position.y, PHYSICS.PLAYER_RADIUS, prevX, prevZ);
            World.player.position.x = solved.x;
            World.player.position.z = solved.z;

            // 垂直貼地與跳躍（上下山坡緊貼地面不浮空）
            const terrainY = World.getTerrainHeight(solved.x, solved.z);
            const bridgeAfter = World.getBridgeDeckHeight(solved.x, solved.z);
            const supportY = bridgeAfter ? Math.max(terrainY, bridgeAfter.y) : terrainY;
            state.onBridge = !!(bridgeAfter && bridgeAfter.y >= terrainY - 0.05 && World.player.position.y >= bridgeAfter.y - 0.6);

            const wasGrounded = state.isGrounded;
            state.vy += PHYSICS.GRAVITY * dt;
            World.player.position.y += state.vy * dt;

            const snapTol = wasGrounded && state.vy <= 0 ? 0.52 : 0.1;
            if (World.player.position.y <= supportY + snapTol && state.vy <= 0) {
                World.player.position.y = supportY;
                state.vy = 0;
                state.isGrounded = true;
            } else if (World.player.position.y < supportY) {
                World.player.position.y = supportY;
                state.vy = 0;
                state.isGrounded = true;
            }

            // 陰影與涉水漣漪
            const airH = Math.max(0, World.player.position.y - supportY);
            const shF = Math.max(0.35, 1.0 - airH * 0.2);
            World.playerShadow.position.set(solved.x, supportY + 0.05, solved.z);
            World.playerShadow.scale.set(2.35 * shF, 1, 2.35 * shF);

            if (state.inWater) {
                World.waterRipple.position.set(solved.x, PHYSICS.WATER_LEVEL + 0.03, solved.z);
                const rs = 0.85 + (elapsed * 1.8 % 1) * 0.85;
                World.waterRipple.scale.setScalar(rs);
                World.waterRipple.material.opacity = (1 - (elapsed * 1.8 % 1)) * 0.65;
            } else {
                World.waterRipple.material.opacity = 0;
            }

            // 3. 3D 金色導航箭嘴（完成該季 2 個任務點後，指向該季香港特色動植物！）
            const arrowTarget = getActiveArrowTarget();
            if (arrowTarget) {
                World.guideArrow.visible = true;
                World.guideArrow.position.set(solved.x, World.player.position.y + 4.3 + Math.sin(elapsed * 5.0) * 0.25, solved.z);
                const angToTarget = Math.atan2(arrowTarget.x - solved.x, arrowTarget.z - solved.z);
                World.guideArrow.rotation.y = angToTarget;
            } else {
                World.guideArrow.visible = false;
            }

            // 4. 角色動畫
            const moveVel = Math.hypot(state.vx, state.vz);
            if (normMag > 0.06) {
                const tAng = Math.atan2(wishX, wishZ);
                let dA = tAng - World.player.rotation.y;
                while (dA < -Math.PI) dA += Math.PI * 2;
                while (dA >  Math.PI) dA -= Math.PI * 2;
                World.player.rotation.y += dA * (1 - Math.exp(-14 * dt));
            }
            const holdPitch = World.getActiveProp() === 'umbrella' ? -0.95 : -0.7;
            if (state.isGrounded && moveVel > 0.55) {
                state.walkCycle += dt * moveVel * 1.15;
                const sw = Math.sin(state.walkCycle) * 0.66;
                World.leftLeg.rotation.x = sw; World.rightLeg.rotation.x = -sw;
                World.leftArm.rotation.x = -sw * 0.85; World.rightArm.rotation.x = holdPitch + sw * 0.18;
                World.playerVisual.position.y = Math.abs(Math.sin(state.walkCycle)) * 0.13;
            } else {
                World.leftLeg.rotation.x = damp(World.leftLeg.rotation.x, 0, 12, dt);
                World.rightLeg.rotation.x = damp(World.rightLeg.rotation.x, 0, 12, dt);
                World.leftArm.rotation.x = damp(World.leftArm.rotation.x, 0, 12, dt);
                World.rightArm.rotation.x = damp(World.rightArm.rotation.x, holdPitch, 12, dt);
                World.playerVisual.position.y = 0;
            }

            // 5. 區域與 HUD 更新
            const nz = detectZone(solved.x, solved.z);
            if (nz !== state.currentZone) {
                state.currentZone = nz;
                const m = SEASON_META[nz];
                seasonBadgeEl.textContent = m.name;
                seasonBadgeEl.style.background = m.tagBg;
                seasonBadgeEl.style.color = m.tagColor;
                zoneShortEl.textContent = m.short;
            }
            const aw = getCurrentZoneWeather(state.currentZone);
            if (aw) {
                weatherBadgeEl.textContent = `${aw.icon} ${aw.name}`;
                targetSky.setHex(aw.sky); targetFog.setHex(aw.fog);
                targetFogD = aw.fogD; targetSunI = aw.sun; targetHemiI = aw.hemi;
            } else {
                const pm = SEASON_META.plaza;
                weatherBadgeEl.textContent = '🌤️ 舒適微風';
                targetSky.setHex(pm.sky); targetFog.setHex(pm.fog);
                targetFogD = pm.fogD; targetSunI = pm.sun; targetHemiI = pm.hemi;
            }
            const surfLbl = state.onBridge ? '🌉 木拱橋' : (state.inWater ? '🌊 河道涉水' : SEASON_META[state.currentZone].surface);
            physBadgeEl.textContent = `📐 海拔 ${World.player.position.y.toFixed(1)}m｜${surfLbl}`;

            // 6. 檢測每季 2 個固定任務點觸發
            for (let i = 0; i < World.missionNodes.length; i++) {
                const mn = World.missionNodes[i];
                mn.crystal.rotation.y += dt * 1.8;
                mn.orbit.rotation.z += dt * 2.2;
                mn.crystal.position.y = 2.3 + Math.sin(elapsed * 3.0 + i) * 0.25;
                if (!mn.done) {
                    const d = Math.hypot(solved.x - mn.x, solved.z - mn.z);
                    if (d < 2.8 && Math.abs(World.player.position.y - mn.baseY) < 3.0 && !state.paused) {
                        openMissionQuiz(mn);
                        break;
                    }
                }
            }

            // 7. 檢測 4 大香港守護動植物互動（完成該季 2 個任務點後觸發大獎章互動！）
            if (!state.paused) {
                ['spring', 'summer', 'autumn', 'winter'].forEach(s => {
                    const gNode = World.guardianNodes[s];
                    const gd = gNode.data;
                    const prog = state.seasonProgress[s];
                    const d = Math.hypot(solved.x - gd.x, solved.z - gd.z);
                    if (d < 3.4) {
                        if (prog.mDone[0] && prog.mDone[1] && !prog.grandBadge) {
                            openGuardianQuiz(gNode);
                        } else if (!prog.grandBadge && state.guardianHintCooldown <= 0) {
                            state.guardianHintCooldown = 8.0;
                            showToast('🧭', gd.name, `請先完成本區 2 個任務台（① 及 ② 山頂），再回來領取【${gd.badgeName}】！`, 4800);
                            SpeechSys.speakSingle(`${gd.intro} 請先完成呢一區兩個任務台，再返嚟搵我領取大獎章啦！`);
                        }
                    }
                });
            }

            // 8. 檢測 8 個額外香港本土動植物趣味生態導賞
            for (let i = 0; i < World.ambientNodes.length; i++) {
                const an = World.ambientNodes[i];
                if (an.cooldown > 0) an.cooldown -= dt;
                const d = Math.hypot(solved.x - an.data.x, solved.z - an.data.z);
                if (d < 3.6 && an.cooldown <= 0 && !state.paused) {
                    an.cooldown = 26.0;
                    AudioSys.playWeatherSFX('birds');
                    showToast(an.data.icon, `香港生態發現：${an.data.name}`, an.data.fact, 5600);
                    SpeechSys.speakSingle(`發現香港特色物種：${an.data.name}！${an.data.fact}`);
                }
            }

            // 9. 小猴子巡邏
            for (let i = 0; i < World.monkeys.length; i++) {
                const mk = World.monkeys[i];
                if (mk.cooldown > 0) mk.cooldown -= dt;
                const dxP = mk.mesh.position.x - solved.x, dzP = mk.mesh.position.z - solved.z;
                const distP = Math.hypot(dxP, dzP);
                let mSpd = distP < 10 && mk.cooldown <= 0 ? 7.8 : 4.2;
                if (distP < 10 && mk.cooldown <= 0) mk.dirAngle = Math.atan2(dxP, dzP);
                else {
                    mk.changeTimer -= dt;
                    if (mk.changeTimer <= 0) { mk.dirAngle = Math.random() * Math.PI * 2; mk.changeTimer = 2.0; }
                }
                let mx = THREE.MathUtils.clamp(mk.mesh.position.x + Math.sin(mk.dirAngle) * mSpd * dt, mk.zone.xMin, mk.zone.xMax);
                let mz = THREE.MathUtils.clamp(mk.mesh.position.z + Math.cos(mk.dirAngle) * mSpd * dt, mk.zone.zMin, mk.zone.zMax);
                if (World.getRiverInfo(mx, mz).dist < PHYSICS.RIVER_HALF_W + 1.6) {
                    mk.dirAngle += 2.2; mx = mk.mesh.position.x; mz = mk.mesh.position.z;
                }
                const mSol = World.resolveHorizontalWorld(mx, mz, mk.mesh.position.y, PHYSICS.MONKEY_RADIUS, mk.mesh.position.x, mk.mesh.position.z);
                const mGy = World.getTerrainHeight(mSol.x, mSol.z);
                const hop = Math.abs(Math.sin(elapsed * 8.2 + mk.hopPhase)) * 0.5;
                mk.mesh.position.set(mSol.x, mGy + hop, mSol.z);
                mk.mesh.rotation.y = mk.dirAngle;
                mk.shadow.position.set(mSol.x, mGy + 0.05, mSol.z);

                if (distP < 2.2 && mk.cooldown <= 0 && !state.paused) {
                    mk.cooldown = 14.0;
                    openMonkeyQuiz(mk);
                    break;
                }
            }

            // 10. 天氣粒子運動
            if (aw && World.P_MODES[aw.pMode]) {
                const cfg = World.P_MODES[aw.pMode];
                World.weatherPoints.visible = true;
                World.weatherPoints.material.color.setHex(cfg.color);
                World.weatherPoints.material.size = cfg.size;
                World.weatherPoints.material.opacity = cfg.op;
                const posAttr = World.weatherPoints.geometry.attributes.position;
                const arr = posAttr.array;
                for (let i = 0; i < World.PARTICLE_COUNT; i++) {
                    const fl = cfg.flutter > 0 ? Math.sin(elapsed * 2.6 + World.pSeeds[i]) * cfg.flutter : 0;
                    arr[i * 3]     += (aw.windX + fl) * dt;
                    arr[i * 3 + 1] -= cfg.fall * dt;
                    if (arr[i * 3 + 1] < World.player.position.y - 2) {
                        arr[i * 3]     = World.player.position.x + (Math.random() - 0.5) * 110;
                        arr[i * 3 + 1] = World.player.position.y + 28 + Math.random() * 10;
                        arr[i * 3 + 2] = World.player.position.z + (Math.random() - 0.5) * 110;
                    }
                }
                posAttr.needsUpdate = true;
            } else {
                World.weatherPoints.visible = false;
            }
        }

        // 11. 廣角遠景第三人稱鏡頭與右上小地圖渲染
        const envF = 1 - Math.exp(-3.0 * dt);
        World.scene.background.lerp(targetSky, envF);
        World.scene.fog.color.lerp(targetFog, envF);
        World.scene.fog.density = damp(World.scene.fog.density, targetFogD, 2.8, dt);
        World.sunLight.intensity  = damp(World.sunLight.intensity, targetSunI, 3.0, dt);
        World.hemiLight.intensity = damp(World.hemiLight.intensity, targetHemiI, 3.0, dt);

        const hDist = state.camDist * Math.cos(state.camPitch);
        const vDist = state.camDist * Math.sin(state.camPitch) + 3.2;
        const desX = World.player.position.x + Math.sin(state.camYaw) * hDist;
        const desZ = World.player.position.z + Math.cos(state.camYaw) * hDist;
        const camGroundMin = World.getTerrainHeight(THREE.MathUtils.clamp(desX, -95, 95), THREE.MathUtils.clamp(desZ, -95, 95)) + 2.5;
        const desY = Math.max(camGroundMin, World.player.position.y + vDist);

        World.camera.position.x = damp(World.camera.position.x, desX, 10.0, dt);
        World.camera.position.y = damp(World.camera.position.y, desY,  9.0, dt);
        World.camera.position.z = damp(World.camera.position.z, desZ, 10.0, dt);
        World.camera.lookAt(World.player.position.x, World.player.position.y + 2.0, World.player.position.z);

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

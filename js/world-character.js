/* =========================================================================
   四季小探險家 3D — Switch 級別山河拱橋 3D 地形、高對比精細主角與手提物品建模
   ========================================================================= */
(() => {
    'use strict';

    const { PHYSICS, SEASON_META } = GameApp;

    const canvas = document.getElementById('game-canvas');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SEASON_META.plaza.sky);
    scene.fog = new THREE.FogExp2(SEASON_META.plaza.fog, SEASON_META.plaza.fogD);

    const camera = new THREE.PerspectiveCamera(47, window.innerWidth / window.innerHeight, 0.3, 310);

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

    /* ── 1. Blender 工作室 PMREM 環境反射貼圖 (IBL) 與清漆 PBR 工廠 ── */
    try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const envScene = new THREE.Scene();
        const c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        const g = c.getContext('2d');
        const grd = g.createLinearGradient(0, 0, 0, 128);
        grd.addColorStop(0.0, '#0EA5E9');
        grd.addColorStop(0.46, '#E0F2FE');
        grd.addColorStop(0.54, '#FEF9C3');
        grd.addColorStop(1.0, '#4ADE80');
        g.fillStyle = grd;
        g.fillRect(0, 0, 128, 128);
        g.fillStyle = '#FFFFFF';
        g.beginPath(); g.arc(64, 24, 16, 0, Math.PI * 2); g.fill();
        const envTex = new THREE.CanvasTexture(c);
        envTex.encoding = THREE.sRGBEncoding;
        const domeGeo = new THREE.SphereGeometry(40, 20, 14);
        envScene.add(new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ map: envTex, side: THREE.BackSide })));
        scene.environment = pmrem.fromScene(envScene, 0.04).texture;
        domeGeo.dispose(); envTex.dispose(); pmrem.dispose();
    } catch (e) { /* WebGL1 fallback */ }

    function toyMat(color, roughness = 0.38, clearcoat = 0.35, metalness = 0.04) {
        return new THREE.MeshPhysicalMaterial({
            color,
            roughness,
            metalness,
            clearcoat,
            clearcoatRoughness: 0.22
        });
    }

    function createGlowTex(innerRgba, outerRgba) {
        const c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        const g = c.getContext('2d');
        const r = g.createRadialGradient(64, 64, 5, 64, 64, 64);
        r.addColorStop(0, '#FFFFFF');
        r.addColorStop(0.3, innerRgba);
        r.addColorStop(1, outerRgba);
        g.fillStyle = r;
        g.fillRect(0, 0, 128, 128);
        const t = new THREE.CanvasTexture(c);
        t.encoding = THREE.sRGBEncoding;
        return t;
    }

    /* ── 2. 三點式 Switch 燈光與太陽 ── */
    const hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0x64748B, 0.88);
    hemiLight.position.set(0, 65, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xFFFBEB, 1.2);
    sunLight.position.set(58, 86, 46);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 230;
    const sExt = 86;
    sunLight.shadow.camera.left = -sExt;
    sunLight.shadow.camera.right = sExt;
    sunLight.shadow.camera.top = sExt;
    sunLight.shadow.camera.bottom = -sExt;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xBAE6FD, 0.42);
    rimLight.position.set(-50, 38, -50);
    scene.add(rimLight);

    const sunOrb = new THREE.Group();
    sunOrb.position.set(72, 92, -72);
    sunOrb.add(new THREE.Mesh(new THREE.SphereGeometry(6.8, 20, 20), new THREE.MeshBasicMaterial({ color: 0xFEF08A, fog: false })));
    const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: createGlowTex('rgba(253,224,71,0.85)', 'rgba(253,224,71,0)'),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    sunHalo.scale.set(38, 38, 1);
    sunOrb.add(sunHalo);
    scene.add(sunOrb);

    /* ── 3. 數學統一地形高度場：高山、丘陵、蜿蜒十字河流與 4 座木拱橋 ── */
    function smoothstep(e0, e1, x) {
        const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
        return t * t * (3 - 2 * t);
    }

    // 河流中心線蜿蜒函數
    function riverCenterX(z) { return Math.sin(z * 0.08) * 3.0; }
    function riverCenterZ(x) { return Math.sin(x * 0.08) * 3.0; }

    // 四大園區巍峨高山與可攀爬丘陵定義
    const MOUNTAIN_PEAKS = [
        // 外圍高山群（高 15m–25m，山腳可走、陡壁物理阻擋）
        { x: -80, z: -80, h: 21.5, sigma: 13.5, season: 'spring', high: true },
        { x: -84, z: -55, h: 15.0, sigma: 10.5, season: 'spring', high: true },
        { x: -55, z: -84, h: 14.5, sigma: 10.5, season: 'spring', high: true },

        { x:  80, z: -80, h: 20.5, sigma: 13.5, season: 'summer', high: true },
        { x:  84, z: -55, h: 14.5, sigma: 10.5, season: 'summer', high: true },
        { x:  55, z: -84, h: 14.0, sigma: 10.5, season: 'summer', high: true },

        { x: -80, z:  80, h: 22.5, sigma: 13.5, season: 'autumn', high: true },
        { x: -84, z:  55, h: 15.5, sigma: 10.5, season: 'autumn', high: true },
        { x: -55, z:  84, h: 15.0, sigma: 10.5, season: 'autumn', high: true },

        { x:  80, z:  80, h: 25.5, sigma: 14.2, season: 'winter', high: true }, // 香港大帽山結霜意象高峰
        { x:  84, z:  55, h: 17.5, sigma: 10.8, season: 'winter', high: true },
        { x:  55, z:  84, h: 16.5, sigma: 10.8, season: 'winter', high: true },

        // 園區內平緩可攀爬觀景小山丘（高 2.8m–3.8m，坡度 < 22°）
        { x: -64, z: -29, h: 3.4, sigma: 9.5, season: 'spring', high: false },
        { x: -29, z: -64, h: 3.2, sigma: 9.5, season: 'spring', high: false },
        { x:  64, z: -29, h: 3.0, sigma: 9.5, season: 'summer', high: false },
        { x:  29, z: -64, h: 3.2, sigma: 9.5, season: 'summer', high: false },
        { x: -64, z:  29, h: 3.6, sigma: 9.5, season: 'autumn', high: false },
        { x: -29, z:  64, h: 3.4, sigma: 9.5, season: 'autumn', high: false },
        { x:  64, z:  29, h: 3.8, sigma: 9.5, season: 'winter', high: false },
        { x:  29, z:  64, h: 3.5, sigma: 9.5, season: 'winter', high: false }
    ];

    // 5 座核心建築地標平坦台地座標（供地形整平與右上小地圖顯示）
    const LANDMARKS = [
        { id: 'hub',    name: '氣象科學台', x:   0, z:   0, flatR: 19.5, color: '#FEF08A' },
        { id: 'spring', name: '春花溫室',   x: -43, z: -43, flatR:  9.5, color: '#F472B6' },
        { id: 'summer', name: '陽光瞭望塔', x:  43, z: -43, flatR:  9.5, color: '#38BDF8' },
        { id: 'autumn', name: '紅葉穀倉',   x: -43, z:  43, flatR:  9.5, color: '#FB923C' },
        { id: 'winter', name: '冰雪圓頂屋', x:  43, z:  43, flatR:  9.5, color: '#A5B4FC' }
    ];

    // 4 座跨越四季河流的精緻木製拱橋
    const BRIDGES = [
        { id: 'north', axis: 'x', x: riverCenterX(-50), z: -50, halfLen: 6.0, halfWid: 2.35, archH: 1.32 },
        { id: 'south', axis: 'x', x: riverCenterX( 50), z:  50, halfLen: 6.0, halfWid: 2.35, archH: 1.32 },
        { id: 'west',  axis: 'z', x: -50, z: riverCenterZ(-50), halfLen: 6.0, halfWid: 2.35, archH: 1.32 },
        { id: 'east',  axis: 'z', x:  50, z: riverCenterZ( 50), halfLen: 6.0, halfWid: 2.35, archH: 1.32 }
    ];

    function getRiverInfo(x, z) {
        const r = Math.hypot(x, z);
        const mask = smoothstep(21.5, 27.0, r);
        if (mask <= 0.001) return { inRiver: false, dist: 99, mask: 0, flowX: 0, flowZ: 0 };

        let dNS = 99, dWE = 99;
        if (Math.abs(z) > 20) dNS = Math.abs(x - riverCenterX(z));
        if (Math.abs(x) > 20) dWE = Math.abs(z - riverCenterZ(x));

        if (dNS < dWE) {
            return {
                inRiver: dNS < PHYSICS.RIVER_HALF_W,
                dist: dNS,
                mask,
                flowX: 0,
                flowZ: z < 0 ? -1 : 1
            };
        }
        return {
            inRiver: dWE < PHYSICS.RIVER_HALF_W,
            dist: dWE,
            mask,
            flowX: x < 0 ? -1 : 1,
            flowZ: 0
        };
    }

    function getTerrainHeight(x, z) {
        const r = Math.hypot(x, z);
        // 基礎微起伏地面 (0.24m)
        let h = 0.24 + (Math.sin(x * 0.09) * Math.cos(z * 0.09)) * 0.14 * smoothstep(20, 32, r);

        // 疊加高山與丘陵高斯曲面
        for (let i = 0; i < MOUNTAIN_PEAKS.length; i++) {
            const m = MOUNTAIN_PEAKS[i];
            const dx = x - m.x, dz = z - m.z;
            const d2 = dx * dx + dz * dz;
            if (d2 < m.sigma * m.sigma * 6.5) {
                h += m.h * Math.exp(-d2 / (2 * m.sigma * m.sigma));
            }
        }

        // 地標建築周圍平滑整平為穩固台地
        for (let i = 0; i < LANDMARKS.length; i++) {
            const lm = LANDMARKS[i];
            const d = Math.hypot(x - lm.x, z - lm.z);
            if (d < lm.flatR + 4.5) {
                const flatFactor = 1 - smoothstep(lm.flatR - 1.5, lm.flatR + 4.5, d);
                h = THREE.MathUtils.lerp(h, 0.26, flatFactor);
            }
        }

        // 雕刻蜿蜒十字河床（河底約 -1.16m，水面 -0.32m，最大水深約 0.84m 安全涉水深度）
        const rv = getRiverInfo(x, z);
        if (rv.dist < PHYSICS.RIVER_HALF_W + 1.4 && rv.mask > 0.01) {
            const t = THREE.MathUtils.clamp(rv.dist / (PHYSICS.RIVER_HALF_W + 0.8), 0, 1);
            const carve = (1 - t * t) * 1.42 * rv.mask;
            h -= carve;
        }

        return h;
    }

    function getTerrainGradient(x, z) {
        const eps = 0.45;
        const gx = (getTerrainHeight(x + eps, z) - getTerrainHeight(x - eps, z)) / (2 * eps);
        const gz = (getTerrainHeight(x, z + eps) - getTerrainHeight(x, z - eps)) / (2 * eps);
        return { gx, gz, slope: Math.hypot(gx, gz) };
    }

    // 計算拱橋橋面高度（無縫銜接兩岸陸地高度）
    BRIDGES.forEach(b => {
        const endA = b.axis === 'x' ? getTerrainHeight(b.x - b.halfLen, b.z) : getTerrainHeight(b.x, b.z - b.halfLen);
        const endB = b.axis === 'x' ? getTerrainHeight(b.x + b.halfLen, b.z) : getTerrainHeight(b.x, b.z + b.halfLen);
        b.baseEndA = endA;
        b.baseEndB = endB;
    });

    function getBridgeDeckHeight(x, z) {
        for (let i = 0; i < BRIDGES.length; i++) {
            const b = BRIDGES[i];
            const span = b.axis === 'x' ? (x - b.x) : (z - b.z);
            const lat  = b.axis === 'x' ? (z - b.z) : (x - b.x);
            if (Math.abs(span) <= b.halfLen && Math.abs(lat) <= b.halfWid) {
                const u = span / b.halfLen; // -1 .. +1
                const baseY = THREE.MathUtils.lerp(b.baseEndA, b.baseEndB, (u + 1) * 0.5);
                const arch = Math.cos(u * Math.PI * 0.5) * b.archH;
                return { y: baseY + arch, bridge: b };
            }
        }
        return null;
    }

    /* ── 4. 建立高精度頂點著色連續 3D 山河地形網格 + 法線凹凸細節 ── */
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // 外圍蔚藍環島海洋
    const oceanGeo = new THREE.CircleGeometry(260, 48);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMesh = new THREE.Mesh(oceanGeo, new THREE.MeshPhysicalMaterial({
        color: 0x0284C7, roughness: 0.16, clearcoat: 0.9, clearcoatRoughness: 0.14
    }));
    oceanMesh.position.y = -0.68;
    worldGroup.add(oceanMesh);

    // 細緻地面程序化凹凸紋理 (Detail Bump Map)
    const detailBumpTex = (() => {
        const c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        const g = c.getContext('2d');
        g.fillStyle = '#808080';
        g.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 650; i++) {
            g.fillStyle = i % 2 ? '#A8A8A8' : '#5E5E5E';
            g.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
        }
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(44, 44);
        t.anisotropy = maxAniso;
        return t;
    })();

    const SEG = 156;
    const terrainGeo = new THREE.PlaneGeometry(200, 200, SEG, SEG);
    terrainGeo.rotateX(-Math.PI / 2);
    const posArr = terrainGeo.attributes.position.array;
    const colArr = new Float32Array(posArr.length);
    const tmpCol = new THREE.Color();

    for (let i = 0; i < posArr.length; i += 3) {
        const vx = posArr[i];
        const vz = posArr[i + 2];
        const vy = getTerrainHeight(vx, vz);
        posArr[i + 1] = vy;

        const r = Math.hypot(vx, vz);
        const rv = getRiverInfo(vx, vz);

        if (r < 20.8) {
            // 中央石磚科學廣場（格紋微色差）
            const checker = ((Math.floor(vx * 0.5) + Math.floor(vz * 0.5)) & 1) ? 0xE7E5E4 : 0xF5F5F4;
            tmpCol.setHex(r > 19.2 ? 0xFACC15 : checker);
        } else if (vy < -0.18 && rv.mask > 0.2) {
            // 清澈河床鵝卵石與細沙
            tmpCol.setHex(vy < -0.65 ? 0x0EA5E9 : 0xFDE68A);
        } else if (rv.dist < PHYSICS.RIVER_HALF_W + 1.3 && rv.mask > 0.2) {
            // 河岸濕潤卵石沙岸
            tmpCol.setHex(0xFEF08A);
        } else {
            // 四季地貌與高山海拔分層色彩（Switch 鮮明飽和色調）
            if (vx < 0 && vz < 0) {
                // 春季：翠綠草地 -> 山腰嫩綠 -> 高山粉櫻花冠
                if (vy > 11.5) tmpCol.setHex(0xF9A8D4);
                else if (vy > 5.0) tmpCol.setHex(0x86EFAC);
                else tmpCol.setHex(0x22C55E);
            } else if (vx >= 0 && vz < 0) {
                // 夏季：金黃海岸沙灘 -> 翠綠椰林山腰 -> 火山玄武岩山頂
                if (vy > 11.0) tmpCol.setHex(0x78716C);
                else if (vy > 3.2) tmpCol.setHex(0x65A30D);
                else tmpCol.setHex(0xFBBF24);
            } else if (vx < 0 && vz >= 0) {
                // 秋季：琥珀落葉地 -> 楓紅山腰 -> 金紅岩峰
                if (vy > 12.0) tmpCol.setHex(0xDC2626);
                else if (vy > 4.2) tmpCol.setHex(0xEA580C);
                else tmpCol.setHex(0xD97706);
            } else {
                // 冬季：銀白雪原 -> 冰藍岩坡 -> 純白大帽山霜雪頂
                if (vy > 10.0) tmpCol.setHex(0xFFFFFF);
                else if (vy > 3.8) tmpCol.setHex(0xCBD5E1);
                else tmpCol.setHex(0xF1F5F9);
            }
        }
        colArr[i]     = tmpCol.r;
        colArr[i + 1] = tmpCol.g;
        colArr[i + 2] = tmpCol.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    terrainGeo.computeVertexNormals();

    const terrainMesh = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({
        vertexColors: true,
        bumpMap: detailBumpTex,
        bumpScale: 0.05,
        roughness: 0.78,
        metalness: 0.02
    }));
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    worldGroup.add(terrainMesh);

    /* ── 5. 清澈流動十字河流網格 + 動態波光紋理 + 4 座立體木拱橋 ── */
    const riverFlowTex = (() => {
        const c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        const g = c.getContext('2d');
        g.fillStyle = '#06B6D4';
        g.fillRect(0, 0, 128, 128);
        g.strokeStyle = 'rgba(255,255,255,0.55)';
        g.lineWidth = 3;
        for (let y = 8; y < 128; y += 24) {
            g.beginPath();
            g.moveTo(0, y);
            g.bezierCurveTo(42, y - 6, 86, y + 6, 128, y);
            g.stroke();
        }
        const t = new THREE.CanvasTexture(c);
        t.encoding = THREE.sRGBEncoding;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(3, 18);
        return t;
    })();

    const riverWaterMat = new THREE.MeshPhysicalMaterial({
        map: riverFlowTex,
        color: 0x22D3EE,
        roughness: 0.06,
        metalness: 0.05,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.84
    });

    function buildRiverRibbon(isNS, sign) {
        const segLen = 56;
        const geo = new THREE.PlaneGeometry(PHYSICS.RIVER_HALF_W * 2.05, 76, 8, segLen);
        geo.rotateX(-Math.PI / 2);
        const p = geo.attributes.position.array;
        for (let i = 0; i < p.length; i += 3) {
            const localAcross = p[i];
            const distFromCenter = 22 + ((p[i + 2] + 38) / 76) * 75;
            const coord = sign * distFromCenter;
            if (isNS) {
                p[i]     = riverCenterX(coord) + localAcross;
                p[i + 1] = PHYSICS.WATER_LEVEL;
                p[i + 2] = coord;
            } else {
                p[i]     = coord;
                p[i + 1] = PHYSICS.WATER_LEVEL;
                p[i + 2] = riverCenterZ(coord) + localAcross;
            }
        }
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, riverWaterMat);
        worldGroup.add(mesh);
    }
    buildRiverRibbon(true, -1);
    buildRiverRibbon(true,  1);
    buildRiverRibbon(false, -1);
    buildRiverRibbon(false,  1);

    // 建造 4 座精緻 Switch 風格木拱橋（含橋板、石橋墩、木柱與護欄繩）
    const plankMat = toyMat(0xB45309, 0.55, 0.2);
    const railMat  = toyMat(0x78350F, 0.6, 0.18);
    const pierMat  = toyMat(0x94A3B8, 0.7, 0.1);

    BRIDGES.forEach(b => {
        const bg = new THREE.Group();
        const steps = 15;
        for (let s = 0; s < steps; s++) {
            const u = -1 + (s + 0.5) * (2 / steps);
            const spanPos = u * b.halfLen;
            const baseY = THREE.MathUtils.lerp(b.baseEndA, b.baseEndB, (u + 1) * 0.5);
            const deckY = baseY + Math.cos(u * Math.PI * 0.5) * b.archH;
            const slopeAng = (Math.PI * 0.5 / b.halfLen) * Math.sin(u * Math.PI * 0.5) * b.archH;

            const plank = new THREE.Mesh(
                b.axis === 'x'
                    ? new THREE.BoxGeometry((b.halfLen * 2) / steps * 0.96, 0.22, b.halfWid * 2)
                    : new THREE.BoxGeometry(b.halfWid * 2, 0.22, (b.halfLen * 2) / steps * 0.96),
                plankMat
            );
            if (b.axis === 'x') {
                plank.position.set(b.x + spanPos, deckY - 0.08, b.z);
                plank.rotation.z = -slopeAng;
            } else {
                plank.position.set(b.x, deckY - 0.08, b.z + spanPos);
                plank.rotation.x = slopeAng;
            }
            plank.castShadow = true;
            plank.receiveShadow = true;
            bg.add(plank);

            // 兩側護欄木柱（每 3 格立一對柱）
            if (s % 3 === 1) {
                [-b.halfWid + 0.18, b.halfWid - 0.18].forEach(side => {
                    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.25, 10), railMat);
                    if (b.axis === 'x') post.position.set(b.x + spanPos, deckY + 0.55, b.z + side);
                    else post.position.set(b.x + side, deckY + 0.55, b.z + spanPos);
                    post.castShadow = true;
                    bg.add(post);
                });
            }
        }

        // 拱形扶手橫樑與兩岸石柱橋頭堡
        [-b.halfWid + 0.18, b.halfWid - 0.18].forEach(side => {
            for (let seg = 0; seg < 8; seg++) {
                const u1 = -1 + seg * 0.25, u2 = u1 + 0.25;
                const y1 = THREE.MathUtils.lerp(b.baseEndA, b.baseEndB, (u1 + 1) * 0.5) + Math.cos(u1 * Math.PI * 0.5) * b.archH + 1.05;
                const y2 = THREE.MathUtils.lerp(b.baseEndA, b.baseEndB, (u2 + 1) * 0.5) + Math.cos(u2 * Math.PI * 0.5) * b.archH + 1.05;
                const midU = (u1 + u2) * 0.5;
                const len = Math.hypot(0.25 * b.halfLen, y2 - y1);
                const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, len, 8), toyMat(0xF59E0B, 0.4, 0.3));
                if (b.axis === 'x') {
                    beam.position.set(b.x + midU * b.halfLen, (y1 + y2) * 0.5, b.z + side);
                    beam.rotation.z = Math.PI / 2 + Math.atan2(y2 - y1, 0.25 * b.halfLen);
                } else {
                    beam.position.set(b.x + side, (y1 + y2) * 0.5, b.z + midU * b.halfLen);
                    beam.rotation.x = Math.PI / 2 - Math.atan2(y2 - y1, 0.25 * b.halfLen);
                }
                bg.add(beam);
            }
            [-b.halfLen, b.halfLen].forEach(endSpan => {
                const pier = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.5, 0.75), pierMat);
                if (b.axis === 'x') pier.position.set(b.x + endSpan, 0.45, b.z + side);
                else pier.position.set(b.x + side, 0.45, b.z + endSpan);
                pier.castShadow = true;
                bg.add(pier);
            });
        });
        worldGroup.add(bg);
    });

    /* ── 6. 碰撞盒與物理水平解算（含建築、拱橋護欄、陡峭高山滑牆） ── */
    const colliders = [];
    function addBoxCollider(x, z, rx, rz) {
        colliders.push({ x, z, rx, rz });
    }

    function resolveHorizontalWorld(px, pz, currentY, radius, prevX = px, prevZ = pz) {
        let nx = THREE.MathUtils.clamp(px, -PHYSICS.WORLD_LIMIT, PHYSICS.WORLD_LIMIT);
        let nz = THREE.MathUtils.clamp(pz, -PHYSICS.WORLD_LIMIT, PHYSICS.WORLD_LIMIT);

        // 1. 建築物圓角碰撞解算
        for (let i = 0; i < colliders.length; i++) {
            const c = colliders[i];
            const cx = THREE.MathUtils.clamp(nx, c.x - c.rx, c.x + c.rx);
            const cz = THREE.MathUtils.clamp(nz, c.z - c.rz, c.z + c.rz);
            const dx = nx - cx, dz = nz - cz;
            const d2 = dx * dx + dz * dz;
            if (d2 < radius * radius) {
                if (d2 > 0.00001) {
                    const d = Math.sqrt(d2);
                    nx += (dx / d) * (radius - d);
                    nz += (dz / d) * (radius - d);
                } else {
                    nx = prevX; nz = prevZ;
                }
            }
        }

        // 2. 木拱橋護欄防墜與側面橋墩阻擋
        for (let i = 0; i < BRIDGES.length; i++) {
            const b = BRIDGES[i];
            const span = b.axis === 'x' ? (nx - b.x) : (nz - b.z);
            const lat  = b.axis === 'x' ? (nz - b.z) : (nx - b.x);
            const prevLat = b.axis === 'x' ? (prevZ - b.z) : (prevX - b.x);

            if (Math.abs(span) < b.halfLen - 0.35) {
                const onBridgeNow = Math.abs(prevLat) <= b.halfWid && currentY >= 0.05;
                if (onBridgeNow) {
                    // 在橋面上時，兩側護欄保護玩家不掉入河中
                    const clampedLat = THREE.MathUtils.clamp(lat, -(b.halfWid - 0.42), b.halfWid - 0.42);
                    if (b.axis === 'x') nz = b.z + clampedLat;
                    else nx = b.x + clampedLat;
                } else if (currentY < 0.05 && Math.abs(lat) < b.halfWid + radius * 0.75) {
                    // 在河道涉水時，不能直接穿過橋側護欄瞬移上橋
                    const sign = prevLat >= 0 ? 1 : -1;
                    const pushedLat = sign * (b.halfWid + radius * 0.76);
                    if (b.axis === 'x') nz = b.z + pushedLat;
                    else nx = b.x + pushedLat;
                }
            }
        }

        // 3. 高山陡壁物理阻擋與沿山腳平滑滑行
        const onBridgeAfter = getBridgeDeckHeight(nx, nz);
        if (!onBridgeAfter) {
            const grad = getTerrainGradient(nx, nz);
            if (grad.slope > PHYSICS.MAX_CLIMB_SLOPE) {
                const pushDist = (grad.slope - PHYSICS.MAX_CLIMB_SLOPE) * 1.45;
                nx -= (grad.gx / grad.slope) * pushDist;
                nz -= (grad.gz / grad.slope) * pushDist;
            }
        }

        return { x: nx, z: nz };
    }

    /* ── 7. 建造 5 座高飽和度 Switch 風格科學與四季地標建築 ── */
    // (0) 中央氣象科學台
    const hubTower = new THREE.Group();
    hubTower.position.set(0, getTerrainHeight(0, 0), 0);
    const hubBase = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 7.2, 1.1, 32), toyMat(0xF8FAFC, 0.35, 0.3));
    hubBase.position.y = 0.55; hubBase.castShadow = true; hubBase.receiveShadow = true;
    const hubMid = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.4, 3.6, 28), toyMat(0x0284C7, 0.32, 0.5));
    hubMid.position.y = 2.7; hubMid.castShadow = true;
    const hubDome = new THREE.Mesh(
        new THREE.SphereGeometry(4.3, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshPhysicalMaterial({ color: 0xBAE6FD, roughness: 0.08, clearcoat: 1.0, transparent: true, opacity: 0.85 })
    );
    hubDome.position.y = 4.4;
    const hubRing = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.28, 12, 32), toyMat(0xFACC15, 0.22, 0.85, 0.45));
    hubRing.rotation.x = Math.PI / 2; hubRing.position.y = 4.5;
    const weatherVane = new THREE.Group();
    weatherVane.position.y = 8.9;
    weatherVane.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 2.2, 10), toyMat(0xF59E0B, 0.3, 0.6)));
    for (let a = 0; a < 3; a++) {
        const arm = new THREE.Group();
        arm.rotation.y = (a * Math.PI * 2) / 3;
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8), toyMat(0xFFFFFF, 0.3, 0.5));
        rod.rotation.z = Math.PI / 2; rod.position.x = 0.75; arm.add(rod);
        const cup = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), toyMat(0xEF4444, 0.25, 0.7));
        cup.position.x = 1.5; arm.add(cup);
        weatherVane.add(arm);
    }
    hubTower.add(hubBase, hubMid, hubDome, hubRing, weatherVane);
    worldGroup.add(hubTower);
    addBoxCollider(0, 0, 6.5, 6.5);

    // (1) 春季百花溫室 (-43, -43)
    const springHouse = new THREE.Group();
    springHouse.position.set(-43, getTerrainHeight(-43, -43), -43);
    const ghPlinth = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.7, 8.6), toyMat(0xEC4899, 0.4, 0.3));
    ghPlinth.position.y = 0.35;
    const ghBody = new THREE.Mesh(
        new THREE.BoxGeometry(9.4, 4.4, 7.4),
        new THREE.MeshPhysicalMaterial({ color: 0xDCFCE7, roughness: 0.08, clearcoat: 1.0, transparent: true, opacity: 0.76 })
    );
    ghBody.position.y = 2.8; ghBody.castShadow = true;
    const ghRoof = new THREE.Mesh(new THREE.ConeGeometry(6.8, 3.2, 4), toyMat(0xDB2777, 0.35, 0.5));
    ghRoof.position.y = 6.5; ghRoof.rotation.y = Math.PI / 4; ghRoof.castShadow = true;
    springHouse.add(ghPlinth, ghBody, ghRoof);
    worldGroup.add(springHouse);
    addBoxCollider(-43, -43, 5.4, 4.4);

    // (2) 夏季陽光瞭望塔 (43, -43)
    const summerTower = new THREE.Group();
    summerTower.position.set(43, getTerrainHeight(43, -43), -43);
    const woodMat = toyMat(0xFEFCE8, 0.45, 0.25);
    [[-2.1, -2.1], [2.1, -2.1], [-2.1, 2.1], [2.1, 2.1]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 5.0, 10), woodMat);
        leg.position.set(lx, 2.5, lz); leg.castShadow = true; summerTower.add(leg);
    });
    const cab = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3.4, 5.5), woodMat);
    cab.position.y = 6.2; cab.castShadow = true;
    const cabBand = new THREE.Mesh(new THREE.BoxGeometry(5.65, 0.85, 5.65), toyMat(0x0284C7, 0.3, 0.5));
    cabBand.position.y = 5.1;
    const cabRoof = new THREE.Mesh(new THREE.ConeGeometry(4.8, 2.6, 4), toyMat(0xEF4444, 0.32, 0.5));
    cabRoof.position.y = 9.2; cabRoof.rotation.y = Math.PI / 4; cabRoof.castShadow = true;
    summerTower.add(cab, cabBand, cabRoof);
    worldGroup.add(summerTower);
    addBoxCollider(43, -43, 3.1, 3.1);

    // (3) 秋季紅葉豐收穀倉 (-43, 43) & 動態營火 (-31, 33)
    const autumnBarn = new THREE.Group();
    autumnBarn.position.set(-43, getTerrainHeight(-43, 43), 43);
    const barnBox = new THREE.Mesh(new THREE.BoxGeometry(9.0, 5.6, 10.6), toyMat(0xDC2626, 0.48, 0.25));
    barnBox.position.y = 2.8; barnBox.castShadow = true;
    const barnRoof = new THREE.Mesh(new THREE.ConeGeometry(7.6, 4.2, 4), toyMat(0x78350F, 0.6, 0.18));
    barnRoof.position.y = 7.7; barnRoof.rotation.y = Math.PI / 4; barnRoof.castShadow = true;
    const barnDoor = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.5, 0.24), toyMat(0xFFFFFF, 0.35, 0.25));
    barnDoor.position.set(0, 2.1, 5.32);
    autumnBarn.add(barnBox, barnRoof, barnDoor);
    worldGroup.add(autumnBarn);
    addBoxCollider(-43, 43, 4.8, 5.6);

    const campfire = new THREE.Group();
    campfire.position.set(-31, getTerrainHeight(-31, 33), 33);
    const flameOuter = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 10), new THREE.MeshBasicMaterial({ color: 0xF97316 }));
    flameOuter.position.y = 1.2;
    const fireLight = new THREE.PointLight(0xFB923C, 1.5, 16, 2);
    fireLight.position.y = 1.9;
    campfire.add(flameOuter, fireLight);
    worldGroup.add(campfire);
    addBoxCollider(-31, 33, 1.5, 1.5);

    // (4) 冬季冰雪圓頂屋 (43, 43) & 可愛雪人 (31, 33)
    const winterIgloo = new THREE.Group();
    winterIgloo.position.set(43, getTerrainHeight(43, 43), 43);
    const iglooMat = toyMat(0xFFFFFF, 0.26, 0.7);
    const iglooDome = new THREE.Mesh(new THREE.SphereGeometry(6.0, 26, 18, 0, Math.PI * 2, 0, Math.PI * 0.52), iglooMat);
    iglooDome.castShadow = true;
    const iglooEnt = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.1, 3.6, 18, 1, false, 0, Math.PI), iglooMat);
    iglooEnt.rotation.z = Math.PI / 2; iglooEnt.rotation.y = -Math.PI / 4; iglooEnt.position.set(-4.1, 0, -4.1);
    winterIgloo.add(iglooDome, iglooEnt);
    worldGroup.add(winterIgloo);
    addBoxCollider(43, 43, 6.0, 6.0);

    const snowman = new THREE.Group();
    snowman.position.set(31, getTerrainHeight(31, 33), 33);
    const sm1 = new THREE.Mesh(new THREE.SphereGeometry(1.6, 18, 16), iglooMat); sm1.position.y = 1.4; sm1.castShadow = true;
    const sm2 = new THREE.Mesh(new THREE.SphereGeometry(1.1, 18, 16), iglooMat); sm2.position.y = 3.4; sm2.castShadow = true;
    const smScarf = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.22, 10, 20), toyMat(0xDC2626, 0.5, 0.15));
    smScarf.rotation.x = Math.PI / 2; smScarf.position.y = 2.65;
    snowman.add(sm1, sm2, smScarf);
    worldGroup.add(snowman);
    addBoxCollider(31, 33, 1.75, 1.75);

    /* ── 8. 沿真實山坡地形種植四季樹木 + 漂浮雲朵 ── */
    const tGeo = {
        trunk: new THREE.CylinderGeometry(0.3, 0.5, 2.6, 9),
        puff:  new THREE.SphereGeometry(1.6, 12, 10),
        pine1: new THREE.ConeGeometry(2.2, 2.7, 10),
        pine2: new THREE.ConeGeometry(1.65, 2.4, 10),
        pine3: new THREE.ConeGeometry(1.1, 2.0, 10),
        frond: new THREE.ConeGeometry(0.7, 3.1, 6)
    };
    const tMat = {
        trunk: toyMat(0x78350F, 0.72, 0.1),
        springA: toyMat(0xF472B6, 0.42, 0.3),
        springB: toyMat(0xFBCFE8, 0.42, 0.3),
        summer:  toyMat(0x16A34A, 0.38, 0.35),
        autumnA: toyMat(0xEA580C, 0.45, 0.28),
        autumnB: toyMat(0xDC2626, 0.45, 0.28),
        pine:    toyMat(0x0F766E, 0.52, 0.2),
        snow:    toyMat(0xFFFFFF, 0.32, 0.4)
    };

    const swayTrees = [];
    function trySpawnTree(x, z, season) {
        if (getRiverInfo(x, z).dist < PHYSICS.RIVER_HALF_W + 2.5) return;
        if (getTerrainGradient(x, z).slope > 0.65) return;
        if (Math.hypot(Math.abs(x) - 43, Math.abs(z) - 43) < 10.5) return;
        if (Math.hypot(Math.abs(x) - 31, Math.abs(z) - 33) < 5.5) return;

        const g = new THREE.Group();
        const tr = new THREE.Mesh(tGeo.trunk, tMat.trunk);
        tr.position.y = 1.25; tr.castShadow = true;
        g.add(tr);

        if (season === 'spring' || season === 'autumn') {
            const mA = season === 'spring' ? tMat.springA : tMat.autumnA;
            const mB = season === 'spring' ? tMat.springB : tMat.autumnB;
            [[0, 3.4, 0, 1.05, mA], [-0.9, 2.8, 0.5, 0.76, mB], [0.9, 2.9, -0.5, 0.78, mB]].forEach(([px, py, pz, sc, m]) => {
                const p = new THREE.Mesh(tGeo.puff, m);
                p.position.set(px, py, pz); p.scale.setScalar(sc); p.castShadow = true;
                g.add(p);
            });
        } else if (season === 'summer') {
            tr.scale.y = 1.32; tr.position.y = 1.65;
            for (let f = 0; f < 6; f++) {
                const fr = new THREE.Mesh(tGeo.frond, tMat.summer);
                const ang = (f / 6) * Math.PI * 2;
                fr.position.set(Math.cos(ang) * 1.2, 3.55, Math.sin(ang) * 1.2);
                fr.rotation.z = -Math.PI / 2.6; fr.rotation.y = -ang; fr.castShadow = true;
                g.add(fr);
            }
        } else {
            const p1 = new THREE.Mesh(tGeo.pine1, tMat.pine); p1.position.y = 2.5; p1.castShadow = true;
            const p2 = new THREE.Mesh(tGeo.pine2, tMat.pine); p2.position.y = 4.0; p2.castShadow = true;
            const p3 = new THREE.Mesh(tGeo.pine3, tMat.snow); p3.position.y = 5.3; p3.castShadow = true;
            g.add(p1, p2, p3);
        }

        const sc = 0.86 + Math.random() * 0.34;
        g.scale.setScalar(sc);
        g.position.set(x, getTerrainHeight(x, z) - 0.1, z);
        g.userData = { phase: Math.random() * Math.PI * 2, season };
        worldGroup.add(g);
        swayTrees.push(g);
    }

    for (let i = 0; i < 46; i++) {
        const rx = 18 + Math.random() * 68;
        const rz = 18 + Math.random() * 68;
        trySpawnTree(-rx, -rz, 'spring');
        trySpawnTree( rx, -rz, 'summer');
        trySpawnTree(-rx,  rz, 'autumn');
        trySpawnTree( rx,  rz, 'winter');
    }

    // 接觸軟陰影工廠
    const blobShadowTex = (() => {
        const c = document.createElement('canvas');
        c.width = 64; c.height = 64;
        const g = c.getContext('2d');
        const r = g.createRadialGradient(32, 32, 4, 32, 32, 30);
        r.addColorStop(0, 'rgba(15,23,42,0.52)');
        r.addColorStop(0.65, 'rgba(15,23,42,0.2)');
        r.addColorStop(1, 'rgba(15,23,42,0)');
        g.fillStyle = r; g.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
    })();
    const blobGeo = new THREE.PlaneGeometry(1, 1);
    blobGeo.rotateX(-Math.PI / 2);
    function createBlobShadow(scale = 2.0) {
        const m = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobShadowTex, transparent: true, depthWrite: false }));
        m.scale.set(scale, 1, scale);
        scene.add(m);
        return m;
    }

    /* ── 9. 高對比鮮明細緻主角建模 + 動態天氣服裝 + 6 款 3D 手提物品 ── */
    const player = new THREE.Group();
    player.position.set(0, getTerrainHeight(0, 14), 14);
    scene.add(player);

    // 腳下鮮明定位光環（在濃霧、雪地或暴雨中依然清晰可見主角位置）
    const locatorRing = new THREE.Mesh(
        new THREE.RingGeometry(0.86, 1.08, 32),
        new THREE.MeshBasicMaterial({ color: 0xFEF08A, side: THREE.DoubleSide, transparent: true, opacity: 0.78 })
    );
    locatorRing.rotation.x = -Math.PI / 2;
    locatorRing.position.y = 0.05;
    player.add(locatorRing);

    // 涉水動態漣漪環
    const waterRipple = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 1.25, 28),
        new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide, transparent: true, opacity: 0.0 })
    );
    waterRipple.rotation.x = -Math.PI / 2;
    scene.add(waterRipple);

    const playerVisual = new THREE.Group();
    player.add(playerVisual);
    const playerShadow = createBlobShadow(2.25);

    // 高對比鮮明材質（解決原本顏色太淡問題）
    const coatMat   = toyMat(0xDC2626, 0.34, 0.45); // 預設飽和鮮紅外套
    const trimMat   = toyMat(0xFACC15, 0.28, 0.6);  // 亮金領邊與拉鍊
    const hatMat    = toyMat(0x1D4ED8, 0.32, 0.5);  // 飽和皇家藍探索帽
    const hairMat   = toyMat(0x1C1917, 0.48, 0.25); // 濃黑立體髮型（與雪地／沙灘形成強烈輪廓對比）
    const skinMat   = toyMat(0xF59E6C, 0.42, 0.2);  // 健康暖蜜桃膚色（不泛白）
    const pantsMat  = toyMat(0x0F172A, 0.45, 0.25); // 深海軍藍長短褲
    const shoeRedMat= toyMat(0xDC2626, 0.32, 0.55);
    const whiteMat  = toyMat(0xFFFFFF, 0.3, 0.4);

    // 上衣與天氣服裝組件（外套、雨衣下擺、羽絨蓬鬆環、保暖圍巾）
    const torsoJacket = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.7, 1.18, 22), coatMat);
    torsoJacket.position.y = 1.42; torsoJacket.castShadow = true;

    const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.1, 10, 22), trimMat);
    collarRing.rotation.x = Math.PI / 2; collarRing.position.y = 1.96;

    const zipperStripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.12, 0.08), trimMat);
    zipperStripe.position.set(0, 1.42, 0.63);

    const raincoatSkirt = new THREE.Mesh(new THREE.ConeGeometry(0.88, 0.72, 22, 1, true), coatMat);
    raincoatSkirt.position.y = 0.88;
    raincoatSkirt.visible = false;

    const pufferQuilt = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.13, 12, 22), coatMat);
    pufferQuilt.rotation.x = Math.PI / 2; pufferQuilt.position.y = 1.45;
    pufferQuilt.visible = false;

    const winterScarf = new THREE.Group();
    const scarfLoop = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.16, 12, 22), trimMat);
    scarfLoop.rotation.x = Math.PI / 2; scarfLoop.position.y = 2.02;
    const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.68, 0.12), trimMat);
    scarfTail.position.set(0.28, 1.68, 0.58); scarfTail.rotation.z = -0.15;
    winterScarf.add(scarfLoop, scarfTail);
    winterScarf.visible = false;

    const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.58, 0.44, 20), pantsMat);
    hips.position.y = 0.82; hips.castShadow = true;

    // 雙色立體登山背囊＋側邊水壺袋
    const backpackGrp = new THREE.Group();
    backpackGrp.position.set(0, 1.44, -0.58);
    const packMain = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.88, 0.44), toyMat(0x9A3412, 0.48, 0.25));
    packMain.castShadow = true;
    const packFlap = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.28, 0.48), toyMat(0xF59E0B, 0.38, 0.35));
    packFlap.position.y = 0.34;
    const sideBottle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.46, 12), toyMat(0x06B6D4, 0.2, 0.8));
    sideBottle.position.set(-0.48, -0.1, 0);
    backpackGrp.add(packMain, packFlap, sideBottle);

    // 精細頭部：深色立體頭髮、眉毛、大眼睛高光、立體鼻子、微笑與耳朵
    const headGrp = new THREE.Group();
    headGrp.position.y = 2.54;
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.68, 24, 20), skinMat);
    headMesh.castShadow = true;
    headGrp.add(headMesh);

    // 濃黑後髮與前瀏海、鬢角（大幅提升主角頭部辨識度）
    const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.71, 22, 18, 0, Math.PI * 2, 0, Math.PI * 0.68), hairMat);
    hairBack.rotation.x = -0.32;
    headGrp.add(hairBack);
    [-0.24, 0, 0.24].forEach((bx, idx) => {
        const bang = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.36, 8), hairMat);
        bang.position.set(bx, 0.38, 0.56 - Math.abs(bx) * 0.15);
        bang.rotation.x = Math.PI * 0.88;
        bang.rotation.z = (idx - 1) * 0.18;
        headGrp.add(bang);
    });
    [-0.64, 0.64].forEach(ex => {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), skinMat);
        ear.position.set(ex, -0.02, 0.05);
        headGrp.add(ear);
    });

    const eyeBlackMat = toyMat(0x0F172A, 0.08, 1.0);
    const glintMat    = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    [-0.24, 0.24].forEach(ex => {
        const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), whiteMat);
        eyeWhite.scale.set(1.0, 1.22, 0.55);
        eyeWhite.position.set(ex, 0.03, 0.59);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 12), eyeBlackMat);
        pupil.scale.y = 1.25;
        pupil.position.set(ex, 0.03, 0.64);
        const glint = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), glintMat);
        glint.position.set(ex + 0.03, 0.08, 0.71);
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.06), hairMat);
        brow.position.set(ex, 0.24, 0.62);
        brow.rotation.z = ex < 0 ? 0.08 : -0.08;
        headGrp.add(eyeWhite, pupil, glint, brow);
    });
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), toyMat(0xEA580C, 0.5, 0.2));
    nose.position.set(0, -0.04, 0.68);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 14, Math.PI), toyMat(0x991B1B, 0.4, 0.2));
    smile.rotation.x = Math.PI;
    smile.position.set(0, -0.14, 0.63);
    [-0.4, 0.4].forEach(cx => {
        const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 10), toyMat(0xFB7185, 0.55, 0.1));
        cheek.scale.set(1.2, 0.7, 0.4);
        cheek.position.set(cx, -0.09, 0.58);
        headGrp.add(cheek);
    });
    headGrp.add(nose, smile);

    // 4 款天氣帽飾：探索太陽帽 (cap)、闊邊防曬草帽 (sunhat)、連帽雨衣帽 (rainhood)、毛線絨球冷帽 (beanie)
    const capGroup = new THREE.Group();
    const capDome = new THREE.Mesh(new THREE.SphereGeometry(0.73, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), hatMat);
    capDome.position.y = 0.08;
    const capBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.78, 0.09, 20, 1, false, -Math.PI * 0.42, Math.PI * 0.84), hatMat);
    capBrim.position.set(0, 0.12, 0.28);
    capGroup.add(capDome, capBrim);

    const sunHatGroup = new THREE.Group();
    const shTop = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.68, 0.48, 22), hatMat);
    shTop.position.y = 0.46;
    const shBrim = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.22, 0.08, 26), hatMat);
    shBrim.position.y = 0.24;
    const shRibbon = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.07, 8, 22), toyMat(0xEF4444, 0.4, 0.3));
    shRibbon.rotation.x = Math.PI / 2; shRibbon.position.y = 0.29;
    sunHatGroup.add(shTop, shBrim, shRibbon);
    sunHatGroup.visible = false;

    const rainHoodGroup = new THREE.Group();
    const rhShell = new THREE.Mesh(new THREE.SphereGeometry(0.77, 22, 18, 0, Math.PI * 2, 0, Math.PI * 0.68), hatMat);
    rhShell.rotation.x = -0.22; rhShell.position.y = 0.04;
    const rhVisor = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.07, 10, 22, Math.PI * 1.1), trimMat);
    rhVisor.position.set(0, 0.1, 0.22);
    rainHoodGroup.add(rhShell, rhVisor);
    rainHoodGroup.visible = false;

    const beanieGroup = new THREE.Group();
    const bnDome = new THREE.Mesh(new THREE.SphereGeometry(0.74, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hatMat);
    bnDome.position.y = 0.08;
    const bnCuff = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.12, 10, 24), whiteMat);
    bnCuff.rotation.x = Math.PI / 2; bnCuff.position.y = 0.14;
    const bnPom = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), whiteMat);
    bnPom.position.y = 0.88;
    beanieGroup.add(bnDome, bnCuff, bnPom);
    beanieGroup.visible = false;

    headGrp.add(capGroup, sunHatGroup, rainHoodGroup, beanieGroup);

    // 榮譽解鎖飾品（太陽眼鏡、英雄披風、四季皇冠）
    const gearGlasses = new THREE.Group();
    const lensM = toyMat(0x0F172A, 0.06, 1.0, 0.65);
    const gL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.1), lensM); gL.position.set(-0.24, 0.05, 0.69);
    const gR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.1), lensM); gR.position.set( 0.24, 0.05, 0.69);
    const gB = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.08), trimMat); gB.position.set(0, 0.07, 0.7);
    gearGlasses.add(gL, gR, gB);
    gearGlasses.visible = false;
    headGrp.add(gearGlasses);

    const gearCrown = new THREE.Group();
    const crBand = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.42, 0.36, 16), toyMat(0xFACC15, 0.18, 0.9, 0.7));
    crBand.position.y = 0.92;
    const crGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), toyMat(0xEF4444, 0.1, 1.0));
    crGem.position.set(0, 0.94, 0.44);
    gearCrown.add(crBand, crGem);
    gearCrown.visible = false;
    headGrp.add(gearCrown);

    const gearCape = new THREE.Mesh(new THREE.BoxGeometry(1.22, 1.5, 0.08), toyMat(0x7C3AED, 0.4, 0.35));
    gearCape.position.set(0, 1.24, -0.66);
    gearCape.visible = false;

    // 鮮明衣袖四肢與紅白厚底運動鞋
    function makeArm(side) {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.76, 1.82, 0);
        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.44, 12), coatMat);
        sleeve.position.y = -0.18; sleeve.castShadow = true;
        const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.36, 12), skinMat);
        forearm.position.y = -0.48;
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 12), skinMat);
        hand.position.y = -0.68;
        pivot.add(sleeve, forearm, hand);
        return { pivot, hand };
    }
    function makeLeg(side) {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.31, 0.72, 0);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.54, 12), pantsMat);
        leg.position.y = -0.26; leg.castShadow = true;
        const shoeTop = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), shoeRedMat);
        shoeTop.scale.set(0.96, 0.72, 1.38); shoeTop.position.set(0, -0.54, 0.09); shoeTop.castShadow = true;
        const sole = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.64), whiteMat);
        sole.position.set(0, -0.64, 0.09);
        pivot.add(leg, shoeTop, sole);
        return pivot;
    }

    const leftArmObj  = makeArm(-1);
    const rightArmObj = makeArm(1);
    const leftLeg     = makeLeg(-1);
    const rightLeg    = makeLeg(1);

    // ── 右手 6 款 3D 天氣手提物品掛載點 (Hand-Held Props) ──
    const propSocket = new THREE.Group();
    propSocket.position.set(0, -0.68, 0.12);
    rightArmObj.pivot.add(propSocket);

    const propsMap = {};

    // (a) 🔍 生態觀察放大鏡
    const pMagnifier = new THREE.Group();
    const mgHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.55, 10), toyMat(0x78350F, 0.5, 0.3));
    mgHandle.rotation.x = Math.PI / 2; mgHandle.position.z = 0.25;
    const mgRim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 10, 22), toyMat(0xFACC15, 0.25, 0.8, 0.6));
    mgRim.position.set(0, 0.08, 0.68);
    const mgGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 20), new THREE.MeshPhysicalMaterial({ color: 0xBAE6FD, roughness: 0.05, clearcoat: 1.0, transparent: true, opacity: 0.68 }));
    mgGlass.rotation.x = Math.PI / 2; mgGlass.position.set(0, 0.08, 0.68);
    pMagnifier.add(mgHandle, mgRim, mgGlass);
    propsMap.magnifier = pMagnifier;

    // (b) ☂️ 撐開的立體彩色雨傘
    const pUmbrella = new THREE.Group();
    const umShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.25, 10), whiteMat);
    umShaft.position.set(-0.25, 1.05, 0.15);
    const umCanopy = new THREE.Mesh(new THREE.ConeGeometry(1.55, 0.72, 12), toyMat(0xFACC15, 0.3, 0.6));
    umCanopy.position.set(-0.25, 2.15, 0.15);
    umCanopy.castShadow = true;
    const umTop = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), toyMat(0xEF4444, 0.3, 0.6));
    umTop.position.set(-0.25, 2.54, 0.15);
    pUmbrella.add(umShaft, umCanopy, umTop);
    propsMap.umbrella = pUmbrella;

    // (c) 🔦 防水應急手電筒（含立體發光體積光束 Cone + 點光源）
    const pFlashlight = new THREE.Group();
    const flBody = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.58, 14), toyMat(0xFACC15, 0.25, 0.7));
    flBody.rotation.x = Math.PI / 2; flBody.position.z = 0.25;
    const flHead = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.13, 0.18, 14), toyMat(0x0F172A, 0.3, 0.6));
    flHead.rotation.x = Math.PI / 2; flHead.position.z = 0.58;
    const flBeam = new THREE.Mesh(
        new THREE.ConeGeometry(1.35, 5.2, 20, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xFEF08A, transparent: true, opacity: 0.24, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    flBeam.rotation.x = -Math.PI / 2;
    flBeam.position.z = 3.25;
    const flLight = new THREE.PointLight(0xFEF08A, 1.35, 14, 2);
    flLight.position.set(0, 0.2, 2.2);
    pFlashlight.add(flBody, flHead, flBeam, flLight);
    propsMap.flashlight = pFlashlight;

    // (d) 🌀 夏日便攜冰涼小風扇（扇葉會高速旋轉！）
    const pFan = new THREE.Group();
    const fnGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.48, 12), toyMat(0x06B6D4, 0.3, 0.6));
    fnGrip.position.set(0, 0.18, 0.35);
    const fnRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 10, 20), whiteMat);
    fnRing.position.set(0, 0.52, 0.35);
    const fanBlades = new THREE.Group();
    fanBlades.position.set(0, 0.52, 0.38);
    for (let b = 0; b < 3; b++) {
        const bl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.02), toyMat(0x38BDF8, 0.2, 0.8));
        bl.rotation.z = (b * Math.PI * 2) / 3;
        bl.position.set(Math.cos(bl.rotation.z + Math.PI / 2) * 0.1, Math.sin(bl.rotation.z + Math.PI / 2) * 0.1, 0);
        fanBlades.add(bl);
    }
    pFan.add(fnGrip, fnRing, fanBlades);
    propsMap.fan = pFan;

    // (e) 🔭 秋日觀鳥雙筒望遠鏡
    const pBinoculars = new THREE.Group();
    const binoMat = toyMat(0x1E293B, 0.32, 0.6, 0.3);
    [-0.16, 0.16].forEach(bx => {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.52, 14), binoMat);
        tube.rotation.x = Math.PI / 2; tube.position.set(bx, 0.06, 0.36);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 14), toyMat(0x38BDF8, 0.05, 1.0));
        lens.rotation.x = Math.PI / 2; lens.position.set(bx, 0.06, 0.63);
        pBinoculars.add(tube, lens);
    });
    propsMap.binoculars = pBinoculars;

    // (f) 🥤 保溫暖水壺
    const pThermos = new THREE.Group();
    const thBody = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.68, 16), toyMat(0xEF4444, 0.25, 0.85, 0.35));
    thBody.position.set(0, 0.15, 0.32);
    const thCap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.18, 16), whiteMat);
    thCap.position.set(0, 0.54, 0.32);
    pThermos.add(thBody, thCap);
    propsMap.thermos = pThermos;

    // (g) 🏮 嚴寒發光溫暖手提營燈
    const pLantern = new THREE.Group();
    const lnHook = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 16, Math.PI), toyMat(0x1E293B, 0.3, 0.6));
    lnHook.position.set(0, 0.0, 0.35);
    const lnTop = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.22, 12), toyMat(0xDC2626, 0.3, 0.6));
    lnTop.position.set(0, -0.14, 0.35);
    const lnCore = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.38, 14), new THREE.MeshBasicMaterial({ color: 0xFEF08A }));
    lnCore.position.set(0, -0.4, 0.35);
    const lnLight = new THREE.PointLight(0xFBBF24, 1.4, 13, 2);
    lnLight.position.set(0, -0.4, 0.5);
    pLantern.add(lnHook, lnTop, lnCore, lnLight);
    propsMap.lantern = pLantern;

    Object.keys(propsMap).forEach(k => {
        propsMap[k].visible = (k === 'magnifier');
        propSocket.add(propsMap[k]);
    });

    playerVisual.add(
        torsoJacket, collarRing, zipperStripe, raincoatSkirt, pufferQuilt, winterScarf,
        hips, backpackGrp, gearCape, headGrp,
        leftArmObj.pivot, rightArmObj.pivot, leftLeg, rightLeg
    );

    // 換裝閃亮星光特效粒子環
    const burstGroup = new THREE.Group();
    burstGroup.visible = false;
    player.add(burstGroup);
    for (let i = 0; i < 10; i++) {
        const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), toyMat(0xFEF08A, 0.1, 1.0));
        const ang = (i / 10) * Math.PI * 2;
        star.userData = { ang };
        burstGroup.add(star);
    }
    let burstTimer = 0;

    let activePropKey = 'magnifier';
    function applyWeatherOutfit(outfit) {
        coatMat.color.setHex(outfit.coat);
        trimMat.color.setHex(outfit.trim);
        hatMat.color.setHex(outfit.hatCol);

        raincoatSkirt.visible = (outfit.style === 'raincoat');
        pufferQuilt.visible   = (outfit.style === 'puffer' || outfit.style === 'puffer_scarf');
        winterScarf.visible   = (outfit.style === 'puffer_scarf');

        if (!gearCrown.visible) {
            capGroup.visible      = (outfit.hat === 'cap');
            sunHatGroup.visible   = (outfit.hat === 'sunhat');
            rainHoodGroup.visible = (outfit.hat === 'rainhood');
            beanieGroup.visible   = (outfit.hat === 'beanie');
        }

        activePropKey = outfit.prop;
        Object.keys(propsMap).forEach(k => {
            propsMap[k].visible = (k === activePropKey);
        });

        burstTimer = 1.1;
        burstGroup.visible = true;
    }

    /* ── 10. 任務寶石與百厭小猴子（自動貼合 3D 山坡地面、避開河流與陡崖） ── */
    const treasures = [];
    const gemColors = { spring: 0xEC4899, summer: 0x0EA5E9, autumn: 0xF97316, winter: 0x6366F1 };
    const gemGlows = {
        spring: createGlowTex('rgba(236,72,153,0.85)', 'rgba(236,72,153,0)'),
        summer: createGlowTex('rgba(14,165,233,0.85)', 'rgba(14,165,233,0)'),
        autumn: createGlowTex('rgba(249,115,22,0.85)', 'rgba(249,115,22,0)'),
        winter: createGlowTex('rgba(99,102,241,0.85)', 'rgba(99,102,241,0)')
    };

    function relocateGem(item) {
        for (let tries = 0; tries < 45; tries++) {
            let rx = 18 + Math.random() * 56;
            let rz = 18 + Math.random() * 56;
            if (item.season === 'spring' || item.season === 'autumn') rx = -rx;
            if (item.season === 'spring' || item.season === 'summer') rz = -rz;

            if (getRiverInfo(rx, rz).dist < PHYSICS.RIVER_HALF_W + 2.8) continue;
            if (getTerrainGradient(rx, rz).slope > 0.52) continue;
            const solved = resolveHorizontalWorld(rx, rz, 1.0, 2.2);
            if (Math.hypot(solved.x - rx, solved.z - rz) > 0.15) continue;

            const gy = getTerrainHeight(rx, rz);
            item.baseY = gy;
            item.mesh.position.set(rx, gy + 2.0, rz);
            item.shadow.position.set(rx, gy + 0.06, rz);
            item.active = true;
            item.mesh.visible = true;
            item.shadow.visible = true;
            return;
        }
        const fx = (item.season === 'spring' || item.season === 'autumn') ? -28 : 28;
        const fz = (item.season === 'spring' || item.season === 'summer') ? -28 : 28;
        const gy = getTerrainHeight(fx, fz);
        item.baseY = gy;
        item.mesh.position.set(fx, gy + 2.0, fz);
        item.shadow.position.set(fx, gy + 0.06, fz);
        item.active = true; item.mesh.visible = true; item.shadow.visible = true;
    }

    ['spring', 'summer', 'autumn', 'winter'].forEach(season => {
        for (let k = 0; k < 3; k++) {
            const g = new THREE.Group();
            const cry = new THREE.Mesh(
                new THREE.OctahedronGeometry(1.15, 0),
                new THREE.MeshPhysicalMaterial({
                    color: gemColors[season], roughness: 0.06, clearcoat: 1.0,
                    emissive: gemColors[season], emissiveIntensity: 0.28
                })
            );
            cry.scale.y = 1.35; cry.castShadow = true;
            const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.09, 10, 26), toyMat(0xFEF08A, 0.2, 0.8, 0.5));
            ring.rotation.x = Math.PI / 2.3;
            const glow = new THREE.Sprite(new THREE.SpriteMaterial({
                map: gemGlows[season], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
            }));
            glow.scale.set(4.5, 4.5, 1);
            g.add(cry, ring, glow);
            scene.add(g);
            const shadow = createBlobShadow(1.85);
            const item = { mesh: g, ring, shadow, season, active: true, baseY: 0.25, phase: Math.random() * Math.PI * 2 };
            relocateGem(item);
            treasures.push(item);
        }
    });

    // 4 隻百厭小猴子
    const monkeys = [];
    const furMat = toyMat(0x92400E, 0.55, 0.2);
    const faceMat = toyMat(0xFDE68A, 0.48, 0.2);

    function makeAlertSprite() {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const g = c.getContext('2d');
        g.fillStyle = '#FEF08A'; g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.fill();
        g.lineWidth = 5; g.strokeStyle = '#DC2626'; g.stroke();
        g.fillStyle = '#DC2626'; g.font = '900 36px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('!', 32, 34);
        const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
        sp.scale.set(1.25, 1.25, 1); sp.position.y = 3.1; sp.visible = false;
        return sp;
    }

    [
        { season: 'spring', xMin: -72, xMax: -14, zMin: -72, zMax: -14, sx: -30, sz: -24 },
        { season: 'summer', xMin:  14, xMax:  72, zMin: -72, zMax: -14, sx:  30, sz: -24 },
        { season: 'autumn', xMin: -72, xMax: -14, zMin:  14, zMax:  72, sx: -30, sz:  24 },
        { season: 'winter', xMin:  14, xMax:  72, zMin:  14, zMax:  72, sx:  30, sz:  24 }
    ].forEach(z => {
        const mg = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 14), furMat);
        body.scale.y = 1.15; body.position.y = 1.05; body.castShadow = true;
        const belly = new THREE.Mesh(new THREE.SphereGeometry(0.46, 12, 12), faceMat);
        belly.position.set(0, 1.02, 0.28);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.56, 16, 14), furMat);
        head.position.y = 2.02; head.castShadow = true;
        const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), faceMat);
        muzzle.scale.set(1.1, 0.85, 0.75); muzzle.position.set(0, 1.92, 0.42);
        [-0.55, 0.55].forEach(ex => {
            const ear = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), furMat);
            ear.position.set(ex, 2.05, 0); mg.add(ear);
        });
        [-0.17, 0.17].forEach(ex => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), eyeBlackMat);
            eye.position.set(ex, 2.08, 0.5); mg.add(eye);
        });
        const banana = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.09, 8, 14, Math.PI * 0.85), toyMat(0xFACC15, 0.3, 0.5));
        banana.position.set(0.56, 1.25, 0.34);
        const alertBadge = makeAlertSprite();
        mg.add(body, belly, head, muzzle, banana, alertBadge);

        const gy = getTerrainHeight(z.sx, z.sz);
        mg.position.set(z.sx, gy, z.sz);
        scene.add(mg);
        const sh = createBlobShadow(1.65);

        monkeys.push({
            mesh: mg, shadow: sh, alertBadge, zone: z, season: z.season,
            dirAngle: Math.random() * Math.PI * 2, changeTimer: 1.5, cooldown: 0, hopPhase: Math.random() * Math.PI * 2
        });
    });

    /* ── 11. 統一動態天氣粒子系統（支援花瓣、濃霧、春雨、陽光星塵、狂風暴雨、紅葉、飄雪） ── */
    const PARTICLE_COUNT = 420;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(PARTICLE_COUNT * 3);
    const pSeeds = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        pPos[i * 3]     = (Math.random() - 0.5) * 90;
        pPos[i * 3 + 1] = Math.random() * 32;
        pPos[i * 3 + 2] = (Math.random() - 0.5) * 90;
        pSeeds[i] = Math.random() * Math.PI * 2;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0xFFFFFF, size: 0.48, transparent: true, opacity: 0.86 });
    const weatherPoints = new THREE.Points(pGeo, pMat);
    weatherPoints.visible = false;
    scene.add(weatherPoints);

    const P_MODES = {
        petals:      { color: 0xF9A8D4, size: 0.54, fall:  3.0, flutter: 1.9, op: 0.9 },
        mist:        { color: 0xF8FAFC, size: 1.35, fall:  0.7, flutter: 1.2, op: 0.42 },
        rain:        { color: 0xBAE6FD, size: 0.36, fall: 19.5, flutter: 0.0, op: 0.85 },
        sun_sparkle: { color: 0xFEF08A, size: 0.42, fall:  0.9, flutter: 1.5, op: 0.72 },
        storm:       { color: 0xE0F2FE, size: 0.44, fall: 27.0, flutter: 0.4, op: 0.95 },
        leaves:      { color: 0xFB923C, size: 0.58, fall:  4.2, flutter: 2.2, op: 0.92 },
        leaves_fast: { color: 0xEA580C, size: 0.62, fall:  5.8, flutter: 3.4, op: 0.94 },
        snow_light:  { color: 0xFFFFFF, size: 0.42, fall:  2.8, flutter: 1.3, op: 0.82 },
        snow:        { color: 0xFFFFFF, size: 0.52, fall:  4.4, flutter: 1.8, op: 0.92 },
        blizzard:    { color: 0xF8FAFC, size: 0.62, fall:  7.2, flutter: 2.8, op: 0.96 }
    };

    GameApp.World = {
        scene, camera, renderer, sunLight, hemiLight,
        LANDMARKS, BRIDGES, MOUNTAIN_PEAKS,
        riverCenterX, riverCenterZ, getRiverInfo,
        getTerrainHeight, getTerrainGradient, getBridgeDeckHeight, resolveHorizontalWorld,
        riverFlowTex, weatherVane, flameOuter, fireLight, swayTrees,
        player, playerVisual, playerShadow, locatorRing, waterRipple,
        coatMat, hatMat, capGroup, sunHatGroup, rainHoodGroup, beanieGroup,
        gearGlasses, gearCape, gearCrown,
        leftArm: leftArmObj.pivot, rightArm: rightArmObj.pivot, leftLeg, rightLeg,
        fanBlades, applyWeatherOutfit, getActiveProp: () => activePropKey,
        updateBurst(dt) {
            if (burstTimer > 0) {
                burstTimer -= dt;
                const prog = 1 - burstTimer / 1.1;
                burstGroup.children.forEach(st => {
                    const r = 0.8 + prog * 2.2;
                    st.position.set(Math.cos(st.userData.ang + prog * 4) * r, 1.4 + Math.sin(prog * Math.PI) * 1.3, Math.sin(st.userData.ang + prog * 4) * r);
                    st.scale.setScalar(Math.max(0.01, 1 - prog));
                });
                if (burstTimer <= 0) burstGroup.visible = false;
            }
        },
        treasures, relocateGem, monkeys,
        weatherPoints, pSeeds, PARTICLE_COUNT, P_MODES,
        setHighQuality(hq) {
            renderer.setPixelRatio(hq ? Math.min(window.devicePixelRatio || 1, 2) : 1);
            renderer.shadowMap.enabled = hq;
            sunLight.castShadow = hq;
        }
    };
})();

/* =========================================================================
   四季小探險家 3D — 可攀登高山河流地形、深色高對比主角、香港特色動植物 3D 生態建模
   ========================================================================= */
(() => {
    'use strict';

    const { PHYSICS, SEASON_META, HK_GUARDIANS, HK_AMBIENT_SPECIES, SEASON_MISSIONS } = GameApp;

    const canvas = document.getElementById('game-canvas');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SEASON_META.plaza.sky);
    scene.fog = new THREE.FogExp2(SEASON_META.plaza.fog, SEASON_META.plaza.fogD);

    const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.35, 360);

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
    renderer.toneMappingExposure = 1.0;

    const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

    /* ── 1. PMREM 工作室環境光反射 (IBL) 與清漆 PBR 材質 ── */
    try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const envScene = new THREE.Scene();
        const c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        const g = c.getContext('2d');
        const grd = g.createLinearGradient(0, 0, 0, 128);
        grd.addColorStop(0.0, '#0284C7');
        grd.addColorStop(0.5, '#E0F2FE');
        grd.addColorStop(1.0, '#4ADE80');
        g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
        const envTex = new THREE.CanvasTexture(c);
        envTex.encoding = THREE.sRGBEncoding;
        const domeGeo = new THREE.SphereGeometry(40, 18, 12);
        envScene.add(new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ map: envTex, side: THREE.BackSide })));
        scene.environment = pmrem.fromScene(envScene, 0.04).texture;
        domeGeo.dispose(); envTex.dispose(); pmrem.dispose();
    } catch (e) { /* fallback */ }

    function toyMat(color, roughness = 0.4, clearcoat = 0.32, metalness = 0.04) {
        return new THREE.MeshPhysicalMaterial({
            color, roughness, metalness, clearcoat, clearcoatRoughness: 0.24
        });
    }

    function createGlowTex(innerRgba, outerRgba) {
        const c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        const g = c.getContext('2d');
        const r = g.createRadialGradient(64, 64, 5, 64, 64, 64);
        r.addColorStop(0, '#FFFFFF');
        r.addColorStop(0.32, innerRgba);
        r.addColorStop(1, outerRgba);
        g.fillStyle = r; g.fillRect(0, 0, 128, 128);
        const t = new THREE.CanvasTexture(c);
        t.encoding = THREE.sRGBEncoding;
        return t;
    }

    // 開啟 depthTest: true，避免遠處標籤穿透山體或殘留懸浮於畫面中央！
    function createLabelSprite(text, bgHex = '#0F172A', borderHex = '#FACC15', widthScale = 5.0) {
        const c = document.createElement('canvas');
        c.width = 384; c.height = 96;
        const g = c.getContext('2d');
        g.fillStyle = bgHex;
        g.strokeStyle = borderHex;
        g.lineWidth = 7;
        g.beginPath();
        g.roundRect ? g.roundRect(10, 14, 364, 68, 34) : g.rect(10, 14, 364, 68);
        g.fill();
        g.stroke();
        g.fillStyle = '#FFFFFF';
        g.font = '900 29px "Noto Sans TC", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, 192, 49);
        const tex = new THREE.CanvasTexture(c);
        tex.encoding = THREE.sRGBEncoding;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
            map: tex,
            transparent: true,
            depthTest: true,
            depthWrite: false
        }));
        sp.scale.set(widthScale, widthScale * 0.25, 1);
        return sp;
    }

    /* ── 2. 燈光與太陽 ── */
    const hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0x475569, 0.88);
    hemiLight.position.set(0, 70, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xFFFBEB, 1.15);
    sunLight.position.set(58, 92, 46);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 240;
    const sExt = 92;
    sunLight.shadow.camera.left = -sExt;
    sunLight.shadow.camera.right = sExt;
    sunLight.shadow.camera.top = sExt;
    sunLight.shadow.camera.bottom = -sExt;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    /* ── 3. 可自由攀登的四季高山、蜿蜒河流與 4 座木拱橋高度場 ── */
    function smoothstep(e0, e1, x) {
        const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
        return t * t * (3 - 2 * t);
    }

    function riverCenterX(z) { return Math.sin(z * 0.08) * 3.0; }
    function riverCenterZ(x) { return Math.sin(x * 0.08) * 3.0; }

    const MOUNTAIN_PEAKS = [
        { x: -72, z: -72, h: 13.5, sigma: 18.5, season: 'spring', high: true, name: '櫻花山' },
        { x:  72, z: -72, h: 13.0, sigma: 18.5, season: 'summer', high: true, name: '望海山' },
        { x: -72, z:  72, h: 14.2, sigma: 18.5, season: 'autumn', high: true, name: '大東芒草山' },
        { x:  72, z:  72, h: 15.6, sigma: 19.2, season: 'winter', high: true, name: '大帽霜峰' },
        { x: -82, z: -46, h: 6.5, sigma: 13.0, season: 'spring', high: false },
        { x:  82, z: -46, h: 6.0, sigma: 13.0, season: 'summer', high: false },
        { x: -82, z:  46, h: 6.8, sigma: 13.0, season: 'autumn', high: false },
        { x:  82, z:  46, h: 7.4, sigma: 13.0, season: 'winter', high: false }
    ];

    const LANDMARKS = [
        { id: 'hub',    name: '氣象科學台', x:   0, z:   0, flatR: 19.5, color: '#FEF08A' },
        { id: 'spring', name: '春花溫室',   x: -42, z: -42, flatR:  8.5, color: '#F472B6' },
        { id: 'summer', name: '陽光瞭望塔', x:  42, z: -42, flatR:  8.0, color: '#38BDF8' },
        { id: 'autumn', name: '紅葉穀倉',   x: -42, z:  42, flatR:  8.5, color: '#FB923C' },
        { id: 'winter', name: '冰雪圓頂屋', x:  42, z:  42, flatR:  8.5, color: '#A5B4FC' }
    ];

    const BRIDGES = [
        { id: 'north', axis: 'x', x: riverCenterX(-50), z: -50, halfLen: 6.0, halfWid: 2.4, archH: 1.28 },
        { id: 'south', axis: 'x', x: riverCenterX( 50), z:  50, halfLen: 6.0, halfWid: 2.4, archH: 1.28 },
        { id: 'west',  axis: 'z', x: -50, z: riverCenterZ(-50), halfLen: 6.0, halfWid: 2.4, archH: 1.28 },
        { id: 'east',  axis: 'z', x:  50, z: riverCenterZ( 50), halfLen: 6.0, halfWid: 2.4, archH: 1.28 }
    ];

    function getRiverInfo(x, z) {
        const r = Math.hypot(x, z);
        const mask = smoothstep(21.5, 27.0, r);
        if (mask <= 0.001) return { inRiver: false, dist: 99, mask: 0, flowX: 0, flowZ: 0 };
        let dNS = 99, dWE = 99;
        if (Math.abs(z) > 20) dNS = Math.abs(x - riverCenterX(z));
        if (Math.abs(x) > 20) dWE = Math.abs(z - riverCenterZ(x));
        if (dNS < dWE) {
            return { inRiver: dNS < PHYSICS.RIVER_HALF_W, dist: dNS, mask, flowX: 0, flowZ: z < 0 ? -1 : 1 };
        }
        return { inRiver: dWE < PHYSICS.RIVER_HALF_W, dist: dWE, mask, flowX: x < 0 ? -1 : 1, flowZ: 0 };
    }

    function getTerrainHeight(x, z) {
        const r = Math.hypot(x, z);
        let h = 0.24 + (Math.sin(x * 0.08) * Math.cos(z * 0.08)) * 0.12 * smoothstep(20, 32, r);

        for (let i = 0; i < MOUNTAIN_PEAKS.length; i++) {
            const m = MOUNTAIN_PEAKS[i];
            const dx = x - m.x, dz = z - m.z;
            const d2 = dx * dx + dz * dz;
            if (d2 < m.sigma * m.sigma * 6.5) {
                const rawBell = Math.exp(-d2 / (2 * m.sigma * m.sigma));
                h += m.h * Math.min(0.94, rawBell);
            }
        }

        for (let i = 0; i < LANDMARKS.length; i++) {
            const lm = LANDMARKS[i];
            const d = Math.hypot(x - lm.x, z - lm.z);
            if (d < lm.flatR + 4.0) {
                const f = 1 - smoothstep(lm.flatR - 1.5, lm.flatR + 4.0, d);
                h = THREE.MathUtils.lerp(h, 0.26, f);
            }
        }

        const rv = getRiverInfo(x, z);
        if (rv.dist < PHYSICS.RIVER_HALF_W + 1.4 && rv.mask > 0.01) {
            const t = THREE.MathUtils.clamp(rv.dist / (PHYSICS.RIVER_HALF_W + 0.8), 0, 1);
            h -= (1 - t * t) * 1.4 * rv.mask;
        }
        return h;
    }

    function getTerrainGradient(x, z) {
        const eps = 0.5;
        const gx = (getTerrainHeight(x + eps, z) - getTerrainHeight(x - eps, z)) / (2 * eps);
        const gz = (getTerrainHeight(x, z + eps) - getTerrainHeight(x, z - eps)) / (2 * eps);
        return { gx, gz, slope: Math.hypot(gx, gz) };
    }

    BRIDGES.forEach(b => {
        b.baseEndA = b.axis === 'x' ? getTerrainHeight(b.x - b.halfLen, b.z) : getTerrainHeight(b.x, b.z - b.halfLen);
        b.baseEndB = b.axis === 'x' ? getTerrainHeight(b.x + b.halfLen, b.z) : getTerrainHeight(b.x, b.z + b.halfLen);
    });

    function getBridgeDeckHeight(x, z) {
        for (let i = 0; i < BRIDGES.length; i++) {
            const b = BRIDGES[i];
            const span = b.axis === 'x' ? (x - b.x) : (z - b.z);
            const lat  = b.axis === 'x' ? (z - b.z) : (x - b.x);
            if (Math.abs(span) <= b.halfLen && Math.abs(lat) <= b.halfWid) {
                const u = span / b.halfLen;
                const baseY = THREE.MathUtils.lerp(b.baseEndA, b.baseEndB, (u + 1) * 0.5);
                return { y: baseY + Math.cos(u * Math.PI * 0.5) * b.archH, bridge: b };
            }
        }
        return null;
    }

    /* ── 4. 建立 3D 山河地形網格與登山步道石階 ── */
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    const oceanGeo = new THREE.CircleGeometry(280, 48);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMesh = new THREE.Mesh(oceanGeo, new THREE.MeshPhysicalMaterial({
        color: 0x0284C7, roughness: 0.16, clearcoat: 0.9
    }));
    oceanMesh.position.y = -0.7;
    worldGroup.add(oceanMesh);

    const detailBumpTex = (() => {
        const c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        const g = c.getContext('2d');
        g.fillStyle = '#808080'; g.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 600; i++) {
            g.fillStyle = i % 2 ? '#A5A5A5' : '#5E5E5E';
            g.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
        }
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(44, 44);
        t.anisotropy = maxAniso;
        return t;
    })();

    const SEG = 152;
    const terrainGeo = new THREE.PlaneGeometry(200, 200, SEG, SEG);
    terrainGeo.rotateX(-Math.PI / 2);
    const posArr = terrainGeo.attributes.position.array;
    const colArr = new Float32Array(posArr.length);
    const tmpCol = new THREE.Color();

    for (let i = 0; i < posArr.length; i += 3) {
        const vx = posArr[i], vz = posArr[i + 2];
        const vy = getTerrainHeight(vx, vz);
        posArr[i + 1] = vy;

        const r = Math.hypot(vx, vz);
        const rv = getRiverInfo(vx, vz);

        if (r < 20.8) {
            const chk = ((Math.floor(vx * 0.5) + Math.floor(vz * 0.5)) & 1) ? 0xD6D3D1 : 0xE7E5E4;
            tmpCol.setHex(r > 19.2 ? 0xF59E0B : chk);
        } else if (vy < -0.18 && rv.mask > 0.2) {
            tmpCol.setHex(vy < -0.6 ? 0x0EA5E9 : 0xFDE68A);
        } else if (rv.dist < PHYSICS.RIVER_HALF_W + 1.2 && rv.mask > 0.2) {
            tmpCol.setHex(0xFEF08A);
        } else if (vx < 0 && vz < 0) {
            if (vy > 9.5) tmpCol.setHex(0xF9A8D4);
            else if (vy > 4.2) tmpCol.setHex(0x4ADE80);
            else tmpCol.setHex(0x22C55E);
        } else if (vx >= 0 && vz < 0) {
            if (vy > 9.0) tmpCol.setHex(0x84CC16);
            else if (vy > 3.2) tmpCol.setHex(0x65A30D);
            else tmpCol.setHex(0xFCD34D);
        } else if (vx < 0 && vz >= 0) {
            if (vy > 9.5) tmpCol.setHex(0xF59E0B);
            else if (vy > 4.0) tmpCol.setHex(0xEA580C);
            else tmpCol.setHex(0xD97706);
        } else {
            if (vy > 8.5) tmpCol.setHex(0xFFFFFF);
            else if (vy > 3.5) tmpCol.setHex(0xCBD5E1);
            else tmpCol.setHex(0xE2E8F0);
        }
        colArr[i] = tmpCol.r; colArr[i + 1] = tmpCol.g; colArr[i + 2] = tmpCol.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    terrainGeo.computeVertexNormals();

    const terrainMesh = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({
        vertexColors: true, bumpMap: detailBumpTex, bumpScale: 0.05, roughness: 0.8
    }));
    terrainMesh.receiveShadow = true;
    worldGroup.add(terrainMesh);

    const stepStoneGeo = new THREE.CylinderGeometry(1.1, 1.2, 0.18, 12);
    const stepStoneMat = toyMat(0xF59E0B, 0.5, 0.25);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
        for (let st = 0; st <= 10; st++) {
            const t = st / 10;
            const px = sx * THREE.MathUtils.lerp(49, 70, t);
            const pz = sz * THREE.MathUtils.lerp(49, 70, t) + Math.sin(t * Math.PI * 2) * 2.2;
            const stone = new THREE.Mesh(stepStoneGeo, stepStoneMat);
            stone.position.set(px, getTerrainHeight(px, pz) + 0.04, pz);
            stone.receiveShadow = true;
            worldGroup.add(stone);
        }
    });

    /* ── 5. 河流波光網格與 4 座木拱橋 ── */
    const riverFlowTex = (() => {
        const c = document.createElement('canvas'); c.width = 128; c.height = 128;
        const g = c.getContext('2d');
        g.fillStyle = '#06B6D4'; g.fillRect(0, 0, 128, 128);
        g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3;
        for (let y = 8; y < 128; y += 24) {
            g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(42, y - 6, 86, y + 6, 128, y); g.stroke();
        }
        const t = new THREE.CanvasTexture(c);
        t.encoding = THREE.sRGBEncoding;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(3, 18);
        return t;
    })();
    const riverWaterMat = new THREE.MeshPhysicalMaterial({
        map: riverFlowTex, color: 0x22D3EE, roughness: 0.06, clearcoat: 1.0, transparent: true, opacity: 0.84
    });

    function buildRiverRibbon(isNS, sign) {
        const geo = new THREE.PlaneGeometry(PHYSICS.RIVER_HALF_W * 2.05, 76, 8, 52);
        geo.rotateX(-Math.PI / 2);
        const p = geo.attributes.position.array;
        for (let i = 0; i < p.length; i += 3) {
            const across = p[i];
            const dist = 22 + ((p[i + 2] + 38) / 76) * 75;
            const coord = sign * dist;
            if (isNS) { p[i] = riverCenterX(coord) + across; p[i + 1] = PHYSICS.WATER_LEVEL; p[i + 2] = coord; }
            else { p[i] = coord; p[i + 1] = PHYSICS.WATER_LEVEL; p[i + 2] = riverCenterZ(coord) + across; }
        }
        geo.computeVertexNormals();
        worldGroup.add(new THREE.Mesh(geo, riverWaterMat));
    }
    buildRiverRibbon(true, -1); buildRiverRibbon(true, 1);
    buildRiverRibbon(false, -1); buildRiverRibbon(false, 1);

    const plankMat = toyMat(0xB45309, 0.55, 0.2);
    const railMat  = toyMat(0x78350F, 0.6, 0.18);
    BRIDGES.forEach(b => {
        const bg = new THREE.Group();
        const steps = 14;
        for (let s = 0; s < steps; s++) {
            const u = -1 + (s + 0.5) * (2 / steps);
            const spanPos = u * b.halfLen;
            const deckY = THREE.MathUtils.lerp(b.baseEndA, b.baseEndB, (u + 1) * 0.5) + Math.cos(u * Math.PI * 0.5) * b.archH;
            const slopeAng = (Math.PI * 0.5 / b.halfLen) * Math.sin(u * Math.PI * 0.5) * b.archH;
            const plank = new THREE.Mesh(
                b.axis === 'x'
                    ? new THREE.BoxGeometry((b.halfLen * 2) / steps * 0.96, 0.22, b.halfWid * 2)
                    : new THREE.BoxGeometry(b.halfWid * 2, 0.22, (b.halfLen * 2) / steps * 0.96),
                plankMat
            );
            if (b.axis === 'x') { plank.position.set(b.x + spanPos, deckY - 0.08, b.z); plank.rotation.z = -slopeAng; }
            else { plank.position.set(b.x, deckY - 0.08, b.z + spanPos); plank.rotation.x = slopeAng; }
            plank.castShadow = true; plank.receiveShadow = true;
            bg.add(plank);

            if (s % 3 === 1) {
                [-b.halfWid + 0.18, b.halfWid - 0.18].forEach(side => {
                    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.2, 8), railMat);
                    if (b.axis === 'x') post.position.set(b.x + spanPos, deckY + 0.52, b.z + side);
                    else post.position.set(b.x + side, deckY + 0.52, b.z + spanPos);
                    bg.add(post);
                });
            }
        }
        worldGroup.add(bg);
    });

    /* ── 6. 碰撞解算 ── */
    const colliders = [];
    function addBoxCollider(x, z, rx, rz) { colliders.push({ x, z, rx, rz }); }

    function resolveHorizontalWorld(px, pz, currentY, radius, prevX = px, prevZ = pz) {
        let nx = THREE.MathUtils.clamp(px, -PHYSICS.WORLD_LIMIT, PHYSICS.WORLD_LIMIT);
        let nz = THREE.MathUtils.clamp(pz, -PHYSICS.WORLD_LIMIT, PHYSICS.WORLD_LIMIT);

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
                } else { nx = prevX; nz = prevZ; }
            }
        }

        for (let i = 0; i < BRIDGES.length; i++) {
            const b = BRIDGES[i];
            const span = b.axis === 'x' ? (nx - b.x) : (nz - b.z);
            const lat  = b.axis === 'x' ? (nz - b.z) : (nx - b.x);
            const prevLat = b.axis === 'x' ? (prevZ - b.z) : (prevX - b.x);
            if (Math.abs(span) < b.halfLen - 0.35) {
                const onB = Math.abs(prevLat) <= b.halfWid && currentY >= 0.05;
                if (onB) {
                    const cLat = THREE.MathUtils.clamp(lat, -(b.halfWid - 0.4), b.halfWid - 0.4);
                    if (b.axis === 'x') nz = b.z + cLat; else nx = b.x + cLat;
                } else if (currentY < 0.05 && Math.abs(lat) < b.halfWid + radius * 0.72) {
                    const sgn = prevLat >= 0 ? 1 : -1;
                    if (b.axis === 'x') nz = b.z + sgn * (b.halfWid + radius * 0.74);
                    else nx = b.x + sgn * (b.halfWid + radius * 0.74);
                }
            }
        }
        return { x: nx, z: nz };
    }

    /* ── 7. 建造 5 座核心建築地標 ── */
    const hubTower = new THREE.Group();
    hubTower.position.set(0, getTerrainHeight(0, 0), 0);
    const hubBase = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 7.0, 1.0, 28), toyMat(0xF8FAFC, 0.35, 0.3));
    hubBase.position.y = 0.5; hubBase.castShadow = true;
    const hubMid = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.2, 3.5, 24), toyMat(0x0284C7, 0.32, 0.5));
    hubMid.position.y = 2.6; hubMid.castShadow = true;
    const hubDome = new THREE.Mesh(
        new THREE.SphereGeometry(4.1, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshPhysicalMaterial({ color: 0xBAE6FD, roughness: 0.08, clearcoat: 1.0, transparent: true, opacity: 0.85 })
    );
    hubDome.position.y = 4.2;
    const weatherVane = new THREE.Group();
    weatherVane.position.y = 8.5;
    weatherVane.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 2.0, 10), toyMat(0xF59E0B, 0.3, 0.6)));
    for (let a = 0; a < 3; a++) {
        const arm = new THREE.Group(); arm.rotation.y = (a * Math.PI * 2) / 3;
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), toyMat(0xFFFFFF, 0.3, 0.5));
        rod.rotation.z = Math.PI / 2; rod.position.x = 0.7; arm.add(rod);
        const cup = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), toyMat(0xEF4444, 0.25, 0.7));
        cup.position.x = 1.4; arm.add(cup);
        weatherVane.add(arm);
    }
    hubTower.add(hubBase, hubMid, hubDome, weatherVane);
    worldGroup.add(hubTower);
    addBoxCollider(0, 0, 6.3, 6.3);

    const springHouse = new THREE.Group();
    springHouse.position.set(-42, getTerrainHeight(-42, -42), -42);
    const ghBody = new THREE.Mesh(new THREE.BoxGeometry(8.8, 4.2, 7.0), new THREE.MeshPhysicalMaterial({ color: 0xDCFCE7, roughness: 0.08, clearcoat: 1.0, transparent: true, opacity: 0.76 }));
    ghBody.position.y = 2.1; ghBody.castShadow = true;
    const ghRoof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 3.0, 4), toyMat(0xBE185D, 0.35, 0.5));
    ghRoof.position.y = 5.6; ghRoof.rotation.y = Math.PI / 4; ghRoof.castShadow = true;
    springHouse.add(ghBody, ghRoof);
    worldGroup.add(springHouse);
    addBoxCollider(-42, -42, 4.8, 3.9);

    const summerTower = new THREE.Group();
    summerTower.position.set(42, getTerrainHeight(42, -42), -42);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(5.2, 5.2, 5.2), toyMat(0xFEFCE8, 0.45, 0.25));
    cab.position.y = 2.6; cab.castShadow = true;
    const cabRoof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.5, 4), toyMat(0xDC2626, 0.32, 0.5));
    cabRoof.position.y = 6.4; cabRoof.rotation.y = Math.PI / 4; cabRoof.castShadow = true;
    summerTower.add(cab, cabRoof);
    worldGroup.add(summerTower);
    addBoxCollider(42, -42, 3.0, 3.0);

    const autumnBarn = new THREE.Group();
    autumnBarn.position.set(-42, getTerrainHeight(-42, 42), 42);
    const barnBox = new THREE.Mesh(new THREE.BoxGeometry(8.4, 5.2, 9.6), toyMat(0xB91C1C, 0.48, 0.25));
    barnBox.position.y = 2.6; barnBox.castShadow = true;
    const barnRoof = new THREE.Mesh(new THREE.ConeGeometry(7.2, 3.8, 4), toyMat(0x78350F, 0.6, 0.18));
    barnRoof.position.y = 7.0; barnRoof.rotation.y = Math.PI / 4; barnRoof.castShadow = true;
    autumnBarn.add(barnBox, barnRoof);
    worldGroup.add(autumnBarn);
    addBoxCollider(-42, 42, 4.5, 5.1);

    const winterIgloo = new THREE.Group();
    winterIgloo.position.set(42, getTerrainHeight(42, 42), 42);
    const iglooDome = new THREE.Mesh(new THREE.SphereGeometry(5.6, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), toyMat(0xFFFFFF, 0.26, 0.7));
    iglooDome.castShadow = true;
    winterIgloo.add(iglooDome);
    worldGroup.add(winterIgloo);
    addBoxCollider(42, 42, 5.6, 5.6);

    /* ── 8. 香港特色動植物 3D 生態建模（近距離才顯示標籤，完成大獎章後自動隱藏任務標籤） ── */
    const guardianNodes = {};
    const animatedButterflies = [];
    let animatedSpoonbillHead = null;
    let animatedDolphin = null;
    let animatedCrabClaw = null;
    let animatedFrog = null;

    const beaconGeo = new THREE.CylinderGeometry(1.8, 2.2, 18, 20, 1, true);
    function buildGuardianBase(gx, gz, labelText, accentHex) {
        const grp = new THREE.Group();
        const gy = getTerrainHeight(gx, gz);
        grp.position.set(gx, gy, gz);

        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.16, 10, 32), toyMat(accentHex, 0.25, 0.8, 0.4));
        ring.rotation.x = Math.PI / 2; ring.position.y = 0.12;
        grp.add(ring);

        const beacon = new THREE.Mesh(beaconGeo, new THREE.MeshBasicMaterial({
            color: 0xFACC15, transparent: true, opacity: 0.22, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        beacon.position.y = 9.0;
        beacon.visible = false;
        grp.add(beacon);

        const lbl = createLabelSprite(labelText, '#0F172A', '#FACC15', 5.8);
        lbl.position.y = 5.2;
        grp.add(lbl);

        worldGroup.add(grp);
        return { grp, beacon, ring, lbl };
    }

    // (G1) 🌸 春季：洋紫荊與鳳蝶
    {
        const gInfo = HK_GUARDIANS.spring;
        const { grp, beacon, lbl } = buildGuardianBase(gInfo.x, gInfo.z, '🌺 洋紫荊與鳳蝶', 0xEC4899);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.72, 3.2, 12), toyMat(0x451A03, 0.7, 0.1));
        trunk.position.y = 1.6; trunk.castShadow = true;
        const crown = new THREE.Mesh(new THREE.SphereGeometry(2.3, 16, 14), toyMat(0x15803D, 0.5, 0.2));
        crown.position.y = 3.6; crown.castShadow = true;
        grp.add(trunk, crown);
        const bauhiniaMat = toyMat(0xDB2777, 0.28, 0.6);
        for (let f = 0; f < 14; f++) {
            const ang = (f / 14) * Math.PI * 2;
            const r = 1.85 + (f % 2) * 0.4;
            const flower = new THREE.Mesh(new THREE.DodecahedronGeometry(0.36), bauhiniaMat);
            flower.position.set(Math.cos(ang) * r, 3.0 + (f % 3) * 0.65, Math.sin(ang) * r);
            grp.add(flower);
        }
        for (let b = 0; b < 3; b++) {
            const bf = new THREE.Group();
            const wL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.32), toyMat(0x38BDF8, 0.2, 0.8)); wL.position.x = -0.2;
            const wR = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.32), toyMat(0xFACC15, 0.2, 0.8)); wR.position.x = 0.2;
            bf.add(wL, wR); grp.add(bf);
            animatedButterflies.push({ mesh: bf, wL, wR, phase: b * 2.1 });
        }
        guardianNodes.spring = { data: gInfo, grp, beacon, lbl };
    }

    // (G2) 🏖️ 夏季：深灣綠海龜
    {
        const gInfo = HK_GUARDIANS.summer;
        const { grp, beacon, lbl } = buildGuardianBase(gInfo.x, gInfo.z, '🐢 深灣綠海龜', 0x10B981);
        const shell = new THREE.Mesh(new THREE.SphereGeometry(1.35, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), toyMat(0x065F46, 0.32, 0.65));
        shell.scale.set(1.0, 0.72, 1.25); shell.position.y = 0.45; shell.castShadow = true;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), toyMat(0x16A34A, 0.45, 0.3));
        head.position.set(0, 0.65, 1.65);
        [[-1.2, 0.8], [1.2, 0.8], [-1.0, -0.8], [1.0, -0.8]].forEach(([fx, fz]) => {
            const flip = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.14, 0.42), toyMat(0x15803D, 0.45, 0.3));
            flip.position.set(fx, 0.25, fz); grp.add(flip);
        });
        for (let e = 0; e < 5; e++) {
            const egg = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), toyMat(0xFEFCE8, 0.4, 0.3));
            egg.position.set(-1.5 + (e % 3) * 0.32, 0.2, -1.4 + Math.floor(e / 3) * 0.32);
            grp.add(egg);
        }
        grp.add(shell, head);
        guardianNodes.summer = { data: gInfo, grp, beacon, lbl };
    }

    // (G3) 🦩 秋季：米埔黑臉琵鷺
    {
        const gInfo = HK_GUARDIANS.autumn;
        const { grp, beacon, lbl } = buildGuardianBase(gInfo.x, gInfo.z, '🦩 米埔黑臉琵鷺', 0xF97316);
        const whiteFeather = toyMat(0xFFFFFF, 0.35, 0.4);
        const blackBillMat = toyMat(0x0F172A, 0.25, 0.7);
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.82, 16, 14), whiteFeather);
        body.scale.set(0.88, 0.92, 1.35); body.position.y = 1.75; body.castShadow = true;
        [-0.26, 0.26].forEach(lx => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.65, 8), blackBillMat);
            leg.position.set(lx, 0.85, 0); grp.add(leg);
        });
        const neckPivot = new THREE.Group();
        neckPivot.position.set(0, 2.1, 0.65);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.2, 10), whiteFeather); neck.position.y = 0.55;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), whiteFeather); head.position.y = 1.18;
        const blackFace = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), blackBillMat); blackFace.position.set(0, 1.18, 0.16);
        const spoonShaft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.95), blackBillMat); spoonShaft.position.set(0, 1.02, 0.68); spoonShaft.rotation.x = 0.32;
        const spoonTip = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 14), blackBillMat); spoonTip.position.set(0, 0.87, 1.12); spoonTip.rotation.x = 0.32;
        neckPivot.add(neck, head, blackFace, spoonShaft, spoonTip);
        animatedSpoonbillHead = neckPivot;
        grp.add(body, neckPivot);
        guardianNodes.autumn = { data: gInfo, grp, beacon, lbl };
    }

    // (G4) 🦔 冬季：中華穿山甲
    {
        const gInfo = HK_GUARDIANS.winter;
        const { grp, beacon, lbl } = buildGuardianBase(gInfo.x, gInfo.z, '🦔 中華穿山甲', 0x6366F1);
        const scaleMat = toyMat(0x78350F, 0.38, 0.55, 0.18);
        const cave = new THREE.Mesh(new THREE.DodecahedronGeometry(1.7), toyMat(0x475569, 0.8, 0.05));
        cave.scale.set(1.2, 0.85, 1.0); cave.position.set(-0.9, 0.85, -0.8); cave.castShadow = true;
        const pBody = new THREE.Group();
        pBody.position.set(0.45, 0.55, 0.5);
        for (let seg = 0; seg < 5; seg++) {
            const sc = new THREE.Mesh(new THREE.SphereGeometry(0.58 - seg * 0.07, 14, 12), scaleMat);
            sc.position.z = 0.5 - seg * 0.42; sc.scale.y = 0.82; sc.castShadow = true;
            pBody.add(sc);
        }
        const snout = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.65, 12), toyMat(0x92400E, 0.5, 0.2));
        snout.rotation.x = Math.PI / 2; snout.position.set(0, -0.05, 1.05);
        pBody.add(snout);
        grp.add(cave, pBody);
        guardianNodes.winter = { data: gInfo, grp, beacon, lbl };
    }

    // 8 個香港本土動植物生態觀察點
    const ambientNodes = [];
    HK_AMBIENT_SPECIES.forEach(sp => {
        const g = new THREE.Group();
        const gy = sp.id === 'pink_dolphin' ? PHYSICS.WATER_LEVEL : getTerrainHeight(sp.x, sp.z);
        g.position.set(sp.x, gy, sp.z);

        if (sp.id === 'romer_frog') {
            const leaf = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 16), toyMat(0x16A34A, 0.4, 0.4)); leaf.position.y = 0.1;
            const frog = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), toyMat(0x854D0E, 0.35, 0.6)); frog.scale.set(1.0, 0.8, 1.2); frog.position.y = 0.45;
            animatedFrog = frog; g.add(leaf, frog);
        } else if (sp.id === 'bell_flower') {
            const bush = new THREE.Mesh(new THREE.SphereGeometry(1.3, 14, 12), toyMat(0x15803D, 0.55, 0.2)); bush.position.y = 1.0; g.add(bush);
            for (let b = 0; b < 8; b++) {
                const bell = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.38, 10), toyMat(0xF472B6, 0.3, 0.6));
                const a = (b / 8) * Math.PI * 2;
                bell.position.set(Math.cos(a) * 1.15, 1.1 + (b % 2) * 0.35, Math.sin(a) * 1.15); g.add(bell);
            }
        } else if (sp.id === 'pink_dolphin') {
            const dol = new THREE.Group();
            const dBody = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 12), toyMat(0xFDA4AF, 0.2, 0.9)); dBody.scale.set(0.75, 0.8, 2.1);
            const dBeak = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 10), toyMat(0xFDA4AF, 0.2, 0.9)); dBeak.rotation.x = Math.PI / 2; dBeak.position.z = 1.45;
            const dFin = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 6), toyMat(0xFB7185, 0.2, 0.9)); dFin.position.y = 0.62;
            dol.add(dBody, dBeak, dFin); g.add(dol); animatedDolphin = dol;
        } else if (sp.id === 'fiddler_crab') {
            const cBody = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.42, 0.65), toyMat(0xDC2626, 0.35, 0.6)); cBody.position.y = 0.35;
            const bigClaw = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), toyMat(0xF97316, 0.3, 0.7)); bigClaw.scale.set(1.4, 0.85, 0.6); bigClaw.position.set(0.65, 0.55, 0.35);
            animatedCrabClaw = bigClaw; g.add(cBody, bigClaw);
        } else if (sp.id === 'sweet_gum') {
            const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 3.2, 10), toyMat(0x451A03, 0.7, 0.1)); tr.position.y = 1.6;
            const cr = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2), toyMat(0xDC2626, 0.4, 0.35)); cr.position.y = 3.8;
            g.add(tr, cr);
        } else if (sp.id === 'silvergrass') {
            for (let s = 0; s < 9; s++) {
                const stalk = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.9, 8), toyMat(0xFDE047, 0.45, 0.3));
                stalk.position.set((s % 3 - 1) * 0.65, 0.95, (Math.floor(s / 3) - 1) * 0.65); g.add(stalk);
            }
        } else if (sp.id === 'bulbul') {
            const perch = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.8, 8), toyMat(0x78350F, 0.7, 0.1)); perch.position.y = 0.9;
            const bird = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), toyMat(0x451A03, 0.45, 0.3)); bird.position.y = 2.05;
            const crest = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.52, 8), toyMat(0x0F172A, 0.3, 0.5)); crest.position.set(0, 2.55, 0.08);
            const redCheek = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), toyMat(0xEF4444, 0.3, 0.6)); redCheek.position.set(0.32, 2.05, 0.22);
            g.add(perch, bird, crest, redCheek);
        } else {
            const bush = new THREE.Mesh(new THREE.SphereGeometry(1.35, 14, 12), toyMat(0x064E3B, 0.5, 0.25)); bush.position.y = 1.0; g.add(bush);
            for (let c = 0; c < 6; c++) {
                const cam = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), toyMat(0xFFFFFF, 0.25, 0.6));
                const a = (c / 6) * Math.PI * 2;
                cam.position.set(Math.cos(a) * 1.15, 1.15, Math.sin(a) * 1.15); g.add(cam);
            }
        }

        const lbl = createLabelSprite(`${sp.icon} ${sp.name}`, '#1E293B', '#38BDF8', 4.4);
        lbl.position.y = 3.5;
        lbl.visible = false; // 走近時才顯示，保持畫面清爽不雜亂
        g.add(lbl);
        worldGroup.add(g);
        ambientNodes.push({ data: sp, grp: g, lbl, cooldown: 0 });
    });

    /* ── 9. 四季各 2 個固定任務點祭壇 ── */
    const missionNodes = [];
    const mColors = { spring: 0xEC4899, summer: 0x0EA5E9, autumn: 0xF97316, winter: 0x6366F1 };

    Object.keys(SEASON_MISSIONS).forEach(season => {
        SEASON_MISSIONS[season].forEach(mCfg => {
            const grp = new THREE.Group();
            const gy = getTerrainHeight(mCfg.x, mCfg.z);
            grp.position.set(mCfg.x, gy, mCfg.z);

            const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.65, 0.65, 18), toyMat(0x1E293B, 0.4, 0.4));
            ped.position.y = 0.32; ped.castShadow = true; ped.receiveShadow = true;

            const cryMat = new THREE.MeshPhysicalMaterial({
                color: mColors[season], roughness: 0.08, clearcoat: 1.0,
                emissive: mColors[season], emissiveIntensity: 0.35
            });
            const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 0), cryMat);
            crystal.scale.y = 1.35; crystal.position.y = 2.3; crystal.castShadow = true;

            const orbit = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.1, 10, 26), toyMat(0xFACC15, 0.2, 0.85, 0.5));
            orbit.position.y = 2.3; orbit.rotation.x = Math.PI / 2.3;

            const lbl = createLabelSprite(mCfg.label, '#0F172A', '#38BDF8', 5.0);
            lbl.position.y = 4.2;

            grp.add(ped, crystal, orbit, lbl);
            worldGroup.add(grp);

            missionNodes.push({
                id: mCfg.id, season, idx: mCfg.idx, label: mCfg.label,
                x: mCfg.x, z: mCfg.z, baseY: gy,
                grp, crystal, cryMat, orbit, lbl,
                done: false
            });
        });
    });

    /* ── 10. 景觀四季樹木 ── */
    const tGeo = {
        trunk: new THREE.CylinderGeometry(0.3, 0.5, 2.5, 8),
        puff:  new THREE.SphereGeometry(1.55, 12, 10),
        pine:  new THREE.ConeGeometry(1.9, 3.6, 10)
    };
    const tMat = {
        trunk: toyMat(0x451A03, 0.72, 0.1),
        spring: toyMat(0xF472B6, 0.42, 0.3),
        summer: toyMat(0x15803D, 0.38, 0.35),
        autumn: toyMat(0xEA580C, 0.45, 0.28),
        winter: toyMat(0x0F766E, 0.52, 0.2)
    };
    const swayTrees = [];
    function spawnTree(x, z, season) {
        if (getRiverInfo(x, z).dist < PHYSICS.RIVER_HALF_W + 3.0) return;
        if (Math.hypot(Math.abs(x) - 42, Math.abs(z) - 42) < 10) return;
        if (Math.hypot(Math.abs(x) - 72, Math.abs(z) - 72) < 8) return;
        for (let i = 0; i < missionNodes.length; i++) {
            if (Math.hypot(x - missionNodes[i].x, z - missionNodes[i].z) < 6.5) return;
        }
        const g = new THREE.Group();
        const tr = new THREE.Mesh(tGeo.trunk, tMat.trunk); tr.position.y = 1.25; tr.castShadow = true;
        const top = new THREE.Mesh(season === 'winter' ? tGeo.pine : tGeo.puff, tMat[season]);
        top.position.y = 3.2; top.castShadow = true;
        g.add(tr, top);
        g.scale.setScalar(0.85 + Math.random() * 0.35);
        g.position.set(x, getTerrainHeight(x, z) - 0.1, z);
        g.userData = { phase: Math.random() * Math.PI * 2, season };
        worldGroup.add(g);
        swayTrees.push(g);
    }
    for (let i = 0; i < 36; i++) {
        const rx = 20 + Math.random() * 64, rz = 20 + Math.random() * 64;
        spawnTree(-rx, -rz, 'spring'); spawnTree(rx, -rz, 'summer');
        spawnTree(-rx,  rz, 'autumn'); spawnTree(rx,  rz, 'winter');
    }

    /* ── 11. 深色高對比主角建模 ── */
    const blobShadowTex = (() => {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const g = c.getContext('2d');
        const r = g.createRadialGradient(32, 32, 4, 32, 32, 30);
        r.addColorStop(0, 'rgba(9,13,22,0.62)'); r.addColorStop(1, 'rgba(9,13,22,0)');
        g.fillStyle = r; g.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
    })();
    const blobGeo = new THREE.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);
    function createBlobShadow(sc = 2.2) {
        const m = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobShadowTex, transparent: true, depthWrite: false }));
        m.scale.set(sc, 1, sc); scene.add(m); return m;
    }

    const player = new THREE.Group();
    player.position.set(0, getTerrainHeight(0, 14), 14);
    scene.add(player);

    const locatorRing = new THREE.Mesh(
        new THREE.RingGeometry(0.88, 1.16, 32),
        new THREE.MeshBasicMaterial({ color: 0x0F172A, side: THREE.DoubleSide, transparent: true, opacity: 0.72 })
    );
    locatorRing.rotation.x = -Math.PI / 2; locatorRing.position.y = 0.05;
    player.add(locatorRing);

    const guideArrow = new THREE.Group();
    guideArrow.position.y = 4.25;
    const arrowShaft = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 1.15), toyMat(0xFACC15, 0.18, 0.9, 0.4));
    arrowShaft.position.z = -0.2;
    const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.95, 4), toyMat(0xEA580C, 0.2, 0.9, 0.3));
    arrowHead.rotation.x = Math.PI / 2; arrowHead.rotation.y = Math.PI / 4; arrowHead.position.z = 0.78;
    guideArrow.add(arrowShaft, arrowHead);
    guideArrow.visible = false;
    scene.add(guideArrow);

    const waterRipple = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 1.25, 28),
        new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide, transparent: true, opacity: 0.0 })
    );
    waterRipple.rotation.x = -Math.PI / 2;
    scene.add(waterRipple);

    const playerVisual = new THREE.Group();
    player.add(playerVisual);
    const playerShadow = createBlobShadow(2.35);

    const coatMat    = toyMat(0x172554, 0.36, 0.4);
    const trimMat    = toyMat(0xD97706, 0.3, 0.55);
    const hatMat     = toyMat(0x7F1D1D, 0.35, 0.45);
    const hairMat    = toyMat(0x09090B, 0.45, 0.25);
    const skinMat    = toyMat(0xC67D4B, 0.42, 0.18);
    const pantsMat   = toyMat(0x090D16, 0.48, 0.2);
    const bootMat    = toyMat(0x27120B, 0.4, 0.45);
    const whiteMat   = toyMat(0xF8FAFC, 0.3, 0.4);

    const torsoJacket = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.72, 1.2, 22), coatMat);
    torsoJacket.position.y = 1.42; torsoJacket.castShadow = true;
    const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.11, 10, 22), trimMat);
    collarRing.rotation.x = Math.PI / 2; collarRing.position.y = 1.98;
    const raincoatSkirt = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.72, 22, 1, true), coatMat);
    raincoatSkirt.position.y = 0.88; raincoatSkirt.visible = false;
    const pufferQuilt = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.14, 12, 22), coatMat);
    pufferQuilt.rotation.x = Math.PI / 2; pufferQuilt.position.y = 1.45; pufferQuilt.visible = false;

    const winterScarf = new THREE.Group();
    const scLoop = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.16, 10, 22), trimMat); scLoop.rotation.x = Math.PI / 2; scLoop.position.y = 2.02;
    const scTail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.68, 0.12), trimMat); scTail.position.set(0.28, 1.68, 0.6);
    winterScarf.add(scLoop, scTail); winterScarf.visible = false;

    const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.6, 0.45, 20), pantsMat);
    hips.position.y = 0.82; hips.castShadow = true;

    const backpackGrp = new THREE.Group();
    backpackGrp.position.set(0, 1.44, -0.6);
    const packMain = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.9, 0.46), toyMat(0x3B1806, 0.5, 0.25)); packMain.castShadow = true;
    const packFlap = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.28, 0.5), toyMat(0x78350F, 0.4, 0.3)); packFlap.position.y = 0.34;
    backpackGrp.add(packMain, packFlap);

    const headGrp = new THREE.Group();
    headGrp.position.y = 2.55;
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.68, 22, 18), skinMat); headMesh.castShadow = true;
    const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.72), hairMat); hairBack.rotation.x = -0.28;
    headGrp.add(headMesh, hairBack);
    [-0.25, 0, 0.25].forEach((bx, idx) => {
        const bang = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.38, 8), hairMat);
        bang.position.set(bx, 0.38, 0.56 - Math.abs(bx) * 0.14);
        bang.rotation.x = Math.PI * 0.88; bang.rotation.z = (idx - 1) * 0.18;
        headGrp.add(bang);
    });

    const eyeBlackMat = toyMat(0x09090B, 0.08, 1.0);
    [-0.24, 0.24].forEach(ex => {
        const ew = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), whiteMat); ew.scale.set(1.0, 1.2, 0.55); ew.position.set(ex, 0.03, 0.59);
        const ep = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 10), eyeBlackMat); ep.scale.y = 1.25; ep.position.set(ex, 0.03, 0.64);
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.065, 0.06), hairMat); brow.position.set(ex, 0.24, 0.62);
        headGrp.add(ew, ep, brow);
    });

    const capGroup = new THREE.Group();
    const capDome = new THREE.Mesh(new THREE.SphereGeometry(0.74, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), hatMat); capDome.position.y = 0.08;
    const capBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.79, 0.09, 18, 1, false, -Math.PI * 0.42, Math.PI * 0.84), hatMat); capBrim.position.set(0, 0.12, 0.28);
    capGroup.add(capDome, capBrim);

    const sunHatGroup = new THREE.Group();
    const shTop = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.68, 0.48, 20), hatMat); shTop.position.y = 0.46;
    const shBrim = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.22, 0.08, 24), hatMat); shBrim.position.y = 0.24;
    sunHatGroup.add(shTop, shBrim); sunHatGroup.visible = false;

    const rainHoodGroup = new THREE.Group();
    const rhShell = new THREE.Mesh(new THREE.SphereGeometry(0.78, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.68), hatMat); rhShell.rotation.x = -0.22; rhShell.position.y = 0.04;
    rainHoodGroup.add(rhShell); rainHoodGroup.visible = false;

    const beanieGroup = new THREE.Group();
    const bnDome = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hatMat); bnDome.position.y = 0.08;
    const bnPom = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), trimMat); bnPom.position.y = 0.88;
    beanieGroup.add(bnDome, bnPom); beanieGroup.visible = false;

    headGrp.add(capGroup, sunHatGroup, rainHoodGroup, beanieGroup);

    const gearGlasses = new THREE.Group();
    const lensM = toyMat(0x09090B, 0.06, 1.0, 0.65);
    const gL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.1), lensM); gL.position.set(-0.24, 0.05, 0.69);
    const gR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.1), lensM); gR.position.set( 0.24, 0.05, 0.69);
    gearGlasses.add(gL, gR); gearGlasses.visible = false;
    headGrp.add(gearGlasses);

    const gearCrown = new THREE.Group();
    const crBand = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.42, 0.36, 16), toyMat(0xFACC15, 0.18, 0.9, 0.7)); crBand.position.y = 0.92;
    gearCrown.add(crBand); gearCrown.visible = false;
    headGrp.add(gearCrown);

    const gearCape = new THREE.Mesh(new THREE.BoxGeometry(1.24, 1.5, 0.08), toyMat(0x7F1D1D, 0.4, 0.35));
    gearCape.position.set(0, 1.24, -0.66); gearCape.visible = false;

    function makeArm(side) {
        const pivot = new THREE.Group(); pivot.position.set(side * 0.78, 1.82, 0);
        const slv = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.18, 0.46, 12), coatMat); slv.position.y = -0.19; slv.castShadow = true;
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.34, 12), skinMat); arm.position.y = -0.48;
        const hnd = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 10), skinMat); hnd.position.y = -0.68;
        pivot.add(slv, arm, hnd); return pivot;
    }
    function makeLeg(side) {
        const pivot = new THREE.Group(); pivot.position.set(side * 0.31, 0.72, 0);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.54, 12), pantsMat); leg.position.y = -0.26; leg.castShadow = true;
        const boot = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), bootMat); boot.scale.set(0.96, 0.76, 1.38); boot.position.set(0, -0.55, 0.09); boot.castShadow = true;
        pivot.add(leg, boot); return pivot;
    }
    const leftArm = makeArm(-1), rightArm = makeArm(1);
    const leftLeg = makeLeg(-1), rightLeg = makeLeg(1);

    const propSocket = new THREE.Group(); propSocket.position.set(0, -0.68, 0.12); rightArm.add(propSocket);
    const propsMap = {};

    const pMag = new THREE.Group();
    const mgH = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.55, 10), bootMat); mgH.rotation.x = Math.PI / 2; mgH.position.z = 0.25;
    const mgR = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 10, 20), toyMat(0xD97706, 0.25, 0.8, 0.6)); mgR.position.set(0, 0.08, 0.68);
    pMag.add(mgH, mgR); propsMap.magnifier = pMag;

    const pUmb = new THREE.Group();
    const umS = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.25, 8), whiteMat); umS.position.set(-0.25, 1.05, 0.15);
    const umC = new THREE.Mesh(new THREE.ConeGeometry(1.55, 0.72, 12), toyMat(0xDC2626, 0.3, 0.6)); umC.position.set(-0.25, 2.15, 0.15);
    pUmb.add(umS, umC); propsMap.umbrella = pUmb;

    const pFlash = new THREE.Group();
    const flB = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.58, 12), toyMat(0xD97706, 0.25, 0.7)); flB.rotation.x = Math.PI / 2; flB.position.z = 0.25;
    const flBeam = new THREE.Mesh(new THREE.ConeGeometry(1.3, 5.0, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xFEF08A, transparent: true, opacity: 0.24, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    flBeam.rotation.x = -Math.PI / 2; flBeam.position.z = 3.1;
    pFlash.add(flB, flBeam); propsMap.flashlight = pFlash;

    const pFan = new THREE.Group();
    const fnG = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.48, 10), toyMat(0x0284C7, 0.3, 0.6)); fnG.position.set(0, 0.18, 0.35);
    const fanBlades = new THREE.Group(); fanBlades.position.set(0, 0.5, 0.38);
    for (let b = 0; b < 3; b++) {
        const bl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.02), whiteMat);
        bl.rotation.z = (b * Math.PI * 2) / 3; fanBlades.add(bl);
    }
    pFan.add(fnG, fanBlades); propsMap.fan = pFan;

    const pBino = new THREE.Group();
    [-0.16, 0.16].forEach(bx => {
        const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.5, 12), pantsMat);
        tb.rotation.x = Math.PI / 2; tb.position.set(bx, 0.06, 0.36); pBino.add(tb);
    });
    propsMap.binoculars = pBino;

    const pTherm = new THREE.Group();
    const thB = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.68, 14), toyMat(0x991B1B, 0.25, 0.85)); thB.position.set(0, 0.15, 0.32);
    pTherm.add(thB); propsMap.thermos = pTherm;

    const pLant = new THREE.Group();
    const lnC = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.4, 12), new THREE.MeshBasicMaterial({ color: 0xFEF08A })); lnC.position.set(0, -0.35, 0.35);
    const lnLight = new THREE.PointLight(0xFBBF24, 1.3, 12, 2); lnLight.position.set(0, -0.35, 0.5);
    pLant.add(lnC, lnLight); propsMap.lantern = pLant;

    Object.keys(propsMap).forEach(k => { propsMap[k].visible = (k === 'magnifier'); propSocket.add(propsMap[k]); });

    playerVisual.add(torsoJacket, collarRing, raincoatSkirt, pufferQuilt, winterScarf, hips, backpackGrp, gearCape, headGrp, leftArm, rightArm, leftLeg, rightLeg);
    player.scale.setScalar(1.08);

    let activePropKey = 'magnifier';
    function applyWeatherOutfit(outfit) {
        coatMat.color.setHex(outfit.coat);
        trimMat.color.setHex(outfit.trim);
        hatMat.color.setHex(outfit.hatCol);
        raincoatSkirt.visible = (outfit.style === 'raincoat');
        pufferQuilt.visible   = (outfit.style === 'puffer' || outfit.style === 'puffer_scarf');
        winterScarf.visible   = (outfit.style === 'puffer_scarf');
        if (!gearCrown.visible) {
            capGroup.visible = (outfit.hat === 'cap');
            sunHatGroup.visible = (outfit.hat === 'sunhat');
            rainHoodGroup.visible = (outfit.hat === 'rainhood');
            beanieGroup.visible = (outfit.hat === 'beanie');
        }
        activePropKey = outfit.prop;
        Object.keys(propsMap).forEach(k => { propsMap[k].visible = (k === activePropKey); });
    }

    /* ── 12. 4 隻百厭小猴子 ── */
    const monkeys = [];
    const furMat = toyMat(0x78350F, 0.55, 0.2);
    const faceMat = toyMat(0xFDE68A, 0.48, 0.2);
    [
        { season: 'spring', xMin: -68, xMax: -16, zMin: -68, zMax: -16, sx: -25, sz: -24 },
        { season: 'summer', xMin:  16, xMax:  68, zMin: -68, zMax: -16, sx:  25, sz: -24 },
        { season: 'autumn', xMin: -68, xMax: -16, zMin:  16, zMax:  68, sx: -25, sz:  24 },
        { season: 'winter', xMin:  16, xMax:  68, zMin:  16, zMax:  68, sx:  25, sz:  24 }
    ].forEach(z => {
        const mg = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 12), furMat); body.scale.y = 1.15; body.position.y = 1.0; body.castShadow = true;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.54, 14, 12), furMat); head.position.y = 1.95; head.castShadow = true;
        const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 10), faceMat); muzzle.position.set(0, 1.88, 0.4);
        mg.add(body, head, muzzle);
        mg.position.set(z.sx, getTerrainHeight(z.sx, z.sz), z.sz);
        scene.add(mg);
        const sh = createBlobShadow(1.6);
        monkeys.push({ mesh: mg, shadow: sh, zone: z, season: z.season, dirAngle: Math.random() * Math.PI * 2, changeTimer: 1.5, cooldown: 0, hopPhase: Math.random() * Math.PI * 2 });
    });

    /* ── 13. 天氣粒子系統 ── */
    const PARTICLE_COUNT = 380;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(PARTICLE_COUNT * 3);
    const pSeeds = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        pPos[i * 3] = (Math.random() - 0.5) * 110;
        pPos[i * 3 + 1] = Math.random() * 36;
        pPos[i * 3 + 2] = (Math.random() - 0.5) * 110;
        pSeeds[i] = Math.random() * Math.PI * 2;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const weatherPoints = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xFFFFFF, size: 0.5, transparent: true, opacity: 0.85 }));
    weatherPoints.visible = false;
    scene.add(weatherPoints);

    const P_MODES = {
        petals:      { color: 0xF472B6, size: 0.55, fall:  3.0, flutter: 1.8, op: 0.9 },
        mist:        { color: 0xF8FAFC, size: 1.4,  fall:  0.7, flutter: 1.1, op: 0.42 },
        rain:        { color: 0xBAE6FD, size: 0.38, fall: 19.5, flutter: 0.0, op: 0.85 },
        sun_sparkle: { color: 0xFEF08A, size: 0.44, fall:  0.9, flutter: 1.4, op: 0.72 },
        storm:       { color: 0xE0F2FE, size: 0.46, fall: 27.0, flutter: 0.4, op: 0.95 },
        leaves:      { color: 0xFB923C, size: 0.58, fall:  4.2, flutter: 2.2, op: 0.92 },
        leaves_fast: { color: 0xEA580C, size: 0.62, fall:  5.8, flutter: 3.2, op: 0.94 },
        snow_light:  { color: 0xFFFFFF, size: 0.44, fall:  2.8, flutter: 1.3, op: 0.82 },
        snow:        { color: 0xFFFFFF, size: 0.52, fall:  4.4, flutter: 1.8, op: 0.92 },
        blizzard:    { color: 0xF8FAFC, size: 0.62, fall:  7.0, flutter: 2.6, op: 0.96 }
    };

    GameApp.World = {
        scene, camera, renderer, sunLight, hemiLight,
        LANDMARKS, BRIDGES, MOUNTAIN_PEAKS,
        riverCenterX, riverCenterZ, getRiverInfo,
        getTerrainHeight, getTerrainGradient, getBridgeDeckHeight, resolveHorizontalWorld,
        riverFlowTex, weatherVane, swayTrees,
        player, playerVisual, playerShadow, waterRipple, guideArrow,
        coatMat, hatMat, capGroup, sunHatGroup, rainHoodGroup, beanieGroup,
        gearGlasses, gearCape, gearCrown,
        leftArm, rightArm, leftLeg, rightLeg,
        fanBlades, applyWeatherOutfit, getActiveProp: () => activePropKey,
        missionNodes, guardianNodes, ambientNodes, monkeys,
        updateEcologyAnim(elapsed) {
            animatedButterflies.forEach((bf, idx) => {
                const a = elapsed * 2.2 + bf.phase;
                bf.mesh.position.set(Math.cos(a) * 2.7, 3.2 + Math.sin(a * 2) * 0.5, Math.sin(a) * 2.7);
                bf.mesh.rotation.y = -a;
                const flap = Math.sin(elapsed * 16 + idx) * 0.65;
                bf.wL.rotation.z = flap; bf.wR.rotation.z = -flap;
            });
            if (animatedSpoonbillHead) animatedSpoonbillHead.rotation.y = Math.sin(elapsed * 2.4) * 0.55;
            if (animatedDolphin) {
                const jp = (elapsed * 1.6) % (Math.PI * 2);
                animatedDolphin.position.y = -0.35 + Math.max(0, Math.sin(jp)) * 2.6;
                animatedDolphin.rotation.x = -Math.cos(jp) * 0.55;
            }
            if (animatedCrabClaw) animatedCrabClaw.position.y = 0.55 + Math.abs(Math.sin(elapsed * 5.0)) * 0.25;
            if (animatedFrog) animatedFrog.position.y = 0.45 + Math.max(0, Math.sin(elapsed * 4.5)) * 0.45;
        },
        weatherPoints, pSeeds, PARTICLE_COUNT, P_MODES,
        setHighQuality(hq) {
            renderer.setPixelRatio(hq ? Math.min(window.devicePixelRatio || 1, 2) : 1);
            renderer.shadowMap.enabled = hq;
            sunLight.castShadow = hq;
        }
    };
})();

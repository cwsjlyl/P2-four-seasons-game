/* =========================================================================
   四季小探險家 3D — 物理常數、香港動植物生態互動、天氣換裝與題庫資料
   ========================================================================= */
window.GameApp = window.GameApp || {};

(() => {
    'use strict';

    /* 1. 校準物理參數（支援流暢攀登高山、木拱橋通行、河流水阻與舒適天氣週期） */
    GameApp.PHYSICS = Object.freeze({
        WORLD_LIMIT: 94.0,          // 島嶼邊界半徑 (m)
        WATER_LEVEL: -0.32,         // 河流水面高度 (m)
        RIVER_HALF_W: 4.4,          // 河道半寬 (m)
        GRAVITY: -24.5,             // 重力加速度 (m/s²)
        JUMP_VELOCITY: 11.4,        // 起跳初速 (m/s)，方便跳上山坡岩石
        WALK_SPEED: 14.2,           // 正常行走速度 (m/s)
        SPRINT_SPEED: 22.5,         // 衝刺最高速度 (m/s)
        ACCEL_GROUND: 58.0,         // 地面推進加速度 (m/s²)，上山依然充沛有力
        ACCEL_AIR: 20.0,            // 空中微調加速度 (m/s²)
        MAX_CLIMB_SLOPE: 1.45,      // 允許攀登至約 55° 山坡，所有四季高山均可登頂！
        WATER_DRAG: 6.2,            // 河道涉水流體阻力 (1/s)
        RIVER_FLOW_SPEED: 2.5,      // 河水順流推力 (m/s²)
        PLAYER_RADIUS: 0.78,        // 玩家碰撞半徑 (m)
        MONKEY_RADIUS: 0.68,        // 小猴子碰撞半徑 (m)
        MAX_DT: 0.05,               // 單幀最大時間步長 (s)
        STAMINA_DRAIN: 22.0,        // 衝刺消耗體力 (%/s)
        STAMINA_REGEN: 26.0,        // 體力回復速度 (%/s)
        WEATHER_CYCLE_SEC: 95.0,    // 天氣自動轉變延長至 95 秒，節奏舒適不頻密！
        SURFACE_FRICTION: {
            plaza:  11.0,
            bridge: 10.6,
            spring: 8.8,
            summer: 9.2,
            autumn: 9.6,
            winter: 4.5
        }
    });

    GameApp.SEASON_META = Object.freeze({
        plaza:  { short: '中央廣場', name: '🏛️ 中央科學廣場', surface: '石磚廣場', tagBg: '#FEF08A', tagColor: '#854D0E', sky: 0x38BDF8, fog: 0xBAE6FD, fogD: 0.0022, sun: 1.15, hemi: 0.88 },
        spring: { short: '春季園區', name: '🌸 春季百花園', surface: '春日山坡', tagBg: '#FBCFE8', tagColor: '#9D174D', sky: 0x7DD3FC, fog: 0xDCFCE7, fogD: 0.0024, sun: 1.08, hemi: 0.88 },
        summer: { short: '夏季園區', name: '🏖️ 夏季陽光灣', surface: '海岸沙坡', tagBg: '#BAE6FD', tagColor: '#0369A1', sky: 0x0EA5E9, fog: 0xBAE6FD, fogD: 0.0020, sun: 1.32, hemi: 0.92 },
        autumn: { short: '秋季園區', name: '🍁 秋季紅葉谷', surface: '紅葉山徑', tagBg: '#FED7AA', tagColor: '#9A3412', sky: 0x60A5FA, fog: 0xFFEDD5, fogD: 0.0022, sun: 1.12, hemi: 0.85 },
        winter: { short: '冬季園區', name: '⛄ 冬季大帽山嶺', surface: '結霜高地', tagBg: '#E2E8F0', tagColor: '#1E3A8A', sky: 0x94A3B8, fog: 0xE2E8F0, fogD: 0.0028, sun: 0.92, hemi: 0.92 }
    });

    /* 2. 四季香港特色動植物互動系統（每區 1 個大獎章守護物種 + 2 個香港本土動植物互動點） */
    GameApp.HK_GUARDIANS = Object.freeze({
        spring: {
            id: 'bauhinia',
            season: 'spring',
            badgeName: '紫荊花露大獎章',
            name: '🌺 香港市花洋紫荊與鳳蝶',
            x: -55, z: -32,
            prompt: '你已完成春季 2 個任務點！請跟隨金色箭嘴前往【🌺 洋紫荊與鳳蝶】進行生態互動！',
            intro: '洋紫荊在香港首次被發現，紫紅色五片花瓣在春天盛開，吸引鳳蝶前來採蜜！',
            quiz: {
                q: '我們來到香港市花「🌺 洋紫荊」樹下觀察鳳蝶！請問洋紫荊的花朵有甚麼特別之處？',
                opts: ['有五片紫紅色花瓣，而且通常不會結果實', '花瓣是純黑色的，只在嚴寒下雪時盛開', '長在海底珊瑚礁裏面'],
                ans: 0,
                teach: '太棒了！洋紫荊是香港的象徵，擁有五片美麗的紫紅色花瓣，春天開花時最迷人！恭喜獲得【紫荊花露大獎章】！'
            }
        },
        summer: {
            id: 'seaturtle',
            season: 'summer',
            badgeName: '碧浪綠龜大獎章',
            name: '🐢 南丫島深灣綠海龜',
            x: 32, z: -56,
            prompt: '你已完成夏季 2 個任務點！請跟隨金色箭嘴前往沙灘尋找【🐢 綠海龜】互動！',
            intro: '綠海龜是受保護的海洋爬行動物，每年夏天都會游回香港南丫島深灣沙灘產卵！',
            quiz: {
                q: '夏天「🐢 綠海龜」游回香港南丫島深灣沙灘產卵，作為愛護自然的小學生應該怎樣做？',
                opts: ['保持安靜不打擾牠們，並帶走沙灘上的垃圾', '大聲尖叫並騎在海龜背上拍照', '把膠袋丟進海裏餵海龜吃'],
                ans: 0,
                teach: '非常有愛心！保護沙灘清潔及在夏季繁殖期不騷擾綠海龜，才能讓海龜寶寶平安孵化！恭喜獲得【碧浪綠龜大獎章】！'
            }
        },
        autumn: {
            id: 'spoonbill',
            season: 'autumn',
            badgeName: '金楓琵鷺大獎章',
            name: '🦩 米埔濕地黑臉琵鷺',
            x: -29, z: 56,
            prompt: '你已完成秋季 2 個任務點！請跟隨金色箭嘴前往河岸濕地尋找【🦩 黑臉琵鷺】互動！',
            intro: '黑臉琵鷺是世界珍稀候鳥，每年秋天都會飛來香港米埔濕地，用湯匙形狀的黑嘴在淺水覓食！',
            quiz: {
                q: '秋天飛來香港米埔的珍貴候鳥「🦩 黑臉琵鷺」，牠黑色的嘴巴像甚麼形狀，方便在淺水掃動捉小魚蝦？',
                opts: ['像中國傳統樂器琵琶或大湯匙一樣扁闊', '像尖尖的縫衣針一樣細小', '像正方形的積木一樣'],
                ans: 0,
                teach: '觀察得好仔細！黑臉琵鷺的嘴扁平寬闊像琵琶和湯匙，最擅長在濕地淺水中左右掃動覓食！恭喜獲得【金楓琵鷺大獎章】！'
            }
        },
        winter: {
            id: 'pangolin',
            season: 'winter',
            badgeName: '霜晶穿山甲大獎章',
            name: '🦔 香港中華穿山甲',
            x: 56, z: 30,
            prompt: '你已完成冬季 2 個任務點！請跟隨金色箭嘴前往山林岩洞尋找【🦔 中華穿山甲】互動！',
            intro: '中華穿山甲全身披著堅硬鱗片，是香港極度珍貴的受保護野生哺乳動物，冬天會躲進溫暖洞穴避寒！',
            quiz: {
                q: '冬天在香港山林洞穴保暖的「🦔 中華穿山甲」遇到危險或寒冷時，會怎樣保護自己？',
                opts: ['把身體捲縮成一個堅硬的鱗片球', '展開彩色羽毛飛上高空', '吐出熊熊烈火取暖'],
                ans: 0,
                teach: '完全正確！中華穿山甲沒有牙齒，專吃白蟻保護樹林，遇到危險或寒風時會捲成球狀保護腹部！恭喜獲得【霜晶穿山甲大獎章】！'
            }
        }
    });

    // 各季額外香港特色動植物生態觀察點（走近自動彈出廣東話趣味介紹！）
    GameApp.HK_AMBIENT_SPECIES = Object.freeze([
        { id: 'romer_frog', season: 'spring', icon: '🐸', name: '盧氏小樹蛙', x: -27, z: -36, fact: '盧氏小樹蛙係香港特有嘅迷你青蛙，身型只有手指頭咁大，春天最鍾意喺濕潤樹林鳴叫！' },
        { id: 'bell_flower', season: 'spring', icon: '🌷', name: '香港吊鐘花', x: -62, z: -48, fact: '吊鐘花喺春天農曆新年前後開花，粉紅色花朵好似一個個倒掛嘅小鈴鐺，受法例保護唔可以採摘㗎！' },
        { id: 'pink_dolphin', season: 'summer', icon: '🐬', name: '中華白海豚', x: 18, z: -64, fact: '大嶼山對開海面嘅中華白海豚成年後身體呈粉紅色，係香港珍貴嘅海洋吉祥物！' },
        { id: 'fiddler_crab', season: 'summer', icon: '🦀', name: '香港招潮蟹', x: 56, z: -26, fact: '夏天退潮時，泥灘上嘅雄性招潮蟹會不斷揮動一隻超大嘅鉗仔，好似同太陽招手咁！' },
        { id: 'sweet_gum', season: 'autumn', icon: '🍁', name: '大欖楓香樹', x: -58, z: 32, fact: '元朗大欖郊野公園嘅楓香樹葉有裂片，每逢秋冬轉涼就會變成金黃同火紅色！' },
        { id: 'silvergrass', season: 'autumn', icon: '🌾', name: '大東山金黃芒草', x: -66, z: 66, fact: '秋天登上高山，滿山芒草喺陽光下閃耀金光，隨秋風搖曳超級壯觀！' },
        { id: 'bulbul', season: 'winter', icon: '🐦', name: '香港紅耳鵯', x: 30, z: 54, fact: '紅耳鵯頭頂有黑色高冠，臉頰有一點鮮紅色，冬天喺香港公園同山林經常聽到牠清脆嘅叫聲！' },
        { id: 'camellia', season: 'winter', icon: '🌺', name: '香港茶（山茶花）', x: 64, z: 62, fact: '香港茶係少數喺寒冷冬季依然盛開白色花朵嘅香港原生植物，生命力非常頑強！' }
    ]);

    /* 3. 四季各 2 個固定任務點座標（任務 ① 設於河畔平原，任務 ② 設於可攀登高山觀景台！） */
    GameApp.SEASON_MISSIONS = Object.freeze({
        spring: [
            { id: 'spring_m1', idx: 0, label: '春任務 ① 河畔花徑', x: -32, z: -56 },
            { id: 'spring_m2', idx: 1, label: '春任務 ② 櫻花山頂', x: -72, z: -72 }
        ],
        summer: [
            { id: 'summer_m1', idx: 0, label: '夏任務 ① 陽光沙岸', x:  58, z: -34 },
            { id: 'summer_m2', idx: 1, label: '夏任務 ② 望海山頂', x:  72, z: -72 }
        ],
        autumn: [
            { id: 'autumn_m1', idx: 0, label: '秋任務 ① 紅葉林間', x: -56, z:  54 },
            { id: 'autumn_m2', idx: 1, label: '秋任務 ② 芒草山巔', x: -72, z:  72 }
        ],
        winter: [
            { id: 'winter_m1', idx: 0, label: '冬任務 ① 冰屋雪徑', x:  36, z:  60 },
            { id: 'winter_m2', idx: 1, label: '冬任務 ② 大帽霜峰', x:  72, z:  72 }
        ]
    });

    /* 4. 動態天氣配置（深色高對比服裝，答對僅更換外觀與手提物品，不發放獎章） */
    GameApp.WEATHER_STATES = {
        spring: [
            {
                id: 'spring_warm', icon: '🌤️', name: '溫暖春日晴天', sfx: 'birds',
                sky: 0x7DD3FC, fog: 0xDCFCE7, fogD: 0.0022, sun: 1.12, hemi: 0.9, windX: 0.8, pMode: 'petals',
                alert: '春天陽光溫暖微風吹拂！回答問題即可換上春日探索裝束！',
                outfit: { label: '深森綠長袖探索裝＋🔍放大鏡', coat: 0x14532D, trim: 0xFACC15, style: 'jacket', hat: 'cap', hatCol: 0x9A3412, prop: 'magnifier' },
                quiz: {
                    q: '天氣轉為「🌤️ 溫暖春日晴天」，換上哪套衣著和手提物品最適合觀察春日動植物？',
                    opts: ['深綠色薄長袖探索外套，手提生態放大鏡', '極地厚重雪地羽絨衣，手提暖手營燈', '密封防颱風暴雨衣，手提應急強光電筒'],
                    ans: 0,
                    teach: '春日晴天溫暖舒適，穿薄長袖探索外套並手提放大鏡最適合觀察植物發芽與昆蟲！'
                }
            },
            {
                id: 'spring_fog', icon: '🌫️', name: '潮濕回南濃霧', sfx: 'fog',
                sky: 0x94A3B8, fog: 0xCBD5E1, fogD: 0.0075, sun: 0.72, hemi: 0.8, windX: 0.4, pMode: 'mist',
                alert: '春天出現「回南天濃霧」，四周濕潤濛瀧！快回答問題換上防潮照明裝備！',
                outfit: { label: '深海藍防潮風褸＋🔦防霧電筒', coat: 0x1E3A8A, trim: 0x38BDF8, style: 'windbreaker', hat: 'cap', hatCol: 0x0F172A, prop: 'flashlight' },
                quiz: {
                    q: '天氣轉為「🌫️ 潮濕回南濃霧」，視線較模糊而且空氣潮濕，應該換上甚麼外觀裝備？',
                    opts: ['穿深海藍防潮輕便風褸，手提防霧手電筒照亮前路', '穿單薄無袖背心，手提小風扇吹風', '穿厚冷衫圍巾，手提望遠鏡看遠方'],
                    ans: 0,
                    teach: '回南天濃霧濕度極高，穿防潮風褸可阻隔水氣，手提手電筒更能安全照亮山徑！'
                }
            },
            {
                id: 'spring_rain', icon: '🌧️', name: '春雨綿綿', sfx: 'rain',
                sky: 0x64748B, fog: 0x94A3B8, fogD: 0.0045, sun: 0.68, hemi: 0.76, windX: 1.5, pMode: 'rain',
                alert: '天空飄起綿綿春雨喇！回答問題換上防雨衣著同雨傘啦！',
                outfit: { label: '深酒紅防水雨衣＋☂️擋雨傘', coat: 0x881337, trim: 0xFACC15, style: 'raincoat', hat: 'rainhood', hatCol: 0x881337, prop: 'umbrella' },
                quiz: {
                    q: '春季下起「🌧️ 春雨綿綿」，應該換上甚麼衣著和手提物品避免淋濕？',
                    opts: ['穿防水連帽雨衣，手提雨傘擋雨', '穿不防水的厚棉襖，手提放大鏡', '只穿短袖衫，手提水壺擋雨'],
                    ans: 0,
                    teach: '春雨綿綿時穿上防水雨衣並撐起雨傘，保持乾爽就唔怕著涼啦！'
                }
            }
        ],
        summer: [
            {
                id: 'summer_sunny', icon: '☀️', name: '烈日酷熱晴天', sfx: 'cicada',
                sky: 0x0EA5E9, fog: 0xBAE6FD, fogD: 0.0018, sun: 1.38, hemi: 0.94, windX: -1.0, pMode: 'sun_sparkle',
                alert: '夏日陽光猛烈、蟬鳴陣陣！回答問題換上消暑防曬裝備！',
                outfit: { label: '深古銅橙防曬衫＋🌀冰涼小風扇', coat: 0x9A3412, trim: 0xFACC15, style: 'tshirt', hat: 'sunhat', hatCol: 0x78350F, prop: 'fan' },
                quiz: {
                    q: '夏季轉為「☀️ 烈日酷熱晴天」，應該換上甚麼衣著和手提物品防曬消暑？',
                    opts: ['穿透氣短袖防曬衫配闊邊遮陽帽，手提冰涼小風扇', '穿厚重羽絨大衣配毛線冷帽，手提暖手營燈', '穿密封長雨衣，手提防霧電筒'],
                    ans: 0,
                    teach: '酷熱晴天戴上闊邊遮陽帽並用便攜小風扇散熱，能有效預防曬傷與中暑！'
                }
            },
            {
                id: 'summer_rain', icon: '🌦️', name: '夏日驟雨', sfx: 'rain',
                sky: 0x475569, fog: 0x94A3B8, fogD: 0.0045, sun: 0.72, hemi: 0.75, windX: -2.6, pMode: 'rain',
                alert: '夏季突然落起嘩啦嘩啦驟雨！回答問題換上雨具啦！',
                outfit: { label: '深寶藍防水雨衣＋☂️大雨傘', coat: 0x1E40AF, trim: 0xFDE047, style: 'raincoat', hat: 'rainhood', hatCol: 0x1E40AF, prop: 'umbrella' },
                quiz: {
                    q: '夏季下起「🌦️ 夏日驟雨」，應該立刻換上甚麼衣著和手提物品？',
                    opts: ['穿防水雨衣，手提大雨傘遮擋雨水', '穿單薄背心淋雨，手提望遠鏡', '穿厚毛衣圍巾，手提放大鏡'],
                    ans: 0,
                    teach: '夏天常有突發驟雨，及時穿上防水雨衣及撐傘才不會全身濕透！'
                }
            },
            {
                id: 'summer_storm', icon: '⛈️', name: '狂風暴雨', sfx: 'storm',
                sky: 0x1E293B, fog: 0x334155, fogD: 0.0078, sun: 0.42, hemi: 0.5, windX: -8.0, pMode: 'storm', lightning: true,
                alert: '⚡ 雷電交加！夏季刮起「狂風暴雨」，回答問題換上最安全防風照明裝備！',
                outfit: { label: '深炭黑配金邊防風雨衣＋🔦防水電筒', coat: 0x1E293B, trim: 0xFACC15, style: 'raincoat', hat: 'rainhood', hatCol: 0x0F172A, prop: 'flashlight' },
                quiz: {
                    q: '天氣轉為「⛈️ 狂風暴雨」，強風會吹翻雨傘且天色昏暗，應該換上甚麼衣著與手提物品？',
                    opts: ['穿緊身防風連帽雨衣（配反光金邊），手提防水手電筒照明', '撐著普通大花傘站在山頂，手提小風扇', '穿短褲背心去河邊玩水，手提放大鏡'],
                    ans: 0,
                    teach: '狂風暴雨時撐傘容易被強風吹折，穿上防風連帽雨衣並手提防水電筒照明才最穩妥安全！'
                }
            }
        ],
        autumn: [
            {
                id: 'autumn_clear', icon: '🍂', name: '秋高氣爽晴天', sfx: 'birds',
                sky: 0x3B82F6, fog: 0xFFEDD5, fogD: 0.0020, sun: 1.15, hemi: 0.86, windX: 1.6, pMode: 'leaves',
                alert: '秋高氣爽！回答問題換上遠足觀鳥裝備！',
                outfit: { label: '深楓紅遠足外套＋🔭觀鳥望遠鏡', coat: 0x7F1D1D, trim: 0xF59E0B, style: 'jacket', hat: 'cap', hatCol: 0x1E293B, prop: 'binoculars' },
                quiz: {
                    q: '秋季轉為「🍂 秋高氣爽晴天」，最適合換上甚麼衣著和手提物品去登高觀鳥？',
                    opts: ['穿舒適長袖遠足外套，手提雙筒望遠鏡觀察候鳥', '穿極地厚雪衣，手提營燈冬眠', '穿密封雨衣，手提雨傘'],
                    ans: 0,
                    teach: '秋高氣爽最適合穿遠足外套登高，並用望遠鏡安靜欣賞米埔候鳥！'
                }
            },
            {
                id: 'autumn_windy', icon: '💨', name: '秋風起涼風陣陣', sfx: 'wind',
                sky: 0x60A5FA, fog: 0xFED7AA, fogD: 0.0032, sun: 1.0, hemi: 0.8, windX: 5.0, pMode: 'leaves_fast',
                alert: '呼—呼—秋風吹起轉涼喇！回答問題換上防風保暖裝備！',
                outfit: { label: '深焦糖棕防風衣＋🥤溫水保溫壺', coat: 0x78350F, trim: 0xFACC15, style: 'windbreaker', hat: 'cap', hatCol: 0x451A03, prop: 'thermos' },
                quiz: {
                    q: '秋季轉為「💨 秋風起涼風陣陣」，應該換上甚麼衣著和手提物品擋風暖身？',
                    opts: ['穿防風長袖風衣外套，手提溫水保溫壺', '穿短袖背心，手提冰涼小風扇', '穿暴雨衣，手提手電筒'],
                    ans: 0,
                    teach: '秋風吹起帶涼意，穿上防風長袖外套並手提溫水壺補充水分最合適！'
                }
            },
            {
                id: 'autumn_dry', icon: '🔥', name: '乾燥山火警告日', sfx: 'wind',
                sky: 0x2563EB, fog: 0xFEF3C7, fogD: 0.0020, sun: 1.22, hemi: 0.85, windX: 2.2, pMode: 'leaves',
                alert: '天氣非常乾燥！回答問題換上透氣補水郊遊裝備！',
                outfit: { label: '深靛藍長袖郊遊服＋💧補水水壺', coat: 0x312E81, trim: 0xFACC15, style: 'jacket', hat: 'sunhat', hatCol: 0x78350F, prop: 'thermos' },
                quiz: {
                    q: '秋季出現「🔥 乾燥山火警告日」，皮膚容易乾裂，應該換上甚麼衣著和手提物品？',
                    opts: ['穿純棉長袖郊遊服配遮陽帽，手提大容量水壺多喝水', '穿不透氣塑膠雨衣，手提放大鏡在乾草聚光', '只穿泳衣，手提小風扇'],
                    ans: 0,
                    teach: '風高物燥切勿生火或聚光！穿純棉長袖衣並多喝水可保護乾燥皮膚。'
                }
            }
        ],
        winter: [
            {
                id: 'winter_cool', icon: '🌥️', name: '清涼乾爽冬日', sfx: 'wind',
                sky: 0x93C5FD, fog: 0xE2E8F0, fogD: 0.0026, sun: 0.95, hemi: 0.9, windX: 1.5, pMode: 'snow_light',
                alert: '踏入清涼冬日！回答問題換上「洋蔥式」保暖穿搭！',
                outfit: { label: '深藏青羽絨背心＋🥤保溫暖水壺', coat: 0x172554, trim: 0xFACC15, style: 'puffer', hat: 'cap', hatCol: 0x0F172A, prop: 'thermos' },
                quiz: {
                    q: '冬季是「🌥️ 清涼乾爽冬日」，登山探索採用哪種衣著和手提物品最保暖靈活？',
                    opts: ['穿「洋蔥式」分層保暖背心長袖裝，手提保溫暖水壺', '穿夏天的薄短袖衫，手提小風扇', '穿薄雨衣，手提雨傘'],
                    ans: 0,
                    teach: '「洋蔥式」分層穿衣法方便登山時隨體溫調整，手提暖水壺更能隨時暖身！'
                }
            },
            {
                id: 'winter_cold', icon: '❄️', name: '寒冷季候風警告', sfx: 'cold_wind',
                sky: 0x64748B, fog: 0xCBD5E1, fogD: 0.0042, sun: 0.8, hemi: 0.88, windX: 4.6, pMode: 'snow',
                alert: '❄️ 寒冷天氣警告生效，北風強勁！回答問題換上厚羽絨同圍巾冷帽！',
                outfit: { label: '深紫紅厚羽絨配圍巾＋🔥保溫熱水瓶', coat: 0x581C87, trim: 0xDC2626, style: 'puffer_scarf', hat: 'beanie', hatCol: 0x7F1D1D, prop: 'thermos' },
                quiz: {
                    q: '冬季吹起強烈北風並發出「❄️ 寒冷天氣警告」，應該換上甚麼禦寒衣著和手提物品？',
                    opts: ['穿厚羽絨大衣、戴毛線冷帽和圍巾，手提保溫熱水瓶', '穿短袖衫配太陽帽，手提小風扇', '只穿薄風褸，手提放大鏡'],
                    ans: 0,
                    teach: '嚴寒北風下穿上厚羽絨大衣、戴上冷帽與圍巾並喝溫水，保暖效果最好！'
                }
            },
            {
                id: 'winter_frost', icon: '🌨️', name: '大帽山嚴寒結霜', sfx: 'cold_wind',
                sky: 0x475569, fog: 0xCBD5E1, fogD: 0.0062, sun: 0.72, hemi: 0.9, windX: 5.8, pMode: 'blizzard',
                alert: '🌨️ 高山嚴寒結霜！回答問題換上防寒大衣與溫暖手提營燈！',
                outfit: { label: '深栗紅極地防寒衣＋🏮溫暖營燈', coat: 0x7F1D1D, trim: 0xF59E0B, style: 'puffer_scarf', hat: 'beanie', hatCol: 0x1E293B, prop: 'lantern' },
                quiz: {
                    q: '高山冬季出現「🌨️ 嚴寒結霜」，氣溫接近 0°C，應該換上甚麼衣著和手提物品？',
                    opts: ['穿深紅防風厚羽絨大衣配冷帽圍巾，手提發光溫暖營燈', '穿沙灘短褲，手提雨傘', '穿薄襯衫，手提望遠鏡'],
                    ans: 0,
                    teach: '高山結霜時氣溫極低，穿防風厚羽絨大衣並手提溫暖營燈照亮山徑最安全！'
                }
            }
        ]
    };

    /* 5. 香港小二常識／科學科 40 題完整題庫 */
    GameApp.QUESTION_BANK = {
        spring: [
            { q: '香港春天的天氣通常是怎樣的？', opts: ['溫暖和潮濕', '寒冷而且下大雪', '酷熱而且非常乾燥'], ans: 0, exp: '春天受海洋氣流影響，香港天氣會變得溫暖而且潮濕。' },
            { q: '春天時，植物會有甚麼明顯的變化？', opts: ['抽出嫩芽和開出花朵', '樹葉全部變黃落下', '所有植物停止生長'], ans: 0, exp: '春天雨水充足、氣溫回升，植物會發芽和開花。' },
            { q: '香港春天「回南天」時，家裏的牆壁和地板常會怎樣？', opts: ['冒出小水珠，濕漉漉的', '結成厚厚的冰塊', '乾裂出很多縫隙'], ans: 0, exp: '溫暖潮濕的空氣遇到較冷的牆壁和地板，水氣便會凝結成小水珠。' },
            { q: '春天潮濕的日子，媽媽常用甚麼電器幫家裏吸走濕氣？', opts: ['抽濕機', '電暖爐', '加濕器'], ans: 0, exp: '抽濕機可以吸走空氣中多餘的水分，令室內保持乾爽。' },
            { q: '春天的早上，我們望向維多利亞港或山頭常會看見甚麼？', opts: ['白茫茫的薄霧', '漫天飄雪', '沙塵暴'], ans: 0, exp: '春天空氣濕度高，水氣容易在海面和山間聚集成薄霧。' },
            { q: '春天百花盛開，哪種小昆蟲最喜歡在花叢中採花蜜？', opts: ['蜜蜂和蝴蝶', '北極熊', '企鵝'], ans: 0, exp: '蜜蜂和蝴蝶會在春天飛到花朵上採食花蜜，順便幫植物傳播花粉。' },
            { q: '冬眠醒來的小青蛙，牠的寶寶叫甚麼名字？', opts: ['蝌蚪', '毛毛蟲', '孑孓'], ans: 0, exp: '青蛙媽媽在春天產卵，孵化出來的寶寶叫做蝌蚪，長大後才會長出四肢。' },
            { q: '春天氣溫乍暖還寒，我們外出時最好怎樣穿衣服？', opts: ['穿薄長袖或帶備薄外套', '穿最厚的羽絨大衣', '只穿泳衣出門'], ans: 0, exp: '春天早晚較涼、中午溫暖，帶備薄外套最能預防著涼。' },
            { q: '哪一個香港傳統節日通常在春天，人們會去掃墓紀念先人？', opts: ['清明節', '中秋節', '重陽節'], ans: 0, exp: '清明節在春季（約四月初），孝順的子孫會去拜祭和紀念先人。' },
            { q: '為甚麼春天洗完的衣服特別難乾？', opts: ['因為空氣濕度很高', '因為沒有地球引力', '因為太陽變小了'], ans: 0, exp: '春天空氣中已經有很多水分（濕度高），衣服裏的水分較難蒸發。' }
        ],
        summer: [
            { q: '香港夏天的天氣有甚麼主要特點？', opts: ['炎熱而且常有大雨或雷暴', '清涼而且非常乾燥', '寒冷而且結霜'], ans: 0, exp: '香港夏天日照強、氣溫高，而且雨水特別多，常有雷陣雨。' },
            { q: '夏天當颱風吹襲香港時，哪個機構會發出熱帶氣旋警告信號？', opts: ['香港天文台', '香港圖書館', '香港郵政局'], ans: 0, exp: '香港天文台負責監測天氣，並發出颱風及暴雨警告信號保障市民安全。' },
            { q: '當香港天文台發出「黑色暴雨警告」時，正在家中的小學生應該怎樣做？', opts: ['留在安全室內，不用上學', '自己去海灘游泳', '去山澗捉小魚'], ans: 0, exp: '黑雨代表雨勢極大並可能水浸，學生應留在安全的地方，不應外出涉水。' },
            { q: '夏天在陽光下做運動，為了預防中暑，我們應該怎樣做？', opts: ['多喝水並在陰涼處休息', '完全不喝水繼續跑', '穿上厚毛衣保暖'], ans: 0, exp: '夏天流汗多，及時補充水分和在陰涼處散熱可以有效預防中暑。' },
            { q: '夏天外出到沙灘玩耍時，塗上甚麼可以保護皮膚免被曬傷？', opts: ['防曬用品', '潤唇膏', '漿糊筆'], ans: 0, exp: '夏天紫外線很強，塗防曬用品和戴太陽帽能保護皮膚免受灼傷。' },
            { q: '夏天在公園的樹上，哪種昆蟲會發出「知—知—」的響亮叫聲？', opts: ['蟬（知了）', '螢火蟲', '螞蟻'], ans: 0, exp: '雄性的蟬在夏天會振動腹部的發音器，發出響亮的鳴叫聲。' },
            { q: '以下哪個節日在夏天舉行，大家會看扒龍舟和吃糉子？', opts: ['端午節', '農曆新年', '聖誕節'], ans: 0, exp: '農曆五月初五端午節正值初夏，扒龍舟和吃糉子是傳統習俗。' },
            { q: '夏天開冷氣機時，把溫度調校在約多少度既舒適又環保省電？', opts: ['約 25.5°C', '10°C 結冰溫度', '38°C 高溫'], ans: 0, exp: '將冷氣溫度設在約 25.5°C 並配合風扇，既涼快又能節約能源！' },
            { q: '夏天哪種水果多汁又清甜，切開裏面通常是紅肉黑籽的？', opts: ['西瓜', '栗子', '柿餅'], ans: 0, exp: '西瓜是夏季當造水果，含有豐富水分，非常消暑解渴。' },
            { q: '夏天雷暴發生時，我們在戶外應該避開甚麼地方？', opts: ['空曠高地和大樹下', '安全的室內建築物', '有避雷針的大廈內'], ans: 0, exp: '閃電容易擊中孤立的大樹和高處，雷暴時應盡快進入室內暫避。' }
        ],
        autumn: [
            { q: '香港秋天的天氣給人甚麼感覺？', opts: ['秋高氣爽，清涼乾爽', '悶熱潮濕常有大霧', '嚴寒而且下冰雹'], ans: 0, exp: '秋天陽光柔和、濕度下降，微風清涼，是一年中最舒適的季節之一。' },
            { q: '秋天到了，香港大欖郊野公園的楓香樹葉會變成甚麼顏色？', opts: ['橙黃色和紅色', '螢光藍色', '純黑色'], ans: 0, exp: '氣溫轉涼時，楓香樹葉內的葉綠素減少，便會呈現美麗的橙紅色彩。' },
            { q: '秋天哪一個傳統節日，一家人會一起賞月、吃月餅和玩燈籠？', opts: ['中秋節', '端午節', '清明節'], ans: 0, exp: '農曆八月十五是中秋節，象徵團圓，大家會賞月和提燈籠。' },
            { q: '秋天風高物燥，去郊野公園遠足時要特別提防甚麼災害？', opts: ['山火', '海嘯', '雪崩'], ans: 0, exp: '秋天草木乾枯，一點小火種就可能引發山火，所以郊遊切勿亂丟火種。' },
            { q: '香港天文台在非常乾燥的日子會發出「紅色火災危險警告」，提醒大家甚麼？', opts: ['火災極易發生，切勿生火', '快要下大暴雨', '海面有巨浪'], ans: 0, exp: '火災危險警告提醒市民空氣非常乾燥，必須小心防火，愛護山林。' },
            { q: '秋天天氣乾燥，我們的嘴唇和皮膚容易乾裂，應該怎樣護理？', opts: ['多喝水及塗潤膚膏、潤唇膏', '完全不洗臉不喝水', '用熱風筒吹皮膚'], ans: 0, exp: '多補充水分和塗抹潤膚膏，能幫助皮膚鎖住水分，減少乾癢。' },
            { q: '每年秋冬季節，哪種珍貴的候鳥會飛來香港米埔濕地過冬？', opts: ['黑臉琵鷺', '皇帝企鵝', '駝鳥'], ans: 0, exp: '黑臉琵鷺是受保護的候鳥，每年秋天都會從北方飛來溫暖的香港米埔度冬。' },
            { q: '農曆九月初九是「重陽節」，香港市民通常有甚麼傳統活動？', opts: ['登高遠足和拜祭先人', '扒龍舟比賽', '派利是貼揮春'], ans: 0, exp: '重陽節正值秋高氣爽，傳統上人們會登高望遠及孝敬長輩、拜祭先人。' },
            { q: '為甚麼很多學校都喜歡在秋天舉行學校旅行或陸運會？', opts: ['因為天氣清涼乾爽、少大雨', '因為秋天每天都停課', '因為秋天沒有太陽'], ans: 0, exp: '秋天少雨而且氣溫適中，非常適合在戶外進行體育運動和郊遊。' },
            { q: '松鼠在秋天會忙著收集堅果和橡果，目的是甚麼？', opts: ['儲備糧食準備過冬', '用來玩拋波遊戲', '幫大樹減輕重量'], ans: 0, exp: '冬天食物較少，聰明的松鼠會在秋天果實成熟時預先儲存過冬糧食。' }
        ],
        winter: [
            { q: '香港冬天的天氣主要是怎樣的？', opts: ['寒冷和乾燥', '酷熱而且常有颱風', '溫暖而且大霧潮濕'], ans: 0, exp: '香港冬天受北方冷空氣（冬季季候風）影響，天氣寒冷而且乾燥。' },
            { q: '冬天氣溫驟降時，香港天文台會發出甚麼警告提醒市民注意保暖？', opts: ['寒冷天氣警告', '酷熱天氣警告', '山泥傾瀉警告'], ans: 0, exp: '當預測市區氣溫降至 12°C 或以下時，天文台便會發出寒冷天氣警告。' },
            { q: '冬天穿衣服保暖，哪種穿法最聰明又方便活動？', opts: ['「洋蔥式」分層穿衣法', '只穿一件短袖背心', '把十條毛巾綁在頭上'], ans: 0, exp: '分層穿衣（內層排汗、中層保暖、外層防風）既暖和，進入室內也方便增減。' },
            { q: '在一年二十四節氣中，「冬至」這一天的日照時間有甚麼特點？', opts: ['北半球白天最短、夜晚最長', '白天和夜晚一樣長', '二十四小時都有太陽'], ans: 0, exp: '冬至那天太陽直射南回歸線，香港所在的北半球白天最短、黑夜最長。' },
            { q: '香港人常說「冬大過年」，一家人在冬至晚上通常會一起做甚麼？', opts: ['吃團年晚飯和吃湯圓', '去沙灘曬太陽衝浪', '去賞紅葉野餐'], ans: 0, exp: '冬至是華人重視的團圓節氣，一家人會聚首吃飯，並吃湯圓象徵團團圓圓。' },
            { q: '蛇、青蛙和刺蝟等動物在寒冷的冬天會怎樣度過？', opts: ['躲進洞穴裏冬眠，減少消耗', '長出彩色翅膀飛走', '每天去河邊游泳'], ans: 0, exp: '冬眠能讓動物降低體溫和心跳，在缺乏食物的寒冬中節省能量。' },
            { q: '香港冬天市區一般不會下雪，但在大帽山山頂極寒冷時偶爾會出現甚麼現象？', opts: ['結霜（霜凍）', '火山爆發', '沙漠綠洲'], ans: 0, exp: '大帽山是全港最高峰，冬季嚴寒時草木表面溫度接近 0°C 便會結霜！' },
            { q: '冬天在家裏使用暖爐或吃火鍋時，必須注意甚麼安全事項？', opts: ['保持空氣流通並遠離易燃物', '把所有門窗封死並蓋住暖爐', '把紙巾放在暖爐上烤'], ans: 0, exp: '使用電暖爐切勿覆蓋衣物以免起火，吃火鍋時亦要打開窗戶保持空氣流通。' },
            { q: '冬天喝一杯溫水有甚麼好處？', opts: ['溫暖身體並補充乾燥流失的水分', '令身體立刻結冰', '可以代替睡覺'], ans: 0, exp: '冬天雖然少流汗，但空氣乾燥仍會流失水分，多喝溫水有助保持健康。' },
            { q: '冬天過後，農曆正月初一是甚麼喜慶節日，象徵新一年春天的開始？', opts: ['農曆新年（春節）', '中秋節', '重陽節'], ans: 0, exp: '冬天過去便是春天，農曆新年又稱「春節」，家家戶戶會貼揮春和拜年！' }
        ]
    };

    /* 6. WebAudio 環境與互動音效系統 */
    GameApp.AudioSys = {
        ctx: null,
        enabled: true,
        noiseBuf: null,
        init() {
            if (!this.ctx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (AC) this.ctx = new AC();
            }
            if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
            if (this.ctx && !this.noiseBuf) {
                const sr = this.ctx.sampleRate;
                const buf = this.ctx.createBuffer(1, sr * 2.0, sr);
                const d = buf.getChannelData(0);
                for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
                this.noiseBuf = buf;
            }
        },
        tone(freq, type = 'sine', dur = 0.15, vol = 0.12, delay = 0) {
            if (!this.enabled || !this.ctx) return;
            const now = this.ctx.currentTime + delay;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(vol, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(now); osc.stop(now + dur);
        },
        playFilteredNoise(filterType, f0, f1, dur, vol, delay = 0, q = 1.2) {
            if (!this.enabled || !this.ctx || !this.noiseBuf) return;
            const now = this.ctx.currentTime + delay;
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuf; src.loop = true;
            const filter = this.ctx.createBiquadFilter();
            filter.type = filterType; filter.Q.value = q;
            filter.frequency.setValueAtTime(f0, now);
            filter.frequency.linearRampToValueAtTime(f1, now + dur);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(vol, now + dur * 0.2);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            src.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
            src.start(now); src.stop(now + dur + 0.05);
        },
        playWeatherSFX(sfxType) {
            if (!this.enabled || !this.ctx) return;
            if (sfxType === 'birds') {
                this.tone(1320, 'sine', 0.11, 0.12, 0.0);
                this.tone(1680, 'sine', 0.13, 0.12, 0.1);
                this.tone(1980, 'sine', 0.18, 0.13, 0.22);
            } else if (sfxType === 'cicada') {
                for (let i = 0; i < 6; i++) this.tone(4100 + (i % 2) * 280, 'sawtooth', 0.08, 0.032, i * 0.09);
                this.tone(659.25, 'triangle', 0.25, 0.1, 0.05);
            } else if (sfxType === 'rain') {
                this.playFilteredNoise('bandpass', 1400, 1800, 1.3, 0.2, 0, 0.8);
            } else if (sfxType === 'storm') {
                this.playFilteredNoise('lowpass', 190, 58, 1.5, 0.38, 0.0, 0.9);
                this.playFilteredNoise('bandpass', 950, 1900, 1.4, 0.24, 0.1, 0.7);
            } else if (sfxType === 'wind' || sfxType === 'cold_wind') {
                const hi = sfxType === 'cold_wind' ? 920 : 620;
                this.playFilteredNoise('bandpass', 320, hi, 1.35, 0.22, 0, 4.5);
            } else if (sfxType === 'fog') {
                this.tone(980, 'sine', 0.14, 0.11, 0.0);
                this.playFilteredNoise('lowpass', 480, 320, 1.0, 0.11, 0.05, 1.5);
            }
        },
        playSplash() { this.playFilteredNoise('bandpass', 900, 1500, 0.16, 0.11, 0, 1.4); },
        playJump() {
            if (!this.enabled || !this.ctx) return;
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(290, now);
            osc.frequency.exponentialRampToValueAtTime(640, now + 0.16);
            gain.gain.setValueAtTime(0.13, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(now); osc.stop(now + 0.18);
        },
        playGem() {
            this.tone(587.33, 'triangle', 0.12, 0.14, 0);
            this.tone(783.99, 'triangle', 0.14, 0.14, 0.08);
            this.tone(1046.5, 'sine', 0.22, 0.15, 0.16);
        },
        playCorrect() {
            [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => this.tone(f, 'triangle', 0.22, 0.16, idx * 0.09));
        },
        playBadgeUnlock() {
            // 寶可夢獲得道館徽章風格慶祝樂音！
            [523.25, 659.25, 783.99, 1046.5, 1174.66, 1318.51, 1567.98].forEach((f, i) => {
                this.tone(f, 'triangle', 0.28, 0.18, i * 0.1);
            });
        },
        playWrong() {
            this.tone(240, 'sawtooth', 0.18, 0.09, 0);
            this.tone(185, 'sawtooth', 0.25, 0.09, 0.14);
        }
    };

    /* 7. 香港廣東話 (zh-HK) 語音導讀系統 */
    GameApp.SpeechSys = {
        hkVoice: null,
        autoRead: true,
        seqToken: 0,
        init() {
            if (!('speechSynthesis' in window)) return;
            const pick = () => {
                const voices = window.speechSynthesis.getVoices() || [];
                this.hkVoice =
                    voices.find(v => /zh[-_]?HK/i.test(v.lang) && /Sin[-_ ]?ji|Siri|Premium|Enhanced/i.test(v.name)) ||
                    voices.find(v => /zh[-_]?HK|yue/i.test(v.lang)) ||
                    voices.find(v => /Cantonese|粵|廣東/i.test(v.name)) ||
                    voices.find(v => /zh[-_]?TW/i.test(v.lang)) ||
                    null;
            };
            pick();
            window.speechSynthesis.onvoiceschanged = pick;
        },
        unlock() {
            if (!('speechSynthesis' in window)) return;
            const u = new SpeechSynthesisUtterance(''); u.volume = 0;
            window.speechSynthesis.speak(u);
        },
        clearHighlights() {
            document.querySelectorAll('.speaking-highlight').forEach(el => el.classList.remove('speaking-highlight'));
        },
        stop() {
            this.seqToken++;
            this.clearHighlights();
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        },
        speakSingle(text, highlightEl = null) {
            if (!('speechSynthesis' in window)) return;
            this.stop();
            const token = this.seqToken;
            setTimeout(() => {
                if (token !== this.seqToken) return;
                const u = new SpeechSynthesisUtterance(text);
                u.lang = 'zh-HK';
                if (this.hkVoice) u.voice = this.hkVoice;
                u.rate = 0.92; u.pitch = 1.05;
                if (highlightEl) highlightEl.classList.add('speaking-highlight');
                u.onend = () => { if (highlightEl) highlightEl.classList.remove('speaking-highlight'); };
                u.onerror = () => { if (highlightEl) highlightEl.classList.remove('speaking-highlight'); };
                window.speechSynthesis.speak(u);
            }, 40);
        },
        speakSequence(items) {
            if (!('speechSynthesis' in window)) return;
            this.stop();
            const token = this.seqToken;
            let idx = 0;
            const next = () => {
                if (token !== this.seqToken || idx >= items.length) {
                    this.clearHighlights(); return;
                }
                const item = items[idx++];
                this.clearHighlights();
                if (item.el) item.el.classList.add('speaking-highlight');
                const u = new SpeechSynthesisUtterance(item.text);
                u.lang = 'zh-HK';
                if (this.hkVoice) u.voice = this.hkVoice;
                u.rate = 0.92; u.pitch = 1.05;
                u.onend = () => {
                    if (item.el) item.el.classList.remove('speaking-highlight');
                    if (token === this.seqToken) setTimeout(next, 135);
                };
                u.onerror = () => { if (item.el) item.el.classList.remove('speaking-highlight'); };
                window.speechSynthesis.speak(u);
            };
            setTimeout(next, 45);
        }
    };
    GameApp.SpeechSys.init();
})();

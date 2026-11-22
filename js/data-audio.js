/* =========================================================================
   四季小探險家 3D — 物理常數、動態天氣配置、題庫與廣東話語音／環境音效系統
   ========================================================================= */
window.GameApp = window.GameApp || {};

(() => {
    'use strict';

    /* 1. 真實 SI 國際單位制物理參數（地形坡度、拱橋、河流水阻與流體力學） */
    GameApp.PHYSICS = Object.freeze({
        WORLD_LIMIT: 94.0,          // 島嶼活動半徑 (m)
        WATER_LEVEL: -0.32,         // 河流水平面高度 (m)
        RIVER_HALF_W: 4.5,          // 河道半寬 (m)
        GRAVITY: -24.5,             // 重力加速度 (m/s²)
        JUMP_VELOCITY: 10.8,        // 起跳初速 (m/s)，最高跳躍高度 ≈ 2.38m
        WALK_SPEED: 13.0,           // 陸地正常行走極速 (m/s)
        SPRINT_SPEED: 20.8,         // 陸地衝刺極速 (m/s)
        ACCEL_GROUND: 54.0,         // 陸地推進加速度 (m/s²)
        ACCEL_AIR: 18.5,            // 空中微調加速度 (m/s²)
        MAX_CLIMB_SLOPE: 0.76,      // 最大可攀爬坡度 tan(37.2°)，陡峭山壁自動滑落阻擋
        WATER_DRAG: 6.6,            // 涉水時的流體阻力阻尼係數 (1/s)
        RIVER_FLOW_SPEED: 2.8,      // 河水順流推力加速度 (m/s²)
        PLAYER_RADIUS: 0.78,        // 玩家水平膠囊半徑 (m)
        MONKEY_RADIUS: 0.68,        // 小猴子水平碰撞半徑 (m)
        MAX_DT: 0.05,               // 單幀最大步長上限 (s)
        STAMINA_DRAIN: 26.0,        // 衝刺每秒消耗體力 (%)
        STAMINA_REGEN: 22.0,        // 每秒回復體力 (%)
        WEATHER_CYCLE_SEC: 28.0,    // 四季動態天氣自動演變週期 (s)
        SURFACE_FRICTION: {
            plaza:  11.0,
            bridge: 10.6,
            spring: 8.8,
            summer: 9.2,
            autumn: 9.6,
            winter: 4.2
        }
    });

    GameApp.SEASON_META = Object.freeze({
        plaza:  { short: '中央廣場', name: '🏛️ 中央科學廣場', surface: '石磚廣場', tagBg: '#FEF08A', tagColor: '#854D0E', sky: 0x38BDF8, fog: 0xBAE6FD, fogD: 0.0055, sun: 1.18, hemi: 0.88 },
        spring: { short: '春季園區', name: '🌸 春季百花園', surface: '濕潤草坡', tagBg: '#FBCFE8', tagColor: '#9D174D', sky: 0x7DD3FC, fog: 0xDBEAFE, fogD: 0.0068, sun: 1.05, hemi: 0.88 },
        summer: { short: '夏季園區', name: '🏖️ 夏季陽光灣', surface: '金黃沙岸', tagBg: '#BAE6FD', tagColor: '#0369A1', sky: 0x0EA5E9, fog: 0x7DD3FC, fogD: 0.0052, sun: 1.42, hemi: 0.94 },
        autumn: { short: '秋季園區', name: '🍁 秋季紅葉谷', surface: '乾爽落葉坡', tagBg: '#FED7AA', tagColor: '#9A3412', sky: 0x60A5FA, fog: 0xFFEDD5, fogD: 0.0060, sun: 1.14, hemi: 0.84 },
        winter: { short: '冬季園區', name: '⛄ 冬季冰雪嶺', surface: '積雪山坡', tagBg: '#E2E8F0', tagColor: '#1E3A8A', sky: 0xCBD5E1, fog: 0xF1F5F9, fogD: 0.0072, sun: 0.92, hemi: 0.95 }
    });

    /* 2. 四季隨時間演變的 12 種動態天氣狀態＋衣著與手提物品應變選擇題 */
    GameApp.WEATHER_STATES = {
        spring: [
            {
                id: 'spring_warm', icon: '🌤️', name: '溫暖春日晴天', sfx: 'birds',
                sky: 0x7DD3FC, fog: 0xDCFCE7, fogD: 0.0055, sun: 1.12, hemi: 0.9, windX: 0.9, pMode: 'petals',
                alert: '春天百花盛開、陽光溫暖！快揀選合適的春日探索衣著與工具！',
                outfit: { label: '翠綠薄長袖外套＋🔍生態放大鏡', coat: 0x16A34A, trim: 0xFEF08A, style: 'jacket', hat: 'cap', hatCol: 0xF97316, prop: 'magnifier' },
                quiz: {
                    q: '現在春季轉為「🌤️ 溫暖春日晴天」，最適合換上甚麼衣著和手提甚麼物品去觀察植物發芽？',
                    opts: ['穿薄長袖探索外套，手提生態放大鏡', '穿極地厚羽絨雪衣，手提暖手營燈', '穿螢光防風暴雨衣，手提應急電筒'],
                    ans: 0,
                    teach: '春天晴天溫暖舒適，穿薄長袖外套既透氣又能預防早晚微涼，手提放大鏡最適合觀察春日嫩芽與小昆蟲！'
                }
            },
            {
                id: 'spring_fog', icon: '🌫️', name: '潮濕回南濃霧', sfx: 'fog',
                sky: 0x94A3B8, fog: 0xE2E8F0, fogD: 0.0155, sun: 0.68, hemi: 0.78, windX: 0.4, pMode: 'mist',
                alert: '春天出現「回南天濃霧」，四周白茫茫而且很潮濕！請選擇合適裝備！',
                outfit: { label: '寶藍防潮風褸＋🔦防霧手電筒', coat: 0x0284C7, trim: 0xFFFFFF, style: 'windbreaker', hat: 'cap', hatCol: 0xFACC15, prop: 'flashlight' },
                quiz: {
                    q: '春季轉為「🌫️ 潮濕回南濃霧」，能見度變低而且空氣濕漉漉，應該換上甚麼衣著和手提物品？',
                    opts: ['穿防潮輕便風褸，手提明亮防霧手電筒照路', '只穿短袖泳衣，手提冰涼小風扇吹風', '穿厚毛衣戴冷帽，手提觀鳥望遠鏡看遠山'],
                    ans: 0,
                    teach: '回南天濃霧時空氣潮濕且視線模糊，穿防潮風褸可阻隔濕氣，手提明亮手電筒能看清前路並保障安全！'
                }
            },
            {
                id: 'spring_rain', icon: '🌧️', name: '春雨綿綿', sfx: 'rain',
                sky: 0x64748B, fog: 0xCBD5E1, fogD: 0.0095, sun: 0.65, hemi: 0.75, windX: 1.6, pMode: 'rain',
                alert: '天空下起綿綿春雨喇！快回答問題換上防雨衣著同雨具啦！',
                outfit: { label: '鮮桃紅防水雨衣＋☂️繽紛雨傘', coat: 0xE11D48, trim: 0xFEF08A, style: 'raincoat', hat: 'rainhood', hatCol: 0xE11D48, prop: 'umbrella' },
                quiz: {
                    q: '春季開始「🌧️ 春雨綿綿」，為了避免淋濕著涼，我們應該換上甚麼衣著和手提物品？',
                    opts: ['穿鮮色防水雨衣，手提雨傘擋雨', '穿純棉厚羽絨，手提放大鏡淋雨', '穿短袖背心，手提保溫熱水壺擋雨'],
                    ans: 0,
                    teach: '下雨天必須穿上防水雨衣並撐起雨傘，保持身體乾爽才不會感冒著涼！'
                }
            }
        ],
        summer: [
            {
                id: 'summer_sunny', icon: '☀️', name: '烈日酷熱晴天', sfx: 'cicada',
                sky: 0x0EA5E9, fog: 0xBAE6FD, fogD: 0.0045, sun: 1.48, hemi: 0.96, windX: -1.2, pMode: 'sun_sparkle',
                alert: '夏季陽光猛烈、蟬聲響亮，氣溫好高呀！快揀選防曬消暑裝備！',
                outfit: { label: '亮橙透氣防曬衫＋🌀冰涼小風扇', coat: 0xEA580C, trim: 0xFFFFFF, style: 'tshirt', hat: 'sunhat', hatCol: 0xFACC15, prop: 'fan' },
                quiz: {
                    q: '夏季現在是「☀️ 烈日酷熱晴天」，在戶外探索應該換上甚麼衣著和手提甚麼物品預防中暑？',
                    opts: ['穿淺亮色透氣短袖衫配遮陽闊邊帽，手提冰涼小風扇消暑', '穿厚羽絨大衣配毛線冷帽，手提暖手營燈', '穿密封防風雨衣，手提防霧手電筒'],
                    ans: 0,
                    teach: '酷熱晴天紫外線強，穿透氣短袖衫、戴闊邊太陽帽並使用便攜小風扇散熱，有助預防中暑和曬傷！'
                }
            },
            {
                id: 'summer_rain', icon: '🌦️', name: '夏日驟雨', sfx: 'rain',
                sky: 0x475569, fog: 0x94A3B8, fogD: 0.0092, sun: 0.72, hemi: 0.74, windX: -2.8, pMode: 'rain',
                alert: '夏天突然落起嘩啦嘩啦嘅驟雨！快揀選合適防雨衣著同物品！',
                outfit: { label: '皇家藍防水雨衣＋☂️晴雨大傘', coat: 0x2563EB, trim: 0xFDE047, style: 'raincoat', hat: 'rainhood', hatCol: 0x2563EB, prop: 'umbrella' },
                quiz: {
                    q: '夏季突然下起「🌦️ 夏日驟雨」，我們應該立刻換上甚麼衣著和手提物品？',
                    opts: ['穿防水雨衣，手提大雨傘遮擋雨水', '繼續穿單薄背心，手提望遠鏡淋雨', '穿厚毛衣圍巾，手提放大鏡'],
                    ans: 0,
                    teach: '香港夏天常有突如其來的驟雨，及時穿上防水雨衣和撐傘可以防止全身淋濕！'
                }
            },
            {
                id: 'summer_storm', icon: '⛈️', name: '狂風暴雨', sfx: 'storm',
                sky: 0x1E293B, fog: 0x334155, fogD: 0.0145, sun: 0.38, hemi: 0.48, windX: -8.5, pMode: 'storm', lightning: true,
                alert: '⚡ 雷電交加！夏季刮起「狂風暴雨」，天色昏暗風力極強！請揀選最安全裝備！',
                outfit: { label: '螢光黃防風暴雨衣＋🔦防水手電筒', coat: 0xFACC15, trim: 0x0F172A, style: 'raincoat', hat: 'rainhood', hatCol: 0xFACC15, prop: 'flashlight' },
                quiz: {
                    q: '天氣惡化為「⛈️ 狂風暴雨」，狂風會吹翻雨傘而且天色昏暗，怎樣穿戴和攜帶物品最安全？',
                    opts: ['穿醒目螢光黃防風連帽雨衣，手提防水手電筒照明並遠離大樹', '撐著普通大花傘站在高處，手提小風扇', '穿短袖衫戴太陽眼鏡，手提放大鏡去河邊玩水'],
                    ans: 0,
                    teach: '狂風暴雨時雨傘極易被強風吹毀甚至引致危險，穿上醒目的螢光黃防風雨衣並手提防水手電筒照明才最安全！'
                }
            }
        ],
        autumn: [
            {
                id: 'autumn_clear', icon: '🍂', name: '秋高氣爽晴天', sfx: 'birds',
                sky: 0x3B82F6, fog: 0xFFEDD5, fogD: 0.0052, sun: 1.16, hemi: 0.86, windX: 1.8, pMode: 'leaves',
                alert: '秋高氣爽，最適合遠足同觀察候鳥！快揀選郊遊衣著同工具！',
                outfit: { label: '楓葉紅遠足外套＋🔭觀鳥望遠鏡', coat: 0xDC2626, trim: 0xFDE047, style: 'jacket', hat: 'cap', hatCol: 0x1D4ED8, prop: 'binoculars' },
                quiz: {
                    q: '秋季是「🍂 秋高氣爽晴天」，去郊野遠足和觀察南下度冬的候鳥，應該怎樣配搭衣著與手提物品？',
                    opts: ['穿舒適長袖遠足運動服，手提雙筒望遠鏡觀察候鳥', '穿厚重雪地羽絨衣，手提營燈冬眠', '穿防水雨衣雨靴，手提抽濕盒'],
                    ans: 0,
                    teach: '秋天晴朗乾爽，穿輕便遠足運動服最舒適，帶備望遠鏡更可遠距離欣賞黑臉琵鷺等候鳥而不驚擾牠們！'
                }
            },
            {
                id: 'autumn_windy', icon: '💨', name: '秋風起涼風陣陣', sfx: 'wind',
                sky: 0x60A5FA, fog: 0xFED7AA, fogD: 0.0068, sun: 1.0, hemi: 0.8, windX: 5.4, pMode: 'leaves_fast',
                alert: '呼—呼—秋風吹起，滿山紅葉飛舞而且轉涼喇！快換上擋風裝備！',
                outfit: { label: '琥珀橙防風外套＋🥤溫水保溫壺', coat: 0xD97706, trim: 0x0F172A, style: 'windbreaker', hat: 'cap', hatCol: 0x7C2D12, prop: 'thermos' },
                quiz: {
                    q: '秋季轉為「💨 秋風起涼風陣陣」，陣風吹過體感變涼，應該換上甚麼衣著和手提物品？',
                    opts: ['穿防風長袖風衣外套，手提溫水壺隨時補充水分', '穿無袖短背心，手提冰涼小風扇對著吹', '穿螢光暴雨衣，手提雨傘逆風奔跑'],
                    ans: 0,
                    teach: '「秋風起」時風速較高且帶涼意，穿上防風外套可避免受涼，手提溫水壺能溫暖身體！'
                }
            },
            {
                id: 'autumn_dry', icon: '🔥', name: '乾燥山火警告日', sfx: 'wind',
                sky: 0x2563EB, fog: 0xFEF3C7, fogD: 0.0048, sun: 1.25, hemi: 0.85, windX: 2.5, pMode: 'leaves',
                alert: '天文台發出乾燥警告，空氣非常乾燥！快揀選補水護膚嘅郊遊裝備！',
                outfit: { label: '靛藍純棉長袖郊遊服＋💧大容量水壺', coat: 0x4F46E5, trim: 0xFACC15, style: 'jacket', hat: 'sunhat', hatCol: 0xF59E0B, prop: 'thermos' },
                quiz: {
                    q: '秋季出現「🔥 非常乾燥天氣」，皮膚和嘴唇容易乾裂，郊遊時應換上甚麼衣著及手提甚麼物品？',
                    opts: ['穿親膚純棉長袖郊遊服配遮陽帽，手提大容量水壺多喝水', '穿塑膠密封雨衣不透氣，手提火種去山頭生火', '穿短褲赤腳，手提放大鏡在乾草堆聚光'],
                    ans: 0,
                    teach: '風高物燥時千萬不可生火或聚光以免引發山火！穿純棉透氣長袖衣並多喝水才能保護乾燥肌膚。'
                }
            }
        ],
        winter: [
            {
                id: 'winter_cool', icon: '🌥️', name: '清涼乾爽冬日', sfx: 'wind',
                sky: 0x93C5FD, fog: 0xE2E8F0, fogD: 0.0062, sun: 0.95, hemi: 0.9, windX: 1.5, pMode: 'snow_light',
                alert: '踏入清涼冬日，氣溫下降喇！快運用「洋蔥式穿衣法」換裝啦！',
                outfit: { label: '寶藍保暖羽絨背心＋🥤保溫暖水壺', coat: 0x1D4ED8, trim: 0xFACC15, style: 'puffer', hat: 'cap', hatCol: 0x1E3A8A, prop: 'thermos' },
                quiz: {
                    q: '冬季是「🌥️ 清涼乾爽冬日」，運動探索時採用哪種穿衣配搭和手提物品最靈活保暖？',
                    opts: ['穿「洋蔥式」分層保暖背心長袖衫，手提保溫暖水壺', '只穿一件夏天的薄短袖衫，手提冰涼小風扇', '穿塑膠薄雨衣，手提雨傘'],
                    ans: 0,
                    teach: '清涼冬日採用「洋蔥式」分層穿衣法既保暖又方便活動，手提暖水壺更能隨時補充溫暖水分！'
                }
            },
            {
                id: 'winter_cold', icon: '❄️', name: '寒冷季候風警告', sfx: 'cold_wind',
                sky: 0x94A3B8, fog: 0xE2E8F0, fogD: 0.009, sun: 0.78, hemi: 0.88, windX: 4.8, pMode: 'snow',
                alert: '❄️ 寒冷天氣警告生效！北風呼呼吹、氣溫急降！快換上禦寒衣物！',
                outfit: { label: '深紫紅厚羽絨配紅圍巾＋🔥保溫熱水瓶', coat: 0x9333EA, trim: 0xEF4444, style: 'puffer_scarf', hat: 'beanie', hatCol: 0xDC2626, prop: 'thermos' },
                quiz: {
                    q: '冬季吹起強烈北風並發出「❄️ 寒冷天氣警告」，氣溫降至 12°C 以下，應該怎樣穿戴及手提甚麼物品？',
                    opts: ['穿厚羽絨大衣、戴毛線冷帽和圍巾，手提保溫熱水瓶暖身', '穿短袖運動衫配太陽帽，手提小風扇', '只穿薄風褸不戴帽，手提放大鏡'],
                    ans: 0,
                    teach: '嚴寒北風下頭部和頸部最易散失熱量，穿上厚羽絨大衣、戴上冷帽與圍巾並喝溫熱開水最能禦寒保暖！'
                }
            },
            {
                id: 'winter_frost', icon: '🌨️', name: '嚴寒結霜飄雪', sfx: 'cold_wind',
                sky: 0x64748B, fog: 0xF1F5F9, fogD: 0.0125, sun: 0.68, hemi: 0.92, windX: 6.2, pMode: 'blizzard',
                alert: '🌨️ 高山嚴寒結霜飄雪！地面濕滑而且天色轉暗，快換上極地保暖裝備！',
                outfit: { label: '亮赤紅極地防寒雪衣＋🏮溫暖手提營燈', coat: 0xB91C1C, trim: 0xFFFFFF, style: 'puffer_scarf', hat: 'beanie', hatCol: 0xF97316, prop: 'lantern' },
                quiz: {
                    q: '高山冬季出現「🌨️ 嚴寒結霜飄雪」，氣溫接近 0°C 且視線濛瀧，應該換上甚麼衣著和手提物品？',
                    opts: ['穿鮮紅防風厚羽絨雪衣配冷帽圍巾，手提發光溫暖營燈照明', '穿夏天的沙灘短褲，手提雨傘滑冰', '穿薄長袖襯衫，手提望遠鏡'],
                    ans: 0,
                    teach: '嚴寒結霜時地面容易結冰濕滑，穿鮮紅色厚防寒雪衣既保暖又醒目，手提溫暖營燈更能照亮結霜山路！'
                }
            }
        ]
    };

    /* 3. 香港小二常識／科學科 40 題完整寶石與小猴子題庫 */
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

    /* 4. WebAudio 逼真天氣環境音效合成器（雨聲、狂風雷暴、鳥鳴、夏蟬、北風、涉水聲） */
    GameApp.AudioSys = {
        ctx: null,
        enabled: true,
        noiseBuf: null,
        init() {
            if (!this.ctx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (AC) this.ctx = new AC();
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            if (this.ctx && !this.noiseBuf) {
                const sr = this.ctx.sampleRate;
                const buf = this.ctx.createBuffer(1, sr * 2.0, sr);
                const data = buf.getChannelData(0);
                for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
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
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + dur);
        },
        playFilteredNoise(filterType, freqStart, freqEnd, dur, vol, delay = 0, q = 1.2) {
            if (!this.enabled || !this.ctx || !this.noiseBuf) return;
            const now = this.ctx.currentTime + delay;
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuf;
            src.loop = true;
            const filter = this.ctx.createBiquadFilter();
            filter.type = filterType;
            filter.Q.value = q;
            filter.frequency.setValueAtTime(freqStart, now);
            filter.frequency.linearRampToValueAtTime(freqEnd, now + dur);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(vol, now + dur * 0.2);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            src.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            src.start(now);
            src.stop(now + dur + 0.05);
        },
        playWeatherSFX(sfxType) {
            if (!this.enabled || !this.ctx) return;
            if (sfxType === 'birds') {
                // 清脆春日／秋日小鳥鳴叫
                this.tone(1320, 'sine', 0.11, 0.12, 0.0);
                this.tone(1680, 'sine', 0.13, 0.12, 0.1);
                this.tone(1980, 'sine', 0.18, 0.13, 0.22);
                this.tone(1560, 'sine', 0.15, 0.11, 0.42);
            } else if (sfxType === 'cicada') {
                // 夏日陽光知了蟬鳴聲 + 晴朗和弦
                for (let i = 0; i < 7; i++) {
                    this.tone(4100 + (i % 2) * 280, 'sawtooth', 0.08, 0.035, i * 0.09);
                }
                this.tone(659.25, 'triangle', 0.25, 0.11, 0.05);
                this.tone(880.0, 'triangle', 0.3, 0.11, 0.2);
            } else if (sfxType === 'rain') {
                // 淅瀝雨聲合成
                this.playFilteredNoise('bandpass', 1400, 1800, 1.35, 0.22, 0, 0.8);
                this.tone(920, 'sine', 0.08, 0.08, 0.15);
                this.tone(760, 'sine', 0.08, 0.08, 0.35);
            } else if (sfxType === 'storm') {
                // 轟隆雷鳴 + 狂風呼嘯 + 傾盆大雨
                this.playFilteredNoise('lowpass', 190, 58, 1.6, 0.42, 0.0, 0.9);
                this.playFilteredNoise('bandpass', 950, 1900, 1.5, 0.26, 0.1, 0.7);
                this.tone(72, 'sawtooth', 0.7, 0.18, 0.02);
            } else if (sfxType === 'wind' || sfxType === 'cold_wind') {
                // 呼呼秋風／凜冽北風呼嘯
                const hi = sfxType === 'cold_wind' ? 920 : 620;
                this.playFilteredNoise('bandpass', 320, hi, 1.45, 0.24, 0, 4.5);
                this.playFilteredNoise('bandpass', hi, 380, 1.1, 0.18, 0.45, 5.0);
            } else if (sfxType === 'fog') {
                // 潮濕回南水滴回音
                this.tone(980, 'sine', 0.14, 0.12, 0.0);
                this.tone(1320, 'sine', 0.12, 0.09, 0.18);
                this.playFilteredNoise('lowpass', 480, 320, 1.1, 0.12, 0.05, 1.5);
            }
        },
        playSplash() {
            this.playFilteredNoise('bandpass', 900, 1500, 0.18, 0.12, 0, 1.4);
        },
        playJump() {
            if (!this.enabled || !this.ctx) return;
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(290, now);
            osc.frequency.exponentialRampToValueAtTime(640, now + 0.16);
            gain.gain.setValueAtTime(0.14, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.18);
        },
        playGem() {
            this.tone(587.33, 'triangle', 0.12, 0.14, 0);
            this.tone(783.99, 'triangle', 0.14, 0.14, 0.08);
            this.tone(1046.5, 'sine', 0.22, 0.15, 0.16);
        },
        playCorrect() {
            [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
                this.tone(f, 'triangle', 0.22, 0.16, idx * 0.09);
            });
        },
        playWrong() {
            this.tone(240, 'sawtooth', 0.18, 0.09, 0);
            this.tone(185, 'sawtooth', 0.25, 0.09, 0.14);
        },
        playFanfare() {
            [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) => {
                this.tone(f, 'triangle', 0.26, 0.16, i * 0.12);
            });
        }
    };

    /* 5. 香港廣東話 (zh-HK) 語音導讀系統 */
    GameApp.SpeechSys = {
        hkVoice: null,
        autoRead: true,
        seqToken: 0,
        init() {
            if (!('speechSynthesis' in window)) return;
            const pickVoice = () => {
                const voices = window.speechSynthesis.getVoices() || [];
                this.hkVoice =
                    voices.find(v => /zh[-_]?HK/i.test(v.lang) && /Sin[-_ ]?ji|Siri|Premium|Enhanced/i.test(v.name)) ||
                    voices.find(v => /zh[-_]?HK|yue/i.test(v.lang)) ||
                    voices.find(v => /Cantonese|粵|廣東/i.test(v.name)) ||
                    voices.find(v => /zh[-_]?TW/i.test(v.lang)) ||
                    null;
            };
            pickVoice();
            window.speechSynthesis.onvoiceschanged = pickVoice;
        },
        unlock() {
            if (!('speechSynthesis' in window)) return;
            const u = new SpeechSynthesisUtterance('');
            u.volume = 0;
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
                u.rate = 0.92;
                u.pitch = 1.05;
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
            let index = 0;
            const next = () => {
                if (token !== this.seqToken || index >= items.length) {
                    this.clearHighlights();
                    return;
                }
                const item = items[index++];
                this.clearHighlights();
                if (item.el) item.el.classList.add('speaking-highlight');
                const u = new SpeechSynthesisUtterance(item.text);
                u.lang = 'zh-HK';
                if (this.hkVoice) u.voice = this.hkVoice;
                u.rate = 0.92;
                u.pitch = 1.05;
                u.onend = () => {
                    if (item.el) item.el.classList.remove('speaking-highlight');
                    if (token === this.seqToken) setTimeout(next, 140);
                };
                u.onerror = () => {
                    if (item.el) item.el.classList.remove('speaking-highlight');
                };
                window.speechSynthesis.speak(u);
            };
            setTimeout(next, 45);
        }
    };
    GameApp.SpeechSys.init();
})();

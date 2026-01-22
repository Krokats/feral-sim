/**
 * Feral Simulation - File 1: Global State & Constants
 * Updated for Turtle WoW Patch 1.18 (Feral Cat)
 * Includes Boss Armor Database
 */

// ============================================================================
// 1. GLOBAL STATE
// ============================================================================
var SIM_LIST = [];
var ACTIVE_SIM_INDEX = 0;
var SIM_DATA = null;
var CURRENT_VIEW = 'avg';
var toastTimer = null;

var ITEM_DB = [];
var ENCHANT_DB = [];
var GEAR_SELECTION = {};
var ENCHANT_SELECTION = {};

// Configuration IDs mapped to UI elements
var CONFIG_IDS = [
    // Sim Settings
    "simTime", "simCount", "sim_mode", "sim_seed","statWeightIt",

    // Player Stats
    "stat_str", "stat_agi", "stat_ap",
    "stat_hit", "stat_crit", "stat_haste", "stat_arp",
    "stat_wep_dmg_min", "stat_wep_dmg_max", "stat_wep_skill",
    "mana_pool",

    // Enemy Settings
    "enemy_level", "enemy_armor",
    "enemy_can_bleed", "enemy_can_block",
    "enemy_type",
    "enemy_boss_select",

    // Enemy Debuffs
    "debuff_major_armor",
    "debuff_eskhandar",
    "debuff_ff",
    "debuff_cor",

    // Rotation / Logic
    "rota_position",
    "use_rip", "rip_cp",
    "use_fb", "fb_cp", "fb_energy",
    "use_reshift", "reshift_energy",
    "use_tf",
    "reshift_over_tf", "reshift_over_tf_dur",
    "use_rake",
    "use_shred", "use_claw",
    "use_ff",
    "use_berserk", "shred_ooc_only", "use_pounce",

    // Gear Specifics (SETS & IDOLS & TRINKETS)
    "set_t05_4p",
    // New Sets
    "set_cenarion_5p", "set_cenarion_8p",
    "set_genesis_3p", "set_genesis_5p",
    "set_talon_3p", "set_talon_5p",

    // Idols (Swapping allowed)
    "idol_savagery", "idol_emeral_rot", "idol_ferocity", "idol_laceration",

    // Trinkets (On-Use)
    "trinket_swarmguard", "trinket_slayer", "trinket_spider",
    "trinket_jomgabbar", "trinket_earthstrike", "trinket_emberstone",
    "trinket_zhm",

    // Trinkets (Procs)
    "trinket_shieldrender", "trinket_venoms", "trinket_maelstrom",
    "trinket_hoj", "trinket_coil",

    // Buffs & Consumables (UPDATED to Checkboxes)
    "consum_elemental", "consum_consecrated",
    "consum_mongoose", "consum_potion_quickness", "consum_mighty_rage",

    "consum_food_str", "consum_food_agi", "consum_food_haste",

    "consum_scorpok", "consum_roids",

    "consum_juju_might", "consum_firewater", "consum_juju_power", "consum_juju_flurry",

    // Raid Buffs
    "buff_motw", "buff_kings", "buff_might", "buff_bs",
    "buff_lotp", "buff_tsa",
    "buff_wf_totem", "buff_ft_totem",
    "buff_soe_totem", "buff_goa_totem",
    // Removed Warchief as requested

    // Talents
    "tal_ferocity", "tal_feral_aggression", "tal_open_wounds",
    "tal_sharpened_claws", "tal_primal_fury", "tal_blood_frenzy",
    "tal_imp_shred", "tal_predatory_strikes", "tal_ancient_brutality",
    "tal_berserk", "tal_hotw", "tal_carnage", "tal_lotp",
    "tal_furor", "tal_nat_wep", "tal_nat_shapeshifter", "tal_omen"
];

var SLOT_LAYOUT = {
    left: ["Head", "Neck", "Shoulder", "Back", "Chest", "Wrist"],
    right: ["Hands", "Waist", "Legs", "Feet", "Finger 1", "Finger 2", "Trinket 1", "Trinket 2"],
    // Removed Idol as requested
    bottom: ["Main Hand", "Off Hand"]
};

// Base Stats (Level 60 - Turtle WoW 1.18)
// Heart of the Wild 5/5 included
// Predatory Strikes included (as it is baseline for Feral Druids)
//test for update
const RACE_STATS = {
    "Tauren": { str: 70, agi: 55, sta: 72, int: 114, spi: 112, ap: 295, crit: 3.65, speed: 0, minDmg: 72, maxDmg: 97 },
    "NightElf": { str: 62, agi: 65, sta: 69, int: 120, spi: 110, ap: 295, crit: 3.65, speed: 1.0, minDmg: 72, maxDmg: 97 }
};


// Combat Constants
const CONSTANTS = {
    GCD: 1.0,
    ENERGY_TICK: 2.0,
    TICK_AMOUNT: 20,
    HIT_CAP: 9.0,
    GLANCE_PENALTY: 0.3
};

// Simulation Object
function SimObject(id, name) {
    this.id = id;
    this.name = name;
    this.config = {};
    this.results = null;
}

// Boss Armor Database
const BOSS_PRESETS = [
    { group: "World", name: "Apprentice Training Dummy", armor: 100, level: 60, canBleed: true, canBlock: true, type: "Humanoid" },
    { group: "World", name: "Expert Training Dummy", armor: 3000, level: 60, canBleed: true, canBlock: true, type: "Humanoid" },
    { group: "World", name: "Heroic Training Dummy", armor: 4211, level: 63, canBleed: true, canBlock: true, type: "Humanoid" },

    { group: "Naxxramas", name: "Most Bosses", armor: 4211, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Naxxramas", name: "Loatheb, Patch, Thaddius", armor: 4611, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Naxxramas", name: "Faerlina, Noth", armor: 3850, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Naxxramas", name: "Gothik, Kel'Thuzad", armor: 3402, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },

    { group: "AQ40", name: "Most Bosses", armor: 4211, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "AQ40", name: "Emperor Vek'lor", armor: 3833, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "AQ40", name: "The Prophet Skeram", armor: 3402, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "BWL", name: "All Bosses", armor: 4211, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },

    { group: "Molten Core", name: "Most Bosses", armor: 4211, level: 63, canBleed: false, canBlock: false, type: "Humanoid" },
    { group: "Molten Core", name: "Sulfuron Harbinger", armor: 4786, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Molten Core", name: "Gehennas, Lucifron, Shazzrah", armor: 3402, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Kara 40", name: "Most Bosses", armor: 4211, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Kara 40", name: "Krull", armor: 4752, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Kara 40", name: "Rook, Rupturan, Mephistroth", armor: 4611, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Kara 40", name: "Echo, Sanv Tasdal", armor: 3850, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Kara 40", name: "Bishop", armor: 3402, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },

    { group: "Emerald Sanctum", name: "Solnius", armor: 4712, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Emerald Sanctum", name: "Erennius", armor: 4912, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },

    { group: "Zul'Gurub", name: "Most Bosses", armor: 3402, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Zul'Gurub", name: "Bloodlord Mandokir", armor: 4211, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Zul'Gurub", name: "High Priest Thekal", armor: 3850, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "AQ20", name: "Most Bosses", armor: 4211, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "AQ20", name: "Moam", armor: 4113, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "AQ20", name: "Buru the Gorger", armor: 3402, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Kara 10", name: "Lord Blackwald", armor: 4325, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Kara 10", name: "Howlfang, Moroes", armor: 3892, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Kara 10", name: "Grizikil, Araxxna", armor: 3044, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },

    { group: "World Bosses", name: "Ostarius", armor: 5980, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "World Bosses", name: "Dark Reaver of Karazhan", armor: 4285, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "World Bosses", name: "Azuregos", armor: 4211, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "World Bosses", name: "Nightmare Dragons", armor: 4211, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "World Bosses", name: "Lord Kazzak", armor: 4211, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "World Bosses", name: "Omen", armor: 4186, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "World Bosses", name: "Nerubian Overseer", armor: 3761, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },

    { group: "Silithus", name: "Prince Thunderaan", armor: 4213, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Silithus", name: "Lord Skwol", armor: 4061, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Other", name: "Onyxia", armor: 4211, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Other", name: "UBRS: Gyth", armor: 4061, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Other", name: "UBRS: Lord Valthalak", armor: 3400, level: 63, canBleed: true, canBlock: false, type: "Humanoid" },
    { group: "Other", name: "Strat UD: Atiesh", armor: 3850, level: 63, canBleed: true, canBlock: false, type: "Humanoid" }
];

// ============================================================================
// PIXEL ART ANIMATION DATA
// ============================================================================

const C = {
    _: null, B: '#8B4513', D: '#5A3210', G: '#A9A9A9', W: '#FFFFFF', Y: '#F0E68C',
    P1: '#9370DB', P2: '#BA55D3', DB: '#4169E1', LB: '#87CEFA',
    ExpY: '#FFFF00', ExpO: '#FFA500', R: '#FF0000', TX: '#FFFFFF', TB: '#00BFFF',
    TY: '#FFD700', SV: '#C0C0C0',
    NG: '#32CD32', DG: '#006400', LG: '#98FB98'
};

const T = (rows, color = C.TX) => rows.map(r => r.split('').map(c => c === 'X' ? color : C._));

const SPRITES = {
    moonkinLarge: [
        [C._, C._, C.G, C._, C._, C._, C._, C.G, C._, C._],
        [C._, C.G, C.D, C.D, C._, C._, C.D, C.D, C.G, C._],
        [C._, C.G, C.B, C.B, C.B, C.B, C.B, C.B, C.G, C._],
        [C._, C.B, C.B, C.W, C.B, C.B, C.W, C.B, C.B, C._],
        [C.D, C.B, C.B, C.B, C.Y, C.Y, C.B, C.B, C.B, C.D],
        [C.B, C.D, C.B, C.B, C.B, C.B, C.B, C.B, C.D, C.B],
        [C.B, C.B, C.B, C.W, C.B, C.B, C.W, C.B, C.B, C.B],
        [C.B, C.B, C.B, C.B, C.B, C.B, C.B, C.B, C.B, C.B],
        [C._, C.B, C.B, C.B, C.B, C.B, C.B, C.B, C.B, C._],
        [C._, C._, C.D, C.D, C._, C._, C.D, C.D, C._, C._]
    ],
    dummyLarge: [
        [C._, C._, C._, C.D, C.D, C.D, C._, C._, C._],
        [C._, C._, C.D, C.Y, C.Y, C.Y, C.D, C._, C._],
        [C._, C._, C.D, C.Y, C.Y, C.Y, C.D, C._, C._],
        [C._, C.G, C.G, C.G, C.G, C.G, C.G, C.G, C._],
        [C._, C.G, C.B, C.B, C.D, C.B, C.B, C.G, C._],
        [C._, C.G, C.B, C.D, C.Y, C.D, C.B, C.G, C._],
        [C._, C._, C.B, C.B, C.D, C.B, C.B, C._, C._],
        [C._, C._, C._, C.D, C.B, C.D, C._, C._, C._],
        [C._, C._, C._, C.D, C.B, C.D, C._, C._, C._],
        [C._, C._, C.D, C.D, C.D, C.D, C.D, C._, C._]
    ],
    castBall1: [[C._, C.P1, C.P1, C._],[C.P1, C.P2, C.P2, C.P1],[C.P1, C.P2, C.P2, C.P1],[C._, C.P1, C.P1, C._]],
    castBall2: [[C._, C.P1, C.P2, C.P1, C._],[C.P1, C.P2, C.W, C.P2, C.P1],[C.P2, C.W, C.W, C.W, C.P2],[C.P1, C.P2, C.W, C.P2, C.P1],[C._, C.P1, C.P2, C.P1, C._]],
    beamSegment: [[C.DB, C.LB, C.W, C.W, C.LB, C.DB],[C.DB, C.LB, C.W, C.W, C.LB, C.DB],[C.DB, C.LB, C.W, C.W, C.LB, C.DB],[C.DB, C.LB, C.W, C.W, C.LB, C.DB]],
    impactSplash: [[C._, C.LB, C._, C.LB, C._],[C.LB, C.W, C.LB, C.W, C.LB],[C.ExpY, C.LB, C.W, C.LB, C.ExpY],[C.ExpO, C.ExpY, C.LB, C.ExpY, C.ExpO]],
    redBeamSegment: [[C.R, C.LB, C.W, C.W, C.LB, C.R],[C.R, C.LB, C.W, C.W, C.LB, C.R],[C.R, C.LB, C.W, C.W, C.LB, C.R],[C.R, C.LB, C.W, C.W, C.LB, C.R]],
    wrathBall: [[C._, C.DG, C.DG, C._],[C.DG, C.NG, C.NG, C.DG],[C.DG, C.NG, C.W, C.DG],[C._, C.DG, C.DG, C._]],
    wrathSplash: [[C._, C.NG, C._, C.NG, C._],[C.NG, C.LG, C.NG, C.LG, C.NG],[C.DG, C.NG, C.W, C.NG, C.DG],[C._, C.DG, C.NG, C.DG, C._]],
    tear: [ [C.TB], [C.TB], [C.TB] ],
    
    txtC: T(['XXX','X..','X..','X..','XXX']),
    txtR: T(['XXX','X.X','XXX','X.X','X.X']),
    txtI: T(['XXX','.X.','.X.','.X.','XXX']),
    txtT: T(['XXX','.X.','.X.','.X.','.X.']),
    txtM: T(['X.X','XXX','X.X','X.X','X.X']),
    txtS: T(['XXX','X..','XXX','..X','XXX']),
    txtEcl: T(['.X.','.X.','.X.','...','.X.']),
    txtI_y: T(['XXX','.X.','.X.','.X.','XXX'], C.TY),
    txtM_y: T(['X.X','XXX','X.X','X.X','X.X'], C.TY),
    txtU_y: T(['X.X','X.X','X.X','X.X','XXX'], C.TY),
    txtN_y: T(['XX.','X.X','X.X','X.X','X.X'], C.TY),
    txtE_y: T(['XXX','X..','XXX','X..','XXX'], C.TY),
    txtEcl_y: T(['.X.','.X.','.X.','...','.X.'], C.TY),
    shield: [[C.SV, C.SV, C.SV, C.SV, C.SV],[C.SV, C.W,  C.SV, C.W,  C.SV],[C.SV, C.SV, C.SV, C.SV, C.SV],[C._,  C.SV, C.SV, C.SV, C._],[C._,  C._,  C.SV, C._,  C._]]
};
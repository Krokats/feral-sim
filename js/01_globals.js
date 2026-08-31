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

const ROTATION_SKILLS = [
    { id: "Pounce", name: "Pounce (Opener)", icon: "ability_druid_supriseattack" },
    { id: "Ravage", name: "Ravage (Opener)", icon: "ability_druid_ravage" },
    { id: "Faerie Fire", name: "Faerie Fire", icon: "spell_nature_faeriefire" },
    { id: "Tiger's Fury", name: "Tiger's Fury", icon: "ability_mount_jungletiger" },
    { id: "Berserk", name: "Berserk", icon: "ability_druid_berserk" },
    { id: "Rake", name: "Rake", icon: "ability_druid_disembowel" },
    { id: "Rip", name: "Rip", icon: "ability_ghoulfrenzy" },
    { id: "Ferocious Bite", name: "Ferocious Bite", icon: "ability_hunter_pet_cat" },
    { id: "Shred", name: "Shred", icon: "spell_shadow_vampiricaura" },
    { id: "Claw", name: "Claw", icon: "ability_druid_rake" },
    { id: "Reshift", name: "Powershift", icon: "spell_nature_forceofnature" },
    { id: "Trinket 1", name: "Use Trinket 1", icon: "inv_jewelry_trinket_04" },
    { id: "Trinket 2", name: "Use Trinket 2", icon: "inv_jewelry_trinket_04" },
    { id: "Potion", name: "Use Potion/Juju", icon: "inv_potion_27" }
];

const CONDITION_TYPES = {
    "cp": { label: "Combo Points", type: "number", ops: [">=", "<=", "=="] },
    "energy": { label: "Energy", type: "number", ops: [">=", "<=", "=="] },
    "time_elapsed": { label: "Time Elapsed (s)", type: "number", ops: [">=", "<="] },
    "time_remaining": { label: "Time Remaining (s)", type: "number", ops: [">=", "<="] },
    "debuff_rem": { label: "Target Debuff Rem. (s)", type: "select", options: ["Rip", "Rake", "Faerie Fire", "Pounce"], ops: [">=", "<=", "=="] },
    "buff_rem": { label: "Player Buff Rem. (s)", type: "select", options: ["Tiger's Fury", "Clearcasting", "Blood Frenzy", "Slayer", "Spider", "Earthstrike", "Jom", "ZHM"], ops: [">=", "<=", "=="] },
    "last_spell": { label: "Last Spell Cast", type: "select", options: ["Ferocious Bite", "Rip", "Shred", "Claw", "Reshift", "Pounce", "Ravage", "None"], ops: ["==", "!="] }
};

const PRESET_ROTATIONS = {
    "standard bleed": {
        name: "Standard Feral",
        desc: "Optimal priority logic including Reshifting, TF after FB and OOC Shreds.",
        steps: [
        { id: "step_1", skill: "Tiger's Fury", conditions: [{ type: "time_elapsed", op: "<=", val: -3 }] },
        { id: "step_2", skill: "Trinket 1", conditions: [] },
        { id: "step_3", skill: "Trinket 2", conditions: [] },
        { id: "step_4", skill: "Potion", conditions: [] },
        { id: "step_5", skill: "Berserk", conditions: [] },
        { id: "step_6", skill: "Pounce", conditions: [{ type: "time_elapsed", op: "<=", val: 0 }] },
        { id: "step_7", skill: "Faerie Fire", conditions: [{ type: "debuff_rem", target: "Faerie Fire", op: "<=", val: 0 }] },
        { id: "step_8", skill: "Rake", conditions: [{ type: "debuff_rem", target: "Rake", op: "<=", val: 0 }] },
        { id: "step_9", skill: "Rip", conditions: [{ type: "cp", op: ">=", val: 5 }, { type: "debuff_rem", target: "Rip", op: "<=", val: 0 }] },
        { id: "step_10", skill: "Ferocious Bite", conditions: [{ type: "cp", op: ">=", val: 5 }, { type: "debuff_rem", target: "Rip", op: ">=", val: 0.1 }, { type: "energy", op: ">=", val: 35 }] },
        { id: "step_11", skill: "Tiger's Fury", conditions: [{ type: "last_spell", target: "Ferocious Bite", op: "==" }] },
        { id: "step_12", skill: "Tiger's Fury", conditions: [{ type: "energy", op: "<=", val: 30 }] },
        { id: "step_13", skill: "Reshift", conditions: [{ type: "energy", op: "<=", val: 10 }, { type: "buff_rem", target: "Tiger's Fury", op: "<=", val: 1.5 }] },
        { id: "step_14", skill: "Shred", conditions: [{ type: "buff_rem", target: "Clearcasting", op: ">=", val: 0.1 }] },
        { id: "step_15", skill: "Claw", conditions: [] }
    ]
},
    "standard bleed immune": {
        name: "Standard Feral for Bleed-Immune targets (placeholder!)",
        desc: "Optimal priority logic including Reshifting, TF after FB and OOC Shreds.",
        steps: [
        { id: "step_1", skill: "Tiger's Fury", conditions: [{ type: "time_elapsed", op: "<=", val: -3 }] },
        { id: "step_2", skill: "Trinket 1", conditions: [] },
        { id: "step_3", skill: "Trinket 2", conditions: [] },
        { id: "step_4", skill: "Potion", conditions: [] },
        { id: "step_5", skill: "Berserk", conditions: [] },
        { id: "step_6", skill: "Ravage", conditions: [{ type: "time_elapsed", op: "<=", val: 0 }] },
        { id: "step_7", skill: "Faerie Fire", conditions: [{ type: "debuff_rem", target: "Faerie Fire", op: "<=", val: 0 }] },
        { id: "step_8", skill: "Ferocious Bite", conditions: [{ type: "cp", op: ">=", val: 5 }, { type: "energy", op: ">=", val: 35 }] },
        { id: "step_9", skill: "Tiger's Fury", conditions: [{ type: "last_spell", target: "Ferocious Bite", op: "==" }] },
        { id: "step_10", skill: "Tiger's Fury", conditions: [{ type: "energy", op: "<=", val: 30 }] },
        { id: "step_11", skill: "Reshift", conditions: [{ type: "energy", op: "<=", val: 10 }, { type: "buff_rem", target: "Tiger's Fury", op: "<=", val: 1.5 }] },
        { id: "step_12", skill: "Shred", conditions: [{ type: "buff_rem", target: "Clearcasting", op: ">=", val: 0.1 }] },
        { id: "step_13", skill: "Claw", conditions: [] }
    ]
}
};

// Lädt das Standard-Preset als Standard-Rotation beim Start
var CUSTOM_ROTATION = JSON.parse(JSON.stringify(PRESET_ROTATIONS["standard bleed"]));

// Configuration IDs mapped to UI elements
var CONFIG_IDS = [
    // Sim Settings
    "simTime", "simCount", "sim_mode", "sim_seed","statWeightIt",
    "active_rotation_template",

    // Stat Weights
    "weight_ap", "weight_str", "weight_agi", "weight_hit", "weight_crit", "weight_haste", "weight_arp",

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
    "use_tf","tf_after_fb",
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
    "set_stormshroud_3p", "set_stormshroud_4p",

    "gear_blade_eternal_darkness", "gear_ring_electrical_binding",
    "gear_electro_lantern", "gear_markali", "gear_thunder_lizard",
    "gear_blazefury_medallion",
    "gear_incendosaur_pauldrons", "gear_incendosaur_boots", "gear_incendosaur_gloves", 
    "set_incendosaur_2p", "set_incendosaur_3p",

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
    //"tal_ferocity", "tal_feral_aggression", "tal_open_wounds",
    //"tal_sharpened_claws", "tal_primal_fury", "tal_blood_frenzy",
    //"tal_imp_shred", "tal_predatory_strikes", "tal_ancient_brutality",
    //"tal_berserk", "tal_hotw", "tal_carnage", "tal_lotp",
    //"tal_furor", "tal_nat_wep", "tal_nat_shapeshifter", "tal_omen"
];

var SLOT_LAYOUT = {
    left: ["Head", "Neck", "Shoulder", "Back", "Chest", "Wrist"],
    right: ["Hands", "Waist", "Legs", "Feet", "Finger 1", "Finger 2", "Trinket 1", "Trinket 2"],
    // Removed Idol as requested
    bottom: ["Main Hand", "Off Hand", "Idol"]
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
// GEAR PRESETS (BiS Lists)
// ============================================================================

var GEAR_PRESETS = {
    "Pre-Raid + Kara10 + Ony BiS": {
        gear: {
            "Head": 47354,       
            "Neck": 18404,       
            "Shoulder": 12927,   
            "Back": 61249,
            "Chest": 50427,
            "Wrist": 19687,
            "Hands": 83463,
            "Waist": 60550,
            "Legs": 18736,
            "Feet": 83442,
            "Finger 1": 18500,
            "Finger 2": 18500,
            "Trinket 1": 13965,  // Hand of Justice
            "Trinket 2": 11815,  // Blackhand's Breadth
            "Main Hand": 84603,   // Manual Crowd Pummeler (oder ähnliches)
            "Off Hand": 0,       // 0 bedeutet: Slot leeren (wichtig bei 2-Hand Waffen)
            "Idol": 61699        // Idol of Ferocity
        },
        enchants: {
            "Head": 61081,        // Z.B. +8 Agility
            "Neck": 56008,
            "Shoulder": 61437,
            "Back": 11206,        // +3 Agility
            "Chest": 16253,       // +3 Stats
            "Wrist": 60969,       // +9 Strength
            "Hands": 16219,       // +15 Agility
            "Waist": 61782,
            "Legs": 11645,        // +8 Agility
            "Feet": 20023,        // Minor Speed
            "Finger 1": 56008,
            "Finger 2": 56008,
            "Trinket 1": 0,
            "Trinket 2": 0,
            "Main Hand": 27837,   // +15 Agility oder +25 Agility
            "Off Hand": 0,
            "Idol": 0
        }
    },
    "Spellstrike": {
        gear: {
            "Head": 61060,       
            "Neck": 17111,       
            "Shoulder": 60572,   
            "Back": 81308,
            "Chest": 50427,
            "Wrist": 19687,
            "Hands": 60582,
            "Waist": 60550,
            "Legs": 18736,
            "Feet": 60568,
            "Finger 1": 61332,
            "Finger 2": 18500,
            "Trinket 1": 33147,  
            "Trinket 2": 11815,  // Hand of Justice
            "Main Hand": 17780,   
            "Off Hand": 65030,       // 0 bedeutet: Slot leeren (wichtig bei 2-Hand Waffen)
            "Idol": 61699        // Idol of Ferocity
        },
        enchants: {
            "Head": 61081,        // Z.B. +8 Agility
            "Neck": 56008,
            "Shoulder": 61437,
            "Back": 11206,        // +3 Agility
            "Chest": 16253,       // +3 Stats
            "Wrist": 60969,       // +9 Strength
            "Hands": 16219,       // +15 Agility
            "Waist": 61782,
            "Legs": 11645,        // +8 Agility
            "Feet": 20023,        // Minor Speed
            "Finger 1": 56008,
            "Finger 2": 56008,
            "Trinket 1": 0,
            "Trinket 2": 0,
            "Main Hand": 27837,   // +15 Agility oder +25 Agility
            "Off Hand": 0,
            "Idol": 0
        }
    },
    "MC/T1": {
        gear: {
            "Head": 47354,       
            "Neck": 18404,       
            "Shoulder": 47339,   
            "Back": 17102,
            "Chest": 60390,
            "Wrist": 22668,
            "Hands": 47342,
            "Waist": 47343,
            "Legs": 61265,
            "Feet": 65027,
            "Finger 1": 18821,
            "Finger 2": 17063,
            "Trinket 1": 13965,  
            "Trinket 2": 58211,  // Hand of Justice
            "Main Hand": 33150,   
            "Off Hand": 0,        // 0 bedeutet: Slot leeren (wichtig bei 2-Hand Waffen)
            "Idol": 61699        
        },
        enchants: {
            "Head": 61081,        // Z.B. +8 Agility
            "Neck": 56008,
            "Shoulder": 61437,
            "Back": 11206,        // +3 Agility
            "Chest": 16253,       // +3 Stats
            "Wrist": 60969,       // +9 Strength
            "Hands": 16219,       // +15 Agility
            "Waist": 61782,
            "Legs": 11645,        // +8 Agility
            "Feet": 20023,        // Minor Speed
            "Finger 1": 56008,
            "Finger 2": 56008,
            "Trinket 1": 0,
            "Trinket 2": 0,
            "Main Hand": 27837,   // +15 Agility oder +25 Agility
            "Off Hand": 0,
            "Idol": 0
        }
    }


};

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
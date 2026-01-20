/**
 * Feral Simulation - File 5: Simulation Engine & Math
 * Updated for Turtle WoW 1.18 (Feral Cat)
 * Features: 
 * - Stochastic Event-based Engine (Async)
 * - Additive Haste Formula
 * - Dynamic Armor Reduction
 * - Pixel Art Animation Support (Non-blocking)
 */

// ============================================================================
// SIMULATION ENTRY POINT
// ============================================================================

function runSimulation() {
    var config = getSimInputs();

    // Ensure at least 1 iteration
    if (config.iterations < 1) config.iterations = 1;

    // 1. Show Progress & Start Animation
    showProgress("Simulating...");

    // 2. Setup Async Loop
    var allResults = [];

    // 2. Setup Async Loop
    var allResults = [];
    var i = 0;
    var batchSize = 30; // Number of sims per frame (Adjust for smoothness vs speed)

    function processBatch() {
        try {
            var target = Math.min(config.iterations, i + batchSize);

            // Run a batch of simulations
            for (; i < target; i++) {

                // Config Cloning & Time Smearing Logic
                var currentConfig = Object.assign({}, config);

                if (config.varyDuration && config.iterations > 1) {
                    var stepSize = 2.0;
                    var midPoint = Math.floor(config.iterations / 2);
                    var offset = (i - midPoint) * stepSize;
                    currentConfig.simTime = config.simTime + offset;
                    if (currentConfig.simTime < 10) currentConfig.simTime = 10;
                }

                // Random seed for standard simulations
                currentConfig.seed = Math.floor(Math.random() * 0xFFFFFFFF);

                var res = runCoreSimulation(currentConfig);
                allResults.push(res);
            }

            // Update UI Progress
            updateProgress((i / config.iterations) * 100);

            if (i < config.iterations) {
                // Yield control to browser for rendering animation
                setTimeout(processBatch, 0);
            } else {
                // 3. Finalize
                var avg = aggregateResults(allResults);

                if (SIM_LIST[ACTIVE_SIM_INDEX]) {
                    SIM_LIST[ACTIVE_SIM_INDEX].results = avg;
                }

                SIM_DATA = SIM_LIST[ACTIVE_SIM_INDEX];
                updateSimulationResults(SIM_DATA);
                showToast("Simulation Complete!");
                hideProgress(); // Stop Animation
            }

        } catch (e) {
            console.error(e);
            showToast("Error: " + e.message);
            hideProgress();
        }
    }

    // Start the first batch with a small delay to allow UI to open
    setTimeout(processBatch, 50);
}

// ============================================================================
// STAT WEIGHTS ENTRY POINT
// ============================================================================

function runStatWeights() {
    var baseConfig = getSimInputs();
    baseConfig.calcMode = 'stochastic';
    baseConfig.varyDuration = true;

    // Validation
    var iter = 5000;//baseConfig.iterations;
    /*if (!iter || iter < 10) {
        iter = 50;
        baseConfig.iterations = 50;
    }*/
    
    // Ensure numbers
    baseConfig.inputAP = parseFloat(baseConfig.inputAP) || 0;
    baseConfig.inputStr = parseFloat(baseConfig.inputStr) || 0;
    baseConfig.inputAgi = parseFloat(baseConfig.inputAgi) || 0;
    baseConfig.inputHit = parseFloat(baseConfig.inputHit) || 0;
    baseConfig.inputCrit = parseFloat(baseConfig.inputCrit) || 0;
    baseConfig.inputHaste = parseFloat(baseConfig.inputHaste) || 0;

    showProgress("Calculating Stat Weights...");

    // Hit Cap Logic (Turtle WoW: 8% for Boss/Lvl63, 5% otherwise)
    var isBoss = (baseConfig.enemyLevel == 63);
    var hitCap = isBoss ? 8.0 : 5.0;
    var isHitCapped = baseConfig.inputHit >= hitCap;

    var scenarios = [
        { id: "base", label: "Base", mod: function (c) { } },
        { id: "ap", label: "+50 AP", mod: function (c) { c.inputAP += 50; } },
        { 
            id: "str", 
            label: "+25 STR", 
            mod: function (c) { 
                // Multiplikatoren berechnen (Gear -> Stats)
                var mod = 1.0;
                
                // Heart of the Wild (+20%)
                // Wir nehmen an, 5/5 ist Standard, prüfen aber den Config-Wert sicherheitshalber
                var hotw = (c.tal_hotw !== undefined) ? c.tal_hotw : 5;
                mod *= (1 + (hotw * 0.04)); 

                // Blessing of Kings (+10%)
                if (c.buff_kings) mod *= 1.10;

                var totalStr = 25 * mod; // Das ist der effektive STR Gewinn im Char Screen
                
                c.inputStr += totalStr; 
                c.inputAP += (totalStr * 2); 
            } 
        },
        { 
            id: "agi", 
            label: "+25 AGI", 
            mod: function (c) { 
                var mod = 1.0;
                // Blessing of Kings (+10%)
                if (c.buff_kings) mod *= 1.10;

                var totalAgi = 25 * mod; // Effektive AGI im Char Screen
                
                c.inputAgi += totalAgi; 
                c.inputAP += totalAgi;           // 1 Agi = 1 AP
                c.inputCrit += (totalAgi / 20.0); // 20 Agi = 1 Crit
            } 
        },
        // Crit
        { id: "crit", label: "+1% Crit", mod: function (c) { c.inputCrit += 1.0; } },
        // Haste
        { id: "haste", label: "41% Haste", mod: function (c) { c.inputHaste += 4.0; } }
    ];

    if (!isHitCapped) {
        // Insert Hit scenario if needed
        scenarios.splice(4, 0, { id: "hit", label: "+1% Hit", mod: function (c) { c.inputHit += 1.0; } });
    }

    var results = {};
    var currentScenIdx = 0;
    var batchSize = 30; // Async batch size

    function runNextScenario() {
        if (currentScenIdx >= scenarios.length) {
            finalizeWeights(results);
            hideProgress();
            return;
        }

        var scen = scenarios[currentScenIdx];
        var runCfg = JSON.parse(JSON.stringify(baseConfig));
        scen.mod(runCfg);

        // Prep variables for this scenario
        var runResults = [];
        var i = 0;
        var timeRange = runCfg.simTime / 2;

        function processScenarioBatch() {
            try {
                var target = Math.min(iter, i + batchSize);

                for (; i < target; i++) {
                    var stepConfig = Object.assign({}, runCfg);

                    // Time Smearing
                    var progress = i / (iter - 1); 
                    var offset = (progress - 0.5) * timeRange;
                    stepConfig.simTime = runCfg.simTime + offset;
                    if (stepConfig.simTime < 10) stepConfig.simTime = 10;

                    // CRN: Fixed Seed per Iteration index (ensures comparison fairness)
                    stepConfig.seed = 1337 + i; 

                    runResults.push(runCoreSimulation(stepConfig));
                }

                // Update Total Progress
                var totalProgress = ((currentScenIdx * iter) + i) / (scenarios.length * iter);
                updateProgress(totalProgress * 100);

                if (i < iter) {
                    setTimeout(processScenarioBatch, 0); // Yield
                } else {
                    // Scenario Finished
                    var avg = aggregateResults(runResults);
                    
                    // STORE DPS, ERROR, AND RAW DATA (for paired error calc)
                    results[scen.id] = { 
                        dps: avg.dps, 
                        error: avg.dpsSE,
                        raw: runResults.map(r => r.dps) // Save raw DPS per iteration
                    };
                    
                    currentScenIdx++;
                    setTimeout(runNextScenario, 0); // Next Scenario
                }
            } catch (e) {
                console.error(e);
                showToast("Error during weights: " + e.message);
                hideProgress();
            }
        }

        // Start processing the current scenario
        processScenarioBatch();
    }
    
    // Begin
    runNextScenario();
}

function finalizeWeights(dpsResults) {
    // Helper to extract values safely
    var getRes = (id) => dpsResults[id] || { dps: 0, error: 0, raw: [] };

    var base = getRes("base");
    var baseDps = base.dps;

    // Helper: Calculate Standard Error of the Difference (Paired)
    // Calculates stdErr of (ArrB - ArrA)
    function calcPairedSE(arrA, arrB) {
        if (!arrA || !arrB || arrA.length !== arrB.length || arrA.length === 0) return 0;
        var n = arrA.length;
        var sumDiff = 0;
        var sumSqDiff = 0;
        
        // 1. Calculate Differences
        var diffs = [];
        for(var i=0; i<n; i++) {
            var d = arrB[i] - arrA[i];
            diffs.push(d);
            sumDiff += d;
        }
        var meanDiff = sumDiff / n;

        // 2. Variance of Differences
        for(var i=0; i<n; i++) {
            sumSqDiff += (diffs[i] - meanDiff) ** 2;
        }
        var variance = sumSqDiff / (n - 1);
        
        // 3. Standard Error = StdDev / sqrt(N)
        return Math.sqrt(variance) / Math.sqrt(n);
    }

    // 1. Calculate Scale Factor (EP = 1 AP)
    var delta_ap = 50;
    var apRes = getRes("ap");
    
    // Slope (DPS per 1 AP)
    var dps_per_ap = (apRes.dps - baseDps) / delta_ap;
    if (dps_per_ap <= 0.0001) dps_per_ap = 0.0001;

    // Error of the slope (AP) using Paired Calculation
    var se_diff_ap = calcPairedSE(base.raw, apRes.raw);
    var rel_err_ap = se_diff_ap / Math.abs(apRes.dps - baseDps); // Relative Error of the Delta

    // Helper to Calc Weight and Error
    function calcWeight(id, amount) {
        if (!dpsResults[id]) return { w: 0, e: 0, skip: true };

        var res = dpsResults[id];
        var delta = res.dps - baseDps;
        
        // Main Weight Value
        var weight = (delta / amount) / dps_per_ap;
        if (weight < 0) weight = 0;

        // --- Paired Error Propagation ---
        // We have W = (Delta_Stat / Amount) / (Delta_AP / 50)
        // Error propagation for division Z = X / Y is:
        // (sigma_Z / Z)^2 = (sigma_X / X)^2 + (sigma_Y / Y)^2
        
        var se_diff_stat = calcPairedSE(base.raw, res.raw);
        var rel_err_stat = se_diff_stat / Math.abs(delta);
        
        // Combined Relative Error
        var combined_rel_err = Math.sqrt( Math.pow(rel_err_stat, 2) + Math.pow(rel_err_ap, 2) );
        
        // Absolute Error in Weight
        var errWeight = weight * combined_rel_err;
        
        // Fallback for huge relative errors (e.g. delta near 0)
        if (isNaN(errWeight)) errWeight = 0;

        return { w: weight, e: errWeight, skip: false };
    }

    var w_str = calcWeight("str", 25);
    var w_agi = calcWeight("agi", 25);
    var w_hit = calcWeight("hit", 1.0);
    var w_crit = calcWeight("crit", 1.0);
    var w_haste = calcWeight("haste", 4.0);

    // HTML Rendering Helper
    function renderStatBox(label, data, color) {
        if (data.skip) {
             return `
            <div class="stat-box" style="padding:10px; opacity:0.6;">
                <h3 style="font-size:0.75rem;">${label}</h3>
                <span class="med-number" style="font-size:1.4rem; color:${color};">0.00</span>
                <div style="font-size:0.7rem; color:#666;">(Capped)</div>
            </div>`;
        }
        return `
        <div class="stat-box" style="padding:10px;">
            <h3 style="font-size:0.75rem;">${label}</h3>
            <span class="med-number" style="font-size:1.4rem; color:${color};">${data.w.toFixed(2)}</span>
            <div style="font-size:0.75rem; color:#888;">&plusmn;${data.e.toFixed(2)}</div>
        </div>`;
    }

    var container = document.getElementById("weightResults");
    if (container) {
        container.classList.remove("hidden");
        container.innerHTML = `
            <div class="results-header" style="border-bottom:none; margin-bottom:10px; margin-top:0;">
                <h2 style="font-size:1.1rem; margin:0;">⚖️ Stat Weights (1AP = 1EP)</h2>
            </div>
            <div class="stats-grid">
                ${renderStatBox("1 Str", w_str, "#fff")}
                ${renderStatBox("1 Agi", w_agi, "#fff")}
                ${renderStatBox("1% Crit", w_crit, "#ffeb3b")}
                ${renderStatBox("1% Hit", w_hit, "#a5d6a7")}
                ${renderStatBox("1% Haste", w_haste, "#90caf9")}
            </div>
        `;
    }
}

function getSimInputs() {
    var getCheck = (id) => { var el = document.getElementById(id); return el ? (el.checked ? 1 : 0) : 0; };
    var getNum = (id) => { var el = document.getElementById(id); return el ? (parseFloat(el.value) || 0) : 0; };
    var getSel = (id) => { var el = document.getElementById(id); return el ? el.value : ""; };

    return {
        // Sim Settings
        simTime: getNum("simTime") || 60,
        iterations: getNum("simCount") || 1000,
        sim_mode: getSel("sim_mode") || "stochastic",

        // Player Config
        race: getSel("char_race") || "Tauren",
        inputStr: getNum("stat_str"),
        inputAgi: getNum("stat_agi"),
        inputAP: getNum("stat_ap"),
        inputCrit: getNum("stat_crit"),
        inputHit: getNum("stat_hit"),
        inputHaste: getNum("stat_haste"),
        inputArp: getNum("stat_arp"), // NEU
        manaPool: getNum("mana_pool") || 3000,

        // Enemy
        enemyLevel: getNum("enemy_level") || 63,
        enemyArmor: getNum("enemy_armor") || 3731,
        canBleed: getCheck("enemy_can_bleed") === 1,
        enemyType: getSel("enemy_type"),

        // Debuffs
        debuff_major_armor: getSel("debuff_major_armor"),
        debuff_eskhandar: getCheck("debuff_eskhandar"),
        debuff_cor: getCheck("debuff_cor"),
        debuff_ff: getCheck("debuff_ff"),

        // Rotation
        rota_position: getSel("rota_position"),
        use_rip: getCheck("use_rip"), rip_cp: getNum("rip_cp"),
        use_fb: getCheck("use_fb"), fb_cp: getNum("fb_cp"), fb_energy: getNum("fb_energy"),
        use_reshift: getCheck("use_reshift"), reshift_energy: getNum("reshift_energy"),
        reshift_over_tf: getCheck("reshift_over_tf") === 1,
        reshift_over_tf_dur: getNum("reshift_over_tf_dur"),
        use_tf: getCheck("use_tf"),
        use_tf: getCheck("use_tf"),
        use_rake: getCheck("use_rake"),
        use_shred: getCheck("use_shred"),
        use_claw: getCheck("use_claw"),
        use_ff: getCheck("use_ff"),
        use_berserk: getCheck("use_berserk"),
        shred_ooc_only: getCheck("shred_ooc_only"),
        use_pounce: getCheck("use_pounce"), // NEU

        // Flags
        buff_kings: getCheck("buff_kings"), // HINZUFÜGEN für Str-Skalierung
        buff_wf_totem: getCheck("buff_wf_totem"),
        buff_ft_totem: getCheck("buff_ft_totem"),
        consum_potion_quickness: getCheck("consum_potion_quickness"),
        consum_mighty_rage: getCheck("consum_mighty_rage"), // NEU
        consum_juju_flurry: getCheck("consum_juju_flurry"), // NEU

        // NEW: Special Gear Input
        hasGiftOfFerocity: getCheck("gear_gift_of_ferocity") === 1,

        // Talents
        tal_ferocity: getNum("tal_ferocity"),
        tal_feral_aggression: getNum("tal_feral_aggression"),
        tal_imp_shred: getNum("tal_imp_shred"),
        tal_nat_shapeshifter: getNum("tal_nat_shapeshifter"),
        tal_berserk: getNum("tal_berserk"),
        // Constants
        tal_open_wounds: 3, tal_sharpened_claws: 3, tal_primal_fury: 2, tal_blood_frenzy: 2,
        tal_predatory_strikes: 3, tal_ancient_brutality: 2, tal_hotw: 5, tal_carnage: 2,
        tal_lotp: 1, tal_furor: 5, tal_nat_wep: 3, tal_omen: 1,

        // --- NEW GEAR FLAGS (SETS, IDOLS, TRINKETS) ---
        hasT05_4p: getCheck("set_t05_4p") === 1,

        set_cenarion_5p: getCheck("set_cenarion_5p") === 1,
        set_cenarion_8p: getCheck("set_cenarion_8p") === 1,

        set_genesis_3p: getCheck("set_genesis_3p") === 1,
        set_genesis_5p: getCheck("set_genesis_5p") === 1,

        set_talon_3p: getCheck("set_talon_3p") === 1,
        set_talon_5p: getCheck("set_talon_5p") === 1,

        idol_savagery: getCheck("idol_savagery") === 1,
        idol_emeral_rot: getCheck("idol_emeral_rot") === 1,
        idol_ferocity: getCheck("idol_ferocity") === 1,
        idol_laceration: getCheck("idol_laceration") === 1,

        // Trinkets
        t_swarmguard: getCheck("trinket_swarmguard") === 1,
        t_slayer: getCheck("trinket_slayer") === 1,
        t_spider: getCheck("trinket_spider") === 1,
        t_jomgabbar: getCheck("trinket_jomgabbar") === 1,
        t_earthstrike: getCheck("trinket_earthstrike") === 1,
        t_emberstone: getCheck("trinket_emberstone") === 1,

        t_shieldrender: getCheck("trinket_shieldrender") === 1,
        t_venoms: getCheck("trinket_venoms") === 1,
        t_maelstrom: getCheck("trinket_maelstrom") === 1,
        t_hoj: getCheck("trinket_hoj") === 1,
        t_coil: getCheck("trinket_coil") === 1,
        t_zhm: getCheck("trinket_zhm") === 1,
    };
}

// ============================================================================
// CORE ENGINE
// ============================================================================

function runCoreSimulation(cfg) {

    // -----------------------------------------
    // 1. STATS & INITIALIZATION
    // -----------------------------------------

    // Initialize RNG Handler
    var rng = new RNGHandler(cfg.seed);

    var raceStats = {
        "Tauren": { baseAp: 295, baseCrit: 3.65, minDmg: 72, maxDmg: 97 },
        "NightElf": { baseAp: 295, baseCrit: 3.65, minDmg: 72, maxDmg: 97 }
    };
    var base = raceStats[cfg.race] || raceStats["Tauren"];
    base.speed = 1.0;

    var baseAP = cfg.inputAP;
    var baseCrit = cfg.inputCrit;
    var baseHit = cfg.inputHit;

    var modNaturalWeapons = 1.10;
    var modPredatoryStrikes = 1.20;

    // Static Armor Reduction
    var staticArmorReduct = 0;
    if (cfg.debuff_major_armor === "sunder") staticArmorReduct += 2250;
    else if (cfg.debuff_major_armor === "iea") staticArmorReduct += 2550;
    if (cfg.debuff_eskhandar) staticArmorReduct += 1200;
    if (cfg.debuff_cor) staticArmorReduct += 640;

    // -----------------------------------------
    // 2. COMBAT STATE
    // -----------------------------------------
    var t = -0.01;
    var maxT = cfg.simTime;
    var energy = 100;
    var mana = cfg.manaPool;
    var cp = 0;

    var events = [];
    var nextEnergyTick = 0.5;
    var gcdEnd = 0.0;
    var swingTimer = 0.0;
    var isExtra;
    var activeRipCP = 0; // Merkt sich die CP des laufenden Rips

    // Auras & Buffs
    var auras = {
        rake: 0, rip: 0, ff: 0, pounce: 0,
        clearcasting: 0,
        tigersFury: 0, BloodFrenzy: 0,
        berserk: 0,
        potionQuickness: 0,
        mightyRage: 0, // NEU
        jujuFlurry: 0, // NEU

        // New Buffs
        cenarionHaste: 0, // T1 8p
        genesisProc: 0,   // T2.5 5p (Empowered Next Cast)
        talonAP: 0,       // T3.5 3p
        talonBuff: 0,     // T3.5 5p (25% AP + Energy)
        laceration: 0,    // Idol of Laceration (Next Shred Refund)

        // Trinket Buffs
        swarmguard: 0,
        slayer: 0,
        spider: 0,
        jom: 0, jomStart: 0,
        earthstrike: 0,
        emberstone: 0,
        shieldrender: 0,
        venom: 0,
        venom_dot: 0,
        zhm: 0,
    };

    var stacks = {
        cenarion: 0,    // 5 Charges for T1 8p
        talonFero: 0,   // Primal Ferocity Stacks
        swarmguard: 0,  // Max 6
        venom: 0,        // Max 1200
        zhm: 0,         // Max 20 (x2 Dmg)
    };

    var cds = {
        tigersFury: 0, berserk: 0, ff: 0, potion: 0, jujuFlurry: 0,
        // Trinket CDs (Individual)
        slayer: 0,
        spider: 0,
        earthstrike: 0,
        jom: 0,
        emberstone: 0,
        zhm: 0,
        swarmguard: 0
    };

    var log = [];
    var totalDmg = 0;
    var dmgSources = {};
    var counts = {}, missCounts = {}, dodgeCounts = {}, parryCounts = {}, critCounts = {}, glanceCounts = {};

    function addEvent(time, type, data) {
        events.push({ t: time, type: type, data: data || {} });
        events.sort((a, b) => a.t - b.t);
    }

    function removeEvent(type, name) {
        // FIX: Rückwärts iterieren, damit splice nicht den Index nachfolgender Elemente verschiebt
        for (var i = events.length - 1; i >= 0; i--) {
            if (events[i].type === type && events[i].data.name === name) {
                events.splice(i, 1);
            }
        }
    }

    // --- HELPER: Dynamic AP Calculation ---
    function getCurrentAP() {
        var ap = baseAP;

        // Mighty Rage Potion: +60 Str -> AP
        if (auras.mightyRage > t && auras.mightyRage > 0) {
            var strMod = 1.20; // Heart of the Wild (5/5 assumed)
            if (cfg.buff_kings) strMod += 0.10; // Blessing of Kings
            ap += (60 * strMod * 2);
        }

        // Talon 3p: +100 AP
        if (auras.talonAP > t && auras.talonAP > 0) ap += 100;

        // Trinkets
        if (auras.slayer > t && auras.slayer > 0) ap += 260;
        if (auras.earthstrike > t && auras.earthstrike > 0) ap += 280;
        if (auras.emberstone > t && auras.emberstone > 0) ap += 200;

        // Jom Gabbar: 65 + 65 every 2s
        if (auras.jom > t && auras.jom > 0) {
            var elapsed = t - auras.jomStart;
            var stack = Math.floor(elapsed / 2.0);
            ap += (65 + (stack * 65));
        }

        // Talon 5p: +25% AP
        if (auras.talonBuff > t && auras.talonBuff > 0) ap = Math.floor(ap * 1.25);

        return ap;
    }

    // --- HELPER: Haste Calculation ---
    function getHasteMod() {
        var hPercent = 0;
        if (cfg.inputHaste > 0) hPercent += cfg.inputHaste;

        if (auras.BloodFrenzy > t && auras.BloodFrenzy > 0) hPercent += 20;
        if (auras.potionQuickness > t && auras.potionQuickness > 0) hPercent += 5;
        if (auras.jujuFlurry > t && auras.jujuFlurry > 0) hPercent += 3; // NEU

        // Cenarion 8p: +15% Speed
        if (auras.cenarionHaste > t && stacks.cenarion > 0 && auras.cenarionHaste > 0) hPercent += 15;

        // Kiss of the Spider: +20% Speed
        if (auras.spider > t && auras.spider > 0) hPercent += 20;

        return 1 + (hPercent / 100);
    }

    // --- HELPER: Armor Reduction ---
    function getDamageReduction(t, currentFF) {
        // Shieldrender: Ignore All Armor
        if (auras.shieldrender > t && auras.shieldrender > 0) return 0.0;

        var totalReduct = staticArmorReduct;
        if (currentFF > t || cfg.debuff_ff) totalReduct += 505;

        // Swarmguard: -200 per stack
        if (auras.swarmguard > t && stacks.swarmguard > 0 && auras.swarmguard > 0) {
            totalReduct += (stacks.swarmguard * 200);
        }

        // Armor Penetration vom Gear wird zusätzlich zu den Debuffs abgezogen
        var armorAfterArp = cfg.enemyArmor - (cfg.inputArp || 0);
        var effArmor = Math.max(0, armorAfterArp - totalReduct);

        // dynamic calculation based on enemy level
        var constant = (467.5 * cfg.enemyLevel) - 22167.5; //(cfg.enemyLevel == 63) ? 5882.5 : 5312.5;

        return effArmor / (effArmor + constant);
    }

    // Logging
    function getActiveCDsString() {
        var list = [];
        if (auras.tigersFury > t) list.push("TF");
        if (auras.berserk > t) list.push("Berserk");
        if (auras.talonAP > t) list.push("TalonAP");
        if (auras.talonBuff > t) list.push("PrimalFerocity");
        if (auras.genesisProc > t) list.push("Genesis");
        if (auras.slayer > t) list.push("Slayer");
        if (auras.spider > t) list.push("Spider");
        if (auras.jom > t) list.push("Jom");
        if (auras.zhm > t) list.push("ZHM");
        if (auras.mightyRage > t) list.push("Rage");
        if (auras.jujuFlurry > t) list.push("Flurry");
        return list.join(",");
    }

    function logAction(action, info, res, dmgVal, isCrit, isTick, eChange) {
        if (log.length < 3500) {
            var hMod = getHasteMod();
            var spd = base.speed / hMod;
            var curAP = getCurrentAP();

            var curArP = cfg.inputArp || 0;
            if (stacks.swarmguard > 0) {
                curArP += (stacks.swarmguard * 200);
            }

            var dmgNorm = 0, dmgCrit = 0, dmgTick = 0, dmgSpec = 0;
            if (dmgVal > 0) {
                if (isTick) dmgTick = dmgVal;
                else if (["Auto Attack", "Extra Attack", "Shred", "Claw", "Rake", "Rip", "Ferocious Bite"].includes(action)) {
                    if (isCrit) { dmgNorm = dmgVal / 2; dmgCrit = dmgVal / 2; } else dmgNorm = dmgVal;
                } else dmgSpec = dmgVal;
            }

            // --- NEU: Erfassung dynamischer Buffs & Standard-Procs ---
            var activeBuffs = {};

            // Standard-Proc: Omen of Clarity (OoC) - Zeigt 1 oder 0
            //var oocActive = (auras.clearcasting > t) ? 1 : 0;
            var oocActive = Math.max(0, auras.clearcasting - t);


            // Standard-Proc: Tiger's Fury (TF) - Zeigt Restzeit
            var tfRem = Math.max(0, auras.tigersFury - t);

            var exclude = ["clearcasting", "tigersFury", "rake", "rip", "ff", "pounce"];
            for (var key in auras) {
                // FIX: Check auras[key] > 0 added to prevent logging inactive buffs (0) when t is negative (-0.01)
                if (!exclude.includes(key) && auras[key] > t && auras[key] > 0) {
                    activeBuffs[key] = parseFloat((auras[key] - t).toFixed(1));
                }
            }

            // --- CALC OPEN WOUNDS & POUNCE ---
            var activeBleeds = 0;
            if (auras.rake > t && auras.rake > 0) activeBleeds++;
            if (auras.rip > t && auras.rip > 0) activeBleeds++;
            if (auras.pounce > t && auras.pounce > 0) activeBleeds++;

            // Format OW Multiplier (e.g. "1.3x")
            var owStr = "-";
            if (activeBleeds > 0) owStr = (1 + (0.30 * activeBleeds)).toFixed(1) + "x";

            log.push({
                t: Math.max(0, t),
                event: (dmgVal > 0 || isTick) ? (isTick ? "Tick" : "Damage") : (action.includes("Proc") || info.includes("Aura") ? "Buff" : "Cast"),
                ability: action,
                result: res || "",
                dmgNorm: dmgNorm,
                dmgCrit: dmgCrit,
                dmgTick: dmgTick,
                dmgSpec: dmgSpec,

                // NEW: Added Pounce
                remPounce: Math.max(0, auras.pounce - t),
                remRake: Math.max(0, auras.rake - t),
                remRip: Math.max(0, auras.rip - t),
                // NEW: Added OW
                ow: owStr,

                remFF: (cfg.debuff_ff) ? 40.0 : Math.max(0, auras.ff - t),

                // Neue Felder für die Spalten
                ooc: oocActive,
                tf: tfRem,
                activeBuffs: activeBuffs, // Objekt für dynamische Spalten in ui.js

                eChange: Math.round(eChange) || 0,
                cp: cp,
                ap: Math.round(curAP),
                haste: ((hMod - 1) * 100),
                speed: spd,
                arp: curArP,
                mana: Math.floor(mana),
                energy: Math.round(energy),
                info: info || ""
            });
        }
    }

    function dealDamage(source, val, type, res, isCrit, isTick, eChangeOverride) {
        val = Math.floor(val);

        if (!dmgSources[source]) dmgSources[source] = 0;
        dmgSources[source] += val;
        totalDmg += val;
        // Für Logs runden wir nur visuell in logAction, übergeben aber den exakten Wert
        logAction(source, type, res, val, isCrit, isTick, eChangeOverride || 0);
    }
    //function rollDamageRange(min, max) { return min + Math.random() * (max - min); }
    // UPDATED: Use RNG Handler
    function rollDamageRange(min, max) { return rng.dmg(min, max); }


    // ========================================================================
    // --- POUNCE OPENER LOGIC (BEFORE LOOP) ---
    // ========================================================================
    if (cfg.use_pounce && cfg.rota_position === 'back') {
        energy -= 50;
        cp += 1;
        gcdEnd = 1.0;

        // Pounce Formula: 0.18 * AP + 147.5 (Total Bleed over 18s)
        var pounceTotal = (147.5 + (0.18 * getCurrentAP())) * modNaturalWeapons; //Natural Weapon Modifier
        var pounceTick = pounceTotal / 6;

        auras.pounce = 18.0; // 6 ticks * 3s
        // Manuelles Hinzufügen der Ticks
        for (var i = 1; i <= 6; i++) {
            addEvent(i * 3.0, "dot_tick", { name: "pounce", dmg: pounceTick, label: "Pounce" });
        }

        logAction("Pounce", "Opener", "Cast", 0, false, false, -50);
    }

    // -----------------------------------------
    // 3. MAIN SIMULATION LOOP
    // -----------------------------------------

    while (t < maxT) {

        // --- A. DETERMINE NEXT TIME STEP ---
        var nextT = maxT;
        if (events.length > 0) nextT = Math.min(nextT, events[0].t);
        if (nextEnergyTick > t) nextT = Math.min(nextT, nextEnergyTick);
        if (swingTimer > t) nextT = Math.min(nextT, swingTimer);
        if (gcdEnd > t) nextT = Math.min(nextT, gcdEnd);

        t = nextT;
        if (t >= maxT) break;

        // --- B. PROCESS EVENTS (Ticks) ---
        while (events.length > 0 && events[0].t <= t + 0.001) {
            var evt = events.shift();

            if (evt.type === "dot_tick") {
                var name = evt.data.name;
                // Expiry Check
                if (auras[name] >= t - 0.01) {
                    if (cfg.canBleed && name != "venom_dot") {

                        // Ancient Brutality
                        // if Energy = 100 then no Energy Refund vom AB
                        // if Energy < 100 and > 95 then only partial refund
                        // if energy < 95 then full refund
                        var EnergeyFromAB = 0;
                        if (cfg.tal_ancient_brutality > 0 && energy <= 95) EnergeyFromAB = 5;
                        else if (cfg.tal_ancient_brutality > 0 && energy > 95 && energy < 100) EnergeyFromAB = 100 - energy;
                        energy = Math.min(100, energy + EnergeyFromAB);

                        var dmgVal = evt.data.dmg;
                        dealDamage(evt.data.label, dmgVal, "Bleed", "Tick", false, true, EnergeyFromAB);





                        // Genesis (T2.5) 5p: Proc on Tick
                        // Rake (6%), Rip (10%)
                        /*if (cfg.set_genesis_5p) {
                            var chance = (name === "rake") ? 0.06 : 0.10;
                            if (Math.random() < chance) {
                                auras.genesisProc = t + 30.0; // Empower Next Cast
                                logAction("Genesis", "Proc (Next Cast Empowered)", "Proc", 0, false, false);
                            }
                        }*/
                        // Genesis (T2.5) 5p: Proc on Tick
                        if (cfg.set_genesis_5p) {
                            var chance = (name === "rake") ? 6.0 : 10.0;
                            if (rng.proc("GenesisTick", chance)) {
                                auras.genesisProc = t + 30.0;
                                logAction("Genesis", "Proc (Next Cast Empowered)", "Proc", 0, false, false);
                            }
                        }
                    }

                    if (name === "venom_dot") {
                        var dmgVal = evt.data.dmg;
                        dealDamage(evt.data.label, dmgVal, "Nature", "Tick", false, true);
                    }
                }

            }
            else if (evt.type === "tf_energy") {
                if (auras.tigersFury > t - 0.01) energy = Math.min(100, energy + 10);
            }
        }

        // Energy Tick
        if (t >= nextEnergyTick - 0.001) {
            var tickAmt = (auras.berserk > t && cfg.use_berserk) ? 40 : 20;

            // Capture old energy to calc actual gain for log
            var oldEnergy = energy;
            energy = Math.min(100, energy + tickAmt);
            var gained = energy - oldEnergy;

            // Log the tick
            // action="Energy Tick", info="Regen", res="Tick", dmg=0, crit=false, isTick=false (to treat as generic event), eChange=gained
            logAction("Energy Tick", "Regen", "Tick", 0, false, false, gained);

            nextEnergyTick += 2.0;
        }

        // --- C. AUTO ATTACK LOGIC ---
        // Snapshot Omen state BEFORE Auto Attacks to prevent immediate consumption of fresh procs
        var oocState = (auras.clearcasting > t);

        if (t >= swingTimer - 0.001) {

            var performSwing = function (isExtra, probabilityScale) {
                var pScale = (typeof probabilityScale !== 'undefined') ? probabilityScale : 1.0;

                // Damage Roll
                var baseDmgRoll = rollDamageRange(base.minDmg, base.maxDmg);
                var currentAP = getCurrentAP();

                if (isExtra) currentAP += 315;

                var apBonus = (currentAP - base.baseAp) / 14.0;
                var rawDmg = baseDmgRoll + apBonus;

                if (auras.tigersFury > t) rawDmg += 50;
                if (auras.zhm > t && stacks.zhm > 0) rawDmg += (stacks.zhm * 2);

                rawDmg *= modNaturalWeapons;

                // --- ATTACK TABLE ---
                var isBoss = (cfg.enemyLevel == 63);
                var isFront = (cfg.rota_position === "front");
                var canBlock = (cfg.enemy_can_block === 1);

                // Inputs sicherstellen
                var iHit = parseFloat(cfg.inputHit) || 0;
                var iCrit = parseFloat(cfg.inputCrit) || 0;

                var missC = Math.max(0, (isBoss ? 8.0 : 5.0) - iHit);
                var dodgeC = isBoss ? 6.5 : 5.0;
                var parryC = (isFront) ? (isBoss ? 14.0 : 5.0) : 0;
                var blockC = (isFront && canBlock) ? 5.0 : 0;
                var glanceC = isBoss ? 40.0 : 10.0;
                var critC = Math.max(0, iCrit - (isBoss ? 4.8 : 0));


                // --- STANDARD MODE (Stochastic) ---
                // Prepare Table used for Events (Buckets)
                var table = { miss: missC, dodge: dodgeC, parry: parryC, block: blockC, glance: glanceC, crit: critC };
                var hitType = rng.attackTable("Auto", table);

                // Counters (Events)
                if (hitType === "MISS") { if (!missCounts.Auto) missCounts.Auto = 0; missCounts.Auto++; }
                else if (hitType === "DODGE") { if (!dodgeCounts.Auto) dodgeCounts.Auto = 0; dodgeCounts.Auto++; }
                else if (hitType === "PARRY") { if (!parryCounts.Auto) parryCounts.Auto = 0; parryCounts.Auto++; }
                else if (hitType === "GLANCE") { if (!glanceCounts.Auto) glanceCounts.Auto = 0; glanceCounts.Auto++; }
                else if (hitType === "BLOCK") { if (!missCounts.Block) missCounts.Block = 0; missCounts.Block++; }
                else if (hitType === "CRIT") { if (!critCounts.Auto) critCounts.Auto = 0; critCounts.Auto++; }
                if (!counts.Auto) counts.Auto = 0; counts.Auto++;

                var blockValue = isBoss ? 38 : 0;
                var glancePenalty = isBoss ? 0.35 : 0.05;

                if (hitType === "BLOCK") rawDmg = Math.max(0, rawDmg - blockValue);
                else if (hitType === "GLANCE") rawDmg *= (1 - glancePenalty);
                else if (hitType === "CRIT") rawDmg *= 2.0;

                if (hitType !== "MISS" && hitType !== "DODGE" && hitType !== "PARRY") {
                    var dr = getDamageReduction(t, auras.ff);
                    rawDmg *= (1 - dr);

                    dealDamage(isExtra ? "Extra Attack" : "Auto Attack", rawDmg, "Physical", hitType, (hitType === "CRIT"), false);

                    if (auras.zhm > t && stacks.zhm > 0) stacks.zhm--; // <--- HIER EINFÜGEN

                    // Procs (Standard)
                    if (cfg.tal_omen > 0 && rng.proc("Omen", 10)) {
                        auras.clearcasting = t + 15.0;
                        logAction("Proc", "Clearcasting", "Proc", 0, false, false);
                    }
                    if (cfg.buff_ft_totem) {
                        // Vanilla Rank 4: 15-45 Dmg flat -> Avg 30
                        // Scaled by Weapon Speed logic usually: (Dmg * Speed / 4.0)
                        // Cat Speed = 1.0 - tWoW uses Weapon Speed (we do not read Weapon Speed from Weapon Slot yet) - we will go with 2 for now
                        var ftDmg = 30.0 * (2.0 / 4.0);
                        dealDamage("Flametongue", ftDmg, "Fire", "Hit(Avg)", false, false);
                    }
                    if (cfg.hasT05_4p && rng.proc("T05", 2)) {
                        var EnergyGain = (energy <= 80) ? 20 : (100 - energy);
                        energy = Math.min(100, energy + EnergyGain);
                        logAction("Proc", "T0.5 Energy", "Proc", 0, false, false, EnergyGain);
                    }
                    if (auras.talonBuff > t) {
                        var EnergyGain = (energy <= 97) ? 3.0 : (100 - energy);
                        energy = Math.min(100, energy + EnergyGain);
                        logAction("Talon 5p", "Energy Return", "Proc", 0, false, false, EnergyGain);
                    }
                    if (auras.cenarionHaste > t && stacks.cenarion > 0) {
                        stacks.cenarion--;
                        if (stacks.cenarion <= 0) auras.cenarionHaste = 0;
                    }
                    if (cfg.t_shieldrender && rng.proc("Shieldrender", 7)) {
                        auras.shieldrender = t + 3.0;
                        logAction("Shieldrender", "Ignore Armor", "Proc", 0, false, false);
                    }
                    if (cfg.t_hoj && !isExtra && rng.proc("HoJ", 2)) {
                        logAction("HoJ", "Extra Attack", "Proc", 0, false, false);
                        performSwing(true);
                    }
                    if (cfg.t_maelstrom && rng.proc("Maelstrom", 3)) {
                        var MaelstromDmg = rollDamageRange(200, 301);
                        dealDamage("Maelstrom", MaelstromDmg, "Nature", "Proc", false, false);
                        if (rng.proc("MaelstromCrit", critC)) dealDamage("Maelstrom", MaelstromDmg, "Nature", "Proc Crit", true, false);
                    }
                    if (cfg.t_coil && rng.proc("Coil", 5)) {
                        var CoilDamage = rollDamageRange(50, 71);
                        dealDamage("Heating Coil", CoilDamage, "Fire", "Proc", false, false);
                        if (rng.proc("CoilCrit", critC)) dealDamage("Heating Coil", CoilDamage, "Fire", "Proc Crit", true, false);
                    }
                    if (cfg.t_venoms && rng.proc("Venoms", 20)) {
                        if (stacks.venom < 2) stacks.venom++;
                        auras.venom = t + 12.0;
                        var dotDmgPerTick = stacks.venom * 120 / 4;
                        removeEvent("dot_tick", "venom");
                        for (var tick = 1; tick <= 4; tick++) addEvent(t + (tick * 3.0), "dot_tick", { name: "venom", dmg: dotDmgPerTick, label: "Venoms" });
                    }
                    if (auras.swarmguard > t && stacks.swarmguard < 6 && rng.proc("Swarmguard", 80)) {
                        stacks.swarmguard++;
                        logAction("Proc", "Swarmguard", "Stack " + stacks.swarmguard, "Proc", 0, false, false);
                    }
                    if (cfg.buff_wf_totem && !isExtra && rng.proc("WF", 20)) {
                        logAction("Proc", "Windfury", "Extra Attack", "Proc", 0, false, false);
                        performSwing(true);
                    }

                }

            };

            performSwing(false);

            var currentSpeed = base.speed;
            var hasteMod = getHasteMod();
            swingTimer = t + (currentSpeed / hasteMod);
        }

        // --- D. GCD / ROTATION LOGIC ---

        // 1. Calc Costs (Global)
        var costClaw = 45 - cfg.tal_ferocity;
        var costRake = 40 - cfg.tal_ferocity;
        var costShred = 60 - (cfg.tal_imp_shred * 6);
        var costRip = 30;
        var costBite = 35;
        var costTF = 30;

        // Cost Modifiers
        if (cfg.set_cenarion_5p) costTF -= 5;
        if (cfg.set_genesis_3p) { costClaw -= 3; costRake -= 3; costShred -= 3; }
        if (cfg.idol_ferocity) { costClaw -= 3; costRake -= 3; }

        var isOoc = oocState; // Use snapshot
        if (isOoc) {
            costClaw = 0; costRake = 0; costShred = 0; costRip = 0; costBite = 0;
        }

        // 2. OFF-GCD ACTIONS (Simultaneous Execution)

        // Potion
        if (cds.potion <= t) {
            if (cfg.consum_potion_quickness) {
                auras.potionQuickness = t + 30.0;
                cds.potion = t + 120.0;
                logAction("Potion", "Quickness", "Buff", 0, false, false, 0);
            }
            else if (cfg.consum_mighty_rage) {
                auras.mightyRage = t + 20.0;
                cds.potion = t + 120.0;
                logAction("Potion", "Mighty Rage", "Buff", 0, false, false, 0);
            }
        }

        // Juju Flurry (Independent CD, usually 1 min)
        if (cfg.consum_juju_flurry && cds.jujuFlurry <= t) {
            auras.jujuFlurry = t + 20.0;
            cds.jujuFlurry = t + 60.0;
            logAction("Juju", "Flurry", "Buff", 0, false, false, 0);
        }

        // Berserk
        if (cfg.tal_berserk > 0 && cds.berserk <= t && cfg.use_berserk) {
            auras.berserk = t + 20.0; cds.berserk = t + 360.0;
            logAction("Berserk", "+100% Regen", "Buff", 0, false, false, 0);
        }

        // Tiger's Fury
        if (auras.tigersFury <= t && cfg.use_tf && energy >= costTF && t >= gcdEnd) {
            energy -= costTF;
            // Update: TF Base Duration is 18s with Energy ticks
            var dur = 18;
            auras.tigersFury = t + dur;

            // Blood Frenzy Talent triggers separate Attack Speed Buff
            if (cfg.tal_blood_frenzy > 0) auras.BloodFrenzy = t + 18;

            for (var i = 1; i * 3 <= dur; i++) addEvent(t + (i * 3.0), "tf_energy");
            logAction("Tiger's Fury", "Buff", "Buff", 0, false, false, -costTF);
        }

        // Trinkets (Priority 0)
        // Slayer's Crest
        if (cfg.t_slayer && cds.slayer <= t) {
            auras.slayer = t + 20;
            cds.slayer = t + 120;
            logAction("Slayer", "Activated", "Buff", 0, false, false);
        }

        // Kiss of the Spider
        if (cfg.t_spider && cds.spider <= t) {
            auras.spider = t + 15;
            cds.spider = t + 120;
            logAction("Spider", "Activated", "Buff", 0, false, false);
        }

        // Earthstrike
        if (cfg.t_earthstrike && cds.earthstrike <= t) {
            auras.earthstrike = t + 20;
            cds.earthstrike = t + 120;
            logAction("Earthstrike", "Activated", "Buff", 0, false, false);
        }

        // Jom Gabbar
        if (cfg.t_jomgabbar && cds.jom <= t) {
            auras.jom = t + 20;
            auras.jomStart = t;
            cds.jom = t + 120;
            logAction("JomGabbar", "Activated", "Buff", 0, false, false);
        }

        // Molten Emberstone
        if (cfg.t_emberstone && cds.emberstone <= t) {
            auras.emberstone = t + 20;
            cds.emberstone = t + 180;
            logAction("Emberstone", "Activated", "Buff", 0, false, false);
        }

        // Zandalarian Hero Medallion
        if (cfg.t_zhm && cds.zhm <= t) {
            auras.zhm = t + 20;
            stacks.zhm = 20;
            cds.zhm = t + 120;
            logAction("ZHM", "Activated", "Buff", 0, false, false);
        }

        // Swarmguard (Stacking Logic handled in Hits)
        if (cfg.t_swarmguard && cds.swarmguard <= t && auras.swarmguard <= t) {
            auras.swarmguard = t + 30;
            stacks.swarmguard = 0;
            cds.swarmguard = t + 180;
            logAction("Swarmguard", "Activated", "Buff", 0, false, false);
        }


        // 3. GCD ROTATION (Main Actions)
        if (t >= gcdEnd) {
            var action = null;
            var waitingForEnergy = false;

            // Standard Rotation Prio

            if (!action && !waitingForEnergy && cp >= cfg.rip_cp && cfg.use_rip && cfg.canBleed && auras.rip <= t) {
                if (energy >= costRip) action = "Rip"; else waitingForEnergy = true;
            }
            if (!action && !waitingForEnergy && cp >= cfg.fb_cp && cfg.use_fb) {
                // FIX: Priority Check - Only Bite if Rip is active (or Rip is disabled/impossible)
                var biteAllowed = (!cfg.use_rip || !cfg.canBleed || auras.rip > t);

                if (biteAllowed) {
                    if (energy >= cfg.fb_energy) { if (energy >= costBite) action = "Ferocious Bite"; }
                    else waitingForEnergy = true;
                }
            }

            if (!action && !waitingForEnergy && energy < cfg.reshift_energy && cfg.use_reshift) {
                // Check TF Overwrite Logic
                var tfRem = Math.max(0, auras.tigersFury - t);
                var canShift = true;

                // Wenn TF aktiv ist
                if (tfRem > 0) {
                    // Darf nur shiften, wenn Overwrite erlaubt UND Restzeit <= Limit
                    if (!cfg.reshift_over_tf || tfRem > cfg.reshift_over_tf_dur) {
                        canShift = false;
                    }
                }

                if (canShift) action = "Reshift";
            }


            if (!action && !waitingForEnergy && cfg.canBleed && auras.rake <= t && cfg.use_rake) {
                if (cfg.rota_position === "back" && isOoc && cfg.shred_ooc_only && cfg.use_shred) {
                    if (energy >= costShred || isOoc) {
                        action = "Shred";
                    }
                }
                else {
                    if (energy >= costRake) action = "Rake";
                }
            }

            if (!action && !waitingForEnergy) {
                if (cfg.rota_position === "back" && cfg.use_shred) {
                    if (cfg.shred_ooc_only && isOoc) {
                        action = "Shred";
                    } else if (energy >= costShred && !cfg.shred_ooc_only && cfg.use_shred) {
                        action = "Shred";
                    }
                }
                if (!action && cfg.use_claw) {
                    if (energy >= costClaw || isOoc) action = "Claw";
                }
            }

            // UPDATED: Cast Faerie Fire only if NOT provided externally
            if (!action && !cfg.debuff_ff && auras.ff <= t && cfg.use_ff) action = "Faerie Fire";

            // Execute
            if (action) {
                var castCost = 0;
                var performAttack = false;
                var triggersGCD = true;

                if (action === "Reshift") {
                    // Update: Only remove TF Damage/Energy buff, keep Blood Frenzy (Speed)
                    mana -= 300; auras.tigersFury = 0;
                    var furorEnergy = (cfg.tal_furor * 8);

                    // UPDATED: Furor (Talent) + Gift of Ferocity (Enchant)
                    var furorEnergy = (cfg.tal_furor * 8);
                    var giftEnergy = cfg.hasGiftOfFerocity ? 20 : 0;
                    var newE = furorEnergy + giftEnergy;

                    var eChange = newE - energy; // Differenz berechnen
                    energy = Math.min(100, newE);
                    logAction("Reshift", "Energy -> " + energy, "Cast", 0, false, false, eChange);
                    gcdEnd = t + 1.5;
                }
                else if (action === "Faerie Fire") {
                    auras.ff = t + 40.0; logAction("Faerie Fire", "-505 Armor", "Debuff", 0, false, false, 0); gcdEnd = t + 1.0;
                }
                else {
                    performAttack = true;
                    if (action === "Claw") castCost = costClaw;
                    if (action === "Rake") castCost = costRake;
                    if (action === "Shred") castCost = costShred;
                    if (action === "Rip") castCost = costRip;
                    if (action === "Ferocious Bite") castCost = costBite;
                }

                if (performAttack) {
                    energy -= castCost;
                    if (isOoc) { auras.clearcasting = 0; logAction("Omen", "Consumed", "Fade", 0, false, false); }

                    // --- YELLOW ATTACK TABLE & SMOOTHING ---
                    var isBoss = (cfg.enemyLevel == 63);
                    var isFront = (cfg.rota_position === "front");
                    var canBlock = (cfg.enemy_can_block === 1);

                    // 1. Calculate Probabilities
                    var missC = Math.max(0, (isBoss ? 8.0 : 5.0) - baseHit - cfg.tal_nat_wep);
                    var dodgeC = isBoss ? 6.5 : 5.0;
                    var parryC = (isFront) ? (isBoss ? 14.0 : 5.0) : 0;
                    var blockC = (isFront && canBlock) ? 5.0 : 0;
                    var critChance = cfg.inputCrit - (isBoss ? 4.8 : 0);

                    // Genesis 5p Crit Bonus
                    if (auras.genesisProc > t && ["Shred", "Rake", "Claw"].includes(action)) {
                        critChance += 15;
                    }

                    // Variables for Outcome
                    var res = "HIT";
                    var dmgMult = 1.0;
                    var cpGen = (["Claw", "Rake", "Shred"].includes(action)) ? 1 : 0;
                    var procChanceMod = 1.0; // Modifies proc rates based on hit chance


                    // =================================================
                    // STANDARD MODE (RNG / Buckets)
                    // =================================================
                    var yellowTable = { miss: missC, dodge: dodgeC, parry: parryC, block: blockC, glance: 0, crit: 0 };
                    res = rng.attackTable("Yellow_" + action, yellowTable);

                    // Crit Check (Two-Roll style if HIT)
                    if (res === "HIT" || res === "BLOCK") {
                        if (rng.proc("YellowCrit_" + action, critChance)) {
                            res = "CRIT";
                        }
                    }

                    // Refunds
                    if (res === "MISS" || res === "DODGE" || res === "PARRY") {
                        var refund = (castCost * 0.8);
                        energy += refund;
                        if (res === "MISS") missCounts[action] = (missCounts[action] || 0) + 1;
                        else if (res === "DODGE") dodgeCounts[action] = (dodgeCounts[action] || 0) + 1;
                        else if (res === "PARRY") { if (!missCounts.Parry) missCounts.Parry = 0; missCounts.Parry++; }
                        logAction(action, "Refund", res, 0, false, false, -castCost + refund);

                        // Abbruch für Schaden
                        dmgMult = 0;
                    } else {
                        // Hit logic
                        if (res === "CRIT") dmgMult = 2.0;
                        // Block logic handled later in damage calc
                    }


                    // --- DAMAGE CALCULATION & EXECUTION ---
                    // Wird nur ausgeführt, wenn dmgMult > 0 (also kein Full Miss im Standard Modus)
                    if (dmgMult > 0) {

                        if (res === "CRIT") critCounts[action] = (critCounts[action] || 0) + 1; // Nur Statistik für Standard Modus

                        // Primal Fury (CP Generation)
                        if (cpGen > 0 && cfg.tal_primal_fury > 0) {
                            var isCritEvent = (res === "CRIT")

                            if (isCritEvent) {
                                // 50% Chance pro Punkt (also 100% bei 2 Punkten)
                                if (rng.proc("PrimalFury", cfg.tal_primal_fury * 50)) cpGen++;
                            }
                        }

                        // Base Damage Calculation
                        var curAP = getCurrentAP();
                        var baseDmgRoll = rollDamageRange(base.minDmg, base.maxDmg);
                        var apBonus = (curAP - base.baseAp) / 14.0;
                        var normalDmg = baseDmgRoll + apBonus;
                        if (auras.tigersFury > t) normalDmg += 50;
                        if (auras.zhm > t && stacks.zhm > 0) normalDmg += (stacks.zhm * 2);

                        // Genesis Consumption
                        if (auras.genesisProc > t && ["Shred", "Rake", "Claw"].includes(action)) {
                            normalDmg *= 1.15;
                            auras.genesisProc = 0;
                            logAction("Genesis", "Consumed", "Proc", 0, false, false);
                        }

                        var abilityDmg = 0;
                        var isBleed = false;

                        if (action === "Claw") {
                            abilityDmg = 1.05 * normalDmg + 115;
                            if (cfg.tal_open_wounds > 0) {
                                var bleeds = 0; if (auras.rake > t) bleeds++; if (auras.rip > t) bleeds++; if (auras.pounce > t) bleeds++;
                                abilityDmg *= (1 + (0.30 * bleeds));
                            }
                            abilityDmg *= modPredatoryStrikes;
                        }
                        else if (action === "Shred") {
                            abilityDmg = 2.25 * normalDmg + 180;
                            if (cfg.tal_imp_shred > 0) abilityDmg *= (1 + cfg.tal_imp_shred * 0.05);

                            if (auras.laceration > t) {
                                var EnergyRefund = (energy >= 85) ? (100 - energy) : 15;
                                energy = Math.min(100, energy + EnergyRefund);
                                auras.laceration = 0;
                                logAction("Laceration", "Refund " + EnergyRefund, "Proc", 0, false, false, EnergyRefund);
                            }
                        }
                        else if (action === "Rake") {
                            abilityDmg = 61 + (0.115 * curAP);
                            abilityDmg *= modPredatoryStrikes;
                            // DoT Teil
                            var dotTotal = 102 + (0.09 * curAP);
                            dotTotal *= modPredatoryStrikes;

                            var tickVal = dotTotal / 3;
                            var rInterval = cfg.idol_savagery ? 2.7 : 3.0;
                            var rDur = cfg.idol_savagery ? 8.1 : 9.0;

                            auras.rake = t + rDur;
                            addEvent(t + rInterval, "dot_tick", { name: "rake", dmg: tickVal, label: "Rake" });
                            addEvent(t + rInterval * 2, "dot_tick", { name: "rake", dmg: tickVal, label: "Rake" });
                            addEvent(t + rInterval * 3, "dot_tick", { name: "rake", dmg: tickVal, label: "Rake" });
                        }
                        else if (action === "Rip") {
                            activeRipCP = cp;
                            var ticks = 4 + cp;
                            var cpScaled = Math.min(4, cp);
                            var apPart = (curAP - base.baseAp);
                            var tickDmg = 47 + (cp - 1) * 31 + (cpScaled / 100 * apPart);
                            if (cfg.tal_open_wounds > 0) tickDmg *= (1 + 0.15 * cfg.tal_open_wounds);

                            var ripInterval = cfg.idol_savagery ? 1.8 : 2.0;
                            auras.rip = t + (ticks * ripInterval);
                            for (var i = 1; i <= ticks; i++) {
                                addEvent(t + (i * ripInterval), "dot_tick", { name: "rip", dmg: tickDmg, label: "Rip" });
                            }
                            cpGen = 0; isBleed = true;

                            logAction("Rip", "Applied (DoT)", "Hit", 0, false, false, -castCost);
                        }
                        else if (action === "Ferocious Bite") {
                            var cpUsed = cp;

                            var extraE = energy; energy = 0;
                            var baseFB = 70 + 128 * cp + 0.07 * curAP;
                            var multiplier = Math.pow(1.005, extraE);
                            abilityDmg = baseFB * multiplier;
                            if (cfg.tal_feral_aggression > 0) abilityDmg *= (1 + cfg.tal_feral_aggression * 0.03);
                            cpGen = 0;

                            if (cfg.set_cenarion_8p) {
                                if (rng.proc("Cenarion8p", 20 * cp * procChanceMod)) {
                                    auras.cenarionHaste = t + 999;
                                    stacks.cenarion = 5;
                                    logAction("Cenarion", "5 Haste Charges", "Proc", 0, false, false);
                                }
                            }

                            // --- CARNAGE LOGIC (Variable Chance + Snapshot Refresh) ---
                            // Formula: Rank * 10% per CP spent
                            var carnageChance = cpUsed * cfg.tal_carnage * 10;

                            if (carnageChance > 0 && rng.proc("Carnage", carnageChance * procChanceMod)) {

                                logAction("Carnage", "Proc (" + carnageChance + "%)", "Proc", 0, false, false);

                                // 1. Refresh Rake if active
                                if (auras.rake > t) {
                                    // Rake hat keine CP-Skalierung, wir nehmen Current AP für den Refresh
                                    var cRakeDot = (102 + (0.09 * curAP)) * modPredatoryStrikes;
                                    var cRakeTick = cRakeDot / 3;
                                    var rInt = cfg.idol_savagery ? 2.7 : 3.0;
                                    var rD = cfg.idol_savagery ? 8.1 : 9.0;

                                    auras.rake = t + rD;
                                    removeEvent("dot_tick", "rake");
                                    addEvent(t + rInt, "dot_tick", { name: "rake", dmg: cRakeTick, label: "Rake" });
                                    addEvent(t + rInt * 2, "dot_tick", { name: "rake", dmg: cRakeTick, label: "Rake" });
                                    addEvent(t + rInt * 3, "dot_tick", { name: "rake", dmg: cRakeTick, label: "Rake" });
                                }

                                // 2. Refresh Rip if active (Snapshot CP nutzen!)
                                if (auras.rip > t) {
                                    // Nutze activeRipCP für Dauer und Schaden
                                    var usedRipCP = activeRipCP || 5; // Fallback auf 5 falls 0 (sollte nicht passieren wenn Rip aktiv ist)

                                    var cRipTicks = 4 + usedRipCP;

                                    // Recalculate Rip Damage based on Snapshot CP
                                    var cApPart = (curAP - base.baseAp);
                                    var cRipTickDmg = 47 + (usedRipCP - 1) * 31 + (Math.min(4, usedRipCP) / 100 * cApPart);

                                    if (cfg.tal_open_wounds > 0) cRipTickDmg *= (1 + 0.15 * cfg.tal_open_wounds);

                                    var ripInt = cfg.idol_savagery ? 1.8 : 2.0;

                                    // Reset Duration to full length of original CP
                                    auras.rip = t + (cRipTicks * ripInt);

                                    removeEvent("dot_tick", "rip");
                                    for (var i = 1; i <= cRipTicks; i++) {
                                        addEvent(t + (i * ripInt), "dot_tick", { name: "rip", dmg: cRipTickDmg, label: "Rip" });
                                    }
                                }

                                // 3. Add 1 Combo Point (Refund)
                                cpGen = 1;
                            }



                        }

                        // Apply Multipliers
                        abilityDmg *= modNaturalWeapons;
                        abilityDmg *= dmgMult; // Enthält Crit (x2 oder Avg) und Hit (x1 oder Avg)

                        // Block Reduction (für Standard Modus und Avg Modus)
                        if (res === "BLOCK") abilityDmg = Math.max(0, abilityDmg - (isBoss ? 38 : 0));

                        if (!isBleed && action !== "Rip") {
                            var dr = getDamageReduction(t, auras.ff);
                            abilityDmg *= (1 - dr);
                        }

                        if (abilityDmg > 0) {
                            var realCost = castCost;
                            if (action === "Ferocious Bite") realCost += extraE;
                            var logRes = res;
                            dealDamage(action, abilityDmg, isBleed ? "Bleed" : "Physical", logRes, (res === "CRIT"), false, -realCost);
                        }

                        // --- PROCS ON CAST (Check Hit Success) ---
                        var hitSuccess = true;
                        var pScale = 1.0;


                        hitSuccess = (dmgMult > 0);


                        if (hitSuccess) {

                            if (auras.zhm > t && stacks.zhm > 0) stacks.zhm--;

                            // 1. Buffs (Buckets mit pScale)
                            if (cfg.set_talon_3p && ["Claw", "Rake", "Shred"].includes(action)) {
                                if (rng.proc("Talon3p", 5 * pScale)) {
                                    auras.talonAP = t + 10.0;
                                    logAction("Talon 3p", "+100 AP", "Proc", 0, false, false);
                                }
                            }
                            if (cfg.tal_omen > 0 && rng.proc("Omen", 10 * pScale)) {
                                auras.clearcasting = t + 15.0;
                                logAction("Proc", "Clearcasting", "Proc", 0, false, false);
                            }
                            if (auras.cenarionHaste > t && stacks.cenarion > 0 && rng.proc("CenarionConsume", 100 * pScale)) {
                                stacks.cenarion--;
                                if (stacks.cenarion <= 0) auras.cenarionHaste = 0;
                            }
                            // Trinkets (Buffs)
                            if (cfg.t_shieldrender && rng.proc("Shieldrender", 7 * pScale)) {
                                auras.shieldrender = t + 3.0;
                                logAction("Shieldrender", "Ignore Armor", "Proc", 0, false, false);
                            }
                            if (auras.swarmguard > t && stacks.swarmguard < 6 && rng.proc("Swarmguard", 80 * pScale)) {
                                stacks.swarmguard++;
                                logAction("Swarmguard", "Stack " + stacks.swarmguard, "Proc", 0, false, false);
                            }
                            if (cfg.set_talon_5p && (action === "Rip" || action === "Ferocious Bite")) {
                                // Stacks bauen
                                if (rng.proc("TalonStack", 100 * pScale)) { // Guaranteed on hit
                                    stacks.talonFero += cp; // cp is usedCP
                                    if (stacks.talonFero >= 25) {
                                        stacks.talonFero = 0;
                                        auras.talonBuff = t + 10.0;
                                        logAction("Primal Ferocity", "Proc! +25% AP", "Proc", 0, false, false);
                                    }
                                }
                            }


                            // 2. Instants

                            // --- STANDARD MODE (Legacy Instants) ---
                            if (cfg.hasT05_4p && rng.proc("T05", 2)) {
                                var EnergyGain = (energy <= 80) ? 20 : (100 - energy);
                                energy = Math.min(100, energy + EnergyGain);
                                logAction("Proc", "T0.5 Energy", "Proc", 0, false, false, EnergyGain);
                            }
                            if (auras.talonBuff > t) {
                                var EnergyGain = (energy <= 97) ? 3.0 : (100 - energy);
                                energy = Math.min(100, energy + EnergyGain);
                                logAction("Talon 5p", "Energy Return", "Proc", 0, false, false, EnergyGain);
                            }
                            if (cfg.idol_laceration && (action === "Rip" || action === "Ferocious Bite")) {
                                if (rng.proc("LacerationIdol", 20 * cp)) {
                                    auras.laceration = t + 10.0;
                                    logAction("Laceration", "Next Shred Refund", "Proc", 0, false, false);
                                }
                            }
                            if (cfg.idol_emeral_rot && (action === "Rip" || action === "Ferocious Bite")) {
                                if (rng.proc("EmeraldRot", 20 * cp)) {
                                    dealDamage("Emerald Rot", rollDamageRange(150, 190), "Nature", "Proc", false, false);
                                }
                            }
                            // Trinket Instants
                            if (cfg.t_hoj && !isExtra && rng.proc("HoJ", 2)) {
                                logAction("HoJ", "Extra Attack", "Proc", 0, false, false);
                                performSwing(true);
                            }
                            if (cfg.t_maelstrom && rng.proc("Maelstrom", 3)) {
                                var MaelstromDmg = rollDamageRange(200, 301);
                                dealDamage("Maelstrom", MaelstromDmg, "Nature", "Proc", false, false);
                                if (rng.proc("MaelstromCrit", critChance)) dealDamage("Maelstrom", MaelstromDmg, "Nature", "Proc Crit", true, false);
                            }
                            if (cfg.t_coil && rng.proc("Coil", 5)) {
                                var CoilDamage = rollDamageRange(50, 71);
                                dealDamage("Heating Coil", CoilDamage, "Fire", "Proc", false, false);
                                if (rng.proc("CoilCrit", critChance)) dealDamage("Heating Coil", CoilDamage, "Fire", "Proc Crit", true, false);
                            }
                            if (cfg.buff_wf_totem && !isExtra && rng.proc("WF", 20)) {
                                logAction("Windfury", "Extra Attack", "Proc", 0, false, false);
                                performSwing(true);
                            }


                            // CP Logic Update (already done in step before)
                            if (action === "Rip" || action === "Ferocious Bite") cp = 0;
                            cp += cpGen;
                            if (cp > 5) cp = 5;
                        }
                    }

                    if (!counts[action]) counts[action] = 0; counts[action]++;
                    gcdEnd = t + 1.0;
                }
            }
        }

        if (t > maxT + 10) break;
    }

    // -----------------------------------------
    // 4. RETURN STATS
    // -----------------------------------------
    return {
        dps: totalDmg / maxT, totalDmg: totalDmg, duration: maxT,
        log: log, dmgSources: dmgSources, counts: counts,
        missCounts: missCounts, dodgeCounts: dodgeCounts, critCounts: critCounts, glanceCounts: glanceCounts
    };
}

// Helper: Aggregate multiple runs
// Helper: Aggregate multiple runs
function aggregateResults(results) {
    if (!results || results.length === 0) return {};
    var totalDPS = 0, totalDmg = 0;
    var counts = {}, dmgSources = {}, missCounts = {}, critCounts = {}, glanceCounts = {};
    var minDps = Infinity, maxDps = 0;
    var minRun = null, maxRun = null;

    // First Pass: Sums and Min/Max
    results.forEach(r => {
        if (r.dps < minDps) { minDps = r.dps; minRun = r; }
        if (r.dps > maxDps) { maxDps = r.dps; maxRun = r; }

        totalDPS += r.dps; totalDmg += r.totalDmg;
        for (var k in r.counts) counts[k] = (counts[k] || 0) + r.counts[k];
        for (var k in r.dmgSources) dmgSources[k] = (dmgSources[k] || 0) + r.dmgSources[k];
        for (var k in r.missCounts) missCounts[k] = (missCounts[k] || 0) + r.missCounts[k];
        for (var k in r.critCounts) critCounts[k] = (critCounts[k] || 0) + r.critCounts[k];
        for (var k in r.glanceCounts) glanceCounts[k] = (glanceCounts[k] || 0) + r.glanceCounts[k];
    });

    var n = results.length;
    var avgDpsVal = totalDPS / n;

    // Second Pass: Variance & Standard Deviation for DPS
    var sumSqDiff = 0;
    results.forEach(r => {
        var diff = r.dps - avgDpsVal;
        sumSqDiff += (diff * diff);
    });
    var variance = (n > 1) ? sumSqDiff / (n - 1) : 0;
    var stdDev = Math.sqrt(variance);
    var stdErr = stdDev / Math.sqrt(n); // Standard Error of the Mean

    for (var k in counts) counts[k] /= n;
    for (var k in dmgSources) dmgSources[k] /= n;

    var avg = results[0]; // Clone structure from first
    avg.dps = avgDpsVal; 
    avg.dpsStdDev = stdDev; // New: Standard Deviation
    avg.dpsSE = stdErr;     // New: Standard Error for Weight Calc
    avg.totalDmg = totalDmg / n;
    avg.minDps = minDps; avg.maxDps = maxDps;
    avg.minRun = minRun; avg.maxRun = maxRun;

    avg.counts = counts; avg.dmgSources = dmgSources;

    return avg;
}

// ============================================================================
// HELPER: SEEDED PRNG (Mulberry32)
// ============================================================================
function mulberry32(a) {
    return function() {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

// ============================================================================
// RNG HANDLER (Stochastic Only)
// ============================================================================
function RNGHandler(seed) {
    if (seed !== undefined && seed !== null) {
        this.rand = mulberry32(seed);
    } else {
        this.rand = Math.random;
    }
}

// Returns a random damage value between min and max
RNGHandler.prototype.dmg = function (min, max) {
    return min + this.rand() * (max - min);
};

// Returns true if an event triggers based on percentage (0-100)
RNGHandler.prototype.proc = function (id, chance) {
    if (chance <= 0) return false;
    return this.rand() * 100 < chance;
};

// Handles Attack Table Logic (White Hits & Yellow Hits)
// Returns the string of the result (e.g. "MISS", "CRIT", "HIT")
RNGHandler.prototype.attackTable = function (idPrefix, table) {
    // table = { miss: %, dodge: %, parry: %, block: %, glance: %, crit: % }

    var roll = this.rand() * 100;
    var limit = 0;

    if (table.miss && roll < (limit += table.miss)) return "MISS";
    if (table.dodge && roll < (limit += table.dodge)) return "DODGE";
    if (table.parry && roll < (limit += table.parry)) return "PARRY";
    if (table.glance && roll < (limit += table.glance)) return "GLANCE";
    if (table.block && roll < (limit += table.block)) return "BLOCK";
    if (table.crit && roll < (limit += table.crit)) return "CRIT";

    return "HIT";
};



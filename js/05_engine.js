/**
 * Feral Simulation - File 5: Simulation Engine & Math
 * Updated for Turtle WoW 1.18 (Feral Cat)
 * Features: 
 * - Stochastic Event-based Engine
 * - Additive Haste Formula
 * - Dynamic Armor Reduction (Stacking Debuffs + Swarmguard/Shieldrender)
 * - New Sets: Cenarion, Genesis, Talon
 * - New Idols & Trinkets (On-Use + Procs)
 * - Removed: Wolfshead, MCP
 * - UPDATED: Trinkets now trigger GCD
 */

// ============================================================================
// SIMULATION ENTRY POINT
// ============================================================================

function runSimulation() {
    var config = getSimInputs();

    // Ensure at least 1 iteration
    if (config.iterations < 1) config.iterations = 1;
    
    // Force 1 iteration for deterministic mode
    if (config.calcMode === 'deterministic' || config.calcMode === 'averaged') config.iterations = 1;

    showProgress("Simulating...");

    setTimeout(function () {
        try {
            var allResults = [];

            // Always run stochastic simulations
            // Loop logic
            for (var i = 0; i < config.iterations; i++) {
                
                // Config Cloning & Time Smearing Logic
                // Wir erstellen eine flache Kopie der Config, damit wir simTime manipulieren können,
                // ohne das Original für die nächste Runde zu verfälschen.
                var currentConfig = Object.assign({}, config); 

                if (config.varyDuration && config.iterations > 1) {
                    // Spread range: +/- 20 seconds
                    // Bei 21 Iterationen sind das 2 Sekunden Schritte.
                    var stepSize = 2.0; 
                    var midPoint = Math.floor(config.iterations / 2);
                    var offset = (i - midPoint) * stepSize;
                    currentConfig.simTime = config.simTime + offset;
                    
                    // Sicherheitshalber: Keine negative Zeit
                    if (currentConfig.simTime < 10) currentConfig.simTime = 10;
                }

                var res = runCoreSimulation(currentConfig);
                allResults.push(res);

                // Update progress bar periodically
                if (i % 50 === 0) updateProgress((i / config.iterations) * 100);
            }

            // Aggregate Results (Average of all runs)
            var avg = aggregateResults(allResults);

            // KORREKTUR: Speichere Ergebnisse direkt im aktiven Sim-Objekt der Liste
            if (SIM_LIST[ACTIVE_SIM_INDEX]) {
                SIM_LIST[ACTIVE_SIM_INDEX].results = avg;
            }

            // Halte SIM_DATA synchron
            SIM_DATA = SIM_LIST[ACTIVE_SIM_INDEX];

            updateSimulationResults(SIM_DATA);
            showToast("Simulation Complete!");

        } catch (e) {
            console.error(e);
            showToast("Error: " + e.message);
        } finally {
            hideProgress();
        }
    }, 50);
}

// ============================================================================
// STAT WEIGHTS ENTRY POINT
// ============================================================================

function runStatWeights() {
    var baseConfig = getSimInputs();
    
    // FORCE AVERAGED MODE & TIME SMEARING
    // Wir nutzen 'averaged', damit auch Crit-Schaden geglättet ist.
    baseConfig.calcMode = 'averaged'; 
    
    // Time Smearing: Wir simulieren 21 verschiedene Kampflängen rund um 300s
    // Iteration 0 = 280s ... Iteration 10 = 300s ... Iteration 20 = 320s
    baseConfig.iterations = 21; 
    baseConfig.varyDuration = true; // Neues Flag für die Engine
    baseConfig.simTime = 300; 

    var iter = baseConfig.iterations;

    showProgress("Calculating Stat Weights (Averaged, 280s-320s range)...");

    var scenarios = [
        { id: "base", label: "Base", mod: function (c) { } },
        { id: "ap", label: "+50 AP", mod: function (c) { c.inputAP += 50; } },
        {
            id: "str", label: "+25 STR", mod: function (c) {
                c.inputStr += 25;
                c.inputAP += (25 * 2);
            }
        },
        {
            id: "agi", label: "+25 AGI", mod: function (c) {
                c.inputAgi += 25;
                c.inputAP += 25;
                c.inputCrit += (25 / 20.0);
            }
        },
        { id: "hit", label: "+1% Hit", mod: function (c) { c.inputHit += 1.0; } },
        { id: "crit", label: "+1% Crit", mod: function (c) { c.inputCrit += 1.0; } },
        { id: "haste", label: "+1% Haste", mod: function (c) { c.inputHaste += 1.0; } }
    ];

    var results = {};
    var currentIdx = 0;

    function runNextScenario() {
        if (currentIdx >= scenarios.length) {
            finalizeWeights(results);
            hideProgress();
            return;
        }

        var scen = scenarios[currentIdx];
        var runCfg = JSON.parse(JSON.stringify(baseConfig));
        scen.mod(runCfg);

        setTimeout(function () {
            try {
                var runResults = [];
                for (var i = 0; i < iter; i++) {
                    runResults.push(runCoreSimulation(runCfg));
                }
                var avg = aggregateResults(runResults);
                results[scen.id] = avg.dps;
                updateProgress(((currentIdx + 1) / scenarios.length) * 100);
                currentIdx++;
                runNextScenario();
            } catch (e) {
                console.error(e);
                showToast("Error during weights: " + e.message);
                hideProgress();
            }
        }, 10);
    }
    runNextScenario();
}

function finalizeWeights(dpsResults) {
    var baseDps = dpsResults["base"];
    var delta_ap = 50;
    var dps_per_ap = (dpsResults["ap"] - baseDps) / delta_ap;
    if (dps_per_ap <= 0.0001) dps_per_ap = 0.0001;

    var delta_str = 25;
    var w_str = ((dpsResults["str"] - baseDps) / delta_str) / dps_per_ap;
    if (w_str<0) w_str=0;

    var delta_agi = 25;
    var w_agi = ((dpsResults["agi"] - baseDps) / delta_agi) / dps_per_ap;
    if (w_agi<0) w_agi=0;

    var w_hit = (dpsResults["hit"] - baseDps) / dps_per_ap;
    if (w_hit<0) w_hit=0;
    var w_crit = (dpsResults["crit"] - baseDps) / dps_per_ap;
    if (w_crit<0) w_crit=0;
    var w_haste = (dpsResults["haste"] - baseDps) / dps_per_ap;
    if (w_haste<0) w_haste=0;



    var container = document.getElementById("weightResults");
    if (container) {
        container.classList.remove("hidden");
        container.innerHTML = `
            <div class="results-header" style="border-bottom:none; margin-bottom:10px; margin-top:0;">
                <h2 style="font-size:1.1rem; margin:0;">⚖️ Stat Weights (1AP = 1EP)</h2>
            </div>
            <div class="stats-grid">
                <div class="stat-box" style="padding:10px;">
                    <h3 style="font-size:0.75rem;">1 Str</h3>
                    <span class="med-number" style="font-size:1.4rem; color:#fff;">${w_str.toFixed(2)}</span>
                </div>
                <div class="stat-box" style="padding:10px;">
                    <h3 style="font-size:0.75rem;">1 Agi</h3>
                    <span class="med-number" style="font-size:1.4rem; color:#fff;">${w_agi.toFixed(2)}</span>
                </div>
                <div class="stat-box" style="padding:10px;">
                    <h3 style="font-size:0.75rem;">1% Crit</h3>
                    <span class="med-number" style="font-size:1.4rem; color:#ffeb3b;">${w_crit.toFixed(2)}</span>
                </div>
                <div class="stat-box" style="padding:10px;">
                    <h3 style="font-size:0.75rem;">1% Hit</h3>
                    <span class="med-number" style="font-size:1.4rem; color:#a5d6a7;">${w_hit.toFixed(2)}</span>
                </div>
                <div class="stat-box" style="padding:10px;">
                    <h3 style="font-size:0.75rem;">1% Haste</h3>
                    <span class="med-number" style="font-size:1.4rem; color:#90caf9;">${w_haste.toFixed(2)}</span>
                </div>
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
        use_fb: getCheck("use_fb"), fb_energy: getNum("fb_energy"),
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

        // Flags
        buff_wf_totem: getCheck("buff_wf_totem"),
        consum_potion_quickness: getCheck("consum_potion_quickness"),

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

        // Calculation Mode
        calcMode: getSel("sim_calc_mode") || "stochastic"
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
    var rng = new RNGHandler(cfg.calcMode);

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

    // Auras & Buffs
    var auras = {
        rake: 0, rip: 0, ff: 0,
        clearcasting: 0,
        tigersFury: 0, tigersFurySpeed: 0,
        berserk: 0,
        potionQuickness: 0,

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
        venom_dot: 0
    };

    var stacks = {
        cenarion: 0,    // 5 Charges for T1 8p
        talonFero: 0,   // Primal Ferocity Stacks
        swarmguard: 0,  // Max 6
        venom: 0        // Max 1200
    };

    var cds = {
        tigersFury: 0, berserk: 0, ff: 0, potion: 0,
        // Trinket CDs (Simulated as independent slots or shared logic)
        trinket1: 0,
        trinket2: 0,
        // Procs Internal CDs if any (Shieldrender?) - assuming PPM/Chance based
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

        // Talon 3p: +100 AP
        if (auras.talonAP > t) ap += 100;

        // Trinkets
        if (auras.slayer > t) ap += 260;
        if (auras.earthstrike > t) ap += 280;
        if (auras.emberstone > t) ap += 200;

        // Jom Gabbar: 65 + 65 every 2s
        if (auras.jom > t) {
            var elapsed = t - auras.jomStart;
            var stack = Math.floor(elapsed / 2.0);
            ap += (65 + (stack * 65));
        }

        // Talon 5p: +25% AP
        if (auras.talonBuff > t) ap = Math.floor(ap * 1.25);

        return ap;
    }

    // --- HELPER: Haste Calculation ---
    function getHasteMod() {
        var hPercent = 0;
        if (cfg.inputHaste > 0) hPercent += cfg.inputHaste;

        if (auras.tigersFurySpeed > t) hPercent += 20;
        if (auras.potionQuickness > t) hPercent += 5;

        // Cenarion 8p: +15% Speed
        if (auras.cenarionHaste > t && stacks.cenarion > 0) hPercent += 15;

        // Kiss of the Spider: +20% Speed
        if (auras.spider > t) hPercent += 20;

        return 1 + (hPercent / 100);
    }

    // --- HELPER: Armor Reduction ---
    function getDamageReduction(t, currentFF) {
        // Shieldrender: Ignore All Armor
        if (auras.shieldrender > t) return 0.0;

        var totalReduct = staticArmorReduct;
        if (currentFF > t || cfg.debuff_ff) totalReduct += 505;

        // Swarmguard: -200 per stack
        if (auras.swarmguard > t && stacks.swarmguard > 0) {
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

            // Dynamische Buffs: Alle Auras durchlaufen und Timer speichern, wenn aktiv
            // Wir filtern hier die internen Statuswerte heraus
            var exclude = ["clearcasting", "tigersFury", "rake", "rip", "ff"];
            for (var key in auras) {
                if (!exclude.includes(key) && auras[key] > t) {
                    activeBuffs[key] = parseFloat((auras[key] - t).toFixed(1));
                }
            }

            log.push({
                t: Math.max(0, t),
                event: (dmgVal > 0 || isTick) ? (isTick ? "Tick" : "Damage") : (action.includes("Proc") || info.includes("Aura") ? "Buff" : "Cast"),
                ability: action,
                result: res || "",
                dmgNorm: dmgNorm,
                dmgCrit: dmgCrit,
                dmgTick: dmgTick,
                dmgSpec: dmgSpec,
                remRake: Math.max(0, auras.rake - t),
                remRip: Math.max(0, auras.rip - t),
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
        // 0 als eChange übergeben
        logAction(source, type, res, val, isCrit, isTick, eChangeOverride || 0);
    }

    //function rollDamageRange(min, max) { return min + Math.random() * (max - min); }
    // UPDATED: Use RNG Handler
    function rollDamageRange(min, max) { return rng.dmg(min, max); }

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

            var performSwing = function (isExtra) {
                // Damage Roll (RNG handled inside helper)
                var baseDmgRoll = rollDamageRange(base.minDmg, base.maxDmg); 
                var currentAP = getCurrentAP();

                if (isExtra) currentAP += 315; // WF Bonus

                var apBonus = (currentAP - base.baseAp) / 14.0;
                var rawDmg = baseDmgRoll + apBonus;

                if (auras.tigersFury > t) rawDmg += 50;
                rawDmg *= modNaturalWeapons;

                // --- ATTACK TABLE (White) ---
                var isBoss = (cfg.enemyLevel == 63);
                var isFront = (cfg.rota_position === "front");
                var canBlock = (cfg.enemy_can_block === 1);

                // Stats
                var missC = Math.max(0, (isBoss ? 8.6 : 5.0) - cfg.inputHit);
                var dodgeC = isBoss ? 6.5 : 5.0;
                var parryC = (isFront) ? (isBoss ? 14.0 : 5.0) : 0;
                var blockC = (isFront && canBlock) ? 5.0 : 0;
                var glanceC = isBoss ? 40.0 : 10.0;
                var critC = Math.max(0, cfg.inputCrit - (isBoss ? 4.8 : 0));

                // Prepare Table
                var table = { miss: missC, dodge: dodgeC, parry: parryC, block: blockC, glance: glanceC, crit: critC };
                var hitType = rng.attackTable("Auto", table);

                // Counters
                if (hitType === "MISS") { if (!missCounts.Auto) missCounts.Auto = 0; missCounts.Auto++; }
                else if (hitType === "DODGE") { if (!dodgeCounts.Auto) dodgeCounts.Auto = 0; dodgeCounts.Auto++; }
                else if (hitType === "PARRY") { if (!parryCounts.Auto) parryCounts.Auto = 0; parryCounts.Auto++; }
                else if (hitType === "BLOCK") { if (!missCounts.Block) missCounts.Block = 0; missCounts.Block++; }
                else if (hitType === "GLANCE") { if (!glanceCounts.Auto) glanceCounts.Auto = 0; glanceCounts.Auto++; }
                else if (hitType === "CRIT") { if (!critCounts.Auto) critCounts.Auto = 0; critCounts.Auto++; }
                if (!counts.Auto) counts.Auto = 0; counts.Auto++;

                /// Damage Modifiers
                var blockValue = isBoss ? 38 : 0;
                var glancePenalty = isBoss ? 0.35 : 0.05;

                if (cfg.calcMode === 'averaged') {
                    // --- AVERAGED MODE ---
                    // 1. Glancing: Apply weighted penalty to ALL hits
                    //    (1 - Chance * Penalty)
                    //    Note: glanceC is percentage (0-100), so divide by 100
                    var avgGlanceMod = 1.0 - ((glanceC / 100.0) * glancePenalty);
                    rawDmg *= avgGlanceMod;

                    // 2. Crit: Apply weighted bonus to ALL hits
                    //    (1 + Chance * Bonus). Bonus is 100% (x2), so factor is 1.0
                    //    Note: Crit is suppressed by Glancing in table, but here we average the potential.
                    //    We use the raw Crit Chance.
                    var avgCritMod = 1.0 + (critC / 100.0);
                    rawDmg *= avgCritMod;

                    // 3. Block: Deduct weighted block value if blocked
                    if (hitType === "BLOCK") rawDmg = Math.max(0, rawDmg - blockValue);

                    // Note: hitType "CRIT" or "GLANCE" from bucket is ignored for damage scaling
                    // to ensure smoothness, but KEPT for procs/logs if needed.
                } else {
                    // --- STANDARD / DETERMINISTIC MODE ---
                    if (hitType === "BLOCK") rawDmg = Math.max(0, rawDmg - blockValue);
                    else if (hitType === "GLANCE") rawDmg *= (1 - glancePenalty);
                    else if (hitType === "CRIT") rawDmg *= 2.0;
                }

                // Process Hit
                if (hitType !== "MISS" && hitType !== "DODGE" && hitType !== "PARRY") {
                    var dr = getDamageReduction(t, auras.ff);
                    rawDmg *= (1 - dr);

                    dealDamage(isExtra ? "Extra Attack" : "Auto Attack", rawDmg, "Physical", hitType, (hitType === "CRIT"), false);

                    // --- PROCS ---
                    if (cfg.tal_omen > 0 && rng.proc("Omen", 10)) {
                        auras.clearcasting = t + 15.0;
                        logAction("Proc", "Clearcasting", "Proc", 0, false, false);
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

                    // Trinkets
                    if (cfg.t_shieldrender && rng.proc("Shieldrender", 7)) {
                        auras.shieldrender = t + 3.0;
                        logAction( "Shieldrender", "Ignore Armor", "Proc", 0, false, false);
                    }
                    if (cfg.t_hoj && !isExtra && rng.proc("HoJ", 2)) {
                        logAction("HoJ", "Extra Attack", "Proc", 0, false, false);
                        performSwing(true);
                    }
                    if (cfg.t_maelstrom && rng.proc("Maelstrom", 3)) {
                        var MaelstromDmg = rollDamageRange(200, 301);
                        dealDamage("Maelstrom", MaelstromDmg, "Nature", "Proc", false, false);
                        if (rng.proc("MaelstromCrit", critC)) {
                            dealDamage( "Maelstrom", MaelstromDmg, "Nature", "Proc Crit", true, false);
                        }
                    }
                    if (cfg.t_coil && rng.proc("Coil", 5)) {
                        var CoilDamage = rollDamageRange(50, 71);
                        dealDamage("Heating Coil", CoilDamage, "Fire", "Proc", false, false);
                        if (rng.proc("CoilCrit", critC)) {
                            dealDamage("Heating Coil", CoilDamage, "Fire", "Proc Crit", true, false);
                        }
                    }
                    if (cfg.t_venoms && rng.proc("Venoms", 20)) {
                        if (stacks.venom < 2) stacks.venom++;
                        auras.venom = t + 12.0;
                        logAction( "Venoms", "Stack " + stacks.venom, "Proc", 0, false, false);
                        var dotDmgPerTick = stacks.venom * 120 / 4;
                        removeEvent("dot_tick", "venom");
                        for (var tick = 1; tick <= 4; tick++) {
                            addEvent(t + (tick * 3.0), "dot_tick", { name: "venom", dmg: dotDmgPerTick, label: "Venoms" });
                        }
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
        if (t >= gcdEnd) {

            // Calc Costs
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

            //var isOoc = (auras.clearcasting > t);
            var isOoc = oocState; // Use snapshot from start of tick
            if (isOoc) {
                costClaw = 0; costRake = 0; costShred = 0; costRip = 0; costBite = 0; costTF = 0;
            }

            var action = null;
            var waitingForEnergy = false;

            // Priority 0: TRINKETS (On-Use)
            // Logic: Use if Berserk is up OR Berserk is not talented OR Berserk CD is long.
            // Simple logic: Use on CD.
            if (cfg.t_slayer && cds.trinket1 <= t) action = "Slayer";
            else if (cfg.t_spider && cds.trinket1 <= t) action = "Spider";
            else if (cfg.t_earthstrike && cds.trinket1 <= t) action = "Earthstrike";
            else if (cfg.t_jomgabbar && cds.trinket1 <= t) action = "JomGabbar";
            else if (cfg.t_emberstone && cds.trinket1 <= t) action = "Emberstone";
            else if (cfg.t_swarmguard && cds.trinket2 <= t && auras.swarmguard <= t) action = "Swarmguard";

            // MOVED EXECUTION TO EXECUTE BLOCK TO TRIGGER GCD

            // Standard Rotation Prio
            if (!action && cfg.consum_potion_quickness && cds.potion <= t) action = "Potion";
            if (!action && cfg.tal_berserk > 0 && cds.berserk <= t && cfg.use_berserk) action = "Berserk";

            if (!action && !waitingForEnergy && cp >= cfg.rip_cp && cfg.use_rip && cfg.canBleed && auras.rip <= t) {
                if (energy >= costRip) action = "Rip"; else waitingForEnergy = true;
            }
            if (!action && !waitingForEnergy && cp >= 5 && cfg.use_fb) {
                if (energy >= cfg.fb_energy) { if (energy >= costBite) action = "Ferocious Bite"; }
                else waitingForEnergy = true;
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

            if (!action && !waitingForEnergy && auras.tigersFury <= t && cfg.use_tf) {
                if (energy >= costTF) action = "Tiger's Fury";
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

                if (action === "Potion") {
                    auras.potionQuickness = t + 30.0; cds.potion = t + 120.0;
                    logAction("Potion", "Quickness", "Buff", 0, false, false, 0); gcdEnd = t + 1.0;
                }
                else if (action === "Berserk") {
                    auras.berserk = t + 20.0; cds.berserk = t + 360.0;
                    logAction("Berserk", "+100% Regen", "Buff", 0, false, false, 0); gcdEnd = t + 1.0;
                }
                else if (action === "Reshift") {
                    mana -= 300; auras.tigersFury = 0; auras.tigersFurySpeed = 0;

                    // UPDATED: Furor (Talent) + Gift of Ferocity (Enchant)
                    var furorEnergy = (cfg.tal_furor * 8);
                    var giftEnergy = cfg.hasGiftOfFerocity ? 20 : 0;
                    var newE = furorEnergy + giftEnergy;

                    var eChange = newE - energy; // Differenz berechnen
                    energy = Math.min(100, newE);
                    logAction("Reshift", "Energy -> " + energy, "Cast", 0, false, false, eChange);
                }
                else if (action === "Faerie Fire") {
                    auras.ff = t + 40.0; logAction("Faerie Fire", "-505 Armor", "Debuff", 0, false, false, 0); gcdEnd = t + 1.0;
                }
                else if (action === "Tiger's Fury") {
                    energy -= costTF;

                    var dur = 6; if (cfg.tal_blood_frenzy > 0) dur += 12;
                    auras.tigersFury = t + dur;
                    if (cfg.tal_blood_frenzy > 0) auras.tigersFurySpeed = t + 18;
                    for (var i = 1; i * 3 <= dur; i++) addEvent(t + (i * 3.0), "tf_energy");
                    logAction("Tiger's Fury", "Buff", "Buff", 0, false, false, -costTF);
                }
                // NEW: Handle Trinkets Here to Trigger GCD
                else if (["Slayer", "Spider", "Earthstrike", "JomGabbar", "Emberstone", "Swarmguard"].includes(action)) {
                    if (action === "Slayer") { auras.slayer = t + 20; cds.trinket1 = t + 120; }
                    else if (action === "Spider") { auras.spider = t + 15; cds.trinket1 = t + 120; }
                    else if (action === "Earthstrike") { auras.earthstrike = t + 20; cds.trinket1 = t + 120; }
                    else if (action === "JomGabbar") { auras.jom = t + 20; auras.jomStart = t; cds.trinket1 = t + 120; }
                    else if (action === "Emberstone") { auras.emberstone = t + 20; cds.trinket1 = t + 180; }
                    else if (action === "Swarmguard") { auras.swarmguard = t + 30; stacks.swarmguard = 0; cds.trinket2 = t + 180; }

                    logAction(action, "Activated", "Buff", 0, false, false);
                    gcdEnd = t + 1.0; // Trigger GCD
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

                    // --- YELLOW ATTACK TABLE (Two-Roll) ---
                    var isBoss = (cfg.enemyLevel == 63);
                    var isFront = (cfg.rota_position === "front");
                    var canBlock = (cfg.enemy_can_block === 1);

                    // 1. Hit Roll
                    var missC = Math.max(0, (isBoss ? 9.0 : 5.0) - baseHit - cfg.tal_nat_wep);
                    var dodgeC = isBoss ? 6.5 : 5.0;
                    var parryC = (isFront) ? (isBoss ? 14.0 : 5.0) : 0;
                    var blockC = (isFront && canBlock) ? 5.0 : 0;
                    
                    // Table for Roll 1
                    var yellowTable = { miss: missC, dodge: dodgeC, parry: parryC, block: blockC, glance: 0, crit: 0 }; 
                    var res = rng.attackTable("Yellow_" + action, yellowTable);
                    
                    // 2. Crit Roll (only if HIT or BLOCK)
                    // Note: Blocked attacks can technically not crit in Vanilla, but here treated as Block+Damage.
                    // If result is HIT, we check for Crit.
                    if (res === "HIT" || res === "BLOCK") {
                        var critChance = cfg.inputCrit - (isBoss ? 4.8 : 0);
                        // Genesis 5p Bonus
                        if (auras.genesisProc > t && ["Shred", "Rake", "Claw"].includes(action)) {
                            critChance += 15;
                        }
                        
                        if (rng.proc("YellowCrit_" + action, critChance)) {
                            res = "CRIT"; // Upgrade HIT to CRIT
                            // NOTE: Blocked Crits (Blocked+Crit) are complex, simplifying to CRIT here as Block reduces dmg later.
                            // If it was blocked, we keep it blocked but apply crit mult? 
                            // Standard behavior: Crit pushes Block off table usually, or distinct. 
                            // Simplifying: If Crit Proc -> It is a Crit.
                        }
                    }

                    // Refund Logic
                    if (res === "MISS" || res === "DODGE" || res === "PARRY") {
                        var refund = (castCost * 0.8);
                        energy += refund;
                        if (energy > 100) energy = 100;
                        if (res === "MISS") missCounts[action] = (missCounts[action] || 0) + 1;
                        else if (res === "DODGE") dodgeCounts[action] = (dodgeCounts[action] || 0) + 1;
                        else if (res === "PARRY") { if (!missCounts.Parry) missCounts.Parry = 0; missCounts.Parry++; }
                        logAction(action, "Refund", res, 0, false, false, -castCost + refund);
                    } else {
                        // Landed Hit
                        var cpGen = (["Claw", "Rake", "Shred"].includes(action)) ? 1 : 0;
                        if (res === "CRIT") {
                            if (cpGen > 0 && cfg.tal_primal_fury > 0) {
                                // Primal Fury 50% / 100%
                                var chance = cfg.tal_primal_fury * 50;
                                if (rng.proc("PrimalFury", chance)) cpGen++;
                            }
                            critCounts[action] = (critCounts[action] || 0) + 1;
                        }

                        // Damage Calc
                        var curAP = getCurrentAP();
                        var baseDmgRoll = rollDamageRange(base.minDmg, base.maxDmg);
                        var apBonus = (curAP - base.baseAp) / 14.0;
                        var normalDmg = baseDmgRoll + apBonus;
                        if (auras.tigersFury > t) normalDmg += 50;

                        // Genesis 5p Bonus Dmg (Consumed)
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
                                var bleeds = 0; if (auras.rake > t) bleeds++; if (auras.rip > t) bleeds++;
                                abilityDmg *= (1 + (0.30 * bleeds));
                            }
                            abilityDmg *= modPredatoryStrikes;
                        }
                        else if (action === "Shred") {
                            abilityDmg = 2.25 * normalDmg + 180;
                            if (cfg.tal_imp_shred > 0) abilityDmg *= (1 + cfg.tal_imp_shred * 0.05);
                            
                            // Idol of Laceration Refund
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
                        }
                        else if (action === "Ferocious Bite") {
                            var extraE = energy; energy = 0;
                            var baseFB = 70 + 128 * cp + 0.07 * curAP;
                            var multiplier = Math.pow(1.005, extraE);
                            abilityDmg = baseFB * multiplier;
                            if (cfg.tal_feral_aggression > 0) abilityDmg *= (1 + cfg.tal_feral_aggression * 0.03);
                            cpGen = 0;

                            // Cenarion 8p: 20% chance per CP
                            if (cfg.set_cenarion_8p) {
                                if (rng.proc("Cenarion8p", 20 * cp)) {
                                    auras.cenarionHaste = t + 999;
                                    stacks.cenarion = 5;
                                    logAction("Cenarion", "5 Haste Charges", "Proc", 0, false, false);
                                }
                            }
                        }

                        abilityDmg *= modNaturalWeapons;

                        if (cfg.calcMode === 'averaged') {
                            // --- AVERAGED MODE ---
                            // Always apply Crit Multiplier Average
                            // Bonus is 100% (Factor 1.0)
                            // Use the calculated critChance variable from above
                            abilityDmg *= (1.0 + (critChance / 100.0));
                            
                            // Block Handling (Weighted reduction not possible for flat value easily without changing structure)
                            // So we stick to: If bucket says block, we subtract block value.
                            if (res === "BLOCK") abilityDmg = Math.max(0, abilityDmg - (isBoss ? 38 : 0));
                        } else {
                            // --- STANDARD ---
                            if (res === "CRIT") abilityDmg *= 2.0;
                            if (res === "BLOCK") abilityDmg = Math.max(0, abilityDmg - (isBoss ? 38 : 0));
                        }

                        if (!isBleed && action !== "Rip") {
                            var dr = getDamageReduction(t, auras.ff);
                            abilityDmg *= (1 - dr);
                        }

                        if (abilityDmg > 0) {
                            var realCost = castCost;
                            if (action === "Ferocious Bite") realCost += extraE;
                            dealDamage(action, abilityDmg, isBleed ? "Bleed" : "Physical", res, (res === "CRIT"), false, -realCost);
                        }

                        // --- PROCS ON CAST ---
                        // Talon 3p
                        if (cfg.set_talon_3p && ["Claw", "Rake", "Shred"].includes(action)) {
                            if (rng.proc("Talon3p", 5)) {
                                auras.talonAP = t + 10.0;
                                logAction("Talon 3p", "+100 AP", "Proc", 0, false, false);
                            }
                        }

                        // Finisher Procs
                        if (action === "Rip" || action === "Ferocious Bite") {
                            var usedCP = cp; // stored before reset

                            // Emerald Rot
                            if (cfg.idol_emeral_rot) {
                                if (rng.proc("EmeraldRot", 20 * usedCP)) {
                                    dealDamage("Emerald Rot", rollDamageRange(150, 190), "Nature", "Proc", false, false);
                                }
                            }
                            // Idol Laceration
                            if (cfg.idol_laceration) {
                                if (rng.proc("LacerationIdol", 20 * usedCP)) {
                                    auras.laceration = t + 10.0;
                                    logAction("Laceration", "Next Shred Refund", "Proc", 0, false, false);
                                }
                            }
                            // Talon 5p Stacking
                            if (cfg.set_talon_5p) {
                                stacks.talonFero += usedCP;
                                if (stacks.talonFero >= 25) {
                                    stacks.talonFero = 0;
                                    auras.talonBuff = t + 10.0;
                                    logAction("Primal Ferocity", "Proc! +25% AP", "Proc", 0, false, false);
                                }
                            }
                        }

                        // Update CP
                        if (action === "Rip" || action === "Ferocious Bite") cp = 0;
                        cp += cpGen;
                        if (cp > 5) cp = 5;

                        // Omen
                        if (cfg.tal_omen > 0 && rng.proc("Omen", 10)) {
                            auras.clearcasting = t + 15.0;
                            logAction("Proc", "Clearcasting", "Proc", 0, false, false);
                        }
                        
                        // T0.5
                        if (cfg.hasT05_4p && rng.proc("T05", 2)) {
                            var EnergyGain = (energy <= 80) ? 20 : (100 - energy);
                            energy = Math.min(100, energy + EnergyGain);
                            logAction("Proc", "T0.5 Energy", "Proc", 0, false, false, EnergyGain);
                        }
                        
                        // Talon 5p Energy Return
                        if (auras.talonBuff > t) {
                            var EnergyGain = (energy <= 97) ? 3.0 : (100 - energy);
                            energy = Math.min(100, energy + EnergyGain);
                            logAction("Talon 5p", "Energy Return", "Proc", 0, false, false, EnergyGain);
                        }
                        // Cenarion 8p Stack consumption
                        if (auras.cenarionHaste > t && stacks.cenarion > 0) {
                            stacks.cenarion--;
                            if (stacks.cenarion <= 0) auras.cenarionHaste = 0;
                        }

                        // --- TRINKET PROCS (Standard Yellow) ---
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
                            if (rng.proc("MaelstromCrit", critC)) {
                                dealDamage("Maelstrom", MaelstromDmg, "Nature", "Proc Crit", true, false);
                            }
                        }
                        if (cfg.t_coil && rng.proc("Coil", 5)) {
                            var CoilDamage = rollDamageRange(50, 71);
                            dealDamage("Heating Coil", CoilDamage, "Fire", "Proc", false, false);
                            if (rng.proc("CoilCrit", critC)) {
                                dealDamage("Heating Coil", CoilDamage, "Fire", "Proc Crit", true, false);
                            }
                        }
                        if (cfg.t_venoms && rng.proc("Venoms", 20)) {
                            if (stacks.venom < 2) stacks.venom++;
                            auras.venom = t + 12.0;
                            logAction( "Venoms", "Stack " + stacks.venom, "Proc", 0, false, false);
                            var dotDmgPerTick = stacks.venom * 120 / 4;
                            removeEvent("dot_tick", "venom");
                            for (var tick = 1; tick <= 4; tick++) {
                                addEvent(t + (tick * 3.0), "dot_tick", { name: "venom", dmg: dotDmgPerTick, label: "Venoms" });
                            }
                        }
                        if (auras.swarmguard > t && stacks.swarmguard < 6 && rng.proc("Swarmguard", 80)) {
                            stacks.swarmguard++;
                            logAction("Swarmguard", "Stack " + stacks.swarmguard, "Proc", 0, false, false);
                        }
                        if (cfg.buff_wf_totem && !isExtra && rng.proc("WF", 20)) {
                            logAction("Windfury", "Extra Attack", "Proc", 0, false, false);
                            performSwing(true);
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
function aggregateResults(results) {
    if (!results || results.length === 0) return {};
    var totalDPS = 0, totalDmg = 0;
    var counts = {}, dmgSources = {}, missCounts = {}, critCounts = {}, glanceCounts = {};
    var minDps = Infinity, maxDps = 0;
    var minRun = null, maxRun = null;

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
    for (var k in counts) counts[k] /= n;
    for (var k in dmgSources) dmgSources[k] /= n;

    var avg = results[0];
    avg.dps = totalDPS / n; avg.totalDmg = totalDmg / n;
    avg.minDps = minDps; avg.maxDps = maxDps;
    avg.minRun = minRun; avg.maxRun = maxRun;

    avg.counts = counts; avg.dmgSources = dmgSources;

    return avg;
}

// ============================================================================
// RNG HANDLER (Stochastic vs Deterministic)
// ============================================================================
function RNGHandler(mode) {
    this.mode = mode; // 'stochastic' or 'deterministic'
    this.buckets = {}; // Accumulators for deterministic events
}

// Returns a damage value. Random between min/max OR Average.
RNGHandler.prototype.dmg = function(min, max) {
    // Averaged nutzt ebenfalls den Mittelwert für Damage Ranges
    if (this.mode === 'deterministic' || this.mode === 'averaged') return (min + max) / 2;
    return min + Math.random() * (max - min);
};

// Returns true if an event triggers based on percentage (0-100).
RNGHandler.prototype.proc = function(id, chance) {
    if (chance <= 0) return false;
    // Averaged nutzt für Procs/Events ebenfalls deterministische Buckets
    if (this.mode === 'deterministic' || this.mode === 'averaged') {
        if (!this.buckets[id]) this.buckets[id] = 0;
        this.buckets[id] += chance;
        if (this.buckets[id] >= 100) {
            this.buckets[id] -= 100;
            return true;
        }
        return false;
    }
    return Math.random() * 100 < chance;
};

// Handles Attack Table Logic (White Hits: Single Roll / Priority System)
// Checks outcomes in order: Miss -> Dodge -> Parry -> Block -> Glance -> Crit
// Returns the string of the result (e.g. "MISS", "CRIT", "HIT")
RNGHandler.prototype.attackTable = function(idPrefix, table) {
    // table = { miss: %, dodge: %, parry: %, block: %, glance: %, crit: % }
    
    if (this.mode === 'deterministic' || this.mode === 'averaged') {
        // Priority System: Check buckets in order. 
        // Note: This ensures correct frequency over time but separates events strictly.
        var types = ['MISS', 'DODGE', 'PARRY', 'BLOCK', 'GLANCE', 'CRIT'];
        var keys = ['miss', 'dodge', 'parry', 'block', 'glance', 'crit'];
        
        for(var i=0; i<types.length; i++) {
            var type = types[i];
            var key = keys[i];
            var chance = table[key] || 0;
            if (chance > 0) {
                var bId = idPrefix + "_" + type;
                if (!this.buckets[bId]) this.buckets[bId] = 0;
                this.buckets[bId] += chance;
                if (this.buckets[bId] >= 100) {
                    this.buckets[bId] -= 100;
                    return type;
                }
            }
        }
        return "HIT";
    } else {
        // Stochastic: Single Roll
        var roll = Math.random() * 100;
        var limit = 0;
        
        if (table.miss && roll < (limit += table.miss)) return "MISS";
        if (table.dodge && roll < (limit += table.dodge)) return "DODGE";
        if (table.parry && roll < (limit += table.parry)) return "PARRY";
        if (table.block && roll < (limit += table.block)) return "BLOCK";
        if (table.glance && roll < (limit += table.glance)) return "GLANCE";
        if (table.crit && roll < (limit += table.crit)) return "CRIT";
        return "HIT";
    }
};
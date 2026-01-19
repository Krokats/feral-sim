/**
 * Feral Simulation - File 4: UI Manager
 * Updated for Turtle WoW 1.18 (Feral Cat)
 * Handles Sidebar, Multi-Sim Management, Inputs, Result Rendering, Boss Selection & Extended Logs
 * Updated: View Switching logic (Min/Avg/Max) & Export URL
 * UPDATED: Dynamic Log Columns, TF Timer, DPS Buttons
 * UPDATED: Rotation Constraints (Visual Disabling)
 */

// ============================================================================
// HELP TEXTS & TOOLTIP CONFIGURATION
// ============================================================================
const HELP_TEXTS = {
    "simTime": "The total length of each combat simulation in seconds.",
    "simCount": "Number of times the combat is simulated. Higher values (1000+) increase accuracy but take longer.",
    "char_race": "Base stats vary by race. Night Elves have higher Agility; Taureans have higher Strength.",
    "manual_stats": "When enabled, you can override automatic gear calculations and enter stats manually.",
    "enemy_level": "Level 63 is the standard for Raid Bosses. Level difference affects hit/crit and glancing blows.",
    "enemy_type": "Specific consumables or gear (like Consecrated Stones) only work against certain types like Undead.",
    "enemy_armor": "Base armor of the boss. Raid bosses usually have between 3400 and 4700 armor.",
    "debuff_major_armor": "Major armor reduction. Sunder Armor (Warrior) or Faerie Fire (Druid) are essential for DPS.",
    "debuff_ff": "Reduces target's armor by 505. Does not stack with the player's Faerie Fire cast.",
    "debuff_cor": "Warlock's Curse of Recklessness. Reduces armor by 640.",
    "enemy_can_bleed": "If disabled, Rip and Rake cannot be used. Some bosses are immune to bleeds.",
    "use_rip": "The primary finishing move. Deals damage over time and ignores armor.",
    "rip_cp": "The minimum number of Combo Points to have before using Rip.",
    "use_fb": "Ferocious Bite. A finishing move that converts remaining energy into extra damage.",
    "fb_energy": "Minimum energy required to cast Ferocious Bite. High thresholds prevent 'Energy Starvation'.",
    "use_reshift": "Powershifting: Shifting out of Cat form and back in to instantly gain 40-60 energy (Furor/Gift of Ferocity).",
    "reshift_energy": "The simulation will shift whenever energy falls to or below this value.",
    "use_rake": "Applies a bleed that deals damage over time and increases Claw damage (if Open Wounds is talented).",
    "use_tf": "Tiger's Fury. Increases physical damage but costs energy. Best used during low energy/Clearcasting.",
    "idol_savagery": "Increases the tick frequency of Rip and Rake (making them deal damage faster).",
    "idol_ferocity": "Reduces the energy cost of Claw and Rake by 3.",
    "gear_gift_of_ferocity": "Turtle WoW specific head enchant. Grants 20 energy upon shifting into Cat form.",
    "rotation_logic": "<b>Feral Cat Priority Logic:</b><br>1. Use Tiger's Fury if enabled and off CD.<br>2. Maintain Faerie Fire if required.<br>3. Maintain Rip if target can bleed and CP >= Threshold.<br>4. Powershift if energy is low and mana is available.<br>5. Maintain Rake if target can bleed.<br>6. Shred (from behind) or Claw (from front) to build CP.",
    "use_berserk": "When enabled, Berserk will be used on cooldown, doubling energy regeneration for 20 seconds.",
    "shred_ooc_only": "If enabled, Shred will only be cast when Omen of Clarity (Clearcasting) is active. This saves energy for other abilities.",
    "use_shred": "High damage attack that requires being behind the target. Generates 1 Combo Point.",
    "enemy_can_block": "If enabled, the enemy can block attacks from the front. This reduces physical damage by a fixed block value (approx. 5% chance).",
    "use_pounce": "Starts the fight with Pounce (requires Stealth & Behind). Deals bleed damage over 18s and awards 1 Combo Point.",
    "fb_cp": "Minimum Combo Points required to cast Ferocious Bite. Standard is 5.",
    //"buff_ft_totem": "Flametongue Totem. Adds fire damage to each hit. Does not stack with other weapon imbues usually, but allowed here per settings."
};

// Global View State
var CURRENT_RESULT_VIEW = 'avg'; // 'min', 'avg', 'max'
var LOG_BUFF_KEYS = []; // To store dynamic column headers

// ============================================================================
// SIDEBAR & SIMULATION MANAGEMENT
// ============================================================================

function renderSidebar() {
    var sb = document.getElementById("sidebar");
    if (!sb) return;
    sb.innerHTML = "";

    // 1. Overview / Comparison Button
    var btnOv = document.createElement("div");
    btnOv.className = "sidebar-btn btn-overview" + (CURRENT_VIEW === 'comparison' ? " active" : "");
    btnOv.innerHTML = "☰";
    btnOv.title = "Comparison View";
    btnOv.onclick = function () { showComparisonView(); };
    sb.appendChild(btnOv);

    // Separator
    var sep = document.createElement("div");
    sep.className = "sidebar-separator";
    sb.appendChild(sep);

    // 2. Sim Buttons
    SIM_LIST.forEach(function (sim, idx) {
        var btn = document.createElement("div");
        btn.className = "sidebar-btn" + (CURRENT_VIEW === 'single' && ACTIVE_SIM_INDEX === idx ? " active" : "");
        
        // Label Logic
        var label = (idx + 1);
        if(sim.name && sim.name.startsWith("Sim ")) {
             // Default numbering
        } else if (sim.name) {
             label = sim.name.substring(0, 2).toUpperCase();
        }
        
        btn.innerText = (idx + 1);
        btn.title = sim.name || "Sim " + (idx+1);
        btn.onclick = function () { switchSim(idx); };
        sb.appendChild(btn);
    });

    // 3. Add Button
    var btnAdd = document.createElement("div");
    btnAdd.className = "sidebar-btn btn-add";
    btnAdd.innerText = "+";
    btnAdd.title = "Add Simulation";
    btnAdd.onclick = function () { addSim(); };
    sb.appendChild(btnAdd);
}

function renderRotationHelp() {
    // Sucht die Card-Header, die den Text "Rotation Settings" enthalten
    const headers = document.querySelectorAll(".card-header h2");
    let targetHeader = null;
    
    headers.forEach(h => {
        if (h.innerText.includes("Rotation Settings")) {
            targetHeader = h;
        }
    });

    if (!targetHeader || document.getElementById("rotHelpIcon")) return;

    const helpIcon = document.createElement("span");
    helpIcon.id = "rotHelpIcon";
    helpIcon.innerHTML = " ⓘ";
    // Styling angepasst für die Platzierung innerhalb der Card
    helpIcon.style.cssText = "cursor:help; color:var(--text-muted); font-size:1rem; margin-left:8px; vertical-align: middle;";
    
    helpIcon.onmouseenter = function(e) {
        const tt = document.getElementById("wowTooltip");
        if (!tt) return;
        tt.style.display = "block";
        tt.innerHTML = `<div class="tt-gold">Rotation Settings Logic</div><div class="tt-spacer"></div><div class="tt-white" style="font-size:0.85rem; line-height:1.4;">${HELP_TEXTS['rotation_logic']}</div>`;
        moveTooltip(e);
    };
    helpIcon.onmousemove = moveTooltip;
    helpIcon.onmouseleave = hideTooltip;

    // Fügt das Icon direkt hinter dem Text in der H2 ein
    targetHeader.appendChild(helpIcon);
}

/*
function saveCurrentState() {
    if(SIM_LIST[ACTIVE_SIM_INDEX]) {
        // Only save if we are in Single View (to avoid overwriting with empty data in Overview)
        var isOverview = !document.getElementById('comparisonView').classList.contains('hidden');
        if (!isOverview) {
            SIM_LIST[ACTIVE_SIM_INDEX].config = getCurrentConfigFromUI();
            var nameInput = document.getElementById('simName');
            if(nameInput) SIM_LIST[ACTIVE_SIM_INDEX].name = nameInput.value;
        }
    }
}*/

function addSim(isInit) {
    // Create new Sim Object
    var id = Date.now();
    
    // Default Name
    var newName = "Simulation " + (SIM_LIST.length + 1);
    
    // Prepare Data Containers
    var newConfig = {};
    var newGear = {};
    var newEnchants = {};

    // Copy from current state if not initializing
    if (!isInit && SIM_LIST.length > 0) {
        // FIX: Copy all values (Config, Gear, Enchants, Name) from current state
        newConfig = getSimInputs(); // Grab current UI inputs
        newGear = JSON.parse(JSON.stringify(GEAR_SELECTION)); // Clone global gear
        newEnchants = JSON.parse(JSON.stringify(ENCHANT_SELECTION)); // Clone global enchants
        
        // Optional: Copy Name
        var currentName = document.getElementById("simName") ? document.getElementById("simName").value : "";
        if (currentName) newName = currentName + " (Copy)";
    } else {
        // Init default
        newConfig = typeof getSimInputs === "function" ? getSimInputs() : {};
    }

    var newSim = new SimObject(id, newName);
    newSim.config = newConfig;
    newSim.gear = newGear;
    newSim.enchants = newEnchants;

    SIM_LIST.push(newSim);
    switchSim(SIM_LIST.length - 1);
}

function switchSim(index, skipSave) {
    console.log("switchSim called. Index:", index, "skipSave:", skipSave);

    if (index < 0 || index >= SIM_LIST.length) {
        console.error("switchSim: Invalid index", index);
        return;
    }

    // 1. Save current state (if not skipped)
    // ADDED: !IS_LOADING check to prevent overwriting data while UI is still populating
    if (!skipSave && !IS_LOADING && typeof CURRENT_VIEW !== 'undefined' && CURRENT_VIEW === 'single' && SIM_LIST[ACTIVE_SIM_INDEX]) {
        saveCurrentState();
    }

    // 2. Switch
    ACTIVE_SIM_INDEX = index;
    CURRENT_VIEW = 'single';
    SIM_DATA = SIM_LIST[index];
    
    if (typeof updateViewButtons === 'function') updateViewButtons();

    // 3. Load Data to UI
    // Forcing applyConfigToUI to ensure consistent behavior
    if (SIM_DATA && SIM_DATA.config) {
        applyConfigToUI(SIM_DATA.config);
    } else {
        console.warn("switchSim: No config found in SIM_DATA");
    }

    // 4. Update Views
    var compView = document.getElementById("comparisonView");
    var singleView = document.getElementById("singleSimView");
    if(compView) compView.classList.add("hidden");
    if(singleView) singleView.classList.remove("hidden");

    var nameInput = document.getElementById("simName");
    if (nameInput) {
        nameInput.value = SIM_DATA.name;
        nameInput.disabled = false;
        nameInput.style.color = "var(--druid-orange)";
    }

    renderSidebar();

    // Results View Logic
    var resArea = document.getElementById("simResultsArea");
    if (!SIM_DATA.results) {
        if (resArea) resArea.classList.add("hidden");
    } else {
        if (typeof updateSimulationResults === 'function') {
            updateSimulationResults(SIM_DATA);
        } else if (resArea) {
            resArea.classList.remove("hidden");
        }
    }
    
    if (typeof updateRotationConstraints === 'function') updateRotationConstraints();
}

function showComparisonView() {
    // Save current before leaving
    if (CURRENT_VIEW === 'single' && SIM_LIST[ACTIVE_SIM_INDEX]) {
        saveSimData(ACTIVE_SIM_INDEX);
    }

    CURRENT_VIEW = 'comparison';
    document.getElementById("singleSimView").classList.add("hidden");
    document.getElementById("comparisonView").classList.remove("hidden");

    renderComparisonTable();
    renderSidebar();
}

function deleteSim(index) {
    if (SIM_LIST.length <= 1) {
        showToast("Cannot delete the last simulation.");
        return;
    }
    if (confirm("Delete " + SIM_LIST[index].name + "?")) {
        SIM_LIST.splice(index, 1);
        if (ACTIVE_SIM_INDEX >= SIM_LIST.length) ACTIVE_SIM_INDEX = SIM_LIST.length - 1;

        // If we were in comparison, stay there, else switch
        if (CURRENT_VIEW === 'comparison') {
            renderComparisonTable();
            renderSidebar();
        } else {
            switchSim(ACTIVE_SIM_INDEX);
        }
    }
}

function updateSimName() {
    var el = document.getElementById("simName");
    if (el && SIM_LIST[ACTIVE_SIM_INDEX]) {
        SIM_LIST[ACTIVE_SIM_INDEX].name = el.value;
        renderSidebar(); // Update tooltip
    }
}

// Helper: Save UI inputs to SIM_LIST object
// FIXED: Now uses saveCurrentState logic to ensure consistent Data Format (DOM IDs vs Engine Keys)
function saveSimData(idx) {
    // We can only save the state of the ACTIVE simulation from the UI inputs.
    if (idx === ACTIVE_SIM_INDEX) {
        saveCurrentState();
    } else {
        // Fallback for non-active sims if ever needed (mostly internal use)
        // Usually not triggered from UI for non-active sims.
        var s = SIM_LIST[idx];
        if (s) {
            s.gear = JSON.parse(JSON.stringify(GEAR_SELECTION));
            s.enchants = JSON.parse(JSON.stringify(ENCHANT_SELECTION));
        }
    }
}

// Helper: Load SIM_LIST object to UI inputs
function loadSimDataToUI(sim) {
    if (!sim) return;

    // Load Gear
    GEAR_SELECTION = sim.gear || {};
    ENCHANT_SELECTION = sim.enchants || {};
    initGearPlannerUI(); // Updates gear UI slots
    calculateGearStats(); // Updates stats inputs

    // Load Config Inputs
    var c = sim.config;
    if (!c) return;

    // Apply config to all known IDs (defined in 01_globals.js)
    CONFIG_IDS.forEach(function (id) {
        if (c[id] !== undefined) {
            var el = document.getElementById(id);
            if (el) {
                if (el.type === 'checkbox') el.checked = (c[id] == 1 || c[id] === true);
                else el.value = c[id];
            }
        }
    });

    // Trigger updates for derived UI elements (summaries)
    updatePlayerStats();
    updateEnemyInfo();
    updateRotationConstraints(); // Ensure Visual State is correct
}

// ============================================================================
// COMPARISON TABLE
// ============================================================================

function renderComparisonTable() {
    var tbody = document.getElementById("comparisonBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    SIM_LIST.forEach(function (sim, idx) {
        var r = sim.results;
        var c = sim.config || {};

        var tr = document.createElement("tr");

        var dpsAvg = "-";
        var dpsMin = "-";
        var dpsMax = "-";

        if (r) {
            dpsAvg = Math.floor(r.dps);
            if(r.minDps) dpsMin = Math.floor(r.minDps);
            if(r.maxDps) dpsMax = Math.floor(r.maxDps);
        }

        // Build Row (Optimized for Feral Cat 1.18)
        var html = `
            <td><b style="color:var(--druid-orange); cursor:pointer;" onclick="switchSim(${idx})">${sim.name}</b></td>
            <td style="text-align:center;">${c.simTime || 60}s</td>
            <td style="text-align:center;">${c.iterations || 1000}</td>
            <td style="text-align:center;">${getSavedStat(sim, 'inputAP')}</td>
            <td style="text-align:center;">${getSavedStat(sim, 'inputCrit')}%</td>
            <td style="text-align:center;">${getSavedStat(sim, 'inputHit')}%</td>
            <td style="text-align:center;">${getSavedStat(sim, 'inputHaste')}%</td>
            <td style="text-align:center;">${c.enemy_level || 63}</td>
            <td style="font-size:0.75rem; color:#aaa;">${getRotationShort(c)}</td>
            <td style="font-size:0.75rem; color:var(--druid-orange);">${getGearShort(sim)}</td>
            <td style="text-align:right; color:#90caf9; font-family:monospace;">${dpsMin}</td>
            <td style="text-align:right; color:#ffb74d; font-weight:bold; font-size:1.1rem;">${dpsAvg}</td>
            <td style="text-align:right; color:#a5d6a7; font-family:monospace;">${dpsMax}</td>
            <td style="text-align:center; cursor:pointer; color:#f44336;" onclick="deleteSim(${idx})">✖</td>
        `;
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

function generateSummaryImage() {
    if (!SIM_DATA || !SIM_DATA.results) { alert("Run Sim first."); return; }

    var sim = SIM_LIST[ACTIVE_SIM_INDEX];
    var c = sim.config;
    var r = sim.results;

    // Falls Ergebnisse vorhanden, aber das Objekt korrupt ist
    if (!r) {
        showToast("Keine Simulationsergebnisse gefunden.");
        return;
    }

    // --- 1. Header & Metadaten ---
    setText("sumSimName", sim.name || "Feral Simulation");
    setText("sumDate", new Date().toLocaleDateString());
    
    // --- 2. Hero Bereich (DPS & Gear Score) ---
    setText("sumAvg", Math.floor(r.dps).toFixed(1));
    setText("sumMin", Math.floor(r.minDps || 0).toFixed(0));
    setText("sumMax", Math.floor(r.maxDps || 0).toFixed(0));
    
    // Gear Score aus dem UI-Element des Planers ziehen
    var gsEl = document.getElementById("gp_gs");
    setText("sumGS", gsEl ? gsEl.innerText : "0");
    setText("sumTime", (c.simTime || 60) + "s");

    // --- 3. Spalte 1: Player & Enemy Stats ---
    setText("sumAP", Math.floor(c.inputAP || 0));
    setText("sumCrit", (c.inputCrit || 0).toFixed(2) + "%");
    setText("sumHit", (c.inputHit || 0).toFixed(2) + "%");
    setText("sumHaste", (c.inputHaste || 0).toFixed(2) + "%");
    setText("sumLvl", c.enemyLevel || 63);
    setText("sumArmor", c.enemyArmor || 0);

    // --- 4. Spalte 2: Rotation Settings ---
    var ulRot = document.getElementById("sumRotaList");
    if (ulRot) {
        ulRot.innerHTML = "";
        var addLi = function(text) { 
            var li = document.createElement("li");
            li.innerText = text;
            ulRot.appendChild(li); 
        };

        // Dynamische Abfrage der gewählten Rotations-Optionen
        if (c.use_rip) addLi("Rip (>" + (c.rip_cp || 5) + " CP)");
        if (c.use_fb) addLi("FB (>" + (c.fb_energy || 35) + " Energy)");
        if (c.use_reshift) addLi("Powershift (<" + (c.reshift_energy || 10) + " Energy)");
        if (c.use_tf) addLi("Tiger's Fury");
        if (c.use_rake) addLi("Rake (Bleed)");
        
        var posText = (c.rota_position === "back") ? "Behind (Shred)" : "Front (Claw)";
        addLi("Pos: " + posText);
    }

    // --- 5. Spalte 3: Sets, Trinkets & Gear Effects ---
    var ulGear = document.getElementById("sumGearList");
    var ulTrink = document.getElementById("sumTrinketList");
    
    if (ulGear) {
        ulGear.innerHTML = "";
        var addGear = function(text) { 
            var li = document.createElement("li");
            li.innerText = text;
            ulGear.appendChild(li); 
        };

        // Prüfung auf aktive Turtle WoW Sets
        if (c.set_t05_4p) addGear("Feralheart (4pc)");
        if (c.set_cenarion_8p) addGear("Cenarion (8pc)");
        else if (c.set_cenarion_5p) addGear("Cenarion (5pc)");
        if (c.set_genesis_5p) addGear("Genesis (5pc)");
        else if (c.set_genesis_3p) addGear("Genesis (3pc)");
        if (c.set_talon_5p) addGear("Talon (5pc)");
        else if (c.set_talon_3p) addGear("Talon (3pc)");
        if (c.hasGiftOfFerocity) addGear("Gift of Ferocity");
    }

    if (ulTrink) {
        ulTrink.innerHTML = "";
        var addTrink = function(text) { 
            var li = document.createElement("li");
            li.innerText = text;
            ulTrink.appendChild(li); 
        };

        // On-Use & Proc Trinkets
        if (c.t_slayer) addTrink("Slayer's Crest");
        if (c.t_spider) addTrink("Kiss of the Spider");
        if (c.t_jomgabbar) addTrink("Jom Gabbar");
        if (c.t_earthstrike) addTrink("Earthstrike");
        if (c.t_swarmguard) addTrink("Swarmguard");
        if (c.t_shieldrender) addTrink("Shieldrender");
    }

    // --- 6. Rendering & Download ---
    showToast("Generiere Report...");
    var card = document.getElementById("summaryCard");
    if (!card) return;

    // Karte für den Render-Vorgang positionieren (wird durch style.css versteckt)
    card.style.position = "fixed";
    card.style.top = "0";
    card.style.left = "-2000px";

    html2canvas(card, { 
        scale: 2, 
        backgroundColor: "#121212", 
        useCORS: true,
        logging: false 
    }).then(function (canvas) {
        var link = document.createElement('a');
        link.download = 'feral_report_' + (sim.name ? sim.name.replace(/\s+/g, '_') : "export") + '.png';
        link.href = canvas.toDataURL();
        link.click();
        showToast("Report erfolgreich gespeichert!");
    });
}


function getSavedStat(sim, id) {
    if (sim.config && sim.config[id]) return sim.config[id];
    return "-";
}

function getRotationShort(c) {
    var parts = [];
    if (c.rota_position === 'back') parts.push("Shred"); else parts.push("Claw");

    if (c.use_reshift) parts.push("Shift<" + c.reshift_energy);
    if (c.use_rip) parts.push("Rip>" + c.rip_cp);
    if (c.use_fb) parts.push("FB>" + c.fb_energy);

    return parts.join(", ");
}

function getGearShort(sim) {
    var count = Object.keys(sim.gear || {}).length;
    var sets = "";
    var c = sim.config || {};
    
    // Updated Logic for New Sets
    if (c.set_cenarion_5p) sets += "T1-5 ";
    if (c.set_cenarion_8p) sets += "T1-8 ";
    if (c.set_genesis_3p) sets += "T2.5-3 ";
    if (c.set_genesis_5p) sets += "T2.5-5 ";
    if (c.set_talon_3p) sets += "T3.5-3 ";
    if (c.set_talon_5p) sets += "T3.5-5 ";
    
    // Important Trinkets
    if (c.t_slayer) sets += "Slayer ";
    if (c.t_spider) sets += "Spider ";
    if (c.t_jomgabbar) sets += "Jom ";
    if (c.t_swarmguard) sets += "Swarm ";
    
    return count + " Items " + (sets ? "| " + sets : "");
}

function runAllSims() {
    showProgress("Running All Simulations...");
    var idx = 0;

    function next() {
        if (idx >= SIM_LIST.length) {
            hideProgress();
            renderComparisonTable();
            return;
        }

        var sim = SIM_LIST[idx];

        try {
            // Engine must be available as runCoreSimulation
            if (typeof runCoreSimulation !== 'function') {
                throw new Error("Engine not loaded");
            }
            
            // Reload data first to ensure Globals are correct
            loadSimDataToUI(sim);

            var all = [];
            var iterations = sim.config.iterations || 100;

            // Small delay to allow UI/Globals to settle
            setTimeout(function() {
                var cfg = getSimInputs();
                for (var i = 0; i < iterations; i++) {
                    all.push(runCoreSimulation(cfg));
                }
                sim.results = aggregateResults(all);

                updateProgress(Math.floor(((idx + 1) / SIM_LIST.length) * 100));
                idx++;
                next();
            }, 5);
            
        } catch (e) {
            console.error(e);
            idx++;
            setTimeout(next, 10);
        }
    }

    setTimeout(next, 50);
}

// ============================================================================
// UI SETUP & EVENT LISTENERS
// ============================================================================

function setupUIListeners() {
    // 1. Standard Inputs Change -> Save State & Recalculate
    var inputs = document.querySelectorAll("input, select");
    inputs.forEach(function (el) {
        el.addEventListener("change", function () {
            // Ignore boss select in general loop to prevent double firing, handled separately
            if (el.id === "enemy_boss_select") return;

            // MUTUAL EXCLUSION LOGIC
            if (el.type === "checkbox" && el.checked) {
                var groupClass = null;
                if (el.classList.contains("mut-ex-wep")) groupClass = "mut-ex-wep";
                else if (el.classList.contains("mut-ex-food")) groupClass = "mut-ex-food";
                else if (el.classList.contains("mut-ex-bl")) groupClass = "mut-ex-bl";
                else if (el.classList.contains("mut-ex-juju")) groupClass = "mut-ex-juju";

                if (groupClass) {
                    document.querySelectorAll("." + groupClass).forEach(function(sib) {
                        if (sib !== el) sib.checked = false;
                    });
                }
            }

            // Logic to disable specific Rotation inputs based on settings
            if (el.id === "enemy_can_bleed" || el.id === "rota_position" || el.id === "use_reshift" || el.id === "use_tf") {
                updateRotationConstraints();
            }

            if (ACTIVE_SIM_INDEX >= 0 && SIM_LIST[ACTIVE_SIM_INDEX]) {
                saveSimData(ACTIVE_SIM_INDEX);

                // IMPORTANT: Recalculate stats whenever any input (including Buffs) changes
                if (typeof calculateGearStats === 'function') {
                    calculateGearStats();
                }

                updatePlayerStats();
                updateEnemyInfo();
            }
        });
    });

    // Initialize Constraints
    updateRotationConstraints();

    // 2. Boss Select Dropdown Logic
    renderBossSelect();
    var bossSel = document.getElementById("enemy_boss_select");
    if (bossSel) {
        bossSel.addEventListener("change", function () {
            var val = bossSel.value;
            // If value is set (not empty), update Armor Field
            if (val) {
                var armorInput = document.getElementById("enemy_armor");
                
                if (armorInput) {
                    armorInput.value = val;
                    // Trigger updates
                    updateEnemyInfo();
                }
            }
            if (ACTIVE_SIM_INDEX >= 0 && SIM_LIST[ACTIVE_SIM_INDEX]) {
                saveSimData(ACTIVE_SIM_INDEX);
            }
        });
    }

    // 3. Escape Key to Close Modals
    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape") {
            closeItemModal();
            closeEnchantModal();
        }
    });

    // Run Button
    var btn = document.getElementById('btnRun');
    if (btn) btn.addEventListener('click', runSimulation);

    // Stat Weights Button
    var btnWeights = document.getElementById('btnWeights');
    if (btnWeights) btnWeights.addEventListener('click', runStatWeights);

    // Help Tooltips for Settings & Configuration
    const allLabels = document.querySelectorAll(".card-body label, .input-group label");
    allLabels.forEach(label => {
        const forId = label.getAttribute("for") || 
                      (label.querySelector("input, select") ? label.querySelector("input, select").id : null);
        
        if (forId && HELP_TEXTS[forId]) {
            label.style.borderBottom = "1px dotted #666";
            label.style.cursor = "help";
            
            label.onmouseenter = function(e) {
                const tt = document.getElementById("wowTooltip");
                if (!tt) return;
                tt.style.display = "block";
                tt.innerHTML = `<div class="tt-white">${HELP_TEXTS[forId]}</div>`;
                moveTooltip(e);
            };
            label.onmousemove = moveTooltip;
            label.onmouseleave = hideTooltip;
        }
    });
    
    // Init Rotation Help
    renderRotationHelp();

    // Calc Mode Toggle Logic
    var calcModeEl = document.getElementById("sim_calc_mode");
    if (calcModeEl) {
        calcModeEl.addEventListener("change", updateCalcModeUI);
        // Init call
        updateCalcModeUI();
    }

}

// NEW: Handles visual enabling/disabling of rotation inputs
function updateRotationConstraints() {
    var canBleed = getVal("enemy_can_bleed") === 1;
    var pos = getVal("rota_position"); // "back" or "front"

    // 1. Bleed Constraint: Rip (Row) & Rake (Toggle)
    var rowRip = document.getElementById("row_rip");
    var chkRip = document.getElementById("use_rip");
    var lblRake = document.getElementById("lbl_rake");
    var chkRake = document.getElementById("use_rake");

    if (canBleed) {
        // Enable
        if(rowRip) { rowRip.style.opacity = "1"; rowRip.style.pointerEvents = "auto"; }
        if(chkRip) chkRip.disabled = false;
        
        if(lblRake) { lblRake.style.opacity = "1"; lblRake.style.pointerEvents = "auto"; }
        if(chkRake) chkRake.disabled = false;
    } else {
        // Disable
        if(rowRip) { rowRip.style.opacity = "0.5"; rowRip.style.pointerEvents = "none"; }
        if(chkRip) chkRip.disabled = true;

        if(lblRake) { lblRake.style.opacity = "0.5"; lblRake.style.pointerEvents = "none"; }
        if(chkRake) chkRake.disabled = true;
    }

    // 2. Position Constraint: Shred
    var lblShred = document.getElementById("lbl_shred");
    var lblShredOoCOnly = document.getElementById("lbl_shred_ooc_only");
    var chkShred = document.getElementById("use_shred");
    var chbShredOoCOnly = document.getElementById("shred_ooc_only");

    if (pos === "back") {
        if(lblShred) { lblShred.style.opacity = "1"; lblShred.style.pointerEvents = "auto"; }
        if(chkShred) chkShred.disabled = false;
        if(lblShredOoCOnly) { lblShredOoCOnly.style.opacity = "1"; lblShredOoCOnly.style.pointerEvents = "auto"; }
        if(chbShredOoCOnly) chbShredOoCOnly.disabled = false;
    } else {
        if(lblShred) { lblShred.style.opacity = "0.5"; lblShred.style.pointerEvents = "none"; }
        if(chkShred) chkShred.disabled = true;
        if(lblShredOoCOnly) { lblShredOoCOnly.style.opacity = "0.5"; lblShredOoCOnly.style.pointerEvents = "none"; }
        if(chbShredOoCOnly) chbShredOoCOnly.disabled = true;
    }

    // 3. Reshift vs TF Logic
    var useShift = getVal("use_reshift") === 1;
    var useTF = getVal("use_tf") === 1;

    var chkOverTF = document.getElementById("reshift_over_tf");
    var inpOverTFDur = document.getElementById("reshift_over_tf_dur");
    
    // Parents for visual opacity
    var parentToggle = chkOverTF ? chkOverTF.parentElement : null;
    var parentDur = inpOverTFDur ? inpOverTFDur.parentElement : null;

    if (useShift && useTF) {
        if(chkOverTF) chkOverTF.disabled = false;
        if(inpOverTFDur) inpOverTFDur.disabled = false;
        if(parentToggle) { parentToggle.style.opacity = "1"; parentToggle.style.pointerEvents = "auto"; }
        if(parentDur) { parentDur.style.opacity = "1"; parentDur.style.pointerEvents = "auto"; }
    } else {
        if(chkOverTF) chkOverTF.disabled = true;
        if(inpOverTFDur) inpOverTFDur.disabled = true;
        if(parentToggle) { parentToggle.style.opacity = "0.5"; parentToggle.style.pointerEvents = "none"; }
        if(parentDur) { parentDur.style.opacity = "0.5"; parentDur.style.pointerEvents = "none"; }
    }

    // --- NEU: Pounce Constraint (Requires Behind) ---
    var lblPounce = document.getElementById("use_pounce") ? document.getElementById("use_pounce").parentElement : null;
    var chkPounce = document.getElementById("use_pounce");

    if (pos === "back") {
        if(lblPounce) { lblPounce.style.opacity = "1"; lblPounce.style.pointerEvents = "auto"; }
        if(chkPounce) chkPounce.disabled = false;
    } else {
        if(lblPounce) { lblPounce.style.opacity = "0.5"; lblPounce.style.pointerEvents = "none"; }
        if(chkPounce) { chkPounce.disabled = true; chkPounce.checked = false; }
    }
}

function updateCalcModeUI() {
    var mode = document.getElementById("sim_calc_mode") ? document.getElementById("sim_calc_mode").value : "stochastic";
    var iterInput = document.getElementById("simCount");
    
    if (iterInput) {
        if (mode === 'deterministic' || mode === 'averaged') {
            iterInput.disabled = true;
            iterInput.style.opacity = "0.5";
            iterInput.title = "Deterministic mode always runs 1 iteration.";
        } else {
            iterInput.disabled = false;
            iterInput.style.opacity = "1";
            iterInput.title = "";
        }
    }
}

/**
 * Populates the Boss Select Dropdown from BOSS_PRESETS (defined in globals)
 */
function renderBossSelect() {
    var sel = document.getElementById("enemy_boss_select");
    if (!sel || !BOSS_PRESETS) return;

    // Clear existing options except the first "Custom" one
    while (sel.options.length > 1) {
        sel.remove(1);
    }

    // Group by 'group' key
    var groups = {};
    BOSS_PRESETS.forEach(b => {
        if (!groups[b.group]) groups[b.group] = [];
        groups[b.group].push(b);
    });

    // Create OptGroups
    for (var g in groups) {
        var grp = document.createElement("optgroup");
        grp.label = g;
        groups[g].forEach(b => {
            var opt = document.createElement("option");
            opt.value = b.armor;
            opt.innerText = b.name + " (" + b.armor + ")";
            grp.appendChild(opt);
        });
        sel.appendChild(grp);
    }
}


function updateEnemyInfo() {
    var armor = getVal('enemy_armor');
    var debuff = 0;

    // Major Armor (Sunder vs IEA)
    var maj = getVal("debuff_major_armor");
    if (maj === "sunder") debuff += 2250;
    else if (maj === "iea") debuff += 2550;

    // Eskhandar (Stackable)
    if (getVal("debuff_eskhandar")) debuff += 1200;

    // Curse of Recklessness (Stackable)
    if (getVal("debuff_cor")) debuff += 640;

    // Faerie Fire (Check both Debuff box AND Rotation box, max 1 application)
    if (getVal("debuff_ff") || getVal("use_ff")) debuff += 505;
    
    // NEW: Swarmguard Logic (Check if enabled in logic, though UI static preview can't simulate stacks)
    // We leave this dynamic.

    // Calculate effective armor
    var effArmor = Math.max(0, armor - debuff);

    // Turtle WoW 1.18 DR Formula 
    // DR = Armor / (Armor + constant)
    var EnemyLevel = getVal("enemy_level");
    var constant = (467.5*EnemyLevel)-22167.5;
    var dr = effArmor / (effArmor + constant);
    var pct = (dr * 100).toFixed(2);
    var arr = (effArmor * 100 / armor).toFixed(2);

    // Update Text
    var barFill = document.getElementById("enemyArmorBar");
    var barText = document.getElementById("enemyArmorText");
    
    if (barText) {
        barText.innerText = `Reduction: ${pct}% (Armor: ${effArmor})`;
    }
    
    if (barFill) {
        // Percentage of the bar to fill
        var visWidth = Math.min(100, parseFloat(arr));
        if(isNaN(visWidth)) visWidth = 0;
        barFill.style.width = visWidth + "%";
        
        // Color Logic
        var factor = parseFloat(arr) / 100.0; // 0.0 to 1.0+
        if (factor > 1) factor = 1;
        if (factor < 0) factor = 0;
        
        var hue = 120 - (factor * 120);
        barFill.style.background = `hsl(${hue}, 80%, 45%)`;
        //barFill.className = "enemy-bar-fill"; 
    }
}

function updatePlayerStats() {
    // Just updates the UI text from Inputs (which are populated by 03_gear.js)
    var ap = getVal("stat_ap");
    var crit = getVal("stat_crit");
    var hit = getVal("stat_hit");
    var haste = getVal("stat_haste");

    setText("sumAP", Math.floor(ap));
    setText("sumCrit", crit.toFixed(2) + "%");
    setText("sumHit", hit.toFixed(2) + "%");
    setText("sumHaste", haste.toFixed(2) + "%");
    
    updateRotaSummary();
    updateTrinketSummary();
    updateDamageScaling();
}

function updateRotaSummary() {
    var list = document.getElementById("sumRotaList");
    if (!list) return;
    list.innerHTML = "";
    var add = (t, c) => { var li = document.createElement("li"); li.innerText = t; if (c) li.style.color = c; list.appendChild(li); };

    // Priority Display
    if (getVal("use_pounce")) add("Pounce (Opener)", "#e91e63"); // NEU
    if (getVal("use_rip")) add("Rip (>" + getVal("rip_cp") + " CP)", "#f44336");
    if (getVal("use_fb")) add("Bite (> 5 CP, >" + getVal("fb_energy") + " En)", "#ff5722");

    if (getVal("use_reshift")) add("Reshift (<" + getVal("reshift_energy") + " En)", "#4caf50");
    if (getVal("use_tf")) add("Tiger's Fury", "#ff9800");
    if (getVal("use_ff")) add("Faerie Fire", "#a335ee");
    if (getVal("use_rake")) add("Rake", "#e57373");

    if (getVal("rota_position") === "back") {
        if (getVal("use_shred")) add("Shred (Behind)", "#ffeb3b");
    } else {
        if (getVal("use_claw")) add("Claw (Front)", "#ff9800");
    }
}

function updateTrinketSummary() {
    var list = document.getElementById("sumTrinketList");
    if (!list) return;
    list.innerHTML = "";

    var t1 = GEAR_SELECTION["Trinket 1"];
    var t2 = GEAR_SELECTION["Trinket 2"];

    [t1, t2].forEach(id => {
        if (id && ITEM_ID_MAP[id]) {
            var li = document.createElement("li");
            li.innerText = ITEM_ID_MAP[id].name;
            li.style.color = "#ccc";
            list.appendChild(li);
        }
    });
}

// ============================================================================
// RESULT RENDERING
// ============================================================================

// Toggle function for Min/Avg/Max Views
function switchResultView(view) {
    CURRENT_RESULT_VIEW = view;
    updateViewButtons();
    if (SIM_DATA) updateSimulationResults(SIM_DATA);
}

function updateViewButtons() {
    var ids = ['btnViewMin', 'btnViewAvg', 'btnViewMax'];
    var vals = ['min', 'avg', 'max'];
    
    ids.forEach((id, idx) => {
        var el = document.getElementById(id);
        if (el) {
            if (vals[idx] === CURRENT_RESULT_VIEW) el.classList.add("active");
            else el.classList.remove("active");
        }
    });
}

function updateSimulationResults(sim) {
    if (!sim || !sim.results) return;
    
    // Choose data set based on current View
    var data = sim.results; // Default Avg
    var isAvg = true;
    
    if (CURRENT_RESULT_VIEW === 'min' && sim.results.minRun) {
        data = sim.results.minRun;
        isAvg = false;
    } else if (CURRENT_RESULT_VIEW === 'max' && sim.results.maxRun) {
        data = sim.results.maxRun;
        isAvg = false;
    }

    var r = data;
    var avgR = sim.results; // Always keep reference to Avg for top stats

    var resDiv = document.getElementById("simResultsArea");
    if (resDiv) resDiv.classList.remove("hidden");

    // Top Stats based on current view
    setText("resDps", Math.floor(r.dps));
    
    // UPDATE BUTTONS with VALUES
    var btnMin = document.getElementById("btnViewMin");
    if(btnMin && avgR.minDps) {
        btnMin.innerHTML = `<span class="res-btn-label">Min. DPS</span><span class="res-btn-val">${Math.floor(avgR.minDps)}</span>`;
    }
    
    var btnAvg = document.getElementById("btnViewAvg");
    if(btnAvg && avgR.dps) {
        btnAvg.innerHTML = `<span class="res-btn-label">Avg. DPS</span><span class="res-btn-val">${Math.floor(avgR.dps)}</span>`;
    }

    var btnMax = document.getElementById("btnViewMax");
    if(btnMax && avgR.maxDps) {
        btnMax.innerHTML = `<span class="res-btn-label">Max. DPS</span><span class="res-btn-val">${Math.floor(avgR.maxDps)}</span>`;
    }
    
    setText("resTotalDmg", (r.totalDmg / 1000).toFixed(1) + "k");
    
    setText("resDuration", r.duration + "s");

    // Counts
    var shifts = r.counts ? (r.counts["Powershift"] || 0) : 0;
    setText("resMana", Math.floor(shifts));

    // --- NEU: Globale Statistiken berechnen ---
    var totalAttempts = 0;
    var totalHits = 0;
    var totalMisses = 0;
    var totalDodges = 0;
    var totalCrits = 0;

    // Wir summieren die Werte aller Fähigkeiten aus dem Ergebnis-Objekt
    for (var ability in r.counts) {
        var count = r.counts[ability] || 0;
        var misses = r.missCounts[ability] || 0;
        var dodges = r.dodgeCounts[ability] || 0;
        var crits = r.critCounts[ability] || 0;

        totalAttempts += count;
        totalMisses += misses;
        totalDodges += dodges;
        totalHits += (count - misses - dodges);
        totalCrits += crits;
    }

    // Hit-Werte befüllen
    setText("resGlobalHit", `${Math.floor(totalHits)} / ${Math.floor(totalMisses)} / ${Math.floor(totalDodges)}`);
    var globalHitPct = totalAttempts > 0 ? ((totalHits / totalAttempts) * 100).toFixed(2) : "0.00";
    setText("resGlobalHitPct", `${globalHitPct}% Landed Hits`);

    // Crit-Werte befüllen (Verhältnis Crits zu gelandeten Hits)
    setText("resGlobalCrit", Math.floor(totalCrits));
    var globalCritPct = totalHits > 0 ? ((totalCrits / totalHits) * 100).toFixed(2) : "0.00";
    setText("resGlobalCritPct", `${globalCritPct}% Actual Crit Rate`);

    // Dist Bar & Table (Specific Run Data)
    renderDistBar(r);
    renderResultTable(r);
    
    // Log Visibility Control
    var logSec = document.getElementById("combatLogSection");
    if (isAvg) {
        // Hide log for Average (as it is aggregated data)
        if (logSec) logSec.classList.add("hidden");
    } else {
        // Show log for Min/Max
        if (logSec) logSec.classList.remove("hidden");
        renderLogTable(r.log);
    }
}

function renderDistBar(r) {
    var bar = document.getElementById("dmgDistBar");
    if (!bar) return;
    bar.innerHTML = "";

    var total = r.totalDmg;
    var sorted = [];
    for (var k in r.dmgSources) sorted.push({ n: k, v: r.dmgSources[k] });
    sorted.sort((a, b) => b.v - a.v);

    var colors = {
        "Auto Attack": "#fff",
        "Shred": "#ffeb3b",
        "Ferocious Bite": "#ff5722",
        "Rip": "#d32f2f",
        "Rake": "#f44336",
        "Claw": "#ff9800",
        "Rake (DoT)": "#e57373",
        "Rip (DoT)": "#b71c1c",
        "Extra Attack": "#90caf9",
        "Maelstrom": "#ffd700",
        "Emerald Rot": "#ffd700",
        "Heating Coil": "#ff9800"
    };

    sorted.forEach(s => {
        var pct = (s.v / total) * 100;
        if (pct < 1) return;
        var d = document.createElement("div");
        d.style.width = pct + "%";
        d.style.backgroundColor = colors[s.n] || "#777";
        d.title = s.n + " " + pct.toFixed(1) + "%";
        bar.appendChild(d);
    });
}

function getRowClass(ability) {
    var a = ability.toLowerCase();
    if(a.includes("rip") || a.includes("rake")) return "row-bleed"; 
    if(a.includes("shred") || a.includes("claw") || a.includes("bite") || a.includes("auto") || a.includes("attack")) return "row-physical"; 
    if(a.includes("maelstrom") || a.includes("emerald") || a.includes("nature") || a.includes("venom")) return "row-nature"; 
    if(a.includes("coil") || a.includes("fire")) return "row-fire"; 
    return "";
}

function renderResultTable(r) {
    var tb = document.getElementById("resTableBody");
    if (!tb) return;
    tb.innerHTML = "";

    var total = r.totalDmg;
    var sorted = [];
    for (var k in r.dmgSources) sorted.push({ n: k, v: r.dmgSources[k] });
    sorted.sort((a, b) => b.v - a.v);

    sorted.forEach(s => {
        var tr = document.createElement("tr");
        var dps = (s.v / r.duration).toFixed(1);
        var pct = ((s.v / total) * 100).toFixed(1);
        var count = r.counts[s.n] || 0;

        // Crit %
        var hits = count - (r.missCounts[s.n] || 0) - (r.dodgeCounts[s.n] || 0);
        var critPct = hits > 0 ? ((r.critCounts[s.n] || 0) / hits * 100).toFixed(1) : "0.0";
        var glancePct = (s.n === "Auto Attack" && count > 0) ? ((r.glanceCounts[s.n] || 0) / count * 100).toFixed(1) : "-";

        tr.className = getRowClass(s.n);

        tr.innerHTML = `
            <td style="text-align:left;">${s.n}</td>
            <td>${Math.floor(s.v).toLocaleString()}</td>
            <td>${dps}</td>
            <td>${pct}%</td>
            <td>${Math.floor(count)}</td>
            <td>${critPct}%</td>
            <td>${glancePct}%</td>
        `;
        tb.appendChild(tr);
    });
}

// ============================================================================
// LOG & CSV
// ============================================================================

var LOG_DATA = [];
var LOG_PAGE = 1;
const LOG_PER_PAGE = 50;

function renderLogTable(log) {
    LOG_DATA = log || [];
    LOG_PAGE = 1;
    
    var allKeys = new Set();
    LOG_DATA.forEach(e => {
        if(e.activeBuffs) {
            Object.keys(e.activeBuffs).forEach(k => {
                // EXCLUDE BF from dynamic columns (now static)
                if (k !== "BF" && k !== "BloodFrenzy") {
                    allKeys.add(k);
                }
            });
        }
    });
    LOG_BUFF_KEYS = Array.from(allKeys).sort();

    updateLogView();
}

function updateLogView() {
    // Check Config for Column Visibility
    var cfg = (SIM_DATA && SIM_DATA.config) ? SIM_DATA.config : {};
    
    // Logic: Show Pounce if used. Show Rake if used. Show Rip if used. 
    // Show OW if Talent > 0. Show FF if used (internal).
    var showPounce = (cfg.use_pounce && cfg.rota_position === 'back');
    var showRake = (cfg.use_rake);
    var showRip = (cfg.use_rip);
    var showOW = (cfg.tal_open_wounds > 0);
    var showFF = (cfg.use_ff);

    var container = document.querySelector(".log-container table thead tr");
    if (container) {
        // Static Headers
        let headerHtml = `
            <th>Time</th><th>Event</th><th>Ability</th><th>Result</th>
            <th>Dmg(N)</th><th>Dmg(C)</th><th>Dmg(T)</th><th>Spec</th>`;
        
        // Dynamic Headers
        if (showPounce) headerHtml += `<th>Pounce(t)</th>`;
        if (showRake) headerHtml += `<th>Rake(t)</th>`;
        if (showRip) headerHtml += `<th>Rip(t)</th>`;
        if (showOW) headerHtml += `<th>OW</th>`;
        if (showFF) headerHtml += `<th>FF(t)</th>`;

        // Static Headers Rest
        headerHtml += `<th>CP</th><th>AP</th><th>Haste</th><th>Speed</th><th>ArP</th><th>Energy</th><th>E+/-</th>
            <th>OoC</th><th>TF(t)</th><th>BF(t)</th>`;
        
        // Dynamic Buff Headers
        LOG_BUFF_KEYS.forEach(key => {
            headerHtml += `<th>${key}</th>`;
        });

        headerHtml += `<th>Info</th>`;
        container.innerHTML = headerHtml;
    }

    var tb = document.getElementById("logTableBody");
    if (!tb) return;
    tb.innerHTML = "";

    var start = (LOG_PAGE - 1) * LOG_PER_PAGE;
    var end = start + LOG_PER_PAGE;
    var slice = LOG_DATA.slice(start, end);

    slice.forEach(e => {
        var tr = document.createElement("tr");
        
        // Coloring Logic remains same
        if (e.event === "Buff" || e.event === "Proc" || e.info.includes("Aura") || e.info.includes("Proc") || e.result.includes("Proc")) {
            tr.style.backgroundColor = "rgba(197, 134, 192, 0.2)"; 
        } else if (e.event === "Tick" && e.ability !== "Energy Tick") {
            tr.style.backgroundColor = "rgba(229, 115, 115, 0.15)"; 
        } else if (e.event === "Cast" || e.event === "Damage" || e.ability === "Energy Tick") {
            if (e.ability !== "Auto Attack" && e.ability !== "Extra Attack") {
                tr.style.backgroundColor = "rgba(255, 215, 0, 0.15)";
            }
        }
        
        var eChangeDisplay = e.eChange !== 0 ? (e.eChange > 0 ? "+" + e.eChange : e.eChange) : "";
        var eChangeStyle = e.eChange > 0 ? "color:#66bb6a;" : (e.eChange < 0 ? "color:#ef5350;" : "");

        // Build Row HTML
        var html = `
            <td>${e.t.toFixed(3)}</td>
            <td>${e.event}</td>
            <td style="font-weight:bold;">${e.ability}</td>
            <td>${e.result}</td>
            <td>${e.dmgNorm > 0 ? Math.floor(e.dmgNorm) : ""}</td>
            <td>${e.dmgCrit > 0 ? Math.floor(e.dmgCrit) : ""}</td>
            <td>${e.dmgTick > 0 ? Math.floor(e.dmgTick) : ""}</td>
            <td>${e.dmgSpec > 0 ? Math.floor(e.dmgSpec) : ""}</td>`;

        // Dynamic Columns Data
        if (showPounce) html += `<td>${e.remPounce > 0 ? e.remPounce.toFixed(1) : ""}</td>`;
        if (showRake) html += `<td>${e.remRake > 0 ? e.remRake.toFixed(1) : ""}</td>`;
        if (showRip) html += `<td>${e.remRip > 0 ? e.remRip.toFixed(1) : ""}</td>`;
        if (showOW) html += `<td style="color:#ce93d8">${e.ow !== "-" ? e.ow : ""}</td>`;
        if (showFF) html += `<td>${e.remFF > 0 ? e.remFF.toFixed(1) : ""}</td>`;

        // Rest of Data
        html += `
            <td class="col-cp">${e.cp}</td>
            <td>${e.ap}</td>
            <td>${e.haste.toFixed(1)}%</td>
            <td>${e.speed.toFixed(2)}s</td>
            <td>${e.arp}</td>
            <td class="col-energy">${e.energy}</td>
            <td style="${eChangeStyle}">${eChangeDisplay}</td>
            <td style="text-align:center;">${e.ooc > 0 ? e.ooc.toFixed(1) : ""}</td>
            <td style="color:var(--energy-yellow)">${e.tf > 0 ? e.tf.toFixed(1) : ""}</td>
            <td style="color:#ff5722">${(e.activeBuffs && (e.activeBuffs["BloodFrenzy"])) ? (e.activeBuffs["BloodFrenzy"]).toFixed(1) : ""}</td>
        `;

        LOG_BUFF_KEYS.forEach(key => {
            var val = (e.activeBuffs && e.activeBuffs[key]) ? e.activeBuffs[key].toFixed(1) : "";
            html += `<td style="color:#c586c0; text-align:center;">${val}</td>`;
        });

        html += `<td style="color:#777; font-size:0.75rem;">${e.info || ""}</td>`;
        
        tr.innerHTML = html;
        tb.appendChild(tr);
    });

    setText("logPageLabel", LOG_PAGE + " / " + Math.ceil(LOG_DATA.length / LOG_PER_PAGE));
}

function nextLogPage() {
    if (LOG_PAGE * LOG_PER_PAGE < LOG_DATA.length) { LOG_PAGE++; updateLogView(); }
}
function prevLogPage() {
    if (LOG_PAGE > 1) { LOG_PAGE--; updateLogView(); }
}

function downloadCSV() {
    if (!LOG_DATA || LOG_DATA.length === 0) return;

    // Check Config for Column Visibility (Same logic as updateLogView)
    var cfg = (SIM_DATA && SIM_DATA.config) ? SIM_DATA.config : {};
    var showPounce = (cfg.use_pounce && cfg.rota_position === 'back');
    var showRake = (cfg.use_rake);
    var showRip = (cfg.use_rip);
    var showOW = (cfg.tal_open_wounds > 0);
    var showFF = (cfg.use_ff);

    // 1. Build Headers
    var csvHeaders = [
        "Time", "Event", "Ability", "Result", 
        "DmgNorm", "DmgCrit", "DmgTick", "DmgSpec"
    ];

    // Dynamic Headers based on Config
    if (showPounce) csvHeaders.push("RemPounce");
    if (showRake) csvHeaders.push("RemRake");
    if (showRip) csvHeaders.push("RemRip");
    if (showOW) csvHeaders.push("OW");
    if (showFF) csvHeaders.push("RemFF");

    // Static Middle Headers
    var staticMiddle = ["CP", "AP", "Haste", "Speed", "ArmorPen", "Energy", "E-Change", "OoC", "TF", "BF"];
    csvHeaders = csvHeaders.concat(staticMiddle);

    // Dynamic Buff Headers (from Log Scan)
    LOG_BUFF_KEYS.forEach(key => csvHeaders.push(key));

    csvHeaders.push("Info");

    var csv = csvHeaders.join(",") + "\n";
    
    // 2. Build Rows
    LOG_DATA.forEach(r => {
        var row = [
            r.t.toFixed(3), r.event, r.ability, r.result,
            r.dmgNorm, r.dmgCrit, r.dmgTick, r.dmgSpec
        ];

        // Dynamic Data based on Config
        if (showPounce) row.push(r.remPounce > 0 ? r.remPounce.toFixed(1) : "");
        if (showRake) row.push(r.remRake > 0 ? r.remRake.toFixed(1) : "");
        if (showRip) row.push(r.remRip > 0 ? r.remRip.toFixed(1) : "");
        if (showOW) row.push(r.ow !== "-" ? r.ow : "");
        if (showFF) row.push(r.remFF > 0 ? r.remFF.toFixed(1) : "");

        // Static Middle Data
        row.push(r.cp);
        row.push(r.ap);
        row.push(r.haste.toFixed(1));
        row.push(r.speed.toFixed(2));
        row.push(r.arp);
        row.push(r.energy);
        row.push(r.eChange);
        row.push(r.ooc > 0 ? r.ooc.toFixed(1) : "");
        row.push(r.tf > 0 ? r.tf.toFixed(1) : "");
        
        // BF Static
        var bfVal = (r.activeBuffs && (r.activeBuffs["BF"] || r.activeBuffs["Blood Frenzy"])) ? (r.activeBuffs["BF"] || r.activeBuffs["Blood Frenzy"]).toFixed(1) : "";
        row.push(bfVal);

        // Dynamic Buffs Data
        LOG_BUFF_KEYS.forEach(key => {
            row.push(r.activeBuffs && r.activeBuffs[key] ? r.activeBuffs[key] : "");
        });

        row.push('"' + (r.info || "") + '"');
        csv += row.join(",") + "\n";
    });

    var blob = new Blob([csv], { type: "text/csv" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "feral_sim_log_extended.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ============================================================================
// IMPORT / EXPORT
// ============================================================================

var IS_LOADING = false; // Prevents saving while UI is being populated

function getCurrentConfigFromUI() {
    var cfg = {};
    CONFIG_IDS.forEach(function(id) {
        var el = document.getElementById(id);
        if(el) { 
            if(el.type === 'checkbox') cfg[id] = el.checked ? 1 : 0; 
            else cfg[id] = parseFloat(el.value) || el.value; 
        }
    });
    
    // Deep Copy Objects
    if (typeof GEAR_SELECTION !== 'undefined') {
        cfg.gearSelection = JSON.parse(JSON.stringify(GEAR_SELECTION));
    }
    if (typeof ENCHANT_SELECTION !== 'undefined') {
        cfg.enchantSelection = JSON.parse(JSON.stringify(ENCHANT_SELECTION));
    }
    
    return cfg;
}

function applyConfigToUI(cfg) {
    if(!cfg) return;
    
    // ACTIVATE LOCK: Prevent saveCurrentState from running via Event Listeners
    IS_LOADING = true; 

    try {
        // 1. Apply Simple Values
        for(var id in cfg) {
            if (id === 'gearSelection' || id === 'enchantSelection') continue;
            var el = document.getElementById(id);
            if(el) { 
                if(el.type === 'checkbox') el.checked = (cfg[id] == 1); 
                else el.value = cfg[id]; 
            }
        }

        // 2. Restore Global Variables
        if (cfg.gearSelection) GEAR_SELECTION = JSON.parse(JSON.stringify(cfg.gearSelection));
        else GEAR_SELECTION = {};

        if (cfg.enchantSelection) ENCHANT_SELECTION = JSON.parse(JSON.stringify(cfg.enchantSelection));
        else ENCHANT_SELECTION = {};

        // 3. Refresh UI Components
        if(typeof initGearPlannerUI === 'function') initGearPlannerUI();
        
        // 4. Trigger Calc (Internal math only, no saving)
        if(typeof updatePlayerStats === 'function') updatePlayerStats();
        if(typeof updateEnemyInfo === 'function') updateEnemyInfo();
        if(typeof calculateGearStats === 'function') calculateGearStats();
        
    } catch(e) {
        console.error("Error applying config:", e);
    } finally {
        // RELEASE LOCK
        IS_LOADING = false; 
    }
}

function saveCurrentState() {
    // SECURITY CHECK 1: Do not save if we are currently loading data into the UI
    if (IS_LOADING) return;

    // SECURITY CHECK 2: Do not save if we are in Overview/Comparison Mode
    // (Because inputs might be hidden or reused, leading to data loss)
    var compView = document.getElementById('comparisonView');
    if (compView && !compView.classList.contains('hidden')) return;

    if(SIM_LIST[ACTIVE_SIM_INDEX]) {
        SIM_LIST[ACTIVE_SIM_INDEX].config = getCurrentConfigFromUI();
        var nameInput = document.getElementById('simName');
        if(nameInput) SIM_LIST[ACTIVE_SIM_INDEX].name = nameInput.value;
    }
}




// ============================================================================
// IMPORT / EXPORT LOGIC
// ============================================================================

function packConfig(cfg) {
    console.log("--- PACKING CONFIG ---");
    // 1. Map simple values
    var values = CONFIG_IDS.map(function(id) { return cfg[id]; });

    // 2. Compress Gear
    var gearIds = {};
    var itemCount = 0;
    if (cfg.gearSelection) {
        for (var slot in cfg.gearSelection) {
            var val = cfg.gearSelection[slot];
            var idToSave = (val && typeof val === 'object' && val.id) ? val.id : val;
            
            if (idToSave && idToSave != 0) {
                gearIds[slot] = idToSave;
                itemCount++;
            }
        }
    }
    console.log("Packed Gear IDs found:", itemCount, gearIds);
    
    // 3. Compress Enchants
    var enchantIds = {};
    if (cfg.enchantSelection) {
        for (var slot in cfg.enchantSelection) {
            var val = cfg.enchantSelection[slot];
            var idToSave = (val && typeof val === 'object' && val.id) ? val.id : val;

            if (idToSave && idToSave != 0) {
                enchantIds[slot] = idToSave;
            }
        }
    }
    
    return {
        data: [values, gearIds, enchantIds],
        itemCount: itemCount
    };
}

function unpackConfig(packed) {
    console.log("--- UNPACKING CONFIG ---", packed);
    if (!Array.isArray(packed) || packed.length !== 3 || !Array.isArray(packed[0])) {
        console.warn("Invalid packed format", packed);
        return packed; 
    }

    var values = packed[0];
    var gearIds = packed[1];
    var enchantIds = packed[2];
    var cfg = {};

    // 1. Restore Values
    CONFIG_IDS.forEach(function(id, idx) {
        if (idx < values.length) cfg[id] = values[idx];
    });

    // 2. Restore Gear
    cfg.gearSelection = {};
    if (gearIds) {
        console.log("Restoring Gear IDs:", gearIds);
        for (var slot in gearIds) {
            cfg.gearSelection[slot] = gearIds[slot];
        }
    }

    // 3. Restore Enchants
    cfg.enchantSelection = {};
    if (enchantIds) {
        for (var slot in enchantIds) {
            cfg.enchantSelection[slot] = enchantIds[slot];
        }
    }

    return cfg;
}

function exportSettings() { 
    saveCurrentState(); 
    
    var isOverview = !document.getElementById('comparisonView').classList.contains('hidden');
    var simsToProcess = isOverview ? SIM_LIST : (SIM_LIST[ACTIVE_SIM_INDEX] ? [SIM_LIST[ACTIVE_SIM_INDEX]] : []);

    if (simsToProcess.length === 0) return;

    var dataToExport = simsToProcess.map(function(s) {
        var packResult = packConfig(s.config);
        return { n: s.name, d: packResult.data };
    });

    var jsonStr = JSON.stringify(dataToExport);
    var compressed = LZString.compressToEncodedURIComponent(jsonStr);

    // Use ?cfg= to match 06_main.js logic
    var newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?cfg=' + compressed; 
    
    window.history.pushState({path:newUrl}, '', newUrl); 
    navigator.clipboard.writeText(newUrl).then(function() {
        var msg = isOverview ? "All Sims Link Copied!" : "Current Sim Link Copied!";
        showToast(msg); 
    });
}

function importFromClipboard() {
    var input = prompt("Paste the config string (or full URL) here:");
    if (!input) return;

    var b64 = input;
    // Handle full URLs by splitting at the parameter
    if (input.includes("?cfg=")) { 
        b64 = input.split("?cfg=")[1]; 
    } else if (input.includes("?s=")) { 
        b64 = input.split("?s=")[1]; 
    }
    
    // Remove potential hash or extra parameters if present
    if (b64.includes("&")) b64 = b64.split("&")[0];
    if (b64.includes("#")) b64 = b64.split("#")[0];

    try {
        var json = LZString.decompressFromEncodedURIComponent(b64);
        if (!json) json = LZString.decompressFromBase64(b64); // Fallback

        if (!json) throw new Error("Could not decode string");

        var data = JSON.parse(json);
        if (!Array.isArray(data)) data = [data]; 
        
        data.forEach(function(item) {
            var newId = Date.now() + Math.floor(Math.random() * 1000);
            var sName = item.n || item.name || "Imported Sim";
            var newSim = new SimObject(newId, sName); 
            
            if (item.d) newSim.config = unpackConfig(item.d);
            else newSim.config = item.config || item; 

            SIM_LIST.push(newSim);
        });
        
        renderSidebar();
        switchSim(SIM_LIST.length - 1);
        showToast("Imported successfully!");
        
    } catch (e) {
        console.error(e);
        alert("Invalid Config String or URL!");
    }
}

// Helpers called from HTML directly
function toggleCard(header) {
    var body = header.nextElementSibling;
    if (body.style.display === "none") {
        body.style.display = "block";
        header.querySelector(".toggle-icon").innerText = "▼";
    } else {
        body.style.display = "none";
        header.querySelector(".toggle-icon").innerText = "▶";
    }
}

/**
 * Toggles all checkboxes within a specific container.
 * Handles mutual exclusion logic for "Select All".
 * @param {string} containerId - The ID of the div containing the checkboxes.
 * @param {boolean} state - True to check all, False to uncheck all.
 */
function toggleSection(containerId, state) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var checkboxes = container.querySelectorAll("input[type='checkbox']");
    
    // Set to track which mutual exclusion groups have already been handled in this pass
    var handledGroups = new Set();

    checkboxes.forEach(function(box) {
        if (state) {
            // "Select All" Logic with Mutual Exclusion checks
            var groupClass = null;
            if (box.classList.contains("mut-ex-wep")) groupClass = "mut-ex-wep";
            else if (box.classList.contains("mut-ex-food")) groupClass = "mut-ex-food";
            else if (box.classList.contains("mut-ex-bl")) groupClass = "mut-ex-bl";
            else if (box.classList.contains("mut-ex-juju")) groupClass = "mut-ex-juju";

            if (groupClass) {
                // Only check if we haven't checked an item from this group yet
                if (!handledGroups.has(groupClass)) {
                    box.checked = true;
                    handledGroups.add(groupClass);
                } else {
                    box.checked = false;
                }
            } else {
                // No restriction
                box.checked = true;
            }
        } else {
            // "Select None" - just uncheck everything
            box.checked = false;
        }
    });

    // Update simulation
    if (typeof updatePlayerStats === 'function') updatePlayerStats();
    if (typeof updateEnemyInfo === 'function') updateEnemyInfo();
}


function updateDamageScaling() {
    const tb = document.getElementById("scalingTableBody");
    if (!tb) return;

    // Aktuelle Werte abgreifen
    const ap = getVal("stat_ap");
    const str = getVal("stat_str");
    const agi = getVal("stat_agi");
    
    // Talente (simulieren der Engine-Logik)
    const tNatWep = 1.10; // Natural Weapons 3/3
    const tPredStrikes = 1.20; // Predatory Strikes 3/3
    const tImpShred = getVal("tal_imp_shred") * 0.05;
    const tFeralAggr = getVal("tal_feral_aggression") * 0.03;
    const tOpenWounds = getVal("tal_open_wounds"); // Falls implementiert

    // Basis-Schaden (Tauren/NE Schnitt)
    const baseMin = 72;
    const baseMax = 97;
    const avgBase = (baseMin + baseMax) / 2;
    const apBonus = (ap - 295) / 14;
    const normalDmg = (avgBase + apBonus); // FIX: NatWep erst später anwenden, damit Flat Dmg auch skaliert

    const abilities = [
        {
            name: "Auto Attack",
            formula: `(BaseDmg + (AP-295)/14) * NaturalWeapons`,
            calc: `(${avgBase.toFixed(1)} + ${apBonus.toFixed(1)}) * ${tNatWep}`,
            final: normalDmg * tNatWep
        },
        {
            name: "Shred",
            formula: `((2.25 * NormalDmg + 180) * (1 + ImpShred)) * NaturalWeapons`,
            calc: `((2.25 * ${normalDmg.toFixed(1)} + 180) * ${(1 + tImpShred).toFixed(2)}) * ${tNatWep}`,
            final: ((2.25 * normalDmg + 180) * (1 + tImpShred)) * tNatWep
        },
        {
            name: "Claw",
            formula: `((1.05 * NormalDmg + 115) * PredatoryStrikes) * NaturalWeapons`,
            calc: `((1.05 * ${normalDmg.toFixed(1)} + 115) * ${tPredStrikes}) * ${tNatWep}`,
            final: ((1.05 * normalDmg + 115) * tPredStrikes) * tNatWep
        },
        {
            name: "Rake (Initial)",
            formula: `(61 + 0.115 * AP) * PredatoryStrikes * NaturalWeapons`,
            calc: `(61 + ${(0.115 * ap).toFixed(1)}) * ${tPredStrikes} * ${tNatWep}`,
            final: (61 + 0.115 * ap) * tPredStrikes * tNatWep
        },
        {
            name: "Rake (DoT Total)",
            formula: `(102 + 0.09 * AP) * PredatoryStrikes`,
            calc: `(102 + ${(0.09 * ap).toFixed(1)}) * ${tPredStrikes}`,
            final: (102 + 0.09 * ap) * tPredStrikes
        },
        {
            name: "Ferocious Bite (5 CP, 0 extra Energy)",
            formula: `(70 + 128 * 5 + 0.07 * AP) * (1 + FeralAggr) * NaturalWeapons`,
            calc: `(70 + 640 + ${(0.07 * ap).toFixed(1)}) * ${(1 + tFeralAggr).toFixed(2)} * ${tNatWep}`,
            final: (70 + 128 * 5 + 0.07 * ap) * (1 + tFeralAggr) * tNatWep
        },
        {
            name: "Ferocious Bite (5 CP, Max Energy)",
            formula: `(FB_Base) * (1.005 ^ 65) * Modifiers`,
            calc: `Base * ${Math.pow(1.005, 65).toFixed(2)}`,
            final: ((70 + 128 * 5 + 0.07 * ap) * (1 + tFeralAggr) * tNatWep) * Math.pow(1.005, 65)
        },
        {
            name: "Rip (5 CP, Total)",
            formula: `9 * (47 + 4*31 + 0.04*(AP-295)) * (1 + 0.15*OpenWounds)`,
            calc: `9 * (171 + ${(0.04 * (ap - 295)).toFixed(1)}) * ${(1 + 0.15 * tOpenWounds).toFixed(2)}`,
            final: 9 * (47 + (5 - 1) * 31 + (4 / 100 * (ap - 295))) * (1 + 0.15 * tOpenWounds)
        }
    ];

    tb.innerHTML = "";
    abilities.forEach(a => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="text-left" style="font-weight:600;">${a.name} <i class="formula-help" style="cursor:help; color:var(--text-muted); font-size:0.7rem;" data-formula="${a.formula}">ⓘ</i></td>
            <td class="text-right scaling-formula-preview">${a.calc}</td>
            <td class="text-right" style="color:var(--druid-orange); font-weight:700; font-size:1rem;">${Math.floor(a.final)}</td>
        `;
        
        // Tooltip Event für die Formel
        const icon = tr.querySelector(".formula-help");
        icon.onmouseenter = (e) => {
            const tt = document.getElementById("wowTooltip");
            tt.style.display = "block";
            tt.innerHTML = `<div class="tt-gold">${a.name} Formula:</div><div class="tt-formula">${a.formula}</div>`;
            moveTooltip(e);
        };
        icon.onmousemove = moveTooltip;
        icon.onmouseleave = hideTooltip;
        
        tb.appendChild(tr);
    });
}

// ============================================================================
// ARMORY IMPORT LOGIC (HTML PARSING)
// ============================================================================

function openArmoryModal() {
    var m = document.getElementById("armoryImportModal");
    if (m) m.classList.remove("hidden");
    document.getElementById("armoryName").focus();
}

function closeArmoryModal() {
    var m = document.getElementById("armoryImportModal");
    if (m) m.classList.add("hidden");
    setText("armoryStatus", "");
}

async function runArmoryImport() {
    var name = document.getElementById("armoryName").value.trim();
    var realm = document.getElementById("armoryRealm").value;
    var status = document.getElementById("armoryStatus");
    
    if (!name) {
        status.innerText = "Please enter a character name.";
        status.style.color = "#f44336";
        return;
    }

    status.innerText = "Fetching HTML from turtlecraft.gg...";
    status.style.color = "#aaa";

    var targetUrl = `https://turtlecraft.gg/armory/${realm}/${name}`;
    var proxyUrl = `https://corsproxy.io/?` + encodeURIComponent(targetUrl);

    try {
        var response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error("Network Error or Character not found (Status " + response.status + ")");
        }

        var htmlText = await response.text();
        var parser = new DOMParser();
        var doc = parser.parseFromString(htmlText, 'text/html');

        // Extract Data
        var uniqueFoundItems = extractItemsFromHtml(doc);

        if (uniqueFoundItems.length === 0) {
            throw new Error("No items found on page. Character might be naked or parsing failed.");
        }

        // Apply Data & Get Match Statistics
        var results = applyImportData(uniqueFoundItems, name);

        // Feedback Message
        var msg = "Armory Scan: Found " + uniqueFoundItems.length + " unique Item-IDs.<br>";
        if (results.matched > 0) {
            msg += "<span style='color:#4caf50'>Successfully imported " + results.matched + " items.</span>";
        } else {
            msg += "<span style='color:#f44336'>No items matched your local DB.</span>";
        }
        
        // Hint about missing items
        if (results.matched < uniqueFoundItems.length) {
            msg += "<br><span style='font-size:0.8em; color:#888;'>(" + (uniqueFoundItems.length - results.matched) + " items skipped - not in local DB)</span>";
        }

        status.innerHTML = msg;
        
        // Close modal only if successful match occurred
        if (results.matched > 0) {
            setTimeout(closeArmoryModal, 3000);
        }

    } catch (e) {
        console.error(e);
        status.innerText = "Error: " + e.message;
        status.style.color = "#f44336";
    }
}

/**
 * Scans HTML for item links and returns a UNIQUE list of objects.
 */
function extractItemsFromHtml(doc) {
    var foundMap = new Map(); // Use Map to deduplicate by ItemID immediately

    var links = doc.querySelectorAll('a[href*="item="]');
    links.forEach(function(a) {
        var href = a.getAttribute('href');
        var itemMatch = href.match(/item=(\d+)/);

        if (itemMatch) {
            var iId = parseInt(itemMatch[1]);
            // Only add if not already present 
            if (!foundMap.has(iId) ) {
                foundMap.set(iId, {
                    itemId: iId,

                });
            }
        }
    });

    return Array.from(foundMap.values());
}


function applyImportData(importedItems, race, charName) {
    var matchCount = 0;


    // 2. Clear current gear
    GEAR_SELECTION = {};

    // 3. Map Items
    importedItems.forEach(function(entry) {
        var dbItem = ITEM_ID_MAP[entry.itemId];
        
        // Skip if not in DB
        if (!dbItem) {           
            return;
        }

        var slotToAssign = null;
        var slotKey = dbItem.slot; // e.g. "Head", "Two-Hand", "Trinket"

        // Handle Multi-Slots & Mapping Logic
        if (slotKey === "Finger" || slotKey === "Ring") {
            if (!GEAR_SELECTION["Finger 1"]) slotToAssign = "Finger 1";
            else slotToAssign = "Finger 2";
        } 
        else if (slotKey === "Trinket") {
            if (!GEAR_SELECTION["Trinket 1"]) slotToAssign = "Trinket 1";
            else slotToAssign = "Trinket 2";
        } 
        // FIXED: Added "Two-Hand" and "Mainhand" for Staves/Maces/Polearms
        else if (slotKey === "One-hand" ||  slotKey === "Two-hand" ) {
             slotToAssign = "Main Hand"; 
        } 
        else if (slotKey === "Held In Off-Hand") {
             slotToAssign = "Off Hand";
        } 
        else {
            // Direct Match (Head, Chest, Hands, etc.)
            slotToAssign = slotKey;
        }

        if (slotToAssign) {
            GEAR_SELECTION[slotToAssign] = entry.itemId;
            matchCount++;
        }
    });

    // 4. Update UI
    initGearPlannerUI();
    saveCurrentState();
    updatePlayerStats();
    updateEnemyInfo();
    showToast("Imported data for " + charName);

    return { matched: matchCount };
}

function closeWarningModal() {
    var m = document.getElementById("warningModal");
    if (m) m.classList.add("hidden");
}


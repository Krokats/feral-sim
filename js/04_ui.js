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
    "use_tf": "Tiger's Fury. Increases physical damage but costs energy. Best used during low energy.",
    "tf_after_fb": "If enabled, casting Ferocious Bite will force an immediate refresh of Tiger's Fury (once you have 30 Energy), even if the TF buff is still active.",
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
        if (sim.name && sim.name.startsWith("Sim ")) {
            // Default numbering
        } else if (sim.name) {
            label = sim.name.substring(0, 2).toUpperCase();
        }

        btn.innerText = (idx + 1);
        btn.title = sim.name || "Sim " + (idx + 1);
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

    helpIcon.onmouseenter = function (e) {
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
        newConfig = getCurrentConfigFromUI(); // Grab current UI inputs
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
    if (compView) compView.classList.add("hidden");
    if (singleView) singleView.classList.remove("hidden");

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
            if (r.minDps) dpsMin = Math.floor(r.minDps);
            if (r.maxDps) dpsMax = Math.floor(r.maxDps);
        }

        // Build Row (Optimized for Feral Cat 1.18)
        var html = `
            <td><b style="color:var(--druid-orange); cursor:pointer;" onclick="switchSim(${idx})">${sim.name}</b></td>
            <td style="text-align:center;">${c.simTime || 60}s</td>
            <td style="text-align:center;">${c.iterations || 1000}</td>
            <td style="text-align:center;">${getSavedStat(sim, 'stat_ap')}</td>
            <td style="text-align:center;">${getSavedStat(sim, 'stat_crit')}%</td>
            <td style="text-align:center;">${getSavedStat(sim, 'stat_hit')}%</td>
            <td style="text-align:center;">${getSavedStat(sim, 'stat_haste')}%</td>
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
        var addLi = function (text) {
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
        var addGear = function (text) {
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
        if (c.set_stormshroud_4p) addGear("Stormshroud (4pc)");
        else if (c.set_stormshroud_3p) addGear("Stormshroud (3pc)");
        if (c.hasGiftOfFerocity) addGear("Gift of Ferocity");
    }

    if (ulTrink) {
        ulTrink.innerHTML = "";
        var addTrink = function (text) {
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
        if (c.t_emberstone) addTrink("Molten Emberstone");
        if (c.t_zhm) addTrink("Zandalarian Hero Medallion");
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
    if (c.use_tf) parts.push(c.tf_after_fb ? "TF(FB)" : "TF");

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
    if (c.set_stormshroud_3p && !c.set_stormshroud_4p) sets += "Storm-3 ";
    if (c.set_stormshroud_4p) sets += "Storm-4 ";

    // Important Trinkets
    if (c.t_slayer) sets += "Slayer ";
    if (c.t_spider) sets += "Spider ";
    if (c.t_jomgabbar) sets += "Jom ";
    if (c.t_swarmguard) sets += "Swarm ";

    return count + " Items " + (sets ? "| " + sets : "");
}

function runAllSims() {
    showProgress("Initializing Batch Run...");
    var idx = 0;
    var total = SIM_LIST.length;

    function next() {
        // Abbruchbedingung: Wenn alle durch sind
        if (idx >= total) {
            hideProgress();
            renderComparisonTable();
            return;
        }

        var sim = SIM_LIST[idx];

        try {
            // 1. Daten in das UI laden (damit getSimInputs korrekte Werte greift)
            loadSimDataToUI(sim);

            // 2. Visuelles Feedback VOR der Berechnung aktualisieren
            var progressEl = document.getElementById("progressText");
            if (progressEl) progressEl.innerText = "Simulating: " + (sim.name || ("Sim " + (idx + 1)));

            // 3. Berechnung in setTimeout verlagern, damit der Browser rendern kann
            setTimeout(function () {
                var all = [];
                // Korrekte Iterationszahl aus der Config holen (Fallback 1000)
                var iterations = sim.config.simCount || 1000;
                var cfg = getSimInputs(); 

                // Blocking Loop (Synchron für EINE Simulation)
                for (var i = 0; i < iterations; i++) {
                    // Seed-Varianz sicherstellen
                    cfg.seed = (cfg.seed || Math.floor(Math.random() * 0xFFFFFFFF)) + i;
                    all.push(runCoreSimulation(cfg));
                }

                // Ergebnisse aggregieren und speichern
                sim.results = aggregateResults(all);

                // Progressbar aktualisieren (Nach Abschluss dieser Sim)
                var pct = Math.floor(((idx + 1) / total) * 100);
                updateProgress(pct);

                // Nächsten Schritt einleiten (mit kleiner Pause für UI Repaint)
                idx++;
                setTimeout(next, 20); 

            }, 20); // Kurze Verzögerung vor Start, damit Text-Update sichtbar wird

        } catch (e) {
            console.error("Error in Sim " + idx, e);
            idx++;
            setTimeout(next, 20);
        }
    }

    // Starten
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
                else if (el.classList.contains("mut-ex-potion")) groupClass = "mut-ex-potion";

                if (groupClass) {
                    document.querySelectorAll("." + groupClass).forEach(function (sib) {
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
    document.addEventListener("keydown", function (e) {
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

            label.onmouseenter = function (e) {
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
    if(typeof initRotationBuilder === 'function') initRotationBuilder();
    if(typeof renderTalentTree === 'function') renderTalentTree();

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
        if (rowRip) { rowRip.style.opacity = "1"; rowRip.style.pointerEvents = "auto"; }
        if (chkRip) chkRip.disabled = false;

        if (lblRake) { lblRake.style.opacity = "1"; lblRake.style.pointerEvents = "auto"; }
        if (chkRake) chkRake.disabled = false;
    } else {
        // Disable
        if (rowRip) { rowRip.style.opacity = "0.5"; rowRip.style.pointerEvents = "none"; }
        if (chkRip) chkRip.disabled = true;

        if (lblRake) { lblRake.style.opacity = "0.5"; lblRake.style.pointerEvents = "none"; }
        if (chkRake) chkRake.disabled = true;
    }

    // 2. Position Constraint: Shred
    var lblShred = document.getElementById("lbl_shred");
    var lblShredOoCOnly = document.getElementById("lbl_shred_ooc_only");
    var chkShred = document.getElementById("use_shred");
    var chbShredOoCOnly = document.getElementById("shred_ooc_only");

    if (pos === "back") {
        if (lblShred) { lblShred.style.opacity = "1"; lblShred.style.pointerEvents = "auto"; }
        if (chkShred) chkShred.disabled = false;
        if (lblShredOoCOnly) { lblShredOoCOnly.style.opacity = "1"; lblShredOoCOnly.style.pointerEvents = "auto"; }
        if (chbShredOoCOnly) chbShredOoCOnly.disabled = false;
    } else {
        if (lblShred) { lblShred.style.opacity = "0.5"; lblShred.style.pointerEvents = "none"; }
        if (chkShred) chkShred.disabled = true;
        if (lblShredOoCOnly) { lblShredOoCOnly.style.opacity = "0.5"; lblShredOoCOnly.style.pointerEvents = "none"; }
        if (chbShredOoCOnly) chbShredOoCOnly.disabled = true;
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
        if (chkOverTF) chkOverTF.disabled = false;
        if (inpOverTFDur) inpOverTFDur.disabled = false;
        if (parentToggle) { parentToggle.style.opacity = "1"; parentToggle.style.pointerEvents = "auto"; }
        if (parentDur) { parentDur.style.opacity = "1"; parentDur.style.pointerEvents = "auto"; }
    } else {
        if (chkOverTF) chkOverTF.disabled = true;
        if (inpOverTFDur) inpOverTFDur.disabled = true;
        if (parentToggle) { parentToggle.style.opacity = "0.5"; parentToggle.style.pointerEvents = "none"; }
        if (parentDur) { parentDur.style.opacity = "0.5"; parentDur.style.pointerEvents = "none"; }
    }

    // --- NEU: TF after FB Constraint ---
    var useFB = getVal("use_fb") === 1;
    var chkTFafterFB = document.getElementById("tf_after_fb");
    var lblTFafterFB = document.getElementById("lbl_tf_after_fb");

    if (useTF && useFB) {
        if (chkTFafterFB) chkTFafterFB.disabled = false;
        if (lblTFafterFB) { lblTFafterFB.style.opacity = "1"; lblTFafterFB.style.pointerEvents = "auto"; }
    } else {
        if (chkTFafterFB) { chkTFafterFB.disabled = true; chkTFafterFB.checked = false; }
        if (lblTFafterFB) { lblTFafterFB.style.opacity = "0.5"; lblTFafterFB.style.pointerEvents = "none"; }
    }

    // --- NEU: Pounce Constraint (Requires Behind) ---
    
    // --- NEU: Pounce Constraint (Requires Behind) ---
    var lblPounce = document.getElementById("use_pounce") ? document.getElementById("use_pounce").parentElement : null;
    var chkPounce = document.getElementById("use_pounce");

    if (pos === "back") {
        if (lblPounce) { lblPounce.style.opacity = "1"; lblPounce.style.pointerEvents = "auto"; }
        if (chkPounce) chkPounce.disabled = false;
    } else {
        if (lblPounce) { lblPounce.style.opacity = "0.5"; lblPounce.style.pointerEvents = "none"; }
        if (chkPounce) { chkPounce.disabled = true; chkPounce.checked = false; }
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
    var constant = (467.5 * EnemyLevel) - 22167.5;
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
        if (isNaN(visWidth)) visWidth = 0;
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

    if (typeof CUSTOM_ROTATION !== 'undefined' && CUSTOM_ROTATION.steps && CUSTOM_ROTATION.steps.length > 0) {
        CUSTOM_ROTATION.steps.forEach((step, idx) => {
            var li = document.createElement("li");
            li.style.display = "flex";
            li.style.alignItems = "center";
            li.style.gap = "6px";
            li.style.marginBottom = "4px";
            
            var def = ROTATION_SKILLS.find(s => s.id === step.skill);
            var styleStr = step.disabled ? "text-decoration:line-through; opacity:0.5;" : "";
            
            if(def) {
                li.innerHTML = `<img src="https://wow.zamimg.com/images/wow/icons/large/${def.icon}.jpg" class="rb-skill-icon" style="width:14px; height:14px;" alt=""> <span style="${styleStr}">${idx + 1}. ${def.name}</span>`;
            } else {
                li.innerText = (idx + 1) + ". " + step.skill;
            }
            list.appendChild(li);
        });
    } else {
        var li = document.createElement("li");
        li.innerText = "No custom rotation set.";
        li.style.color = "#777";
        list.appendChild(li);
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

    // SICHERSTELLUNG: Ergebnisse im globalen Objekt ablegen, bevor UI-Logik startet
    if (SIM_LIST[ACTIVE_SIM_INDEX]) {
        SIM_LIST[ACTIVE_SIM_INDEX].results = sim.results;
    }

    var data = sim.results; 
    var isAvg = true;

    if (CURRENT_RESULT_VIEW === 'min' && sim.results.minRun) {
        data = sim.results.minRun;
        isAvg = false;
    } else if (CURRENT_RESULT_VIEW === 'max' && sim.results.maxRun) {
        data = sim.results.maxRun;
        isAvg = false;
    } else if (CURRENT_RESULT_VIEW === 'avg' && sim.results.avgRun) {
        // Nutze den Median-Run für die Durchschnittsansicht
        data = sim.results.avgRun;
        isAvg = true;
    }

    var r = data;
    var avgR = sim.results; 

    var resDiv = document.getElementById("simResultsArea");
    if (resDiv) resDiv.classList.remove("hidden");

    // Chart rendern (avgR enthält die Verteilungsdaten)
    renderDPSChart(avgR);

    var resDiv = document.getElementById("simResultsArea");
    if (resDiv) resDiv.classList.remove("hidden");

    // Top Stats based on current view
    setText("resDps", Math.floor(r.dps));

    // UPDATE BUTTONS with VALUES
    var btnMin = document.getElementById("btnViewMin");
    if (btnMin && avgR.minDps) {
        btnMin.innerHTML = `<span class="res-btn-label">Min. DPS (</span><span class="res-btn-val">${Math.floor(avgR.minDps)})</span>`;
    }

    var btnAvg = document.getElementById("btnViewAvg");
    if (btnAvg && avgR.dps) {
        btnAvg.innerHTML = `<span class="res-btn-label">Avg. DPS (</span><span class="res-btn-val">${Math.floor(avgR.dps)})</span>`;
    }

    var btnMax = document.getElementById("btnViewMax");
    if (btnMax && avgR.maxDps) {
        btnMax.innerHTML = `<span class="res-btn-label">Max. DPS (</span><span class="res-btn-val">${Math.floor(avgR.maxDps)})</span>`;
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

    // NEU: Stat Weights Container aktualisieren
    var weightContainer = document.getElementById("weightResults");
    if (weightContainer) {
        if (sim.statWeightsHTML) {
            // Wenn die Simulation Stat Weights hat, zeige sie an
            weightContainer.innerHTML = sim.statWeightsHTML;
            weightContainer.classList.remove("hidden");
        } else {
            // Wenn nicht, leere den Container und verstecke ihn
            weightContainer.innerHTML = "";
            weightContainer.classList.add("hidden");
        }
    }

    var logSec = document.getElementById("combatLogSection");
    if (logSec) {
        // Immer anzeigen, da wir nun für alle 3 Ansichten (Min/Avg/Max) reale Runs haben
        logSec.classList.remove("hidden");
        renderLogTable(r.log);
    }

    // Aktualisiert die Drag-and-Drop Liste, um die neuen Badge-Werte (avgRun.counts) anzuzeigen
    if (typeof renderRotationList === 'function') renderRotationList();
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
    if (a.includes("rip") || a.includes("rake")) return "row-bleed";
    if (a.includes("shred") || a.includes("claw") || a.includes("bite") || a.includes("auto") || a.includes("attack")) return "row-physical";
    if (a.includes("maelstrom") || a.includes("emerald") || a.includes("nature") || a.includes("venom")) return "row-nature";
    if (a.includes("coil") || a.includes("fire")) return "row-fire";
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

        // Crit % (Parries ebenfalls abziehen, falls sie von vorne angreifen)
        var hits = count - (r.missCounts[s.n] || 0) - (r.dodgeCounts[s.n] || 0) - (r.parryCounts ? (r.parryCounts[s.n] || 0) : 0);
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
var FILTERED_LOG_DATA = []; // NEU
var LOG_PAGE = 1;
const LOG_PER_PAGE = 50;

function renderLogTable(log) {
    LOG_DATA = log || [];
    FILTERED_LOG_DATA = [...LOG_DATA]; // NEU
    LOG_PAGE = 1;

    // NEU: Reset des Suchfelds bei neuer Sim
    var logSearch = document.getElementById("logSearchInput");
    if(logSearch) logSearch.value = "";

    var allKeys = new Set();
    LOG_DATA.forEach(e => {
        if (e.activeBuffs) {
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

function filterLogData() {
    var searchInput = document.getElementById("logSearchInput");
    if (searchInput && searchInput.value.trim() !== "") {
        var term = searchInput.value.toLowerCase();
        FILTERED_LOG_DATA = LOG_DATA.filter(e => {
            return (e.event && e.event.toLowerCase().includes(term)) ||
                   (e.ability && e.ability.toLowerCase().includes(term)) ||
                   (e.result && e.result.toLowerCase().includes(term)) ||
                   (e.info && e.info.toLowerCase().includes(term));
        });
    } else {
        FILTERED_LOG_DATA = [...LOG_DATA];
    }
    LOG_PAGE = 1;
    updateLogView();
}

function updateLogView() {
    // Check Config for Column Visibility
    var cfg = (SIM_DATA && SIM_DATA.config) ? SIM_DATA.config : {};
    var rota = (cfg.custom_rotation && cfg.custom_rotation.steps) ? cfg.custom_rotation.steps : [];

    // Logic: Check if skills exist in the new Custom Rotation
    var showPounce = rota.some(s => s.skill === "Pounce");
    var showRake = rota.some(s => s.skill === "Rake");
    var showRip = rota.some(s => s.skill === "Rip");
    var showOW = (cfg.tal_open_wounds > 0);
    var showFF = rota.some(s => s.skill === "Faerie Fire") || cfg.debuff_ff;

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
    
    // ÄNDERUNG: Slice von FILTERED_LOG_DATA anstatt LOG_DATA
    var slice = FILTERED_LOG_DATA.slice(start, end);

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

    setText("logPageLabel", LOG_PAGE + " / " + Math.max(1, Math.ceil(FILTERED_LOG_DATA.length / LOG_PER_PAGE)));
}

function nextLogPage() {
    // ÄNDERUNG: Auf FILTERED_LOG_DATA prüfen
    if (LOG_PAGE * LOG_PER_PAGE < FILTERED_LOG_DATA.length) { LOG_PAGE++; updateLogView(); }
}

function prevLogPage() {
    if (LOG_PAGE > 1) { LOG_PAGE--; updateLogView(); }
}

function downloadCSV() {
    if (!FILTERED_LOG_DATA || FILTERED_LOG_DATA.length === 0) return;

    // Check Config for Column Visibility (Same logic as updateLogView)
    var cfg = (SIM_DATA && SIM_DATA.config) ? SIM_DATA.config : {};
    var rota = (cfg.custom_rotation && cfg.custom_rotation.steps) ? cfg.custom_rotation.steps : [];
    
    var showPounce = rota.some(s => s.skill === "Pounce");
    var showRake = rota.some(s => s.skill === "Rake");
    var showRip = rota.some(s => s.skill === "Rip");
    var showOW = (cfg.tal_open_wounds > 0);
    var showFF = rota.some(s => s.skill === "Faerie Fire") || cfg.debuff_ff;

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
    FILTERED_LOG_DATA.forEach(r => {
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
    CONFIG_IDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
            if (el.type === 'checkbox') cfg[id] = el.checked ? 1 : 0;
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

    // Rotation Builder Status speichern
    if (typeof CUSTOM_ROTATION !== 'undefined') {
        cfg.custom_rotation = JSON.parse(JSON.stringify(CUSTOM_ROTATION));
    }

    // Talente speichern
    if (typeof TALENT_CONFIG !== 'undefined') {
        cfg.talents = JSON.parse(JSON.stringify(TALENT_CONFIG));
    }

    return cfg;
}

function applyConfigToUI(cfg) {
    if (!cfg) return;

    // ACTIVATE LOCK: Prevent saveCurrentState from running via Event Listeners
    IS_LOADING = true;

    try {
        // 1. Apply Simple Values
        for (var id in cfg) {
            if (id === 'gearSelection' || id === 'enchantSelection') continue;
            var el = document.getElementById(id);
            if (el) {
                if (el.type === 'checkbox') el.checked = (cfg[id] == 1);
                else el.value = cfg[id];
            }
        }

        // 2. Restore Global Variables
        if (cfg.gearSelection) GEAR_SELECTION = JSON.parse(JSON.stringify(cfg.gearSelection));
        else GEAR_SELECTION = {};

        if (cfg.enchantSelection) ENCHANT_SELECTION = JSON.parse(JSON.stringify(cfg.enchantSelection));
        else ENCHANT_SELECTION = {};

        // Restore Talente
        if (cfg.talents) {
            TALENT_CONFIG = JSON.parse(JSON.stringify(cfg.talents));
        } else {
            // Fallback auf Standard, falls es ein alter gespeicherter Link ohne Talente ist
            if (typeof TALENT_PRESETS !== 'undefined' && TALENT_PRESETS["Feral DPS (11/35/5)"]) {
                TALENT_CONFIG = JSON.parse(JSON.stringify(TALENT_PRESETS["Feral DPS (11/35/5)"]));
            }
        }

        // Restore Custom Rotation oder Fallback auf Standard
        if (cfg.custom_rotation && typeof cfg.custom_rotation === 'object') {
            // Egal ob es alte Array-Daten oder das neue Objekt-Format ist, wir laden es
            CUSTOM_ROTATION = JSON.parse(JSON.stringify(cfg.custom_rotation));
            // Fallback, falls steps fehlen
            if (!CUSTOM_ROTATION.steps) CUSTOM_ROTATION.steps = [];
        } else {
            // Wenn keine Custom Rotation im Speicher ist (z.B. bei alten Links), lade Standard
            if (typeof PRESET_ROTATIONS !== 'undefined' && PRESET_ROTATIONS["standard bleed"]) {
                CUSTOM_ROTATION = JSON.parse(JSON.stringify(PRESET_ROTATIONS["standard bleed"]));
            } else {
                CUSTOM_ROTATION = { name: "", desc: "", steps: [] };
            }
        }
        
        if (typeof renderRotationList === 'function') renderRotationList();

        // 3. Refresh UI Components
        if (typeof initGearPlannerUI === 'function') initGearPlannerUI();

        // 4. Trigger Calc (Internal math only, no saving)
        if (typeof updatePlayerStats === 'function') updatePlayerStats();
        if (typeof updateEnemyInfo === 'function') updateEnemyInfo();
        if (typeof calculateGearStats === 'function') calculateGearStats();
        if (typeof renderTalentTree === 'function') renderTalentTree();
        if (typeof recalcItemScores === 'function') recalcItemScores();
        
        // NEU: Visuelle Constraints für geladene Rotationseinstellungen aktualisieren
        if (typeof updateRotationConstraints === 'function') updateRotationConstraints();

    } catch (e) {
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
    var compView = document.getElementById('comparisonView');
    if (compView && !compView.classList.contains('hidden')) return;

    if (SIM_LIST[ACTIVE_SIM_INDEX]) {
        SIM_LIST[ACTIVE_SIM_INDEX].config = getCurrentConfigFromUI();
        
        // NEU: Root-Eigenschaften des Simulation-Objekts synchronisieren
        if (typeof GEAR_SELECTION !== 'undefined') {
            SIM_LIST[ACTIVE_SIM_INDEX].gear = JSON.parse(JSON.stringify(GEAR_SELECTION));
        }
        if (typeof ENCHANT_SELECTION !== 'undefined') {
            SIM_LIST[ACTIVE_SIM_INDEX].enchants = JSON.parse(JSON.stringify(ENCHANT_SELECTION));
        }

        var nameInput = document.getElementById('simName');
        if (nameInput) SIM_LIST[ACTIVE_SIM_INDEX].name = nameInput.value;
    }
}

function packConfig(cfg) {
    // 1. Map simple values
    var values = CONFIG_IDS.map(function (id) { return cfg[id]; });

    // 2. Compress Gear
    var gearIds = {};
    var itemCount = 0;
    if (cfg.gearSelection) {
        for (var slot in cfg.gearSelection) {
            var val = cfg.gearSelection[slot];
            var idToSave = (val && typeof val === 'object' && val.id) ? val.id : val;
            if (idToSave && idToSave != 0) { gearIds[slot] = idToSave; itemCount++; }
        }
    }

    // 3. Compress Enchants
    var enchantIds = {};
    if (cfg.enchantSelection) {
        for (var slot in cfg.enchantSelection) {
            var val = cfg.enchantSelection[slot];
            var idToSave = (val && typeof val === 'object' && val.id) ? val.id : val;
            if (idToSave && idToSave != 0) { enchantIds[slot] = idToSave; }
        }
    }

    // 4. Compress Rotation to tiny keys (n = name, d = desc, s = steps)
    var rotaPack = null;
    if (cfg.custom_rotation) {
        rotaPack = {
            n: cfg.custom_rotation.name || "",
            d: cfg.custom_rotation.desc || "",
            s: cfg.custom_rotation.steps || []
        };
    }
    var talPack = cfg.talents || {};

    return {
        data: [values, gearIds, enchantIds, rotaPack, talPack],
        itemCount: itemCount
    };
}

function unpackConfig(packed) {
    if (!Array.isArray(packed) || packed.length < 3 || !Array.isArray(packed[0])) {
        return packed;
    }

    var values = packed[0];
    var gearIds = packed[1];
    var enchantIds = packed[2];
    var cfg = {};

    // SICHERHEITSWARNUNG für alte Links, deren Feld-Anzahl nicht mehr stimmt
    if (values.length !== CONFIG_IDS.length) {
        setTimeout(() => showToast("⚠️ Warning: Loaded link is from a different version. Some settings might be misplaced!"), 1500);
    }

    // 1. Restore Values
    CONFIG_IDS.forEach(function (id, idx) {
        if (idx < values.length) cfg[id] = values[idx];
    });

    // 2. Restore Gear
    cfg.gearSelection = {};
    if (gearIds) {
        for (var slot in gearIds) cfg.gearSelection[slot] = gearIds[slot];
    }

    // 3. Restore Enchants
    cfg.enchantSelection = {};
    if (enchantIds) {
        for (var slot in enchantIds) cfg.enchantSelection[slot] = enchantIds[slot];
    }

    // 4. Restore Custom Rotation (Array Index 3)
    if (packed.length > 3 && packed[3]) {
        var p3 = packed[3];
        if (Array.isArray(p3)) {
            // Fallback: Wenn es ein altes, reines Array ist, packen wir es in das neue Objekt
            cfg.custom_rotation = { name: "Imported Custom", desc: "", steps: p3 };
        } else {
            // Neues Format entpacken
            cfg.custom_rotation = { name: p3.n || "", desc: p3.d || "", steps: p3.s || [] };
        }
    }

    if (packed.length > 4 && packed[4]) {
        cfg.talents = packed[4];
    }

    return cfg;
}

function exportSettings() {
    saveCurrentState();

    var isOverview = !document.getElementById('comparisonView').classList.contains('hidden');
    var simsToProcess = isOverview ? SIM_LIST : (SIM_LIST[ACTIVE_SIM_INDEX] ? [SIM_LIST[ACTIVE_SIM_INDEX]] : []);

    if (simsToProcess.length === 0) return;

    var dataToExport = simsToProcess.map(function (s) {
        var packResult = packConfig(s.config);
        return { n: s.name, d: packResult.data };
    });

    var jsonStr = JSON.stringify(dataToExport);
    var compressed = LZString.compressToEncodedURIComponent(jsonStr);

    // Use ?cfg= to match 06_main.js logic
    var newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?cfg=' + compressed;

    window.history.pushState({ path: newUrl }, '', newUrl);
    navigator.clipboard.writeText(newUrl).then(function () {
        var msg = isOverview ? "All Sims Link Copied!" : "Current Sim Link Copied!";
        showToast(msg);
    });
}

// ============================================================================
// IMPORT CONFIG MODAL LOGIC (NEW)
// ============================================================================

// 1. Öffnet das Import-Modal anstelle des Browser-Prompts
function importFromClipboard() {
    var modal = document.getElementById('importConfigModal');
    var textarea = document.getElementById('importConfigInput');
    if (modal && textarea) {
        textarea.value = ""; // Textarea leeren
        modal.classList.remove('hidden');
        textarea.focus();
    }
}

function closeImportConfigModal() {
    var modal = document.getElementById('importConfigModal');
    if (modal) modal.classList.add('hidden');
}


function confirmImportConfig() {
    var textarea = document.getElementById('importConfigInput');
    if (!textarea) return;
    var input = textarea.value.trim();
    
    if (!input) {
        showToast("Please paste a valid config string.");
        return;
    }

    if (ITEM_DB.length === 0) {
        alert("Database not loaded yet. Please wait a moment.");
        return;
    }

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

        data.forEach(function (item) {
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
    closeImportConfigModal();
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

    checkboxes.forEach(function (box) {
        if (state) {
            // "Select All" Logic with Mutual Exclusion checks
            var groupClass = null;
            if (box.classList.contains("mut-ex-wep")) groupClass = "mut-ex-wep";
            else if (box.classList.contains("mut-ex-food")) groupClass = "mut-ex-food";
            else if (box.classList.contains("mut-ex-bl")) groupClass = "mut-ex-bl";
            else if (box.classList.contains("mut-ex-juju")) groupClass = "mut-ex-juju";
            else if (box.classList.contains("mut-ex-potion")) groupClass = "mut-ex-potion";

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

    // Aktuelle Werte abgreifen (aus den DOM Inputs)
    const elAp = document.getElementById("stat_ap");
    const ap = elAp ? (parseFloat(elAp.value) || 0) : 0;

    // Helper: Lade Punkte aus dem globalen Talentobjekt
    const getTal = (id) => (typeof TALENT_CONFIG !== 'undefined' ? (TALENT_CONFIG[id] || 0) : 0);

    const ptsNatWep = getTal("naturalWeapons");
    const tNatWep = ptsNatWep === 3 ? 1.10 : (1 + ptsNatWep * 0.0333); // 10% max

    const ptsPred = getTal("predatoryStrikes");
    const tPredStrikes = ptsPred === 3 ? 1.20 : (1 + ptsPred * 0.07); // 20% max

    const tImpShred = getTal("impShred") * 0.05;
    const tFeralAggr = getTal("feralAggression") * 0.03;
    const tOpenWounds = getTal("openWounds");

    // Basis-Schaden (Tauren/NE Schnitt)
    const baseMin = 72;
    const baseMax = 97;
    const avgBase = (baseMin + baseMax) / 2;
    const apBonus = (ap - 295) / 14;
    const normalDmg = (avgBase + apBonus);

    const abilities = [
        {
            name: "Normal Damage",
            formula: `BaseDmg + (AP-295)/14`,
            calc: `${avgBase.toFixed(1)} + ${apBonus.toFixed(1)}`,
            final: normalDmg
        },
        {
            name: "Auto Attack",
            formula: `NormalDmg * NaturalWeapons`,
            calc: `${normalDmg.toFixed(1)} * ${tNatWep}`,
            final: normalDmg * tNatWep
        },
        {
            name: "Claw, Rank 5 (0 Bleeds)",
            formula: `(1.05 * NormalDmg + 115) * PredatoryStrikes * NaturalWeapons`,
            calc: `(1.05 * ${normalDmg.toFixed(1)} + 115) * ${tPredStrikes} * ${tNatWep}`,
            final: (1.05 * normalDmg + 115) * tPredStrikes * tNatWep
        },
        {
            name: "Claw, Rank 5 (3 Bleeds)",
            formula: `(1.05 * NormalDmg + 115) * PredatoryStrikes * OpenWounds * NaturalWeapons`,
            calc: `(1.05 * ${normalDmg.toFixed(1)} + 115) * ${tPredStrikes} * ${1.3} * ${tNatWep}`,
            final: (1.05 * normalDmg + 115) * tPredStrikes * 1.3 * tNatWep
        },
        {
            name: "Shred, Rank 5",
            formula: `(2.25 * NormalDmg + 180) * (1 + ImpShred) * NaturalWeapons`,
            calc: `(2.25 * ${normalDmg.toFixed(1)} + 180) * ${(1 + tImpShred).toFixed(2)} * ${tNatWep}`,
            final: (2.25 * normalDmg + 180) * (1 + tImpShred) * tNatWep
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
        },
        {
        name: "Ravage",
            formula: `(3.5 * NormalDmg + 343) * NaturalWeapons`,
            calc: `(3.5 * ${normalDmg.toFixed(1)} + 343) * ${tNatWep}`,
            final: (3.5 * normalDmg + 343) * tNatWep
        }
    ];

    tb.innerHTML = "";
    abilities.forEach(a => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="text-left" style="font-weight:600;">${a.name} <i class="formula-help" style="cursor:help; color:var(--text-muted); font-size:0.7rem;" data-formula="${a.formula}">ⓘ</i></td>
            <td class="text-left scaling-formula-preview">${a.formula}</td>
            <td class="text-right scaling-formula-preview">${a.calc}</td>
            <td class="text-right" style="color:var(--druid-orange); font-weight:700; font-size:1rem;">${a.final.toFixed(1)}</td>
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

// ============================================================================
// ARMORY IMPORT LOGIC (OCTO CHRONICLE API)
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

    status.innerText = "Fetching data from Octo Chronicle...";
    status.style.color = "#aaa";

    // Ziel-API von Octo Chronicle
    // Ziel-API von Octo Chronicle
    var targetUrl = `https://octo.chronicleclassic.com/api/v1/armory/${realm}/${name}`;
    var proxyUrl = `https://chronicle-proxy.krokat.workers.dev/?url=${encodeURIComponent(targetUrl)}`;
    try {
        var response = await fetch(proxyUrl);

        if (!response.ok) {
            throw new Error("Network Error or Character not found (Status " + response.status + ")");
        }

        var jsonData = await response.json();

        if (jsonData.error) {
            throw new Error(jsonData.error);
        }

        // 1. Rasse extrahieren und für das Format der Simulation (NightElf statt Night Elf) anpassen
        var raceString = jsonData.race || "Tauren";
        if (raceString === "Night Elf") raceString = "NightElf"; 

        // 2. Items & Enchants extrahieren
        var importedItems = [];
        if (jsonData.gear && Array.isArray(jsonData.gear)) {
            jsonData.gear.forEach(function(item) {
                // Item ID 0 (leerer Slot) überspringen
                if (item.item_id && item.item_id !== 0) {
                    importedItems.push({
                        itemId: item.item_id,
                        effectId: item.enchant_id || 0 // enchant_id direkt aus der API übernehmen
                    });
                }
            });
        }

        if (importedItems.length === 0) {
            throw new Error("No items found. Character might be naked or parsing failed.");
        }

        // 3. Daten anwenden & Match-Statistik erhalten (Die existierende Funktion applyImportData übernimmt das Mapping)
        var results = applyImportData(importedItems, raceString, name);
        
        // Feedback Message aufbauen
        var msg = "Armory Scan: Found " + importedItems.length + " Items.<br>";

        if (results.matched > 0) {
            msg += "<span style='color:#4caf50'>Successfully imported " + results.matched + " items.</span>";
        } else {
            msg += "<span style='color:#f44336'>No items matched your local DB.</span>";
        }

        if (results.matched < importedItems.length) {
            msg += "<br><span style='font-size:0.8em; color:#888;'>(" + (importedItems.length - results.matched) + " items skipped - not in local DB)</span>";
        }

        status.innerHTML = msg;
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
 * Applies extracted data to the Simulation state
 */
function applyImportData(importedItems, race, charName) {
    var matchCount = 0;

    // 1. NEU: Rasse im UI setzen, falls erkannt
    if (race) {
        var raceSel = document.getElementById('char_race');
        if (raceSel) {
            raceSel.value = race;
        }
    }

    // 2. Clear current gear & enchants
    GEAR_SELECTION = {};
    ENCHANT_SELECTION = {}; // NEU

    // 3. Map Items & Enchants
    importedItems.forEach(function (entry) {
        var dbItem = ITEM_ID_MAP[entry.itemId];

        // Skip if not in DB
        if (!dbItem) return;

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
        else if (slotKey === "One-hand" || slotKey === "Two-hand" || slotKey === "Mainhand" || slotKey === "Weapon") {
            slotToAssign = "Main Hand";
        }
        else if (slotKey === "Held In Off-Hand" || slotKey === "Shield") {
            slotToAssign = "Off Hand";
        }
        else {
            // Direct Match (Head, Chest, Hands, etc.)
            slotToAssign = slotKey;
        }

        if (slotToAssign) {
            // Item zuweisen
            GEAR_SELECTION[slotToAssign] = entry.itemId;
            matchCount++;

            // NEU: Enchantment zuweisen, falls eine effectId gefunden wurde
            // Setzt voraus, dass ENCHANT_DB geladen ist
            if (entry.effectId && entry.effectId !== 0 && typeof ENCHANT_DB !== 'undefined') {
                var enchant = ENCHANT_DB.find(function (e) { return e.effectId === entry.effectId; });
                if (enchant) {
                    ENCHANT_SELECTION[slotToAssign] = enchant.id;
                }
            }
        }
    });

    // 4. Update UI
    if (typeof initGearPlannerUI === 'function') initGearPlannerUI();
    saveCurrentState();
    if (typeof updatePlayerStats === 'function') updatePlayerStats();
    if (typeof updateEnemyInfo === 'function') updateEnemyInfo();
    showToast("Imported data for " + (charName || "character"));

    return { matched: matchCount };
}

function closeWarningModal() {
    var m = document.getElementById("warningModal");
    if (m) m.classList.add("hidden");
}

function renderDPSChart(results) {
    const container = document.getElementById("dpsChartContainer");
    const canvas = document.getElementById("dpsChart");
    if (!container || !canvas || !results.distribution) return;

    // 1. Globale Grenzwerte über alle Simulationen ermitteln für identische Skalen
    let globalMin = results.distribution.min;
    let globalMax = results.distribution.max;
    let globalMaxBin = results.distribution.maxBin;

    SIM_LIST.forEach(sim => {
        if (sim.results && sim.results.distribution) {
            globalMin = Math.min(globalMin, sim.results.distribution.min);
            globalMax = Math.max(globalMax, sim.results.distribution.max);
            globalMaxBin = Math.max(globalMaxBin, sim.results.distribution.maxBin);
        }
    });

    container.style.display = "block";
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const dist = results.distribution;
    const bins = dist.bins;
    const margin = 20;
    const chartWidth = rect.width - (margin * 2);
    const chartHeight = rect.height - (margin * 2.5);

    ctx.clearRect(0, 0, rect.width, rect.height);

    // 2. Balken zeichnen mit globaler X-Achsen-Positionierung
    bins.forEach((count, i) => {
        if (count === 0) return;

        // Position berechnen basierend auf dem globalen Min/Max
        const binStartDps = dist.min + (i * dist.binSize);
        const xPosPercent = (binStartDps - globalMin) / (globalMax - globalMin);
        
        const h = (count / globalMaxBin) * chartHeight; // Y-Skala global
        const x = margin + (xPosPercent * chartWidth);
        const y = rect.height - margin - h;
        const bWidth = (dist.binSize / (globalMax - globalMin)) * chartWidth;

        ctx.fillStyle = '#ff7d0a';
        ctx.fillRect(x, y, Math.max(1, bWidth - 1), h);
    });

    // Achsen-Beschriftung mit globalen Werten
    ctx.fillStyle = "#aaa";
    ctx.font = "10px Inter";
    ctx.textAlign = "left";
    ctx.fillText(Math.floor(globalMin) + " DPS", margin, rect.height - 5);
    ctx.textAlign = "right";
    ctx.fillText(Math.floor(globalMax) + " DPS", rect.width - margin, rect.height - 5);
    
    // Durchschnitts-Linie (relativ zum globalen Scale)
    if (globalMax > globalMin) {
        const avgPos = ((results.dps - globalMin) / (globalMax - globalMin)) * chartWidth;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(margin + avgPos, 5);
        ctx.lineTo(margin + avgPos, rect.height - margin);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

// ============================================================================
// ROTATION BUILDER LOGIC (DRAG & DROP)
// ============================================================================
var draggedSkillId = null;
var draggedStepIndex = null;

function initRotationBuilder() {
    renderRotationToolbox();
    renderRotationList();

    var dropzone = document.getElementById("rbDropzone");
    if (dropzone) {
        dropzone.addEventListener("dragover", function(e) {
            e.preventDefault();
            dropzone.classList.add("drag-over");
        });
        dropzone.addEventListener("dragleave", function(e) {
            dropzone.classList.remove("drag-over");
        });
        dropzone.addEventListener("drop", function(e) {
            e.preventDefault();
            dropzone.classList.remove("drag-over");
            
            if (draggedSkillId) {
                addRotationStep(draggedSkillId);
            } else if (draggedStepIndex !== null) {
                var steps = CUSTOM_ROTATION.steps || [];
                moveRotationStep(draggedStepIndex, steps.length);
            }
            draggedSkillId = null;
            draggedStepIndex = null;
        });
    }
}

function updateRotationMeta(field, val) {
    if (!CUSTOM_ROTATION) CUSTOM_ROTATION = { name: "", desc: "", steps: [] };
    CUSTOM_ROTATION[field] = val;
    saveCurrentState();
}

function renderRotationToolbox() {
    var tb = document.getElementById("rbSkillsList");
    if (!tb) return;
    tb.innerHTML = "";
    
    ROTATION_SKILLS.forEach(skill => {
        // --- NEU: Berserk ausblenden, wenn nicht geskillt ---
        if (skill.id === "Berserk") {
            var hasBerserk = (typeof TALENT_CONFIG !== 'undefined' && (TALENT_CONFIG.berserk || 0) > 0);
            if (!hasBerserk) return; // Skill komplett überspringen
        }

        var el = document.createElement("div");
        el.className = "rb-skill";
        el.draggable = true;
        el.innerHTML = `<img src="https://wow.zamimg.com/images/wow/icons/large/${skill.icon}.jpg" class="rb-skill-icon" alt=""> ${skill.name}`;
        
        el.addEventListener("dragstart", function(e) {
            draggedSkillId = skill.id;
            draggedStepIndex = null;
        });
        tb.appendChild(el);
    });
}

function renderRotationList() {
    var dz = document.getElementById("rbDropzone");
    var empty = document.getElementById("rbEmptyState");
    if (!dz) return;
    
    // Update Meta UI Fields
    var nInput = document.getElementById("rb_meta_name");
    var dInput = document.getElementById("rb_meta_desc");
    if (nInput) nInput.value = CUSTOM_ROTATION.name || "";
    if (dInput) dInput.value = CUSTOM_ROTATION.desc || "";

    document.querySelectorAll(".rb-step").forEach(el => el.remove());

    if (!CUSTOM_ROTATION || !CUSTOM_ROTATION.steps || CUSTOM_ROTATION.steps.length === 0) {
        if (empty) empty.style.display = "block";
        return;
    }
    if (empty) empty.style.display = "none";

    CUSTOM_ROTATION.steps.forEach((step, idx) => {
        var skillDef = ROTATION_SKILLS.find(s => s.id === step.skill) || { name: step.skill, icon: "inv_misc_questionmark" };
        
        // --- NEU: Prüfen, ob das Talent für diesen Skill fehlt ---
        var missingTalent = (step.skill === "Berserk" && (typeof TALENT_CONFIG !== 'undefined' && (TALENT_CONFIG.berserk || 0) === 0));
        var pos = getVal("rota_position");
        var wrongPosition = (["Shred", "Pounce", "Ravage"].includes(step.skill) && pos !== "back");
        var effectivelyDisabled = step.disabled || missingTalent || wrongPosition;

        // --- NEU: Visuelle Warnung, wenn Talent oder Position fehlt ---
        var titleWarning = "";
        if (missingTalent) titleWarning = " <span style='font-size:0.7rem; color:#f44336;'>(Missing Talent)</span>";
        else if (wrongPosition) titleWarning = " <span style='font-size:0.7rem; color:#ff9800;'>(Requires Behind)</span>";

        var titleStyle = (missingTalent || wrongPosition) ? "color:#f44336; text-decoration:line-through;" : "";

        var stepEl = document.createElement("div");
        stepEl.className = "rb-step";
        if (effectivelyDisabled) stepEl.classList.add("is-disabled");
        stepEl.draggable = true;
        
        stepEl.addEventListener("dragstart", function(e) {
            draggedStepIndex = idx;
            draggedSkillId = null;
            e.stopPropagation();
        });
        stepEl.addEventListener("dragover", function(e) {
            e.preventDefault();
            stepEl.classList.add("drag-over");
        });
        stepEl.addEventListener("dragleave", function(e) {
            stepEl.classList.remove("drag-over");
        });
        stepEl.addEventListener("drop", function(e) {
            e.preventDefault();
            stepEl.classList.remove("drag-over");
            e.stopPropagation(); 
            
            if (draggedSkillId) {
                addRotationStep(draggedSkillId, idx);
            } else if (draggedStepIndex !== null) {
                moveRotationStep(draggedStepIndex, idx);
            }
            draggedSkillId = null;
            draggedStepIndex = null;
        });

        // Hole die exakten Ausführungen aus dem repräsentativen Durchlauf (avgRun)
        var exactCount = 0;
        if (typeof SIM_DATA !== 'undefined' && SIM_DATA && SIM_DATA.results && SIM_DATA.results.avgRun && SIM_DATA.results.avgRun.counts && SIM_DATA.results.avgRun.counts[step.id]) {
            exactCount = SIM_DATA.results.avgRun.counts[step.id];
        }
        var countHtml = exactCount > 0 ? `<span class="rb-step-count" title="Uses in representative run">${exactCount}x</span>` : '';

        // --- NEU: Visuelle Warnung, wenn Talent fehlt ---
        var titleStyle = missingTalent ? "color:#f44336; text-decoration:line-through;" : "";
        var titleWarning = missingTalent ? " <span style='font-size:0.7rem; color:#f44336;'>(Missing Talent)</span>" : "";

        var html = `
            <div class="rb-step-header">
                <div class="rb-step-title" style="${titleStyle}">
                    <img src="https://wow.zamimg.com/images/wow/icons/large/${skillDef.icon}.jpg" class="rb-skill-icon" alt="">
                    ${idx + 1}. ${skillDef.name}${titleWarning}
                </div>
                <div style="display:flex; align-items:center;">
                    ${countHtml}
                    <button class="rb-toggle-btn" onclick="toggleStepDisabled(${idx})" title="Enable/Disable Step">${effectivelyDisabled ? '🚫' : '✅'}</button>
                    <button class="rb-delete-btn" onclick="removeRotationStep(${idx})">✖</button>
                </div>
            </div>
            <div class="rb-conditions" id="rb_conds_${idx}"></div>
        `;
        stepEl.innerHTML = html;
        dz.appendChild(stepEl);

        var condContainer = document.getElementById(`rb_conds_${idx}`);
        if (step.conditions && step.conditions.length > 0) {
            step.conditions.forEach((cond, cIdx) => {
                condContainer.appendChild(createConditionRow(idx, cIdx, cond));
            });
        }
        
        var addBtn = document.createElement("button");
        addBtn.className = "rb-add-condition";
        addBtn.innerText = "+ Add Condition";
        addBtn.onclick = function() { addCondition(idx); };
        condContainer.appendChild(addBtn);
    });
    
    saveCurrentState();
}

function createConditionRow(stepIdx, condIdx, cond) {
    var row = document.createElement("div");
    row.className = "rb-condition-row";
    
    var typeSel = document.createElement("select");
    Object.keys(CONDITION_TYPES).forEach(k => {
        var opt = document.createElement("option");
        opt.value = k;
        opt.innerText = CONDITION_TYPES[k].label;
        if (k === cond.type) opt.selected = true;
        typeSel.appendChild(opt);
    });
    typeSel.onchange = function() { updateCondition(stepIdx, condIdx, "type", this.value); };
    row.appendChild(typeSel);

    var cDef = CONDITION_TYPES[cond.type];
    
    if (cDef.type === "select") {
        var targetSel = document.createElement("select");
        cDef.options.forEach(o => {
            var opt = document.createElement("option");
            opt.value = o;
            opt.innerText = o;
            if (o === cond.target) opt.selected = true;
            targetSel.appendChild(opt);
        });
        targetSel.onchange = function() { updateCondition(stepIdx, condIdx, "target", this.value); };
        row.appendChild(targetSel);
    }

    var opSel = document.createElement("select");
    cDef.ops.forEach(o => {
        var opt = document.createElement("option");
        opt.value = o;
        opt.innerText = o;
        if (o === cond.op) opt.selected = true;
        opSel.appendChild(opt);
    });
    opSel.onchange = function() { updateCondition(stepIdx, condIdx, "op", this.value); };
    row.appendChild(opSel);

    if (cond.type !== "last_spell") {
        var valInp = document.createElement("input");
        valInp.type = "number";
        valInp.value = cond.val !== undefined ? cond.val : 0;
        valInp.onchange = function() { updateCondition(stepIdx, condIdx, "val", parseFloat(this.value)); };
        row.appendChild(valInp);
    }

    var delBtn = document.createElement("button");
    delBtn.className = "rb-delete-btn";
    delBtn.innerText = "✖";
    delBtn.onclick = function() { removeCondition(stepIdx, condIdx); };
    row.appendChild(delBtn);

    return row;
}

function updateCondition(sIdx, cIdx, field, value) {
    var cond = CUSTOM_ROTATION.steps[sIdx].conditions[cIdx];
    cond[field] = value;
    
    if (field === "type") {
        var def = CONDITION_TYPES[value];
        cond.op = def.ops[0];
        if (def.type === "select") cond.target = def.options[0];
        if (value !== "last_spell") cond.val = 0;
    }
    renderRotationList();
}

function toggleStepDisabled(idx) {
    if (!CUSTOM_ROTATION || !CUSTOM_ROTATION.steps || !CUSTOM_ROTATION.steps[idx]) return;
    CUSTOM_ROTATION.steps[idx].disabled = !CUSTOM_ROTATION.steps[idx].disabled;
    renderRotationList();
}

function addRotationStep(skillId, insertAtIdx) {
    if (!CUSTOM_ROTATION.steps) CUSTOM_ROTATION.steps = [];
    var newStep = {
        id: "step_" + Date.now() + "_" + Math.floor(Math.random()*1000),
        skill: skillId,
        conditions: [],
        disabled: false
    };
    if (insertAtIdx !== undefined && insertAtIdx !== null) {
        CUSTOM_ROTATION.steps.splice(insertAtIdx, 0, newStep);
    } else {
        CUSTOM_ROTATION.steps.push(newStep);
    }
    renderRotationList();
}

function removeRotationStep(idx) {
    CUSTOM_ROTATION.steps.splice(idx, 1);
    renderRotationList();
}

function moveRotationStep(fromIdx, toIdx) {
    if (toIdx > fromIdx) toIdx--; 
    var step = CUSTOM_ROTATION.steps.splice(fromIdx, 1)[0];
    CUSTOM_ROTATION.steps.splice(toIdx, 0, step);
    renderRotationList();
}

function addCondition(sIdx) {
    CUSTOM_ROTATION.steps[sIdx].conditions.push({ type: "cp", op: ">=", val: 5 });
    renderRotationList();
}

function removeCondition(sIdx, cIdx) {
    CUSTOM_ROTATION.steps[sIdx].conditions.splice(cIdx, 1);
    renderRotationList();
}

function clearRotation() {
    if (confirm("Are you sure you want to clear your custom rotation?")) {
        CUSTOM_ROTATION = { name: "", desc: "", steps: [] };
        document.getElementById("rotation_preset_select").value = "";
        renderRotationList();
    }
}

function toggleStepDisabled(idx) {
    if (!CUSTOM_ROTATION || !CUSTOM_ROTATION.steps || !CUSTOM_ROTATION.steps[idx]) return;
    CUSTOM_ROTATION.steps[idx].disabled = !CUSTOM_ROTATION.steps[idx].disabled;
    renderRotationList();
    saveCurrentState(); 
}

function openOtherSimsModal() {
    var modal = document.getElementById('otherSimsModal');
    if (modal) modal.classList.remove('hidden');
}

function closeOtherSimsModal() {
    var modal = document.getElementById('otherSimsModal');
    if (modal) modal.classList.add('hidden');
}

function closeWelcomeInfoModal() {
    document.getElementById('welcomeInfoModal').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('krokatFeralSimWelcomeShown')) {
        const welcomeModal = document.getElementById('welcomeInfoModal');
        if (welcomeModal) {
            welcomeModal.classList.remove('hidden');
        }
        
        localStorage.setItem('krokatFeralSimWelcomeShown', 'true');
    }
});
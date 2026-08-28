// ============================================================================
// TALENT TREE RENDERING & VALIDATION
// ============================================================================

function getTreePoints(treeData) {
    let sum = 0;
    treeData.forEach(t => sum += (TALENT_CONFIG[t.id] || 0));
    return sum;
}

function getTotalPoints() {
    return getTreePoints(TALENT_TREES["Balance"]) +
        getTreePoints(TALENT_TREES["Feral"]) +
        getTreePoints(TALENT_TREES["Restoration"]);
}

function canAddPoint(treeName, talent) {
    if (getTotalPoints() >= 51) return false;
    if ((TALENT_CONFIG[talent.id] || 0) >= talent.max) return false;

    let treeData = TALENT_TREES[treeName];
    if (getTreePoints(treeData) < talent.row * 5) return false;

    if (talent.req) {
        let reqTalent = treeData.find(t => t.id === talent.req);
        if (!reqTalent || (TALENT_CONFIG[talent.req] || 0) < reqTalent.max) return false;
    }
    return true;
}

function isValidTreeState(treeData, testConfig) {
    let maxRow = -1;
    treeData.forEach(t => { if ((testConfig[t.id] || 0) > 0 && t.row > maxRow) maxRow = t.row; });

    for (let r = 0; r <= maxRow; r++) {
        let sumPrev = 0;
        let pointsInThisRow = 0;
        treeData.forEach(t => {
            if (t.row < r) sumPrev += (testConfig[t.id] || 0);
            if (t.row === r) pointsInThisRow += (testConfig[t.id] || 0);
        });
        if (pointsInThisRow > 0 && sumPrev < r * 5) return false;
    }

    for (let i = 0; i < treeData.length; i++) {
        let t = treeData[i];
        if ((testConfig[t.id] || 0) > 0 && t.req) {
            let reqTalent = treeData.find(x => x.id === t.req);
            if ((testConfig[t.req] || 0) < reqTalent.max) return false;
        }
    }
    return true;
}

function canRemovePoint(treeName, talent) {
    if ((TALENT_CONFIG[talent.id] || 0) <= 0) return false;
    let treeData = TALENT_TREES[treeName];
    let testConfig = Object.assign({}, TALENT_CONFIG);
    testConfig[talent.id]--;
    return isValidTreeState(treeData, testConfig);
}

// FORMATIERT DIE BESCHREIBUNG BASIEREND AUF AKTUELLEN PUNKTEN
function formatTalentDesc(desc, currentPts) {
    if (!desc) return "";
    // Sucht nach Mustern wie 2/4/6/8/10 oder 0.1/0.2/0.3
    return desc.replace(/(\d+(?:\.\d+)?(?:(?:\/|-)\d+(?:\.\d+)?)+)/g, function (match) {
        let parts = match.split(/[\/-]/);
        // Wenn 0 Punkte vergeben sind, zeige Rang 1 an. Ansonsten den aktuellen Rang.
        let idx = currentPts === 0 ? 0 : Math.min(currentPts - 1, parts.length - 1);
        return `<span style="color:#fff; font-weight:bold;">${parts[idx]}</span>`;
    });
}

function renderTalentTree() {
    let ptsBal = getTreePoints(TALENT_TREES["Balance"]);
    let ptsFer = getTreePoints(TALENT_TREES["Feral"]);
    let ptsRes = getTreePoints(TALENT_TREES["Restoration"]);
    let total = ptsBal + ptsFer + ptsRes;

    let counterLabel = document.getElementById("talentCounterText");
    if (counterLabel) {
        // Zeigt z.B.: Points Spent: 51 / 51 (24 / 0 / 27)
        counterLabel.innerText = `Points Spent: ${total} / 51 (${ptsBal} / ${ptsFer} / ${ptsRes})`;
    }

    let titleBal = document.getElementById("treeTitleBalance");
    if (titleBal) titleBal.innerText = `Balance (${ptsBal})`;

    let titleFer = document.getElementById("treeTitleFeral");
    if (titleFer) titleFer.innerText = `Feral (${ptsFer})`;

    let titleRes = document.getElementById("treeTitleResto");
    if (titleRes) titleRes.innerText = `Restoration (${ptsRes})`;

    renderGrid("talentGridBalance", "Balance");
    renderGrid("talentGridFeral", "Feral");
    renderGrid("talentGridResto", "Restoration");

    // --- BUFF CHECK (Tree of Life) ---
    // Deaktiviert die Checkbox bei den passiven Buffs, wenn das Talent nicht geskillt ist
    let treeBuff = document.getElementById("buff_tree");
    if (treeBuff) {
        if ((TALENT_CONFIG["treeOfLife"] || 0) === 0) {
            treeBuff.checked = false;
            treeBuff.disabled = true;
            treeBuff.parentElement.style.opacity = "0.5";
        } else {
            treeBuff.disabled = false;
            treeBuff.parentElement.style.opacity = "1";
        }
    }

    // --- ROTATION BUILDER UPDATE ---
    // Aktualisiert die Drag & Drop Liste und die Tool-Box live bei jedem Klick
    if (typeof renderRotationToolbox === 'function') renderRotationToolbox();
    if (typeof renderRotationList === 'function') renderRotationList();

    if (typeof calculateGearStats === 'function') calculateGearStats();
    if (typeof updatePlayerStats === 'function') updatePlayerStats();
}

function renderGrid(containerId, treeName) {
    var container = document.getElementById(containerId);
    if (!container) return;

    // Bereite Container für absolute SVG-Pfeile vor
    container.innerHTML = "";
    container.style.position = "relative";

    var treeData = TALENT_TREES[treeName];

    treeData.forEach(function (talent) {
        var currentPts = TALENT_CONFIG[talent.id] || 0;
        var canAdd = canAddPoint(treeName, talent);
        var canRemove = canRemovePoint(treeName, talent);
        var disabled = !canAdd && currentPts === 0;

        var slot = document.createElement("div");
        slot.className = "talent-slot";
        if (currentPts > 0) slot.classList.add("active");
        if (currentPts >= talent.max) slot.classList.add("maxed");
        if (disabled) slot.classList.add("disabled");

        slot.style.gridRow = talent.row + 1;
        slot.style.gridColumn = talent.col + 1;
        slot.style.zIndex = "2"; // Über den Pfeilen
        slot.style.position = "relative";

        var iconUrl = talent.icon && talent.icon !== "-" && talent.icon !== ""
            ? "https://wow.zamimg.com/images/wow/icons/large/" + talent.icon + ".jpg"
            : "https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg";

        slot.style.backgroundImage = "url('" + iconUrl + "')";
        slot.style.backgroundSize = "cover";
        slot.innerHTML = `<div class="talent-points">${currentPts}/${talent.max}</div>`;

        // Tooltip Logik (Mouse Events)
        slot.addEventListener("mouseenter", function (e) {
            let tt = document.getElementById("wowTooltip");
            if (tt) {
                // Nutze position: fixed statt absolute, um Container-Offsets zu umgehen
                tt.style.position = "fixed";
                tt.style.zIndex = "99999";
                tt.style.pointerEvents = "none";
                tt.style.background = "rgba(10, 10, 10, 0.95)";
                tt.style.border = "1px solid #ffca28";
                tt.style.padding = "10px";
                tt.style.borderRadius = "5px";
                tt.style.width = "250px";
                tt.style.boxShadow = "0 4px 8px rgba(0,0,0,0.8)";

                let formattedDesc = formatTalentDesc(talent.desc, currentPts);
                let statusHtml = "";

                let reqPoints = talent.row * 5;
                if (getTreePoints(treeData) < reqPoints) {
                    statusHtml += `<div style="color:#f44336; margin-bottom:5px; font-size:0.85em;">Requires ${reqPoints} points in ${treeName}</div>`;
                }
                if (talent.req) {
                    let reqTalent = treeData.find(x => x.id === talent.req);
                    if ((TALENT_CONFIG[reqTalent.id] || 0) < reqTalent.max) {
                        statusHtml += `<div style="color:#f44336; margin-bottom:5px; font-size:0.85em;">Requires ${reqTalent.max} points in ${reqTalent.name}</div>`;
                    }
                }

                let rankStr = currentPts === 0 ? `<span style="color:#888">Next Rank</span>` : `Rank ${currentPts}/${talent.max}`;

                tt.innerHTML = `
                    <div style="font-weight:bold; color:white; font-size: 1.1em; margin-bottom: 2px;">${talent.name}</div>
                    <div style="color:#ffd100; margin-bottom:8px; font-weight:bold;">${rankStr}</div>
                    ${statusHtml}
                    <div style="color:#ffd100; font-size:0.9em; line-height: 1.3;">${formattedDesc}</div>
                `;

                tt.style.display = "block";

                // ClientX / ClientY für fixierte Positionierung
                let x = e.clientX + 15;
                let y = e.clientY + 15;
                if (x + 270 > window.innerWidth) x = e.clientX - 270;
                if (y + tt.offsetHeight > window.innerHeight) y = e.clientY - tt.offsetHeight - 15;

                tt.style.left = x + "px";
                tt.style.top = y + "px";
            }
        });

        slot.addEventListener("mousemove", function (e) {
            let tt = document.getElementById("wowTooltip");
            if (tt && tt.style.display === "block") {
                let x = e.clientX + 15;
                let y = e.clientY + 15;

                if (x + 270 > window.innerWidth) x = e.clientX - 270;
                if (y + tt.offsetHeight > window.innerHeight) y = e.clientY - tt.offsetHeight - 15;

                tt.style.left = x + "px";
                tt.style.top = y + "px";
            }
        });

        slot.addEventListener("mouseleave", function () {
            let tt = document.getElementById("wowTooltip");
            if (tt) tt.style.display = "none";
        });

        // Click Logic
        slot.addEventListener("click", function () {
            if (canAddPoint(treeName, talent)) {
                TALENT_CONFIG[talent.id]++; renderTalentTree(); saveCurrentState();
            } else if (getTotalPoints() >= 51) {
                showToast("Maximum of 51 Talent Points reached!");
            }
        });

        slot.addEventListener("contextmenu", function (e) {
            e.preventDefault();
            if (canRemovePoint(treeName, talent)) {
                TALENT_CONFIG[talent.id]--; renderTalentTree(); saveCurrentState();
            } else if (currentPts > 0) {
                showToast("Cannot remove point! Required by lower tier or dependency.");
            }
        });

        container.appendChild(slot);
    });

    drawArrows(container, treeData);
}

// FORMATIERT DIE BESCHREIBUNG BASIEREND AUF AKTUELLEN PUNKTEN
function formatTalentDesc(desc, currentPts) {
    if (!desc) return "";

    // Sucht das Muster 2/4/6/8/10
    return desc.replace(/(\d+(?:\.\d+)?(?:(?:\/|-)\d+(?:\.\d+)?)+)/g, function (match) {
        let parts = match.split(/[\/-]/);
        let idx = currentPts === 0 ? -1 : currentPts - 1;

        let res = [];
        for (let i = 0; i < parts.length; i++) {
            if (i === idx) {
                // Aktiver Rang wird dick & weiß hervorgehoben
                res.push(`<span style="color:#fff; font-weight:bold; font-size:1.15em;">${parts[i]}</span>`);
            } else {
                // Inaktive Ränge werden ausgegraut
                res.push(`<span style="color:#888;">${parts[i]}</span>`);
            }
        }
        return res.join("/");
    });
}


// ZEICHNET DIE ABHÄNGIGKEITS-PFEILE IM GRID
function drawArrows(container, treeData) {
    let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.style.position = "absolute"; svg.style.top = "0"; svg.style.left = "0";
    svg.style.width = "100%"; svg.style.height = "100%";
    svg.style.pointerEvents = "none"; svg.style.zIndex = "1";

    let defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
        <marker id="arrow-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#f44336" />
        </marker>
        <marker id="arrow-yellow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#ffd100" />
        </marker>
    `;
    svg.appendChild(defs);

    treeData.forEach(t => {
        if (t.req) {
            let reqT = treeData.find(x => x.id === t.req);
            if (reqT) {
                let startX = 0, startY = 0, endX = 0, endY = 0;
                let pathStr = "";

                if (reqT.row === t.row) {
                    if (reqT.col < t.col) {
                        // Links -> Rechts
                        startX = reqT.col * 60 + 46 + 15; // Rechte Kante Source
                        startY = reqT.row * 60 + 23 + 15; // Mitte vertikal
                        endX = t.col * 60 + 15;           // Linke Kante Target
                        endY = t.row * 60 + 23 + 15;
                        pathStr = `M ${startX} ${startY} L ${endX - 2} ${endY}`;
                    } else {
                        // Rechts -> Links (KORRIGIERT)
                        startX = reqT.col * 60 + 15;      // Linke Kante Source
                        startY = reqT.row * 60 + 23 + 15; // Mitte vertikal
                        endX = t.col * 60 + 46 + 15;      // Rechte Kante Target
                        endY = t.row * 60 + 23 + 15;
                        pathStr = `M ${startX} ${startY} L ${endX + 2} ${endY}`;
                    }
                }
                else if (reqT.col === t.col) {
                    // Oben -> Unten
                    startX = reqT.col * 60 + 23 + 15;
                    startY = reqT.row * 60 + 46 + 15;
                    endX = t.col * 60 + 23 + 15;
                    endY = t.row * 60 + 15;
                    pathStr = `M ${startX} ${startY} L ${endX} ${endY - 2}`;
                }
                else {
                    // L-Form Biegung (Zieht nach unten und biegt dann ab)
                    startX = reqT.col * 60 + 23 + 15;
                    startY = reqT.row * 60 + 46 + 15;
                    endX = t.col * 60 + 23 + 15;
                    endY = t.row * 60 + 15;

                    let bendY = endY - 7;
                    pathStr = `M ${startX} ${startY} L ${startX} ${bendY} L ${endX} ${bendY} L ${endX} ${endY - 2}`;
                }

                // KORRIGIERT: Wird erst Gelb, wenn das ZIEL-Talent mind. 1 Punkt hat
                let isFulfilled = (TALENT_CONFIG[t.id] || 0) > 0;
                let color = isFulfilled ? "#ffd100" : "#f44336";
                let marker = isFulfilled ? "url(#arrow-yellow)" : "url(#arrow-red)";

                let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("d", pathStr);
                path.setAttribute("stroke", color);
                path.setAttribute("stroke-width", "2");
                path.setAttribute("fill", "none");
                path.setAttribute("marker-end", marker);
                svg.appendChild(path);
            }
        }
    });
    container.appendChild(svg);
}

// ============================================================================
// TALENT PRESET LOGIC
// ============================================================================

function renderTalentPresetDropdown() {
    let select = document.getElementById("talent_preset_select");
    if (!select) return;
    select.innerHTML = '<option value="">-- Select Preset --</option>';
    for (let name in TALENT_PRESETS) {
        select.innerHTML += `<option value="${name}">${name}</option>`;
    }
}

function loadTalentPreset() {
    let name = document.getElementById("talent_preset_select").value;
    if (!name || !TALENT_PRESETS[name]) return;

    TALENT_CONFIG = structuredClone(TALENT_PRESETS[name]);
    renderTalentTree();
    saveCurrentState();
    showToast("Talent Preset Loaded!");
}

function saveTalentPreset() {
    let name = prompt("Enter a name for this Talent Preset:");
    if (!name || name.trim() === "") return;

    TALENT_PRESETS[name] = structuredClone(TALENT_CONFIG);
    localStorage.setItem("resto_talent_presets", JSON.stringify(TALENT_PRESETS));
    renderTalentPresetDropdown();
    document.getElementById("talent_preset_select").value = name;
    showToast("Preset Saved!");
}

function deleteTalentPreset() {
    let name = document.getElementById("talent_preset_select").value;
    if (!name || !TALENT_PRESETS[name]) return;

    if (confirm(`Delete preset '${name}'?`)) {
        delete TALENT_PRESETS[name];
        localStorage.setItem("resto_talent_presets", JSON.stringify(TALENT_PRESETS));
        renderTalentPresetDropdown();
        showToast("Preset Deleted!");
    }
}

function clearTalents() {
    if (confirm("Reset all talent points?")) {
        for (let key in TALENT_CONFIG) {
            TALENT_CONFIG[key] = 0;
        }
        renderTalentTree();
        saveCurrentState();
    }
}

// ============================================================================
// TALENT TREE DATA 
// ============================================================================

var TALENT_CONFIG = {
    // Balance
    impWrath: 0, naturesGrasp: 0, impNaturesGrasp: 0, sylvanBlessing: 0,
    guidanceOfTheDream: 0, impMoonfire: 0, naturalWeapons: 0, naturalShapeshifter: 0,
    moonfury: 0, omenOfClarity: 0, naturesReach: 0, vengeance: 0, moonglow: 0,
    owlkinFrenzy: 0, moonkinForm: 0, naturesGrace: 0, impStarfire: 0,
    balanceOfAllThings: 0, galeWinds: 0, eclipse: 0,

    // Feral
    ferocity: 0, feralAggression: 0, feralInstinct: 0, brutalImpact: 0,
    thickHide: 0, openWounds: 0, feralSwiftness: 0, feralCharge: 0,
    sharpenedClaws: 0, primalFury: 0, predatoryStrikes: 0, bloodFrenzy: 0,
    impShred: 0, ancientBrutality: 0, berserk: 0, heartOfTheWild: 0,
    carnage: 0, leaderOfThePack: 0,

    // Restoration
    impMarkOfTheWild: 0, furor: 0, impHealingTouch: 0, naturesFocus: 0, subtlety: 0,
    swiftmend: 0, genesis: 0, reflection: 0, giftOfNature: 0, tranquilSpirit: 0,
    aessinasBloom: 0, natureSwiftness: 0, preservation: 0, impRegrowth: 0,
    impTranquility: 0, treeOfLife: 0
};

var TALENT_TREES = {
    "Balance": [
        { id: "impWrath", name: "Improved Wrath", icon: "spell_nature_abolishmagic", max: 5, row: 0, col: 0, req: null, desc: "Reduces the cast time and global cooldown of your Wrath spell by 0.1/0.2/0.3/0.4/0.5 sec." },
        { id: "naturesGrasp", name: "Nature's Grasp", icon: "spell_nature_natureswrath", max: 1, row: 0, col: 1, req: null, desc: "While active, any time an enemy strikes the caster they have a 35% chance to become afflicted by Entangling Roots (Rank 1). Only useable outdoors. 1 charge. Lasts 45 sec." },
        { id: "impNaturesGrasp", name: "Improved Nature's Grasp", icon: "spell_nature_natureswrath", max: 4, row: 0, col: 2, req: "naturesGrasp", desc: "Increases the chance for your Nature's Grasp to entangle an enemy by 15/30/45/65%." },
        { id: "sylvanBlessing", name: "Sylvan Blessing", icon: "inv_misc_gem_emerald_01", max: 2, row: 0, col: 3, req: null, desc: "Gives you a 50/100% chance after killing a target that yields experience or honor to allow your Mana to regenerate at a 100% rate while casting. Lasts 15 sec." },
        { id: "guidanceOfTheDream", name: "Guidance of the Dream", icon: "spell_nature_sleep", max: 3, row: 1, col: 0, req: null, desc: "Gives you a 23/46/70% chance to avoid interruption caused by damage while casting your Balance spells." },
        { id: "impMoonfire", name: "Improved Moonfire", icon: "spell_nature_starfall", max: 2, row: 1, col: 1, req: null, desc: "Increases the damage and critical strike chance of your Moonfire spell by 5/10%." },
        { id: "naturalWeapons", name: "Natural Weapons", icon: "inv_staff_01", max: 3, row: 1, col: 2, req: null, desc: "Increases the damage you deal with physical attacks in all forms by 3/6/10%. Also increases chance to hit with melee attacks and spells by 1/2/3%." },
        { id: "naturalShapeshifter", name: "Natural Shapeshifter", icon: "spell_nature_wispsplode", max: 3, row: 1, col: 3, req: null, desc: "Reduces the mana cost of all shapeshifting by 10/20/30%." },
        { id: "moonfury", name: "Moonfury", icon: "spell_nature_moonglow", max: 3, row: 2, col: 0, req: null, desc: "Increases the damage of your Starfire, Moonfire, Hurricane, Insect Swarm, and Wrath spells by 4/8/12%." },
        { id: "omenOfClarity", name: "Omen of Clarity", icon: "spell_nature_crystalball", max: 1, row: 2, col: 2, req: "naturalWeapons", desc: "Imbues the Druid with natural energy. Each of the Druid's melee attacks or offensive spell casts has a chance of causing the caster to enter a Clearcasting state. The Clearcasting state reduces the Mana, Rage or Energy cost of your next damage or healing spell or offensive ability by 100%." },
        { id: "naturesReach", name: "Nature's Reach", icon: "spell_nature_naturetouchgrow", max: 2, row: 2, col: 3, req: null, desc: "Increases the range of your Wrath, Entangling Roots, Faerie Fire, Moonfire, Starfire, Insect Swarm, Hurricane, Remove Curse, Abolish Poison, and Cure Poison spells by 10/20%." },
        { id: "vengeance", name: "Vengeance", icon: "spell_nature_purge", max: 5, row: 3, col: 1, req: "impMoonfire", desc: "Increases the critical strike damage bonus of your Starfire, Moonfire, and Wrath spells by 20/40/60/80/100%." },
        { id: "moonglow", name: "Moonglow", icon: "spell_nature_sentinal", max: 3, row: 3, col: 2, req: null, desc: "Reduces the Mana cost of your Moonfire, Starfire, Wrath, Hurricane, Insect Swarm, Healing Touch, Regrowth and Rejuvenation spells by 3/6/9%." },
        { id: "owlkinFrenzy", name: "Owlkin Frenzy", icon: "ability_druid_owlkinfrenzy", max: 3, row: 4, col: 0, req: "moonkinForm", desc: "Damage taken while in Moonkin Form has a 10% chance to enrage you, granting a 30% chance to avoid interruption caused by damage while casting and regenerating 1% of your maximum mana per second for 10 sec. This effect can only trigger once every 30/25/20 seconds." },
        { id: "moonkinForm", name: "Moonkin Form", icon: "spell_nature_forceofnature", max: 1, row: 4, col: 1, req: null, desc: "Transforms the Druid into Moonkin Form. While in this form the armor contribution from items is increased by 180%, the Mana cost of your Balance spells is reduced by 20%, and all party members within 30 yards have their spell critical chance increased by 3%." },
        { id: "naturesGrace", name: "Nature's Grace", icon: "spell_nature_naturesblessing", max: 1, row: 4, col: 2, req: "moonglow", desc: "All spell criticals grace you with a blesisng of nature, reducing the casting time of your next spell by 0.5 sec." },
        { id: "impStarfire", name: "Improved Starfire", icon: "spell_arcane_starfire", max: 3, row: 4, col: 3, req: null, desc: "Reduces the cast time of Starfire by 0.2/0.3/0.5 sec and gives it a 5/10/15% chance to stun the target for 3 sec." },
        { id: "balanceOfAllThings", name: "Balance of All Things", icon: "ability_druid_manatree", max: 3, row: 5, col: 1, req: null, desc: "Damaging a target afflicted by Insect Swarm with Wrath refunds 10/20/30% of its mana cost. Starfire has a 3/6/9% increased chance to critically strike against targets affected by Moonfire." },
        { id: "galeWinds", name: "Gale Winds", icon: "ability_druid_galewinds", max: 2, row: 5, col: 2, req: null, desc: "Reduces the mana cost of Hurricane by 10/20% and causes it to reduce the attack speed of affected enemies by 12/25%." },
        { id: "eclipse", name: "Eclipse", icon: "ability_druid_eclipse", max: 1, row: 6, col: 1, req: null, desc: "Aligns natural and astral energies. Damage from Wrath has a 40% chance to grant Arcane Eclipse, increasing Arcane damage dealt. Damage from Starfire has a 60% chance to grant Nature Eclipse, increasing Nature damage dealt. The damage bonus is 10% plus 60% of your spell critical strike chance. Each effect lasts 15 sec and has its own 30 sec cooldown. Only one Eclipse can be active at a time." }
    ],
    "Feral": [
        { id: "ferocity", name: "Ferocity", icon: "ability_hunter_pet_hyena", max: 5, row: 0, col: 1, req: null, desc: "Reduces the cost of your Maul, Swipe, Savage Bite, Claw, and Rake abilities by 1/2/3/4/5 Rage or Energy." },
        { id: "feralAggression", name: "Feral Aggression", icon: "ability_druid_demoralizingroar", max: 5, row: 0, col: 2, req: null, desc: "Increases the Attack Power reduction of your Demoralizing Roar by 8/16/24/32/40% and the damage caused by your Ferocious Bite by 3/6/9/12/15%." },
        { id: "feralInstinct", name: "Feral Instinct", icon: "ability_ambush", max: 3, row: 1, col: 0, req: null, desc: "Increases threat caused in Bear and Dire Bear Form by 5/10/15% and reduces the chance enemies have to detect you while Prowling." },
        { id: "brutalImpact", name: "Brutal Impact", icon: "ability_druid_bash", max: 2, row: 1, col: 1, req: null, desc: "Increases the stun duration of your Bash and Pounce abilities by 0.5/1 sec." },
        { id: "thickHide", name: "Thick Hide", icon: "inv_misc_pelt_bear_03", max: 3, row: 1, col: 2, req: null, desc: "Increases your Armor contribution from items by 3/6/10%." },
        { id: "openWounds", name: "Open Wounds", icon: "ability_druid_disembowel", max: 3, row: 1, col: 3, req: null, desc: "Increases the damage of Rip by 5/10/15%. In addition, increases the damage of Claw by 10/20/30% for each of your active Bleed effects on the target." },
        { id: "feralSwiftness", name: "Feral Swiftness", icon: "spell_nature_spiritwolf", max: 2, row: 2, col: 0, req: null, desc: "Increases your movement speed by 15/30% while outdoors in Cat Form and increases your chance to dodge while in Bear, Dire Bear and Cat Form by 2/4%." },
        { id: "feralCharge", name: "Feral Charge", icon: "ability_hunter_pet_bear", max: 1, row: 2, col: 1, req: null, desc: "Causes you to charge an enemy, immobilizing and interrupting any spell being cast for 4 sec." },
        { id: "sharpenedClaws", name: "Sharpened Claws", icon: "inv_misc_monsterclaw_04", max: 3, row: 2, col: 2, req: null, desc: "Increases your critical strike chance while in Bear, Dire Bear or Cat Form by 2/4/6%." },
        { id: "primalFury", name: "Primal Fury", icon: "ability_racial_cannibalize", max: 2, row: 2, col: 3, req: "sharpenedClaws", desc: "Gives you a 50/100% chance to gain an additional 5 Rage anytime you get a critical strike while in Bear and Dire Bear Form and your critical strikes from Cat Form abilities that add combo points have a chance to add an additional combo point." },
        { id: "predatoryStrikes", name: "Predatory Strikes", icon: "ability_hunter_pet_cat", max: 3, row: 3, col: 1, req: null, desc: "Increases your melee attack power in Cat, Bear, and Dire Bear Forms by 3/6/10%. In addition, increases the damage caused by your Claw, Rake, Maul, Swipe, and Savage Bite abilities by 7/14/20%." },
        { id: "bloodFrenzy", name: "Blood Frenzy", icon: "ability_ghoulfrenzy", max: 2, row: 3, col: 2, req: "sharpenedClaws", desc: "Increases the duration of Tiger's Fury by 6/12 sec, and causes Enrage to instantly generate 5/10 Rage. In addition, Tiger's Fury and Enrage increase your attack speed by 10/20% for 9/18 sec." },
        { id: "impShred", name: "Improved Shred", icon: "spell_shadow_vampiricaura", max: 2, row: 3, col: 3, req: null, desc: "Increases the damage of Shred by 5/10% and reduces its Energy cost by 6/12." },
        { id: "ancientBrutality", name: "Ancient Brutality", icon: "spell_shadow_unholyfrenzy", max: 2, row: 4, col: 0, req: null, desc: "Dodging an attack while in Bear or Dire Bear Form imbues you with the spirit of the Ancients, generating 2/4 Rage per second for 5 sec. This effect can only occur once every 9 seconds. While in Cat Form, periodic ticks of your Bleed effects restore 3/5 Energy." },
        { id: "berserk", name: "Berserk", icon: "ability_druid_berserk", max: 1, row: 4, col: 2, req: null, desc: "Removes all Fear effects and increases your energy regeneration rate by 100% while in Cat form, and increases your total health by 20% while in Bear form. After the effect ends, the health is lost. Effect lasts 20 seconds." },
        { id: "heartOfTheWild", name: "Heart of the Wild", icon: "spell_holy_blessingofagility", max: 5, row: 5, col: 1, req: "predatoryStrikes", desc: "Increases your Intellect by 4/8/12/16/20%. In addition, while in Bear or Dire Bear Form your Stamina is increased by 4/8/12/16/20% and while in Cat Form your Strength is increased by 4/8/12/16/20%." },
        { id: "carnage", name: "Carnage", icon: "ability_druid_rake", max: 2, row: 5, col: 2, req: null, desc: "Your Maul, Swipe, and Savage Bite abilities return 5/10% of their damage as healing to you. In addition, gives your Ferocious Bite a 10/20% chance per combo point spent to refresh your active Rake and Rip effects and to add an additional combo point." },
        { id: "leaderOfThePack", name: "Leader of the Pack", icon: "spell_nature_unyeildingstamina", max: 1, row: 6, col: 1, req: null, desc: "While in Cat, Bear or Dire Bear Form, the Leader of the Pack increases ranged and melee critical chance of all party members within 45 yards by 3%." }
    ],
    "Restoration": [
        { id: "impMarkOfTheWild", name: "Improved Mark of the Wild", icon: "spell_nature_regeneration", max: 5, row: 0, col: 1, req: null, desc: "Increases the effects of your Mark of the Wild and Gift of the Wild spells by 7/14/21/28/35%." },
        { id: "furor", name: "Furor", icon: "spell_holy_blessingofstamina", max: 5, row: 0, col: 2, req: null, desc: "Gives you 20/40/60/80/100% chance to gain 10 Rage when you shapeshift into Bear and Dire Bear Form or 40 Energy when you shapeshift into Cat Form." },
        { id: "impHealingTouch", name: "Improved Healing Touch", icon: "spell_nature_healingtouch", max: 5, row: 1, col: 0, req: null, desc: "Reduces the cast time of your Healing Touch spell by 0.1/0.2/0.3/0.4/0.5 sec." },
        { id: "naturesFocus", name: "Nature's Focus", icon: "spell_nature_healingwavegreater", max: 5, row: 1, col: 1, req: null, desc: "Gives you a 14/28/42/56/70% chance to avoid interruption caused by damage while casting the Healing Touch, Regrowth, and Tranquility spells." },
        { id: "subtlety", name: "Subtlety", icon: "ability_eyeoftheowl", max: 5, row: 1, col: 2, req: null, desc: "Reduces the threat generated by your spells by 4/8/12/16/20%." },
        { id: "swiftmend", name: "Swiftmend", icon: "inv_relics_idolofrejuvenation", max: 1, row: 2, col: 1, req: null, desc: "Consumes a Rejuvenation or Regrowth effect on a friendly target to instantly heal them an amount equal to 12 sec. of Rejuvenation or 18 sec. of Regrowth." },
        { id: "genesis", name: "Genesis", icon: "spell_nature_starfall", max: 3, row: 2, col: 2, req: null, desc: "Increases the damage and healing of your periodic magical spells and effects by 5/10/15%." },
        { id: "reflection", name: "Reflection", icon: "spell_frost_windwalkon", max: 3, row: 2, col: 3, req: null, desc: "Allows 5/10/15% of your Mana regeneration to continue while casting." },
        { id: "giftOfNature", name: "Gift of Nature", icon: "spell_nature_protectionformnature", max: 5, row: 3, col: 1, req: null, desc: "Increases the effectiveness of all healing spells by 2/4/6/8/10%." },
        { id: "tranquilSpirit", name: "Tranquil Spirit", icon: "spell_holy_elunesgrace", max: 5, row: 3, col: 3, req: null, desc: "Reduces the mana cost of your Healing Touch, Regrowth and Tranquility spells by 2/4/6/8/10%." },
        { id: "aessinasBloom", name: "Aessina's Bloom", icon: "inv_misc_herb_02", max: 2, row: 4, col: 0, req: "impHealingTouch", desc: "Healing a target affected by Regrowth or Rejuvenation with your Healing Touch spells reduces the casting time of your next Healing Touch spell by 0.15/0.30 sec and refunds 5/10% of its mana cost within 20 sec." },
        { id: "natureSwiftness", name: "Nature's Swiftness", icon: "spell_nature_ravenform", max: 1, row: 4, col: 2, req: "genesis", desc: "When activated, your next Nature spell becomes an instant cast spell." },
        { id: "preservation", name: "Preservation", icon: "inv_relics_idolofhealth", max: 3, row: 4, col: 3, req: null, desc: "Increases the periodic healing of Regrowth by 10/20/30% if the friendly target is affected by Rejuvenation." },
        { id: "impRegrowth", name: "Improved Regrowth", icon: "spell_nature_resistnature", max: 5, row: 5, col: 1, req: "giftOfNature", desc: "Increases the critical effect chance of your Regrowth spell by 10/20/30/40/50%." },
        { id: "impTranquility", name: "Improved Tranquility", icon: "spell_nature_tranquility", max: 2, row: 5, col: 2, req: null, desc: "Increases the healing done by your Tranquility spell by 20/40%." },
        { id: "treeOfLife", name: "Tree of Life Form", icon: "ability_druid_treeoflife", max: 1, row: 6, col: 1, req: null, desc: "Shapeshift into the Tree of Life. While in this form armor contribution from items is increased by 180%, the healing power of nearby party members is increased by an amount equal to 20% of your spirit, your movement speed is reduced by 20%, and you cannot cast damaging spells or Healing Touch, but the mana cost of heal over time spells is reduced by 20%." }
    ]
};

// ============================================================================
// TALENT PRESETS
// ============================================================================
var TALENT_PRESETS = {
    "Feral DPS (11/35/5)": {
        // Balance
        impWrath: 0, naturesGrasp: 1, impNaturesGrasp: 4, sylvanBlessing: 0,
        guidanceOfTheDream: 0, impMoonfire: 0, naturalWeapons: 3, naturalShapeshifter: 2,
        moonfury: 0, omenOfClarity: 1, naturesReach: 0,
        vengeance: 0, moonglow: 0,
        owlkinFrenzy: 0, moonkinForm: 0, naturesGrace: 0, impStarfire: 0,
        balanceOfAllThings: 0, galeWinds: 0,
        eclipse: 0,
        // Feral
        ferocity: 5, feralAggression: 0, 
        feralInstinct: 0, brutalImpact: 2, thickHide: 0, openWounds: 3, 
        feralSwiftness: 2, feralCharge: 0, sharpenedClaws: 3, primalFury: 2, 
        predatoryStrikes: 3, bloodFrenzy: 2, impShred: 2, 
        ancientBrutality: 2, berserk: 1, 
        heartOfTheWild: 5, carnage: 2, 
        leaderOfThePack: 1,
        // Restoration
        impMarkOfTheWild: 0, furor: 5,
        impHealingTouch: 0, naturesFocus: 0, subtlety: 0,
        swiftmend: 0, genesis: 0, reflection: 0,
        giftOfNature: 0, tranquilSpirit: 0,
        aessinasBloom: 0, natureSwiftness: 0, preservation: 0,
        impRegrowth: 0, impTranquility: 0,
        treeOfLife: 0
    }
};

var TALENT_CONFIG = structuredClone(TALENT_PRESETS["Feral DPS (11/35/5)"]);

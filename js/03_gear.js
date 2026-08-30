/**
 * Feral Simulation - File 3: Gear Planner Logic & Database
 * Updated for Turtle WoW 1.18 (Feral Cat)
 * Implements Checkbox-based Buffs/Consumables and expanded Stats Display.
 * FIX: Gear Score is now calculated dynamically (Total EP).
 * FIX: 2H/Offhand Mutual Exclusion.
 * FIX: Enchant Score Display.
 * UPDATED: Set & Trinket Detection for new Sets/Items
 * UPDATED: Generic AP Equip Effects & Dynamic Set Bonus Scoring
 */

var ITEM_ID_MAP = {};

// ============================================================================
// GEAR PLANNER LOGIC
// ============================================================================

async function loadDatabase() {
    showProgress("Loading Database...");
    try {
        updateProgress(20);
        const [rItems, rEnchants] = await Promise.all([
            fetch('data/items.jsonl'),
            fetch('data/enchants.json')
        ]);
        if (!rItems.ok) throw new Error("Items DB Error " + rItems.status);
        if (!rEnchants.ok) throw new Error("Enchants DB Error " + rEnchants.status);

        // 1. JSONL einlesen: Als Text laden, in Zeilen aufteilen und jede Zeile parsen
        const itemsText = await rItems.text();
        const items = itemsText
            .split(/\r?\n/) // Berücksichtigt Windows (\r\n) und Linux (\n) Zeilenumbrüche
            .filter(line => line.trim() !== '') // Leere Zeilen (z.B. am Ende der Datei) ignorieren
            .map(line => JSON.parse(line)); // Jede einzelne Zeile als JSON parsen

        // ---> NEU: Dynamische Trennung von Instances und Raids <---
        const raidList = [
            "Blackwing Lair", 
            "Emerald Sanctum", 
            "Lower Karazhan Halls", 
            "Molten Core", 
            "Naxxramas",
            "Onyxia's Lair", 
            "Ruins of Ahn'Qiraj", 
            "Temple of Ahn'Qiraj", 
            "Timbermaw Hold", 
            "Upper Karazhan Halls", 
            "Zul'Gurub"
        ];

        items.forEach(item => {
            if (item.sources) {
                item.sources.forEach(src => {
                    // Wenn es als Instance deklariert ist, aber in der Raid-Liste steht -> Kategorie ändern
                    if (src.category === "Instances" && raidList.includes(src.subCategory)) {
                        src.category = "Raids";
                    }
                });
            }
        });

        //const items = await rItems.json();
        const enchants = await rEnchants.json();
        updateProgress(60);

        // Database is already filtered for relevant items
        ITEM_DB = items.filter(i => {
            //i.itemLevel = i.level || i.itemLevel || 0;
            // Filter Junk
            //if ((i.quality || 0) < 2) return false; --> new database junk already filtered out
            // Allow Relic/Idol for DB consistency, but UI controls visibility
            //if (i.itemLevel < 30 && i.slot !== "Relic" && i.slot !== "Idol") return false; --> new database already filtered out

            // CLASS FILTER: 512 = Druid
            //if (i.allowableClasses && i.allowableClasses !== -1 && (i.allowableClasses & 512) === 0) return false; --> new database already filtered out

            // ARMOR FILTER: Only Cloth(1), Leather(2) or None(0)
            //if (i.armorType && i.armorType > 2) return false;
            return true;
        });


        ITEM_ID_MAP = {};
        ITEM_DB.forEach(i => { ITEM_ID_MAP[i.id] = i; });
        ENCHANT_DB = enchants;

        initGearPlannerUI();
        var statusEl = document.getElementById("dbStatus");
        if (statusEl) {
            statusEl.innerText = "Loaded (" + ITEM_DB.length + " items, " + ENCHANT_DB.length + " enchants)";
            statusEl.style.color = "#4caf50";
        }
        updateProgress(100);
    } catch (e) {
        console.error("DB Load Failed:", e);
        var statusEl = document.getElementById("dbStatus");
        if (statusEl) statusEl.innerText = "Error loading database files.";
    } finally { hideProgress(); }
}

function initGearPlannerUI() {
    if (!document.getElementById('charLeftCol')) return;
    renderSlotColumn("left", "charLeftCol");
    renderSlotColumn("right", "charRightCol");
    renderSlotColumn("bottom", "charBottomRow");
    calculateGearStats();
}

function getIconUrl(iconName) {
    if (!iconName) return "https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg";
    var cleanName = iconName.replace(/\\/g, "/").split("/").pop().replace(/\.jpg|\.png/g, "").toLowerCase();
    // Use local folder
    return "data/wow-icons/" + cleanName + ".jpg";
}

function renderSlotColumn(pos, containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    // SLOT_LAYOUT is defined in globals.js (Idol removed there)
    if (!SLOT_LAYOUT[pos]) return;

    SLOT_LAYOUT[pos].forEach(function (slotName) {
        var itemId = GEAR_SELECTION[slotName];
        if (itemId && typeof itemId === 'object' && itemId.id) itemId = itemId.id;

        var item = itemId ? ITEM_ID_MAP[itemId] : null;
        var enchantId = ENCHANT_SELECTION[slotName];
        var enchant = enchantId ? ENCHANT_DB.find(e => e.id == enchantId) : null;

        var div = document.createElement("div");
        div.className = "char-slot";

        div.onmouseenter = function (e) { showTooltip(e, item); };
        div.onmousemove = function (e) { moveTooltip(e); };
        div.onmouseleave = function () { hideTooltip(); };

        var iconUrl = "https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg";
        var rarityClass = "q0";
        var displayName = slotName;
        var statText = "Empty Slot";
        var linkHtml = "";

        if (item) {
            iconUrl = getIconUrl(item.icon);
            rarityClass = "q" + (item.quality || 1);
            displayName = item.name;
            var s = calculateItemScore(item, slotName);
            statText = "Score: " + s.toFixed(1) + (item.requiredLevel ? " | Req: " + item.requiredLevel : "");

            if (item.url) {
                linkHtml = '<a href="' + item.url + '" target="_blank" class="slot-link-btn" title="Open in Database" onclick="event.stopPropagation()">🔗</a>';
            }
        }

        var canEnchant = true;
        if (slotName.includes("Trinket") || slotName.includes("Off") || slotName === "Idol") canEnchant = false;
        if (!item && slotName.includes("Main Hand")) canEnchant = false;
        

        var enchantHtml = "";
        if (canEnchant) {
            var enchName = enchant ? enchant.name : "+ Enchant";
            var enchStyle = enchant ? "color:#0f0; font-size:0.75rem;" : "color:#555; font-size:0.7rem; font-style:italic;";
            var eIdPass = enchant ? enchant.id : 0;

            // Add Score to Display if enchanted
            if (enchant) {
                var eScore = calculateEnchantScore(enchant);
                if (eScore > 0) enchName += " [EP: " + eScore.toFixed(1) + "]";
            }

            enchantHtml = '<div class="slot-enchant-click" onmouseenter="showEnchantTooltip(event, ' + eIdPass + ')" onmousemove="moveTooltip(event)" onmouseleave="hideTooltip()" onclick="event.stopPropagation(); openEnchantSelector(\'' + slotName + '\')" style="' + enchStyle + '; margin-top:2px; cursor:pointer;">' + enchName + '</div>';
        }

        var html = '<div class="slot-icon ' + rarityClass + '" onclick="openItemSelector(\'' + slotName + '\')"><img src="' + iconUrl + '" style="width:100%; height:100%; border-radius:3px;"></div>' +
            '<div class="slot-info">' +
            '<div class="slot-name" onclick="openItemSelector(\'' + slotName + '\')" style="color: ' + getItemColor(item ? item.quality : 0) + '; cursor:pointer;">' + displayName + '</div>' +
            '<span class="slot-stats">' + statText + '</span>' +
            enchantHtml +
            '</div>' +
            linkHtml;
        div.innerHTML = html;
        container.appendChild(div);
    });
}

function getItemColor(q) {
    var colors = ["#9d9d9d", "#ffffff", "#1eff00", "#0070dd", "#a335ee", "#ff8000"];
    return colors[q] || "#9d9d9d";
}

// Tooltips & Modals
// ============================================================================
// SUCHE NACH FUNKTION: function showTooltip(e, item)
// ERSETZE DIE GESAMTE FUNKTION DURCH:
// ============================================================================

function showTooltip(e, item) {
    if (!item) return;
    var tt = document.getElementById("wowTooltip");
    if (!tt) return;
    tt.style.display = "block";

    var qualityColor = getItemColor(item.quality);
    var iconUrl = getIconUrl(item.icon);

    var html = '<div class="tt-header"><div class="tt-icon-small" style="background-image:url(\'' + iconUrl + '\')"></div><div style="flex:1"><div class="tt-name" style="color:' + qualityColor + '">' + item.name + '</div></div></div>';

    // UPDATED: Use requiredLevel instead of itemLevel
    if (item.requiredLevel) html += '<div class="tt-white">Requires Level ' + item.requiredLevel + '</div>';

    // UPDATED: Slot + ArmorType/WeaponType aligned right
    if (item.slot) {
        html += '<div class="tt-white" style="display:flex; justify-content:space-between;">';
        html += '<span>' + item.slot + '</span>';

        // Nutze armorType oder weaponType als Klartext (z.B. "Leather", "Polearm")
        var typeText = item.armorType || item.weaponType || "";
        if (typeText) html += '<span>' + typeText + '</span>';

        html += '</div>';
    }

    if (item.armor) html += '<div class="tt-white">' + item.armor + ' Armor</div>';
    html += '<div class="tt-spacer"></div>';

    if (item.stamina) html += '<div class="tt-white">+' + item.stamina + ' Stamina</div>';
    if (item.intellect) html += '<div class="tt-white">+' + item.intellect + ' Intellect</div>';
    if (item.spirit) html += '<div class="tt-white">+' + item.spirit + ' Spirit</div>';
    if (item.agility) html += '<div class="tt-white">+' + item.agility + ' Agility</div>';
    if (item.strength) html += '<div class="tt-white">+' + item.strength + ' Strength</div>';

    html += '<div class="tt-spacer"></div>';

    // Additional Resistances
    if (item.fireRes) html += '<div class="tt-white">+' + item.fireRes + ' Fire Resistance</div>';
    if (item.natureRes) html += '<div class="tt-white">+' + item.natureRes + ' Nature Resistance</div>';
    if (item.frostRes) html += '<div class="tt-white">+' + item.frostRes + ' Frost Resistance</div>';
    if (item.shadowRes) html += '<div class="tt-white">+' + item.shadowRes + ' Shadow Resistance</div>';
    if (item.arcaneRes) html += '<div class="tt-white">+' + item.arcaneRes + ' Arcane Resistance</div>';

    html += '<div class="tt-spacer"></div>';

    if (item.effects) {
        var eff = item.effects;
        // Custom Texts
        if (eff.custom && Array.isArray(eff.custom)) {
            eff.custom.forEach(function (line) {
                html += '<div class="tt-green">' + line + '</div>';
            });
        }
    }

    // Set Info
    if (item.setName) {
        html += '<div class="tt-spacer"></div>';
        var siblings = ITEM_DB.filter(function (i) { return i.setName === item.setName; });
        var equippedCount = 0;
        for (var slot in GEAR_SELECTION) {
            var gid = GEAR_SELECTION[slot];
            if (gid && (typeof gid === 'number' || typeof gid === 'string') && gid != 0) {
                var gItem = ITEM_ID_MAP[gid];
                if (gItem && gItem.setName === item.setName) equippedCount++;
            }
        }
        html += '<div class="tt-gold">' + item.setName + ' (' + equippedCount + '/' + siblings.length + ')</div>';
        siblings.forEach(function (sItem) {
            var isEquipped = false;
            for (var slot in GEAR_SELECTION) {
                if (GEAR_SELECTION[slot] == sItem.id) isEquipped = true;
            }
            var color = isEquipped ? '#ffff99' : '#888';
            html += '<div style="color:' + color + '; margin-left:10px;">' + sItem.name + '</div>';
        });
        html += '<div class="tt-spacer"></div>';
        if (item.setBonuses) {
            if (typeof item.setBonuses === 'object' && !Array.isArray(item.setBonuses)) {
                var keys = Object.keys(item.setBonuses).sort(function (a, b) { return a - b });
                keys.forEach(function (thresholdStr) {
                    var threshold = parseInt(thresholdStr);
                    var bonusData = item.setBonuses[thresholdStr];
                    var isActive = (equippedCount >= threshold);
                    var color = isActive ? '#0f0' : '#888';

                    if (bonusData.custom && Array.isArray(bonusData.custom)) {
                        bonusData.custom.forEach(function (c) { html += '<div style="color:' + color + '">(' + threshold + ') Set: ' + c + '</div>'; });
                    }
                    else {
                        var parts = [];
                        if (bonusData.attackPower) parts.push("+" + bonusData.attackPower + " AP");
                        if (bonusData.crit) parts.push(bonusData.crit + "% Crit");
                        if (parts.length > 0) html += '<div style="color:' + color + '">(' + threshold + ') Set: ' + parts.join(", ") + '</div>';
                    }
                });
            } else if (Array.isArray(item.setBonuses)) {
                item.setBonuses.forEach(function (bonusText) {
                    var threshold = 0;
                    var match = bonusText.match(/^(\d+)|\((\d+)\)/);
                    if (match) threshold = parseInt(match[1] || match[2]);
                    var isActive = (threshold > 0) ? (equippedCount >= threshold) : false;
                    var color = isActive ? '#0f0' : '#888';
                    html += '<div style="color:' + color + '">' + bonusText + '</div>';
                });
            }
        }
    }

    tt.innerHTML = html;
    moveTooltip(e);
}

// NEW: Enchant Tooltip with Text
function showEnchantTooltip(e, enchantId) {
    if (!enchantId || enchantId === 0) return;
    var ench = ENCHANT_DB.find(x => x.id == enchantId);
    if (!ench) return;

    var tt = document.getElementById("wowTooltip");
    if (!tt) return;
    tt.style.display = "block";

    var html = '<div class="tt-header"><div style="flex:1"><div class="tt-name" style="color:#1eff00">' + ench.name + '</div></div></div>';
    html += '<div class="tt-white">Enchant</div>';
    html += '<div class="tt-spacer"></div>';

    // Description from 'text' property (Green)
    if (ench.text) {
        html += '<div class="tt-green">' + ench.text + '</div>';
    }
    // Fallback if 'text' is missing but 'effects' exist
    else if (ench.effects) {
        var ef = ench.effects;
        if (ef.spellPower) html += '<div class="tt-green">+' + ef.spellPower + ' Spell Power</div>';
        if (ef.intellect) html += '<div class="tt-green">+' + ef.intellect + ' Intellect</div>';
        // Add others if needed
    }

    tt.innerHTML = html;
    moveTooltip(e);
}

function moveTooltip(e) {
    var tt = document.getElementById("wowTooltip");
    if (!tt) return;

    var width = tt.offsetWidth;
    var height = tt.offsetHeight;

    var x = e.clientX + 15;
    var y = e.clientY + 15;

    // X Logic
    if (x + width > window.innerWidth) {
        x = e.clientX - width - 15;
    }

    // Y Logic: Prefer down, if not enough space check up, if neither pin to top
    if (y + height > window.innerHeight) {
        // Check if fits above
        var yUp = e.clientY - height - 10;
        if (yUp < 0) {
            y = 10; // Pin to top
        } else {
            y = yUp;
        }
    }

    tt.style.left = x + "px";
    tt.style.top = y + "px";
}

function hideTooltip() { var tt = document.getElementById("wowTooltip"); if (tt) tt.style.display = "none"; }

// --- ITEM MODAL ---
var CURRENT_SELECTING_SLOT = null;
function openItemSelector(slotName) {
    CURRENT_SELECTING_SLOT = slotName;
    var modal = document.getElementById("itemSelectorModal");
    var title = document.getElementById("modalTitle");
    var input = document.getElementById("itemSearchInput");
    var weaponFilter = document.getElementById("weaponFilter"); // NEU

    if (modal && title && input) {
        title.innerText = "Select " + slotName;
        modal.classList.remove("hidden");
        input.value = ""; input.focus();
        
        // NEU: Filter nur bei Main Hand anzeigen
        if (weaponFilter) {
            weaponFilter.style.display = (slotName === "Main Hand") ? "flex" : "none";
        }
        
        renderItemList();
    }
}

function closeItemModal() { var modal = document.getElementById("itemSelectorModal"); if (modal) modal.classList.add("hidden"); CURRENT_SELECTING_SLOT = null; }

function renderItemList(filterText) {
    var list = document.getElementById("modalItemList");
    if (!list) return;
    list.innerHTML = "";
    var unequipDiv = document.createElement("div");
    unequipDiv.className = "item-row";
    unequipDiv.onclick = function () { selectItem(0); };
    unequipDiv.innerHTML = '<div class="item-row-icon" style="background:#333;"></div><div class="item-row-details"><div class="item-row-name" style="color:#888;">- Unequip -</div></div>';
    list.appendChild(unequipDiv);
    var slotKey = CURRENT_SELECTING_SLOT;
    if (slotKey.includes("Finger")) slotKey = "Finger";
    if (slotKey.includes("Trinket")) slotKey = "Trinket";
    if (slotKey === "Idol") slotKey = "Relic";

    var relevantItems = ITEM_DB.filter(function (i) {
        if (CURRENT_SELECTING_SLOT === "Main Hand") {
            var s = i.slot.toLowerCase().replace(/[\s-]/g, "");
            
            // NEU: Status über die active-Klasse der Buttons abgreifen
            var btn1h = document.getElementById("btnFilter1H");
            var btn2h = document.getElementById("btnFilter2H");
            var filter1h = btn1h ? btn1h.classList.contains("active") : true;
            var filter2h = btn2h ? btn2h.classList.contains("active") : true;

            var is1H = (s === "mainhand" || s === "onehand");
            var is2H = (s === "twohand" || s === "staff" || s === "polearm");

            // Ausschließen basierend auf aktiven Buttons
            if (!filter1h && is1H) return false;
            if (!filter2h && is2H) return false;
            if (!is1H && !is2H) return false; // Alles andere blockieren (Kopf, Brust etc.)

            return i.weaponType;
        }

        // Erlaube das doppelte Ausrüsten, es sei denn, das Item ist als 'unique' markiert
        if (CURRENT_SELECTING_SLOT === "Finger 1" && GEAR_SELECTION["Finger 2"] == i.id && i.unique) return false;
        if (CURRENT_SELECTING_SLOT === "Finger 2" && GEAR_SELECTION["Finger 1"] == i.id && i.unique) return false;
        if (CURRENT_SELECTING_SLOT === "Trinket 1" && GEAR_SELECTION["Trinket 2"] == i.id && i.unique) return false;
        if (CURRENT_SELECTING_SLOT === "Trinket 2" && GEAR_SELECTION["Trinket 1"] == i.id && i.unique) return false;

        if (CURRENT_SELECTING_SLOT === "Off Hand") return (i.slot === "Held In Off-Hand");
        if (CURRENT_SELECTING_SLOT === "Idol") return (i.slot === "Relic" || i.slot === "Idol"); 
        return i.slot === slotKey;
    });

    relevantItems.forEach(function (i) { i.simScore = calculateItemScore(i, CURRENT_SELECTING_SLOT); });
    relevantItems.sort(function (a, b) { return b.simScore - a.simScore; });
    
    if (filterText) {
        var ft = filterText.toLowerCase();
        relevantItems = relevantItems.filter(function (i) { return i.name.toLowerCase().includes(ft); });
    }

    // --- MARGINAL SCORE LOGIC START ---
    var currentEquippedId = GEAR_SELECTION[CURRENT_SELECTING_SLOT];
    if (currentEquippedId && typeof currentEquippedId === 'object' && currentEquippedId.id) {
        currentEquippedId = currentEquippedId.id;
    }
    
    var currentEquippedScore = 0;
    if (currentEquippedId && currentEquippedId !== 0) {
        var currentItem = ITEM_ID_MAP[currentEquippedId];
        if (currentItem) {
            currentEquippedScore = calculateItemScore(currentItem, CURRENT_SELECTING_SLOT);
        }
    }
    // --- MARGINAL SCORE LOGIC END ---

    relevantItems.slice(0, 100).forEach(function (item) {
        var iconUrl = getIconUrl(item.icon);
        var row = document.createElement("div");
        row.className = "item-row";
        row.onclick = function () { selectItem(item.id); };
        row.onmouseenter = function (e) { showTooltip(e, item); };
        row.onmousemove = function (e) { moveTooltip(e); };
        row.onmouseleave = function () { hideTooltip(); };
        var levelText = item.requiredLevel ? 'Req: ' + item.requiredLevel : '';

        // --- DELTA HTML BERECHNUNG ---
        var delta = item.simScore - currentEquippedScore;
        var deltaHtml = "";
        
        if (delta > 0.05) {
            deltaHtml = ' <span style="color:#1eff00; font-size:0.85em; margin-left: 5px;">(+' + delta.toFixed(1) + ')</span>';
        } else if (delta < -0.05) {
            deltaHtml = ' <span style="color:#f44336; font-size:0.85em; margin-left: 5px;">(' + delta.toFixed(1) + ')</span>';
        } else {
            deltaHtml = ' <span style="color:#888; font-size:0.85em; margin-left: 5px;">(0.0)</span>';
        }

        var html = '<div class="item-row-icon"><img src="' + iconUrl + '" style="width:100%; height:100%; border-radius:3px;"></div>' +
            '<div class="item-row-details"><div class="item-row-name" style="color: ' + getItemColor(item.quality) + '">' + item.name + '</div><div class="item-row-sub">' + levelText + '</div></div>' +
            '<div class="item-score-badge" style="display:flex; align-items:center;"><span class="score-label" style="margin-right: 4px;">EP</span>' + item.simScore.toFixed(1) + deltaHtml + '</div>';
            
        row.innerHTML = html;
        list.appendChild(row);
    });
}

function toggleWeaponFilter(type) {
    var btn = document.getElementById("btnFilter" + type);
    if (btn) {
        btn.classList.toggle("active"); // Wechselt zwischen an/aus
        filterItemList(); // Liste direkt neu filtern
    }
}

function filterItemList() { var txt = document.getElementById("itemSearchInput").value; renderItemList(txt); }

function selectItem(itemId) {
    if (CURRENT_SELECTING_SLOT) {
        // --- 2H / OFFHAND LOGIC START ---

        // Check if we are selecting Main Hand
        if (CURRENT_SELECTING_SLOT === "Main Hand" && itemId != 0) {
            var item = ITEM_ID_MAP[itemId];
            // If item is Two-Handed, clear Off Hand
            if (item && (item.slot === "Twohand" || item.slot === "Staff" || item.slot === "Polearm")) {
                GEAR_SELECTION["Off Hand"] = 0;
            }
        }

        // Check if we are selecting Off Hand
        if (CURRENT_SELECTING_SLOT === "Off Hand" && itemId != 0) {
            // Check if Main Hand is Two-Handed
            var mhId = GEAR_SELECTION["Main Hand"];
            if (mhId) {
                var mhItem = ITEM_ID_MAP[mhId];
                if (mhItem && (mhItem.slot === "Two-hand" || mhItem.slot === "Staff" || mhItem.slot === "Polearm")) {
                    GEAR_SELECTION["Main Hand"] = 0; // Unequip 2H
                }
            }
        }
        // --- 2H / OFFHAND LOGIC END ---
        // FIX: Remove Enchant when changing item (Enchants are bound to items)
        if (GEAR_SELECTION[CURRENT_SELECTING_SLOT] != itemId) {
            ENCHANT_SELECTION[CURRENT_SELECTING_SLOT] = 0;
        }

        GEAR_SELECTION[CURRENT_SELECTING_SLOT] = itemId;
    }
    closeItemModal();
    initGearPlannerUI();
    saveCurrentState();
    // FORCE UI UPDATE AFTER GEAR CHANGE
    if (typeof updatePlayerStats === 'function') updatePlayerStats();
    if (typeof updateEnemyInfo === 'function') updateEnemyInfo();
}

// --- ENCHANT MODAL ---
function openEnchantSelector(slotName) {
    CURRENT_SELECTING_SLOT = slotName;
    var modal = document.getElementById("enchantSelectorModal");
    var title = document.getElementById("enchantModalTitle");
    if (modal && title) {
        title.innerText = "Enchant " + slotName;
        modal.classList.remove("hidden");
        renderEnchantList();
    }
}

function closeEnchantModal() { var modal = document.getElementById("enchantSelectorModal"); if (modal) modal.classList.add("hidden"); CURRENT_SELECTING_SLOT = null; }

function renderEnchantList() {
    var list = document.getElementById("modalEnchantList");
    if (!list) return;
    list.innerHTML = "";

    var unequipDiv = document.createElement("div");
    unequipDiv.className = "item-row";
    unequipDiv.onclick = function () { selectEnchant(0); };
    unequipDiv.innerHTML = '<div class="item-row-details"><div class="item-row-name" style="color:#888;">- No Enchant -</div></div>';
    list.appendChild(unequipDiv);

    var slotKey = CURRENT_SELECTING_SLOT;
    if (slotKey.includes("Finger")) slotKey = "Finger";
    if (slotKey === "Main Hand") slotKey = "Two-hand";

    var relevantEnchants = ENCHANT_DB.filter(function (e) {
        // 512 = Druid
        if (e.allowableClasses && e.allowableClasses !== -1) {
            if ((e.allowableClasses & 512) === 0) return false;
        }

        if (CURRENT_SELECTING_SLOT === "Main Hand") {
            // FIX: Check equipped weapon type for 1H vs 2H enchants
            var equippedId = GEAR_SELECTION["Main Hand"];
            var item = ITEM_ID_MAP[equippedId];
            var isTwoHand = false;

            if (item && (item.slot === "Two-hand" || item.slot === "Staff" || item.slot === "Polearm")) {
                isTwoHand = true;
            }

            if (isTwoHand) {
                // Allow "Two-hand" specific and generic "Weapon" enchants
                return (e.slot === "Two-hand");
            } else {
                // Allow "One-hand" specific and generic "Weapon" enchants
                return (e.slot === "One-hand");
            }
        }
        if (CURRENT_SELECTING_SLOT === "Feet") return (e.slot === "Boots" || e.slot === "Feet");
        if (CURRENT_SELECTING_SLOT === "Hands") return (e.slot === "Gloves" || e.slot === "Hands");
        if (CURRENT_SELECTING_SLOT === "Wrist") return (e.slot === "Bracer" || e.slot === "Wrist");
        if (CURRENT_SELECTING_SLOT === "Back") return (e.slot === "Cloak" || e.slot === "Back");
        if (CURRENT_SELECTING_SLOT.includes("Finger")) return (e.slot === "Finger");

        return e.slot === CURRENT_SELECTING_SLOT || e.slot === slotKey;
    });

    relevantEnchants.forEach(function (e) { e.simScore = calculateEnchantScore(e); });
    relevantEnchants.sort(function (a, b) { return b.simScore - a.simScore; });

    relevantEnchants.forEach(function (ench) {
        var row = document.createElement("div");
        row.className = "item-row";
        row.onclick = function () { selectEnchant(ench.id); };
        row.onmouseenter = function (e) { showEnchantTooltip(e, ench.id); };
        row.onmousemove = function (e) { moveTooltip(e); };
        row.onmouseleave = function () { hideTooltip(); };

        var desc = ench.text || "";

        var html = '<div class="item-row-details"><div class="item-row-name" style="color: #1eff00;">' + ench.name + '</div><div class="item-row-sub">' + desc + '</div></div>' +
            '<div class="item-score-badge"><span class="score-label">EP</span>' + ench.simScore.toFixed(1) + '</div>';

        row.innerHTML = html;
        list.appendChild(row);
    });
}

function selectEnchant(enchId) {
    if (CURRENT_SELECTING_SLOT) ENCHANT_SELECTION[CURRENT_SELECTING_SLOT] = enchId;
    closeEnchantModal();
    initGearPlannerUI();
    saveCurrentState();
    if (typeof updatePlayerStats === 'function') updatePlayerStats();
    if (typeof updateEnemyInfo === 'function') updateEnemyInfo();
}

function resetGear() {
    GEAR_SELECTION = {};
    ENCHANT_SELECTION = {};
    initGearPlannerUI();
    if (typeof updatePlayerStats === 'function') updatePlayerStats();
}

function recalcItemScores() {
    if (!document.getElementById("itemSelectorModal").classList.contains("hidden")) {
        renderItemList(document.getElementById("itemSearchInput").value);
    }
    if (!document.getElementById("enchantSelectorModal").classList.contains("hidden")) {
        renderEnchantList();
    }
    initGearPlannerUI();

}

// SCORING
function calculateItemScore(item, slotNameOverride) {
    if (!item) return 0;
    var wAP = parseFloat(getVal("weight_ap") || 1.0);
    var wStr = parseFloat(getVal("weight_str") || 2.64);
    var wAgi = parseFloat(getVal("weight_agi") || 2.76);
    var wHit = parseFloat(getVal("weight_hit") || 31.85);
    var wCrit = parseFloat(getVal("weight_crit") || 30.13);
    var wHaste = parseFloat(getVal("weight_haste") || 13.6);
    var wArp = parseFloat(getVal("weight_arp") || 0.5);

    var score = 0;
    var e = item.effects || {};

    // Base Stats
    score += (item.strength || 0) * wStr;
    score += (item.agility || 0) * wAgi;

    // Explicit Effects
    score += (e.attackPower || 0) * wAP;
    score += (e.crit || 0) * wCrit;
    score += (e.Hit || 0) * wHit;
    score += (e.attackSpeed || 0) * wHaste;
    score += (e.armorPen || 0) * wArp;

    // Dynamic Set Bonuses (Explicit Fields)
    if (item.setName) {
        var setSiblings = 0;
        // Count equipped items of the same set (excluding current slot if comparing)
        for (var sKey in GEAR_SELECTION) {
            if (slotNameOverride && sKey === slotNameOverride) continue;
            var selId = GEAR_SELECTION[sKey];
            if (selId && typeof selId === 'object') selId = selId.id;
            if (selId && selId !== 0) {
                var sItem = ITEM_ID_MAP[selId];
                if (sItem && sItem.setName === item.setName) {
                    setSiblings++;
                }
            }
        }
        var newCount = setSiblings + 1; // Count if we equip this item

        if (item.setBonuses && typeof item.setBonuses === 'object') {
            for (var thrStr in item.setBonuses) {
                var thr = parseInt(thrStr);
                // Only add score if this specific item triggers the bonus (bridges the gap)
                if (thr > setSiblings && thr <= newCount) {
                    var b = item.setBonuses[thrStr];
                    if (b) {
                        if (b.attackPower) score += b.attackPower * wAP;
                        if (b.strength) score += b.strength * wStr;
                        if (b.agility) score += b.agility * wAgi;
                        if (b.crit) score += b.crit * wCrit;
                        if (b.Hit) score += b.Hit * wHit;
                        if (b.hit) score += b.hit * wHit;
                        if (b.attackSpeed) score += b.attackSpeed * wHaste;
                        //if (b.armorPen) score += b.armorPen * wArp;
                    }
                }
            }
        }
    }

    return score;
}

function calculateEnchantScore(ench) {
    if (!ench) return 0;
    var wAP = parseFloat(getVal("weight_ap") || 1.0);
    var wStr = parseFloat(getVal("weight_str") || 2.64);
    var wAgi = parseFloat(getVal("weight_agi") || 2.76);
    var wHit = parseFloat(getVal("weight_hit") || 31.85);
    var wCrit = parseFloat(getVal("weight_crit") || 30.13);
    var wHaste = parseFloat(getVal("weight_haste") || 13.6);
    var wArp = parseFloat(getVal("weight_arp") || 0.5);

    var score = 0;
    var stats = ench.effects || {};
    score += (ench.strength || 0) * wStr;
    score += (ench.agility || 0) * wAgi;
    score += (stats.attackPower || 0) * wAP;
    score += (stats.crit || 0) * wCrit;
    score += (stats.Hit || 0) * wHit;
    score += (stats.attackSpeed || 0) * wHaste;
    score += (stats.armorPen || 0) * wArp;
    return score;
}

// ----------------------------------------------------------------------------
// STAT CALCULATION ENGINE (Updated for Checkboxes & 1.18 Logic)
// ----------------------------------------------------------------------------
function calculateGearStats() {
    var raceSel = document.getElementById("char_race");
    var raceName = raceSel ? raceSel.value : "Tauren";
    var race = RACE_STATS[raceName] || RACE_STATS["Tauren"];

    // 1. Calculate Hidden Base Values
    var hiddenBaseAp = race.ap;
    var hiddenBaseCrit = race.crit;

    // 2. Initialize Bonus Accumulators
    var bonus = { str: 0, agi: 0, int: 0, ap: 0, crit: 0, hit: 0, haste: 0, arp: 0 };
    var setCounts = {};
    var activeTrinketNames = [];
    var activeIdolNames = [];
    var activeItemNames = [];

    // Total Gear Score accumulator
    var totalScore = 0;

    // 3. Sum Items
    for (var slot in GEAR_SELECTION) {
        var id = GEAR_SELECTION[slot];
        if (id && typeof id === 'object' && id.id) id = id.id;
        if (id && id !== 0) {
            var item = ITEM_ID_MAP[id];
            if (item) {
                // Add to Total Score
                totalScore += calculateItemScore(item, slot);

                var e = item.effects || {};
                bonus.str += (item.strength || 0);
                bonus.agi += (item.agility || 0);
                bonus.int += (item.intellect || 0);

                // UPDATED: Direct mapping from JSON
                bonus.ap += (e.attackPower || 0);
                bonus.crit += (e.crit || 0);
                bonus.hit += (e.Hit || 0); // Note capitalization "Hit"
                bonus.haste += (e.attackSpeed || 0); // Mapping attackSpeed to Haste
                bonus.arp += (e.armorPen || 0);

                // NOTE: 'custom' parsing removed for stats.

                if (item.setName) {
                    if (!setCounts[item.setName]) setCounts[item.setName] = 0;
                    setCounts[item.setName]++;
                }

                // Collect Trinket Names for Auto-Config
                if (slot === "Trinket 1" || slot === "Trinket 2") {
                    activeTrinketNames.push(item.name.toLowerCase());
                }
                if (slot === "Idol") {
                    activeIdolNames.push(item.name.toLowerCase()); // Variable muss darüber deklariert werden
                }

                if (item.name) {
                    activeItemNames.push(item.name.toLowerCase());
                }


            }
        }
    }

    // 4. Sum Enchants
    for (var slot in ENCHANT_SELECTION) {
        var eid = ENCHANT_SELECTION[slot];
        if (eid && eid !== 0) {
            var ench = ENCHANT_DB.find(e => e.id == eid);
            if (ench && ench.effects) {
                // Add Enchant Score
                totalScore += calculateEnchantScore(ench);

                bonus.str += (ench.effects.strength || 0);
                bonus.agi += (ench.effects.agility || 0);
                bonus.ap += (ench.effects.attackPower || 0);
                bonus.crit += (ench.effects.crit || 0);
                bonus.hit += (ench.effects.Hit || 0);
                bonus.haste += (ench.effects.attackSpeed || 0);
            }
        }
    }

    // 5. BUFFS & CONSUMABLES (Checkbox Logic)

    // MotW (Improved) (+16 All)
    if (getVal("buff_motw")) { bonus.str += 16; bonus.agi += 16; bonus.int += 16; }

    // Blessing of Might (Improved) (+240 AP)
    if (getVal("buff_might")) bonus.ap += 240;

    // Battle Shout (Improved) (+290 AP)
    if (getVal("buff_bs")) bonus.ap += 290;

    // Totems
    if (getVal("buff_soe_totem")) bonus.str += 77;
    if (getVal("buff_goe_totem")) bonus.agi += 77;

    // Trueshot Aura (Base + % AP) - Fixed Logic
    // Increases AP by 55 and %AP by 5%
    var apMod = 0.0;
    if (getVal("buff_tsa")) {
        bonus.ap += 55;
        apMod += 5;
    }

    // Consumables
    // Stones
    if (getVal("consum_elemental")) bonus.crit += 2;
    if (getVal("consum_consecrated") && getVal("enemy_type") === "undead") bonus.ap += 100;

    // Elixirs
    if (getVal("consum_mongoose")) { bonus.agi += 25; bonus.crit += 1; }

    // Blasted Lands
    if (getVal("consum_scorpok")) bonus.agi += 25;
    if (getVal("consum_roids")) bonus.str += 25;

    // Jujus
    if (getVal("consum_juju_power")) bonus.str += 30;
    if (getVal("consum_firewater")) bonus.ap += 35;
    if (getVal("consum_juju_might")) bonus.ap += 40;

    // Food
    if (getVal("consum_food_str")) bonus.str += 20;
    if (getVal("consum_food_agi")) bonus.agi += 10;
    if (getVal("consum_food_haste")) bonus.haste += 2;

    // Warchief Removed

    // --- HELPER FÜR TALENTE ---
    var getTal = function(id) { return (typeof TALENT_CONFIG !== 'undefined' ? (TALENT_CONFIG[id] || 0) : 0); };

    // 6. APPLY STAT MULTIPLIERS
    var statMod = 0;
    if (getVal("buff_kings")) statMod += 10;
    
    // Heart of the Wild (4% pro Punkt, max 20%)
    var hotwMod = getTal("heartOfTheWild") * 4; 

    // Total Attributes
    var finalStr = Math.floor((bonus.str + race.str) * (1 + (statMod + hotwMod) / 100));
    var finalInt = Math.floor((bonus.int + race.int) * (1 + (statMod + hotwMod) / 100));
    var finalAgi = Math.floor((bonus.agi + race.agi) * (1 + (statMod) / 100)); // Kein HotW auf Agi

    // Mana Calculation
    var baseMana = 2670;
    var finalMana = baseMana + (finalInt - race.int) * 15;

    // 7. FINAL CALCULATIONS - UPDATED FORMULAS

    // Predatory Strikes: 3% (1 Pkt), 6% (2 Pkt), 10% (3 Pkt) AP 
    var ptsPred = getTal("predatoryStrikes");
    var predApMod = (ptsPred === 3) ? 10 : (ptsPred * 3);
    apMod += predApMod;

    // AP = RaceAP(Base) + ((AddedStr)*2) + ((AddedAgi)*1) + BonusAP
    var finalAP = Math.floor((race.ap + ((finalStr - race.str) * 2) + (finalAgi - race.agi) + bonus.ap) * (1 + apMod / 100));

    // Crit = RaceCrit(Base) + (AddedAgi / 20) + BonusCrit
    var critFromAgi = (finalAgi - race.agi) / 20.0;
    var finalCrit = race.crit + critFromAgi + bonus.crit;

    // Talent/Buff Crits
    if (getVal("buff_lotp") || getTal("leaderOfThePack") > 0) finalCrit += 3.0;
    
    // Sharpened Claws (2% pro Punkt, max 6%)
    finalCrit += (getTal("sharpenedClaws") * 2.0); 

    // Hit
    // Natural Weapons bringt 1% Hit pro Punkt (max 3%)
    var finalHit = bonus.hit + getTal("naturalWeapons");

    // 8. UPDATE UI

    // Write to Inputs
    var isManual = document.getElementById("manual_stats") ? document.getElementById("manual_stats").checked : false;
    var updateInput = function (id, val, isPct) {
        var el = document.getElementById(id);
        if (!el) return;
        if (isManual) { el.disabled = false; }
        else { el.disabled = true; el.value = isPct ? val.toFixed(2) : Math.floor(val); }
    };

    updateInput("stat_str", finalStr, false);
    updateInput("stat_agi", finalAgi, false);
    updateInput("stat_ap", finalAP, false);
    updateInput("stat_crit", finalCrit, true);
    updateInput("stat_hit", finalHit, false);
    updateInput("stat_haste", bonus.haste, false);
    updateInput("stat_arp", bonus.arp, false); // In der Liste der updateInput-Aufrufe ergänzen
    updateInput("stat_wep_skill", race.wepSkill || 300, false);
    updateInput("stat_wep_dmg_min", race.minDmg, false);
    updateInput("stat_wep_dmg_max", race.maxDmg, false);
    updateInput("mana_pool", finalMana, false);

    // Update Planner Preview Box (Expanded)
    var elP_GS = document.getElementById("gp_gs"); if (elP_GS) elP_GS.innerText = totalScore.toFixed(1);

    var elP_Str = document.getElementById("gp_str"); if (elP_Str) elP_Str.innerText = finalStr;
    var elP_Agi = document.getElementById("gp_agi"); if (elP_Agi) elP_Agi.innerText = finalAgi;
    var elP_AP = document.getElementById("gp_ap"); if (elP_AP) elP_AP.innerText = Math.floor(finalAP);
    var elP_Crit = document.getElementById("gp_crit"); if (elP_Crit) elP_Crit.innerText = finalCrit.toFixed(2) + "%";
    var elP_Hit = document.getElementById("gp_hit"); if (elP_Hit) elP_Hit.innerText = finalHit.toFixed(2) + "%";
    var elP_Haste = document.getElementById("gp_haste"); if (elP_Haste) elP_Haste.innerText = bonus.haste.toFixed(2) + "%";

    // 9. DETECT AND SET "SPECIAL GEAR" CHECKBOXES
    // Helper to check set counts using likely names
    var checkSet = function (id, namePart, threshold) {
        var el = document.getElementById(id);
        if (!el) return;
        var count = 0;
        for (var setName in setCounts) {
            if (setName.toLowerCase().includes(namePart.toLowerCase())) {
                count += setCounts[setName];
            }
        }
        el.checked = (count >= threshold);

        // NEU: Klasse für Hervorhebung toggeln (Elternelement .custom-checkbox)
        if (el.parentElement) {
            if (el.checked) el.parentElement.classList.add("gear-active");
            else el.parentElement.classList.remove("gear-active");
        }
    };

    // Helper to check specific items by name
    var checkItem = function (id, searchName) {
        var el = document.getElementById(id);
        if (!el) return;
        var found = false;
        activeItemNames.forEach(function (n) {
            if (n.includes(searchName.toLowerCase())) found = true;
        });
        el.checked = found;

        if (el.parentElement) {
            if (found) el.parentElement.classList.add("gear-active");
            else el.parentElement.classList.remove("gear-active");
        }
    };

    // Spellstrike & BoED
    checkItem("gear_blade_eternal_darkness", "blade of eternal darkness");
    checkItem("gear_ring_electrical_binding", "ring of electrical binding");
    checkItem("gear_electro_lantern", "repaired electro-lantern");
    checkItem("gear_markali", "mar'kali, the midnight star");
    checkItem("gear_thunder_lizard", "thunder lizard's hide");
    checkItem("gear_blazefury_medallion", "blazefury medallion");

    // Incendosaur Set
    checkItem("gear_incendosaur_pauldrons", "incendosaur skin pauldrons");
    checkItem("gear_incendosaur_boots", "incendosaur skin boots");
    checkItem("gear_incendosaur_gloves", "incendosaur skin gloves");
    checkSet("set_incendosaur_2p", "incendosaur skin", 2);
    checkSet("set_incendosaur_3p", "incendosaur skin", 3);

    // T0.5 (Feralheart)
    checkSet("set_t05_4p", "Wildheart Raiment", 4);

    // T1 (Cenarion)
    checkSet("set_cenarion_5p", "Cenarion Harness", 5);
    checkSet("set_cenarion_8p", "Cenarion Harness", 8);

    // T2.5 (Genesis)
    checkSet("set_genesis_3p", "Genesis Harness", 3);
    checkSet("set_genesis_5p", "Genesis Harness", 5);

    // T3.5 (Talon) - Matches "Harness of the Talon" or "Talon's Vengeance" etc.
    checkSet("set_talon_3p", "Harness of the Talon", 3);
    checkSet("set_talon_5p", "Harness of the Talon", 5);

    // Stormshroud Armor
    checkSet("set_stormshroud_3p", "Stormshroud Armor", 3);
    checkSet("set_stormshroud_4p", "Stormshroud Armor", 4);

    // Helper to check Trinkets
    var checkTrinket = function (id, searchName) {
        var el = document.getElementById(id);
        if (!el) return;
        var found = false;
        activeTrinketNames.forEach(function (n) {
            if (n.includes(searchName.toLowerCase())) found = true;
        });
        el.checked = found;

        if (el.parentElement) {
            if (found) el.parentElement.classList.add("gear-active");
            else el.parentElement.classList.remove("gear-active");
        }
    };

    checkTrinket("trinket_swarmguard", "Badge of the Swarmguard");
    checkTrinket("trinket_slayer", "Slayer's Crest");
    checkTrinket("trinket_spider", "Kiss of the Spider");
    checkTrinket("trinket_jomgabbar", "Jom Gabbar");
    checkTrinket("trinket_earthstrike", "Earthstrike");
    checkTrinket("trinket_emberstone", "Molten Emberstone");

    checkTrinket("trinket_shieldrender", "Shieldrender Talisman");
    checkTrinket("trinket_venoms", "Vial of Potent Venoms");
    checkTrinket("trinket_maelstrom", "Darkmoon Card: Maelstrom");
    checkTrinket("trinket_hoj", "Hand of Justice");
    checkTrinket("trinket_coil", "Overloaded Heating Coil");
    checkTrinket("trinket_zhm", "Zandalarian Hero Medallion");

    // Helper to check Idols
    var checkIdol = function (id, searchName) {
        var el = document.getElementById(id);
        if (!el) return;
        var found = false;
        activeIdolNames.forEach(function (n) {
            if (n.includes(searchName.toLowerCase())) found = true;
        });
        el.checked = found;

        if (el.parentElement) {
            if (found) el.parentElement.classList.add("gear-active");
            else el.parentElement.classList.remove("gear-active");
        }
    };

    checkIdol("idol_savagery", "savagery");
    checkIdol("idol_emeral_rot", "emerald rot");
    checkIdol("idol_ferocity", "ferocity");
    checkIdol("idol_laceration", "laceration");

    // NEW: Detect Gift of Ferocity Enchant on Head
    var elGoF = document.getElementById("gear_gift_of_ferocity");
    if (elGoF) {
        var headEnchantId = ENCHANT_SELECTION["Head"];
        var hasGoF = false;
        if (headEnchantId) {
            // Suche den Enchant in der DB
            var ench = ENCHANT_DB.find(function (e) { return e.id == headEnchantId; });
            // Prüfe auf Namen (Case Insensitive zur Sicherheit)
            if (ench && ench.name.toLowerCase().includes("gift of ferocity")) {
                hasGoF = true;
            }
        }
        elGoF.checked = hasGoF;

        // NEU: Highlight
        if (elGoF.parentElement) {
            if (hasGoF) elGoF.parentElement.classList.add("gear-active");
            else elGoF.parentElement.classList.remove("gear-active");
        }
    }
}

// ============================================================================
// GEAR PRESET LOGIC (BiS & Custom)
// ============================================================================
//var GEAR_PRESETS = {}; // Hier definierst du später deine Presets

function populateBiSDropdown() {
    var sel = document.getElementById("bis_preset_select");
    if (!sel) return;
    
    sel.innerHTML = '<option value="">-- Select Preset --</option>';
    
    // Globale Presets
    if (typeof GEAR_PRESETS !== 'undefined') {
        var grpDef = document.createElement("optgroup");
        grpDef.label = "Default Presets";
        Object.keys(GEAR_PRESETS).forEach(function(k) {
            var opt = document.createElement("option");
            opt.value = "def_" + k;
            opt.innerText = k;
            grpDef.appendChild(opt);
        });
        sel.appendChild(grpDef);
    }

    // Lokale Presets (aus localStorage)
    var customStr = localStorage.getItem("feral_sim_custom_gear");
    if (customStr) {
        try {
            var custom = JSON.parse(customStr);
            var grpCus = document.createElement("optgroup");
            grpCus.label = "My Saved Gear";
            Object.keys(custom).forEach(function(k) {
                var opt = document.createElement("option");
                opt.value = "cus_" + k;
                opt.innerText = k;
                grpCus.appendChild(opt);
            });
            if (grpCus.children.length > 0) sel.appendChild(grpCus);
        } catch(e) {}
    }
}

function openGearPresetModal() {
    var modal = document.getElementById('gearPresetModal');
    if (modal) {
        modal.classList.remove('hidden');
    } else {
        console.error("Modal mit der ID 'gearPresetModal' wurde nicht gefunden!");
    }
}

function closeGearPresetModal() {
    var modal = document.getElementById('gearPresetModal');
    if (modal) modal.classList.add('hidden');
}
// 1. Wird beim Klick auf "Load" aufgerufen
window.loadBiSPreset = function() {
    var sel = document.getElementById("bis_preset_select");
    if (!sel || !sel.value) { 
        showToast("Please select a preset from the dropdown first."); 
        return; 
    }
    openGearPresetModal();
};

// 2. Wird beim Klick auf "Yes, replace" im Modal aufgerufen
window.confirmLoadBiSPreset = function() {
    var sel = document.getElementById("bis_preset_select");
    if (!sel) return;
    var val = sel.value;

    var preset = null;
    if (val.startsWith("def_")) {
        var k = val.substring(4);
        preset = GEAR_PRESETS[k];
    } else if (val.startsWith("cus_")) {
        var k = val.substring(4);
        var custom = JSON.parse(localStorage.getItem("boomkin_sim_custom_gear") || "{}");
        preset = custom[k];
    }

    if (!preset) {
        closeGearPresetModal();
        return;
    }

    GEAR_SELECTION = {};
    ENCHANT_SELECTION = {};

    if (preset.gear) {
        for (var slot in preset.gear) {
            if (preset.gear[slot] !== 0 && preset.gear[slot] !== "") {
                GEAR_SELECTION[slot] = preset.gear[slot];
            }
        }
    }
    if (preset.enchants) {
        for (var slot in preset.enchants) {
            if (preset.enchants[slot] !== 0 && preset.enchants[slot] !== "") {
                ENCHANT_SELECTION[slot] = preset.enchants[slot];
            }
        }
    }

    if (typeof initGearPlannerUI === 'function') initGearPlannerUI();
    saveCurrentState();
    
    closeGearPresetModal();
    showToast("Gear Preset loaded!");
};

function saveCustomGearPreset() {
    if (Object.keys(GEAR_SELECTION).length === 0) { showToast("No gear equipped to save."); return; }
    
    var safeName = prompt("Enter a name for your Gear Preset:");
    if (!safeName) return;
    
    var custom = JSON.parse(localStorage.getItem("feral_sim_custom_gear") || "{}");
    custom[safeName] = {
        gear: JSON.parse(JSON.stringify(GEAR_SELECTION)),
        enchants: JSON.parse(JSON.stringify(ENCHANT_SELECTION))
    };
    localStorage.setItem("feral_sim_custom_gear", JSON.stringify(custom));
    
    populateBiSDropdown();
    document.getElementById("bis_preset_select").value = "cus_" + safeName;
    showToast("Gear Preset saved!");
}

function deleteCustomGearPreset() {
    var val = document.getElementById("bis_preset_select").value;
    if (!val || !val.startsWith("cus_")) { showToast("Please select a saved preset to delete."); return; }
    if (!confirm("Are you sure you want to delete this gear preset?")) return;
    
    var k = val.substring(4);
    var custom = JSON.parse(localStorage.getItem("feral_sim_custom_gear") || "{}");
    delete custom[k];
    localStorage.setItem("feral_sim_custom_gear", JSON.stringify(custom));
    
    populateBiSDropdown();
    showToast("Preset deleted!");
}

// ============================================================================
// SOURCE FILTER LOGIC (Global Multi-Level Menu)
// ============================================================================
var SOURCE_TREE = {};
var WORLD_DROPS_ENABLED = true;

function initSourceTree() {
    SOURCE_TREE = {};
    WORLD_DROPS_ENABLED = true;

    ITEM_DB.forEach(item => {
        if (!item.sources || item.sources.length === 0) {
            // World drop
        } else {
            item.sources.forEach(src => {
                let cat = src.category || "Unknown";
                let sub = src.subCategory || "Unknown";
                let det = src.detail || ""; 

                if (!SOURCE_TREE[cat]) SOURCE_TREE[cat] = {};
                if (!SOURCE_TREE[cat][sub]) SOURCE_TREE[cat][sub] = {};
                if (SOURCE_TREE[cat][sub][det] === undefined) {
                    SOURCE_TREE[cat][sub][det] = true; // Default: Alles ist anwählbar
                }
            });
        }
    });
    // Menü nur noch EINMAL bauen, statt bei jedem Klick!
    buildSourceMenuDOM(); 
}

function buildSourceMenuDOM() {
    var root = document.getElementById("sourceMenuRoot");
    if (!root) return;
    root.innerHTML = "";

    // 1. Checkbox für World Drops
    root.appendChild(createMenuItem("World Drops / Other", WORLD_DROPS_ENABLED, "world", null, null, null, false));

    // 2. Checkboxen für dynamische Kategorien
    Object.keys(SOURCE_TREE).sort().forEach(cat => {
        let catNode = createMenuItem(cat, isCategoryChecked(cat), "cat", cat, null, null, true);

        let subMenu = document.createElement("ul");
        subMenu.className = "submenu";

        Object.keys(SOURCE_TREE[cat]).sort().forEach(sub => {
            let subNode = createMenuItem(sub, isSubCategoryChecked(cat, sub), "sub", cat, sub, null, true);

            let detMenu = document.createElement("ul");
            detMenu.className = "submenu";

            Object.keys(SOURCE_TREE[cat][sub]).sort().forEach(det => {
                let label = det === "" ? "General / None" : det;
                let detNode = createMenuItem(label, SOURCE_TREE[cat][sub][det], "det", cat, sub, det, false);
                detMenu.appendChild(detNode);
            });

            subNode.appendChild(detMenu);
            subMenu.appendChild(subNode);
        });

        catNode.appendChild(subMenu);
        root.appendChild(catNode);
    });
}

function createMenuItem(label, isChecked, type, cat, sub, det, hasSubmenu) {
    let li = document.createElement("li");
    if (hasSubmenu) li.className = "has-submenu";

    let cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "source-checkbox";
    cb.checked = isChecked;
    
    // Wir speichern die Art der Checkbox als Daten-Attribut im Element
    cb.dataset.type = type;
    if (cat !== null) cb.dataset.cat = cat;
    if (sub !== null) cb.dataset.sub = sub;
    if (det !== null) cb.dataset.det = det;

    cb.onclick = function(e) { e.stopPropagation(); }; 
    cb.onchange = function(e) {
        handleSourceChange(type, cat, sub, det, e.target.checked);
    };

    let span = document.createElement("span");
    span.innerText = label;

    li.onclick = function(e) {
        if (e.target !== cb) {
            e.stopPropagation();
            cb.checked = !cb.checked;
            handleSourceChange(type, cat, sub, det, cb.checked);
        }
    };

    li.appendChild(cb);
    li.appendChild(span);
    return li;
}

function handleSourceChange(type, cat, sub, det, isChecked) {
    // 1. Daten im Hintergrund updaten
    if (type === "world") {
        WORLD_DROPS_ENABLED = isChecked;
    } else if (type === "cat") {
        setCategory(cat, isChecked);
    } else if (type === "sub") {
        setSubCategory(cat, sub, isChecked);
    } else if (type === "det") {
        SOURCE_TREE[cat][sub][det] = isChecked;
    }

    // 2. Optische Darstellung (Haken) live anpassen OHNE das HTML zu löschen
    syncCheckboxesUI();
    
    // 3. Item Liste neu filtern, falls das Modal offen ist
    updateItemListsIfOpen();
}

function syncCheckboxesUI() {
    let checkboxes = document.querySelectorAll(".source-checkbox");
    checkboxes.forEach(cb => {
        let type = cb.dataset.type;
        let cat = cb.dataset.cat;
        let sub = cb.dataset.sub;
        let det = cb.dataset.det;

        // Reset the indeterminate state before re-evaluating
        cb.indeterminate = false;

        if (type === "world") {
            cb.checked = WORLD_DROPS_ENABLED;
        } else if (type === "cat") {
            let checkedState = getCategoryCheckState(cat);
            cb.checked = checkedState.checked;
            cb.indeterminate = checkedState.indeterminate;
        } else if (type === "sub") {
            let checkedState = getSubCategoryCheckState(cat, sub);
            cb.checked = checkedState.checked;
            cb.indeterminate = checkedState.indeterminate;
        } else if (type === "det") {
            cb.checked = SOURCE_TREE[cat][sub][det];
        }
    });
}

// --- NEUE HELPER FUNKTIONEN FÜR INDETERMINATE STATUS ---

// Returnt ein Objekt: { checked: boolean, indeterminate: boolean }
function getCategoryCheckState(cat) {
    let totalSubs = 0;
    let checkedSubs = 0;
    let hasIndeterminateSub = false;

    for (let sub in SOURCE_TREE[cat]) {
        totalSubs++;
        let subState = getSubCategoryCheckState(cat, sub);
        if (subState.checked) checkedSubs++;
        if (subState.indeterminate) hasIndeterminateSub = true;
    }

    if (totalSubs === 0) return { checked: false, indeterminate: false };

    if (checkedSubs === totalSubs && !hasIndeterminateSub) {
        return { checked: true, indeterminate: false }; // Alle an
    } else if (checkedSubs === 0 && !hasIndeterminateSub) {
        return { checked: false, indeterminate: false }; // Alle aus
    } else {
        return { checked: false, indeterminate: true }; // Teilweise
    }
}

function getSubCategoryCheckState(cat, sub) {
    let totalDets = 0;
    let checkedDets = 0;

    for (let det in SOURCE_TREE[cat][sub]) {
        totalDets++;
        if (SOURCE_TREE[cat][sub][det]) checkedDets++;
    }

    if (totalDets === 0) return { checked: false, indeterminate: false };

    if (checkedDets === totalDets) {
        return { checked: true, indeterminate: false }; // Alle an
    } else if (checkedDets === 0) {
        return { checked: false, indeterminate: false }; // Alle aus
    } else {
        return { checked: false, indeterminate: true }; // Teilweise
    }
}

// Wir ersetzen auch die alten isCategoryChecked / isSubCategoryChecked, 
// damit handleSourceChange sauber arbeitet.
function isCategoryChecked(cat) {
    return getCategoryCheckState(cat).checked;
}
function isSubCategoryChecked(cat, sub) {
    return getSubCategoryCheckState(cat, sub).checked;
}

function setCategory(cat, val) {
    for (let sub in SOURCE_TREE[cat]) setSubCategory(cat, sub, val);
}
function setSubCategory(cat, sub, val) {
    for (let det in SOURCE_TREE[cat][sub]) SOURCE_TREE[cat][sub][det] = val;
}
function updateItemListsIfOpen() {
    var modal = document.getElementById("itemSelectorModal");
    if (modal && !modal.classList.contains("hidden")) {
        filterItemList();
    }
}

function toggleSourceMenu(e) {
    if(e) e.stopPropagation();
    var menu = document.getElementById("sourceMenuRoot");
    menu.style.display = (menu.style.display === "none" || menu.style.display === "") ? "block" : "none";
}

document.addEventListener("click", function(e) {
    var menu = document.getElementById("sourceMenuRoot");
    var btn = document.getElementById("sourceMenuBtn");
    if (menu && menu.style.display === "block") {
        if (!menu.contains(e.target) && e.target !== btn) {
            menu.style.display = "none";
        }
    }
});
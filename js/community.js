/**
 * Feral Simulation - File 7: Community Builds (Supabase & Discord)
 */

// ============================================================================
// 1. SUPABASE INITIALIZATION
// ============================================================================

const SUPABASE_URL = 'https://qrjqteqvjbnoatrwwgac.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Tyac8R3kx3K5p6agg9JRIw_FM80Aszk';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let CURRENT_USER = null;
let CURRENT_COMMUNITY_TAB = 'sim';

// ============================================================================
// CUSTOM MODAL LOGIC (Ersatz für window.alert & window.confirm)
// ============================================================================
let confirmCallback = null;

function showCustomAlert(title, message) {
    document.getElementById('alertModalTitle').innerText = title;
    document.getElementById('alertModalMessage').innerText = message;
    document.getElementById('customAlertModal').classList.remove('hidden');
}

function closeCustomAlert() {
    document.getElementById('customAlertModal').classList.add('hidden');
}

function showCustomConfirm(title, message, callback) {
    document.getElementById('confirmModalTitle').innerText = title;
    document.getElementById('confirmModalMessage').innerText = message;
    confirmCallback = callback;
    document.getElementById('customConfirmModal').classList.remove('hidden');
}

function closeCustomConfirm(confirmed) {
    document.getElementById('customConfirmModal').classList.add('hidden');
    if (confirmed && confirmCallback) confirmCallback();
    confirmCallback = null;
}

// ============================================================================
// 2. AUTHENTICATION (DISCORD)
// ============================================================================

// Listener für Auth-Änderungen
supabaseClient.auth.onAuthStateChange((event, session) => {
    CURRENT_USER = session?.user ?? null;
    updateAuthUI();

    // NEU: Wenn der Login erfolgreich war und wir aus Discord zurückkommen
    if (event === 'SIGNED_IN') {
        // Prüfen, ob der Token noch in der Adresszeile hängt
        if (window.location.hash.includes('access_token')) {
            
            // 1. Die URL aufräumen (entfernt den riesigen Text, ohne die Seite neu zu laden)
            window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
            
            // 2. Das Community Modal direkt wieder öffnen
            openCommunityModal(CURRENT_COMMUNITY_TAB);
            
            // 3. Erfolgsmeldung zeigen
            showToast("Successfully logged in!");
        }
    }
});

// Initiale Prüfung beim Laden der Seite
supabaseClient.auth.getSession().then(({ data: { session } }) => {
    CURRENT_USER = session?.user ?? null;
    updateAuthUI();
});

function updateAuthUI() {
    const userDisplay = document.getElementById('discordUserDisplay');
    const loginBtn = document.getElementById('discordLoginBtn');
    const authWarning = document.getElementById('publishAuthWarning');
    const avatarImg = document.getElementById('discordAvatarImg');
    const avatarPlaceholder = document.getElementById('discordAvatarPlaceholder');

    if (CURRENT_USER) {
        const discordName = CURRENT_USER.user_metadata?.custom_claims?.global_name || CURRENT_USER.user_metadata?.full_name || 'Discord User';
        const avatarUrl = CURRENT_USER.user_metadata?.avatar_url;

        if(userDisplay) userDisplay.innerHTML = `<div style="font-weight: bold; font-size: 1.1rem; color: #fff;">${discordName}</div><div style="font-size: 0.75rem; color: #a5d6a7;">Logged in successfully.</div>`;
        
        if (avatarUrl) {
            if(avatarImg) { avatarImg.src = avatarUrl; avatarImg.style.display = 'block'; }
            if(avatarPlaceholder) avatarPlaceholder.style.display = 'none';
        }

        if(loginBtn) {
            loginBtn.innerText = "Logout";
            loginBtn.onclick = logoutDiscord;
            loginBtn.style.backgroundColor = "#333";
            loginBtn.style.borderColor = "#555";
        }
        if(authWarning) authWarning.style.display = "none";
    } else {
        if(userDisplay) userDisplay.innerHTML = `<div style="font-weight: bold; font-size: 1.1rem; color: #ddd;">Not logged in</div><div style="font-size: 0.75rem; color: #888;">Log in to vote, publish, and manage your builds.</div>`;
        if(avatarImg) avatarImg.style.display = 'none';
        if(avatarPlaceholder) avatarPlaceholder.style.display = 'flex';
        
        if(loginBtn) {
            loginBtn.innerText = "Login with Discord";
            loginBtn.onclick = loginWithDiscord;
            loginBtn.style.backgroundColor = "#5865F2";
            loginBtn.style.borderColor = "#5865F2";
        }
        if(authWarning) authWarning.style.display = "block";
    }
}

async function loginWithDiscord() {
    const currentUrl = window.location.origin + window.location.pathname;

    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'discord',
        options: {
            redirectTo: currentUrl // Zwingt Supabase, den Unterordner beizubehalten!
        }
    });
    
    if (error) {
        console.error("Login failed:", error);
        //alert("Login failed: " + error.message);
        showCustomAlert("Login failed", error.message)
    }
}

async function logoutDiscord() {
    await supabaseClient.auth.signOut();
    showToast("Logged out.");
    if(!document.getElementById("communityModal").classList.contains("hidden")){
        fetchCommunityBuilds(CURRENT_COMMUNITY_TAB);
    }
}

// ============================================================================
// 3. PUBLISHING BUILDS
// ============================================================================

function openPublishModal(type) {
    if (!CURRENT_USER) {
        //alert("You must log in with Discord first to publish a build! Open the Community Builds Modal to log in.");
        showCustomAlert("Not logged in", "You must log in with Discord first to publish a build! Open the Community Builds Modal to log in.")
        return;
    }

    const modal = document.getElementById('publishModal');
    if (modal) {
        document.getElementById('publishType').value = type;
        document.getElementById('publishTitle').value = "";
        document.getElementById('publishComment').value = "";
        modal.classList.remove('hidden');
    }
}

function closePublishModal() {
    const modal = document.getElementById('publishModal');
    if (modal) modal.classList.add('hidden');
}

async function publishBuild() {
    if (!CURRENT_USER) return;

    const type = document.getElementById('publishType').value;
    const title = document.getElementById('publishTitle').value.trim();
    const comment = document.getElementById('publishComment').value.trim();

    //if (!title) { alert("Please provide a title!"); return; }
    if (!title) {showCustomAlert("Missin Title", "Please provide a title!"); return;}
    //if (comment.length > 250) { alert("Comment is too long (Max 250 chars)."); return; }
    if (comment.length > 250) {showCustomAlert("Comment too long", "Comment is too long (Max 250 chars)."); return;}

    let dataToSave = null;

    if (type === 'gear') {
        dataToSave = {
            gear: GEAR_SELECTION,
            enchants: ENCHANT_SELECTION
        };
    } else if (type === 'talents') {
        dataToSave = TALENT_CONFIG;
    } else if (type === 'rotation') {
        if (!CUSTOM_ROTATION || !CUSTOM_ROTATION.steps || CUSTOM_ROTATION.steps.length === 0) {
            showCustomAlert("Error","Rotation is empty!"); return;
        }
        dataToSave = CUSTOM_ROTATION;
    } else if (type === 'sim') {
        saveCurrentState();
        dataToSave = SIM_LIST[ACTIVE_SIM_INDEX].config;
    }

    if (!dataToSave) { showCustomAlert("Error","Error grabbing data."); return; }
    

    const discordName = CURRENT_USER.user_metadata?.custom_claims?.global_name || CURRENT_USER.user_metadata?.full_name || 'Discord User';

    showProgress("Publishing Build...");
    
    const { data, error } = await supabaseClient
        .from('community_builds')
        .insert([
            {
                type: type,
                title: title,
                comment: comment,
                author_id: CURRENT_USER.id,
                author_name: discordName,
                data: dataToSave,
                score: 0
            }
        ]);

    hideProgress();

    if (error) {
        console.error("Error publishing:", error);
        showCustomAlert("Error","Could not publish build: " + error.message);
    } else {
        showToast("Build published successfully!");
        switchCommunityTab(type);
        closePublishModal();
    }
}

// ============================================================================
// 4. FETCHING & DISPLAYING BUILDS
// ============================================================================

function openCommunityModal(type) {
    const modal = document.getElementById('communityModal');
    if (modal) modal.classList.remove('hidden');
    switchCommunityTab(type);
}

function closeCommunityModal() {
    const modal = document.getElementById('communityModal');
    if (modal) modal.classList.add('hidden');
}

function switchCommunityTab(type) {
    CURRENT_COMMUNITY_TAB = type;
    
    const tabs = ['sim', 'gear', 'talents', 'rotation'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab_${t}`);
        if (btn) {
            if (t === type) btn.classList.add("active");
            else btn.classList.remove("active");
        }
    });

    fetchCommunityBuilds(type);
}

async function fetchCommunityBuilds(type) {
    const tbody = document.getElementById('communityTableBody');
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Loading builds...</td></tr>';

    // --- NEU: Standard-Presets lokal sammeln ---
    let systemBuilds = [];
    
    if (type === 'gear' && typeof GEAR_PRESETS !== 'undefined') {
        Object.keys(GEAR_PRESETS).forEach(key => {
            systemBuilds.push({
                id: 'sys_' + key,
                type: type,
                title: key,
                comment: "Default Gear Setup",
                author_name: "System",
                author_id: "system",
                data: GEAR_PRESETS[key],
                isSystem: true // Markierung für das UI
            });
        });
    } else if (type === 'talents' && typeof TALENT_PRESETS !== 'undefined') {
        Object.keys(TALENT_PRESETS).forEach(key => {
            systemBuilds.push({
                id: 'sys_' + key,
                type: type,
                title: key,
                comment: "Default Talent Build",
                author_name: "System",
                author_id: "system",
                data: TALENT_PRESETS[key],
                isSystem: true
            });
        });
    } else if (type === 'rotation' && typeof PRESET_ROTATIONS !== 'undefined') {
        Object.keys(PRESET_ROTATIONS).forEach(key => {
            let rot = PRESET_ROTATIONS[key];
            systemBuilds.push({
                id: 'sys_' + key,
                type: type,
                title: rot.name || key,
                comment: rot.desc || "Default Rotation Logic",
                author_name: "System",
                author_id: "system",
                data: rot,
                isSystem: true
            });
        });
    }
    // ---------------------------------------------

    // Supabase DB abfragen
    const { data: builds, error } = await supabaseClient
        .from('community_builds')
        .select('*')
        .eq('type', type)
        .order('score', { ascending: false }); // Sortiert automatisch nach Score

    if (error) {
        console.error("Error fetching builds:", error);
        // Falls die DB einen Fehler wirft, rendern wir zumindest die System-Builds
        if (systemBuilds.length > 0) {
            renderCommunityBuilds(systemBuilds);
        } else {
            tbody.innerHTML = `<tr><td colspan="3" class="text-center" style="color:red;">Error loading builds: ${error.message}</td></tr>`;
        }
        return;
    }

    // Kombinieren: User-Builds immer ganz oben, danach die System-Builds
    const combinedBuilds = builds.concat(systemBuilds);
    renderCommunityBuilds(combinedBuilds);
}

function renderCommunityBuilds(builds) {
    const tbody = document.getElementById('communityTableBody');
    if(!tbody) return;
    tbody.innerHTML = "";

    if (builds.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center" style="padding: 20px;">No builds found for this category yet. Be the first!</td></tr>';
    return;
    }

    builds.forEach(build => {
        const tr = document.createElement('tr');
        
        const isSystem = build.isSystem === true;
        let voteHtml = "";
        
        // --- NEU: System-Builds haben keine Voting-Buttons ---
        if (isSystem) {
            voteHtml = `<span style="color:#555;">-</span>`;
        } else {
            const hasUpvoted = CURRENT_USER && build.upvoted_by && build.upvoted_by.includes(CURRENT_USER.id);
            const hasDownvoted = CURRENT_USER && build.downvoted_by && build.downvoted_by.includes(CURRENT_USER.id);
            
            const upClass = hasUpvoted ? "upvoted" : "";
            const downClass = hasDownvoted ? "downvoted" : "";

            const upVotesCount = build.upvoted_by ? build.upvoted_by.length : 0;
            const downVotesCount = build.downvoted_by ? build.downvoted_by.length : 0;

            voteHtml = `
                <div class="vote-container">
                    <button class="vote-btn ${upClass}" onclick="voteBuild('${build.id}', 'up')" title="Upvote">👍</button>
                    <span style="font-weight:bold; color:#a5d6a7; min-width: 15px;">${upVotesCount}</span>
                    <span style="color:#555; margin: 0 4px;">|</span>
                    <span style="font-weight:bold; color:#ef5350; min-width: 15px;">${downVotesCount}</span>
                    <button class="vote-btn ${downClass}" onclick="voteBuild('${build.id}', 'down')" title="Downvote">👎</button>
                </div>
            `;
        }

        // Gehört der Build dem aktuellen Nutzer? (System-Builds gehören niemandem)
        const isAuthor = !isSystem && CURRENT_USER && CURRENT_USER.id === build.author_id;

        // JSON-Objekt sicher als String codieren
        const dataString = encodeURIComponent(JSON.stringify(build.data)).replace(/'/g, "%27");

        tr.innerHTML = `
            <td class="text-left" style="vertical-align: middle;">
                <div class="community-build-title" 
                     style="cursor: pointer; display: inline-block; color: var(--druid-orange, #ff9800); font-weight: bold;" 
                     onmouseover="this.style.textDecoration='underline'" 
                     onmouseout="this.style.textDecoration='none'"
                     onclick="loadCommunityBuild('${build.type}', this)" 
                     data-build="${dataString}"
                     title="Click to load this build">
                    ${build.title}
                </div>
                <div class="community-build-comment">${build.comment || "No comment."}</div>
            </td>
            <td class="text-left" style="vertical-align: middle;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="color:${isSystem ? '#fff' : '#aaa'};">${build.author_name}</span>
                    ${isAuthor ? `<button class="btn-mini" style="color:#ef5350; border-color:#ef5350; padding: 2px 6px; font-size: 0.75rem;" onclick="deleteCommunityBuild('${build.id}')" title="Delete your build">🗑️ Del</button>` : ''}
                </div>
            </td>
            <td class="text-center" style="vertical-align: middle;">
                ${voteHtml}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ============================================================================
// 5. VOTING SYSTEM
// ============================================================================

async function voteBuild(buildId, action) {
    if (!CURRENT_USER) {
        showCustomAlert("Error","You must be logged in with Discord to vote!");
        return;
    }

    try {
        // Aktuellen Stand abrufen
        const { data, error: fetchError } = await supabaseClient
            .from('community_builds')
            .select('upvoted_by, downvoted_by')
            .eq('id', buildId)
            .single();
            
        if (fetchError) throw fetchError;

        let upvotedBy = data.upvoted_by || [];
        let downvotedBy = data.downvoted_by || [];
        const uid = CURRENT_USER.id;

        // User aus beiden Listen entfernen (Reset)
        upvotedBy = upvotedBy.filter(id => id !== uid);
        downvotedBy = downvotedBy.filter(id => id !== uid);

        // Neuen Vote anwenden
        if (action === 'up') {
            if (!(data.upvoted_by || []).includes(uid)) upvotedBy.push(uid);
        } else if (action === 'down') {
            if (!(data.downvoted_by || []).includes(uid)) downvotedBy.push(uid);
        }

        const newScore = upvotedBy.length - downvotedBy.length;

        // DB Update
        const { error: updateError } = await supabaseClient
            .from('community_builds')
            .update({ upvoted_by: upvotedBy, downvoted_by: downvotedBy, score: newScore })
            .eq('id', buildId);

        if (updateError) throw updateError;

        // UI erneuern
        fetchCommunityBuilds(CURRENT_COMMUNITY_TAB);

    } catch (error) {
        console.error("Error voting:", error);
        showCustomAlert("Error","Voting failed: " + error.message);
    }
}

// ============================================================================
// 6. LOADING / DELETING BUILDS (Mit Custom Modals)
// ============================================================================

function loadCommunityBuild(type, buttonElement) {
    showCustomConfirm("Load Build", "Are you sure you want to load this build? This will overwrite your current settings for this category.", () => {
        const dataString = buttonElement.getAttribute('data-build');
        if (!dataString) return;

        try {
            const data = JSON.parse(decodeURIComponent(dataString));

            if (type === 'gear') {
                GEAR_SELECTION = data.gear || {};
                ENCHANT_SELECTION = data.enchants || {};
                if(typeof initGearPlannerUI === 'function') initGearPlannerUI();
                if(typeof calculateGearStats === 'function') calculateGearStats();
            
            } else if (type === 'talents') {
                TALENT_CONFIG = data;
                if(typeof renderTalentTree === 'function') renderTalentTree();
            
            } else if (type === 'rotation') {
                CUSTOM_ROTATION = data;
                if(typeof renderRotationList === 'function') renderRotationList();
            
            } else if (type === 'sim') {
                addSim(false);
                applyConfigToUI(data);

                // NEU: Übernahme des Titels der Community-Simulation
                const buildTitle = buttonElement.innerText.trim();
                if (SIM_LIST[ACTIVE_SIM_INDEX]) {
                    SIM_LIST[ACTIVE_SIM_INDEX].name = buildTitle;
                    const nameInput = document.getElementById("simName");
                    if (nameInput) nameInput.value = buildTitle;
                    
                    // Aktualisiere die Seitenleiste
                    if (typeof renderSidebar === 'function') renderSidebar();
                }
            }

            saveCurrentState();
            closeCommunityModal();
            showToast("Community Build successfully loaded!");

        } catch (error) {
            console.error("Error parsing build data:", error);
            showCustomAlert("Error", "Failed to load build data.");
        }
    });
}

function deleteCommunityBuild(buildId) {
    showCustomConfirm("Delete Build", "Are you sure you want to permanently delete this build? This action cannot be undone.", async () => {
        if(typeof showProgress === 'function') showProgress("Deleting build...");
        
        const { error } = await supabaseClient
            .from('community_builds')
            .delete()
            .eq('id', buildId);
            
        if(typeof hideProgress === 'function') hideProgress();

        if (error) {
            console.error("Error deleting:", error);
            showCustomAlert("Deletion Failed", "Could not delete build: " + error.message);
        } else {
            showToast("Build deleted successfully!");
            // Liste neu laden, um den gelöschten Eintrag zu entfernen
            fetchCommunityBuilds(CURRENT_COMMUNITY_TAB);
        }
    });
}
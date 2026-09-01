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

    if (CURRENT_USER) {
        // Discord Username versteckt sich in den Metadaten
        const discordName = CURRENT_USER.user_metadata?.custom_claims?.global_name || CURRENT_USER.user_metadata?.full_name || 'Discord User';
        if(userDisplay) userDisplay.innerText = `Logged in as: ${discordName}`;
        if(loginBtn) {
            loginBtn.innerText = "Logout";
            loginBtn.onclick = logoutDiscord;
        }
        if(authWarning) authWarning.style.display = "none";
    } else {
        if(userDisplay) userDisplay.innerText = "Not logged in.";
        if(loginBtn) {
            loginBtn.innerText = "Login with Discord";
            loginBtn.onclick = loginWithDiscord;
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
        alert("Login failed: " + error.message);
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
        alert("You must log in with Discord first to publish a build! Open the Community Builds Modal to log in.");
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

    if (!title) { alert("Please provide a title!"); return; }
    if (comment.length > 250) { alert("Comment is too long (Max 250 chars)."); return; }

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
            alert("Rotation is empty!"); return;
        }
        dataToSave = CUSTOM_ROTATION;
    } else if (type === 'sim') {
        saveCurrentState();
        dataToSave = SIM_LIST[ACTIVE_SIM_INDEX].config;
    }

    if (!dataToSave) { alert("Error grabbing data."); return; }

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
        alert("Could not publish build: " + error.message);
    } else {
        showToast("Build published successfully!");
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
    
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Loading builds from database...</td></tr>';

    const { data: builds, error } = await supabaseClient
        .from('community_builds')
        .select('*')
        .eq('type', type)
        .order('score', { ascending: false }); // Sortiert automatisch nach Score

    if (error) {
        console.error("Error fetching builds:", error);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color:red;">Error loading builds: ${error.message}</td></tr>`;
        return;
    }

    renderCommunityBuilds(builds);
}

function renderCommunityBuilds(builds) {
    const tbody = document.getElementById('communityTableBody');
    if(!tbody) return;
    tbody.innerHTML = "";

    if (builds.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No builds found for this category yet. Be the first!</td></tr>';
        return;
    }

    builds.forEach(build => {
        const tr = document.createElement('tr');
        
        const hasUpvoted = CURRENT_USER && build.upvoted_by && build.upvoted_by.includes(CURRENT_USER.id);
        const hasDownvoted = CURRENT_USER && build.downvoted_by && build.downvoted_by.includes(CURRENT_USER.id);
        
        const upClass = hasUpvoted ? "upvoted" : "";
        const downClass = hasDownvoted ? "downvoted" : "";

        // Wir codieren das JSON-Objekt sicher als String ins HTML-Attribut
        const dataString = encodeURIComponent(JSON.stringify(build.data));

        tr.innerHTML = `
            <td class="text-left">
                <div class="community-build-title">${build.title}</div>
                <div class="community-build-comment">${build.comment || "No comment."}</div>
            </td>
            <td class="text-left" style="color:#aaa;">${build.author_name}</td>
            <td class="text-center">
                <div class="vote-container">
                    <button class="vote-btn ${upClass}" onclick="voteBuild('${build.id}', 'up')" title="Upvote">▲</button>
                    <span style="font-weight:bold; color:${build.score >= 0 ? '#4caf50' : '#f44336'};">${build.score || 0}</span>
                    <button class="vote-btn ${downClass}" onclick="voteBuild('${build.id}', 'down')" title="Downvote">▼</button>
                </div>
            </td>
            <td class="text-right">
                <button class="btn-mini primary-btn" onclick="loadCommunityBuild('${build.type}', this)" data-build='${dataString}'>📥 Load</button>
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
        alert("You must be logged in with Discord to vote!");
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
        alert("Voting failed: " + error.message);
    }
}

// ============================================================================
// 6. LOADING BUILDS INTO SIMULATION
// ============================================================================

function loadCommunityBuild(type, buttonElement) {
    if (!confirm("Load this build? This will overwrite your current settings for this category.")) return;

    const dataString = buttonElement.getAttribute('data-build');
    if (!dataString) return;

    try {
        // Dekodieren des in renderCommunityBuilds erstellten Strings
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
        }

        saveCurrentState();
        closeCommunityModal();
        showToast("Community Build successfully loaded!");

    } catch (error) {
        console.error("Error parsing build data:", error);
        alert("Failed to load build data.");
    }
}
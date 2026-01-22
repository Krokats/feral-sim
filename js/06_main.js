/**
 * Feral Simulation - File 6: Main Init
 * Updated for Turtle WoW 1.18 (Feral Cat)
 * Entry point for the application.
 */

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    console.log("Initializing Krokat's Feral Sim (Turtle WoW 1.18)...");

    setupUIListeners();
    renderSidebar();

    // Show Warning Modal on Load
    //var warnModal = document.getElementById("warningModal");
    //if (warnModal) warnModal.classList.remove("hidden");

    loadDatabase().then(function () {
        console.log("DB Loaded.");

        var urlParams = new URLSearchParams(window.location.search);
        var cfgStr = urlParams.get('cfg');

        if (cfgStr) {
            try {
                var json = LZString.decompressFromEncodedURIComponent(cfgStr);
                if (!json) json = LZString.decompressFromBase64(cfgStr);

                if (json) {
                    var data = JSON.parse(json);
                    if (!Array.isArray(data)) data = [data];

                    if (data.length > 0) {
                        SIM_LIST = [];
                        data.forEach(function (item) {
                            var sName = item.n || item.name || "Imported Sim";
                            var newSim = new SimObject(Date.now() + Math.floor(Math.random() * 1000), sName);

                            if (item.d && typeof unpackConfig === 'function') {
                                newSim.config = unpackConfig(item.d);
                            } else {
                                newSim.config = item.config || item;
                            }
                            SIM_LIST.push(newSim);
                        });

                        renderSidebar();

                        // Load the first sim
                        if (SIM_LIST.length > 0) {
                            // Ensure we start cleanly with the first sim
                            switchSim(0, true);
                        }
                    }
                }
            } catch (e) {
                console.error("URL Load Error:", e);
                if (SIM_LIST.length === 0) addSim(true);
            }
        } else {
            if (SIM_LIST.length === 0) addSim(true);
        }

        // Final UI refresh
        updateEnemyInfo();
        updatePlayerStats();

    }).catch(function (err) {
        console.error("DB Error:", err);
        if (SIM_LIST.length === 0) addSim(true);
    });
}




// Ensure DOM is fully loaded before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
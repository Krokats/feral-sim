/**
 * Feral Simulation - File 2: Utilities
 * DOM Helpers, UI Feedback & Pixel Art Animation Engine
 */


// ============================================================================
// 1. DOM UTILS
// ============================================================================

function getVal(id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    if (el.type === "checkbox") return el.checked ? 1 : 0;
    if (el.tagName === "SELECT") return el.value;
    return parseFloat(el.value) || 0;
}

function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.innerText = text;
}

function showToast(msg) {
    var t = document.getElementById("toast");
    if (t) {
        if (window.toastTimer) clearTimeout(window.toastTimer);
        t.innerText = msg || "Action Successful!";
        t.classList.add("show");
        window.toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3000);
    }
}


// ============================================================================
// 2. ANIMATION STATE & ENGINE
// ============================================================================

var animCtx = null;
var animReqId = null;
var animProgress = 0;
var simOutcome = 'hit';
var simSpell = 'wrath';
const ANIM_SCALE = 4;

function initAnimCanvas() {
    var cvs = document.getElementById("animCanvas");
    if (cvs) animCtx = cvs.getContext("2d");
}

function drawSprite(sprite, startX, startY, customScale) {
    if (!animCtx) return;
    var s = customScale || ANIM_SCALE;
    for (var y = 0; y < sprite.length; y++) {
        for (var x = 0; x < sprite[y].length; x++) {
            var color = sprite[y][x];
            if (color) {
                animCtx.fillStyle = color;
                animCtx.fillRect(startX + (x * s), startY + (y * s), s, s);
            }
        }
    }
}

function drawDiagonalText(textArr, startX, startY, spacingX, spacingY) {
    textArr.forEach(function(letterSprite, i) {
        drawSprite(letterSprite, startX + (i * spacingX * ANIM_SCALE), startY - (i * spacingY * ANIM_SCALE));
    });
}

function renderAnimationFrame(pct) {
    if (!animCtx) return;
    var canvas = animCtx.canvas;
    
    // Clear
    animCtx.clearRect(0, 0, canvas.width, canvas.height);

    // Background & Ground
    var groundY = canvas.height - 20;
    animCtx.fillStyle = '#1a1a2e'; // Dark Sky
    // animCtx.fillRect(0, 0, canvas.width, canvas.height); // (Optional, CSS does gradient)
    animCtx.fillStyle = '#111'; // Ground
    animCtx.fillRect(0, groundY, canvas.width, 20);

    // Positions
    var moonkinY = groundY - (SPRITES.moonkinLarge.length * ANIM_SCALE) + 5; 
    var dummyY = groundY - (SPRITES.dummyLarge.length * ANIM_SCALE) + 5;
    var startX = 30; 
    var endX = canvas.width - 80; 

    // 1. Draw Moonkin
    drawSprite(SPRITES.moonkinLarge, startX, moonkinY);
    
    // Tear on Miss
    if (simOutcome === 'miss' && pct >= 80) {
        var tearX = startX + (3 * ANIM_SCALE);
        var tearY = moonkinY + (4 * ANIM_SCALE) + 2;
        drawSprite(SPRITES.tear, tearX, tearY);
    }

    // 2. Draw Dummy
    var dummyShakeX = 0, dummyShakeY = 0;
    // Shake on Impact
    if (pct >= 80 && pct < 95 && (simOutcome === 'hit' || simOutcome === 'crit')) {
        dummyShakeX = (Math.random() * 4 - 2); 
        dummyShakeY = (Math.random() * 2);
    }
    drawSprite(SPRITES.dummyLarge, endX + dummyShakeX, dummyY + dummyShakeY);

    // Shield on Immune
    if (simOutcome === 'immune' && pct >= 80) {
        var shieldX = endX + (2 * ANIM_SCALE);
        var shieldY = dummyY + (3 * ANIM_SCALE);
        drawSprite(SPRITES.shield, shieldX, shieldY);
    }

    // 3. Spells & Particles
    var castFinishedAt = 80;
    var wrathFlyStart = 40; 
    var wrathFlyEnd = 80;

    // --- STARFIRE ---
    if (simSpell === 'starfire') {
        if (pct < castFinishedAt && pct > 0) {
            // Casting Animation
            var castX = startX + (SPRITES.moonkinLarge[0].length * ANIM_SCALE) - 10;
            var castY = moonkinY + 20;
            var pulseSpeed = (pct > 60) ? 3 : 6;
            var pulse = (Math.floor(pct / pulseSpeed) % 2 === 0);
            if(pulse) drawSprite(SPRITES.castBall2, castX - 2, castY - 2);
            else drawSprite(SPRITES.castBall1, castX, castY);

        } else if (pct >= castFinishedAt) {
            // Beam Animation
            var beamX = endX + 8; 
            var segmentHeight = SPRITES.beamSegment.length * ANIM_SCALE;
            
            // Draw Beam Segments
            var spriteToUse = (simOutcome === 'crit') ? SPRITES.redBeamSegment : SPRITES.beamSegment;
            // Only draw beam if Hit or Crit (not on miss/immune logic for beam usually, but keeps effect clear)
            if (simOutcome === 'hit' || simOutcome === 'crit') {
                for(var yPos = -20; yPos < groundY; yPos += segmentHeight) {
                    drawSprite(spriteToUse, beamX, yPos);
                }
                drawSprite(SPRITES.impactSplash, beamX - 5, groundY - 15);
            }
        }
    } 
    // --- WRATH ---
    else if (simSpell === 'wrath') {
        var castX = startX + (SPRITES.moonkinLarge[0].length * ANIM_SCALE) - 5;
        var castY = moonkinY + 20;
        var targetX = endX + 10;
        var targetY = dummyY + 20;

        if (pct < wrathFlyStart && pct > 0) {
            // Casting
            if (pct % 10 < 5) drawSprite(SPRITES.wrathBall, castX, castY);
        
        } else if (pct >= wrathFlyStart) {
            // Flight
            var flightDuration = wrathFlyEnd - wrathFlyStart; 
            var currentFlightTime = pct - wrathFlyStart; 
            var flightFactor = currentFlightTime / flightDuration;
            
            var curX = castX + (targetX - castX) * flightFactor;
            var curY = castY + (targetY - castY) * flightFactor;

            if (pct < wrathFlyEnd) {
                // Flying
                drawSprite(SPRITES.wrathBall, curX, curY);
            } else {
                // Impact / Miss
                if (simOutcome === 'hit' || simOutcome === 'crit') {
                    drawSprite(SPRITES.wrathSplash, targetX - 5, targetY - 5);
                } else if (simOutcome === 'miss') {
                    // Overshoot on miss
                    drawSprite(SPRITES.wrathBall, curX, curY);
                }
            }
        }
    }

    // 4. Text Numbers
    if (pct >= castFinishedAt) {
        var textStartX = endX - 20;
        var textStartY = dummyY - 10;
        
        if (simOutcome === 'crit') {
            drawDiagonalText([SPRITES.txtC, SPRITES.txtR, SPRITES.txtI, SPRITES.txtT, SPRITES.txtEcl], textStartX, textStartY, 4, 2);
        } else if (simOutcome === 'miss') {
            drawDiagonalText([SPRITES.txtM, SPRITES.txtI, SPRITES.txtS, SPRITES.txtS, SPRITES.txtEcl], textStartX, textStartY, 4, 2);
        } else if (simOutcome === 'immune') {
            drawDiagonalText([SPRITES.txtI_y, SPRITES.txtM_y, SPRITES.txtM_y, SPRITES.txtU_y, SPRITES.txtN_y, SPRITES.txtE_y, SPRITES.txtEcl_y], textStartX - 10, textStartY, 4, 2);
        }
    }
}

function animLoop() {
    renderAnimationFrame(animProgress);
    animReqId = requestAnimationFrame(animLoop);
}

/**
 * Shows the modal progress overlay and STARTS the animation loop.
 */
function showProgress(text) {
    var el = document.getElementById("progressOverlay");
    if (el) {
        el.classList.remove("hidden");
        var t = document.getElementById("progressText");
        if (t) t.innerText = text;
        
        var f = document.getElementById("progressFill");
        if (f) f.style.width = "0%";

        // Init Animation
        if (!animCtx) initAnimCanvas();
        animProgress = 0;
        
        // Randomize Cosmetic Outcome
        var r = Math.random();
        if (r < 0.05) simOutcome = 'crit';
        else if (r < 0.1) simOutcome = 'hit';
        else if (r < 0.3) simOutcome = 'immune';
        else simOutcome = 'miss';

        // Randomize Spell
        simSpell = Math.random() > 0.5 ? 'wrath' : 'starfire';

        // Start Loop
        if(animReqId) cancelAnimationFrame(animReqId);
        animLoop();
    }
}

/**
 * Updates the progress state. The animation loop reads this variable.
 */
function updateProgress(pct) {
    var el = document.getElementById("progressFill");
    if (el) el.style.width = pct + "%";
    
    // Update Animation State
    animProgress = pct;
}

/**
 * Hides the progress overlay and STOPS the animation loop.
 */
function hideProgress() {
    setTimeout(function () {
        var el = document.getElementById("progressOverlay");
        if (el) el.classList.add("hidden");
        
        // Stop Loop to save resources
        if(animReqId) cancelAnimationFrame(animReqId);
        animReqId = null;
        
    }, 200);
}
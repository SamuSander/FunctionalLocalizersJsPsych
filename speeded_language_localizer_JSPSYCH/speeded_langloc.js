/* ------------------------------------------------------
 * speeded_langloc.js - Speeded Language Localizer for fMRI
 * 
 * Port of evlab_langloc_speeded.m by Terri Scott/Greta Tuckute/Aalok Sathe
 * Adapted to jsPsych with fMRI trigger system
 * 
 * Experiment structure:
 * - 48 trials total (16 blocks of 3 trials each)
 * - Each trial: 100ms blank → 12 words × 200ms → 400ms button → 100ms blank = 3000ms
 * - Fixation periods (14s) after trials 12, 24, 36, 48
 * - Total runtime: ~214 seconds (3:34)
 * - Two conditions: Sentences (S) vs Nonwords (N)
 * ------------------------------------------------------*/

// ------------------------------------------------------
// GLOBAL CONFIGURATION & VARIABLES
// ------------------------------------------------------
const DEBUG_MODE = false;

// Experiment parameters (matching MATLAB timing)
const WORD_DURATION = 200;          // 200ms per word
const BUTTON_IMAGE_DURATION = 400;  // 400ms for button press image
const BLANK_DURATION = 100;         // 100ms blank screens
const TRIAL_DURATION = 3000;        // Total trial duration = 100 + 2400 + 400 + 100
const FIXATION_DURATION = 14000;    // 14 seconds fixation between blocks
const WORDS_PER_TRIAL = 12;         // 12 words per trial
const TOTAL_TRIALS = 48;            // 48 trials total
const TRIALS_PER_BLOCK = 3;         // 3 trials per block
const TOTAL_BLOCKS = 16;            // 16 blocks total

// Scanner keys
const KEY_RESPONSE = ['g', 'b'];    // Both keys accepted for button press responses
const KEY_FORWARD = 'b';            // Right key for navigation
const KEY_BACKWARD = 'g';           // Left key for navigation

// Trigger variables (using your existing system)
var triggerKey = "t";
var triggers = [];
var triggerCount = 0;
var triggersToCollect = 5; // 1 Start-Trigger + 4 additional triggers
var triggerFlag = false;
var experimentStartTime = 0;
var currentTrial = null;
var initialTriggerCollection = true;

// Experiment variables
var currentParticipantId = null;
var currentRun = 1;
var currentSet = 1;
var loadedStimuli = null;
var trialOnsets = []; // Store calculated trial onset times
var fixationOnsets = []; // Store fixation onset times

// Console logging variables
var totalExperimentDuration = 0;
var experimentTimerInterval = null;
var currentBlockNumber = 0;
var blockResponseTracker = {}; // Track responses per block

// ------------------------------------------------------
// CONSOLE LOGGING FUNCTIONS
// ------------------------------------------------------

function logExperimentHeader() {
    console.clear();
    console.log("%c╔═══════════════════════════════════════════════════════════════╗", "color: #4CAF50; font-weight: bold;");
    console.log("%c║      SPEEDED LANGUAGE LOCALIZER - SCANNER MONITOR            ║", "color: #4CAF50; font-weight: bold;");
    console.log("%c╚═══════════════════════════════════════════════════════════════╝", "color: #4CAF50; font-weight: bold;");
    console.log("");
    console.log("%c📊 Experiment Configuration:", "color: #2196F3; font-weight: bold; font-size: 14px;");
    console.log(`   Participant: ${currentParticipantId}`);
    console.log(`   Run: ${currentRun} | Set: ${currentSet}`);
    console.log(`   Total Trials: ${TOTAL_TRIALS} (${TOTAL_BLOCKS} blocks of ${TRIALS_PER_BLOCK})`);
    console.log(`   Trial Duration: ${TRIAL_DURATION}ms`);
    console.log(`   Fixation Duration: ${FIXATION_DURATION}ms`);
    console.log("");
    
    // Calculate total duration
    const trialsTime = TOTAL_TRIALS * TRIAL_DURATION;
    const fixationsTime = 5 * FIXATION_DURATION; // 5 fixations total
    totalExperimentDuration = trialsTime + fixationsTime;
    const minutes = Math.floor(totalExperimentDuration / 60000);
    const seconds = Math.floor((totalExperimentDuration % 60000) / 1000);
    
    console.log(`%c⏱️  TOTAL DURATION: ${minutes}:${seconds.toString().padStart(2, '0')} (${totalExperimentDuration}ms)`, "color: #FF9800; font-weight: bold; font-size: 16px;");
    console.log("");
    console.log("%c" + "─".repeat(63), "color: #666;");
    console.log("");
}

function startExperimentTimer() {
    const startTime = performance.now();
    
    experimentTimerInterval = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const remaining = Math.max(0, totalExperimentDuration - elapsed);
        
        const elapsedMin = Math.floor(elapsed / 60000);
        const elapsedSec = Math.floor((elapsed % 60000) / 1000);
        const remainingMin = Math.floor(remaining / 60000);
        const remainingSec = Math.floor((remaining % 60000) / 1000);
        
        const percentage = Math.min(100, (elapsed / totalExperimentDuration) * 100);
        const barLength = 30;
        const filledLength = Math.floor((percentage / 100) * barLength);
        const bar = "█".repeat(filledLength) + "░".repeat(barLength - filledLength);
        
        // Update console (this will scroll, but we'll keep it updated)
        console.log(`%c⏱️  TIME: ${elapsedMin}:${elapsedSec.toString().padStart(2, '0')} | REMAINING: ${remainingMin}:${remainingSec.toString().padStart(2, '0')} | ${percentage.toFixed(1)}%`, 
                    "color: #FF9800; font-weight: bold;");
        console.log(`%c[${bar}]`, "color: #4CAF50;");
    }, 5000); // Update every 5 seconds
}

function stopExperimentTimer() {
    if (experimentTimerInterval) {
        clearInterval(experimentTimerInterval);
        experimentTimerInterval = null;
    }
}

function logBlockStart(blockNumber, trialsInBlock) {
    currentBlockNumber = blockNumber;
    blockResponseTracker[blockNumber] = {
        trials: [],
        responses: 0,
        total: trialsInBlock.length
    };
    
    console.log("");
    console.log("%c" + "═".repeat(63), "color: #2196F3;");
    console.log(`%c🔷 BLOCK ${blockNumber}/${TOTAL_BLOCKS} STARTED`, "color: #2196F3; font-weight: bold; font-size: 14px;");
    console.log("%c" + "═".repeat(63), "color: #2196F3;");
    
    trialsInBlock.forEach((trial, idx) => {
        const trialNum = trial.trial_number;
        const condition = trial.condition_name;
        console.log(`   Trial ${trialNum}: ${condition}`);
    });
    
    console.log("");
}

function logTrialResponse(trialNumber, blockNumber, responded, responseTime, condition) {
    const icon = responded ? "✅" : "❌";
    const rtText = responded ? `RT: ${Math.round(responseTime)}ms` : "NO RESPONSE";
    const color = responded ? "#4CAF50" : "#F44336";
    
    console.log(`%c${icon} Trial ${trialNumber} (Block ${blockNumber}): ${condition} | ${rtText}`, 
                `color: ${color}; font-weight: bold;`);
    
    // Update block tracker
    if (blockResponseTracker[blockNumber]) {
        blockResponseTracker[blockNumber].trials.push({
            trial: trialNumber,
            responded: responded,
            rt: responseTime
        });
        if (responded) {
            blockResponseTracker[blockNumber].responses++;
        }
    }
}

function logBlockEnd(blockNumber) {
    const tracker = blockResponseTracker[blockNumber];
    if (!tracker) return;
    
    const responseRate = (tracker.responses / tracker.total * 100).toFixed(1);
    const avgRT = tracker.trials
        .filter(t => t.responded)
        .reduce((sum, t) => sum + t.rt, 0) / tracker.responses;
    
    console.log("");
    console.log(`%c📊 BLOCK ${blockNumber} SUMMARY:`, "color: #9C27B0; font-weight: bold;");
    console.log(`   Responses: ${tracker.responses}/${tracker.total} (${responseRate}%)`);
    if (tracker.responses > 0) {
        console.log(`   Average RT: ${Math.round(avgRT)}ms`);
    }
    console.log("%c" + "─".repeat(63), "color: #666;");
    console.log("");
}

function logFixationStart(fixationNumber, duration) {
    console.log("");
    console.log(`%c⊕ FIXATION ${fixationNumber} (${duration/1000}s)`, "color: #607D8B; font-weight: bold; font-size: 13px;");
    console.log("");
}

function logExperimentEnd() {
    stopExperimentTimer();
    
    console.log("");
    console.log("%c" + "═".repeat(63), "color: #4CAF50;");
    console.log("%c🎉 EXPERIMENT COMPLETED!", "color: #4CAF50; font-weight: bold; font-size: 16px;");
    console.log("%c" + "═".repeat(63), "color: #4CAF50;");
    console.log("");
    
    // Calculate overall statistics
    let totalResponses = 0;
    let totalTrials = 0;
    let allRTs = [];
    
    Object.values(blockResponseTracker).forEach(block => {
        totalResponses += block.responses;
        totalTrials += block.total;
        block.trials.filter(t => t.responded).forEach(t => allRTs.push(t.rt));
    });
    
    const overallResponseRate = (totalResponses / totalTrials * 100).toFixed(1);
    const avgRT = allRTs.length > 0 ? allRTs.reduce((a, b) => a + b, 0) / allRTs.length : 0;
    
    console.log("%c📈 OVERALL PERFORMANCE:", "color: #FF9800; font-weight: bold; font-size: 14px;");
    console.log(`   Total Responses: ${totalResponses}/${totalTrials} (${overallResponseRate}%)`);
    console.log(`   Average RT: ${Math.round(avgRT)}ms`);
    console.log(`   Triggers Collected: ${triggerCount}`);
    console.log("");
    console.log("%cData saved successfully! ✓", "color: #4CAF50; font-weight: bold;");
    console.log("");
}

// ------------------------------------------------------
// UTILITY FUNCTIONS
// ------------------------------------------------------

// Trigger recording function (using your existing system)
function recordTrigger() {
    const currentTime = performance.now();
    triggerCount++;
    const timeSinceStart = currentTime - experimentStartTime;
    const timeFromFirstTrigger = triggers.length > 0 ? currentTime - triggers[0].time : 0;
    
    triggers.push({
        time: currentTime,
        count: triggerCount,
        time_since_start_ms: timeSinceStart,
        time_since_start_sec: timeSinceStart / 1000,
        time_from_first_trigger_ms: timeFromFirstTrigger,
        time_from_first_trigger_sec: timeFromFirstTrigger / 1000
    });
    
    console.log(`%c🔔 Trigger #${triggerCount} at ${(timeSinceStart/1000).toFixed(2)}s`, "color: #FF5722; font-weight: bold;");
    
    if (currentTrial) {
        currentTrial.data.trigger_detected = true;
        currentTrial.data.trigger_time = currentTime;
        currentTrial.data.current_triggers = JSON.stringify(triggers);
        currentTrial.data.trigger_count = triggerCount;
    }
    
    return triggerCount;
}

// Calculate trial onset times (matching MATLAB timing)
function calculateTrialOnsets() {
    trialOnsets = [];
    let baseTime = 14000; // Start after initial 14s fixation
    
    for (let i = 0; i < TOTAL_TRIALS; i++) {
        if (i === 0) {
            trialOnsets[i] = baseTime;
        } else if ([12, 24, 36].includes(i)) {
            // After fixation periods (trials 12, 24, 36)
            trialOnsets[i] = trialOnsets[i-1] + TRIAL_DURATION + FIXATION_DURATION;
        } else {
            trialOnsets[i] = trialOnsets[i-1] + TRIAL_DURATION;
        }
    }
    
    console.log("%c📋 Trial onsets calculated", "color: #9E9E9E;");
}

// Load stimuli data asynchronously
async function loadStimuliData(run, set) {
    try {
        // Construct the variable name based on run and set
        const stimuliVarName = `langlocStimuli_run${run}_set${set}`;
        
        // Check if the stimuli data exists
        if (typeof window[stimuliVarName] !== 'undefined') {
            console.log(`%c✓ Stimuli loaded: ${stimuliVarName}`, "color: #4CAF50;");
            return window[stimuliVarName];
        } else {
            throw new Error(`Stimuli data not found: ${stimuliVarName}. Make sure speeded_langloc_stimuli_run${run}_set${set}.js is loaded in the HTML file.`);
        }
    } catch (error) {
        console.error('Error loading stimuli data:', error);
        return null;
    }
}

// ------------------------------------------------------
// TRIAL BUILDING FUNCTIONS
// ------------------------------------------------------

function createWordSequenceTrial(trialData, trialIndex) {
    const trialNumber = trialData.trial_number;
    const words = trialData.words;
    const blockNumber = trialData.block;
    
    return {
        type: jsPsychHtmlKeyboardResponse,
        timeline: [
            // Initial blank screen (100ms)
            {
                type: jsPsychHtmlKeyboardResponse,
                stimulus: '<div style="display: flex; justify-content: center; align-items: center; height: 100vh;"></div>',
                choices: "NO_KEYS",
                trial_duration: BLANK_DURATION,
                data: {
                    trial_type: 'blank_pre',
                    trial_number: trialNumber,
                    block: blockNumber,
                    condition: trialData.condition
                },
                on_start: function(trial) {
                    currentTrial = trial;
                    const currentTime = performance.now();
                    trial.data.trial_onset_time = currentTime;
                    trial.data.trial_time_since_start_ms = currentTime - experimentStartTime;
                    
                    if (triggers.length > 0) {
                        trial.data.trial_time_from_first_trigger_ms = currentTime - triggers[0].time;
                    }
                },
                on_finish: function(data) {
                    data.current_triggers = JSON.stringify(triggers);
                    data.trigger_count = triggerCount;
                    currentTrial = null;
                }
            },
            // Word sequence presentation (12 words × 200ms each)
            ...words.map((word, wordIndex) => ({
                type: jsPsychHtmlKeyboardResponse,
                stimulus: `<div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-size: 48px;">${word}</div>`,
                choices: KEY_RESPONSE,
                trial_duration: WORD_DURATION,
                data: {
                    trial_type: 'word_presentation',
                    trial_number: trialNumber,
                    block: blockNumber,
                    condition: trialData.condition,
                    condition_name: trialData.condition_name,
                    word: word,
                    word_position: wordIndex + 1,
                    total_words: WORDS_PER_TRIAL
                },
                on_start: function(trial) {
                    currentTrial = trial;
                    const currentTime = performance.now();
                    trial.data.word_onset_time = currentTime;
                    trial.data.word_time_since_start_ms = currentTime - experimentStartTime;
                    
                    if (triggers.length > 0) {
                        trial.data.word_time_from_first_trigger_ms = currentTime - triggers[0].time;
                    }
                },
                on_finish: function(data) {
                    // Record response during word presentation (for attention monitoring)
                    if (data.response !== null) {
                        data.early_response = true;
                        data.response_time = data.rt;
                    }
                    data.current_triggers = JSON.stringify(triggers);
                    data.trigger_count = triggerCount;
                    currentTrial = null;
                }
            })),
            // Button press image (400ms) - main response period
            {
                type: jsPsychHtmlKeyboardResponse,
                stimulus: `
                    <div style="display: flex; justify-content: center; align-items: center; height: 100vh;">
                        <img src="images/hand-press-button-4.png" 
                            style="max-width: 80%; max-height: 80%; object-fit: contain;" 
                            alt="Taste drücken">
                    </div>
                `,
                choices: KEY_RESPONSE,
                trial_duration: BUTTON_IMAGE_DURATION,
                data: {
                    trial_type: 'button_prompt',
                    trial_number: trialNumber,
                    block: blockNumber,
                    condition: trialData.condition,
                    condition_name: trialData.condition_name,
                    stimulus_sequence: words.join(' ')
                },
                on_start: function(trial) {
                    currentTrial = trial;
                    const currentTime = performance.now();
                    trial.data.button_prompt_onset_time = currentTime;
                    trial.data.button_prompt_time_since_start_ms = currentTime - experimentStartTime;
                    
                    if (triggers.length > 0) {
                        trial.data.button_prompt_time_from_first_trigger_ms = currentTime - triggers[0].time;
                    }
                },
                on_finish: function(data) {
                    // This is the main response data we care about
                    data.did_respond = data.response !== null;
                    if (data.did_respond) {
                        data.response_time = data.rt;
                        data.probe_response_time = data.button_prompt_onset_time + data.rt;
                    }
                    data.current_triggers = JSON.stringify(triggers);
                    data.trigger_count = triggerCount;
                    
                    // Log the response
                    logTrialResponse(
                        trialNumber, 
                        blockNumber, 
                        data.did_respond, 
                        data.response_time, 
                        trialData.condition_name
                    );
                    
                    currentTrial = null;
                }
            },
            // Final blank screen (100ms)
            {
                type: jsPsychHtmlKeyboardResponse,
                stimulus: '<div style="display: flex; justify-content: center; align-items: center; height: 100vh;"></div>',
                choices: "NO_KEYS",
                trial_duration: BLANK_DURATION,
                data: {
                    trial_type: 'blank_post',
                    trial_number: trialNumber,
                    block: blockNumber,
                    condition: trialData.condition
                },
                on_start: function(trial) {
                    currentTrial = trial;
                },
                on_finish: function(data) {
                    data.current_triggers = JSON.stringify(triggers);
                    data.trigger_count = triggerCount;
                    currentTrial = null;
                }
            }
        ]
    };
}

function createFixationTrial(fixationNumber, trialNumber) {
    return {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-size: 48px;">+</div>',
        choices: KEY_RESPONSE,
        trial_duration: FIXATION_DURATION,
        data: {
            trial_type: 'fixation',
            fixation_number: fixationNumber,
            after_trial: trialNumber,
            fixation_duration: FIXATION_DURATION
        },
        on_start: function(trial) {
            currentTrial = trial;
            const currentTime = performance.now();
            trial.data.fixation_onset_time = currentTime;
            trial.data.fixation_time_since_start_ms = currentTime - experimentStartTime;
            
            if (triggers.length > 0) {
                trial.data.fixation_time_from_first_trigger_ms = currentTime - triggers[0].time;
            }
            
            logFixationStart(fixationNumber, FIXATION_DURATION);
        },
        on_finish: function(data) {
            // Record any responses during fixation
            data.did_respond = data.response !== null;
            if (data.did_respond) {
                data.response_time = data.rt;
            }
            data.current_triggers = JSON.stringify(triggers);
            data.trigger_count = triggerCount;
            currentTrial = null;
            
            // Log block end if this fixation is between blocks
            if (fixationNumber > 1) {
                const previousBlock = Math.floor((trialNumber) / TRIALS_PER_BLOCK);
                logBlockEnd(previousBlock);
            }
        }
    };
}

// ------------------------------------------------------
// TRIGGER TRIALS (using your existing system)
// ------------------------------------------------------

var firstTrigger = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column;">
            <p style="font-size:26px; text-align: center;">Bitte informieren Sie jetzt den Versuchsleiter.</p>
            <p style="font-size:26px; text-align: center;">Das Experiment beginnt, sobald der Scanner bereit ist.</p>
            <p style="font-size:60px; margin-top: 40px;">+</p>
        </div>
    `,
    choices: [triggerKey],
    data: { 
        trial_type: 'first_trigger'
    },
    on_load: function() {
        if (triggerCount === 0) {
            experimentStartTime = performance.now();
        }
        triggerFlag = true;
        currentTrial = this;
        console.log("%c🚀 Waiting for first scanner trigger...", "color: #FF9800; font-weight: bold;");
    },
    on_finish: function(data) {
        recordTrigger();
        data.trigger_count = triggerCount;
        data.trigger_time = triggers[triggers.length - 1].time;
        data.experiment_start_time = experimentStartTime;
        data.current_triggers = JSON.stringify(triggers);
        currentTrial = null;
        
        // Start the experiment timer
        startExperimentTimer();
    }
};

var collectTriggers = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: function() {
        return `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column;">
                <p style="font-size:22px; text-align: center;">Warte auf Scanner-Trigger... (${triggersToCollect - triggerCount} noch benötigt)</p>
                <p style="font-size:60px; margin-top: 40px;">+</p>
            </div>
        `;
    },
    choices: [triggerKey],
    data: { 
        trial_type: 'wait_for_trigger'
    },
    on_start: function() {
        currentTrial = this;
    },
    on_finish: function(data) {
        recordTrigger();
        data.trigger_count = triggerCount;
        data.trigger_time = triggers[triggers.length - 1].time;
        data.current_triggers = JSON.stringify(triggers);
        currentTrial = null;
    }
};

var triggerLoop = {
    timeline: [collectTriggers],
    loop_function: function() {
        return triggerCount < triggersToCollect;
    }
};

var saveTriggers = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: '<div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-size: 48px;">+</div>',
    trial_duration: 1000,
    choices: "NO_KEYS",
    data: { 
        trial_type: 'triggers_saved'
    },
    on_start: function(trial) {
        currentTrial = trial;
        const currentTime = performance.now();
        trial.data.time_since_start_ms = currentTime - experimentStartTime;
        trial.data.time_since_start_sec = (currentTime - experimentStartTime) / 1000;
    },
    on_finish: function(data) {
        data.all_triggers = JSON.stringify(triggers);
        data.trigger_count = triggerCount;
        currentTrial = null;
        initialTriggerCollection = false;
        console.log("%c✓ Initial trigger collection completed", "color: #4CAF50; font-weight: bold;");
        
        // Calculate trial onsets now that we have trigger timing
        calculateTrialOnsets();
    }
};

// ------------------------------------------------------
// INSTRUCTION TRIALS
// ------------------------------------------------------

var enterFullscreen = {
    type: jsPsychFullscreen,
    fullscreen_mode: true,
    message: `
        <div style="font-size: 24px; line-height: 1.5; max-width: 800px; margin: 0 auto; text-align: center;">
            <p>Das Experiment wird im Vollbildmodus durchgeführt.</p>
            <p>Drücken Sie auf die Schaltfläche, um den Vollbildmodus zu aktivieren und das Experiment zu starten.</p>
        </div>
    `,
    button_label: 'Vollbild aktivieren',
    data: {
        trial_type: 'fullscreen_enter'
    }
};

var welcome = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
        <div style="max-width: 1000px; margin: 0 auto; padding: 40px; text-align: center;">
            <h1 style="font-size: 48px; margin-bottom: 40px;">Willkommen zum Sprach-Lokalisierer</h1>
            <p style="font-size: 28px; line-height: 1.5; margin-bottom: 30px;">In diesem Experiment werden Sie Sequenzen von Wörtern oder Nichtwörtern sehen.</p>
            <p style="font-size: 28px; line-height: 1.5; margin-bottom: 30px;">Ihre Aufgabe ist es, jede Sequenz aufmerksam zu lesen und eine Taste zu drücken, wenn Sie dazu aufgefordert werden.</p>
            <p style="font-size: 28px; line-height: 1.5; margin-bottom: 30px;">Bitte bleiben Sie konzentriert und reagieren Sie schnell, wenn Sie die Tasten-Aufforderung sehen.</p>
            <p style="font-size: 28px; line-height: 1.5; margin-top: 50px;">Drücken Sie eine beliebige Taste, um fortzufahren.</p>
        </div>
    `,
    choices: KEY_RESPONSE,
    data: {
        trial_type: 'welcome'
    }
};

var instructions = {
    type: jsPsychInstructions,
    pages: [
        `
        <div style="max-width: 1000px; margin: 0 auto; padding: 40px;">
            <h2 style="font-size: 36px; margin-bottom: 30px;">Experimentanleitung</h2>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">Während dieses Experiments werden Sie Sequenzen von 12 Wörtern oder Nichtwörtern sehen.</p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">Jedes Wort wird für 200 ms angezeigt (sehr kurz).</p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">Nach jeder Sequenz sehen Sie eine Tasten-Aufforderung <img src="images/hand-press-button-4.png" style="height: 40px; vertical-align: middle; margin: 0 5px;" alt="button">.</p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 30px;"><strong>Wenn Sie die Tasten-Aufforderung <img src="images/hand-press-button-4.png" style="height: 40px; vertical-align: middle; margin: 0 5px;" alt="button"> sehen, drücken Sie so schnell wie möglich eine der Scanner-Tasten.</strong></p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">Das Experiment besteht aus ${TOTAL_TRIALS} Durchgängen, die in ${TOTAL_BLOCKS} Blöcke organisiert sind.</p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">Zwischen einigen Blöcken gibt es Ruhephasen mit einem Fixationskreuz (+).</p>
        </div>
        `,
        `
        <div style="max-width: 1000px; margin: 0 auto; padding: 40px;">
            <h2 style="font-size: 36px; margin-bottom: 30px;">Ihre Aufgabe</h2>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">1. <strong>Lesen Sie jede Sequenz aufmerksam</strong> - versuchen Sie, zu folgen, auch wenn die Wörter schnell präsentiert werden</p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">2. <strong>Drücken Sie eine Taste bei Aufforderung <img src="images/hand-press-button-4.png" style="height: 35px; vertical-align: middle; margin: 0 5px;" alt="button"></strong> - dies hilft uns sicherzustellen, dass Sie aufmerksam sind</p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">3. <strong>Bleiben Sie ruhig und konzentriert</strong> während des gesamten Experiments</p>
            <p style="font-size: 28px; line-height: 1.5; margin-bottom: 30px; color: #2196F3;">Machen Sie sich keine Sorgen, wenn die Sequenzen schnell erscheinen - tun Sie einfach Ihr Bestes!</p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">Das gesamte Experiment dauert etwa 3,5 Minuten.</p>
        </div>
        `,
        `
        <div style="max-width: 1000px; margin: 0 auto; padding: 40px;">
            <h2 style="font-size: 36px; margin-bottom: 30px;">Bereit zum Start</h2>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">Nach diesen Anweisungen beginnt das Experiment, sobald der Scanner bereit ist.</p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">Sie sehen zuerst ein Fixationskreuz (+), dann die Scanner-Trigger, dann die erste Wortsequenz.</p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">Denken Sie daran:</p>
            <ul style="font-size: 24px; line-height: 1.5; text-align: left; margin-bottom: 30px;">
                <li>Bleiben Sie ruhig und konzentriert</li>
                <li>Lesen Sie jede Wortsequenz</li>
                <li>Drücken Sie schnell eine Taste, wenn Sie die Tasten-Aufforderung <img src="images/hand-press-button-4.png" style="height: 30px; vertical-align: middle; margin: 0 5px;" alt="button"> sehen</li>
            </ul>
            <p style="font-size: 28px; line-height: 1.5; margin-top: 30px; color: #4CAF50;"><strong>Drücken Sie eine beliebige Taste, wenn Sie bereit sind!</strong></p>
        </div>
        `
    ],
    key_forward: KEY_FORWARD,
    key_backward: KEY_BACKWARD,
    show_clickable_nav: false,
    data: {
        trial_type: 'instructions'
    }
};

var experimentEndInstructions = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
        <div style="max-width: 1000px; margin: 0 auto; padding: 40px; text-align: center;">
            <h2 style="font-size: 42px; margin-bottom: 40px;">Experiment Abgeschlossen</h2>
            <p style="font-size: 32px; line-height: 1.5; margin-bottom: 30px;">Sie haben den Sprach-Lokalisierer erfolgreich abgeschlossen!</p>
            <p style="font-size: 32px; line-height: 1.5; margin-bottom: 30px; color: #4CAF50;"><strong>Vielen Dank für Ihre Teilnahme!</strong></p>
            <p style="font-size: 32px; line-height: 1.5; margin-bottom: 30px;">Bitte bleiben Sie ruhig liegen, bis der Versuchsleiter zu Ihnen kommt.</p>
            <p style="font-size: 32px; line-height: 1.5; margin-top: 50px;">Drücken Sie eine beliebige Taste zum Beenden.</p>
        </div>
    `,
    choices: KEY_RESPONSE,
    data: {
        trial_type: 'experiment_end_instructions'
    },
    on_finish: function(data) {
        data.current_triggers = JSON.stringify(triggers);
        data.trigger_count = triggerCount;
        data.final_experiment_duration_ms = performance.now() - experimentStartTime;
        data.final_experiment_duration_sec = (performance.now() - experimentStartTime) / 1000;
        
        // Log experiment end
        logExperimentEnd();
    }
};

var exitFullscreen = {
    type: jsPsychFullscreen,
    fullscreen_mode: false,
    data: {
        trial_type: 'fullscreen_exit'
    }
};

// ------------------------------------------------------
// SEQUENCE LOADING TRIAL
// ------------------------------------------------------

var sequenceLoadingTrial = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: function() {
        return `
            <div style="max-width: 800px; margin: 0 auto; text-align: center;">
                <h2>Lade Sprach-Lokalisierer Stimuli...</h2>
                <div style="font-size: 48px; margin: 20px 0;">⏳</div>
                <p style="font-size: 18px; color: #666;">Teilnehmer ${currentParticipantId} - Durchgang ${currentRun}, Set ${currentSet}</p>
                <p style="font-size: 18px; color: #666;">Bitte warten Sie einen Moment...</p>
                <div id="loading-status" style="margin-top: 20px; font-size: 14px; color: #999;"></div>
            </div>
        `;
    },
    choices: "NO_KEYS",
    trial_duration: null,
    data: { 
        trial_type: "sequence_loading",
        participant_id: function() { return currentParticipantId; },
        run: function() { return currentRun; },
        set: function() { return currentSet; }
    },
    on_load: function() {
        var statusDiv = document.getElementById('loading-status');
        if (statusDiv) {
            statusDiv.innerHTML = "Lade Stimuli-Daten...";
        }
        
        // Initialize console logging
        logExperimentHeader();
        
        // Start the async loading process
        loadStimuliData(currentRun, currentSet)
            .then(function(stimuliData) {
                if (statusDiv) {
                    statusDiv.innerHTML = "Stimuli geladen. Erstelle Durchgänge...";
                }
                
                // Store stimuli globally
                loadedStimuli = stimuliData;
                
                if (!stimuliData) {
                    throw new Error("Keine Stimuli-Daten empfangen");
                }
                
                if (statusDiv) {
                    statusDiv.innerHTML = "Füge Durchgänge zur Timeline hinzu...";
                }
                
                // Build the rest of the timeline
                buildRestOfTimeline();
                
                if (statusDiv) {
                    statusDiv.innerHTML = `Stimuli für Durchgang ${currentRun}, Set ${currentSet} bereit.`;
                }
                
                // End this trial successfully after a short delay
                setTimeout(function() {
                    jsPsych.finishTrial({
                        success: true,
                        participant_id: currentParticipantId,
                        run: currentRun,
                        set: currentSet,
                        total_trials: loadedStimuli.trials.length
                    });
                }, 1000);
                
            })
            .catch(function(error) {
                console.error("Error loading stimuli:", error);
                
                if (statusDiv) {
                    statusDiv.innerHTML = `Fehler: ${error.message}`;
                }
                
                // End trial with error after delay
                setTimeout(function() {
                    alert('Stimuli konnten nicht geladen werden. Experiment wird beendet.');
                    jsPsych.finishTrial({
                        success: false,
                        error: error.message
                    });
                }, 2000);
            });
    }
};

// Build the rest of the timeline after stimuli are loaded
function buildRestOfTimeline() {
    // Add instruction trials
    jsPsych.addNodeToEndOfTimeline(enterFullscreen);
    jsPsych.addNodeToEndOfTimeline(welcome);
    jsPsych.addNodeToEndOfTimeline(instructions);
    
    // Add trigger sequence
    jsPsych.addNodeToEndOfTimeline(firstTrigger);
    jsPsych.addNodeToEndOfTimeline(triggerLoop);
    jsPsych.addNodeToEndOfTimeline(saveTriggers);
    
    // Initial fixation (14s) before first trial
    jsPsych.addNodeToEndOfTimeline(createFixationTrial(1, 0));
    
    // Add all 48 trials with fixations, grouped by blocks for logging
    for (let blockNum = 1; blockNum <= TOTAL_BLOCKS; blockNum++) {
        const blockStartTrial = (blockNum - 1) * TRIALS_PER_BLOCK;
        const blockEndTrial = blockNum * TRIALS_PER_BLOCK;
        
        // Get trials for this block
        const trialsInBlock = [];
        for (let t = blockStartTrial; t < blockEndTrial; t++) {
            const trialData = loadedStimuli?.trials[t];
            if (trialData) {
                trialsInBlock.push(trialData);
            }
        }
        
        // Log block start
        const blockStartNode = {
            type: jsPsychCallFunction,
            func: function() {
                logBlockStart(blockNum, trialsInBlock);
            }
        };
        jsPsych.addNodeToEndOfTimeline(blockStartNode);
        
        // Add trials for this block
        for (let t = blockStartTrial; t < blockEndTrial; t++) {
            const trialData = loadedStimuli?.trials[t];
            if (!trialData) {
                console.error(`No trial data found for trial ${t + 1}`);
                continue;
            }
            
            // Add the trial
            jsPsych.addNodeToEndOfTimeline(createWordSequenceTrial(trialData, t));
        }
        
        // Add fixation after trials 12, 24, 36, 48
        if ([12, 24, 36, 48].includes(blockEndTrial)) {
            const fixationNumber = Math.floor(blockEndTrial / 12) + 1;
            jsPsych.addNodeToEndOfTimeline(createFixationTrial(fixationNumber + 1, blockEndTrial));
        }
    }
    
    // End instructions
    jsPsych.addNodeToEndOfTimeline(experimentEndInstructions);
    jsPsych.addNodeToEndOfTimeline(exitFullscreen);
}

// ------------------------------------------------------
// MAIN EXPERIMENT SETUP
// ------------------------------------------------------

function initializeExperiment() {
    const timeline = [];
    
    // Participant ID collection
    timeline.push({
        type: jsPsychSurveyHtmlForm,
        html: `
            <div style="max-width: 600px; margin: 0 auto; color: white;">
                <h2 style="text-align: center;">Schneller Sprach-Lokalisierer</h2>
                <p style="text-align: center;">Bitte geben Sie Ihre Teilnehmer-ID ein:</p>
                <div style="margin: 20px 0;">
                    <label for="participant_id" style="display: block; margin-bottom: 5px;">Teilnehmer-ID:</label>
                    <input type="text" id="participant_id" name="participant_id" required style="width: 100%; padding: 8px; font-size: 16px; color: black; background: white;">
                </div>
                <div style="margin: 20px 0;">
                    <label for="run" style="display: block; margin-bottom: 5px;">Durchgang (1 oder 2):</label>
                    <select id="run" name="run" required style="width: 100%; padding: 8px; font-size: 16px; color: black; background: white;">
                        <option value="">Durchgang wählen</option>
                        <option value="1">Durchgang 1</option>
                        <option value="2">Durchgang 2</option>
                    </select>
                </div>
                <div style="margin: 20px 0;">
                    <label for="set" style="display: block; margin-bottom: 5px;">Set (1-5):</label>
                    <select id="set" name="set" required style="width: 100%; padding: 8px; font-size: 16px; color: black; background: white;">
                        <option value="">Set wählen</option>
                        <option value="1">Set 1</option>
                        <option value="2">Set 2</option>
                        <option value="3">Set 3</option>
                        <option value="4">Set 4</option>
                        <option value="5">Set 5</option>
                    </select>
                </div>
            </div>
        `,
        button_label: 'Weiter',
        data: {
            trial_type: 'participant_info'
        },
        on_load: function() {
            // Auto-focus auf das erste Input-Feld setzen
            setTimeout(function() {
                const input = document.getElementById('participant_id');
                if (input) {
                    input.focus();
                    input.style.caretColor = 'black'; // Cursor-Farbe
                    console.log("Input field focused"); // Debug
                } else {
                    console.log("Input field not found!"); // Debug
                }
            }, 100);
        },
        on_finish: function(data) {
            currentParticipantId = data.response.participant_id;
            currentRun = parseInt(data.response.run);
            currentSet = parseInt(data.response.set);
            
            // Update global variable for filename
            window.participantId = currentParticipantId;
            
            jsPsych.data.addProperties({
                participant_id: currentParticipantId,
                run: currentRun,
                set: currentSet,
                experiment_type: 'speeded_language_localizer'
            });
        }
    });
    
    // Add the sequence loading trial
    timeline.push(sequenceLoadingTrial);
    
    // Start experiment
    jsPsych.run(timeline);
}

// Event listener for trigger key
document.addEventListener('DOMContentLoaded', function() {
    document.addEventListener('keydown', (event) => {
        if (event.key === triggerKey && triggerFlag === true) {
            console.log("Trigger key pressed:", triggerKey);
            
            if (!initialTriggerCollection) {
                recordTrigger();
                event.stopPropagation();
                event.preventDefault();
            }
        }
    }, true);
    
    // Initialize experiment once DOM is loaded
    initializeExperiment();
});
/* ------------------------------------------------------
 * md_localizer.js - MD Localizer for fMRI
 * 
 * Multiple Demand Network Localizer
 * Spatial working memory task with easy/hard conditions
 * 
 * Experiment structure:
 * - 64 trials total (16 blocks of 4 trials each)
 * - Each trial: 500ms fixation → sequence → choice → feedback = 8000ms total
 * - Block fixation periods (16s) between blocks
 * - Total runtime: ~15-20 minutes
 * - Two conditions: Easy (4 squares) vs Hard (8 squares)
 * ------------------------------------------------------*/

// ------------------------------------------------------
// GLOBAL CONFIGURATION & VARIABLES
// ------------------------------------------------------
const DEBUG_MODE = false;

// Experiment parameters (matching MATLAB timing)
const FIXATION_DURATION = 500;          // 500ms fixation before each trial
const TRIAL_LENGTH = 8000;               // 8 seconds total trial length
const PRESENTATION_DURATION = 1000;     // 1000ms per presentation step
const FEEDBACK_DURATION = 250;          // 250ms feedback
const BLOCK_FIXATION_DURATION = 16000;  // 16s fixation between blocks
const TRIALS_PER_BLOCK = 4;             // 4 trials per block
const TOTAL_BLOCKS = 16;                // 16 blocks total
const TOTAL_TRIALS = 48;                // 48 actual trials (12 blocks × 4 trials)

// Scanner keys  
const RESPONSE_KEYS = ['g', 'b', '1', '2'];
const KEY_FORWARD = 'b';
const KEY_BACKWARD = 'g';

// Trigger variables
var triggerKey = "t";
var triggers = [];
var triggerCount = 0;
var triggersToCollect = 5;
var triggerFlag = false;
var experimentStartTime = 0;
var currentTrial = null;
var initialTriggerCollection = true;

// Experiment variables
var currentParticipantId = null;
var currentOrder = 1;
var generatedTrials = [];

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
    console.log("%c║         MD LOCALIZER - SCANNER MONITOR                        ║", "color: #4CAF50; font-weight: bold;");
    console.log("%c╚═══════════════════════════════════════════════════════════════╝", "color: #4CAF50; font-weight: bold;");
    console.log("");
    console.log("%c📊 Experiment Configuration:", "color: #2196F3; font-weight: bold; font-size: 14px;");
    console.log(`   Participant: ${currentParticipantId}`);
    console.log(`   Order: ${currentOrder}`);
    console.log(`   Total Trials: ${TOTAL_TRIALS} (12 blocks of ${TRIALS_PER_BLOCK})`);
    console.log(`   Trial Duration: ${TRIAL_LENGTH}ms`);
    console.log(`   Block Fixation: ${BLOCK_FIXATION_DURATION}ms`);
    console.log("");
    
    // Calculate total duration
    const trialsTime = TOTAL_TRIALS * TRIAL_LENGTH;
    const fixationsTime = 5 * BLOCK_FIXATION_DURATION; // 5 fixation blocks
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

function logBlockStart(blockNumber, condition, trialsInBlock) {
    currentBlockNumber = blockNumber;
    blockResponseTracker[blockNumber] = {
        condition: condition,
        trials: [],
        correct: 0,
        total: trialsInBlock
    };
    
    console.log("");
    console.log("%c" + "═".repeat(63), "color: #2196F3;");
    console.log(`%c🔷 BLOCK ${blockNumber}/12 - ${condition.toUpperCase()} CONDITION`, "color: #2196F3; font-weight: bold; font-size: 14px;");
    console.log("%c" + "═".repeat(63), "color: #2196F3;");
    console.log("");
}

function logTrialResponse(trialNumber, blockNumber, accuracy, responseTime, condition) {
    const icon = accuracy === 1 ? "✅" : (accuracy === 0 ? "❌" : "⊝");
    const rtText = responseTime !== null ? `RT: ${Math.round(responseTime)}ms` : "NO RESPONSE";
    const color = accuracy === 1 ? "#4CAF50" : (accuracy === 0 ? "#F44336" : "#FF9800");
    
    console.log(`%c${icon} Trial ${trialNumber} (Block ${blockNumber}): ${condition} | ${rtText}`, 
                `color: ${color}; font-weight: bold;`);
    
    // Update block tracker
    if (blockResponseTracker[blockNumber]) {
        blockResponseTracker[blockNumber].trials.push({
            trial: trialNumber,
            accuracy: accuracy,
            rt: responseTime
        });
        if (accuracy === 1) {
            blockResponseTracker[blockNumber].correct++;
        }
    }
}

function logBlockEnd(blockNumber) {
    const tracker = blockResponseTracker[blockNumber];
    if (!tracker) return;
    
    const accuracyRate = (tracker.correct / tracker.total * 100).toFixed(1);
    const validRTs = tracker.trials.filter(t => t.rt !== null).map(t => t.rt);
    const avgRT = validRTs.length > 0 ? validRTs.reduce((a, b) => a + b, 0) / validRTs.length : 0;
    
    console.log("");
    console.log(`%c📊 BLOCK ${blockNumber} SUMMARY:`, "color: #9C27B0; font-weight: bold;");
    console.log(`   Condition: ${tracker.condition}`);
    console.log(`   Accuracy: ${tracker.correct}/${tracker.total} (${accuracyRate}%)`);
    if (validRTs.length > 0) {
        console.log(`   Average RT: ${Math.round(avgRT)}ms`);
    }
    console.log("%c" + "─".repeat(63), "color: #666;");
    console.log("");
}

function logFixationStart(fixationNumber) {
    console.log("");
    console.log(`%c⊕ FIXATION ${fixationNumber} (${BLOCK_FIXATION_DURATION/1000}s)`, "color: #607D8B; font-weight: bold; font-size: 13px;");
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
    let totalCorrect = 0;
    let totalTrials = 0;
    let allRTs = [];
    let easyCorrect = 0, easyTotal = 0;
    let hardCorrect = 0, hardTotal = 0;
    
    Object.values(blockResponseTracker).forEach(block => {
        totalCorrect += block.correct;
        totalTrials += block.total;
        
        if (block.condition === 'easy') {
            easyCorrect += block.correct;
            easyTotal += block.total;
        } else {
            hardCorrect += block.correct;
            hardTotal += block.total;
        }
        
        block.trials.filter(t => t.rt !== null).forEach(t => allRTs.push(t.rt));
    });
    
    const overallAccuracy = (totalCorrect / totalTrials * 100).toFixed(1);
    const easyAccuracy = easyTotal > 0 ? (easyCorrect / easyTotal * 100).toFixed(1) : 0;
    const hardAccuracy = hardTotal > 0 ? (hardCorrect / hardTotal * 100).toFixed(1) : 0;
    const avgRT = allRTs.length > 0 ? allRTs.reduce((a, b) => a + b, 0) / allRTs.length : 0;
    
    console.log("%c📈 OVERALL PERFORMANCE:", "color: #FF9800; font-weight: bold; font-size: 14px;");
    console.log(`   Total Accuracy: ${totalCorrect}/${totalTrials} (${overallAccuracy}%)`);
    console.log(`   Easy Accuracy: ${easyCorrect}/${easyTotal} (${easyAccuracy}%)`);
    console.log(`   Hard Accuracy: ${hardCorrect}/${hardTotal} (${hardAccuracy}%)`);
    console.log(`   Average RT: ${Math.round(avgRT)}ms`);
    console.log(`   Triggers Collected: ${triggerCount}`);
    console.log("");
    console.log("%cData saved successfully! ✓", "color: #4CAF50; font-weight: bold;");
    console.log("");
}

// ------------------------------------------------------
// UTILITY FUNCTIONS
// ------------------------------------------------------

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

// ------------------------------------------------------
// VISUALIZATION HELPER FUNCTION FOR INSTRUCTIONS
// ------------------------------------------------------

function generateGridSVG(shape, size = 40) {
    let svg = `<svg width="${size * 4}" height="${size * 3}" style="border: 1px solid #666;">`;
    
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
            const x = c * size;
            const y = r * size;
            
            // Draw cell
            if (shape[r][c] === 1) {
                svg += `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#0066ff" stroke="#000" stroke-width="1"/>`;
            } else {
                svg += `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#ffffff" stroke="#000" stroke-width="1"/>`;
            }
        }
    }
    
    svg += '</svg>';
    return svg;
}

// ------------------------------------------------------
// SHAPE GENERATION FUNCTIONS (adapted from MATLAB)
// ------------------------------------------------------

function isAdjacent(index1, index2) {
    const [r1, c1] = indexToRowCol(index1);
    const [r2, c2] = indexToRowCol(index2);
    
    if (r1 === r2 && Math.abs(c1 - c2) === 1) return true;
    if (c1 === c2 && Math.abs(r1 - r2) === 1) return true;
    return false;
}

function indexToRowCol(index) {
    const row = Math.floor((index - 1) / 4);
    const col = (index - 1) % 4;
    return [row, col];
}

function rowColToIndex(row, col) {
    return row * 4 + col + 1;
}

function validateShape(shape) {
    if (shape.flat().every(x => x === 0)) return false;
    
    let startRow = -1, startCol = -1;
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
            if (shape[r][c] === 1) {
                startRow = r;
                startCol = c;
                break;
            }
        }
        if (startRow !== -1) break;
    }
    
    const tagged = shape.map(row => row.slice());
    function tag(r, c) {
        if (r < 0 || r >= 3 || c < 0 || c >= 4 || tagged[r][c] !== 1) return;
        tagged[r][c] = -1;
        tag(r-1, c); tag(r+1, c); tag(r, c-1); tag(r, c+1);
    }
    tag(startRow, startCol);
    
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
            if (shape[r][c] === 1 && tagged[r][c] !== -1) return false;
        }
    }
    return true;
}

function generateShape(difficulty) {
    const numSquares = difficulty === 'easy' ? 4 : 8;
    let shape;
    let attempts = 0;
    
    do {
        shape = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
        let filled = 0;
        
        while (filled < numSquares && attempts < 1000) {
            const row = Math.floor(Math.random() * 3);
            const col = Math.floor(Math.random() * 4);
            if (shape[row][col] === 0) {
                shape[row][col] = 1;
                filled++;
            }
        }
        attempts++;
    } while (!validateShape(shape) && attempts < 1000);
    
    if (attempts >= 1000) {
        console.warn("Could not generate valid shape, using fallback");
        if (difficulty === 'easy') {
            shape = [[1, 0, 0, 0], [1, 0, 0, 0], [1, 1, 0, 0]];
        } else {
            shape = [[1, 1, 1, 0], [1, 1, 1, 0], [1, 1, 0, 0]];
        }
    }
    
    return shape;
}

function generateDisplayOrder(shape, difficulty) {
    const indices = [];
    
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
            if (shape[r][c] === 1) {
                indices.push(rowColToIndex(r, c));
            }
        }
    }
    
    if (difficulty === 'easy') {
        const order = [];
        const remaining = indices.slice();
        
        const first = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0];
        order.push(first);
        
        while (remaining.length > 0) {
            let found = false;
            for (let i = 0; i < remaining.length; i++) {
                const candidate = remaining[i];
                if (order.some(placed => isAdjacent(candidate, placed))) {
                    order.push(remaining.splice(i, 1)[0]);
                    found = true;
                    break;
                }
            }
            if (!found) {
                order.push(remaining.shift());
            }
        }
        return order;
        
    } else {
        const pairs = [];
        const remaining = indices.slice();
        
        const first = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0];
        let second = null;
        for (let i = 0; i < remaining.length; i++) {
            if (isAdjacent(first, remaining[i])) {
                second = remaining.splice(i, 1)[0];
                break;
            }
        }
        
        if (second === null && remaining.length > 0) {
            second = remaining.splice(0, 1)[0];
        }
        
        pairs.push([first, second]);
        
        const displayedSoFar = [first, second];
        let tempSquare = null;
        
        while (remaining.length > 0) {
            let found = false;
            
            for (let i = 0; i < remaining.length; i++) {
                const candidate = remaining[i];
                if (displayedSoFar.some(shown => isAdjacent(candidate, shown))) {
                    if (tempSquare === null) {
                        tempSquare = remaining.splice(i, 1)[0];
                        displayedSoFar.push(tempSquare);
                        found = true;
                        break;
                    } else {
                        const partner = remaining.splice(i, 1)[0];
                        pairs.push([tempSquare, partner]);
                        displayedSoFar.push(partner);
                        tempSquare = null;
                        found = true;
                        break;
                    }
                }
            }
            
            if (!found && remaining.length > 0) {
                if (tempSquare === null) {
                    tempSquare = remaining.splice(0, 1)[0];
                    displayedSoFar.push(tempSquare);
                } else {
                    const partner = remaining.splice(0, 1)[0];
                    pairs.push([tempSquare, partner]);
                    displayedSoFar.push(partner);
                    tempSquare = null;
                }
            }
        }
        
        if (tempSquare !== null) {
            pairs.push([tempSquare]);
        }
        
        return pairs;
    }
}

function generateFakeAnswer(correctShape) {
    let fakeShape;
    let attempts = 0;
    
    do {
        fakeShape = correctShape.map(row => row.slice());
        
        const filledPositions = [];
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 4; c++) {
                if (fakeShape[r][c] === 1) {
                    filledPositions.push([r, c]);
                }
            }
        }
        
        if (filledPositions.length === 0) {
            console.error("No filled positions to remove!");
            break;
        }
        
        const removeIndex = Math.floor(Math.random() * filledPositions.length);
        const [removeR, removeC] = filledPositions[removeIndex];
        fakeShape[removeR][removeC] = 0;
        
        const emptyAdjacent = [];
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 4; c++) {
                if (correctShape[r][c] === 0 && fakeShape[r][c] === 0) {
                    const adjacent = (r > 0 && fakeShape[r-1][c]) ||
                                   (r < 2 && fakeShape[r+1][c]) ||
                                   (c > 0 && fakeShape[r][c-1]) ||
                                   (c < 3 && fakeShape[r][c+1]);
                    if (adjacent) {
                        emptyAdjacent.push([r, c]);
                    }
                }
            }
        }
        
        if (emptyAdjacent.length === 0) {
            console.warn("No valid adjacent empty squares found");
            attempts++;
            continue;
        }
        
        const [addR, addC] = emptyAdjacent[Math.floor(Math.random() * emptyAdjacent.length)];
        fakeShape[addR][addC] = 1;
        
        attempts++;
    } while (!validateShape(fakeShape) && attempts < 100);
    
    if (attempts >= 100) {
        console.warn("Could not generate valid fake shape, using simple modification");
        fakeShape = correctShape.map(row => row.slice());
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 4; c++) {
                if (fakeShape[r][c] === 1) {
                    fakeShape[r][c] = 0;
                    break;
                }
            }
        }
    }
    
    return fakeShape;
}

function generateTwoSquareFake(correctShape) {
    let fakeShape;
    let attempts = 0;
    
    do {
        fakeShape = generateFakeAnswer(generateFakeAnswer(correctShape));
        attempts++;
    } while (shapesAreEqual(correctShape, fakeShape) && attempts < 100);
    
    if (attempts >= 100 || shapesAreEqual(correctShape, fakeShape)) {
        console.warn("Could not generate 2-square difference, using 1-square");
        fakeShape = generateFakeAnswer(correctShape);
    }
    
    return fakeShape;
}

function shapesAreEqual(shape1, shape2) {
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
            if (shape1[r][c] !== shape2[r][c]) {
                return false;
            }
        }
    }
    return true;
}

function generateAllTrials(order) {
    const trials = [];
    
    let conditions;
    if (order === 1) {
        conditions = ['+','easy','hard','hard','easy','+','hard','easy','easy','hard','+','easy','hard','hard','easy','+'];
    } else {
        conditions = ['+','hard','easy','easy','hard','+','easy','hard','hard','easy','+','hard','easy','easy','hard','+'];
    }
    
    let trialNumber = 1;
    
    for (let blockNum = 1; blockNum <= conditions.length; blockNum++) {
        const condition = conditions[blockNum - 1];
        
        if (condition === '+') {
            continue;
        }
        
        for (let trialInBlock = 1; trialInBlock <= TRIALS_PER_BLOCK; trialInBlock++) {
            const shape = generateShape(condition);
            const displayOrder = generateDisplayOrder(shape, condition);
            
            const fakeShape = Math.random() < 0.5 
                ? generateFakeAnswer(shape)
                : generateTwoSquareFake(shape);
            
            trials.push({
                trial_number: trialNumber,
                block_number: blockNum,
                trial_in_block: trialInBlock,
                condition: condition,
                shape: shape,
                fake_shape: fakeShape,
                display_order: displayOrder
            });
            
            trialNumber++;
        }
    }
    
    console.log(`%c✓ Generated ${trials.length} trials`, "color: #4CAF50;");
    return trials;
}

// ------------------------------------------------------
// TRIGGER TRIALS
// ------------------------------------------------------

var firstTrigger = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column;">
            <p style="font-size:26px; text-align: center; color: white;">Bitte informieren Sie jetzt den Versuchsleiter.</p>
            <p style="font-size:26px; text-align: center; color: white;">Das Experiment beginnt, sobald der Scanner bereit ist.</p>
            <p style="font-size:60px; margin-top: 40px; color: white; font-family: Arial, sans-serif;">+</p>
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
                <p style="font-size:22px; text-align: center; color: white;">Warte auf Scanner-Trigger... (${triggersToCollect - triggerCount} noch benötigt)</p>
                <p style="font-size:60px; margin-top: 40px; color: white; font-family: Arial, sans-serif;">+</p>
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
    stimulus: '<div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-size: 48px; color: white; font-family: Arial, sans-serif;">+</div>',
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
            <p>Drücken Sie die Taste, um den Vollbildmodus zu aktivieren und das Experiment zu beginnen.</p>
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
            <h1 style="font-size: 48px; margin-bottom: 40px;">Willkommen zum MD Localizer</h1>
            <p style="font-size: 28px; line-height: 1.5; margin-bottom: 30px;">In diesem Experiment sehen Sie Sequenzen von blauen Quadraten in einem Raster.</p>
            <p style="font-size: 28px; line-height: 1.5; margin-bottom: 30px;">Ihre Aufgabe ist es, die Sequenzen aufmerksam zu verfolgen und am Ende das korrekte Muster zu identifizieren.</p>
            <p style="font-size: 28px; line-height: 1.5; margin-bottom: 30px;">Bitte bleiben Sie während des gesamten Experiments konzentriert.</p>
            <p style="font-size: 28px; line-height: 1.5; margin-top: 50px;">Drücken Sie eine beliebige Taste zum Fortfahren.</p>
        </div>
    `,
    choices: RESPONSE_KEYS,
    data: {
        trial_type: 'welcome'
    }
};

var instructions = {
    type: jsPsychInstructions,
    pages: [
        `
        <div style="max-width: 1000px; margin: 0 auto; padding: 40px;">
            <h2 style="font-size: 36px; margin-bottom: 30px;">Experimentanweisungen</h2>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">In diesem Experiment sehen Sie Sequenzen von blauen Quadraten, die nacheinander in einem 3×4 Raster erscheinen.</p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">Jede Sequenz dauert einige Sekunden.</p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">Nach jeder Sequenz sehen Sie zwei Raster nebeneinander.</p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 30px;"><strong>Wählen Sie das Raster aus, das der gezeigten Sequenz entspricht.</strong></p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">Das Experiment besteht aus 12 Blöcken mit je ${TRIALS_PER_BLOCK} Aufgaben.</p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">Zwischen einigen Blöcken gibt es Ruhepausen mit einem Fixationskreuz (+).</p>
        </div>
        `,
        `
        <div style="max-width: 1200px; margin: 0 auto; padding: 30px;">
            <h2 style="font-size: 36px; margin-bottom: 30px; text-align: center;">Beispiel: Einfache Bedingung (4 Quadrate)</h2>
            <p style="font-size: 20px; line-height: 1.5; margin-bottom: 25px; text-align: center;">Die blauen Quadrate erscheinen <strong>einzeln nacheinander</strong>:</p>
            
            <div style="display: flex; justify-content: space-around; align-items: center; margin: 30px 0; flex-wrap: wrap;">
                <div style="text-align: center; margin: 10px;">
                    <div style="font-size: 18px; margin-bottom: 10px; font-weight: bold;">Schritt 1</div>
                    ${generateGridSVG([[1,0,0,0],[0,0,0,0],[0,0,0,0]], 35)}
                </div>
                <div style="text-align: center; margin: 10px;">
                    <div style="font-size: 18px; margin-bottom: 10px; font-weight: bold;">Schritt 2</div>
                    ${generateGridSVG([[1,0,0,0],[1,0,0,0],[0,0,0,0]], 35)}
                </div>
                <div style="text-align: center; margin: 10px;">
                    <div style="font-size: 18px; margin-bottom: 10px; font-weight: bold;">Schritt 3</div>
                    ${generateGridSVG([[1,0,0,0],[1,0,0,0],[1,0,0,0]], 35)}
                </div>
                <div style="text-align: center; margin: 10px;">
                    <div style="font-size: 18px; margin-bottom: 10px; font-weight: bold;">Schritt 4</div>
                    ${generateGridSVG([[1,0,0,0],[1,0,0,0],[1,1,0,0]], 35)}
                </div>
            </div>
            
            <p style="font-size: 20px; line-height: 1.5; margin: 30px 0 20px 0; text-align: center;">Dann wählen Sie das korrekte Muster:</p>
            
            <div style="display: flex; justify-content: center; align-items: center; gap: 60px; margin: 20px 0;">
                <div style="text-align: center;">
                    <div style="font-size: 20px; margin-bottom: 10px; font-weight: bold; color: #4CAF50;">✓ KORREKT</div>
                    ${generateGridSVG([[1,0,0,0],[1,0,0,0],[1,1,0,0]], 45)}
                    <div style="font-size: 16px; margin-top: 10px; color: #999;">Linke Taste drücken</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 20px; margin-bottom: 10px; font-weight: bold; color: #F44336;">✗ FALSCH</div>
                    ${generateGridSVG([[1,0,0,0],[1,1,0,0],[1,1,0,0]], 45)}
                    <div style="font-size: 16px; margin-top: 10px; color: #999;">Rechte Taste drücken</div>
                </div>
            </div>
        </div>
        `,
        `
        <div style="max-width: 1200px; margin: 0 auto; padding: 30px;">
            <h2 style="font-size: 36px; margin-bottom: 30px; text-align: center;">Beispiel: Schwere Bedingung (8 Quadrate)</h2>
            <p style="font-size: 20px; line-height: 1.5; margin-bottom: 25px; text-align: center;">Die blauen Quadrate erscheinen <strong>paarweise nacheinander</strong>:</p>
            
            <div style="display: flex; justify-content: space-around; align-items: center; margin: 30px 0; flex-wrap: wrap;">
                <div style="text-align: center; margin: 10px;">
                    <div style="font-size: 18px; margin-bottom: 10px; font-weight: bold;">Schritt 1</div>
                    ${generateGridSVG([[1,1,0,0],[0,0,0,0],[0,0,0,0]], 35)}
                </div>
                <div style="text-align: center; margin: 10px;">
                    <div style="font-size: 18px; margin-bottom: 10px; font-weight: bold;">Schritt 2</div>
                    ${generateGridSVG([[1,1,1,0],[1,0,0,0],[0,0,0,0]], 35)}
                </div>
                <div style="text-align: center; margin: 10px;">
                    <div style="font-size: 18px; margin-bottom: 10px; font-weight: bold;">Schritt 3</div>
                    ${generateGridSVG([[1,1,1,0],[1,1,1,0],[0,0,0,0]], 35)}
                </div>
                <div style="text-align: center; margin: 10px;">
                    <div style="font-size: 18px; margin-bottom: 10px; font-weight: bold;">Schritt 4</div>
                    ${generateGridSVG([[1,1,1,0],[1,1,1,0],[1,1,0,0]], 35)}
                </div>
            </div>
            
            <p style="font-size: 20px; line-height: 1.5; margin: 30px 0 20px 0; text-align: center;">Dann wählen Sie das korrekte Muster:</p>
            
            <div style="display: flex; justify-content: center; align-items: center; gap: 60px; margin: 20px 0;">
                <div style="text-align: center;">
                    <div style="font-size: 20px; margin-bottom: 10px; font-weight: bold; color: #4CAF50;">✓ KORREKT</div>
                    ${generateGridSVG([[1,1,1,0],[1,1,1,0],[1,1,0,0]], 45)}
                    <div style="font-size: 16px; margin-top: 10px; color: #999;">Linke Taste drücken</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 20px; margin-bottom: 10px; font-weight: bold; color: #F44336;">✗ FALSCH</div>
                    ${generateGridSVG([[1,1,1,0],[1,1,1,0],[0,1,1,0]], 45)}
                    <div style="font-size: 16px; margin-top: 10px; color: #999;">Rechte Taste drücken</div>
                </div>
            </div>
        </div>
        `,
        `
        <div style="max-width: 1000px; margin: 0 auto; padding: 40px;">
            <h2 style="font-size: 36px; margin-bottom: 30px;">Ihre Aufgabe</h2>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">1. <strong>Verfolgen Sie jede Sequenz aufmerksam</strong> - achten Sie darauf, wo die blauen Quadrate erscheinen</p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">2. <strong>Wählen Sie das korrekte Muster</strong> - drücken Sie die linke oder rechte Taste</p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">3. <strong>Bleiben Sie ruhig und konzentriert</strong> während des gesamten Experiments</p>
            <p style="font-size: 28px; line-height: 1.5; margin-bottom: 30px; color: #2196F3;">Es wird manchmal schnell gehen - geben Sie einfach Ihr Bestes!</p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">Das gesamte Experiment dauert etwa 15-20 Minuten.</p>
        </div>
        `,
        `
        <div style="max-width: 1000px; margin: 0 auto; padding: 40px;">
            <h2 style="font-size: 36px; margin-bottom: 30px;">Bereit zum Start</h2>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">Nach diesen Anweisungen beginnt das Experiment, sobald der Scanner bereit ist.</p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">Sie sehen zuerst ein Fixationskreuz (+), dann die Scanner-Trigger, dann die ersten Quadrat-Sequenzen.</p>
            <p style="font-size: 24px; line-height: 1.5; margin-bottom: 20px;">Denken Sie daran:</p>
            <ul style="font-size: 24px; line-height: 1.5; text-align: left; margin-bottom: 30px;">
                <li>Ruhig bleiben und konzentriert sein</li>
                <li>Jede Quadrat-Sequenz verfolgen</li>
                <li>Linke oder rechte Taste für Ihre Antwort drücken</li>
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
            <h2 style="font-size: 42px; margin-bottom: 40px;">Experiment beendet</h2>
            <p style="font-size: 32px; line-height: 1.5; margin-bottom: 30px;">Sie haben den MD Localizer erfolgreich abgeschlossen!</p>
            <p style="font-size: 32px; line-height: 1.5; margin-bottom: 30px; color: #4CAF50;"><strong>Vielen Dank für Ihre Teilnahme!</strong></p>
            <p style="font-size: 32px; line-height: 1.5; margin-bottom: 30px;">Bitte bleiben Sie ruhig liegen, bis der Versuchsleiter zu Ihnen kommt.</p>
            <p style="font-size: 32px; line-height: 1.5; margin-top: 50px;">Drücken Sie eine beliebige Taste zum Beenden.</p>
        </div>
    `,
    choices: RESPONSE_KEYS,
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
// TRIAL CREATION FUNCTIONS
// ------------------------------------------------------

function createMDLocalizerTrial(trialData) {
    return {
        type: jsPsychMDLocalizer,
        condition: trialData.condition,
        shape: trialData.shape,
        fake_shape: trialData.fake_shape,
        display_order: trialData.display_order,
        trial_number: trialData.trial_number,
        block_number: trialData.block_number,
        fixation_duration: FIXATION_DURATION,
        presentation_duration: PRESENTATION_DURATION,
        feedback_duration: FEEDBACK_DURATION,
        response_keys: RESPONSE_KEYS,
        trial_length: TRIAL_LENGTH,
        data: {
            trial_type: 'md_localizer_trial',
            trial_number: trialData.trial_number,
            block_number: trialData.block_number,
            trial_in_block: trialData.trial_in_block,
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
            
            // Log the response
            logTrialResponse(
                data.trial_number,
                data.block_number,
                data.accuracy,
                data.response_time,
                data.condition
            );
        }
    };
}

function createBlockFixation(blockNumber) {
    return {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-size: 48px; color: white; font-family: Arial, sans-serif;">+</div>',
        choices: "NO_KEYS",
        trial_duration: BLOCK_FIXATION_DURATION,
        data: {
            trial_type: 'block_fixation',
            block_number: blockNumber,
            fixation_duration: BLOCK_FIXATION_DURATION
        },
        on_start: function(trial) {
            currentTrial = trial;
            const currentTime = performance.now();
            trial.data.fixation_onset_time = currentTime;
            trial.data.fixation_time_since_start_ms = currentTime - experimentStartTime;
            
            if (triggers.length > 0) {
                trial.data.fixation_time_from_first_trigger_ms = currentTime - triggers[0].time;
            }
            
            logFixationStart(blockNumber);
        },
        on_finish: function(data) {
            data.current_triggers = JSON.stringify(triggers);
            data.trigger_count = triggerCount;
            currentTrial = null;
            
            // Log block end for previous block
            if (blockNumber > 1) {
                const previousBlockNum = blockNumber - 1;
                // Get actual block number from conditions array
                const conditions = currentOrder === 1 ? 
                    ['+','easy','hard','hard','easy','+','hard','easy','easy','hard','+','easy','hard','hard','easy','+'] :
                    ['+','hard','easy','easy','hard','+','easy','hard','hard','easy','+','hard','easy','easy','hard','+'];
                
                // Count non-fixation blocks before this fixation
                let actualBlockNum = 0;
                for (let i = 0; i < previousBlockNum; i++) {
                    if (conditions[i] !== '+') actualBlockNum++;
                }
                
                if (actualBlockNum > 0) {
                    logBlockEnd(actualBlockNum);
                }
            }
        }
    };
}

function buildExperimentTimeline() {
    const timeline = [];
    
    timeline.push(enterFullscreen);
    timeline.push(welcome);
    timeline.push(instructions);
    
    timeline.push(firstTrigger);
    timeline.push(triggerLoop);
    timeline.push(saveTriggers);
    
    const conditions = currentOrder === 1 ? 
        ['+','easy','hard','hard','easy','+','hard','easy','easy','hard','+','easy','hard','hard','easy','+'] :
        ['+','hard','easy','easy','hard','+','easy','hard','hard','easy','+','hard','easy','easy','hard','+'];
    
    let trialIndex = 0;
    let actualBlockNum = 0;
    
    for (let blockNum = 1; blockNum <= conditions.length; blockNum++) {
        const condition = conditions[blockNum - 1];
        
        if (condition === '+') {
            timeline.push(createBlockFixation(blockNum));
        } else {
            actualBlockNum++;
            
            // Log block start (using call-function plugin)
            const blockStartNode = {
                type: jsPsychCallFunction,
                func: function() {
                    logBlockStart(actualBlockNum, condition, TRIALS_PER_BLOCK);
                }
            };
            timeline.push(blockStartNode);
            
            // Add trials for this block
            for (let trialInBlock = 0; trialInBlock < TRIALS_PER_BLOCK; trialInBlock++) {
                if (trialIndex < generatedTrials.length) {
                    timeline.push(createMDLocalizerTrial(generatedTrials[trialIndex]));
                    trialIndex++;
                } else {
                    console.warn(`No more trials available at index ${trialIndex}`);
                }
            }
        }
    }
    
    timeline.push(experimentEndInstructions);
    timeline.push(exitFullscreen);
    
    console.log(`%c✓ Built timeline with ${timeline.length} components, ${trialIndex} trials`, "color: #4CAF50;");
    
    return timeline;
}

// ------------------------------------------------------
// MAIN EXPERIMENT SETUP
// ------------------------------------------------------

function initializeExperiment() {
    const initialTimeline = [];
    
    initialTimeline.push({
        type: jsPsychSurveyHtmlForm,
        html: `
            <div style="max-width: 600px; margin: 0 auto; color: white;">
                <h2 style="text-align: center;">MD Localizer - Räumliches Arbeitsgedächtnis</h2>
                <p style="text-align: center;">Bitte geben Sie Ihre Teilnehmer-ID ein:</p>
                <div style="margin: 20px 0;">
                    <label for="participant_id" style="display: block; margin-bottom: 5px;">Teilnehmer-ID:</label>
                    <input type="text" id="participant_id" name="participant_id" required style="width: 100%; padding: 8px; font-size: 16px; color: black; background: white;">
                </div>
                <div style="margin: 20px 0;">
                    <label for="order" style="display: block; margin-bottom: 5px;">Durchgang (1 oder 2):</label>
                    <select id="order" name="order" required style="width: 100%; padding: 8px; font-size: 16px; color: black; background: white;">
                        <option value="">Durchgang wählen</option>
                        <option value="1">Durchgang 1</option>
                        <option value="2">Durchgang 2</option>
                    </select>
                </div>
            </div>
        `,
        button_label: 'Weiter',
        on_load: function() {
            // Auto-focus on the first input field
            setTimeout(function() {
                const input = document.getElementById('participant_id');
                if (input) {
                    input.focus();
                    input.style.caretColor = 'black';
                }
            }, 100);
        },
        data: {
            trial_type: 'participant_info'
        },
        on_finish: function(data) {
            currentParticipantId = data.response.participant_id;
            currentOrder = parseInt(data.response.order);
            
            // Update global variable for filename
            window.participantId = currentParticipantId;
            
            // Generate trials
            generatedTrials = generateAllTrials(currentOrder);
            
            // Initialize console logging
            logExperimentHeader();
            
            jsPsych.data.addProperties({
                participant_id: currentParticipantId,
                order: currentOrder,
                experiment_type: 'md_localizer'
            });
            
            const restOfTimeline = buildExperimentTimeline();
            
            for (let i = 0; i < restOfTimeline.length; i++) {
                jsPsych.addNodeToEndOfTimeline(restOfTimeline[i]);
            }
            
            console.log("%c✓ Timeline built successfully", "color: #4CAF50; font-weight: bold;");
        }
    });
    
    jsPsych.run(initialTimeline);
}

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
    
    initializeExperiment();
});
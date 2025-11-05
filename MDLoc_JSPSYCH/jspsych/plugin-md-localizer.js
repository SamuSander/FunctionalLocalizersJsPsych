// plugin-md-localizer.js
var jsPsychMDLocalizer = (function (jspsych) {
  'use strict';

  const info = {
    name: "md-localizer",
    parameters: {
      condition: {
        type: jspsych.ParameterType.STRING,
        pretty_name: 'Condition',
        default: 'easy',
        description: 'Easy (4 squares) or hard (8 squares) condition'
      },
      shape: {
        type: jspsych.ParameterType.OBJECT,  // 🔧 FIXED: Was COMPLEX (doesn't exist in jsPsych v7)
        pretty_name: 'Shape matrix',
        default: undefined,
        description: 'The 3x4 matrix defining the correct shape (1 = filled, 0 = empty)'
      },
      fake_shape: {
        type: jspsych.ParameterType.OBJECT,  // 🔧 FIXED: Was COMPLEX
        pretty_name: 'Fake shape matrix',
        default: undefined,
        description: 'The 3x4 matrix defining the incorrect/fake shape'
      },
      display_order: {
        type: jspsych.ParameterType.OBJECT,  // 🔧 FIXED: Was COMPLEX
        pretty_name: 'Display order',
        default: undefined,
        description: 'Order in which squares appear (array of indices or pairs)'
      },
      fixation_duration: {
        type: jspsych.ParameterType.INT,
        pretty_name: 'Fixation duration',
        default: 500,
        description: 'Duration of initial fixation in ms'
      },
      presentation_duration: {
        type: jspsych.ParameterType.INT,
        pretty_name: 'Presentation duration',
        default: 1000,
        description: 'Duration each grid step is shown in ms'
      },
      feedback_duration: {
        type: jspsych.ParameterType.INT,
        pretty_name: 'Feedback duration',
        default: 250,
        description: 'Duration of feedback display in ms'
      },
      // 🔧 NEW: Trial length parameter for hard deadline enforcement
      trial_length: {
        type: jspsych.ParameterType.INT,
        pretty_name: 'Trial length',
        default: 8000,
        description: 'Total trial duration in ms (hard deadline)'
      },
      response_keys: {
        type: jspsych.ParameterType.KEYS,
        pretty_name: 'Response keys',
        default: ['g', 'b', '1', '2'],  // 🔧 FIXED: Added '1' and '2'
        description: 'Keys for left and right choices'
      },
      trial_number: {
        type: jspsych.ParameterType.INT,
        pretty_name: 'Trial number',
        default: 1,
        description: 'Current trial number'
      },
      block_number: {
        type: jspsych.ParameterType.INT,
        pretty_name: 'Block number',
        default: 1,
        description: 'Current block number'
      }
    }
  };

  class MDLocalizerPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    trial(display_element, trial, on_load) {
      const self = this;
      
      // 🔧 CRITICAL: Record absolute trial start time for hard deadline
      const trial_start_time = performance.now();
      const trial_deadline = trial_start_time + trial.trial_length;
      
      let response_data = {
        accuracy: null,
        response_time: null,
        response_key: null,
        correct_side: null,
        trial_number: trial.trial_number,
        block_number: trial.block_number,
        condition: trial.condition,
        shape_matrix: trial.shape,
        fake_shape_matrix: trial.fake_shape,
        display_order: trial.display_order,
        trial_start_time: trial_start_time,
        trial_deadline: trial_deadline
      };

      // 🔧 FIXED: Map keys to left/right (g and 1 = left, b and 2 = right)
      const LEFT_KEYS = ['g', '1'];
      const RIGHT_KEYS = ['b', '2'];
      const correct_side = Math.random() < 0.5 ? 'left' : 'right';
      response_data.correct_side = correct_side;

      // Grid drawing function (matching MATLAB DrawGrid exactly)
      function drawGrid(canvas, ctx, shape_matrix, x_offset = 0, y_offset = 0) {
        const grid_size = 100;
        const grid_width = 4 * grid_size;
        const grid_height = 3 * grid_size;
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x_offset, y_offset, grid_width, grid_height);
        
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 4; col++) {
            if (shape_matrix[row][col] === 1) {
              const x = x_offset + col * grid_size;
              const y = y_offset + row * grid_size;
              
              ctx.fillStyle = '#0066ff';
              ctx.fillRect(x, y, grid_size, grid_size);
            }
          }
        }
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x_offset, y_offset, grid_width, grid_height);
        
        for (let i = 1; i < 4; i++) {
          const x = x_offset + i * grid_size;
          ctx.beginPath();
          ctx.moveTo(x, y_offset);
          ctx.lineTo(x, y_offset + grid_height);
          ctx.stroke();
        }
        
        for (let i = 1; i < 3; i++) {
          const y = y_offset + i * grid_size;
          ctx.beginPath();
          ctx.moveTo(x_offset, y);
          ctx.lineTo(x_offset + grid_width, y);
          ctx.stroke();
        }
      }

      function indexToRowCol(index) {
        const row = Math.floor((index - 1) / 4);
        const col = (index - 1) % 4;
        return [row, col];
      }

      function createEmptyMatrix() {
        return [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
      }

      // Phase 1: Fixation
      function showFixation() {
        display_element.innerHTML = `
          <div class="md-fixation" style="display: flex; justify-content: center; align-items: center; height: 100vh; font-size: 48px; color: white; font-family: Arial, sans-serif;">
            +
          </div>
        `;
        
        setTimeout(() => {
          showSequence();
        }, trial.fixation_duration);
      }

      // Phase 2: Sequential presentation
      function showSequence() {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        
        display_element.innerHTML = '';
        display_element.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        const center_x = canvas.width / 2 - 200;
        const center_y = canvas.height / 2 - 150;
        
        let step = 0;
        
        function showNextStep() {
          if (step >= trial.display_order.length) {
            // 🔧 CRITICAL FIX: Removed 500ms gap - go directly to choice
            showChoice();
            return;
          }
          
          const current_matrix = createEmptyMatrix();
          
          if (trial.condition === 'easy') {
            const [row, col] = indexToRowCol(trial.display_order[step]);
            current_matrix[row][col] = 1;
          } else {
            const pair = trial.display_order[step];
            if (Array.isArray(pair)) {
              for (const index of pair) {
                const [row, col] = indexToRowCol(index);
                current_matrix[row][col] = 1;
              }
            } else {
              const [row, col] = indexToRowCol(pair);
              current_matrix[row][col] = 1;
            }
          }
          
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawGrid(canvas, ctx, current_matrix, center_x, center_y);
          
          step++;
          setTimeout(showNextStep, trial.presentation_duration);
        }
        
        showNextStep();
      }

      // Phase 3: Two-alternative forced choice
      function showChoice() {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 400;
        canvas.style.display = 'block';
        canvas.style.margin = '20px auto';
        
        display_element.innerHTML = '';
        display_element.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        
        const screen_center = canvas.width / 2;
        const left_x = screen_center / 2 - 200;
        const right_x = (screen_center * 3) / 2 - 200;
        const y_pos = 50;
        
        let correct_grid, fake_grid;
        
        if (correct_side === 'left') {
          correct_grid = { shape: trial.shape, x: left_x };
          fake_grid = { shape: trial.fake_shape, x: right_x };
        } else {
          fake_grid = { shape: trial.fake_shape, x: left_x };
          correct_grid = { shape: trial.shape, x: right_x };
        }
        
        drawGrid(canvas, ctx, correct_grid.shape, correct_grid.x, y_pos);
        drawGrid(canvas, ctx, fake_grid.shape, fake_grid.x, y_pos);
        
        // 🔧 FIXED: Calculate response window WITHOUT extra 500ms gap
        const sequence_time = trial.fixation_duration + 
                            (trial.display_order.length * trial.presentation_duration);
        
        // Response window = trial_length - (time_used_so_far + feedback_duration)
        const time_elapsed = performance.now() - trial_start_time;
        const time_remaining = trial.trial_length - time_elapsed - trial.feedback_duration;
        
        const choice_start_time = performance.now();
        let response_received = false;
        
        console.log(`Response window: ${time_remaining.toFixed(0)}ms (elapsed: ${time_elapsed.toFixed(0)}ms)`);
        
        // 🔧 FIXED: Handle both scanner buttons (g/b) and number keys (1/2)
        function handleResponse(event) {
          if (response_received) return;
          
          if (trial.response_keys.includes(event.key)) {
            response_received = true;
            document.removeEventListener('keydown', handleResponse);
            clearTimeout(timeout_id);
            
            const response_time = performance.now() - choice_start_time;
            const chosen_key = event.key;
            
            // Map key to side
            let chosen_side;
            if (LEFT_KEYS.includes(chosen_key)) {
              chosen_side = 'left';
            } else if (RIGHT_KEYS.includes(chosen_key)) {
              chosen_side = 'right';
            }
            
            const accuracy = chosen_side === correct_side ? 1 : 0;
            
            response_data.accuracy = accuracy;
            response_data.response_time = response_time;
            response_data.response_key = chosen_key;
            response_data.chosen_side = chosen_side;
            
            showFeedback(accuracy);
          }
        }
        
        function handleTimeout() {
          if (!response_received) {
            response_received = true;
            document.removeEventListener('keydown', handleResponse);
            
            response_data.accuracy = -1;
            response_data.response_time = null;
            response_data.response_key = null;
            response_data.chosen_side = null;
            
            showFeedback(-1);
          }
        }
        
        document.addEventListener('keydown', handleResponse);
        
        // Use calculated time_remaining for timeout
        const timeout_id = setTimeout(handleTimeout, time_remaining);
      }

      // Phase 4: Feedback
      function showFeedback(accuracy) {
        let feedback_symbol, feedback_color;
        
        if (accuracy === 1) {
          feedback_symbol = String.fromCharCode(10004);
          feedback_color = 'rgb(0, 128, 0)';
        } else if (accuracy === 0) {
          feedback_symbol = String.fromCharCode(10008);
          feedback_color = 'rgb(128, 0, 0)';
        } else {
          feedback_symbol = String.fromCharCode(9473);
          feedback_color = 'rgb(64, 0, 0)';
        }
        
        display_element.innerHTML = `
          <div style="display: flex; justify-content: center; align-items: center; height: 100vh;">
            <div style="font-size: 120px; color: ${feedback_color}; font-weight: bold;">
              ${feedback_symbol}
            </div>
          </div>
        `;
        
        setTimeout(() => {
          waitForDeadline();
        }, trial.feedback_duration);
      }

      // 🔧 NEW: Wait until trial deadline before ending (enforces exact 8000ms)
      function waitForDeadline() {
        const current_time = performance.now();
        const time_remaining = trial_deadline - current_time;
        
        if (time_remaining > 10) {  // If more than 10ms remaining, show blank/fixation
          display_element.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-size: 48px; color: white; font-family: Arial, sans-serif;">
              +
            </div>
          `;
          
          console.log(`Waiting ${time_remaining.toFixed(0)}ms until trial deadline`);
          
          setTimeout(() => {
            endTrial();
          }, time_remaining);
        } else {
          // Close enough to deadline, end now
          endTrial();
        }
      }

      // End trial and save data
      function endTrial() {
        const end_time = performance.now();
        response_data.total_trial_time = end_time - trial_start_time;
        response_data.trial_deadline_met = Math.abs(end_time - trial_deadline) < 50; // Within 50ms
        
        display_element.innerHTML = '';
        self.jsPsych.finishTrial(response_data);
        
        console.log(`Trial ended at ${(end_time - trial_start_time).toFixed(0)}ms (target: ${trial.trial_length}ms)`);
      }

      // Start the trial
      showFixation();
      
      if (on_load) {
        on_load();
      }
    }

    simulate(trial, simulation_mode, simulation_options, load_callback) {
      if (simulation_mode == "data-only") {
        load_callback();
        this.simulate_data_only(trial, simulation_options);
      }
      if (simulation_mode == "visual") {
        this.simulate_visual(trial, simulation_options, load_callback);
      }
    }

    create_simulation_data(trial, simulation_options) {
      const default_data = {
        accuracy: Math.random() > 0.3 ? 1 : 0,
        response_time: this.jsPsych.randomization.sampleExGaussian(2000, 400, 1/1000, true),
        response_key: Math.random() > 0.5 ? 'g' : 'b',
        correct_side: Math.random() > 0.5 ? 'left' : 'right',
        trial_number: trial.trial_number,
        block_number: trial.block_number,
        condition: trial.condition
      };

      const data = this.jsPsych.pluginAPI.mergeSimulationData(default_data, simulation_options);
      return data;
    }

    simulate_data_only(trial, simulation_options) {
      const data = this.create_simulation_data(trial, simulation_options);
      this.jsPsych.finishTrial(data);
    }

    simulate_visual(trial, simulation_options, load_callback) {
      const data = this.create_simulation_data(trial, simulation_options);
      const display_element = this.jsPsych.getDisplayElement();
      
      this.trial(display_element, trial, load_callback);
      
      const total_sequence_time = trial.fixation_duration + 
                                 (trial.display_order.length * trial.presentation_duration) + 
                                 1000;
      
      setTimeout(() => {
        const response_key = data.response_key;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: response_key }));
      }, total_sequence_time);
    }
  }
  
  MDLocalizerPlugin.info = info;
  return MDLocalizerPlugin;
})(jsPsychModule);
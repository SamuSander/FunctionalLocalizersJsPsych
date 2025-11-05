# Functional Localizers (jsPsych): Speeded Language Localizer & MD Network Localizer

Browser-based (jsPsych) implementations of two widely used fMRI localizers:

* **Speeded Language Localizer (reading-based)** – a ~3.5‑minute task that robustly identifies the language network (Sentences > Nonwords), adapted from materials by Tuckute, Scott, Sathe, and Fedorenko.
* **Multiple-Demand (MD) Network Localizer** – a spatial working‑memory task with easy vs. hard conditions that identifies the domain‑general MD system.

This repository includes runnable HTML files, JavaScript code, and short demo videos for each task.

---

## Repository structure

```
FunctionalLocalizersJsPsych/
├── MDLoc_JSPSYCH/
│   ├── MDLoc.html                # Launch this for the MD localizer
│   ├── md_localizer.js           # MD task logic (jsPsych plugin-based)
│   ├── custom.css
│   ├── images/
│   └── jspsych/                  # jsPsych core + plugins (incl. custom MD plugin)
│
├── SpeededLangLoc_JSPSYCH/
│   ├── speeded_langloc.html      # Launch this for the language localizer
│   ├── speeded_langloc.js        # Language task logic
│   ├── custom.css
│   ├── images/                   # includes button prompt image
│   ├── jspsych/                  # jsPsych core + plugins
│   └── stim_english/             # Run × Set stimulus JS files
│       ├── speeded_langloc_stimuli_run1_set1.js
│       └── ... (run1/2 × set1–5)
│
├── videos/
│   ├── MDNLocalizer.mp4
│   └── SpeededLanguageLocalizer.mp4
│
└── README.md
```

---

## Quick start (no server required)

1. **Open the task**

   * MD localizer: double‑click `MDLoc_JSPSYCH/MDLoc.html`
   * Speeded language localizer: double‑click `SpeededLangLoc_JSPSYCH/speeded_langloc.html`

2. **Enter participant info** in the small form (ID, run/set where applicable).

3. **Controls & keys**

   * **Scanner trigger (simulated):** press **`t`** (collects initial triggers before the first block).
   * **Responses:** **`g`** (left) or **`b`** (right).
   * **Instruction pages:** forward = **`b`**, back = **`g`**.
   * Keys can be remapped in the JS files via the `KEY_*` constants.

4. **Browser**

   * Works in recent Chrome/Firefox. If your browser blocks local file access for media, run a tiny local server (e.g., `python -m http.server`) from the repo root and open the HTML files via `http://localhost:8000/...`.

---

## Task overviews

### 1) Speeded Language Localizer (reading‑based)

* **Design:** 48 trials (16 blocks × 3 trials).
* **Per trial (3,000 ms total):**
  `100 ms` blank → `12 × 200 ms` words/nonwords → `400 ms` button‑prompt image → `100 ms` blank.
* **Fixation:** 14 s after trials 12, 24, 36, and 48.
* **Total runtime:** ~214 s (~3:34).
* **Conditions:** **Sentences (S)** vs **Nonwords (N)** (**S > N** contrast).
* **What you’ll see:** rapid sequences of words or pronounceable nonwords, followed by a brief button‑press prompt.

> **Attribution:** Adapted from the MATLAB/PTB localizer by Tuckute, Scott, Sathe, and Fedorenko (see references). Original MATLAB repo linked below.

### 2) Multiple‑Demand (MD) Network Localizer (spatial working memory)

* **Design:** 48 trials total (12 task blocks × 4 trials), interleaved with fixation blocks.
* **Per trial (~8 s):** fixation (500 ms) → sequence presentation (easy: single squares; hard: pairs) → 2‑alternative choice → brief feedback (250 ms).
* **Fixation between blocks:** 16 s.
* **Total runtime:** ~15–20 minutes.
* **Conditions:** **Easy (4 squares)** vs **Hard (8 squares)**; the **Hard > Easy** contrast identifies MD regions.
* **What you’ll see:** blue squares appearing within a 3×4 grid (singletons for easy; pairs for hard), then a 2‑choice probe display.

> **Attribution:** Parameters mirror commonly used MD localizer variants in the Fedorenko lab and related work (see references).

---

## Demo videos

**MD Network Localizer**
- [▶ MD Network Localizer (MP4)](videos/MDNLocalizer.mp4?raw=1)

**Speeded Language Localizer**

- [▶ Speeded Language Localizer (MP4)](videos/SpeededLanguageLocalizer.mp4)

---

## Running in the scanner

* **Trigger handling:** tasks wait for **`t`** to simulate scanner triggers; by default, the code collects an initial set (e.g., 5) before beginning the first block.
* **Response keys:** designed for button boxes mapping to **`g`** and **`b`** (adjust in `KEY_*`).
* **Timing:** all durations/structure are defined in constants at the top of each `*.js` file and match commonly used MATLAB implementations.

---

## Customization

* **Change keys/timing:** edit the constants at the top of `md_localizer.js` or `speeded_langloc.js` (e.g., `KEY_*`, durations, number of triggers to collect).
* **Language stimuli:** select run/set at task start; stimulus JS files live under `SpeededLangLoc_JSPSYCH/stim_english/`.

---

## Origin & acknowledgments

### Origin of the MATLAB speeded language localizer

* Source repository: **el849/speeded_language_localizer** (MATLAB/PTB scripts + analysis).
  [https://github.com/el849/speeded_language_localizer](https://github.com/el849/speeded_language_localizer)

### Credits

* **jsPsych** for the experiment framework and plugins: [https://www.jspsych.org/](https://www.jspsych.org/)
* **Original MATLAB speeded localizer** by Greta Tuckute, Terri Scott, Aalok Sathe, Evelina Fedorenko, and collaborators.
* **This repo:** JavaScript/jsPsych ports + small UX helpers for scanner workflows.

> If you use these tasks, please cite the relevant papers and acknowledge the original authors.

---

## References

### Language localizer (reading‑based)

* Tuckute, G., Scott, T. L., Sathe, A., & Fedorenko, E. (2024). *A 3.5‑minute‑long reading‑based fMRI localizer for the language network.* bioRxiv. [https://doi.org/10.1101/2024.07.02.601683](https://doi.org/10.1101/2024.07.02.601683)
* Fedorenko, E., Behr, M. K., & Kanwisher, N. (2011). *Functional specificity for high‑level linguistic processing in the human brain.* **PNAS**, 108(39), 16428–16433. [https://doi.org/10.1073/pnas.1112937108](https://doi.org/10.1073/pnas.1112937108)
* Fedorenko, E., Hsieh, P.‑J., Nieto‑Castañón, A., Whitfield‑Gabrieli, S., & Kanwisher, N. (2010). *New method for fMRI investigations of language.* **Journal of Neurophysiology**, 104(2), 1177–1194. [https://doi.org/10.1152/jn.00032.2010](https://doi.org/10.1152/jn.00032.2010)

### Multiple‑Demand (MD) system / MD localizer

* Fedorenko, E., Duncan, J., & Kanwisher, N. (2013). *Broad domain generality in focal regions of frontal and parietal cortex.* **PNAS**, 110(41), 16616–16621. [https://doi.org/10.1073/pnas.1315235110](https://doi.org/10.1073/pnas.1315235110)
* Blank, I., Kanwisher, N., & Fedorenko, E. (2014). *A functional dissociation between language and multiple‑demand systems.* **Journal of Neurophysiology**, 112(5), 1105–1118. [https://doi.org/10.1152/jn.00884.2013](https://doi.org/10.1152/jn.00884.2013)
* Mineroff, Z., Blank, I. A., Mahowald, K., & Fedorenko, E. (2018). *A robust dissociation among the language, multiple demand, and default mode networks.* **Cognition**, 177, 206–225. [https://doi.org/10.1016/j.cognition.2018.04.021](https://doi.org/10.1016/j.cognition.2018.04.021)
* Assem, M., Glasser, M. F., Van Essen, D. C., & Duncan, J. (2020). *Activity in the fronto‑parietal multiple‑demand network…* **Cortex**, 131, 1–16. [https://doi.org/10.1016/j.cortex.2020.06.013](https://doi.org/10.1016/j.cortex.2020.06.013)
* (See also: Diachek et al., 2020; Shashidhara et al., 2024; Wang et al., 2021 for converging evidence.)

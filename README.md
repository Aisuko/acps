<h1 align="center"><b>Debiasing Large Language Models via Adaptive Causal Prompting with Sketch-of-Thought (ACPS)</b></h1>

<p align="center">
  <img src="img/causality_digram.png" alt="Causality diagram" style="max-width: 100%; height: auto;">
</p>

## Paper
- Title: **Debiasing Large Language Models via Adaptive Causal Prompting with Sketch-of-Thought**
- Authors: Bowen Li, Ziqi Xu, Jing Ren, Renqiang Luo, Xikun Zhang, Xiuzhen Zhang, Yongli Ren, Feng Xia
- Venue: EACL 2026 Findings (Conference)
- Published: 04 Jan 2026 (last modified: 04 Jan 2026)
- Keywords: Large Language Models, Reasoning, Prompting, Causality
- Paper: https://openreview.net/forum?id=SdTSZ5GfV0

## TL;DR
ACPS is an adaptive causal prompting framework that combines Sketch-of-Thought with front-door adjustment to enable robust, efficient reasoning across tasks.

## Abstract
Despite notable advancements in prompting methods for Large Language Models (LLMs), such as Chain-of-Thought (CoT), existing strategies still suffer from excessive token usage and limited generalisability across diverse reasoning tasks. To address these limitations, we propose an Adaptive Causal Prompting with Sketch-of-Thought (ACPS) framework, which leverages structural causal models to infer the causal effect of a query on its answer and adaptively select an appropriate intervention (i.e., standard front-door and conditional front-door adjustments). This design enables generalisable causal reasoning across heterogeneous tasks without task-specific retraining. By replacing verbose CoT with concise Sketch-of-Thought, ACPS enables efficient reasoning that significantly reduces token usage and inference cost. Extensive experiments on multiple reasoning benchmarks and LLMs demonstrate that ACPS consistently outperforms existing prompting baselines in terms of accuracy, robustness, and computational efficiency.

## Timeline
- 2026-01-04 — Paper released and code aligned with camera-ready version.
- 2026 — Presented in the EACL 2026 Findings track.
- 2026 — Project page and demo video (placeholder on GitHub Pages) for reproducibility.

## Project Page
- A static site for GitHub Pages lives in `docs/` using the Tailwind theme from prior projects. Point GitHub Pages to the `docs/` folder to publish.
- The demo video uses a placeholder iframe (`VIDEO_ID`) in `docs/index.html`; replace it with the recorded walkthrough when ready.

## Repository Structure
- `acps/`: Main experiments, ablations, and hyperparameter tuning notebooks (per-task notebooks).
- `acps.ipynb`: End-to-end ACPS framework notebook.
- `helpers/`: SoT construction utilities, encoder training, prompts, and metrics helpers.
- `sots_datasets/`: Scripts/notebooks to build Sketch-of-Thought datasets for each benchmark.
- `efficiency_comparison/`: Efficiency comparison experiments and analysis.
- `robustness_study/`: Robustness variants (shuffled/injected datasets) and evaluation notebooks.
- `img/`: Figures used in documentation.
- `requirements.txt`: Full dependency lock (matches Kaggle Python 3.11.13 environment).
- `CITATION.cff`: Citation metadata.

## Environment & Usage
- Developed and verified in a Kaggle `Python 3.11.13` container. The `requirements.txt` is intentionally comprehensive and heavy; installing locally may require a GPU-enabled environment and significant disk space.
- Recommended path:
  1) Open a Kaggle notebook with GPU, set Python 3.11.13, and `pip install -r requirements.txt` (or cherry-pick the minimal subset needed for the target notebook).
  2) Run the per-task notebooks in `acps/` or `acps.ipynb`. Notebook cells contain data loading, SoT construction, routing, and evaluation steps.
  3) For dataset preparation, use the matching notebook in `sots_datasets/`; for robustness or efficiency analyses, use the notebooks under `robustness_study/` and `efficiency_comparison/`.
- Outputs are notebook-driven; no standalone Python package is provided yet.

## Citation
Please use the `CITATION.cff` file in this repository for citation formatting.

## License
[MIT](./LICENSE)

## Acknowledgements
- Sketch-of-Thought prompting and related prior work that inspired this implementation.

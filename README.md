<h1 align="center"><b>Adaptive Causal Prompting with Sketch-of-Thought (ACPS)</b></h1>

<p align="center">
  <img src="img/causality_digram.png" alt="Causality diagram" style="max-width: 100%; height: auto;">
</p>

---

- Paper: **Debiasing Large Language Models via Adaptive Causal Prompting with Sketch-of-Thought** (OpenReview: https://openreview.net/forum?id=SdTSZ5GfV0)
- Authors: [Bowen Li](https://scholar.google.com/citations?user=D3-py-8AAAAJ&hl=en&authuser=1), [Ziqi Xu](https://scholar.google.com/citations?user=znODztEAAAAJ&hl=en&authuser=1&oi=ao), [Jing Ren](https://scholar.google.com/citations?hl=en&authuser=1&user=fUjL_jYAAAAJ), [Renqiang Luo](https://scholar.google.com/citations?hl=en&user=yx6HsssAAAAJ), Xikun Zhang, [Xiuzhen Zhang](https://scholar.google.com/citations?user=kuyecEEAAAAJ&hl=en&authuser=1), [Yongli Ren](https://scholar.google.com/citations?user=ZZl7bW8AAAAJ&hl=en), [Feng Xia](https://scholar.google.com/citations?hl=en&authuser=1&user=HDFA2VYAAAAJ)
- Venue: **EACL 2026 Findings** · Published: **04 Jan 2026** · Last modified: **04 Jan 2026**
- Keywords: Large Language Models, Reasoning, Prompting, Causality
- Licenses: MIT (code) · CC BY 4.0 (paper)

## TL;DR
ACPS adaptively routes between standard and conditional front-door adjustments and uses concise Sketch-of-Thought mediators to deliver robust, token-efficient reasoning across diverse tasks.

## Diasing Lens Video
- Placeholder: Embed the Diasing Lens video here once the recording is ready (e.g., replace `VIDEO_ID` in the block below).
- Example placeholder (replace `VIDEO_ID`): `https://youtu.be/VIDEO_ID`

## Repository Map
- `acps/` — Task-specific ACPS notebooks (CommonsenseQA, FEVER, HotpotQA, GSM8K, Math, StrategyQA, MusiQue).
- `acps.ipynb` — End-to-end ACPS pipeline (routing, mediator construction, evaluation).
- `helpers/` — Sketch-of-Thought utilities, encoder fine-tuning, prompt templates, metrics collection.
- `sots_datasets/` — Builders for Sketch-of-Thought datasets per benchmark.
- `efficiency_comparison/` — Efficiency experiments and analysis.
- `robustness_study/` — Robustness evaluations on shuffled and injected datasets.
- `img/` — Figures for documentation and the project page.
- `requirements.txt` — Full dependency list (matches Kaggle Python 3.11.13 environment).
- `CITATION.cff` — Citation metadata.

## Environment & Usage
- Verified in a Kaggle `Python 3.11.13` GPU container. The dependency list is heavy; trim it if you only need specific notebooks.
- Quickstart:
  1. Open a Kaggle notebook (GPU recommended) and set Python 3.11.13.
  2. Install dependencies: `pip install -r requirements.txt` (or install selectively for the target notebook).
  3. Run `acps.ipynb` for the full pipeline, or a task notebook under `acps/` for a specific benchmark.
  4. Use `sots_datasets/` notebooks to regenerate Sketch-of-Thought mediators; use `robustness_study/` and `efficiency_comparison/` for robustness and efficiency analyses.
- Outputs are notebook-driven; no standalone Python package is provided yet.

## Citation
Use `CITATION.cff` or the BibTeX below.

```bibtex
@inproceedings{li2026acps,
  title     = {Debiasing Large Language Models via Adaptive Causal Prompting with Sketch-of-Thought},
  author    = {Bowen Li and Ziqi Xu and Jing Ren and Renqiang Luo and Xikun Zhang and Xiuzhen Zhang and Yongli Ren and Feng Xia},
  booktitle = {Findings of the Association for Computational Linguistics: EACL 2026},
  year      = {2026},
  month     = {January},
  note      = {OpenReview id: SdTSZ5GfV0}
}
```

## License
MIT License for code; paper content under CC BY 4.0.

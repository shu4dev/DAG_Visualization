#!/usr/bin/env python3
"""
arXiv + KeyBERT → 3D Layered DAG data extractor

Fetches papers from arXiv by category, groups them into monthly time
slices, extracts keywords using KeyBERT (transformer attention), and
outputs a JSON file compatible with the visualization tool's
parseAnyGraphInput / parseRawWordFrequencyData.

Usage:
    pip install arxiv keybert torch
    python scripts/fetch_arxiv.py
    python scripts/fetch_arxiv.py --category cs.CL --months 6 --top 30
    python scripts/fetch_arxiv.py --help

Output format (upload directly into the tool):
    {
      "timeSlices": [
        {
          "label": "2025-01",
          "words": [
            { "word": "transformer", "frequency": 142 },
            ...
          ]
        },
        ...
      ]
    }
"""

import argparse
import json
import time
from datetime import datetime, timedelta
from collections import defaultdict

import arxiv
from keybert import KeyBERT


def get_month_ranges(n_months: int):
    """Generate a list of (year, month) tuples for the last n_months,
    offset by 2 months to account for arXiv indexing lag."""
    ranges = []
    now = datetime.now()
    # Start from 2 months ago
    anchor = datetime(now.year, now.month, 1) - timedelta(days=60)

    for i in range(n_months):
        # Go backwards from anchor
        offset = n_months - 1 - i
        d = datetime(anchor.year, anchor.month, 1)
        # Subtract offset months
        year = d.year
        month = d.month - offset
        while month <= 0:
            month += 12
            year -= 1
        ranges.append((year, month))

    return ranges


def fetch_papers_for_month(category: str, year: int, month: int,
                           max_results: int) -> list[str]:
    """Fetch abstracts from arXiv for a given category and month."""
    # Build date range string for arXiv query
    start_date = f"{year}{month:02d}01"
    # Last day of month
    if month == 12:
        end_year, end_month = year + 1, 1
    else:
        end_year, end_month = year, month + 1
    end_date_obj = datetime(end_year, end_month, 1) - timedelta(days=1)
    end_date = end_date_obj.strftime("%Y%m%d")

    query = f"cat:{category} AND submittedDate:[{start_date}0000 TO {end_date}2359]"

    client = arxiv.Client(
        page_size=100,
        delay_seconds=3.0,  # respect rate limits
        num_retries=3,
    )

    search = arxiv.Search(
        query=query,
        max_results=max_results,
        sort_by=arxiv.SortCriterion.SubmittedDate,
        sort_order=arxiv.SortOrder.Descending,
    )

    abstracts = []
    for result in client.results(search):
        if result.summary:
            abstracts.append(result.summary.strip())

    return abstracts


def extract_keywords_keybert(
    kw_model: KeyBERT,
    texts: list[str],
    top_n: int,
) -> list[dict]:
    """Use KeyBERT to extract keywords from a combined corpus.

    Returns a list of {word, frequency} dicts where frequency is
    the KeyBERT relevance score scaled to an integer (0-100 range)
    for compatibility with the visualization tool's weight system.
    """
    if not texts:
        return []

    # Combine all abstracts into one document for this time slice.
    # KeyBERT works best on a single document for corpus-level keywords.
    corpus = " ".join(texts)

    # Extract keywords with 1-2 word phrases
    keywords = kw_model.extract_keywords(
        corpus,
        keyphrase_ngram_range=(1, 2),
        stop_words="english",
        top_n=top_n,
        use_mmr=True,         # Maximal Marginal Relevance for diversity
        diversity=0.5,        # balance between relevance and diversity
    )

    # keywords is a list of (phrase, score) tuples
    # Scale scores: KeyBERT scores are 0.0–1.0 cosine similarities.
    # Map to integer frequencies that make sense as node weights.
    # We scale so the top keyword → ~100, preserving relative differences.
    if not keywords:
        return []

    max_score = keywords[0][1] if keywords[0][1] > 0 else 1.0

    results = []
    for phrase, score in keywords:
        # Scale to 1–100 range based on relative score
        scaled = max(1, int(round((score / max_score) * 100)))
        results.append({"word": phrase, "frequency": scaled})

    return results


def main():
    parser = argparse.ArgumentParser(
        description="arXiv + KeyBERT data extractor for 3D Layered DAG Visualization"
    )
    parser.add_argument(
        "--category", default="cs.AI",
        help="arXiv category (default: cs.AI). Examples: cs.CL, cs.LG, cs.CV, stat.ML"
    )
    parser.add_argument(
        "--months", type=int, default=12,
        help="Number of monthly time slices / layers (default: 12)"
    )
    parser.add_argument(
        "--top", type=int, default=25,
        help="Top N keywords per time slice (default: 25)"
    )
    parser.add_argument(
        "--per-month", type=int, default=200,
        help="Max papers to fetch per month (default: 200)"
    )
    parser.add_argument(
        "--output", default="arxiv-data.json",
        help="Output JSON file path (default: arxiv-data.json)"
    )
    parser.add_argument(
        "--model", default="all-MiniLM-L6-v2",
        help="Sentence-transformer model for KeyBERT (default: all-MiniLM-L6-v2)"
    )
    args = parser.parse_args()

    print(f"\n📚 arXiv + KeyBERT Data Extractor")
    print(f"   Category:    {args.category}")
    print(f"   Months:      {args.months}")
    print(f"   Top words:   {args.top} per slice")
    print(f"   Per month:   up to {args.per_month} papers")
    print(f"   Model:       {args.model}")
    print(f"   Output:      {args.output}\n")

    # Load KeyBERT model once (takes a few seconds on first run)
    print(f"🔧 Loading KeyBERT model ({args.model})...")
    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"   Device: {device.upper()}")
    kw_model = KeyBERT(model=args.model)
    print(f"   Model loaded ✅\n")

    month_ranges = get_month_ranges(args.months)
    time_slices = []

    for year, month in month_ranges:
        label = f"{year}-{month:02d}"
        print(f"   Fetching {label} ...", end="", flush=True)

        try:
            abstracts = fetch_papers_for_month(
                args.category, year, month, args.per_month
            )
        except Exception as e:
            print(f" ❌ Fetch error: {e}")
            time_slices.append({"label": label, "words": []})
            continue

        print(f" {len(abstracts)} papers ...", end="", flush=True)

        # Extract keywords with KeyBERT
        words = extract_keywords_keybert(kw_model, abstracts, args.top)

        time_slices.append({"label": label, "words": words})
        print(f" ✅ {len(words)} keywords extracted")

    # Write output
    output = {"timeSlices": time_slices}
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    total_words = sum(len(ts["words"]) for ts in time_slices)
    print(f"\n✅ Wrote {args.output}")
    print(f"   {len(time_slices)} time slices, {total_words} total keyword entries")
    print(f"\n📌 To use: open the app → Upload JSON → select {args.output}\n")


if __name__ == "__main__":
    main()

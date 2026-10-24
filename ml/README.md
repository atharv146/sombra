# Teammate deliverables (exact formats)

Drop the files below into the repo, commit on your own branch (`teammate`), and push. The app reads them as-is.

## 1. `data/fields.json`: 3 real fields near Manteca
```json
[{ "id": "french-camp", "name": "French Camp tomatoes", "crop": "tomatoes", "lat": 37.88, "lon": -121.27, "shade": "none" }]
```
`shade` is `"none"`, `"partial"` or `"orchard"`. Get coordinates from Google Maps satellite view: right-click a field and copy the numbers.

## 2. `data/replay-2024-07.json`: one real heat-wave day
Pick the hottest July 2024 day for Manteca, then open this URL (swap in the date), save the page as the file:
```
https://archive-api.open-meteo.com/v1/archive?latitude=37.80&longitude=-121.22&start_date=2024-07-10&end_date=2024-07-10&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FLos_Angeles
```

## 3. `public/model/triage.json`: the classifier
Train in Colab: `TfidfVectorizer(analyzer="char_wb", ngram_range=(2,4), max_features=3000)` + `LogisticRegression(max_iter=1000)`, labels `ok`, `warning`, `heat_exhaustion`, `emergency`. Export:
```python
import json
json.dump({
  "model": "sombra-triage v1",
  "labels": list(clf.classes_),
  "vocab": {k: int(v) for k, v in vec.vocabulary_.items()},
  "idf": vec.idf_.tolist(),
  "coef": clf.coef_.tolist(),
  "intercept": clf.intercept_.tolist(),
  "metrics": {"accuracy": acc, "macro_f1": f1, "emergency_recall": rec, "confusion": cm.tolist(), "test_size": n}
}, open("triage.json", "w"))
```
Also commit the notebook as `ml/train.ipynb` and the data as `ml/train.csv` and `ml/test.csv` (columns `text,label,lang`).

**`test.csv` must be about 40 sentences you write yourself, not generated.** That's what makes the accuracy numbers believable to judges.

## 4. `docs/facts.md`
Every number we say out loud, each with its source link:
- the Cal/OSHA §3395 thresholds
- §5141.1 smoke thresholds
- Labor Code 226.2 paid rest
- the farmworker heat-death rate

# Sombra triage model: paste this whole file into ONE Google Colab cell and press Run.
# Before running, upload train.csv and test.csv with the folder icon on Colab's left sidebar.
# Columns in both files: text,label,lang
#   label is one of: ok, warning, heat_exhaustion, emergency
#   lang is one of: es, pa, en
# Outputs: triage.json (upload to public/model/ in the repo) and confusion.png (for the model card).

import json

import matplotlib.pyplot as plt
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (ConfusionMatrixDisplay, accuracy_score, classification_report,
                             confusion_matrix, f1_score, recall_score)

LABELS = ["ok", "warning", "heat_exhaustion", "emergency"]

train = pd.read_csv("train.csv").dropna()
test = pd.read_csv("test.csv").dropna()
for name, df in [("train", train), ("test", test)]:
    bad = df[~df.label.isin(LABELS)]
    if len(bad):
        raise ValueError(f"{name}.csv has unknown labels: {sorted(bad.label.unique())}")
    print(f"{name}: {len(df)} rows", df.label.value_counts().to_dict())

# Character n-grams work across Spanish, Punjabi (Gurmukhi) and English without a tokenizer per language.
vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), max_features=3000, lowercase=True)
X_train = vec.fit_transform(train.text)
X_test = vec.transform(test.text)

clf = LogisticRegression(max_iter=2000, class_weight="balanced")
clf.fit(X_train, train.label)

pred = clf.predict(X_test)
acc = accuracy_score(test.label, pred)
f1 = f1_score(test.label, pred, average="macro")
emergency_recall = recall_score(test.label, pred, labels=["emergency"], average="macro", zero_division=0)
cm = confusion_matrix(test.label, pred, labels=LABELS)

print(classification_report(test.label, pred, labels=LABELS, zero_division=0))
print(f"accuracy {acc:.2f} | macro F1 {f1:.2f} | emergency recall {emergency_recall:.2f}")
for lang in sorted(test.lang.unique()):
    m = test.lang == lang
    print(f"  {lang}: accuracy {accuracy_score(test.label[m], pred[m]):.2f} on {m.sum()} sentences")

# Show every mistake so we can talk about limits honestly.
wrong = test[pred != test.label].assign(predicted=pred[pred != test.label])
print("\nMistakes:\n", wrong[["text", "label", "predicted"]].to_string(index=False))

ConfusionMatrixDisplay(cm, display_labels=LABELS).plot(cmap="Oranges", xticks_rotation=30)
plt.title("Sombra triage v1 (hand-written test set)")
plt.tight_layout()
plt.savefig("confusion.png", dpi=160)

# Export for the app. Rows of coef follow `labels` order.
model = {
    "model": "sombra-triage v1",
    "config": {"analyzer": "char_wb", "ngram_range": [2, 4], "lowercase": True, "norm": "l2"},
    "labels": [str(c) for c in clf.classes_],
    "vocab": {k: int(v) for k, v in vec.vocabulary_.items()},
    "idf": [float(x) for x in vec.idf_],
    "coef": [[round(float(x), 5) for x in row] for row in clf.coef_],
    "intercept": [float(x) for x in clf.intercept_],
    "metrics": {
        "accuracy": round(acc, 3),
        "macro_f1": round(f1, 3),
        "emergency_recall": round(emergency_recall, 3),
        "confusion": cm.tolist(),
        "confusion_labels": LABELS,
        "train_size": len(train),
        "test_size": len(test),
    },
}
with open("triage.json", "w") as f:
    json.dump(model, f, ensure_ascii=False)
print("\nSaved triage.json and confusion.png. Download both from the folder icon on the left.")

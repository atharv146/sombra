# Darshan's guide: train Sombra's AI model (no Claude Code needed)

You need: a browser, **gemini.google.com** (free chat), **Google Colab** (colab.research.google.com, free), and your GitHub account.
You never need a terminal or git. Everything uploads through the GitHub website.

**What you're building:** a small model that reads what a farmworker says ("me duele la cabeza", "I feel dizzy") and decides one of 4 labels:

| Label | Means | Example |
|---|---|---|
| `ok` | Feeling fine | "Estoy bien, solo tengo calor" |
| `warning` | Early signs: cramps, heavy sweating, very thirsty, tired | "Tengo calambres en las piernas" |
| `heat_exhaustion` | Dizzy, headache, nausea, weak, pale | "Me siento mareado y con náuseas" |
| `emergency` | Confused, fainted, stopped sweating, hot dry skin, can't talk straight | "Mi compañero se desmayó" |

**One sentence for judges (memorize it):** "Our model learns to spot heat illness from a worker's own words in Spanish, Punjabi or English, so the crew boss knows who needs help first."

---

## Step 1 (about 30 min): make the training data with Gemini

Open gemini.google.com and paste this prompt:

```
Make a CSV for training a heat-illness triage classifier for Central Valley farmworkers.
Columns: text,label,lang
label is exactly one of: ok, warning, heat_exhaustion, emergency
lang is exactly one of: es, pa, en
Use CDC/NIOSH heat illness symptoms:
- warning: heat cramps, heavy sweating, very thirsty, tired, heat rash
- heat_exhaustion: dizzy, headache, nausea or vomiting, weak, pale/clammy skin, fast pulse
- emergency: confusion, fainting, slurred speech, seizure, hot dry skin, stopped sweating, very high body temperature
- ok: feeling fine, normal tiredness, just hot, asking about breaks or water
Write 100 rows per label (400 total). Mix: 50% Spanish (casual Mexican Spanish like workers really talk), 25% Punjabi in Gurmukhi script, 25% English. Include some Spanglish, typos, and sentences about a coworker ("mi compañero..."). Short sentences, 3 to 15 words.
Output only the CSV, no commentary. Put quotes around any text that contains a comma.
```

Gemini may stop partway. If it does, say **"continue, same format, no header"** and paste the new rows under the old ones.

Copy everything into a Google Sheet. Check that column A is `text`, B is `label` and C is `lang`. Delete any broken rows, then **File → Download → CSV** and name the file `train.csv`.

Skim about 30 rows. If a label looks wrong, fix it. Hand-checking like this is part of the work we tell judges about.

## Step 2 (about 20 min): write the test set yourself (important!)

Make a second sheet, `test.csv`, with the same 3 columns and **40 rows: 10 per label. Write them yourself; don't use Gemini.**

That's what makes our accuracy number honest: the model gets tested on sentences it has never seen, written by a real person.
- Write Spanish and English yourself.
- For Punjabi, ask a Punjabi-speaking friend or family member for 5 to 10 sentences. If you can't, skip Punjabi in the test set. We'll just say so.

## Step 3 (about 10 min): train in Colab

1. Open colab.research.google.com and click **New notebook**.
2. Click the **folder icon** on the left, then the upload button, and upload `train.csv` and `test.csv`.
3. Open [`ml/train_colab.py`](train_colab.py) on GitHub, click the copy button, paste it into the first cell, and press **Run** (the ▶ button).
4. It prints the accuracy and every mistake, and creates `triage.json` and `confusion.png`. Screenshot the printed numbers.
5. Download `triage.json` and `confusion.png` from the folder panel. Click the three dots next to each file, then Download.

**If you get an error,** paste the full error into Gemini (in Colab, the ✨ button next to the error) and ask "fix this". The usual cause is a broken row in a CSV.

**If emergency recall is under 0.9,** add 30 more emergency examples to `train.csv` and run it again. Never missing an emergency matters more than overall accuracy.

## Step 4 (about 5 min): upload to GitHub, no git needed

1. Go to github.com/atharv146/sombra.
2. Click **Add file → Upload files**.
3. Drag in all four files: `triage.json`, `confusion.png`, `train.csv`, `test.csv`.
4. At the bottom, choose **"Create a new branch"**, name it `darshan`, and click **Propose changes**. Don't merge it; Atharv does that.
5. Text Atharv: "model is up on the darshan branch, accuracy X, emergency recall Y".

Atharv moves the files into place: `public/model/triage.json`, `ml/train.csv`, `ml/test.csv` and `public/model/confusion.png`.

## Step 5: facts with sources (`docs/facts.md`)

Use Google and Gemini, and give a link for every fact. Judges may ask "where's that number from?".

- [ ] Cal/OSHA §3395: shade at 80°F, 1 quart of water per worker per hour, high-heat procedures at 95°F, and the 10-minute cool-down every 2 hours for agriculture. Check each number on dir.ca.gov.
- [ ] Cal/OSHA §5141.1: wildfire smoke rules at AQI 151 and 500.
- [ ] California Labor Code 226.2: piece-rate workers must be paid for rest and recovery breaks.
- [ ] The farmworker heat-death rate compared with other workers. Our draft says about 20 times higher (CDC MMWR 2008); find and check the source.
- [ ] One number about San Joaquin County farmworkers: how many, and how many speak Spanish or Punjabi.

Write it in a Google Doc first. Then on GitHub go to **Add file → Create new file**, name it `docs/facts.md`, paste the doc in, and commit to the `darshan` branch.

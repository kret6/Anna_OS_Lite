# ANNA OS Lite — AED trainer

A single-file-simple AED training simulator that runs **entirely in your browser, offline,
on old phones**. Open it once and it keeps working in airplane mode.

> **This is not a medical device.**
> It is a training simulator. It must not be used to guide the care of a real patient, it
> does not diagnose anything, and it will not teach you first aid. It is no substitute for
> training with a qualified instructor, or for the resuscitation guidelines that apply
> where you are.

It does not send anything anywhere — no account, no server, no analytics. Open your
browser's network tab and watch it stay empty.

## What this is, and what it is not

If you know how to help, you can practise here.
If you do not know, this will not teach you.
If you are learning, you can practise on it — alone, or with other people.

That is the whole promise. There is no course inside, no lessons, no quiz. It is a patient
that behaves like a patient, and an AED that behaves like an AED, so that the knowledge you
already have has somewhere to go.

## The manikin

Whatever you press on. A training manikin if you have one. A plastic bottle and some straw
if you do not. This is not a joke and it is not a substitute for a real one — it is simply
what a lot of practice has always been done on, including mine.

The phone lies next to the patient and plays the AED. Someone can hold it and run the
scenario for the others; one person alone can set it up and work through the cycle. Either
way the sequence is the same one you will follow when it is real: pads, stand clear,
analysis, shock or no shock, two minutes of compressions, analyse again.

It does not measure your compressions, and it will not pretend to. There is no sensor in a
bottle, and there is none in a phone lying beside you — an invented depth reading would be
worse than none. What it does give you is the rhythm to compress to, and every consequence
of stopping.

## What you can set

| control | what it does |
|---|---|
| Rhythm | shockable (VF) or not shockable (asystole) |
| Pads | good contact, or poor — the AED will keep saying *Check pads* |
| Someone touching the patient | invalidates the rhythm analysis, and delivers a shock to the rescuer |
| CPR in progress | tells the model whether compressions are running |
| Return of circulation | let the model decide, or never (the rhythm comes back) |

## The physiology is not a toy

The circulation model underneath is the **same engine** that runs the full system, compiled
from the same source. Lite is a narrower window onto it, not a simplified copy — so what you
learn here stays true if you ever meet the full version. Coronary perfusion builds with good
compressions and decays in every pause; that is why an early shock converts and a late one
often does not.

## Installing

Open the page, then use your browser's *Add to Home Screen*. After that it runs offline.
On iOS this lives under the Share menu; iOS may evict the storage if the app goes unused
for a long time, in which case open it once with a connection.

## Running it yourself

There is no build step. Serve the folder over HTTP (a service worker needs `http://localhost`
or HTTPS — `file://` will not do):

```
python -m http.server 8000
```

Then open `http://localhost:8000`.

## What is in here

- `index.html`, `app.js`, `sw.js` — the whole application, plain ES5, no dependencies
- `medicos-core.js` — the physiology engine, compiled from Kotlin Multiplatform
- `audio/` — AED voice lines (optional: without them the app shows the text instead)

The engine ships as a compiled bundle. The application around it is here in full, and it is
short enough to read in one sitting.

## Voice files

The AED speaks from **recordings**, not from browser speech synthesis — speech synthesis
depends on voice packs that an old phone offline simply may not have. Drop `audio/<id>.mp3`
files matching the keys in `LINES` (see `app.js`) and they play automatically. Missing files
are not an error: the line is shown on screen instead.

Two lines from the standard AED script are deliberately absent — *"Push harder"* and
*"Good compressions"*. A real AED says those from a depth sensor. This one has no sensor,
so saying them would teach that the device knows something it does not.

## Licence

**Apache License 2.0** — see `LICENSE` and `NOTICE`.

In plain words: use it, change it, translate it, put it on your own server, hand it out on
a memory stick, use it on a paid course. Keep the copyright notice. There is no warranty of
any kind.

Two things the licence does **not** cover:

- **The name and the logo.** Apache 2.0 grants no trademark rights (section 6). Take the
  software and run it under your own name — just don't present a modified version as ANNA OS.
- **The engine source.** `medicos-core.js` ships as a compiled bundle under the same licence.
  Its source is not part of this repository, and the licence does not oblige it to be.

## Feedback

If you use this, the author would like to know what works, what doesn't, and what is
missing. That is the only thing asked in return.

/* ANNA OS Lite — trenażer AED.
 *
 * Świadome ograniczenia, żeby to chodziło na ośmioletnim telefonie bez sieci:
 *   · składnia ES5 (var, function) — bez `?.`, `??`, bez klas, bez modułów.
 *     Stare Safari na iPhonie 6 kończy na iOS 12; optional chaining tam nie istnieje.
 *   · zero zależności, zero build-stepa, zero czcionek i skryptów z zewnątrz.
 *   · głos AED z NAGRAŃ, nie z syntezy mowy. Web Speech API zależy od pakietów
 *     głosowych systemu — na Huawei bez usług Google albo offline po prostu ich nie ma.
 *   · nie mierzymy uciśnięć. Telefon leży OBOK jako AED, nie na klatce; bez czujnika
 *     głębokość jest zmyśleniem, a zmyślona liczba w narzędziu szkoleniowym jest gorsza
 *     niż jej brak. Ocenia człowiek — tak jak na każdym kursie ze starym manekinem.
 */
(function () {
'use strict';

var CORE = (typeof com !== 'undefined') && com.medicosanna &&
           com.medicosanna.core && com.medicosanna.core.MedicOsCore;

var $ = function (id) { return document.getElementById(id); };

// ── Skrypt AED ───────────────────────────────────────────────────────────────
// Wprost z `AED_universal_script.txt`. Świadomie POMINIĘTE: „Push harder"
// i „Good compressions" — prawdziwy AED mówi je z czujnika głębokości, którego
// tu nie ma. Wypowiadanie ich na ślepo uczyłoby, że sprzęt to wie.
//
// Jedna kwestia DOŁOŻONA poza skrypt: `pads_check` („Check pads.") — bo źle
// przylegające elektrody są jednym z modyfikatorów, a bez tej kwestii AED nie ma
// jak o nich powiedzieć.
var LINES = {
  on_1:      'Stay calm.',
  on_2:      'Call for help.',
  on_3:      "Remove clothing from patient's chest.",
  on_4:      'Look at pictures on pads.',
  pads_1:    'Peel pads from yellow plastic.',
  pads_2:    'Apply pads to bare skin exactly as shown.',
  pads_3:    "Press pads firmly to patient's bare chest.",
  pads_check:'Check pads.',
  ana_1:     'Do not touch patient.',
  ana_2:     'Analyzing heart rhythm.',
  ana_3:     'Please stand clear.',
  ana_4:     'Analyzing...',
  sh_1:      'Shock advised.',
  sh_2:      'Charging.',
  sh_3:      'Stay clear of patient.',
  sh_4:      'Deliver shock now.',
  sh_5:      'Press the orange flashing button now.',
  sh_6:      'Shock delivered.',
  safe:      'It is now safe to touch the patient.',
  noshock:   'No shock advised.',
  cpr_1:     'Begin CPR.',
  cpr_2:     'Give thirty chest compressions.',
  cpr_3:     'Then give two breaths.',
  stop_1:    'Stop CPR.'
};

// ── Ustawienia instruktora ───────────────────────────────────────────────────
var cfg = { rhythm: 'shockable', pads: 'good', touch: 'off', cpr: 'off', rosc: 'engine' };

var running = false;      // AED włączony
var armed = false;        // przycisk wyładowania aktywny
var seq = [];             // kolejka kwestii do wypowiedzenia
var seqThen = null;       // co zrobic PO kolejce (faza nastepna) — patrz skip()
var seqTimer = null;
var cprLeft = 0;          // sekundy do końca cyklu RKO
var audioCtx = null;
var metroTimer = null;

// ── Głos: nagranie, a jak go nie ma — sam tekst ──────────────────────────────
// Aplikacja jest w pełni użyteczna BEZ plików audio (widać kwestię na ekranie),
// więc nagrania można dołożyć później, nie blokując wydania.
var players = {};
/** Odtwarza kwestie i zwraca element audio (albo null, gdy sie nie da). */
function say(id, small, onKoniec) {
  var el = $('say');
  el.textContent = LINES[id] || id;
  el.className = small ? 'small' : '';
  var p = players[id];
  if (!p) {
    p = new Audio('audio/' + id + '.mp3');
    p.preload = 'auto';
    players[id] = p;
  }
  p.onended = null; p.onerror = null;
  if (onKoniec) { p.onended = onKoniec; p.onerror = onKoniec; }
  try {
    p.currentTime = 0;
    var q = p.play();
    if (q && q['catch']) q['catch'](function () { if (onKoniec) onKoniec(); });
    return p;
  } catch (e) {
    if (onKoniec) onKoniec();
    return null;
  }
}

// ── Kolejka kwestii ──────────────────────────────────────────────────────────
// Kolejka idzie ZA DZWIEKIEM, nie za zegarem.
//
// Do 31.08 kazda kwestia dostawala stale 2200 ms. Po wygenerowaniu nagran okazalo sie,
// ze piec z nich jest dluzszych — najdluzsza „Apply pads to bare skin exactly as shown"
// trwa 3,02 s. Przy stalej przerwie nachodzilyby na siebie i AED mowilby sam przez siebie.
//
// Bez nagran (albo gdy przegladarka zablokuje odtwarzanie) wracamy do zegara, bo tekst
// na ekranie tez musi zdazyc byc przeczytany.
function speak(list, thenFn, gapMs) {
  clearTimeout(seqTimer);
  seq = list.slice();
  seqThen = thenFn || null;
  var fallback = gapMs || 2200;
  var oddech = 350;                     // pauza miedzy kwestiami, zeby nie kleily sie w jedno

  function step() {
    if (!seq.length) { var f = seqThen; seqThen = null; if (f) f(); return; }
    var poszlo = false;
    function dalej(opoznienie) {
      if (poszlo) return;
      poszlo = true;
      clearTimeout(seqTimer);
      seqTimer = setTimeout(step, opoznienie);
    }
    say(seq.shift(), false, function () { dalej(oddech); });
    // Bezpiecznik: gdyby zdarzenie konca nie przyszlo (zablokowane audio, zerwany plik),
    // kolejka i tak ruszy dalej. Nigdy nie wolno jej zawiesic — AED musi dojsc do analizy.
    seqTimer = setTimeout(function () { dalej(0); }, fallback + 6000);
  }
  step();
}
function skip() {                       // przycisk „Continue" — instruktor nie czeka
  if (!running) return;
  clearTimeout(seqTimer);
  if (!seq.length) {
    // Kolejka pusta, ale faza moze miec zaplanowana kontynuacje — nie gub jej.
    var f = seqThen; seqThen = null; if (f) f();
    return;
  }
  var reszta = seq.slice();
  var f2 = seqThen;
  seq = []; seqThen = null;
  speak(reszta, f2, 900);
}

// ── Metronom 110/min — z oscylatora, nie z pliku ─────────────────────────────
function ctx() {
  if (!audioCtx) {
    var C = window.AudioContext || window.webkitAudioContext;
    if (C) audioCtx = new C();
  }
  return audioCtx;
}
function beep(freq, ms) {
  var a = ctx(); if (!a) return;
  try {
    var o = a.createOscillator(), g = a.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(a.destination);
    g.gain.value = 0.16;
    o.start();
    o.stop(a.currentTime + ms / 1000);
  } catch (e) {}
}
function metronome(on) {
  clearInterval(metroTimer); metroTimer = null;
  $('metro').className = on ? 'on' : '';
  $('metro').textContent = on ? 'metronome 110 / min' : 'metronome off';
  if (on) metroTimer = setInterval(function () { beep(1100, 40); }, 60000 / 110);
}

// ── Silnik ───────────────────────────────────────────────────────────────────
// Ta sama fizjologia, która chodzi w pełnej wersji — skompilowana z tego samego
// źródła. Lite nie ma własnego modelu i mieć nie będzie.
function scenarioId() {
  return cfg.rhythm === 'shockable' ? 'NZK_VF' : 'NZK_ASYSTOLIA';
}
function loadScenario() {
  if (CORE) CORE.loadScenario(scenarioId());
  render();
}
function render() {
  if (!CORE) { $('state').textContent = 'core not loaded'; return; }
  var s = JSON.parse(CORE.stateJson());
  $('state').innerHTML =
    'rhythm <b>' + s.rhythm + '</b> &nbsp; HR <b>' + Math.round(s.hr) + '</b>' +
    ' &nbsp; SpO2 <b>' + Math.round(s.spo2) + '</b>' +
    ' &nbsp; BP <b>' + Math.round(s.bp) + '</b>' +
    '<br>CPR <b>' + (cfg.cpr === 'on' ? 'yes' : 'no') + '</b>' +
    ' &nbsp; hands on <b>' + (cfg.touch === 'on' ? 'yes' : 'no') + '</b>' +
    ' &nbsp; pads <b>' + cfg.pads + '</b>';
}
setInterval(function () {
  if (CORE) CORE.tick();
  if (cprLeft > 0) { cprLeft--; if (cprLeft === 0) cycleEnd(); }
  render();
}, 1000);

// ── Przebieg AED ─────────────────────────────────────────────────────────────
function lamp(kind) { $('lamp').className = kind || ''; }
function arm(on) {
  armed = on;
  $('shock').className = on ? 'armed' : '';
}

function powerOn() {
  running = true;
  loadScenario();
  lamp('');
  speak(['on_1', 'on_2', 'on_3', 'on_4', 'pads_1', 'pads_2', 'pads_3'], padsCheck);
}
function padsCheck() {
  if (cfg.pads === 'poor') {           // AED nie przejdzie dalej, dopóki elektrody źle leżą
    lamp('analyze');
    speak(['pads_check'], padsCheck, 3000);
    return;
  }
  analyse();
}
function analyse() {
  lamp('analyze');
  if (CORE) CORE.startAnalysis();
  speak(['ana_1', 'ana_2', 'ana_3', 'ana_4'], analyseDone);
}
function analyseDone() {
  // Ruch przy pacjencie unieważnia zapis — dokładnie ta sama bramka, co u Anny.
  var clean = CORE ? CORE.endAnalysis() : true;
  if (!clean) {
    // Ktos ruszal pacjenta w trakcie zapisu — decyzja niewazna, analiza od nowa.
    // To jest ta sama bramka, ktora pilnuje kursanta w pelnej wersji, i kosztuje
    // dokladnie to, co kosztuje naprawde: czas bez uciśnięć.
    $('say').textContent = 'Analysis interrupted — do not touch the patient';
    $('say').className = 'small';
    setTimeout(analyse, 2600);
    return;
  }

  if (cfg.rhythm === 'shockable') {
    lamp('shock');
    arm(true);
    speak(['sh_1', 'sh_2', 'sh_3', 'sh_4', 'sh_5'], null);
  } else {
    lamp('safe');
    speak(['noshock', 'safe'], cprPhase);
  }
}
function shockPressed() {
  if (!running || !armed) return;
  arm(false);
  beep(660, 320);                       // ton wyładowania

  var out = CORE ? JSON.parse(CORE.deliverShock()) : { converted: false, rescuerShocked: false };

  if (out.rescuerShocked) {
    // Zdarzenie bezpieczeństwa. W rzeczywistości ratownik dostaje prądem —
    // tutaj musi to zobaczyć, inaczej lekcja nie zachodzi.
    lamp('shock');
    $('say').textContent = 'RESCUER SHOCKED — someone was touching the patient';
    $('say').className = '';
    setTimeout(function () { speak(['sh_6', 'safe'], cprPhase); }, 2600);
    return;
  }
  if (out.converted && cfg.rosc === 'never') {
    // Wybór instruktora: rytm wraca. To nie jest oszustwo wobec modelu —
    // ponowne migotanie po skutecznym wyładowaniu jest zjawiskiem realnym.
    loadScenario();
  }
  lamp('safe');
  speak(['sh_6', 'safe'], cprPhase);
}
function setCpr(on) {
  // AED WYDAJE POLECENIE, wiec aplikacja zaklada, ze zostalo wykonane — a instruktor
  // przestawia, jesli bylo inaczej. Bez tego analiza wypadala brudna w KAZDYM cyklu:
  // „Stop CPR" bylo tylko zdaniem, uciśnięcia w silniku trwaly dalej, a uciśnięcia
  // licza sie jako dotyk pacjenta. Wykryte w tescie dymnym 30.08.
  cfg.cpr = on ? 'on' : 'off';
  if (CORE) CORE.setCpr(on);
  paint(); render();
}
function cprPhase() {
  lamp('');
  metronome(true);
  cprLeft = 120;                        // dwuminutowy cykl, jak w prawdziwym AED
  setCpr(true);
  speak(['cpr_1', 'cpr_2', 'cpr_3'], null);
}
function cycleEnd() {
  metronome(false);
  setCpr(false);
  speak(['stop_1', 'ana_1'], analyse);
}
function powerOff() {
  running = false; arm(false); metronome(false); cprLeft = 0;
  setCpr(false);
  clearTimeout(seqTimer); seq = [];
  lamp('');
  $('say').innerHTML = 'Press <b>&nbsp;ON&nbsp;</b> to start';
  $('say').className = '';
}

// ── Wejścia ──────────────────────────────────────────────────────────────────
$('power').onclick = function () { if (running) powerOff(); else powerOn(); };
$('shock').onclick = shockPressed;
$('next').onclick  = skip;
$('reset').onclick = function () { powerOff(); loadScenario(); };

var buttons = document.querySelectorAll('[data-set]');
function paint() {
  for (var i = 0; i < buttons.length; i++) {
    var b = buttons[i];
    var on = cfg[b.getAttribute('data-set')] === b.getAttribute('data-val');
    b.className = (b.className.indexOf('warn') >= 0 ? 'warn ' : '') + (on ? 'sel' : '');
  }
}
for (var i = 0; i < buttons.length; i++) {
  buttons[i].onclick = function () {
    var k = this.getAttribute('data-set'), v = this.getAttribute('data-val');
    cfg[k] = v;
    if (k === 'rhythm') loadScenario();
    if (k === 'cpr' && CORE) CORE.setCpr(v === 'on');
    if (k === 'touch' && CORE) CORE.setPatientContact(v === 'on');
    paint(); render();
  };
}

paint();
if (CORE) { loadScenario(); } else { $('say').textContent = 'core not loaded'; }

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(function () {});
}
})();

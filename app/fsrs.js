/*!
 * EzNihongo FSRS v5 Engine
 * Free Spaced Repetition Scheduler v5 — Vanilla JS, offline-first
 * Storage: localStorage (key: eznihongo_fsrs_v1)
 */
(function (global) {
  'use strict';

  // ─── CONSTANTS ──────────────────────────────────────────────────────────────

  var STORAGE_KEY = 'eznihongo_fsrs_v1';
  var DAY_MS      = 86400000;   // 1 hari dalam ms
  var MIN_MS      = 60000;      // 1 menit dalam ms

  // FSRS v5 power-law forgetting curve constants
  // R(t,S) = (1 + FACTOR * t/S)^DECAY  →  R(S,S) = 0.9
  var DECAY  = -0.5;
  var FACTOR = Math.pow(0.9, 1 / DECAY) - 1; // ≈ 0.2346

  /**
   * Default FSRS v5 weights w[0]–w[18]
   * Sumber: FSRS v5 paper — default parameters
   */
  var DEFAULT_W = [
    0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651,
    0.0589, 1.5330,  0.1544,  1.0071,  1.9395, 0.1100, 0.2900,
    2.2700, 0.2500,  2.9898,  0.5100,  0.3900
  ];

  // ─── STORAGE HELPERS ────────────────────────────────────────────────────────

  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false; // localStorage penuh / tidak tersedia
    }
  }

  // ─── MATH HELPERS ───────────────────────────────────────────────────────────

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  /**
   * Retrievability: probabilitas masih ingat.
   * R(t, S) = (1 + t / (9 * S))^(-1)
   * @param {number} t  hari sejak review terakhir
   * @param {number} S  stability (hari)
   * @returns {number}  nilai [0, 1]
   */
  function calcRetrievability(t, S) {
    if (!S || S <= 0) return 0;
    if (t < 0) t = 0;
    return Math.pow(1 + FACTOR * t / S, DECAY);
  }

  /**
   * Next interval: hari sampai review berikutnya.
   * I = 9 * S * (r^(-1) - 1)
   * Untuk r=0.9: I ≈ S
   * @param {number} S  stability
   * @param {number} r  desired retention (default 0.9)
   * @returns {number}  interval dalam hari (minimum 1)
   */
  function calcNextInterval(S, r) {
    if (!S || S <= 0) return 1;
    r = r || 0.9;
    var interval = S * (Math.pow(r, 1 / DECAY) - 1) / FACTOR;
    return Math.max(1, Math.round(interval));
  }

  /**
   * Initial stability setelah review pertama.
   * S0(rating) = w[rating - 1]
   */
  function calcInitialStability(rating, w) {
    return Math.max(w[rating - 1], 0.1);
  }

  /**
   * Initial difficulty setelah review pertama.
   * D0(rating) = w[4] - exp(w[5] * (rating - 1)) + 1
   */
  function calcInitialDifficulty(rating, w) {
    var d = w[4] - Math.exp(w[5] * (rating - 1)) + 1;
    return clamp(d, 1, 10);
  }

  /**
   * Stability setelah recall sukses (rating 2, 3, atau 4).
   * S'r = S * (exp(w[8]) * (11-D) * S^(-w[9]) * (exp(w[10]*(1-R)) - 1)
   *           * hard_penalty * easy_bonus + 1)
   */
  function calcStabilityRecall(S, D, R, rating, w) {
    var hard_penalty = (rating === 2) ? w[15] : 1;
    var easy_bonus   = (rating === 4) ? w[16] : 1;
    var newS = S * (
      Math.exp(w[8]) *
      (11 - D) *
      Math.pow(S, -w[9]) *
      (Math.exp(w[10] * (1 - R)) - 1) *
      hard_penalty *
      easy_bonus + 1
    );
    return Math.max(newS, 0.1);
  }

  /**
   * Stability setelah lupa (rating 1 / Again).
   * S'f = w[11] * D^(-w[12]) * ((S+1)^w[13] - 1) * exp(w[14]*(1-R))
   */
  function calcStabilityForgetting(S, D, R, w) {
    var newS = w[11] *
      Math.pow(D, -w[12]) *
      (Math.pow(S + 1, w[13]) - 1) *
      Math.exp(w[14] * (1 - R));
    return Math.max(newS, 0.1);
  }

  /**
   * Difficulty update setelah setiap review.
   * D'(D, rating) = w[6] * D0(3) + (1 - w[6]) * (D - w[7] * (rating - 3))
   */
  function calcUpdateDifficulty(D, rating, w) {
    var d0_3 = calcInitialDifficulty(3, w); // anchor: D0 untuk Good
    var newD = w[6] * d0_3 + (1 - w[6]) * (D - w[7] * (rating - 3));
    return clamp(newD, 1, 10);
  }

  // ─── CARD FACTORY ───────────────────────────────────────────────────────────

  function makeNewCard() {
    return {
      stability:  0,
      difficulty: 5,
      due:        Date.now(),
      lastReview: null,
      reps:       0,
      lapses:     0,
      state:      'new',
      lastRating: null
    };
  }

  // ─── STATE MACHINE ──────────────────────────────────────────────────────────

  /**
   * Hitung state kartu berikutnya berdasarkan rating.
   *
   * Transitions:
   *   new       + 1/2  → learning   (1 min / 5 min)
   *   new       + 3/4  → review     (1 hari / 4 hari)
   *   learning  + 1    → learning   (1 min)
   *   learning  + 2    → learning   (5 min)
   *   learning  + 3/4  → review     (interval FSRS)
   *   review    + 1    → relearning (1 min)
   *   review    + 2/3/4→ review     (interval FSRS)
   *   relearning+ 1    → relearning (1 min)
   *   relearning+ 2    → relearning (5 min)
   *   relearning+ 3/4  → review     (interval FSRS)
   *
   * @param {object} card    state kartu sekarang
   * @param {number} rating  1–4
   * @param {Array}  w       FSRS weights
   * @param {number} r       desired retention
   * @returns {object}       state kartu baru
   */
  function calculateNextState(card, rating, w, r) {
    var now = Date.now();
    r = r || 0.9;

    var result = {
      stability:  card.stability  || 0,
      difficulty: card.difficulty || 5,
      due:        card.due        || now,
      lastReview: now,
      reps:       card.reps       || 0,
      lapses:     card.lapses     || 0,
      state:      card.state      || 'new',
      lastRating: rating
    };

    var elapsedDays = card.lastReview ? (now - card.lastReview) / DAY_MS : 0;
    var R = (card.stability > 0 && card.state !== 'new')
      ? calcRetrievability(elapsedDays, card.stability)
      : 0;

    var interval;

    if (card.state === 'new') {
      // ── Review pertama ────────────────────────────────────────────────────
      result.stability  = calcInitialStability(rating, w);
      result.difficulty = calcInitialDifficulty(rating, w);

      if (rating === 1 || rating === 2) {
        result.state = 'learning';
        result.due   = now + (rating === 1 ? MIN_MS : 5 * MIN_MS);
      } else {
        // rating 3 atau 4 → langsung masuk review dengan interval FSRS
        result.state = 'review';
        result.reps++;
        interval     = calcNextInterval(result.stability, r);
        result.due   = now + interval * DAY_MS;
      }

    } else if (card.state === 'learning' || card.state === 'relearning') {
      // ── Learning / Relearning steps ───────────────────────────────────────
      result.difficulty = calcUpdateDifficulty(card.difficulty, rating, w);

      if (rating === 1) {
        result.state = card.state;
        result.due   = now + MIN_MS;
      } else if (rating === 2) {
        result.state = card.state;
        result.due   = now + 5 * MIN_MS;
      } else {
        // rating 3 atau 4 → lulus ke Review
        // Gunakan initial stability (bukan calcStabilityRecall dengan R=0
        // yang menghasilkan interval terlalu besar)
        result.stability = calcInitialStability(rating, w);
        result.state = 'review';
        result.reps++;
        interval = calcNextInterval(result.stability, r);
        result.due = now + interval * DAY_MS;
      }

    } else {
      // ── Review state ──────────────────────────────────────────────────────
      result.difficulty = calcUpdateDifficulty(card.difficulty, rating, w);

      if (rating === 1) {
        result.lapses++;
        result.stability = calcStabilityForgetting(card.stability, card.difficulty, R, w);
        result.state     = 'relearning';
        result.due       = now + MIN_MS;
      } else {
        result.stability = calcStabilityRecall(card.stability, card.difficulty, R, rating, w);
        result.state     = 'review';
        result.reps++;
        result.due       = now + calcNextInterval(result.stability, r) * DAY_MS;
      }
    }

    return result;
  }

  // ─── UTIL ───────────────────────────────────────────────────────────────────

  function shuffle(arr) {
    var i, j, tmp;
    for (i = arr.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  /**
   * Resolve card ID dari item kanji.
   * Support format {id:...} (prompt) dan {k:...} (kanji.html)
   */
  function cardId(item) {
    return (item && (item.id || item.k)) || String(item);
  }

  // ─── PUBLIC API ─────────────────────────────────────────────────────────────

  var EzFSRS = {

    /** Weights aktif (bisa di-override via setWeights) */
    _w: DEFAULT_W.slice(),

    /**
     * Review satu kartu, simpan hasilnya ke localStorage, kembalikan state terbaru.
     *
     * @param {string} kanjiId            ID unik kartu (misal: 'n5_001' atau '日')
     * @param {number} rating             1=Lupa · 2=Susah · 3=Bisa · 4=Mudah
     * @param {number} [desiredRetention] Target retention (default 0.9)
     * @returns {{ stability, difficulty, due, interval, retrievability, state }}
     */
    reviewCard: function (kanjiId, rating, desiredRetention) {
      if (!kanjiId) throw new Error('kanjiId wajib diisi');
      rating = parseInt(rating, 10);
      if (isNaN(rating) || rating < 1 || rating > 4) throw new Error('rating harus 1–4');

      var data = loadData();
      var card = data[kanjiId] || makeNewCard();
      var r    = desiredRetention || 0.9;
      var next = calculateNextState(card, rating, this._w, r);

      data[kanjiId] = next;
      saveData(data);

      var intervalDays = Math.max(0, Math.round((next.due - Date.now()) / DAY_MS));
      var ret          = calcRetrievability(0, next.stability);

      return {
        stability:      Math.round(next.stability  * 100) / 100,
        difficulty:     Math.round(next.difficulty * 100) / 100,
        due:            next.due,
        interval:       intervalDays,
        retrievability: Math.round(ret * 1000) / 1000,
        state:          next.state
      };
    },

    /**
     * Ambil state kartu saat ini dari localStorage.
     *
     * @param {string} kanjiId
     * @returns {object|null}  card state, atau null jika belum pernah direview
     */
    getCardState: function (kanjiId) {
      if (!kanjiId) return null;
      return loadData()[kanjiId] || null;
    },

    /**
     * Bangun daftar kartu untuk sesi review hari ini.
     * Urutan: Learning cards → Due reviews (oldest first) → New cards (acak, max newLimit).
     *
     * @param {Array}  kanjiList               Array kanji {id,…} atau {k,…}
     * @param {object} [options]
     * @param {number} [options.newLimit=10]   Maks kartu baru per sesi
     * @param {number} [options.desiredRetention=0.9]
     * @returns {Array}  Kartu siap review, sudah diurutkan
     */
    buildSession: function (kanjiList, options) {
      options  = options  || {};
      var limit = (options.newLimit !== undefined) ? options.newLimit : 10;
      var now   = Date.now();
      var data  = loadData();

      var learning  = [];
      var dueReview = [];
      var newCards  = [];

      for (var i = 0; i < kanjiList.length; i++) {
        var item = kanjiList[i];
        var id   = cardId(item);
        var card = data[id];

        if (!card || card.state === 'new') {
          newCards.push(item);
          continue;
        }
        if (card.state === 'learning' || card.state === 'relearning') {
          if (card.due <= now + DAY_MS) {
            learning.push({ item: item, due: card.due });
          }
        } else if (card.state === 'review' && card.due <= now) {
          dueReview.push({ item: item, due: card.due });
        }
      }

      // Due review: yang paling lama overdue duluan
      dueReview.sort(function (a, b) { return a.due - b.due; });
      shuffle(newCards);

      var result = [];
      var k;
      for (k = 0; k < learning.length;  k++) result.push(learning[k].item);
      for (k = 0; k < dueReview.length; k++) result.push(dueReview[k].item);
      var newSlice = newCards.slice(0, limit);
      for (k = 0; k < newSlice.length;  k++) result.push(newSlice[k]);

      return result;
    },

    /**
     * Hitung retrievability kartu saat ini (0–1).
     *
     * @param {string} kanjiId
     * @returns {number}  misal 0.87 = 87% kemungkinan masih ingat
     */
    getRetrievability: function (kanjiId) {
      var card = this.getCardState(kanjiId);
      if (!card || card.state === 'new' || !card.stability) return 0;
      var elapsed = card.lastReview ? (Date.now() - card.lastReview) / DAY_MS : 0;
      return Math.round(calcRetrievability(elapsed, card.stability) * 1000) / 1000;
    },

    /**
     * Statistik hafalan untuk dashboard.
     * "mature" = stability >= 21 hari.
     *
     * @param {Array} kanjiList
     * @returns {{ total, newCount, dueCount, learnedCount, matureCount, averageRetention }}
     */
    getStats: function (kanjiList) {
      var data         = loadData();
      var now          = Date.now();
      var total        = kanjiList.length;
      var newCount     = 0;
      var dueCount     = 0;
      var learnedCount = 0;
      var matureCount  = 0;
      var sumRet       = 0;
      var retCount     = 0;

      for (var i = 0; i < kanjiList.length; i++) {
        var item = kanjiList[i];
        var id   = cardId(item);
        var card = data[id];

        if (!card || card.state === 'new') {
          newCount++;
          continue;
        }

        learnedCount++;
        if (card.stability >= 21) matureCount++;

        if (card.state === 'review' && card.due <= now) dueCount++;
        if ((card.state === 'learning' || card.state === 'relearning') && card.due <= now + DAY_MS) dueCount++;

        if (card.stability > 0 && card.lastReview) {
          var elapsed = (now - card.lastReview) / DAY_MS;
          sumRet += calcRetrievability(elapsed, card.stability);
          retCount++;
        }
      }

      return {
        total:            total,
        newCount:         newCount,
        dueCount:         dueCount,
        learnedCount:     learnedCount,
        matureCount:      matureCount,
        averageRetention: retCount > 0
          ? Math.round((sumRet / retCount) * 1000) / 1000
          : 0
      };
    },

    /**
     * Prediksi jumlah kartu yang due N hari ke depan.
     * Simulasi forward: asumsikan user selalu jawab "Bisa" (rating 3).
     *
     * @param {Array}  kanjiList
     * @param {number} [days=7]
     * @returns {Array<{ date: string, dueCount: number }>}
     */
    getForecast: function (kanjiList, days) {
      days = days || 7;
      var w = this._w;
      var r = 0.9;

      var simData;
      try {
        simData = JSON.parse(JSON.stringify(loadData()));
      } catch (e) {
        simData = {};
      }

      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var todayMs = today.getTime();

      var forecast = [];

      for (var d = 0; d < days; d++) {
        var dayStart = todayMs + d * DAY_MS;
        var dayEnd   = dayStart + DAY_MS;
        var midday   = dayStart + 12 * 3600000; // simulasi review jam 12 siang
        var count    = 0;

        for (var i = 0; i < kanjiList.length; i++) {
          var item = kanjiList[i];
          var id   = cardId(item);
          var card = simData[id];

          if (!card || card.state !== 'review') continue;
          if (card.due < dayStart || card.due >= dayEnd) continue;

          count++;

          // Simulasi review dengan rating 3 (Bisa)
          var elapsedSim = card.lastReview ? (midday - card.lastReview) / DAY_MS : 0;
          var Rsim       = calcRetrievability(elapsedSim, card.stability);
          var newS       = calcStabilityRecall(card.stability, card.difficulty, Rsim, 3, w);
          var newD       = calcUpdateDifficulty(card.difficulty, 3, w);
          var newInt     = calcNextInterval(newS, r);

          simData[id] = {
            stability:  newS,
            difficulty: newD,
            due:        midday + newInt * DAY_MS,
            lastReview: midday,
            reps:       (card.reps || 0) + 1,
            lapses:     card.lapses || 0,
            state:      'review',
            lastRating: 3
          };
        }

        forecast.push({
          date:     new Date(dayStart).toISOString().slice(0, 10),
          dueCount: count
        });
      }

      return forecast;
    },

    /**
     * Reset satu kartu ke state "new".
     *
     * @param {string} kanjiId
     */
    resetCard: function (kanjiId) {
      var data = loadData();
      delete data[kanjiId];
      saveData(data);
    },

    /**
     * Reset semua kartu. Wajib kirim string konfirmasi 'RESET_ALL'.
     *
     * @param {string} confirm  harus === 'RESET_ALL'
     */
    resetAll: function (confirm) {
      if (confirm !== 'RESET_ALL') {
        throw new Error('Kirim string "RESET_ALL" sebagai konfirmasi.');
      }
      saveData({});
    },

    /**
     * Export semua progress sebagai JSON string (untuk backup).
     *
     * @returns {string}
     */
    exportProgress: function () {
      return JSON.stringify(loadData(), null, 2);
    },

    /**
     * Import progress dari JSON string.
     *
     * @param {string} jsonString
     * @returns {boolean}  true jika berhasil
     */
    importProgress: function (jsonString) {
      try {
        var data = JSON.parse(jsonString);
        if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
        return saveData(data);
      } catch (e) {
        return false;
      }
    },

    /**
     * Override weights untuk personalisasi.
     *
     * @param {Array} weights  Array tepat 19 angka
     */
    setWeights: function (weights) {
      if (!Array.isArray(weights) || weights.length !== 19) {
        throw new Error('weights harus array tepat 19 angka');
      }
      for (var i = 0; i < weights.length; i++) {
        if (typeof weights[i] !== 'number' || isNaN(weights[i])) {
          throw new Error('Semua weights harus berupa number');
        }
      }
      this._w = weights.slice();
    },

    /**
     * Ambil salinan weights aktif.
     *
     * @returns {Array}
     */
    getWeights: function () {
      return this._w.slice();
    }
  };

  // ─── INTERNALS (untuk testing) ──────────────────────────────────────────────

  EzFSRS._internals = {
    retrievability:      calcRetrievability,
    calculateNextState:  calculateNextState,
    initialStability:    calcInitialStability,
    initialDifficulty:   calcInitialDifficulty,
    stabilityRecall:     calcStabilityRecall,
    stabilityForgetting: calcStabilityForgetting,
    updateDifficulty:    calcUpdateDifficulty,
    nextInterval:        calcNextInterval,
    clamp:               clamp,
    cardId:              cardId,
    makeNewCard:         makeNewCard,
    loadData:            loadData,
    DEFAULT_W:           DEFAULT_W.slice()
  };

  // Expose ke global scope
  global.EzFSRS = EzFSRS;

}(typeof window !== 'undefined' ? window : this));

/*
 * ─── CONTOH PENGGUNAAN ────────────────────────────────────────────────────────
 *
 * // 1. Load engine
 * //    <script src="fsrs.js"></script>
 *
 * // 2. Review kanji — user klik "Bisa"
 * var result = EzFSRS.reviewCard('n5_001', 3);
 * console.log(result);
 * // → {
 * //     stability: 3.13,        // memori kuat ~3 hari
 * //     difficulty: 5.05,       // tingkat kesulitan [1–10]
 * //     due: 1718500000000,     // timestamp review berikutnya (ms)
 * //     interval: 3,            // hari sampai review berikutnya
 * //     retrievability: 1,      // baru direview = 100%
 * //     state: 'review'
 * //   }
 *
 * // 3. Bangun sesi review hari ini
 * var session = EzFSRS.buildSession(KD, { newLimit: 10 });
 * // → array kanji yang harus direview (learning + due + new)
 *
 * // 4. Statistik untuk dashboard
 * var stats = EzFSRS.getStats(KD);
 * // → { total: 2229, newCount: 2189, dueCount: 3,
 * //     learnedCount: 40, matureCount: 5, averageRetention: 0.87 }
 *
 * // 5. Forecast 14 hari ke depan
 * var forecast = EzFSRS.getForecast(KD, 14);
 * // → [{ date: '2025-06-16', dueCount: 5 }, ...]
 *
 * // 6. Retrievability kartu tertentu
 * var r = EzFSRS.getRetrievability('n5_001');
 * // → 0.873  (87.3% kemungkinan masih ingat)
 *
 * // 7. Backup & restore
 * var backup = EzFSRS.exportProgress();
 * localStorage.setItem('backup', backup);
 * EzFSRS.importProgress(localStorage.getItem('backup'));
 *
 * // 8. Reset
 * EzFSRS.resetCard('n5_001');          // reset satu kartu
 * EzFSRS.resetAll('RESET_ALL');        // reset semua (hati-hati!)
 *
 * // 9. Override weights (setelah personalisasi)
 * EzFSRS.setWeights([0.40, 1.18, 3.12, 15.47, 7.21,
 *                    0.53, 1.06, 0.05, 1.53,  0.15,
 *                    1.00, 1.93, 0.11, 0.29,  2.27,
 *                    0.25, 2.98, 0.51, 0.39]);
 *
 * // 10. Integrasi dengan tombol Hafal/Ulangi di kanji.html
 * //     Ganti sm2Update(k, 4) → EzFSRS.reviewCard(k, 4)
 * //     Ganti sm2Update(k, 1) → EzFSRS.reviewCard(k, 1)
 * //     Rating mapping:
 * //       "Hafal"  → 4 (Mudah)  atau 3 (Bisa) tergantung keyakinan user
 * //       "Ulangi" → 1 (Lupa)
 */

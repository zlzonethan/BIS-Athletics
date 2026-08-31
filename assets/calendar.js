(function () {
  'use strict';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MONTH_INDEX = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  var SPORT_EMOJI = { basketball: '🏀', volleyball: '🏐', soccer: '⚽' };
  var CUSTOM_MATCHES_KEY = 'bis_custom_matches';
  var DELETED_MATCHES_KEY = 'bis_deleted_matches';
  var grid = document.getElementById('calGrid');
  var label = document.getElementById('calMonthLabel');
  var eventList = document.getElementById('calEventList');
  if (!grid || !label || !eventList) return;

  var selectedDate = null;
  var current = new Date();
  var viewDate = new Date(current.getFullYear(), current.getMonth(), 1);
  var eventMap = {};
  var firebaseCustomMatches = null;
  var firebaseDeletedIds = null;

  function pad(value) { return String(value).padStart(2, '0'); }
  function dateKey(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()); }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function schoolYearFor(month) {
    var now = new Date();
    return now.getFullYear();
  }
  function parseDate(raw) {
    if (!raw) return null;
    var value = String(raw).trim();
    var iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      var isoDate = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
      return Number.isNaN(isoDate.getTime()) ? null : isoDate;
    }
    var legacy = value.match(/([A-Za-z]{3,9})\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
    if (!legacy) return null;
    var month = MONTH_INDEX[legacy[1].slice(0, 3).toLowerCase()];
    var day = Number(legacy[2]);
    if (month === undefined || !Number.isFinite(day) || day < 1 || day > 31) return null;
    var year = legacy[3] ? Number(legacy[3]) : schoolYearFor(month);
    var date = new Date(year, month, day);
    return date.getMonth() === month ? date : null;
  }
  function parseTime(raw) {
    var match = String(raw || '').match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (!match) return '';
    var hour = Number(match[1]);
    var minute = Number(match[2]);
    var meridiem = (match[3] || '').toLowerCase();
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    var suffix = hour >= 12 ? 'pm' : 'am';
    var displayHour = hour % 12 || 12;
    return displayHour + ':' + pad(minute) + suffix;
  }
  function readJson(key, fallback) {
    try { var parsed = JSON.parse(localStorage.getItem(key) || ''); return parsed == null ? fallback : parsed; } catch (_) { return fallback; }
  }
  function normalizedMatch(match) {
    if (!match || !match.date || !match.home || !match.away) return null;
    var day = parseDate(match.date);
    if (!day) return null;
    return {
      id: match.id == null ? '' : String(match.id), home: String(match.home), away: String(match.away),
      date: String(match.date), location: String(match.location || ''), sport: String(match.sport || '').toLowerCase(),
      level: String(match.level || ''), gender: String(match.gender || ''), key: dateKey(day)
    };
  }
  function collectMatches() {
    var deleted = new Set((firebaseDeletedIds || readJson(DELETED_MATCHES_KEY, [])).map(String));
    var source = [].concat(window.BIS_BASE_SCHEDULES || [], firebaseCustomMatches || readJson(CUSTOM_MATCHES_KEY, []));
    var byId = new Map();
    source.forEach(function (match) {
      var item = normalizedMatch(match);
      if (!item || deleted.has(item.id)) return;
      byId.set(item.id || item.home + item.away + item.date, item);
    });
    return Array.from(byId.values());
  }
  function rebuildEventMap() {
    eventMap = {};
    collectMatches().forEach(function (match) {
      if (!eventMap[match.key]) eventMap[match.key] = [];
      eventMap[match.key].push(match);
    });
    Object.keys(eventMap).forEach(function (key) {
      eventMap[key].sort(function (a, b) { return a.date.localeCompare(b.date); });
    });
  }
  function drawEvents() {
    if (!selectedDate) { eventList.innerHTML = ''; return; }
    var matches = eventMap[selectedDate] || [];
    if (!matches.length) {
      eventList.innerHTML = '<div class="calendar-event-item"><div class="calendar-event-info"><div class="calendar-event-title">No matches on this date</div></div></div>';
      return;
    }
    eventList.innerHTML = matches.map(function (match) {
      var sport = match.sport || 'match';
      var badge = [match.level, sport].filter(Boolean).join(' ');
      var meta = [parseTime(match.date), match.location, match.gender].filter(Boolean).join(' · ');
      return '<a href="details.html?id=' + encodeURIComponent(match.id) + '" class="calendar-event-item" style="text-decoration:none;color:inherit;display:flex;">'
        + '<div class="calendar-event-sport">' + (SPORT_EMOJI[sport] || '🏅') + '</div>'
        + '<div class="calendar-event-info"><div class="calendar-event-title">' + escapeHtml(match.home) + ' vs ' + escapeHtml(match.away) + '</div>'
        + '<div class="calendar-event-meta">' + escapeHtml(meta) + '</div></div>'
        + '<div class="calendar-event-badge">' + escapeHtml(badge) + '</div></a>';
    }).join('');
  }
  function draw() {
    var year = viewDate.getFullYear();
    var month = viewDate.getMonth();
    label.textContent = MONTHS[month] + ' ' + year;
    var start = new Date(year, month, 1 - new Date(year, month, 1).getDay());
    var todayKey = dateKey(new Date());
    var html = '';
    for (var index = 0; index < 42; index += 1) {
      var cellDate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      var key = dateKey(cellDate);
      var matches = eventMap[key] || [];
      var classes = 'calendar-day';
      if (cellDate.getMonth() !== month) classes += ' other-month empty';
      if (key === todayKey) classes += ' today';
      if (key === selectedDate) classes += ' selected';
      var dots = '';
      if (matches.length) {
        var seen = {};
        dots = '<div class="calendar-dots">' + matches.map(function (match) {
          var sport = match.sport || 'match';
          if (seen[sport]) return '';
          seen[sport] = true;
          return '<div class="calendar-dot ' + escapeHtml(sport) + '"></div>';
        }).join('') + '</div>';
      }
      html += '<button type="button" class="' + classes + '" data-calendar-date="' + key + '" aria-label="' + key + (matches.length ? ', ' + matches.length + ' matches' : '') + '"><span class="day-number">' + cellDate.getDate() + '</span>' + dots + '</button>';
    }
    grid.innerHTML = html;
    drawEvents();
  }
  function refresh() { rebuildEventMap(); draw(); }
  function go(offset) { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1); draw(); }
  function goToday() { var now = new Date(); viewDate = new Date(now.getFullYear(), now.getMonth(), 1); selectedDate = dateKey(now); draw(); }
  function pick(key) { selectedDate = selectedDate === key ? null : key; draw(); }
  function listenForRemoteMatches() {
    if (!window.firebase || !window.BIS_FIREBASE_CONFIG || !window.BIS_FIREBASE_CONFIG.apiKey) return;
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.BIS_FIREBASE_CONFIG);
      var db = firebase.firestore();
      db.collection('customMatches').onSnapshot(function (snapshot) {
        firebaseCustomMatches = snapshot.docs.map(function (doc) { return Object.assign({ id: doc.id }, doc.data() || {}); });
        refresh();
      });
      db.collection('deletedMatches').onSnapshot(function (snapshot) {
        firebaseDeletedIds = snapshot.docs.map(function (doc) { return doc.id; });
        refresh();
      });
    } catch (_) { /* The local calendar still works when Firebase is unavailable. */ }
  }

  grid.addEventListener('click', function (event) {
    var day = event.target.closest('[data-calendar-date]');
    if (day) pick(day.dataset.calendarDate);
  });
  rebuildEventMap();
  draw();
  listenForRemoteMatches();
  window.BIS_CAL = { go: go, goToday: goToday, pick: pick, refresh: refresh };
})();

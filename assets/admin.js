// Admin dock script
(function(){
	const LIVE_SCORE_KEY = 'bis_live_scores';
	const CUSTOM_MATCHES_KEY = 'bis_custom_matches';
	const LIVE_EVENTS_KEY = 'bis_live_events';
	const MATCH_META_KEY = 'bis_match_meta';
	const FINISHED_KEY = 'bis_finished_matches';
	const VOTE_COUNTS_KEY = 'bis_vote_counts';
	const VOTES_KEY = 'bis_votes';
	const MATCH_SUB_KEY = 'bis_match_subscriptions';
	const CUSTOM_MATCH_COLLECTION = 'customMatches';
	const ADMIN_PASSPHRASE_KEY = 'bis_admin_pass_hash';
	const LEGACY_ADMIN_PASSPHRASE_KEY = 'kis_admin_pass';
	// No hardcoded default — user must set their own passphrase
	const SCHEDULES = (Array.isArray(window.BIS_BASE_SCHEDULES) ? window.BIS_BASE_SCHEDULES : []).map((m) => ({
		id: Number(m.id),
		home: (m.home || '').toString(),
		away: (m.away || '').toString(),
		date: (m.date || '').toString(),
		location: (m.location || '').toString(),
		sport: (m.sport || '').toString(),
		level: (m.level || '').toString(),
		gender: (m.gender || '').toString()
	})).filter((m) => Number.isFinite(m.id));

	let db = null;
	const firebaseConfig = window.BIS_FIREBASE_CONFIG || {};
	if (firebaseConfig.apiKey && window.firebase) {
		try {
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
db = firebase.firestore();
		} catch (e) { console.warn('Firebase init failed', e); }
	}

	let inMemoryStore = {};
	const getWindowStorage = (name) => {
		try {
			return window[name] || null;
		} catch (e) {
			return null;
		}
	};
	const hasWindowStorage = (storage) => {
		if (!storage) return false;
		try {
			const key = '__bis_storage_test__';
			storage.setItem(key, key);
			storage.removeItem(key);
			return true;
		} catch (e) {
			return false;
		}
	};
	let localStore = getWindowStorage('localStorage');
	let sessionStore = getWindowStorage('sessionStorage');
	let localStoreAvailable = hasWindowStorage(localStore);
	let sessionStoreAvailable = hasWindowStorage(sessionStore);
	const readStoredValue = (key) => {
		try {
			if (localStoreAvailable) {
				const value = localStore.getItem(key);
				if (value !== null) return value;
			}
		} catch (e) {
			localStore = null;
			localStoreAvailable = false;
		}
		try {
			if (sessionStoreAvailable) {
				const value = sessionStore.getItem(key);
				if (value !== null) return value;
			}
		} catch (e) {
			sessionStore = null;
			sessionStoreAvailable = false;
		}
		return Object.prototype.hasOwnProperty.call(inMemoryStore, key) ? inMemoryStore[key] : null;
	};
	const writeStoredValue = (key, value) => {
		const nextValue = value == null ? '' : String(value);
		let persisted = false;
		try {
			if (localStoreAvailable) {
				localStore.setItem(key, nextValue);
				persisted = true;
			}
		} catch (e) {
			localStore = null;
			localStoreAvailable = false;
		}
		try {
			if (sessionStoreAvailable) {
				sessionStore.setItem(key, nextValue);
				persisted = true;
			}
		} catch (e) {
			sessionStore = null;
			sessionStoreAvailable = false;
		}
		inMemoryStore[key] = nextValue;
		return persisted;
	};
	const removeStoredValue = (key) => {
		try {
			if (localStoreAvailable) localStore.removeItem(key);
		} catch (e) {
			localStore = null;
			localStoreAvailable = false;
		}
		try {
			if (sessionStoreAvailable) sessionStore.removeItem(key);
		} catch (e) {
			sessionStore = null;
			sessionStoreAvailable = false;
		}
		delete inMemoryStore[key];
	};
	async function ensureStorageAccess() {
		if (!document.documentElement.classList.contains('in-iframe')) return;
		if (localStoreAvailable) return;
		if (typeof document.hasStorageAccess !== 'function' || typeof document.requestStorageAccess !== 'function') return;
		try {
			const hasAccess = await document.hasStorageAccess();
			if (!hasAccess) await document.requestStorageAccess();
		} catch (e) {}
		localStore = getWindowStorage('localStorage');
		sessionStore = getWindowStorage('sessionStorage');
		localStoreAvailable = hasWindowStorage(localStore);
		sessionStoreAvailable = hasWindowStorage(sessionStore);
	}

	const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const normalizeText = (v) => (v || '').toString().trim().toLowerCase();
	const readJson = (key, fallback) => {
		try {
			const raw = readStoredValue(key);
			return raw === null ? fallback : JSON.parse(raw);
		} catch (e) { return fallback; }
	};
	const writeJson = (key, value) => {
		try { writeStoredValue(key, JSON.stringify(value)); } catch (e) {}
	};
	const normalizeCustomMatch = (m) => {
		const id = Number(m?.id);
		const home = (m?.home || '').toString().trim();
		const away = (m?.away || '').toString().trim();
		const date = (m?.date || '').toString().trim();
		if (!Number.isFinite(id) || !home || !away || !date) return null;
		return {
id,
home,
away,
date,
location: (m?.location || '').toString().trim(),
sport: (m?.sport || 'soccer').toString().trim().toLowerCase(),
level: (m?.level || 'HS').toString().trim().toUpperCase(),
gender: (m?.gender || '').toString().trim()
		};
	};
	const getCustomMatchesLocal = () => {
		const raw = readJson(CUSTOM_MATCHES_KEY, []);
		if (!Array.isArray(raw)) return [];
		return raw.map(normalizeCustomMatch).filter(Boolean);
	};
	const setCustomMatchesLocal = (list) => writeJson(CUSTOM_MATCHES_KEY, list || []);
	let customMatchesCache = getCustomMatchesLocal();

	const getCustomMatches = () => customMatchesCache.slice();
	const setCustomMatches = (list) => {
		customMatchesCache = (Array.isArray(list) ? list : []).map(normalizeCustomMatch).filter(Boolean);
		setCustomMatchesLocal(customMatchesCache);
	};
	const getAllMatches = () => {
		const all = [...SCHEDULES, ...getCustomMatches()];
		const seen = new Set();
		return all.filter((m) => {
const id = Number(m?.id);
if (!Number.isFinite(id) || seen.has(id)) return false;
seen.add(id);
return true;
		});
	};
	const getCustomById = (id) => getCustomMatches().find((m) => Number(m.id) === Number(id)) || null;
	const formatShortDate = (raw) => {
		if (!raw || typeof raw !== 'string') return '';
		const m = raw.match(/([A-Za-z]{3,9}\s*\d{1,2})/);
		return m ? m[1].trim() : raw;
	};
	const toDisplayDate = (datetimeLocalValue) => {
		if (!datetimeLocalValue) return null;
		const dt = new Date(datetimeLocalValue);
		if (Number.isNaN(dt.getTime())) return null;
		const month = monthNames[dt.getMonth()];
		const day = dt.getDate();
		let hour = dt.getHours();
		const minute = String(dt.getMinutes()).padStart(2, '0');
		const ampm = hour >= 12 ? 'pm' : 'am';
		hour = hour % 12;
		if (hour === 0) hour = 12;
		return `${month} ${day}, ${hour}:${minute}${ampm}`;
	};
	const inferYearByMonth = (monthIndex) => {
		const now = new Date();
		const currentYear = now.getFullYear();
		const currentMonth = now.getMonth();
		let year = currentYear;
		if (currentMonth <= 4 && monthIndex >= 7) year = currentYear - 1;
		if (currentMonth >= 7 && monthIndex <= 4) year = currentYear + 1;
		return year;
	};
	const toDatetimeLocal = (displayDate) => {
		if (!displayDate || typeof displayDate !== 'string') return '';
		const m = displayDate.match(/([A-Za-z]{3,9})\s*(\d{1,2})(?:,\s*(\d{1,2}):(\d{2})\s*(am|pm))?/i);
		if (!m) return '';
		const month = monthNames.findIndex((n) => n.toLowerCase() === m[1].slice(0, 3).toLowerCase());
		const day = Number(m[2]);
		if (month < 0 || !Number.isFinite(day)) return '';
		let hour = Number(m[3] || 12);
		const minute = Number(m[4] || 0);
		const ampm = (m[5] || '').toLowerCase();
		if (ampm === 'pm' && hour < 12) hour += 12;
		if (ampm === 'am' && hour === 12) hour = 0;
		const dt = new Date(inferYearByMonth(month), month, day, hour, minute, 0, 0);
		if (Number.isNaN(dt.getTime())) return '';
		const yyyy = dt.getFullYear();
		const mm = String(dt.getMonth() + 1).padStart(2, '0');
		const dd = String(dt.getDate()).padStart(2, '0');
		const hh = String(dt.getHours()).padStart(2, '0');
		const min = String(dt.getMinutes()).padStart(2, '0');
		return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
	};
	const isDuplicateMatch = (candidate, excludeId) => {
		const cHome = normalizeText(candidate.home);
		const cAway = normalizeText(candidate.away);
		const cDate = normalizeText(candidate.date);
		return getAllMatches().some((m) => {
if (Number(m.id) === Number(excludeId)) return false;
return normalizeText(m.home) === cHome &&
	normalizeText(m.away) === cAway &&
	normalizeText(m.date) === cDate;
		});
	};
	const getNextMatchId = () => {
		const allIds = getAllMatches().map((m) => Number(m.id)).filter((n) => Number.isFinite(n));
		return Math.max(100, ...(allIds.length ? allIds : [99])) + 1;
	};
	const $ = (sel) => document.querySelector(sel);
	const adminToggle = $('#adminToggleBtn');
	const adminBody = $('#adminBody');
const matchSelect = $('#adminMatchSelect');
const statusInput = $('#adminStatus');
const streamInput = $('#adminStream');
const streamInput2 = $('#adminStream2');
const setInput = $('#adminSet');
const noteInput = $('#adminNote');
const homeInput = $('#adminHomeScore');
const awayInput = $('#adminAwayScore');
const saveBtn = $('#adminSaveBtn');
const clearBtn = $('#adminClearBtn');
const copyBtn = $('#adminCopyBtn');
const jsonArea = $('#adminJson');
const newHomeInput = $('#adminNewHome');
const newHomeCustomInput = $('#adminNewHomeCustom');
const newAwayInput = $('#adminNewAway');
const newAwayCustomInput = $('#adminNewAwayCustom');
const newDateInput = $('#adminNewDate');
const newDateOnlyInput = $('#adminNewDateOnly');
const newTimeOnlyInput = $('#adminNewTimeOnly');
const newLocationInput = $('#adminNewLocation');
	const newSportInput = $('#adminNewSport');
	const newLevelInput = $('#adminNewLevel');
	const newGenderInput = $('#adminNewGender');
	const addMatchBtn = $('#adminAddMatchBtn');
	const updateMatchBtn = $('#adminUpdateMatchBtn');
	const deleteMatchBtn = $('#adminDeleteMatchBtn');
	const finishBtn = $('#adminFinishBtn');
	const resetBtn = $('#adminResetBtn');

	// Custom team toggle logic
	if (newHomeInput) newHomeInput.addEventListener('change', () => {
		newHomeCustomInput.style.display = newHomeInput.value === '__custom__' ? 'block' : 'none';
		if (newHomeInput.value !== '__custom__') newHomeCustomInput.value = '';
	});
	if (newAwayInput) newAwayInput.addEventListener('change', () => {
		newAwayCustomInput.style.display = newAwayInput.value === '__custom__' ? 'block' : 'none';
		if (newAwayInput.value !== '__custom__') newAwayCustomInput.value = '';
	});

	// Sync date + time into hidden adminNewDate input
	const syncDateTimeInputs = () => {
		const dateVal = newDateOnlyInput?.value || '';
		const timeVal = newTimeOnlyInput?.value || '';
		if (dateVal && timeVal) {
newDateInput.value = `${dateVal}T${timeVal}`;
		} else if (dateVal) {
newDateInput.value = `${dateVal}T12:00`;
		} else {
newDateInput.value = '';
		}
	};
	if (newDateOnlyInput) newDateOnlyInput.addEventListener('change', syncDateTimeInputs);
	if (newTimeOnlyInput) newTimeOnlyInput.addEventListener('change', syncDateTimeInputs);

	// Helper: get actual team value (select or custom input)
	const getHomeTeamValue = () => {
		if (newHomeInput.value === '__custom__') return (newHomeCustomInput?.value || '').trim();
		return (newHomeInput?.value || '').trim();
	};
	const getAwayTeamValue = () => {
		if (newAwayInput.value === '__custom__') return (newAwayCustomInput?.value || '').trim();
		return (newAwayInput?.value || '').trim();
	};

	// Helper: set select to team value (or custom)
	const setTeamSelect = (selectEl, customEl, teamName) => {
		const trimmed = (teamName || '').trim();
		const opt = Array.from(selectEl.options).find(o => o.value === trimmed && o.value !== '__custom__');
		if (opt) {
selectEl.value = trimmed;
customEl.style.display = 'none';
customEl.value = '';
		} else {
selectEl.value = '__custom__';
customEl.style.display = 'block';
customEl.value = trimmed;
		}
	};

	// Helper: populate date/time from datetime-local string
	const setDateTimeInputs = (datetimeLocalStr) => {
		if (!datetimeLocalStr) {
if (newDateOnlyInput) newDateOnlyInput.value = '';
if (newTimeOnlyInput) newTimeOnlyInput.value = '';
return;
		}
		const parts = datetimeLocalStr.split('T');
		if (newDateOnlyInput) newDateOnlyInput.value = parts[0] || '';
		if (newTimeOnlyInput) newTimeOnlyInput.value = parts[1] || '';
	};

	const clearMatchForm = () => {
		newHomeInput.value = 'BIS';
		newHomeCustomInput.style.display = 'none';
		newHomeCustomInput.value = '';
		newAwayInput.value = 'BIS';
		newAwayCustomInput.style.display = 'none';
		newAwayCustomInput.value = '';
		newDateInput.value = '';
		if (newDateOnlyInput) newDateOnlyInput.value = '';
		if (newTimeOnlyInput) newTimeOnlyInput.value = '';
		newLocationInput.value = '';
		newSportInput.value = 'basketball';
		newLevelInput.value = 'HS';
		newGenderInput.value = '';
	};
	const populateMatchSelect = () => {
		if(!matchSelect) return;
		const current = String(matchSelect.value || '');
		matchSelect.innerHTML = '';
	const customIdSet = new Set(getCustomMatches().map((m) => String(m.id)));
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	getAllMatches().filter((s) => {
		// Skip matches flagged as preset past
		if (s.presetPast) return false;
		// Parse date and skip if it's in the past
		const dtl = toDatetimeLocal(s.date);
		if (dtl) {
const matchDate = new Date(dtl);
matchDate.setHours(0, 0, 0, 0);
if (matchDate < now) return false;
		}
		return true;
	}).forEach((s)=>{
		const opt = document.createElement('option');
		opt.value = String(s.id);
		const shortDate = formatShortDate(s.date);
		const tag = customIdSet.has(String(s.id)) ? ' [custom]' : '';
opt.textContent = `${s.home} vs ${s.away} (#${s.id}) — ${shortDate}${tag}`;
matchSelect.appendChild(opt);
		});
		if (current && matchSelect.querySelector(`option[value="${current}"]`)) matchSelect.value = current;
	};
	populateMatchSelect();

	const getAll = () => readJson(LIVE_SCORE_KEY, {});
	const setAll = (obj) => writeJson(LIVE_SCORE_KEY, obj || {});
	const cleanupLocalMatchArtifacts = (id) => {
		const keys = [LIVE_SCORE_KEY, LIVE_EVENTS_KEY, MATCH_META_KEY, FINISHED_KEY, VOTE_COUNTS_KEY, VOTES_KEY, MATCH_SUB_KEY];
		keys.forEach((key) => {
const data = readJson(key, {});
if (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, id)) {
	delete data[id];
	writeJson(key, data);
}
		});
	};
	const cleanupRemoteMatchArtifacts = async (id) => {
		if (!db) return;
		await Promise.allSettled([
db.collection('finishedMatches').doc(String(id)).delete(),
db.collection('votes').doc(String(id)).delete()
		]);
	};
	const saveCustomMatch = async (match) => {
		if (db) {
await db.collection(CUSTOM_MATCH_COLLECTION).doc(String(match.id)).set(match, { merge: true });
		}
		const next = getCustomMatches().filter((m) => Number(m.id) !== Number(match.id));
		next.push(match);
		setCustomMatches(next);
	};
	const removeCustomMatch = async (id) => {
		if (db) {
await db.collection(CUSTOM_MATCH_COLLECTION).doc(String(id)).delete();
		}
		setCustomMatches(getCustomMatches().filter((m) => Number(m.id) !== Number(id)));
	};
	const syncCustomMatchesFromFirebase = () => {
		if (!db) return;
		db.collection(CUSTOM_MATCH_COLLECTION).onSnapshot((snap) => {
const next = [];
snap.forEach((doc) => {
	const data = doc.data() || {};
	const parsed = normalizeCustomMatch({ ...data, id: Number(data.id || doc.id) });
	if (parsed) next.push(parsed);
});
setCustomMatches(next);
populateMatchSelect();
		});
	};
	syncCustomMatchesFromFirebase();

	// SHA-256 hash helper
	async function sha256(str) {
		const buf = new TextEncoder().encode(str);
		const hash = await crypto.subtle.digest('SHA-256', buf);
		return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
	}

	function getStoredPassHash(){
		try {
const current = readStoredValue(ADMIN_PASSPHRASE_KEY) || '';
if (current) return current;
// Migrate legacy plain text passphrase to hash on first use
return '';
		} catch(e){ return ''; }
	}
	async function setPassHash(pass){
		try {
const hash = await sha256(pass.trim());
const persisted = writeStoredValue(ADMIN_PASSPHRASE_KEY, hash);
// Clean up legacy keys
removeStoredValue('bis_admin_pass');
removeStoredValue(LEGACY_ADMIN_PASSPHRASE_KEY);
			return persisted;
		} catch(e){
			return false;
		}
	}
	function showPassModal(title, desc) {
		return new Promise((resolve) => {
const modal = document.getElementById('passModal');
const input = document.getElementById('passModalInput');
const errEl = document.getElementById('passModalError');
const okBtn = document.getElementById('passModalOk');
const cancelBtn = document.getElementById('passModalCancel');
document.getElementById('passModalTitle').textContent = title || 'Admin Passphrase';
document.getElementById('passModalDesc').textContent = desc || 'Enter passphrase to continue';
input.value = '';
errEl.style.display = 'none';
modal.style.display = 'flex';
setTimeout(() => input.focus(), 50);
const cleanup = () => {
	modal.style.display = 'none';
	okBtn.removeEventListener('click', onOk);
	cancelBtn.removeEventListener('click', onCancel);
	input.removeEventListener('keydown', onKey);
};
const onOk = () => { cleanup(); resolve(input.value); };
const onCancel = () => { cleanup(); resolve(null); };
const onKey = (e) => { if (e.key === 'Enter') onOk(); if (e.key === 'Escape') onCancel(); };
okBtn.addEventListener('click', onOk);
cancelBtn.addEventListener('click', onCancel);
input.addEventListener('keydown', onKey);
		});
	}
	function showPassError(msg) {
		const errEl = document.getElementById('passModalError');
		errEl.textContent = msg;
		errEl.style.display = 'block';
	}
	function isForwardedFrameAdmin() {
		return document.documentElement.classList.contains('in-iframe') &&
			!document.documentElement.classList.contains('google-sites-embed');
	}
	function openDirectAdminPage() {
		const directUrl = new URL(window.location.href);
		directUrl.searchParams.set('admin', '1');
		try {
			if (window.top && window.top !== window.self) {
				window.top.location.href = directUrl.toString();
				return;
			}
		} catch (e) {}
		const opened = window.open(directUrl.toString(), '_blank', 'noopener');
		if (!opened) {
			alert(`Open admin directly here: ${directUrl.toString()}`);
		}
	}
	async function promptPass(){
		let storedHash = getStoredPassHash();
		if (!storedHash) {
const newPass = await showPassModal('Create Passphrase', 'No passphrase configured. Create one (min 6 chars).');
if (newPass === null) return { ok: false, reason: 'cancelled' };
const trimmed = (newPass || '').trim();
if (trimmed.length < 6) return { ok: false, reason: 'weak' };
const persisted = await setPassHash(trimmed);
storedHash = await sha256(trimmed);
			if (!persisted && document.documentElement.classList.contains('in-iframe')) {
				alert('This forwarded page can open admin, but your browser is not allowing persistent storage inside the iframe. If it asks again after reload, use the direct site URL for admin access.');
			}
		}
		const p = await showPassModal('Admin Passphrase', 'Enter passphrase to open admin panel.');
		if (p === null) return { ok: false, reason: 'cancelled' };
		const inputHash = await sha256((p || '').trim());
		return inputHash === storedHash ? { ok: true } : { ok: false, reason: 'wrong' };
	}

adminToggle.addEventListener('click', async ()=>{
	if (adminBody.style.display === 'none' || adminBody.style.display === '') {
		if (isForwardedFrameAdmin()) {
			openDirectAdminPage();
			return;
		}
await ensureStorageAccess();
const auth = await promptPass();
if(!auth.ok){
	if (auth.reason === 'not_configured') alert('Admin passphrase is not configured.');
	else if (auth.reason === 'weak') alert('Passphrase must be at least 6 characters.');
	else if (auth.reason === 'wrong') alert('Incorrect passphrase');
	return;
}
		adminBody.style.display = 'block'; adminToggle.textContent = 'Close';
		refreshJson();
	} else { adminBody.style.display = 'none'; adminToggle.textContent = 'Open'; }
});

	function refreshJson(){ const all = getAll(); jsonArea.value = JSON.stringify(all, null, 2); }

	matchSelect.addEventListener('change', ()=>{
		const id = String(matchSelect.value || '');
	if(!id) return;
	const all = getAll();
	const entry = all[id]||{};
	statusInput.value = entry.status||'scheduled';
	streamInput.value = entry.streamUrl||'';
streamInput2.value = entry.streamUrl2||'';
	setInput.value = entry.setNumber||'';
		noteInput.value = entry.note||'';
		homeInput.value = Number.isFinite(entry.homeScore)?entry.homeScore:'';
		awayInput.value = Number.isFinite(entry.awayScore)?entry.awayScore:'';
		const custom = getCustomById(id);
		if (custom) {
setTeamSelect(newHomeInput, newHomeCustomInput, custom.home || '');
setTeamSelect(newAwayInput, newAwayCustomInput, custom.away || '');
setDateTimeInputs(toDatetimeLocal(custom.date || ''));
syncDateTimeInputs();
newLocationInput.value = custom.location || '';
newSportInput.value = custom.sport || 'basketball';
newLevelInput.value = custom.level || 'HS';
newGenderInput.value = custom.gender || '';
		}
	});

saveBtn.addEventListener('click', ()=>{
	const id = String(matchSelect.value || ''); if(!id){ alert('Select a match'); return; }
	const all = getAll();
	all[id] = all[id]||{};
	all[id].status = statusInput.value || 'scheduled';
	all[id].streamUrl = (streamInput.value || '').trim();
	all[id].streamUrl2 = (streamInput2.value || '').trim();
	const setNum = Number(setInput.value);
	if(Number.isFinite(setNum) && setNum>0) all[id].setNumber = setNum; else delete all[id].setNumber;
	all[id].note = noteInput.value || '';
	const hs = Number(homeInput.value); const as = Number(awayInput.value);
	all[id].homeScore = Number.isFinite(hs)?hs:0; all[id].awayScore = Number.isFinite(as)?as:0;
	setAll(all); refreshJson(); alert('Saved'); window.dispatchEvent(new Event('storage'));
});

clearBtn.addEventListener('click', ()=>{
	const id = String(matchSelect.value || ''); if(!id){ alert('Select a match'); return; }
	const all = getAll(); delete all[id]; setAll(all); refreshJson(); alert('Cleared');
});

copyBtn.addEventListener('click', ()=>{
	jsonArea.select(); try{ document.execCommand('copy'); alert('Copied to clipboard'); }catch(e){ alert('Copy failed'); }
});

	addMatchBtn?.addEventListener('click', async ()=>{
		syncDateTimeInputs();
		const home = getHomeTeamValue();
		const away = getAwayTeamValue();
		const date = toDisplayDate(newDateInput?.value || '');
		const location = (newLocationInput?.value || '').trim();
		const sport = (newSportInput?.value || 'basketball').trim().toLowerCase();
		const level = (newLevelInput?.value || 'HS').trim().toUpperCase();
		const gender = (newGenderInput?.value || '').trim();
		if (!home || !away || !date) {
alert('Home, Away, and Date/Time are required.');
return;
		}
		const nextId = getNextMatchId();
		const nextMatch = normalizeCustomMatch({ id: nextId, home, away, date, location, sport, level, gender });
		if (!nextMatch) {
alert('Invalid custom match data.');
return;
		}
		if (isDuplicateMatch(nextMatch)) {
alert('A match with the same Home/Away/Date already exists.');
return;
		}
		try {
await saveCustomMatch(nextMatch);
		} catch (e) {
console.error(e);
alert('Failed to save custom match.');
return;
		}
		populateMatchSelect();
		matchSelect.value = String(nextId);
		clearMatchForm();
		alert(`Custom match added (#${nextId})`);
	});

	updateMatchBtn?.addEventListener('click', async ()=>{
		const selectedId = Number(matchSelect.value || '');
		if (!Number.isFinite(selectedId)) { alert('Select a match'); return; }
		const existing = getCustomById(selectedId);
		if (!existing) { alert('Selected match is not a custom match.'); return; }
		syncDateTimeInputs();
		const home = getHomeTeamValue();
		const away = getAwayTeamValue();
		const date = toDisplayDate(newDateInput?.value || '');
		const location = (newLocationInput?.value || '').trim();
		const sport = (newSportInput?.value || 'basketball').trim().toLowerCase();
		const level = (newLevelInput?.value || 'HS').trim().toUpperCase();
		const gender = (newGenderInput?.value || '').trim();
		const nextMatch = normalizeCustomMatch({ id: selectedId, home, away, date, location, sport, level, gender });
		if (!nextMatch) { alert('Home, Away, and Date/Time are required.'); return; }
		if (isDuplicateMatch(nextMatch, selectedId)) {
alert('A match with the same Home/Away/Date already exists.');
return;
		}
		try {
await saveCustomMatch(nextMatch);
		} catch (e) {
console.error(e);
alert('Failed to update custom match.');
return;
		}
		populateMatchSelect();
		matchSelect.value = String(selectedId);
		alert(`Custom match updated (#${selectedId})`);
	});

	deleteMatchBtn?.addEventListener('click', async ()=>{
		const id = String(matchSelect.value || '');
		if (!id) { alert('Select a match'); return; }
		const custom = getCustomMatches();
	const next = custom.filter((m) => String(m.id) !== id);
	if (next.length === custom.length) {
alert('Selected match is not a custom match.');
return;
		}
		if (!confirm(`Delete custom match #${id}?`)) return;
		try {
await removeCustomMatch(id);
cleanupLocalMatchArtifacts(id);
await cleanupRemoteMatchArtifacts(id);
		} catch (e) {
console.error(e);
alert('Failed to delete custom match.');
return;
		}
		populateMatchSelect();
		clearMatchForm();
		alert(`Deleted custom match #${id}`);
	});

	finishBtn.addEventListener('click', async ()=>{
		const id = String(matchSelect.value || '');
		if(!id){ alert('Select a match'); return; }
	const hs = Number(homeInput.value); 
	const as = Number(awayInput.value);
	const homeScore = Number.isFinite(hs) ? hs : 0;
	const awayScore = Number.isFinite(as) ? as : 0;
	
	if (db) {
		try {
await db.collection('finishedMatches').doc(id).set({
	finished: true,
	homeScore,
	awayScore,
	finishedAt: new Date().toISOString()
});
alert('Match marked as finished (saved to Firebase)');
		} catch(e) {
console.error(e);
const finished = readJson(FINISHED_KEY, {});
finished[id] = { finished: true, homeScore, awayScore, finishedAt: new Date().toISOString() };
writeJson(FINISHED_KEY, finished);
alert('Match marked as finished (saved in browser storage)');
		}
	} else {
		const finished = readJson(FINISHED_KEY, {});
		finished[id] = { finished: true, homeScore, awayScore, finishedAt: new Date().toISOString() };
		writeJson(FINISHED_KEY, finished);
		alert('Match marked as finished (saved in browser storage)');
	}
});

resetBtn.addEventListener('click', async ()=>{
	const id = String(matchSelect.value || '');
	if(!id){ alert('Select a match'); return; }
	if(!confirm('Revert this match to Upcoming?')) return;
	
	if (db) {
		try {
await db.collection('finishedMatches').doc(id).delete();
alert('Match reverted to Upcoming (Firebase)');
		} catch(e) {
console.error(e);
const finished = readJson(FINISHED_KEY, {});
delete finished[id];
writeJson(FINISHED_KEY, finished);
alert('Match reverted to Upcoming (browser storage)');
		}
	} else {
		const finished = readJson(FINISHED_KEY, {});
		delete finished[id];
		writeJson(FINISHED_KEY, finished);
		alert('Match reverted to Upcoming (browser storage)');
	}
	});

	// initialize
	jsonArea.addEventListener('input', ()=>{
		try{ const parsed = JSON.parse(jsonArea.value); setAll(parsed); }catch(e){}
	});
	try {
		const currentUrl = new URL(window.location.href);
		if (!document.documentElement.classList.contains('in-iframe') && currentUrl.searchParams.get('admin') === '1') {
			currentUrl.searchParams.delete('admin');
			history.replaceState(null, '', currentUrl.toString());
			requestAnimationFrame(() => adminToggle?.click());
		}
	} catch (e) {}
	if (matchSelect.value) {
		matchSelect.dispatchEvent(new Event('change'));
	}
})();

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
	const FORMATION_KEY = 'bis_formations';
	const FORMATION_COLLECTION = 'matchFormations';
	const CUSTOM_MATCH_COLLECTION = 'customMatches';
	const ADMIN_AUTH_PENDING_KEY = 'bis_admin_open_after_auth';
	const ADMIN_EMAILS = ['iamsunwo@gmail.com', 'tcassell@bisce.net', 'athletics@bisce.net', '30ekim@bisce.net', '30epark@bisce.net'];
	const defaultFormations = {
		volleyball: {
			home: [
				{ number: 1, name: 'Setter', playerName: '', x: 15, y: 30 },
				{ number: 2, name: 'Libero', playerName: '', x: 8, y: 50 },
				{ number: 3, name: 'Outside', playerName: '', x: 15, y: 70 },
				{ number: 4, name: 'Opposite', playerName: '', x: 35, y: 30 },
				{ number: 5, name: 'Middle', playerName: '', x: 35, y: 50 },
				{ number: 6, name: 'Outside2', playerName: '', x: 35, y: 70 }
			],
			away: [
				{ number: 1, name: 'Setter', playerName: '', x: 85, y: 70 },
				{ number: 2, name: 'Libero', playerName: '', x: 92, y: 50 },
				{ number: 3, name: 'Outside', playerName: '', x: 85, y: 30 },
				{ number: 4, name: 'Opposite', playerName: '', x: 65, y: 70 },
				{ number: 5, name: 'Middle', playerName: '', x: 65, y: 50 },
				{ number: 6, name: 'Outside2', playerName: '', x: 65, y: 30 }
			]
		},
		basketball: {
			home: [
				{ number: 1, name: 'PG', playerName: '', x: 25, y: 50 },
				{ number: 2, name: 'SG', playerName: '', x: 35, y: 25 },
				{ number: 3, name: 'SF', playerName: '', x: 35, y: 75 },
				{ number: 4, name: 'PF', playerName: '', x: 15, y: 30 },
				{ number: 5, name: 'C', playerName: '', x: 15, y: 70 }
			],
			away: [
				{ number: 1, name: 'PG', playerName: '', x: 75, y: 50 },
				{ number: 2, name: 'SG', playerName: '', x: 65, y: 75 },
				{ number: 3, name: 'SF', playerName: '', x: 65, y: 25 },
				{ number: 4, name: 'PF', playerName: '', x: 85, y: 70 },
				{ number: 5, name: 'C', playerName: '', x: 85, y: 30 }
			]
		},
		soccer: {
			home: [
				{ number: 1, name: 'GK', playerName: '', x: 5, y: 50 },
				{ number: 2, name: 'RB', playerName: '', x: 18, y: 15 },
				{ number: 3, name: 'CB', playerName: '', x: 15, y: 35 },
				{ number: 4, name: 'CB', playerName: '', x: 15, y: 65 },
				{ number: 5, name: 'LB', playerName: '', x: 18, y: 85 },
				{ number: 6, name: 'CDM', playerName: '', x: 30, y: 50 },
				{ number: 7, name: 'RM', playerName: '', x: 38, y: 20 },
				{ number: 8, name: 'CM', playerName: '', x: 38, y: 50 },
				{ number: 9, name: 'LM', playerName: '', x: 38, y: 80 },
				{ number: 10, name: 'ST', playerName: '', x: 48, y: 35 },
				{ number: 11, name: 'ST', playerName: '', x: 48, y: 65 }
			],
			away: [
				{ number: 1, name: 'GK', playerName: '', x: 95, y: 50 },
				{ number: 2, name: 'LB', playerName: '', x: 82, y: 85 },
				{ number: 3, name: 'CB', playerName: '', x: 85, y: 65 },
				{ number: 4, name: 'CB', playerName: '', x: 85, y: 35 },
				{ number: 5, name: 'RB', playerName: '', x: 82, y: 15 },
				{ number: 6, name: 'CDM', playerName: '', x: 70, y: 50 },
				{ number: 7, name: 'LM', playerName: '', x: 62, y: 80 },
				{ number: 8, name: 'CM', playerName: '', x: 62, y: 50 },
				{ number: 9, name: 'RM', playerName: '', x: 62, y: 20 },
				{ number: 10, name: 'ST', playerName: '', x: 52, y: 65 },
				{ number: 11, name: 'ST', playerName: '', x: 52, y: 35 }
			]
		}
	};
	// Only approved Google accounts can use admin features.
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
	let auth = null;
	let authReadyPromise = Promise.resolve(null);
	let formationUnsubscribe = null;
	const firebaseConfig = window.BIS_FIREBASE_CONFIG || {};
	if (firebaseConfig.apiKey && window.firebase) {
		try {
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
db = firebase.firestore();
			if (typeof firebase.auth === 'function') {
				auth = firebase.auth();
				authReadyPromise = new Promise((resolve) => {
					const unsubscribe = auth.onAuthStateChanged((user) => {
						unsubscribe();
						resolve(user || null);
					}, () => resolve(null));
				});
			}
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
	const hasSessionFlag = (key) => readStoredValue(key) === '1';
	const setSessionFlag = (key, enabled) => {
		if (enabled) writeStoredValue(key, '1');
		else removeStoredValue(key);
	};
	const sha256Fallback = (str) => {
		const rightRotate = (value, amount) => (value >>> amount) | (value << (32 - amount));
		const mathPow = Math.pow;
		const maxWord = mathPow(2, 32);
		const words = [];
		const ascii = unescape(encodeURIComponent(str));
		const bitLength = ascii.length * 8;
		const hash = [];
		const k = [];
		let primeCounter = 0;

		const isPrime = (n) => {
			for (let i = 2; i * i <= n; i += 1) {
				if (n % i === 0) return false;
			}
			return true;
		};

		for (let candidate = 2; primeCounter < 64; candidate += 1) {
			if (!isPrime(candidate)) continue;
			if (primeCounter < 8) {
				hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
			}
			k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
			primeCounter += 1;
		}

		for (let i = 0; i < ascii.length; i += 1) {
			words[i >> 2] |= ascii.charCodeAt(i) << ((3 - (i % 4)) * 8);
		}
		words[bitLength >> 5] |= 0x80 << (24 - (bitLength % 32));
		words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;

		for (let j = 0; j < words.length; j += 16) {
			const w = words.slice(j, j + 16);
			const oldHash = hash.slice(0);
			for (let i = 0; i < 64; i += 1) {
				const w15 = w[i - 15];
				const w2 = w[i - 2];
				const a = hash[0];
				const e = hash[4];
				let temp1;
				let temp2;

				if (i < 16) {
					w[i] = w[i] | 0;
				} else {
					const gamma0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
					const gamma1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
					w[i] = (((w[i - 16] + gamma0) | 0) + ((w[i - 7] + gamma1) | 0)) | 0;
				}

				const ch = (e & hash[5]) ^ (~e & hash[6]);
				const maj = (a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]);
				const sigma0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
				const sigma1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
				temp1 = (hash[7] + sigma1 + ch + k[i] + w[i]) | 0;
				temp2 = (sigma0 + maj) | 0;

				hash[7] = hash[6];
				hash[6] = hash[5];
				hash[5] = hash[4];
				hash[4] = (hash[3] + temp1) | 0;
				hash[3] = hash[2];
				hash[2] = hash[1];
				hash[1] = hash[0];
				hash[0] = (temp1 + temp2) | 0;
			}

			for (let i = 0; i < 8; i += 1) {
				hash[i] = (hash[i] + oldHash[i]) | 0;
			}
		}

		return hash.map((value) => (value >>> 0).toString(16).padStart(8, '0')).join('');
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
	const normalizeSportValue = (sport) => {
		const next = normalizeText(sport);
		if (next === 'basketball' || next === 'volleyball' || next === 'soccer') return next;
		return 'soccer';
	};
	const cloneDeep = (value) => JSON.parse(JSON.stringify(value));
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
level: (m?.level || 'HS').toString().trim(),
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
	const getAllFormations = () => readJson(FORMATION_KEY, {});
	const formationDocId = (matchId, sport) => `${String(matchId)}_${normalizeSportValue(sport)}`;
	const queueFormationRemoteSave = async (matchId, sport, formation) => {
		if (!db) return false;
		try {
			await db.collection(FORMATION_COLLECTION).doc(formationDocId(matchId, sport)).set({
				sport: normalizeSportValue(sport),
				home: Array.isArray(formation?.home) ? formation.home : [],
				away: Array.isArray(formation?.away) ? formation.away : [],
				updatedAt: new Date().toISOString(),
				updatedBy: ''
			}, { merge: true });
			return true;
		} catch (error) {
			console.error('formation remote save error', error);
			return false;
		}
	};
	const subscribeFormation = (matchId, sport) => {
		if (formationUnsubscribe) {
			formationUnsubscribe();
			formationUnsubscribe = null;
		}
		if (!db || !Number.isFinite(Number(matchId))) return;
		formationUnsubscribe = db.collection(FORMATION_COLLECTION).doc(formationDocId(matchId, sport)).onSnapshot((doc) => {
			if (!doc.exists) return;
			const data = doc.data() || {};
			const all = getAllFormations();
			const key = String(matchId);
			if (!all[key]) all[key] = {};
			all[key][normalizeSportValue(sport)] = {
				home: Array.isArray(data.home) ? data.home : [],
				away: Array.isArray(data.away) ? data.away : []
			};
			writeJson(FORMATION_KEY, all);
			loadFormationEditor();
		}, (error) => {
			console.error('formation listen error', error);
		});
	};
	const getFormationForMatch = (matchId, sport) => {
		const all = getAllFormations();
		const matchData = all[String(matchId)] || {};
		return matchData[normalizeSportValue(sport)] || null;
	};
	const saveFormationForMatch = (matchId, sport, formation) => {
		const all = getAllFormations();
		const key = String(matchId);
		if (!all[key]) all[key] = {};
		all[key][normalizeSportValue(sport)] = formation;
		writeJson(FORMATION_KEY, all);
		return queueFormationRemoteSave(matchId, sport, formation);
	};
	const getDeletedMatchIds = () => new Set(readJson('bis_deleted_matches', []).map(String));
	const getAllMatches = () => {
		const deleted = getDeletedMatchIds();
		const all = [...SCHEDULES, ...getCustomMatches()];
		const seen = new Set();
		return all.filter((m) => {
const id = Number(m?.id);
if (!Number.isFinite(id) || seen.has(id)) return false;
if (deleted.has(String(id))) return false;
seen.add(id);
return true;
		}).sort((a, b) => {
			const da = toDatetimeLocal(a.date) || '';
			const db = toDatetimeLocal(b.date) || '';
			if (da < db) return -1;
			if (da > db) return 1;
			return 0;
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
		return now.getFullYear();
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
	const adminFormationSummary = $('#adminFormationSummary');
	const adminFormationSportBadge = $('#adminFormationSportBadge');
	const adminFormationTeam = $('#adminFormationTeam');
	const adminFormationPlayers = $('#adminFormationPlayers');
	const adminFormationAddBtn = $('#adminFormationAddBtn');
	const adminFormationSaveBtn = $('#adminFormationSaveBtn');
	const adminFormationResetBtn = $('#adminFormationResetBtn');
	const customMatchSearchInput = $('#adminCustomMatchSearch');
	const customMatchSearchInfo = $('#adminCustomMatchSearchInfo');
	const customMatchSelect = $('#adminCustomMatchSelect');
	const addMatchBtn = $('#adminAddMatchBtn');
	const updateMatchBtn = $('#adminUpdateMatchBtn');
	const deleteMatchBtn = $('#adminDeleteMatchBtn');
	const finishBtn = $('#adminFinishBtn');
	const resetBtn = $('#adminResetBtn');
	const adminMenuButtons = Array.from(document.querySelectorAll('[data-admin-menu-btn]'));
	const adminMenuSections = Array.from(document.querySelectorAll('[data-admin-menu-section]'));
	let formationDraft = null;

	const switchAdminSection = (sectionKey) => {
		adminMenuButtons.forEach((button) => {
			button.classList.toggle('active', button.dataset.adminMenuBtn === sectionKey);
		});
		adminMenuSections.forEach((section) => {
			section.classList.toggle('active', section.dataset.adminMenuSection === sectionKey);
		});
	};
	adminMenuButtons.forEach((button) => {
		button.addEventListener('click', () => switchAdminSection(button.dataset.adminMenuBtn || 'live'));
	});
	switchAdminSection('live');

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
	const applyCustomMatchToForm = (custom) => {
		if (!custom) {
			clearMatchForm();
			return;
		}
		setTeamSelect(newHomeInput, newHomeCustomInput, custom.home || '');
		setTeamSelect(newAwayInput, newAwayCustomInput, custom.away || '');
		setDateTimeInputs(toDatetimeLocal(custom.date || ''));
		syncDateTimeInputs();
		newLocationInput.value = custom.location || '';
		newSportInput.value = custom.sport || 'basketball';
		newLevelInput.value = custom.level || 'HS';
		newGenderInput.value = custom.gender || '';
	};
	const isUpcomingMatch = (match) => {
		if (!match || match.presetPast) return false;
		const dtl = toDatetimeLocal(match.date);
		if (!dtl) return true;
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const matchDate = new Date(dtl);
		matchDate.setHours(0, 0, 0, 0);
		return matchDate >= now;
	};
	const buildMatchOptionLabel = (match, isCustom) => {
		const shortDate = formatShortDate(match.date);
		const tag = isCustom ? ' [custom]' : '';
		return `${match.home} vs ${match.away} (#${match.id}) — ${shortDate}${tag}`;
	};
	const getFormationPlayerLimit = (sport) => {
		if (sport === 'volleyball') return 6;
		if (sport === 'basketball') return 5;
		return 11;
	};
	const getSportPresentation = (sport) => {
		if (sport === 'basketball') return { emoji: '🏀', label: 'Basketball' };
		if (sport === 'volleyball') return { emoji: '🏐', label: 'Volleyball' };
		return { emoji: '⚽', label: 'Soccer' };
	};
	const getSelectedMatchRecord = () => getAllMatches().find((m) => Number(m.id) === Number(matchSelect?.value || '')) || null;
	const updateFormationSummary = () => {
		const selected = getSelectedMatchRecord();
		if (!selected) {
			if (adminFormationSummary) adminFormationSummary.textContent = 'Select a match to edit its formation.';
			if (adminFormationSportBadge) adminFormationSportBadge.textContent = 'Sport';
			return;
		}
		const sport = normalizeSportValue(selected.sport);
		const info = getSportPresentation(sport);
		if (adminFormationSummary) {
			adminFormationSummary.textContent = `${selected.home} vs ${selected.away} formation for this ${info.label.toLowerCase()} match.`;
		}
		if (adminFormationSportBadge) {
			adminFormationSportBadge.textContent = `${info.emoji} ${info.label}`;
		}
		if (adminFormationTeam) {
			const homeOption = adminFormationTeam.querySelector('option[value="home"]');
			const awayOption = adminFormationTeam.querySelector('option[value="away"]');
			if (homeOption) homeOption.textContent = selected.home || 'Home';
			if (awayOption) awayOption.textContent = selected.away || 'Away';
		}
	};
	const adminFormationVisual = $('#adminFormationVisual');
	const adminFormationCourt = $('#adminFormationCourt');
	const adminFormationPopover = $('#adminFormationPopover');
	const adminPopoverNumber = $('#adminPopoverNumber');
	const adminPopoverRole = $('#adminPopoverRole');
	const adminPopoverName = $('#adminPopoverName');
	const adminPopoverDone = $('#adminPopoverDone');
	const adminPopoverDelete = $('#adminPopoverDelete');
	const adminFormationViewMode = $('#adminFormationViewMode');
	let visualSelectedIdx = -1;

	const courtLinesSVG = {
		volleyball: `<svg class="court-lines" viewBox="0 0 200 100" preserveAspectRatio="none">
			<rect x="4" y="4" width="192" height="92" rx="2" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1"/>
			<line x1="100" y1="4" x2="100" y2="96" stroke="white" stroke-width="2"/>
			<line x1="66" y1="4" x2="66" y2="96" stroke="rgba(255,255,255,0.5)" stroke-width="0.8"/>
			<line x1="134" y1="4" x2="134" y2="96" stroke="rgba(255,255,255,0.5)" stroke-width="0.8"/>
		</svg>`,
		basketball: `<svg class="court-lines" viewBox="0 0 188 100" preserveAspectRatio="none">
			<line x1="94" y1="0" x2="94" y2="100" stroke="rgba(139,69,19,0.45)" stroke-width="1"/>
			<circle cx="94" cy="50" r="12" fill="none" stroke="rgba(139,69,19,0.45)" stroke-width="1"/>
			<rect x="0" y="25" width="26" height="50" rx="0" fill="rgba(139,69,19,0.06)" stroke="rgba(139,69,19,0.45)" stroke-width="1"/>
			<rect x="162" y="25" width="26" height="50" rx="0" fill="rgba(139,69,19,0.06)" stroke="rgba(139,69,19,0.45)" stroke-width="1"/>
			<path d="M0,12 Q42,50 0,88" fill="none" stroke="rgba(139,69,19,0.45)" stroke-width="1"/>
			<path d="M188,12 Q146,50 188,88" fill="none" stroke="rgba(139,69,19,0.45)" stroke-width="1"/>
			<circle cx="6" cy="50" r="3" fill="#DC2626"/>
			<circle cx="182" cy="50" r="3" fill="#DC2626"/>
		</svg>`,
		soccer: `<svg class="court-lines" viewBox="0 0 150 100" preserveAspectRatio="none">
			<rect x="4" y="4" width="142" height="92" rx="1" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1"/>
			<line x1="75" y1="4" x2="75" y2="96" stroke="rgba(255,255,255,0.6)" stroke-width="1"/>
			<circle cx="75" cy="50" r="14" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1"/>
			<circle cx="75" cy="50" r="2" fill="rgba(255,255,255,0.8)"/>
			<rect x="4" y="18" width="22" height="64" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1"/>
			<rect x="124" y="18" width="22" height="64" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1"/>
			<rect x="4" y="35" width="8" height="30" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1"/>
			<rect x="138" y="35" width="8" height="30" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1"/>
			<rect x="2" y="42" width="2" height="16" rx="1" fill="white"/>
			<rect x="146" y="42" width="2" height="16" rx="1" fill="white"/>
		</svg>`
	};

	const getCourtClass = (sport) => {
		if (sport === 'volleyball') return 'admin-court admin-court-volleyball';
		if (sport === 'basketball') return 'admin-court admin-court-basketball';
		return 'admin-court admin-court-soccer';
	};

	const closePopover = () => {
		if (adminFormationPopover) adminFormationPopover.style.display = 'none';
		visualSelectedIdx = -1;
		adminFormationCourt?.querySelectorAll('.fm-dot.fm-selected').forEach(d => d.classList.remove('fm-selected'));
	};

	const openPopover = (idx) => {
		const teamKey = adminFormationTeam?.value || 'home';
		const player = formationDraft?.data?.[teamKey]?.[idx];
		if (!player || !adminFormationPopover) return;
		visualSelectedIdx = idx;
		adminPopoverNumber.value = player.number ?? '';
		adminPopoverRole.value = player.name || '';
		adminPopoverName.value = player.playerName || '';
		adminFormationPopover.style.display = '';
		adminFormationCourt?.querySelectorAll('.fm-dot').forEach((d, i) => {
			d.classList.toggle('fm-selected', i === idx);
		});
	};

	adminPopoverDone?.addEventListener('click', () => {
		if (visualSelectedIdx < 0) { closePopover(); return; }
		const teamKey = adminFormationTeam?.value || 'home';
		const player = formationDraft?.data?.[teamKey]?.[visualSelectedIdx];
		if (player) {
			player.number = Number(adminPopoverNumber.value) || 0;
			player.name = (adminPopoverRole.value || '').trim();
			player.playerName = (adminPopoverName.value || '').trim();
		}
		closePopover();
		renderFormationEditor();
	});

	adminPopoverDelete?.addEventListener('click', () => {
		if (visualSelectedIdx < 0) { closePopover(); return; }
		const teamKey = adminFormationTeam?.value || 'home';
		formationDraft?.data?.[teamKey]?.splice(visualSelectedIdx, 1);
		closePopover();
		renderFormationEditor();
	});

	adminFormationViewMode?.addEventListener('change', () => {
		const isVisual = adminFormationViewMode.value === 'visual';
		if (adminFormationVisual) adminFormationVisual.style.display = isVisual ? '' : 'none';
		if (adminFormationPlayers) adminFormationPlayers.style.display = isVisual ? 'none' : '';
		if (!isVisual) closePopover();
		renderFormationEditor();
	});

	const renderFormationEditor = () => {
		updateFormationSummary();
		const selected = getSelectedMatchRecord();
		const isVisual = adminFormationViewMode?.value !== 'list';

		if (!selected) {
			if (adminFormationCourt) adminFormationCourt.innerHTML = '<div class="admin-formation-court-empty">Select a match to edit formation</div>';
			if (adminFormationPlayers) adminFormationPlayers.innerHTML = '<div class="admin-formation-note">Select a match first.</div>';
			if (adminFormationAddBtn) adminFormationAddBtn.disabled = true;
			if (adminFormationSaveBtn) adminFormationSaveBtn.disabled = true;
			if (adminFormationResetBtn) adminFormationResetBtn.disabled = true;
			closePopover();
			return;
		}

		const sport = normalizeSportValue(selected.sport);
		const teamKey = adminFormationTeam?.value || 'home';
		const players = formationDraft?.data?.[teamKey] || [];
		const limit = getFormationPlayerLimit(sport);
		if (adminFormationAddBtn) adminFormationAddBtn.disabled = players.length >= limit;
		if (adminFormationSaveBtn) adminFormationSaveBtn.disabled = false;
		if (adminFormationResetBtn) adminFormationResetBtn.disabled = false;

		// ── Visual mode ──
		if (isVisual && adminFormationCourt) {
			const courtEl = document.createElement('div');
			courtEl.className = getCourtClass(sport);
			courtEl.innerHTML = courtLinesSVG[sport] || '';

			players.forEach((player, idx) => {
				const dot = document.createElement('div');
				dot.className = 'fm-dot ' + teamKey + (idx === visualSelectedIdx ? ' fm-selected' : '');
				dot.style.left = (player.x ?? 50) + '%';
				dot.style.top = (player.y ?? 50) + '%';
				dot.textContent = player.number ?? '';
				const label = document.createElement('span');
				label.className = 'fm-dot-label';
				label.textContent = player.playerName || player.name || '';
				dot.appendChild(label);
				dot.addEventListener('pointerdown', (e) => {
					e.preventDefault();
					e.stopPropagation();
					const courtRect = () => courtEl.getBoundingClientRect();
					let moved = false;
					const onMove = (ev) => {
						moved = true;
						const rect = courtRect();
						const nx = Math.min(100, Math.max(0, ((ev.clientX - rect.left) / rect.width) * 100));
						const ny = Math.min(100, Math.max(0, ((ev.clientY - rect.top) / rect.height) * 100));
						player.x = Math.round(nx * 10) / 10;
						player.y = Math.round(ny * 10) / 10;
						dot.style.left = player.x + '%';
						dot.style.top = player.y + '%';
					};
					const onUp = () => {
						document.removeEventListener('pointermove', onMove);
						document.removeEventListener('pointerup', onUp);
						if (!moved) {
							openPopover(idx);
						}
					};
					document.addEventListener('pointermove', onMove);
					document.addEventListener('pointerup', onUp);
				});
				courtEl.appendChild(dot);
			});

			// Also render "other team" dots as ghosts
			const otherKey = teamKey === 'home' ? 'away' : 'home';
			const otherPlayers = formationDraft?.data?.[otherKey] || [];
			otherPlayers.forEach((player) => {
				const ghost = document.createElement('div');
				ghost.className = 'fm-dot ' + otherKey;
				ghost.style.left = (player.x ?? 50) + '%';
				ghost.style.top = (player.y ?? 50) + '%';
				ghost.style.opacity = '0.25';
				ghost.style.pointerEvents = 'none';
				ghost.textContent = player.number ?? '';
				courtEl.appendChild(ghost);
			});

			adminFormationCourt.innerHTML = '';
			adminFormationCourt.appendChild(courtEl);
		}

		// ── List mode ──
		if (!isVisual && adminFormationPlayers) {
			adminFormationPlayers.innerHTML = players.map((player, index) => `
				<div class="admin-formation-player-row">
					<input class="admin-formation-input" data-formation-field="number" data-formation-index="${index}" type="number" min="0" placeholder="#" value="${player.number ?? ''}">
					<input class="admin-formation-input" data-formation-field="role" data-formation-index="${index}" type="text" placeholder="Position" value="${(player.name || '').replace(/"/g, '&quot;')}">
					<input class="admin-formation-input" data-formation-field="playerName" data-formation-index="${index}" type="text" placeholder="Player name" value="${(player.playerName || '').replace(/"/g, '&quot;')}">
					<input class="admin-formation-input" data-formation-field="x" data-formation-index="${index}" type="number" min="0" max="100" placeholder="X" value="${player.x ?? ''}">
					<input class="admin-formation-input" data-formation-field="y" data-formation-index="${index}" type="number" min="0" max="100" placeholder="Y" value="${player.y ?? ''}">
					<button class="theme-toggle admin-danger-btn admin-formation-delete" data-formation-delete="${index}" type="button">×</button>
				</div>
			`).join('');
			if (!players.length) {
				adminFormationPlayers.innerHTML = '<div class="admin-formation-note">No players added yet for this team.</div>';
			}
			adminFormationPlayers.querySelectorAll('[data-formation-field]').forEach((input) => {
				input.addEventListener('change', () => {
					const field = input.getAttribute('data-formation-field');
					const index = Number(input.getAttribute('data-formation-index'));
					const nextPlayer = formationDraft?.data?.[teamKey]?.[index];
					if (!nextPlayer) return;
					if (field === 'number') nextPlayer.number = Number(input.value) || 0;
					if (field === 'role') nextPlayer.name = (input.value || '').trim();
					if (field === 'playerName') nextPlayer.playerName = (input.value || '').trim();
					if (field === 'x') nextPlayer.x = Math.min(100, Math.max(0, Number(input.value) || 0));
					if (field === 'y') nextPlayer.y = Math.min(100, Math.max(0, Number(input.value) || 0));
				});
			});
			adminFormationPlayers.querySelectorAll('[data-formation-delete]').forEach((button) => {
				button.addEventListener('click', () => {
					const index = Number(button.getAttribute('data-formation-delete'));
					formationDraft?.data?.[teamKey]?.splice(index, 1);
					renderFormationEditor();
				});
			});
		}
	};
	const loadFormationEditor = () => {
		const selected = getSelectedMatchRecord();
		if (!selected) {
			formationDraft = null;
			renderFormationEditor();
			if (formationUnsubscribe) {
				formationUnsubscribe();
				formationUnsubscribe = null;
			}
			return;
		}
		const sport = normalizeSportValue(selected.sport);
		const saved = getFormationForMatch(selected.id, sport);
		formationDraft = {
			matchId: String(selected.id),
			sport,
			data: cloneDeep(saved || defaultFormations[sport])
		};
		if (adminFormationTeam && !['home', 'away'].includes(adminFormationTeam.value)) {
			adminFormationTeam.value = 'home';
		}
		subscribeFormation(selected.id, sport);
		renderFormationEditor();
	};
	const getCustomMatchSearchQuery = () => normalizeText(customMatchSearchInput?.value || '');
	const getMatchById = (id) => getAllMatches().find((m) => Number(m.id) === Number(id)) || null;
	const getFilteredAllMatches = () => {
		const query = getCustomMatchSearchQuery();
		const matches = getAllMatches().filter((match) => activeMatchFilter === 'past' ? !isUpcomingMatch(match) : isUpcomingMatch(match));
		const filtered = !query ? matches : matches.filter((match) => {
			const haystack = [
				match.id,
				match.home,
				match.away,
				match.date,
				match.location,
				match.sport,
				match.level,
				match.gender
			].map((value) => normalizeText(value)).join(' ');
			return haystack.includes(query);
		});
		return filtered.sort((a, b) => {
			const aDate = toDatetimeLocal(a.date) || '';
			const bDate = toDatetimeLocal(b.date) || '';
			return activeMatchFilter === 'past' ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate);
		});
	};
	const populateMatchSelect = () => {
		if(!matchSelect) return;
		const current = String(matchSelect.value || '');
		matchSelect.innerHTML = '';
	const cIds = new Set(getCustomMatches().map((m) => String(m.id)));
	getAllMatches().forEach((s)=>{
		const opt = document.createElement('option');
		opt.value = String(s.id);
		opt.textContent = buildMatchOptionLabel(s, cIds.has(String(s.id)));
matchSelect.appendChild(opt);
		});
		if (current && matchSelect.querySelector(`option[value="${current}"]`)) matchSelect.value = current;
	};

	/* ── Match sidebar (Discord-style) ── */
	const matchListEl = document.getElementById('adminMatchList');
	const matchDetailEl = document.getElementById('adminMatchDetail');
	const matchDetailEmpty = document.getElementById('adminMatchDetailEmpty');
	const matchDetailForm = document.getElementById('adminMatchDetailForm');
	const matchDetailTitle = document.getElementById('adminMatchDetailTitle');
	const matchDetailBadge = document.getElementById('adminMatchDetailBadge');
	const matchFilterButtons = Array.from(document.querySelectorAll('[data-match-filter]'));
	let selectedMatchId = null;
	let isNewMatchMode = false;
	let activeMatchFilter = 'upcoming';

	const sportEmoji = (sport) => {
		if (sport === 'basketball') return '🏀';
		if (sport === 'volleyball') return '🏐';
		return '⚽';
	};

	const renderMatchList = () => {
		if (!matchListEl) return;
		const filteredMatches = getFilteredAllMatches();
		const allInStatus = getAllMatches().filter((match) => activeMatchFilter === 'past' ? !isUpcomingMatch(match) : isUpcomingMatch(match));
		const cIds = new Set(getCustomMatches().map((m) => String(m.id)));
		matchFilterButtons.forEach((button) => {
			const selected = button.dataset.matchFilter === activeMatchFilter;
			button.classList.toggle('active', selected);
			button.setAttribute('aria-selected', String(selected));
		});
		matchListEl.innerHTML = '';
		filteredMatches.forEach((match) => {
			const item = document.createElement('div');
			item.className = 'admin-match-item' + (String(match.id) === String(selectedMatchId) && !isNewMatchMode ? ' active' : '');
			const isCustom = cIds.has(String(match.id));
			item.innerHTML =
				'<div class="admin-match-item-sport">' + sportEmoji(match.sport) + '</div>' +
				'<div class="admin-match-item-info">' +
					'<div class="admin-match-item-teams">' + escHTML(match.home) + ' vs ' + escHTML(match.away) + '</div>' +
					'<div class="admin-match-item-date">' + escHTML(formatShortDate(match.date)) + ' · ' + escHTML(match.level || '') + (match.gender ? ' · ' + escHTML(match.gender) : '') + '</div>' +
				'</div>' +
				(isCustom ? '<div class="admin-match-item-tag">custom</div>' : '');
			item.addEventListener('click', () => selectMatch(match.id));
			matchListEl.appendChild(item);
		});
		if (customMatchSearchInfo) {
			const query = getCustomMatchSearchQuery();
			const statusLabel = activeMatchFilter === 'past' ? 'past' : 'upcoming';
			customMatchSearchInfo.textContent = query
				? filteredMatches.length + ' / ' + allInStatus.length + ' ' + statusLabel + ' matches'
				: allInStatus.length + ' ' + statusLabel + ' matches';
		}
	};

	const escHTML = (v) => (v || '').toString()
		.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

	const saveNewMatchBtn = document.getElementById('adminSaveNewMatchBtn');

	const selectMatch = (id) => {
		isNewMatchMode = false;
		selectedMatchId = String(id);
		const match = getMatchById(id);
		if (!match) return;
		if (matchDetailEmpty) matchDetailEmpty.style.display = 'none';
		if (matchDetailForm) matchDetailForm.style.display = 'grid';
		if (matchDetailTitle) matchDetailTitle.textContent = match.home + ' vs ' + match.away;
		if (matchDetailBadge) matchDetailBadge.textContent = sportEmoji(match.sport) + ' ' + (match.level || '') + (match.gender ? ' · ' + match.gender : '') + ' · #' + match.id;
		if (saveNewMatchBtn) saveNewMatchBtn.style.display = 'none';
		if (updateMatchBtn) updateMatchBtn.style.display = '';
		if (deleteMatchBtn) deleteMatchBtn.style.display = '';
		applyCustomMatchToForm(match);
		renderMatchList();
	};

	const showNewMatchForm = () => {
		isNewMatchMode = true;
		selectedMatchId = null;
		if (matchDetailEmpty) matchDetailEmpty.style.display = 'none';
		if (matchDetailForm) matchDetailForm.style.display = 'grid';
		if (matchDetailTitle) matchDetailTitle.textContent = '📅 New Match';
		if (matchDetailBadge) matchDetailBadge.textContent = 'Adding a new match';
		if (saveNewMatchBtn) saveNewMatchBtn.style.display = '';
		if (updateMatchBtn) updateMatchBtn.style.display = 'none';
		if (deleteMatchBtn) deleteMatchBtn.style.display = 'none';
		clearMatchForm();
		renderMatchList();
	};

	const showEmptyState = () => {
		isNewMatchMode = false;
		selectedMatchId = null;
		if (matchDetailEmpty) matchDetailEmpty.style.display = 'flex';
		if (matchDetailForm) matchDetailForm.style.display = 'none';
		renderMatchList();
	};

	// Also populate the hidden select for compatibility with live match control
	const populateCustomMatchSelect = () => {
		if (!customMatchSelect) return;
		customMatchSelect.innerHTML = '';
		const cIds = new Set(getCustomMatches().map((m) => String(m.id)));
		getAllMatches().forEach((match) => {
			const opt = document.createElement('option');
			opt.value = String(match.id);
			opt.textContent = buildMatchOptionLabel(match, cIds.has(String(match.id)));
			customMatchSelect.appendChild(opt);
		});
	};

	populateMatchSelect();
	populateCustomMatchSelect();
	renderMatchList();

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
		// Remove from deleted list if it was previously deleted
		const deletedList = readJson('bis_deleted_matches', []);
		const matchIdStr = String(match.id);
		const filteredDeleted = deletedList.filter((d) => String(d) !== matchIdStr);
		if (filteredDeleted.length !== deletedList.length) {
			writeJson('bis_deleted_matches', filteredDeleted);
			if (db) {
				try { await db.collection('deletedMatches').doc(matchIdStr).delete(); } catch(_){}
			}
		}
		if (db) {
await db.collection(CUSTOM_MATCH_COLLECTION).doc(matchIdStr).set(match, { merge: true });
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
			populateCustomMatchSelect();
			renderMatchList();
		});
	};
	syncCustomMatchesFromFirebase();

	const syncDeletedMatchesFromFirebase = () => {
		if (!db) return;
		db.collection('deletedMatches').onSnapshot((snap) => {
			const ids = [];
			snap.forEach((doc) => ids.push(doc.id));
			writeJson('bis_deleted_matches', ids);
			populateMatchSelect();
			populateCustomMatchSelect();
			renderMatchList();
		});
	};
	syncDeletedMatchesFromFirebase();

	const syncLiveScoresFromFirebase = () => {
		if (!db) return;
		db.collection('liveScores').onSnapshot((snap) => {
			const all = getAll();
			const remoteIds = new Set();
			snap.forEach((doc) => {
				remoteIds.add(doc.id);
				all[doc.id] = doc.data() || {};
			});
			setAll(all);
			window.dispatchEvent(new Event('storage'));
		});
	};
	syncLiveScoresFromFirebase();

	const normalizeAdminEmail = (value) => (value || '').toString().trim().toLowerCase();
	const isAllowedAdminEmail = (value) => ADMIN_EMAILS.includes(normalizeAdminEmail(value));
	const isAuthorizedAdminUser = (user) => Boolean(user && isAllowedAdminEmail(user.email));
	const waitForAdminUser = (timeoutMs = 2500) => new Promise((resolve) => {
		if (!auth) { resolve(null); return; }
		let settled = false;
		const finish = (user) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			unsubscribe();
			resolve(user || null);
		};
		const unsubscribe = auth.onAuthStateChanged((user) => {
			if (!user) return;
			finish(user);
		}, () => finish(null));
		const timer = setTimeout(() => finish(auth.currentUser || null), timeoutMs);
	});
	const getResolvedAdminUser = async () => {
		if (!auth) return null;
		if (auth.currentUser) return auth.currentUser;
		try {
			const readyUser = await authReadyPromise;
			if (readyUser) return readyUser;
		} catch (error) {
			// Fall through to a short live wait below.
		}
		const nextUser = await waitForAdminUser();
		return nextUser || auth.currentUser || null;
	};
	const openAdminPanel = () => {
		if (!adminBody || !adminToggle) return;
		adminBody.style.display = 'block';
		adminToggle.textContent = 'Close';
		refreshJson();
	};
	const maybeAutoOpenAdminPanel = async () => {
		if (!hasSessionFlag(ADMIN_AUTH_PENDING_KEY)) return;
		const currentUser = await getResolvedAdminUser();
		if (!isAuthorizedAdminUser(currentUser)) return;
		setSessionFlag(ADMIN_AUTH_PENDING_KEY, false);
		openAdminPanel();
	};
	function ensureAdminPassModal() {
		if (document.getElementById('adminPassModal')) return;
		const modal = document.createElement('div');
		modal.id = 'adminPassModal';
		modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,0.5);align-items:center;justify-content:center;padding:24px';
		modal.innerHTML = `
			<div style="background:#fff;border-radius:16px;padding:28px 24px;max-width:360px;width:100%;box-shadow:0 30px 60px rgba(0,0,0,0.3);border:1px solid rgba(148,163,184,0.2)">
				<div style="font-weight:800;font-size:16px;margin-bottom:4px">Admin Login</div>
				<div style="font-size:13px;color:#64748b;margin-bottom:16px">Sign in with your admin account</div>
				<input id="adminPassEmail" type="email" placeholder="Email" autocomplete="email" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid rgba(148,163,184,0.3);background:#fff;color:#0f172a;font-size:15px;outline:none;margin-bottom:10px" />
				<input id="adminPassPassword" type="password" placeholder="Password" autocomplete="current-password" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid rgba(148,163,184,0.3);background:#fff;color:#0f172a;font-size:15px;outline:none" />
				<div id="adminPassError" style="color:#ef4444;font-size:12px;margin-top:8px;display:none"></div>
				<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
					<button id="adminPassCancel" style="appearance:none;border:1px solid rgba(148,163,184,0.3);background:#fff;color:#0f172a;border-radius:999px;padding:10px 16px;font:inherit;font-weight:800;cursor:pointer">Cancel</button>
					<button id="adminPassOk" style="appearance:none;border:1px solid #0b1b3a;background:#0b1b3a;color:#fff;border-radius:999px;padding:10px 16px;font:inherit;font-weight:800;cursor:pointer">Sign In</button>
				</div>
			</div>
		`;
		document.body.appendChild(modal);
	}
	async function promptPass(){
		if (!auth || !window.firebase || typeof firebase.auth !== 'function') {
			return { ok: false, reason: 'auth_unavailable' };
		}
		const currentUser = await getResolvedAdminUser();
		if (isAuthorizedAdminUser(currentUser)) {
			setSessionFlag(ADMIN_AUTH_PENDING_KEY, false);
			return { ok: true, user: currentUser };
		}
		ensureAdminPassModal();
		const modal = document.getElementById('adminPassModal');
		const emailInput = document.getElementById('adminPassEmail');
		const passInput = document.getElementById('adminPassPassword');
		const errorEl = document.getElementById('adminPassError');
		const okBtn = document.getElementById('adminPassOk');
		const cancelBtn = document.getElementById('adminPassCancel');
		if (!modal || !emailInput || !passInput || !okBtn || !cancelBtn) {
			return { ok: false, reason: 'auth_unavailable' };
		}
		emailInput.value = '';
		passInput.value = '';
		errorEl.style.display = 'none';
		errorEl.textContent = '';
		modal.style.display = 'flex';
		emailInput.focus();
		return new Promise((resolve) => {
			function cleanup() {
				okBtn.removeEventListener('click', onOk);
				cancelBtn.removeEventListener('click', onCancel);
				modal.style.display = 'none';
			}
			async function onOk() {
				const email = (emailInput.value || '').trim();
				const password = passInput.value || '';
				if (!email || !password) {
					errorEl.textContent = 'Please enter email and password.';
					errorEl.style.display = 'block';
					return;
				}
				if (!isAllowedAdminEmail(email)) {
					cleanup();
					resolve({ ok: false, reason: 'unauthorized' });
					return;
				}
				okBtn.disabled = true;
				okBtn.textContent = 'Signing in\u2026';
				try {
					const result = await auth.signInWithEmailAndPassword(email, password);
					const signedInUser = result?.user || auth.currentUser;
					if (!isAuthorizedAdminUser(signedInUser)) {
						try { await auth.signOut(); } catch (e) {}
						cleanup();
						resolve({ ok: false, reason: 'unauthorized' });
						return;
					}
					setSessionFlag(ADMIN_AUTH_PENDING_KEY, false);
					cleanup();
					resolve({ ok: true, user: signedInUser });
				} catch (error) {
					okBtn.disabled = false;
					okBtn.textContent = 'Sign In';
					const code = error?.code || '';
					if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
						errorEl.textContent = 'Incorrect password.';
						errorEl.style.display = 'block';
					} else if (code === 'auth/user-not-found') {
						cleanup();
						resolve({ ok: false, reason: 'user_not_found', errorCode: code });
					} else if (code === 'auth/too-many-requests') {
						cleanup();
						resolve({ ok: false, reason: 'too_many_requests', errorCode: code });
					} else if (code === 'auth/network-request-failed') {
						cleanup();
						resolve({ ok: false, reason: 'network', errorCode: code });
					} else {
						errorEl.textContent = 'Sign-in failed. Please try again.';
						errorEl.style.display = 'block';
					}
				}
			}
			function onCancel() {
				setSessionFlag(ADMIN_AUTH_PENDING_KEY, false);
				cleanup();
				resolve({ ok: false, reason: 'cancelled' });
			}
			okBtn.addEventListener('click', onOk);
			cancelBtn.addEventListener('click', onCancel);
			passInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') onOk(); });
		});
	}
	auth?.onAuthStateChanged(() => {
		maybeAutoOpenAdminPanel();
	});
	void maybeAutoOpenAdminPanel();

adminToggle.addEventListener('click', async ()=>{
	if (adminBody.style.display === 'none' || adminBody.style.display === '') {
try {
	const auth = await promptPass();
if(!auth.ok){
	if (auth.reason === 'unauthorized') alert('This email is not approved for admin access.');
	else if (auth.reason === 'wrong_password') alert('Incorrect password. Please try again.');
	else if (auth.reason === 'user_not_found') alert('No admin account found for this email.');
	else if (auth.reason === 'too_many_requests') alert('Too many failed attempts. Please try again later.');
	else if (auth.reason === 'network') alert('Network error. Check the connection and try again.');
	else if (auth.reason === 'auth_unavailable') alert('Firebase Auth is not available on this page.');
	else if (auth.reason !== 'cancelled') alert(`Admin sign-in failed${auth.errorCode ? ` (${auth.errorCode})` : ''}.`);
	return;
}
		} catch (e) {
			console.error('Admin sign-in flow failed', e);
			alert('Admin sign-in could not be completed.');
			return;
		}
		openAdminPanel();
	} else { adminBody.style.display = 'none'; adminToggle.textContent = 'Open'; }
});

	function refreshJson(){ return getAll(); }

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
		loadFormationEditor();
	});

	adminFormationTeam?.addEventListener('change', renderFormationEditor);
	adminFormationAddBtn?.addEventListener('click', () => {
		if (!formationDraft || !adminFormationTeam) return;
		const teamKey = adminFormationTeam.value || 'home';
		const limit = getFormationPlayerLimit(formationDraft.sport);
		const players = formationDraft.data[teamKey] || [];
		if (players.length >= limit) return;
		players.push({ number: players.length + 1, name: '', playerName: '', x: 50, y: 50 });
		formationDraft.data[teamKey] = players;
		renderFormationEditor();
	});
	adminFormationSaveBtn?.addEventListener('click', () => {
		(async () => {
			if (!formationDraft) { alert('Select a match first.'); return; }
			const remoteSaved = await saveFormationForMatch(formationDraft.matchId, formationDraft.sport, formationDraft.data);
			alert(remoteSaved ? 'Formation saved to the website.' : 'Formation saved on this device only.');
		})();
	});
	adminFormationResetBtn?.addEventListener('click', () => {
		if (!formationDraft) { alert('Select a match first.'); return; }
		if (!confirm('Reset this match formation to the default layout?')) return;
		formationDraft.data = cloneDeep(defaultFormations[formationDraft.sport]);
		renderFormationEditor();
	});

	customMatchSearchInput?.addEventListener('input', () => {
		renderMatchList();
	});
	matchFilterButtons.forEach((button) => {
		button.addEventListener('click', () => {
			activeMatchFilter = button.dataset.matchFilter === 'past' ? 'past' : 'upcoming';
			showEmptyState();
		});
	});

saveBtn.addEventListener('click', async ()=>{
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
	setAll(all); refreshJson(); window.dispatchEvent(new Event('storage'));
	if (db) {
		try {
			await db.collection('liveScores').doc(id).set(all[id], { merge: true });
			alert('Match update saved to the website.');
		} catch (e) {
			console.error(e);
			alert('Match update saved on this device only (Firebase sync failed).');
		}
	} else {
		alert('Match update saved on this device only.');
	}
});

clearBtn.addEventListener('click', async ()=>{
	const id = String(matchSelect.value || ''); if(!id){ alert('Select a match'); return; }
	const all = getAll(); delete all[id]; setAll(all); refreshJson();
	if (db) {
		try {
			await db.collection('liveScores').doc(id).delete();
			alert('Match update cleared from the website.');
		} catch (e) {
			console.error(e);
			alert('Match update cleared from this device only (Firebase sync failed).');
		}
	} else {
		alert('Match update cleared from this device only.');
	}
});

	addMatchBtn?.addEventListener('click', () => {
		showNewMatchForm();
	});

	/* Save new match (inside detail form) */
	saveNewMatchBtn?.addEventListener('click', async () => {
		syncDateTimeInputs();
		const home = getHomeTeamValue();
		const away = getAwayTeamValue();
		const date = toDisplayDate(newDateInput?.value || '');
		const location = (newLocationInput?.value || '').trim();
		const sport = (newSportInput?.value || 'basketball').trim().toLowerCase();
		const level = (newLevelInput?.value || 'HS').trim();
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
alert('Could not publish the new upcoming match.');
return;
		}
		if (customMatchSearchInput) customMatchSearchInput.value = '';
		populateMatchSelect();
		populateCustomMatchSelect();
		renderMatchList();
		selectMatch(nextId);
		alert('New upcoming match added to the website.');
	});

	updateMatchBtn?.addEventListener('click', async ()=>{
		if (!selectedMatchId) { alert('Select a match'); return; }
		const selectedId = Number(selectedMatchId);
		if (!Number.isFinite(selectedId)) { alert('Select a match'); return; }
		syncDateTimeInputs();
		const home = getHomeTeamValue();
		const away = getAwayTeamValue();
		const date = toDisplayDate(newDateInput?.value || '');
		const location = (newLocationInput?.value || '').trim();
		const sport = (newSportInput?.value || 'basketball').trim().toLowerCase();
		const level = (newLevelInput?.value || 'HS').trim();
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
alert('Could not update this upcoming match on the website.');
return;
		}
		if (customMatchSearchInput) customMatchSearchInput.value = '';
		populateMatchSelect();
		populateCustomMatchSelect();
		renderMatchList();
		selectMatch(selectedId);
		alert('Upcoming match updated on the website.');
	});

	deleteMatchBtn?.addEventListener('click', async ()=>{
		if (!selectedMatchId) { alert('Select a match'); return; }
		const id = String(selectedMatchId);
		const match = getMatchById(Number(id));
		const label = match ? (match.home + ' vs ' + match.away) : '#' + id;
		if (!confirm('Delete "' + label + '"?')) return;
		try {
			// Remove from custom matches (Firestore + local)
			await removeCustomMatch(id);
			// Also mark as deleted so preset matches stay hidden
			const deleted = readJson('bis_deleted_matches', []);
			if (!deleted.includes(id)) { deleted.push(id); writeJson('bis_deleted_matches', deleted); }
			if (db) {
				try { await db.collection('deletedMatches').doc(id).set({ deletedAt: new Date().toISOString() }); } catch(_){}
			}
			cleanupLocalMatchArtifacts(id);
			await cleanupRemoteMatchArtifacts(id);
		} catch (e) {
			console.error(e);
			alert('Could not delete this upcoming match from the website.');
			return;
		}
		populateMatchSelect();
		populateCustomMatchSelect();
		renderMatchList();
		showEmptyState();
		alert('Upcoming match deleted from the website.');
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
alert('This match was moved to Completed on the website.');
		} catch(e) {
console.error(e);
const finished = readJson(FINISHED_KEY, {});
finished[id] = { finished: true, homeScore, awayScore, finishedAt: new Date().toISOString() };
writeJson(FINISHED_KEY, finished);
alert('This match was moved to Completed on this device only.');
		}
	} else {
		const finished = readJson(FINISHED_KEY, {});
		finished[id] = { finished: true, homeScore, awayScore, finishedAt: new Date().toISOString() };
		writeJson(FINISHED_KEY, finished);
		alert('This match was moved to Completed on this device only.');
	}
});

resetBtn.addEventListener('click', async ()=>{
	const id = String(matchSelect.value || '');
	if(!id){ alert('Select a match'); return; }
	if(!confirm('Revert this match to Upcoming?')) return;
	
	if (db) {
		try {
await db.collection('finishedMatches').doc(id).delete();
alert('This match was moved back to Upcoming on the website.');
		} catch(e) {
console.error(e);
const finished = readJson(FINISHED_KEY, {});
delete finished[id];
writeJson(FINISHED_KEY, finished);
alert('This match was moved back to Upcoming on this device only.');
		}
	} else {
		const finished = readJson(FINISHED_KEY, {});
		delete finished[id];
		writeJson(FINISHED_KEY, finished);
		alert('This match was moved back to Upcoming on this device only.');
	}
	});

	// initialize
	if (matchSelect.value) {
		matchSelect.dispatchEvent(new Event('change'));
	}
	if (customMatchSelect) {
		customMatchSelect.dispatchEvent(new Event('change'));
	}
	loadFormationEditor();
})();

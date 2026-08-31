// ── Season auto-detection ──
// Autumn: Aug-Nov, Winter: Dec-Feb, Spring: Mar-Jun, Summer: Jul
function getCurrentSeason() {
	const month = new Date().getMonth(); // 0-indexed
	if (month >= 7 && month <= 10) return 'autumn';   // Aug-Nov
	if (month === 11 || month <= 1) return 'winter';  // Dec-Feb
	if (month >= 2 && month <= 5) return 'spring';    // Mar-Jun
	return 'autumn'; // Jul default to autumn (pre-season)
}

// Season → team card config: [{ title, level, sport, group, genders }]
const SEASON_TEAMS = {
	autumn: [
		{ title: 'MS Soccer Team', level: 'MS', sport: 'soccer', group: 'ms-soccer', genders: ['Boys', 'Girls'] },
		{ title: 'HS Volleyball Team', level: 'HS', sport: 'volleyball', group: 'hs-volleyball', genders: ['Boys', 'Girls'] }
	],
	winter: [
		{ title: 'MS Volleyball Team', level: 'MS', sport: 'volleyball', group: 'ms-volleyball', genders: ['Boys', 'Girls'] },
		{ title: 'HS Basketball Team', level: 'HS', sport: 'basketball', group: 'hs-basketball', genders: ['Boys', 'Girls'] }
	],
	spring: [
		{ title: 'MS Basketball Team', level: 'MS', sport: 'basketball', group: 'ms-basketball', genders: ['Boys', 'Girls'] },
		{ title: 'HS Soccer Team', level: 'HS', sport: 'soccer', group: 'hs-soccer', genders: ['Boys', 'Girls'] }
	]
};

function renderTeamCards() {
	const grid = document.getElementById('teamCardsGrid');
	if (!grid) return;
	const season = getCurrentSeason();
	const teams = SEASON_TEAMS[season] || SEASON_TEAMS.autumn;
	grid.innerHTML = '';

	teams.forEach((team) => {
		const titleKey = `teamCards.${season}.${team.group}.title`;
		const panel = document.createElement('div');
		panel.className = 'split-panel centered-panel';

		const titleDiv = document.createElement('div');
		titleDiv.className = 'split-title';
		titleDiv.innerHTML = `<span data-site-field="${titleKey}">${team.title}</span>`;
		panel.appendChild(titleDiv);

		const tabsDiv = document.createElement('div');
		tabsDiv.className = 'gender-tabs';
		tabsDiv.setAttribute('role', 'tablist');
		tabsDiv.setAttribute('aria-label', `${team.title} gender`);

		team.genders.forEach((gender, idx) => {
const btn = document.createElement('button');
btn.className = 'gender-tab' + (idx === 0 ? ' active' : '');
btn.type = 'button';
btn.dataset.group = team.group;
btn.dataset.target = `${team.group}-${gender.toLowerCase()}`;
btn.textContent = gender;
tabsDiv.appendChild(btn);
		});
		panel.appendChild(tabsDiv);

		const panelsDiv = document.createElement('div');
		panelsDiv.className = 'gender-panels';
		panelsDiv.style.setProperty('--slide-dir', '1');

		team.genders.forEach((gender, idx) => {
const content = document.createElement('div');
content.className = 'gender-content' + (idx === 0 ? ' active' : '');
content.id = `${team.group}-${gender.toLowerCase()}`;
content.dataset.group = team.group;

content.innerHTML = `
	<div class="team-card">
		<h3>${gender}</h3>
		<img class="mascot" src="assets/bismascot.png" alt="${gender} ${team.level} ${team.sport} team mascot" />
		<div class="stats">
			<div class="stat win">
				<div class="value">0</div>
				<div class="label">WIN</div>
			</div>
			<div class="stat draw">
				<div class="value">0</div>
				<div class="label">DRAW</div>
			</div>
			<div class="stat lose">
				<div class="value">0</div>
				<div class="label">LOSE</div>
			</div>
		</div>
	</div>`;
panelsDiv.appendChild(content);
		});
		panel.appendChild(panelsDiv);
		grid.appendChild(panel);
	});
}

renderTeamCards();

const initGenderTabs = () => {
	document.querySelectorAll('.gender-tabs').forEach((tabsWrap, groupIndex) => {
		const tabs = Array.from(tabsWrap.querySelectorAll('.gender-tab'));
		const panelsWrap = tabsWrap.closest('.split-panel')?.querySelector('.gender-panels');
		tabs.forEach((tab, idx) => {
const target = tab.dataset.target;
const panel = target ? document.getElementById(target) : null;
const tabId = tab.id || `gender-tab-${groupIndex}-${idx}`;
tab.id = tabId;
tab.setAttribute('role', 'tab');
tab.setAttribute('aria-controls', target || '');
tab.setAttribute('aria-selected', tab.classList.contains('active') ? 'true' : 'false');
tab.tabIndex = tab.classList.contains('active') ? 0 : -1;
if (panel) {
	panel.setAttribute('role', 'tabpanel');
	panel.setAttribute('aria-labelledby', tabId);
	panel.hidden = !panel.classList.contains('active');
}
		});
		tabsWrap.addEventListener('keydown', (event) => {
const current = tabs.findIndex((tab) => tab.classList.contains('active'));
let next = current;
if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
if (next !== current && tabs[next]) {
	event.preventDefault();
	tabs[next].click();
	tabs[next].focus();
}
		});
		if (panelsWrap) panelsWrap.setAttribute('aria-live', 'polite');
	});

	document.querySelectorAll('.gender-tab').forEach((tab) => {
		tab.addEventListener('click', () => {
		const group = tab.dataset.group;
		const target = tab.dataset.target;
		const tabsWrap = tab.closest('.gender-tabs');
		const panelsWrap = tab.closest('.split-panel')?.querySelector('.gender-panels');
		let prevIdx = 0;
		if (tabsWrap) {
const prev = tabsWrap.style.getPropertyValue('--active-tab');
prevIdx = Number(prev) || 0;
		}
document.querySelectorAll(`.gender-tab[data-group="${group}"]`).forEach((btn) => {
	btn.classList.remove('active');
	btn.setAttribute('aria-selected', 'false');
	btn.tabIndex = -1;
});
tab.classList.add('active');
tab.setAttribute('aria-selected', 'true');
tab.tabIndex = 0;
document.querySelectorAll(`.gender-content[data-group="${group}"]`).forEach((panel) => {
	panel.classList.remove('active');
	panel.hidden = true;
});
const panel = document.getElementById(target);
if (panel) {
	panel.classList.add('active');
	panel.hidden = false;
}
		if (tabsWrap) {
const tabs = Array.from(tabsWrap.querySelectorAll('.gender-tab'));
const idx = Math.max(0, tabs.indexOf(tab));
tabsWrap.style.setProperty('--active-tab', String(idx));
if (panelsWrap) {
	panelsWrap.style.setProperty('--slide-dir', idx >= prevIdx ? '1' : '-1');
	requestAnimationFrame(() => {
		panelsWrap.style.setProperty('--panel-height', `${panel?.offsetHeight || 0}px`);
	});
}
		}
	});
});

document.querySelectorAll('.gender-tabs').forEach((tabsWrap) => {
	const active = tabsWrap.querySelector('.gender-tab.active') || tabsWrap.querySelector('.gender-tab');
	if (!active) return;
	const tabs = Array.from(tabsWrap.querySelectorAll('.gender-tab'));
	const idx = Math.max(0, tabs.indexOf(active));
	tabsWrap.style.setProperty('--active-tab', String(idx));
	const panelsWrap = tabsWrap.closest('.split-panel')?.querySelector('.gender-panels');
	const activePanel = tabsWrap.closest('.split-panel')?.querySelector(`.gender-content.active[data-group="${active.dataset.group}"]`);
	if (panelsWrap && activePanel) {
		panelsWrap.style.setProperty('--panel-height', `${activePanel.offsetHeight}px`);
	}
});
};

const initSeasonTabs = () => {
	// Auto-activate the current season tab
	const currentSeason = getCurrentSeason();
	const seasonTabs = Array.from(document.querySelectorAll('.season-tab'));
	let foundActive = false;
	seasonTabs.forEach((tab) => {
		const isCurrent = tab.dataset.season === currentSeason;
		if (isCurrent) {
tab.classList.add('active');
foundActive = true;
		} else {
tab.classList.remove('active');
		}
		const target = tab.dataset.target;
		const panel = target ? document.getElementById(target) : null;
		if (panel) {
if (isCurrent) {
	panel.classList.add('active');
} else {
	panel.classList.remove('active');
}
		}
	});
	// Fallback: if no season matched, activate first tab
	if (!foundActive && seasonTabs[0]) {
		seasonTabs[0].classList.add('active');
		const fallbackPanel = document.getElementById(seasonTabs[0].dataset.target);
		if (fallbackPanel) fallbackPanel.classList.add('active');
	}
	seasonTabs.forEach((tab, idx) => {
		const target = tab.dataset.target;
		const panel = target ? document.getElementById(target) : null;
		const tabId = tab.id || `season-tab-${idx}`;
		tab.id = tabId;
		tab.setAttribute('role', 'tab');
		tab.setAttribute('aria-controls', target || '');
		tab.setAttribute('aria-selected', tab.classList.contains('active') ? 'true' : 'false');
		tab.tabIndex = tab.classList.contains('active') ? 0 : -1;
		if (panel) {
panel.setAttribute('role', 'tabpanel');
panel.setAttribute('aria-labelledby', tabId);
panel.hidden = !panel.classList.contains('active');
		}
	});
	document.querySelector('.season-tabs')?.addEventListener('keydown', (event) => {
		const current = seasonTabs.findIndex((tab) => tab.classList.contains('active'));
		let next = current;
		if (event.key === 'ArrowRight') next = (current + 1) % seasonTabs.length;
		if (event.key === 'ArrowLeft') next = (current - 1 + seasonTabs.length) % seasonTabs.length;
		if (next !== current && seasonTabs[next]) {
event.preventDefault();
seasonTabs[next].click();
seasonTabs[next].focus();
		}
	});

	document.querySelectorAll('.season-tab').forEach((tab) => {
		tab.addEventListener('click', () => {
		const target = tab.dataset.target;
		const tabsWrap = tab.closest('.season-tabs');
document.querySelectorAll('.season-tab').forEach((btn) => {
	btn.classList.remove('active');
	btn.setAttribute('aria-selected', 'false');
	btn.tabIndex = -1;
});
tab.classList.add('active');
tab.setAttribute('aria-selected', 'true');
tab.tabIndex = 0;
document.querySelectorAll('.season-content').forEach((panel) => {
	panel.classList.remove('active');
	panel.hidden = true;
});
const panel = document.getElementById(target);
if (panel) {
	panel.classList.add('active');
	panel.hidden = false;
}
		if (tabsWrap) {
const tabs = Array.from(tabsWrap.querySelectorAll('.season-tab'));
const idx = Math.max(0, tabs.indexOf(tab));
tabsWrap.style.setProperty('--active-tab', String(idx));
		}
	});
});

const tabsWrap = document.querySelector('.season-tabs');
if (!tabsWrap) return;
const active = tabsWrap.querySelector('.season-tab.active') || tabsWrap.querySelector('.season-tab');
if (!active) return;
const tabs = Array.from(tabsWrap.querySelectorAll('.season-tab'));
const idx = Math.max(0, tabs.indexOf(active));
tabsWrap.style.setProperty('--active-tab', String(idx));
};

initGenderTabs();
initSeasonTabs();

document.querySelectorAll('img').forEach((img, idx) => {
	if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
	if (!img.hasAttribute('loading') && idx > 0) img.setAttribute('loading', 'lazy');
});

const toggleButton = document.querySelector(".theme-toggle");
const toggleIcon = document.querySelector(".toggle-icon");
const toggleText = document.querySelector(".toggle-text");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

const applyTheme = (theme) => {
document.body.classList.toggle("dark", theme === "dark");
document.body.classList.toggle("light", theme === "light");
const isDark = theme === "dark";
toggleButton.setAttribute("aria-pressed", String(isDark));
toggleIcon.textContent = isDark ? "☀️" : "🌙";
toggleText.textContent = isDark ? "Light" : "Dark";
};

const savedTheme = localStorage.getItem("bis-theme");
if (savedTheme) {
applyTheme(savedTheme);
} else {
applyTheme(prefersDark.matches ? "dark" : "light");
}

prefersDark.addEventListener("change", (event) => {
const stored = localStorage.getItem("bis-theme");
if (!stored) {
	applyTheme(event.matches ? "dark" : "light");
}
});

toggleButton.addEventListener("click", () => {
const isDark = document.body.classList.contains("dark");
const nextTheme = isDark ? "light" : "dark";
localStorage.setItem("bis-theme", nextTheme);
applyTheme(nextTheme);
});

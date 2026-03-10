(function () {
  const STORAGE_KEY = 'bis_team_page_content';
  const COLLECTION = 'teamPageContent';
  const DOC_ID = 'main';

  const adminToggle = document.getElementById('teamAdminToggleBtn');
  const adminBody = document.getElementById('teamAdminBody');
  const adminStatus = document.getElementById('teamAdminStatus');
  const authStatus = document.getElementById('teamAdminAuthStatus');
  const loginModal = document.getElementById('teamAdminLoginModal');
  const loginStatus = document.getElementById('teamAdminLoginStatus');
  const loginEmailInput = document.getElementById('teamAdminLoginEmail');
  const loginPasswordInput = document.getElementById('teamAdminLoginPassword');
  const loginCancelBtn = document.getElementById('teamAdminLoginCancelBtn');
  const loginSubmitBtn = document.getElementById('teamAdminLoginSubmitBtn');
  const authEmailInput = document.getElementById('teamAdminEmail');
  const authPasswordInput = document.getElementById('teamAdminPassword');
  const signInBtn = document.getElementById('teamAdminSignInBtn');
  const signOutBtn = document.getElementById('teamAdminSignOutBtn');
  const tabSelect = document.getElementById('teamAdminTabSelect');
  const sectionTitleInput = document.getElementById('teamAdminSectionTitle');
  const sectionSubtitleInput = document.getElementById('teamAdminSectionSubtitle');
  const cardSelect = document.getElementById('teamAdminCardSelect');
  const cardTitleInput = document.getElementById('teamAdminCardTitle');
  const cardMetaInput = document.getElementById('teamAdminCardMeta');
  const recordBadgesInput = document.getElementById('teamAdminRecordBadges');
  const practiceTitleInput = document.getElementById('teamAdminPracticeTitle');
  const practiceStaffList = document.getElementById('teamAdminPracticeStaffList');
  const addStaffBtn = document.getElementById('teamAdminAddStaffBtn');
  const rosterList = document.getElementById('teamAdminRosterList');
  const addRosterBtn = document.getElementById('teamAdminAddRosterBtn');
  const gamesTitleInput = document.getElementById('teamAdminGamesTitle');
  const gamesTextInput = document.getElementById('teamAdminGamesText');
  const uniformsTitleInput = document.getElementById('teamAdminUniformsTitle');
  const uniformsTextInput = document.getElementById('teamAdminUniformsText');
  const jsonArea = document.getElementById('teamAdminJson');
  const previewBtn = document.getElementById('teamAdminPreviewBtn');
  const saveBtn = document.getElementById('teamAdminSaveBtn');
  const resetBtn = document.getElementById('teamAdminResetBtn');
  const reloadBtn = document.getElementById('teamAdminReloadBtn');

  if (!adminToggle || !adminBody || !tabSelect || !cardSelect || !jsonArea) {
    return;
  }

  let db = null;
  let auth = null;
  let currentUser = null;
  let accordionBound = false;
  let remoteAvailable = false;

  const firebaseConfig = window.BIS_FIREBASE_CONFIG || {};
  if (firebaseConfig.apiKey && window.firebase) {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.firestore();
      if (typeof firebase.auth === 'function') {
        auth = firebase.auth();
        if (firebase.auth.Auth && firebase.auth.Auth.Persistence) {
          auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
        }
      }
    } catch (error) {
      console.warn('Firebase init failed on team page', error);
    }
  }

  const deepClone = (value) => {
    if (value == null) {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
  };
  const asText = (value) => value == null ? '' : String(value).trim();
  const asTextArray = (value) => Array.isArray(value) ? value.map(asText).filter(Boolean) : [];
  const splitLines = (value) => asText(value).split('\n').map(asText).filter(Boolean);
  const clampIndex = (value, length) => {
    if (!Number.isFinite(value) || length <= 0) {
      return 0;
    }
    return Math.min(Math.max(value, 0), length - 1);
  };
  const createElement = (tagName, className, text) => {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  };
  const readJson = (key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  };
  const writeJson = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Local save failed', error);
    }
  };

  const defaultState = captureDefaultState();
  if (!defaultState.tabs.length) {
    return;
  }

  let savedState = normalizePageState(loadLocalState() || defaultState, defaultState);
  let workingState = deepClone(savedState);

  renderState(workingState);
  bindAccordionDelegation();
  bindControls();
  refreshEditor();
  setStatus(readJson(STORAGE_KEY) ? 'Loaded local saved content.' : 'Loaded default content.');
  subscribeRemoteState();

  if (auth) {
    auth.onAuthStateChanged((user) => {
      currentUser = user || null;
      if (currentUser && loginModal && !loginModal.hidden) {
        setLoginModalOpen(false);
      }
      if (!currentUser && !adminBody.hidden) {
        setAdminOpen(false);
      }
      refreshAuthUi();
    });
  } else {
    refreshAuthUi();
  }

  function bindControls() {
    adminToggle.addEventListener('click', async () => {
      if (!adminBody.hidden) {
        setAdminOpen(false);
        return;
      }
      if (!auth) {
        setStatus('Firebase Auth is unavailable on this page.', 'warn');
        alert('Firebase Auth is unavailable on this page.');
        return;
      }
      if (!currentUser) {
        setLoginModalOpen(true);
        return;
      }
      setAdminOpen(true);
    });

    tabSelect.addEventListener('change', () => {
      refreshEditor({ tabIndex: Number(tabSelect.value) || 0, cardIndex: 0 });
    });

    cardSelect.addEventListener('change', () => {
      refreshEditor({ tabIndex: Number(tabSelect.value) || 0, cardIndex: Number(cardSelect.value) || 0 });
    });

    previewBtn.addEventListener('click', () => {
      try {
        const selection = getSelection();
        applyFormToWorkingState(selection);
        renderState(workingState);
        refreshEditor(selection);
        setStatus('Preview applied. Save to persist changes.');
      } catch (error) {
        alert(error.message || 'Failed to apply preview.');
        setStatus('Preview failed. Check the form inputs.', 'warn');
      }
    });

    saveBtn.addEventListener('click', async () => {
      try {
        const selection = getSelection();
        applyFormToWorkingState(selection);
        savedState = deepClone(workingState);
        writeJson(STORAGE_KEY, savedState);
        renderState(workingState);
        refreshEditor(selection);

        if (!db) {
          setStatus('Saved locally. Firebase is unavailable here.', 'warn');
          return;
        }

        if (!currentUser) {
          setStatus('Saved locally. Sign in with Firebase to sync across devices.', 'warn');
          return;
        }

        await db.collection(COLLECTION).doc(DOC_ID).set({
          tabs: savedState.tabs,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser.email || ''
        }, { merge: true });
        remoteAvailable = true;
        setStatus('Saved locally and synced to Firebase.', 'ok');
      } catch (error) {
        console.warn('Team page save failed', error);
        if (error && error.message && error.message.toLowerCase().includes('permission')) {
          setStatus('Saved locally. Firebase write was blocked by rules.', 'warn');
          return;
        }
        setStatus('Saved locally. Firebase sync failed.', 'warn');
      }
    });

    resetBtn.addEventListener('click', () => {
      const selection = getSelection();
      const defaultCard = defaultState.tabs[selection.tabIndex] && defaultState.tabs[selection.tabIndex].cards[selection.cardIndex];
      if (!defaultCard) {
        setStatus('No default card found for this selection.', 'warn');
        return;
      }

      workingState.tabs[selection.tabIndex].cards[selection.cardIndex] = deepClone(defaultCard);
      renderState(workingState);
      refreshEditor(selection);
      setStatus('Selected card reset. Save to persist it.');
    });

    reloadBtn.addEventListener('click', () => {
      const selection = getSelection();
      workingState = deepClone(savedState);
      renderState(workingState);
      refreshEditor(selection);
      setStatus('Reloaded the last saved content.');
    });

    signInBtn.addEventListener('click', async () => {
      await signInWithCredentials({
        email: asText(authEmailInput.value),
        password: asText(authPasswordInput.value),
        triggerButton: signInBtn,
        openAdminOnSuccess: false,
        source: 'panel'
      });
    });

    signOutBtn.addEventListener('click', async () => {
      if (!auth || !currentUser) {
        return;
      }
      try {
        await auth.signOut();
        setAdminOpen(false);
        setStatus('Signed out. Sign in again to open Team Admin.');
      } catch (error) {
        console.warn('Firebase sign-out failed', error);
        setStatus('Sign-out failed.', 'warn');
      }
    });

    loginSubmitBtn?.addEventListener('click', async () => {
      await signInWithCredentials({
        email: asText(loginEmailInput?.value),
        password: asText(loginPasswordInput?.value),
        triggerButton: loginSubmitBtn,
        openAdminOnSuccess: true,
        source: 'modal'
      });
    });

    loginCancelBtn?.addEventListener('click', () => {
      setLoginModalOpen(false);
    });

    loginModal?.addEventListener('click', (event) => {
      if (event.target === loginModal) {
        setLoginModalOpen(false);
      }
    });

    loginPasswordInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        loginSubmitBtn?.click();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setLoginModalOpen(false);
      }
    });

    loginEmailInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !loginPasswordInput?.value) {
        event.preventDefault();
        loginPasswordInput?.focus();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setLoginModalOpen(false);
      }
    });

    addStaffBtn.addEventListener('click', () => {
      practiceStaffList.appendChild(createStaffEditorRow('', []));
    });

    addRosterBtn.addEventListener('click', () => {
      rosterList.appendChild(createRosterEditorCard('', []));
    });

    practiceStaffList.addEventListener('click', (event) => {
      const removeButton = event.target.closest('[data-remove-staff]');
      if (!removeButton) {
        return;
      }
      const row = removeButton.closest('[data-staff-row]');
      if (row) {
        row.remove();
      }
    });

    rosterList.addEventListener('click', (event) => {
      const removeButton = event.target.closest('[data-remove-roster]');
      if (!removeButton) {
        return;
      }
      const row = removeButton.closest('[data-roster-row]');
      if (row) {
        row.remove();
      }
    });
  }

  function setAdminOpen(isOpen) {
    adminBody.hidden = !isOpen;
    adminToggle.textContent = isOpen ? 'Close Admin' : 'Team Admin';
    if (isOpen) {
      refreshEditor();
    }
  }

  function setLoginModalOpen(isOpen) {
    if (!loginModal) {
      return;
    }
    loginModal.hidden = !isOpen;
    if (!isOpen) {
      if (loginPasswordInput) loginPasswordInput.value = '';
      if (loginStatus) {
        loginStatus.textContent = '로그인해야 Team Admin이 열립니다.';
        loginStatus.dataset.tone = '';
      }
      return;
    }
    if (loginStatus) {
      loginStatus.textContent = '로그인해야 Team Admin이 열립니다.';
      loginStatus.dataset.tone = '';
    }
    if (loginEmailInput) {
      loginEmailInput.value = authEmailInput?.value || loginEmailInput.value || '';
    }
    if (loginPasswordInput) {
      loginPasswordInput.value = '';
    }
    setTimeout(() => (loginEmailInput || loginPasswordInput)?.focus(), 0);
  }

  async function signInWithCredentials({ email, password, triggerButton, openAdminOnSuccess, source }) {
    if (!auth) {
      setStatus('Firebase Auth is unavailable on this page.', 'warn');
      return;
    }
    if (!email || !password) {
      alert('Enter both email and password.');
      return;
    }
    if (triggerButton) triggerButton.disabled = true;
    try {
      await auth.signInWithEmailAndPassword(email, password);
      if (authEmailInput) authEmailInput.value = email;
      if (authPasswordInput) authPasswordInput.value = '';
      if (loginEmailInput) loginEmailInput.value = email;
      if (loginPasswordInput) loginPasswordInput.value = '';
      if (openAdminOnSuccess) {
        setLoginModalOpen(false);
        setAdminOpen(true);
        setStatus('Signed in. Team Admin opened.', 'ok');
      } else {
        setStatus('Signed in. Remote save is ready.', 'ok');
      }
    } catch (error) {
      console.warn('Firebase sign-in failed', error);
      const message = error && error.message ? error.message : 'Failed to sign in.';
      if (source === 'modal' && loginStatus) {
        loginStatus.textContent = message;
        loginStatus.dataset.tone = 'warn';
      }
      alert(message);
      setStatus('Sign-in failed. Check Firebase Auth setup.', 'warn');
    } finally {
      if (triggerButton) triggerButton.disabled = false;
    }
  }

  function refreshAuthUi() {
    if (!auth) {
      if (authStatus) {
        authStatus.textContent = 'Firebase Auth SDK is unavailable. Remote save is disabled.';
      }
      if (signInBtn) signInBtn.disabled = true;
      if (signOutBtn) signOutBtn.disabled = true;
      return;
    }

    if (currentUser) {
      authStatus.textContent = 'Signed in as ' + (currentUser.email || 'authenticated user') + '. Remote save is enabled.';
      authEmailInput.disabled = true;
      authPasswordInput.disabled = true;
      signInBtn.disabled = true;
      signOutBtn.disabled = false;
      return;
    }

    authStatus.textContent = 'Not signed in. Sign in is required to open Team Admin.';
    authEmailInput.disabled = false;
    authPasswordInput.disabled = false;
    signInBtn.disabled = false;
    signOutBtn.disabled = true;
  }

  function captureDefaultState() {
    const panels = Array.from(document.querySelectorAll('.tab-panel'));
    return {
      tabs: panels.map((panel) => {
        const button = document.querySelector('.tab-btn[data-target="' + panel.id + '"]');
        const section = panel.querySelector('section.panel');
        const grid = section ? section.querySelector('.hs-grid') : null;
        return {
          id: panel.id,
          label: button ? asText(button.textContent) : panel.id,
          title: section ? asText(section.querySelector('.panel-title') && section.querySelector('.panel-title').textContent) : '',
          subtitle: section ? asText(section.querySelector('.panel-subtitle') && section.querySelector('.panel-subtitle').textContent) : '',
          cards: grid
            ? Array.from(grid.children)
                .filter((child) => child.classList.contains('hs-card'))
                .map(parseCard)
            : []
        };
      })
    };
  }

  function parseCard(cardElement) {
    const directChildren = Array.from(cardElement.children);
    const recordBlock = directChildren.find((child) => child.classList.contains('hs-block'));
    const accordionRoot = directChildren.find((child) => child.classList.contains('accordion'));

    return {
      title: asText(cardElement.querySelector('.hs-title') && cardElement.querySelector('.hs-title').textContent),
      meta: asText(cardElement.querySelector('.hs-meta') && cardElement.querySelector('.hs-meta').textContent),
      recordLabel: recordBlock ? asText(recordBlock.querySelector('.hs-label') && recordBlock.querySelector('.hs-label').textContent) : 'Record',
      recordBadges: recordBlock
        ? Array.from(recordBlock.querySelectorAll('.hs-badge')).map((badge) => asText(badge.textContent)).filter(Boolean)
        : [],
      accordions: accordionRoot
        ? Array.from(accordionRoot.children)
            .filter((child) => child.classList.contains('accordion-item'))
            .map(parseAccordion)
        : []
    };
  }

  function parseAccordion(itemElement) {
    const inner = itemElement.querySelector('.accordion-inner');
    return {
      title: asText(itemElement.querySelector('.accordion-title') && itemElement.querySelector('.accordion-title').textContent),
      blocks: inner ? Array.from(inner.children).map(parseBlock).filter(Boolean) : []
    };
  }

  function parseBlock(blockElement) {
    if (blockElement.classList.contains('staff-item')) {
      return {
        type: 'staff',
        role: asText(blockElement.querySelector('.role') && blockElement.querySelector('.role').textContent),
        lines: Array.from(blockElement.querySelectorAll('.name')).map((line) => asText(line.textContent)).filter(Boolean)
      };
    }

    if (blockElement.classList.contains('roster-grid')) {
      return {
        type: 'rosterGrid',
        items: Array.from(blockElement.querySelectorAll('.roster-item')).map((item) => {
          const clone = item.cloneNode(true);
          const gradeEl = clone.querySelector('.grade');
          const grade = gradeEl ? asText(gradeEl.textContent) : '';
          if (gradeEl) {
            gradeEl.remove();
          }
          return {
            name: asText(clone.textContent),
            grade
          };
        }).filter((item) => item.name || item.grade)
      };
    }

    if (blockElement.classList.contains('game-item')) {
      const opponentEl = blockElement.querySelector('.opponent');
      const opponentClone = opponentEl ? opponentEl.cloneNode(true) : null;
      const typeEl = opponentClone ? opponentClone.querySelector('.type') : null;
      const gameType = typeEl ? asText(typeEl.textContent) : '';
      if (typeEl) {
        typeEl.remove();
      }
      return {
        type: 'game',
        resultClass: blockElement.classList.contains('win') ? 'win' : blockElement.classList.contains('loss') ? 'loss' : blockElement.classList.contains('draw') ? 'draw' : '',
        opponent: opponentClone ? asText(opponentClone.textContent) : '',
        gameType,
        score: asText(blockElement.querySelector('.score') && blockElement.querySelector('.score').textContent)
      };
    }

    if (blockElement.classList.contains('uniform-gallery')) {
      return {
        type: 'uniformGallery',
        items: Array.from(blockElement.children).map((item) => {
          const image = item.querySelector('img.uniform-img');
          const label = item.querySelector('.uniform-label');
          return {
            src: image ? asText(image.getAttribute('src')) : '',
            alt: image ? asText(image.getAttribute('alt')) : '',
            label: label ? asText(label.textContent) : ''
          };
        }).filter((item) => item.src || item.label)
      };
    }

    if (blockElement.classList.contains('hs-label')) {
      return { type: 'label', text: asText(blockElement.textContent) };
    }

    if (blockElement.classList.contains('hs-value')) {
      return { type: 'text', text: asText(blockElement.textContent) };
    }

    const fallbackText = asText(blockElement.textContent);
    return fallbackText ? { type: 'text', text: fallbackText } : null;
  }

  function normalizePageState(rawState, fallbackState) {
    const fallbackTabs = Array.isArray(fallbackState && fallbackState.tabs) ? fallbackState.tabs : [];
    const rawTabs = Array.isArray(rawState && rawState.tabs) ? rawState.tabs : [];
    return {
      tabs: fallbackTabs.map((fallbackTab, tabIndex) => normalizeTab(rawTabs[tabIndex], fallbackTab))
    };
  }

  function normalizeTab(rawTab, fallbackTab) {
    const rawCards = Array.isArray(rawTab && rawTab.cards) ? rawTab.cards : fallbackTab.cards;
    return {
      id: asText(fallbackTab.id),
      label: asText(rawTab && rawTab.label ? rawTab.label : fallbackTab.label),
      title: asText(rawTab && Object.prototype.hasOwnProperty.call(rawTab, 'title') ? rawTab.title : fallbackTab.title),
      subtitle: asText(rawTab && Object.prototype.hasOwnProperty.call(rawTab, 'subtitle') ? rawTab.subtitle : fallbackTab.subtitle),
      cards: Array.isArray(rawCards) ? rawCards.map((card, cardIndex) => normalizeCard(card, fallbackTab.cards[cardIndex])) : []
    };
  }

  function normalizeCard(rawCard, fallbackCard) {
    const baseCard = fallbackCard || { title: '', meta: '', recordLabel: 'Record', recordBadges: [], accordions: [] };
    return {
      title: asText(rawCard && Object.prototype.hasOwnProperty.call(rawCard, 'title') ? rawCard.title : baseCard.title),
      meta: asText(rawCard && Object.prototype.hasOwnProperty.call(rawCard, 'meta') ? rawCard.meta : baseCard.meta),
      recordLabel: asText(rawCard && Object.prototype.hasOwnProperty.call(rawCard, 'recordLabel') ? rawCard.recordLabel : baseCard.recordLabel || 'Record'),
      recordBadges: Array.isArray(rawCard && rawCard.recordBadges) ? asTextArray(rawCard.recordBadges) : deepClone(baseCard.recordBadges || []),
      accordions: Array.isArray(rawCard && rawCard.accordions)
        ? rawCard.accordions.map((accordion, index) => normalizeAccordion(accordion, baseCard.accordions[index]))
        : deepClone(baseCard.accordions || [])
    };
  }

  function normalizeAccordion(rawAccordion, fallbackAccordion) {
    const baseAccordion = fallbackAccordion || { title: '', blocks: [] };
    const rawBlocks = Array.isArray(rawAccordion && rawAccordion.blocks) ? rawAccordion.blocks : baseAccordion.blocks;
    return {
      title: asText(rawAccordion && Object.prototype.hasOwnProperty.call(rawAccordion, 'title') ? rawAccordion.title : baseAccordion.title),
      blocks: Array.isArray(rawBlocks) ? rawBlocks.map((block, index) => normalizeBlock(block, baseAccordion.blocks[index])) : []
    };
  }

  function normalizeBlock(rawBlock, fallbackBlock) {
    const type = asText(rawBlock && rawBlock.type) || asText(fallbackBlock && fallbackBlock.type);
    if (type === 'staff') {
      return {
        type,
        role: asText(rawBlock && rawBlock.role),
        lines: Array.isArray(rawBlock && rawBlock.lines) ? asTextArray(rawBlock.lines) : asTextArray(fallbackBlock && fallbackBlock.lines)
      };
    }
    if (type === 'rosterGrid') {
      const items = Array.isArray(rawBlock && rawBlock.items) ? rawBlock.items : (fallbackBlock && fallbackBlock.items) || [];
      return {
        type,
        items: items.map((item) => ({ name: asText(item && item.name), grade: asText(item && item.grade) })).filter((item) => item.name || item.grade)
      };
    }
    if (type === 'game') {
      return {
        type,
        resultClass: ['win', 'loss', 'draw'].includes(asText(rawBlock && rawBlock.resultClass)) ? asText(rawBlock && rawBlock.resultClass) : '',
        opponent: asText(rawBlock && rawBlock.opponent),
        gameType: asText(rawBlock && rawBlock.gameType),
        score: asText(rawBlock && rawBlock.score)
      };
    }
    if (type === 'uniformGallery') {
      const items = Array.isArray(rawBlock && rawBlock.items) ? rawBlock.items : (fallbackBlock && fallbackBlock.items) || [];
      return {
        type,
        items: items.map((item) => ({ src: asText(item && item.src), alt: asText(item && item.alt), label: asText(item && item.label) })).filter((item) => item.src || item.label)
      };
    }
    if (type === 'label') {
      return { type, text: asText(rawBlock && rawBlock.text) };
    }
    return { type: 'text', text: asText(rawBlock && rawBlock.text) };
  }

  function renderState(state) {
    state.tabs.forEach((tab) => {
      const panel = document.getElementById(tab.id);
      if (!panel) {
        return;
      }
      panel.innerHTML = '';
      panel.appendChild(buildSection(tab));
    });
    ensureImageAttributes();
  }

  function buildSection(tab) {
    const section = createElement('section', 'panel');
    section.appendChild(createElement('div', 'panel-title', tab.title || 'Team Section'));
    if (tab.subtitle) {
      section.appendChild(createElement('div', 'panel-subtitle', tab.subtitle));
    }
    const grid = createElement('div', 'hs-grid');
    tab.cards.forEach((card) => grid.appendChild(buildCard(card)));
    section.appendChild(grid);
    return section;
  }

  function buildCard(card) {
    const cardEl = createElement('div', 'hs-card');
    cardEl.appendChild(createElement('div', 'hs-title', card.title));
    cardEl.appendChild(createElement('div', 'hs-meta', card.meta));
    const recordBlock = createElement('div', 'hs-block');
    recordBlock.appendChild(createElement('div', 'hs-label', card.recordLabel || 'Record'));
    const badgeRow = createElement('div', 'hs-inline');
    (card.recordBadges || []).forEach((badge) => badgeRow.appendChild(createElement('span', 'hs-badge', badge)));
    recordBlock.appendChild(badgeRow);
    cardEl.appendChild(recordBlock);
    const accordion = createElement('div', 'accordion');
    (card.accordions || []).forEach((accordionItem) => accordion.appendChild(buildAccordion(accordionItem)));
    cardEl.appendChild(accordion);
    return cardEl;
  }

  function buildAccordion(accordionItem) {
    const item = createElement('div', 'accordion-item');
    const header = createElement('div', 'accordion-header');
    header.appendChild(createElement('span', 'accordion-title', accordionItem.title));
    header.appendChild(createElement('span', 'accordion-icon', '▼'));
    item.appendChild(header);
    const content = createElement('div', 'accordion-content');
    const inner = createElement('div', 'accordion-inner');
    (accordionItem.blocks || []).forEach((block) => {
      const blockNode = buildBlock(block);
      if (blockNode) {
        inner.appendChild(blockNode);
      }
    });
    content.appendChild(inner);
    item.appendChild(content);
    return item;
  }

  function buildBlock(block) {
    if (block.type === 'staff') {
      const staffItem = createElement('div', 'staff-item');
      staffItem.appendChild(createElement('div', 'role', block.role));
      (block.lines || []).forEach((line) => staffItem.appendChild(createElement('div', 'name', line)));
      return staffItem;
    }
    if (block.type === 'rosterGrid') {
      const grid = createElement('div', 'roster-grid');
      (block.items || []).forEach((item) => {
        const rosterItem = createElement('div', 'roster-item');
        rosterItem.appendChild(document.createTextNode(item.name || ''));
        if (item.grade) {
          rosterItem.appendChild(document.createTextNode(' '));
          rosterItem.appendChild(createElement('span', 'grade', item.grade));
        }
        grid.appendChild(rosterItem);
      });
      return grid;
    }
    if (block.type === 'game') {
      const classes = ['game-item'];
      if (block.resultClass) {
        classes.push(block.resultClass);
      }
      const gameItem = createElement('div', classes.join(' '));
      const opponent = createElement('span', 'opponent', block.opponent || '');
      if (block.gameType) {
        opponent.appendChild(createElement('span', 'type', block.gameType));
      }
      gameItem.appendChild(opponent);
      gameItem.appendChild(createElement('span', 'score', block.score || ''));
      return gameItem;
    }
    if (block.type === 'uniformGallery') {
      const gallery = createElement('div', 'uniform-gallery');
      (block.items || []).forEach((item) => {
        const wrapper = createElement('div');
        const image = createElement('img', 'uniform-img');
        image.src = item.src || '';
        image.alt = item.alt || item.label || 'Uniform image';
        image.loading = 'lazy';
        image.decoding = 'async';
        wrapper.appendChild(image);
        wrapper.appendChild(createElement('div', 'uniform-label', item.label || 'Uniform'));
        gallery.appendChild(wrapper);
      });
      return gallery;
    }
    if (block.type === 'label') {
      return createElement('div', 'hs-label', block.text);
    }
    if (block.type === 'text') {
      return createElement('div', 'hs-value', block.text);
    }
    return null;
  }

  function ensureImageAttributes() {
    document.querySelectorAll('img').forEach((img) => {
      if (!img.hasAttribute('decoding')) {
        img.setAttribute('decoding', 'async');
      }
    });
    document.querySelectorAll('img.uniform-img').forEach((img) => {
      if (!img.hasAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }
    });
  }

  function bindAccordionDelegation() {
    if (accordionBound) {
      return;
    }
    accordionBound = true;
    document.addEventListener('click', (event) => {
      const header = event.target.closest('.accordion-header');
      if (!header) {
        return;
      }
      const item = header.parentElement;
      const card = item.closest('.hs-card');
      const wasOpen = item.classList.contains('open');
      if (card) {
        card.querySelectorAll('.accordion-item.open').forEach((openItem) => {
          if (openItem !== item) {
            openItem.classList.remove('open');
          }
        });
      }
      item.classList.toggle('open', !wasOpen);
    });
  }

  function loadLocalState() {
    const raw = readJson(STORAGE_KEY);
    return raw && typeof raw === 'object' ? raw : null;
  }

  function subscribeRemoteState() {
    if (!db) {
      return;
    }
    db.collection(COLLECTION).doc(DOC_ID).onSnapshot((snapshot) => {
      if (!snapshot.exists) {
        return;
      }
      const remoteState = normalizePageState(snapshot.data(), defaultState);
      savedState = deepClone(remoteState);
      workingState = deepClone(remoteState);
      writeJson(STORAGE_KEY, savedState);
      renderState(workingState);
      refreshEditor();
      remoteAvailable = true;
      setStatus('Synced from Firebase.', 'ok');
    }, (error) => {
      console.warn('Team content subscription failed', error);
      setStatus('Firebase read failed. Using local content.', 'warn');
    });
  }

  function refreshEditor(selection) {
    const nextTabIndex = clampIndex(selection && Number.isFinite(selection.tabIndex) ? selection.tabIndex : Number(tabSelect.value), workingState.tabs.length);
    tabSelect.innerHTML = '';
    workingState.tabs.forEach((tab, index) => {
      const option = createElement('option');
      option.value = String(index);
      option.textContent = (tab.label || 'Tab ' + (index + 1)) + ' · ' + (tab.title || 'Untitled');
      tabSelect.appendChild(option);
    });
    tabSelect.value = String(nextTabIndex);

    const selectedTab = workingState.tabs[nextTabIndex];
    sectionTitleInput.value = selectedTab ? selectedTab.title || '' : '';
    sectionSubtitleInput.value = selectedTab ? selectedTab.subtitle || '' : '';

    const cards = selectedTab && Array.isArray(selectedTab.cards) ? selectedTab.cards : [];
    const nextCardIndex = clampIndex(selection && Number.isFinite(selection.cardIndex) ? selection.cardIndex : Number(cardSelect.value), cards.length);
    cardSelect.innerHTML = '';
    cards.forEach((card, index) => {
      const option = createElement('option');
      option.value = String(index);
      option.textContent = card.title || 'Card ' + (index + 1);
      cardSelect.appendChild(option);
    });
    cardSelect.disabled = !cards.length;

    if (!cards.length) {
      clearEditorFields();
      return;
    }

    cardSelect.value = String(nextCardIndex);
    const selectedCard = cards[nextCardIndex];
    cardTitleInput.value = selectedCard.title || '';
    cardMetaInput.value = selectedCard.meta || '';
    recordBadgesInput.value = (selectedCard.recordBadges || []).join('\n');

    const sections = collectCardSections(selectedCard);
    practiceTitleInput.value = sections.practice ? sections.practice.title : '📅 Practice & Staff';
    renderStaffEditor(sections.practice ? sections.practice.blocks.filter((block) => block.type === 'staff') : []);
    renderRosterEditor(sections.rosters.map((accordion) => ({
      title: accordion.title,
      items: extractRosterItems(accordion.blocks)
    })));
    gamesTitleInput.value = sections.games ? sections.games.title : '🏆 Game Results';
    gamesTextInput.value = serializeGameBlocks(sections.games ? sections.games.blocks : []);
    uniformsTitleInput.value = sections.uniforms ? sections.uniforms.title : '👕 Uniforms';
    uniformsTextInput.value = serializeUniformItems(sections.uniforms ? extractUniformItems(sections.uniforms.blocks) : []);
    jsonArea.value = JSON.stringify(selectedCard, null, 2);
  }

  function clearEditorFields() {
    cardTitleInput.value = '';
    cardMetaInput.value = '';
    recordBadgesInput.value = '';
    practiceTitleInput.value = '';
    practiceStaffList.innerHTML = '';
    rosterList.innerHTML = '';
    gamesTitleInput.value = '';
    gamesTextInput.value = '';
    uniformsTitleInput.value = '';
    uniformsTextInput.value = '';
    jsonArea.value = '';
  }

  function collectCardSections(card) {
    const sections = { practice: null, rosters: [], games: null, uniforms: null, others: [] };
    (card.accordions || []).forEach((accordion) => {
      const kind = detectAccordionKind(accordion.title);
      if (kind === 'practice' && !sections.practice) {
        sections.practice = deepClone(accordion);
        return;
      }
      if (kind === 'roster') {
        sections.rosters.push(deepClone(accordion));
        return;
      }
      if (kind === 'games' && !sections.games) {
        sections.games = deepClone(accordion);
        return;
      }
      if (kind === 'uniforms' && !sections.uniforms) {
        sections.uniforms = deepClone(accordion);
        return;
      }
      sections.others.push(deepClone(accordion));
    });
    return sections;
  }

  function detectAccordionKind(title) {
    const lower = asText(title).toLowerCase();
    if (lower.includes('practice')) return 'practice';
    if (lower.includes('roster')) return 'roster';
    if (lower.includes('game result')) return 'games';
    if (lower.includes('uniform')) return 'uniforms';
    return 'other';
  }

  function extractRosterItems(blocks) {
    const gridBlock = (blocks || []).find((block) => block.type === 'rosterGrid');
    return gridBlock && Array.isArray(gridBlock.items) ? deepClone(gridBlock.items) : [];
  }

  function extractUniformItems(blocks) {
    const galleryBlock = (blocks || []).find((block) => block.type === 'uniformGallery');
    return galleryBlock && Array.isArray(galleryBlock.items) ? deepClone(galleryBlock.items) : [];
  }

  function renderStaffEditor(blocks) {
    practiceStaffList.innerHTML = '';
    const staffBlocks = blocks.length ? blocks : [{ type: 'staff', role: '', lines: [] }];
    staffBlocks.forEach((block) => {
      practiceStaffList.appendChild(createStaffEditorRow(block.role, block.lines));
    });
  }

  function createStaffEditorRow(role, lines) {
    const row = createElement('div', 'team-admin-repeat');
    row.dataset.staffRow = 'true';
    const head = createElement('div', 'team-admin-repeat-head');
    head.appendChild(createElement('div', 'team-admin-group-title', 'Staff Block'));
    const removeButton = createElement('button', 'team-admin-mini-btn warn', 'Remove');
    removeButton.type = 'button';
    removeButton.dataset.removeStaff = 'true';
    head.appendChild(removeButton);
    row.appendChild(head);
    const roleInput = createElement('input', 'team-admin-input');
    roleInput.type = 'text';
    roleInput.placeholder = 'Role';
    roleInput.value = role || '';
    roleInput.dataset.staffRole = 'true';
    row.appendChild(roleInput);
    const linesInput = createElement('textarea', 'team-admin-textarea compact');
    linesInput.placeholder = 'One line per entry';
    linesInput.value = Array.isArray(lines) ? lines.join('\n') : '';
    linesInput.dataset.staffLines = 'true';
    row.appendChild(linesInput);
    return row;
  }

  function renderRosterEditor(rosters) {
    rosterList.innerHTML = '';
    const rosterGroups = rosters.length ? rosters : [{ title: '', items: [] }];
    rosterGroups.forEach((roster) => {
      rosterList.appendChild(createRosterEditorCard(roster.title, roster.items));
    });
  }

  function createRosterEditorCard(title, items) {
    const row = createElement('div', 'team-admin-roster-card');
    row.dataset.rosterRow = 'true';
    const head = createElement('div', 'team-admin-roster-head');
    head.appendChild(createElement('div', 'team-admin-group-title', 'Roster Group'));
    const removeButton = createElement('button', 'team-admin-mini-btn warn', 'Remove');
    removeButton.type = 'button';
    removeButton.dataset.removeRoster = 'true';
    head.appendChild(removeButton);
    row.appendChild(head);
    const titleInput = createElement('input', 'team-admin-input');
    titleInput.type = 'text';
    titleInput.placeholder = 'Accordion title';
    titleInput.value = title || '';
    titleInput.dataset.rosterTitle = 'true';
    row.appendChild(titleInput);
    const itemsInput = createElement('textarea', 'team-admin-textarea compact');
    itemsInput.placeholder = 'Name | Grade';
    itemsInput.value = serializeRosterItems(items || []);
    itemsInput.dataset.rosterItems = 'true';
    row.appendChild(itemsInput);
    return row;
  }

  function serializeRosterItems(items) {
    return (items || []).map((item) => {
      const name = asText(item && item.name);
      const grade = asText(item && item.grade);
      return grade ? name + ' | ' + grade : name;
    }).filter(Boolean).join('\n');
  }

  function parseRosterItems(text) {
    return splitLines(text).map((line) => {
      const parts = line.split('|').map(asText);
      return { name: parts[0] || '', grade: parts[1] || '' };
    }).filter((item) => item.name || item.grade);
  }

  function serializeGameBlocks(blocks) {
    return (blocks || []).map((block) => {
      if (block.type === 'label') {
        return '# ' + asText(block.text);
      }
      if (block.type === 'game') {
        return [asText(block.resultClass) || 'win', asText(block.opponent), asText(block.gameType), asText(block.score)].join(' | ');
      }
      return '';
    }).filter(Boolean).join('\n');
  }

  function parseGameBlocks(text) {
    return splitLines(text).map((line) => {
      if (line.startsWith('#')) {
        return { type: 'label', text: asText(line.replace(/^#+/, '')) };
      }
      const parts = line.split('|').map(asText);
      const resultClass = ['win', 'loss', 'draw'].includes(parts[0].toLowerCase()) ? parts[0].toLowerCase() : '';
      return {
        type: 'game',
        resultClass,
        opponent: parts[1] || '',
        gameType: parts[2] || '',
        score: parts[3] || ''
      };
    }).filter((block) => (block.type === 'label' && block.text) || (block.type === 'game' && (block.opponent || block.score)));
  }

  function serializeUniformItems(items) {
    return (items || []).map((item) => [asText(item && item.label), asText(item && item.src), asText(item && item.alt)].join(' | ')).filter(Boolean).join('\n');
  }

  function parseUniformItems(text) {
    return splitLines(text).map((line) => {
      const parts = line.split('|').map(asText);
      return { label: parts[0] || '', src: parts[1] || '', alt: parts[2] || '' };
    }).filter((item) => item.label || item.src || item.alt);
  }

  function getSelection() {
    return {
      tabIndex: clampIndex(Number(tabSelect.value), workingState.tabs.length),
      cardIndex: clampIndex(Number(cardSelect.value), (workingState.tabs[Number(tabSelect.value)] && workingState.tabs[Number(tabSelect.value)].cards || []).length)
    };
  }

  function applyFormToWorkingState(selection) {
    const tab = workingState.tabs[selection.tabIndex];
    if (!tab) {
      throw new Error('No section is selected.');
    }
    if (!Array.isArray(tab.cards) || !tab.cards[selection.cardIndex]) {
      throw new Error('No team card is selected.');
    }

    tab.title = asText(sectionTitleInput.value);
    tab.subtitle = asText(sectionSubtitleInput.value);

    const originalCard = deepClone(tab.cards[selection.cardIndex]);
    originalCard.title = asText(cardTitleInput.value);
    originalCard.meta = asText(cardMetaInput.value);
    originalCard.recordBadges = splitLines(recordBadgesInput.value);

    const practiceAccordion = buildPracticeAccordionFromForm();
    const rosterAccordions = buildRosterAccordionsFromForm();
    const gamesAccordion = buildGamesAccordionFromForm();
    const uniformsAccordion = buildUniformsAccordionFromForm();

    const nextAccordions = [];
    let insertedPractice = false;
    let insertedRoster = false;
    let insertedGames = false;
    let insertedUniforms = false;

    (originalCard.accordions || []).forEach((accordion) => {
      const kind = detectAccordionKind(accordion.title);
      if (kind === 'practice') {
        if (!insertedPractice && practiceAccordion) {
          nextAccordions.push(practiceAccordion);
        }
        insertedPractice = true;
        return;
      }
      if (kind === 'roster') {
        if (!insertedRoster && rosterAccordions.length) {
          nextAccordions.push.apply(nextAccordions, rosterAccordions);
        }
        insertedRoster = true;
        return;
      }
      if (kind === 'games') {
        if (!insertedGames && gamesAccordion) {
          nextAccordions.push(gamesAccordion);
        }
        insertedGames = true;
        return;
      }
      if (kind === 'uniforms') {
        if (!insertedUniforms && uniformsAccordion) {
          nextAccordions.push(uniformsAccordion);
        }
        insertedUniforms = true;
        return;
      }
      nextAccordions.push(deepClone(accordion));
    });

    if (!insertedPractice && practiceAccordion) nextAccordions.push(practiceAccordion);
    if (!insertedRoster && rosterAccordions.length) nextAccordions.push.apply(nextAccordions, rosterAccordions);
    if (!insertedGames && gamesAccordion) nextAccordions.push(gamesAccordion);
    if (!insertedUniforms && uniformsAccordion) nextAccordions.push(uniformsAccordion);

    originalCard.accordions = nextAccordions;
    tab.cards[selection.cardIndex] = normalizeCard(originalCard, defaultState.tabs[selection.tabIndex].cards[selection.cardIndex]);
    jsonArea.value = JSON.stringify(tab.cards[selection.cardIndex], null, 2);
  }

  function buildPracticeAccordionFromForm() {
    const title = asText(practiceTitleInput.value) || '📅 Practice & Staff';
    const blocks = Array.from(practiceStaffList.querySelectorAll('[data-staff-row]')).map((row) => ({
      type: 'staff',
      role: asText(row.querySelector('[data-staff-role]') && row.querySelector('[data-staff-role]').value),
      lines: splitLines(row.querySelector('[data-staff-lines]') && row.querySelector('[data-staff-lines]').value)
    })).filter((block) => block.role || block.lines.length);
    return title || blocks.length ? { title, blocks } : null;
  }

  function buildRosterAccordionsFromForm() {
    return Array.from(rosterList.querySelectorAll('[data-roster-row]')).map((row) => {
      const title = asText(row.querySelector('[data-roster-title]') && row.querySelector('[data-roster-title]').value);
      const items = parseRosterItems(row.querySelector('[data-roster-items]') && row.querySelector('[data-roster-items]').value);
      if (!title && !items.length) {
        return null;
      }
      return { title: title || '👥 Roster', blocks: [{ type: 'rosterGrid', items }] };
    }).filter(Boolean);
  }

  function buildGamesAccordionFromForm() {
    const title = asText(gamesTitleInput.value) || '🏆 Game Results';
    const blocks = parseGameBlocks(gamesTextInput.value);
    return title || blocks.length ? { title, blocks } : null;
  }

  function buildUniformsAccordionFromForm() {
    const title = asText(uniformsTitleInput.value) || '👕 Uniforms';
    const items = parseUniformItems(uniformsTextInput.value);
    return title || items.length ? { title, blocks: [{ type: 'uniformGallery', items }] } : null;
  }

  function setStatus(message, tone) {
    if (!adminStatus) {
      return;
    }
    adminStatus.textContent = message;
    if (tone) {
      adminStatus.dataset.tone = tone;
      return;
    }
    delete adminStatus.dataset.tone;
  }
})();
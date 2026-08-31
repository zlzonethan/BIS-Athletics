(function () {
  // ═══════════════════════════════════════════════════
  //  Config
  // ═══════════════════════════════════════════════════
  var STORAGE_KEY_PREFIX = 'bis_site_editor_page::';
  var ADMIN_EMAILS = ['iamsunwo@gmail.com', 'tcassell@bisce.net', 'athletics@bisce.net', '30ekim@bisce.net', '30epark@bisce.net'];
  var SESSION_AUTH_KEY = 'bis_site_editor_session';
  var EDITOR_STYLE_ID = 'bis-site-editor-style';
  var PASS_MODAL_ID = 'passModal';
  var EXCLUDED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION']);
  var EDITOR_EXCLUDE_SELECTOR = [
    '[data-site-editor-ui="true"]',
    '#adminDock', '#adminModal', '#passModal',
    '.bis-editor-toolbar', '.bis-editor-fab', '.bis-roster-panel'
  ].join(',');
  var MAX_UNDO = 50;

  // ═══════════════════════════════════════════════════
  //  Firebase Init
  // ═══════════════════════════════════════════════════
  var siteEditorDb = null;
  var siteEditorAuth = null;
  var siteEditorAuthReady = Promise.resolve(null);
  var SITE_EDITOR_COLLECTION = 'siteEditorPages';

  function initSiteEditorFirebase() {
    try {
      var cfg = window.BIS_FIREBASE_CONFIG;
      if (!cfg || !cfg.apiKey || !window.firebase) return null;
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      if (typeof firebase.auth === 'function') {
        siteEditorAuth = firebase.auth();
        siteEditorAuthReady = new Promise(function (resolve) {
          var unsubscribe = siteEditorAuth.onAuthStateChanged(function (user) {
            unsubscribe(); resolve(user || null);
          }, function () { resolve(null); });
        });
      }
      return firebase.firestore();
    } catch (e) { return null; }
  }
  siteEditorDb = initSiteEditorFirebase();

  function getFirebaseDocId() {
    var p = location.pathname || '/index.html';
    if (p === '/') p = '/index.html';
    return p.replace(/[^a-zA-Z0-9/_-]/g, '_');
  }

  // ═══════════════════════════════════════════════════
  //  State Variables
  // ═══════════════════════════════════════════════════
  var toolbarEl = null;
  var fabEl = null;
  var statusEl = null;
  var undoBtnEl = null;
  var redoBtnEl = null;
  var rosterPanelEl = null;
  var fieldLabelEl = null;
  var editMode = false;
  var savedState = null;
  var defaultState = { fields: {}, rosters: {}, photos: [] };
  var rescanFrame = 0;
  var rosterSelect = null;
  var rosterRows = null;
  var rosterAddButton = null;
  var rosterDrafts = {};
  var rosterSelectedKey = '';
  var undoStack = [];
  var redoStack = [];
  var statusTimer = 0;
  var lastSavedSnapshot = '';

  // ═══════════════════════════════════════════════════
  //  Init
  // ═══════════════════════════════════════════════════
  injectEditorStyles();

  defaultState = captureState();
  var localSaved = loadLocalState();
  if (localSaved) applyReadOnlyState(localSaved);
  if (siteEditorDb) {
    siteEditorDb.collection(SITE_EDITOR_COLLECTION).doc(getFirebaseDocId())
      .onSnapshot(function (doc) {
        if (doc.exists) {
          var remoteState = doc.data();
          writeJson(getStorageKey(), remoteState);
          if (!editMode) applyReadOnlyState(remoteState);
        }
      }, function (err) { console.warn('site-editor firebase listen error', err); });
  }

  initAdminEditor();

  async function initAdminEditor() {
    var isAdminQ = hasAdminQuery() || hasSessionAuthorization();
    var user = await getResolvedAdminUser();
    var isAuthAdmin = isAuthorizedAdminUser(user);
    if (!isAdminQ && !isAuthAdmin) return;

    createToolbar();
    createRosterPanel();
    createFab();
    createFieldLabel();

    defaultState = captureState();
    savedState = normalizeState(loadLocalState() || defaultState);
    lastSavedSnapshot = JSON.stringify(savedState);
    applyState(savedState);
    bindEditableFields();
    observeDocument();
    bindOnlineOffline();

    if (hasAdminQuery()) {
      if (!isAuthAdmin) {
        var auth = await promptPass();
        if (!auth.ok) { showAdminAuthError(auth.reason, auth.errorCode); clearAdminQuery(); return; }
        setSessionAuthorization(true);
      }
      clearAdminQuery();
      enterEditMode();
    }

    if (siteEditorDb) {
      siteEditorDb.collection(SITE_EDITOR_COLLECTION).doc(getFirebaseDocId())
        .onSnapshot(function (doc) {
          if (doc.exists) {
            var rs = normalizeState(doc.data());
            savedState = rs;
            writeJson(getStorageKey(), rs);
            if (!editMode) applyState(rs);
          }
        }, function () {});
    }
  }

  // ═══════════════════════════════════════════════════
  //  Styles
  // ═══════════════════════════════════════════════════
  function injectEditorStyles() {
    if (document.getElementById(EDITOR_STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = EDITOR_STYLE_ID;
    style.textContent = [
      /* ── FAB ── */
      '.bis-editor-fab{position:fixed;bottom:24px;right:24px;z-index:99990;appearance:none;border:none;',
      'background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#f8fafc;font:inherit;font-size:14px;',
      'font-weight:700;padding:14px 24px;border-radius:999px;cursor:pointer;box-shadow:0 8px 32px rgba(15,23,42,.35);',
      'transition:transform .2s,box-shadow .2s,opacity .25s;user-select:none}',
      '.bis-editor-fab:hover{transform:translateY(-2px) scale(1.03);box-shadow:0 12px 40px rgba(15,23,42,.45)}',
      '.bis-editor-fab.hidden{opacity:0;pointer-events:none;transform:translateY(8px)}',

      /* ── Toolbar ── */
      '.bis-editor-toolbar{position:fixed;top:0;left:0;right:0;z-index:99995;display:flex;align-items:center;',
      'justify-content:space-between;padding:0 16px;height:52px;background:rgba(15,23,42,.97);',
      'backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.06);',
      'box-shadow:0 4px 24px rgba(0,0,0,.25);color:#f8fafc;font-family:inherit;',
      'transform:translateY(-100%);transition:transform .35s cubic-bezier(.4,0,.2,1)}',
      '.bis-editor-toolbar.visible{transform:translateY(0)}',
      '.bis-editor-toolbar-group{display:flex;align-items:center;gap:6px}',

      /* ── Toolbar Buttons ── */
      '.bis-tb-btn{appearance:none;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);',
      'color:#f8fafc;font:inherit;font-size:13px;font-weight:600;padding:7px 14px;border-radius:8px;',
      'cursor:pointer;transition:background .15s,opacity .15s;white-space:nowrap;user-select:none}',
      '.bis-tb-btn:hover:not(:disabled){background:rgba(255,255,255,.14)}',
      '.bis-tb-btn:active:not(:disabled){background:rgba(255,255,255,.2)}',
      '.bis-tb-btn:disabled{opacity:.3;cursor:default}',
      '.bis-tb-btn.primary{background:#2563eb;border-color:#2563eb}',
      '.bis-tb-btn.primary:hover:not(:disabled){background:#1d4ed8}',
      '.bis-tb-btn.danger{color:#fca5a5;border-color:rgba(239,68,68,.2)}',
      '.bis-tb-btn.danger:hover{background:rgba(239,68,68,.15)}',
      '.bis-tb-btn.active{background:rgba(99,102,241,.25);border-color:rgba(99,102,241,.4)}',
      '.bis-tb-divider{width:1px;height:24px;background:rgba(255,255,255,.1);margin:0 4px}',
      '.bis-tb-label{margin-left:4px}',

      /* ── Save unsaved dot ── */
      '.bis-tb-btn.has-changes{position:relative}',
      '.bis-tb-btn.has-changes::after{content:"";position:absolute;top:3px;right:3px;width:7px;height:7px;',
      'background:#f97316;border-radius:50%;animation:bisPulse 2s infinite}',
      '@keyframes bisPulse{0%,100%{opacity:1}50%{opacity:.4}}',

      /* ── Status ── */
      '.bis-tb-status{font-size:13px;opacity:.6;max-width:300px;overflow:hidden;text-overflow:ellipsis;',
      'white-space:nowrap;transition:opacity .2s,color .2s}',
      '.bis-tb-status[data-tone="ok"]{color:#34d399;opacity:1}',
      '.bis-tb-status[data-tone="warn"]{color:#fca5a5;opacity:1}',

      /* ── Body offset ── */
      'body.bis-editor-active{padding-top:56px!important;transition:padding-top .35s cubic-bezier(.4,0,.2,1)}',

      /* ── Edit mode body tint ── */
      'body.site-admin-editing::before{content:"";position:fixed;inset:0;z-index:0;',
      'background:rgba(37,99,235,.015);pointer-events:none;transition:opacity .4s}',

      /* ── Roster Panel ── */
      '.bis-roster-panel{position:fixed;top:52px;right:0;bottom:0;width:400px;max-width:92vw;z-index:99994;',
      'background:#fff;border-left:1px solid rgba(148,163,184,.15);box-shadow:-8px 0 40px rgba(0,0,0,.12);',
      'transform:translateX(100%);transition:transform .35s cubic-bezier(.4,0,.2,1);overflow-y:auto;',
      'padding:24px 20px;display:grid;gap:16px;align-content:start}',
      'body.dark .bis-roster-panel{background:#0f172a;border-color:rgba(148,163,184,.1)}',
      '.bis-roster-panel.visible{transform:translateX(0)}',
      '.bis-roster-panel-header{display:flex;align-items:center;justify-content:space-between}',
      '.bis-roster-panel-title{font-weight:800;font-size:17px}',
      '.bis-roster-panel-close{appearance:none;border:none;background:rgba(148,163,184,.1);color:inherit;',
      'width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:16px;display:flex;',
      'align-items:center;justify-content:center;transition:background .15s}',
      '.bis-roster-panel-close:hover{background:rgba(148,163,184,.2)}',

      /* ── Editable field highlights ── */
      'body.site-admin-editing [data-site-editor-key]{outline:2px dashed rgba(37,99,235,.35);',
      'outline-offset:3px;border-radius:6px;cursor:text;transition:outline-color .15s,background .15s,box-shadow .15s}',
      'body.site-admin-editing [data-site-editor-key]:hover{outline-color:rgba(37,99,235,.65);',
      'background:rgba(37,99,235,.04);outline-style:dashed}',
      'body.site-admin-editing [data-site-editor-key]:focus{outline-style:solid;outline-color:#2563eb;',
      'background:rgba(37,99,235,.06);box-shadow:0 0 0 4px rgba(37,99,235,.1)}',

      /* ── Floating field label ── */
      '.bis-field-label{position:fixed;z-index:99993;pointer-events:none;background:#2563eb;color:#fff;',
      'font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;white-space:nowrap;line-height:1.4;',
      'opacity:0;transition:opacity .12s,transform .12s;transform:translateY(2px)}',
      '.bis-field-label.visible{opacity:1;transform:translateY(0)}',

      /* ── Toast ── */
      '.bis-toast{position:fixed;top:64px;left:50%;transform:translateX(-50%) translateY(-16px);',
      'z-index:99998;padding:10px 24px;border-radius:12px;font-size:14px;font-weight:600;',
      'color:#fff;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;',
      'box-shadow:0 8px 32px rgba(0,0,0,.2)}',
      '.bis-toast.visible{opacity:1;transform:translateX(-50%) translateY(0)}',
      '.bis-toast.success{background:#059669}',
      '.bis-toast.error{background:#dc2626}',
      '.bis-toast.info{background:#475569}',

      /* ── Change summary modal ── */
      '.bis-changes-overlay{display:none;position:fixed;inset:0;z-index:99998;',
      'background:rgba(2,6,23,.55);align-items:center;justify-content:center;',
      'padding:24px;backdrop-filter:blur(4px)}',
      '.bis-changes-overlay.visible{display:flex}',
      '.bis-changes-card{background:#fff;border-radius:20px;padding:28px;max-width:480px;width:100%;',
      'max-height:80vh;overflow-y:auto;box-shadow:0 30px 60px rgba(0,0,0,.3);',
      'border:1px solid rgba(148,163,184,.15)}',
      '.bis-changes-title{font-weight:800;font-size:18px;margin-bottom:16px}',
      '.bis-changes-list{display:grid;gap:8px;margin-bottom:20px}',
      '.bis-changes-item{padding:10px 12px;border-radius:10px;background:rgba(37,99,235,.04);',
      'border:1px solid rgba(37,99,235,.08);font-size:13px;line-height:1.5}',
      '.bis-changes-field-name{font-weight:700;color:#2563eb;font-size:11px;margin-bottom:2px;text-transform:uppercase;letter-spacing:.5px}',
      '.bis-changes-old{color:#94a3b8;text-decoration:line-through}',
      '.bis-changes-new{color:#0f172a;font-weight:600}',
      '.bis-changes-actions{display:flex;gap:10px;justify-content:flex-end}',
      '.bis-modal-btn{appearance:none;padding:10px 20px;border-radius:10px;font:inherit;font-size:14px;font-weight:600;',
      'cursor:pointer;transition:background .15s}',
      '.bis-modal-btn.publish{border:none;background:#2563eb;color:#fff}',
      '.bis-modal-btn.publish:hover{background:#1d4ed8}',
      '.bis-modal-btn.cancel{border:1px solid rgba(148,163,184,.3);background:#fff;color:#0f172a}',
      '.bis-modal-btn.cancel:hover{background:rgba(148,163,184,.06)}',

      /* ── Paste roster modal ── */
      '.bis-paste-overlay{display:none;position:fixed;inset:0;z-index:99998;',
      'background:rgba(2,6,23,.55);align-items:center;justify-content:center;',
      'padding:24px;backdrop-filter:blur(4px)}',
      '.bis-paste-overlay.visible{display:flex}',
      '.bis-paste-card{background:#fff;border-radius:20px;padding:28px;max-width:420px;',
      'width:100%;box-shadow:0 30px 60px rgba(0,0,0,.3)}',
      '.bis-paste-textarea{width:100%;min-height:140px;padding:12px;border-radius:10px;',
      'border:1px solid rgba(148,163,184,.3);font:inherit;font-size:14px;resize:vertical;',
      'line-height:1.6;color:#0f172a}',

      /* ── Roster editor ── */
      '.bis-roster-toolbar{display:grid;gap:8px;grid-template-columns:1fr auto;align-items:end}',
      '.bis-roster-field{display:grid;gap:6px}',
      '.bis-roster-label{font-size:12px;font-weight:700;opacity:.7}',
      '.bis-roster-select,.bis-roster-input{width:100%;padding:10px 12px;border-radius:10px;',
      'border:1px solid rgba(148,163,184,.24);background:rgba(255,255,255,.9);color:#0f172a;font:inherit;font-size:14px}',
      'body.dark .bis-roster-select,body.dark .bis-roster-input{background:rgba(15,23,42,.8);color:#f8fafc}',
      '.bis-roster-list{display:grid;gap:8px}',
      '.bis-roster-row{display:grid;grid-template-columns:1.6fr .7fr auto;gap:8px;align-items:center}',
      '.bis-roster-remove{min-width:38px;min-height:38px;padding:0;appearance:none;border:1px solid rgba(148,163,184,.2);',
      'background:rgba(239,68,68,.06);color:#ef4444;border-radius:8px;cursor:pointer;font-size:18px;font-weight:700;',
      'transition:background .15s}',
      '.bis-roster-remove:hover{background:rgba(239,68,68,.15)}',
      '.bis-roster-empty{padding:12px;border-radius:10px;border:1px dashed rgba(148,163,184,.25);opacity:.65;font-size:13px}',
      '.bis-roster-note{font-size:13px;opacity:.65;line-height:1.5}',
      '.bis-roster-add-btn{appearance:none;border:1px solid rgba(37,99,235,.3);background:rgba(37,99,235,.06);',
      'color:#2563eb;font:inherit;font-size:13px;font-weight:700;padding:10px 16px;border-radius:10px;',
      'cursor:pointer;transition:background .15s;width:100%}',
      '.bis-roster-add-btn:hover{background:rgba(37,99,235,.12)}',
      '.bis-roster-paste-btn{appearance:none;border:1px solid rgba(99,102,241,.3);background:rgba(99,102,241,.06);',
      'color:#6366f1;font:inherit;font-size:13px;font-weight:700;padding:10px 16px;border-radius:10px;',
      'cursor:pointer;transition:background .15s;width:100%}',
      '.bis-roster-paste-btn:hover{background:rgba(99,102,241,.12)}',

      /* ── Mobile ── */
      '@media(max-width:640px){',
      '.bis-tb-label{display:none}',
      '.bis-editor-toolbar{height:44px;padding:0 8px}',
      '.bis-tb-btn{padding:6px 10px;font-size:15px}',
      '.bis-tb-divider{height:20px}',
      '.bis-tb-status{display:none}',
      'body.bis-editor-active{padding-top:48px!important}',
      '.bis-editor-fab{bottom:16px;right:16px;padding:12px 18px;font-size:13px}',
      '.bis-field-label{font-size:10px}',
      '.bis-roster-panel{top:auto;bottom:0;right:0;width:100%;max-width:100%;height:65vh;',
      'border-radius:20px 20px 0 0;border-left:none;border-top:1px solid rgba(148,163,184,.15);',
      'transform:translateY(100%)}',
      '.bis-roster-panel.visible{transform:translateY(0)}',
      '.bis-roster-row{grid-template-columns:1.4fr .6fr auto}',
      '.bis-toast{top:52px;font-size:13px;padding:8px 18px}',
      '.bis-changes-card,.bis-paste-card{padding:20px;border-radius:16px}',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ═══════════════════════════════════════════════════
  //  UI Creation
  // ═══════════════════════════════════════════════════
  function createFab() {
    fabEl = document.createElement('button');
    fabEl.className = 'bis-editor-fab';
    fabEl.textContent = '\u270F\uFE0F Edit Site';
    fabEl.setAttribute('data-site-editor-ui', 'true');
    document.body.appendChild(fabEl);
    fabEl.addEventListener('click', async function () {
      if (editMode) return;
      if (!(await hasAuthorizedAdminSession())) {
        var auth = await promptPass();
        if (!auth.ok) { showAdminAuthError(auth.reason, auth.errorCode); return; }
        setSessionAuthorization(true);
      }
      enterEditMode();
    });
  }

  function createToolbar() {
    toolbarEl = document.createElement('div');
    toolbarEl.className = 'bis-editor-toolbar';
    toolbarEl.setAttribute('data-site-editor-ui', 'true');
    toolbarEl.innerHTML = '<div class="bis-editor-toolbar-group">'
      + '<button class="bis-tb-btn" id="bisEditorClose" title="Close editor">\u2715</button>'
      + '<div class="bis-tb-divider"></div>'
      + '<button class="bis-tb-btn primary" id="bisEditorSave" title="Save &amp; publish (Ctrl+S)">\uD83D\uDCBE<span class="bis-tb-label"> Save</span></button>'
      + '<button class="bis-tb-btn" id="bisEditorUndo" title="Undo (Ctrl+Z)" disabled>\u21A9<span class="bis-tb-label"> Undo</span></button>'
      + '<button class="bis-tb-btn" id="bisEditorRedo" title="Redo (Ctrl+Shift+Z)" disabled>\u21AA<span class="bis-tb-label"> Redo</span></button>'
      + '<div class="bis-tb-divider"></div>'
      + '<button class="bis-tb-btn" id="bisEditorRosterBtn" title="Roster editor">\uD83D\uDC65<span class="bis-tb-label"> Roster</span></button>'
      + '<button class="bis-tb-btn" id="bisEditorPhotoBtn" title="Add photo">\uD83D\DCF7<span class="bis-tb-label"> Photo</span></button>'
      + '</div>'
      + '<div class="bis-editor-toolbar-group">'
      + '<span class="bis-tb-status" id="bisEditorStatus">Ready</span>'
      + '<button class="bis-tb-btn danger" id="bisEditorReset" title="Reset to default">Reset</button>'
      + '</div>';
    document.body.appendChild(toolbarEl);

    statusEl = toolbarEl.querySelector('#bisEditorStatus');
    undoBtnEl = toolbarEl.querySelector('#bisEditorUndo');
    redoBtnEl = toolbarEl.querySelector('#bisEditorRedo');
    toolbarEl.querySelector('#bisEditorClose').addEventListener('click', exitEditMode);
    toolbarEl.querySelector('#bisEditorSave').addEventListener('click', handleSave);
    undoBtnEl.addEventListener('click', handleUndo);
    redoBtnEl.addEventListener('click', handleRedo);
    toolbarEl.querySelector('#bisEditorRosterBtn').addEventListener('click', function () { toggleRosterPanel(); });
    toolbarEl.querySelector('#bisEditorPhotoBtn').addEventListener('click', openPhotoPicker);
    toolbarEl.querySelector('#bisEditorReset').addEventListener('click', handleReset);
  }

  function openPhotoPicker() {
    var archive = document.querySelector('.site-photo-archive');
    if (!archive) { showToast('Add a photo archive section first', 'error'); return; }
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var empty = archive.querySelector('.photo-archive-empty');
        if (empty) empty.remove();
        var image = document.createElement('img');
        image.className = 'photo-archive-image';
        image.src = reader.result;
        image.alt = 'Team photo';
        archive.querySelector('.photo-archive-grid').appendChild(image);
        pushUndoState();
        showToast('Photo added. Click Save to publish it.', 'success');
      };
      reader.readAsDataURL(file);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  }

  function createRosterPanel() {
    rosterPanelEl = document.createElement('div');
    rosterPanelEl.className = 'bis-roster-panel';
    rosterPanelEl.setAttribute('data-site-editor-ui', 'true');
    rosterPanelEl.innerHTML = '<div class="bis-roster-panel-header">'
      + '<div class="bis-roster-panel-title">Roster Editor</div>'
      + '<button class="bis-roster-panel-close" id="bisRosterClose" title="Close">\u2715</button>'
      + '</div>'
      + '<p class="bis-roster-note">Add, remove, and edit players. Click <strong>Save</strong> in the toolbar to publish.</p>'
      + '<div class="bis-roster-toolbar">'
      + '<label class="bis-roster-field"><span class="bis-roster-label">Roster Section</span>'
      + '<select class="bis-roster-select" id="bisRosterSelect"></select></label>'
      + '<div style="display:grid;gap:6px">'
      + '<button type="button" class="bis-roster-add-btn" id="bisRosterAdd">+ Add Player</button>'
      + '<button type="button" class="bis-roster-paste-btn" id="bisRosterPaste">\uD83D\uDCCB Paste List</button>'
      + '</div></div>'
      + '<div class="bis-roster-list" id="bisRosterRows"></div>';
    document.body.appendChild(rosterPanelEl);

    rosterPanelEl.querySelector('#bisRosterClose').addEventListener('click', function () { toggleRosterPanel(false); });
    rosterSelect = rosterPanelEl.querySelector('#bisRosterSelect');
    rosterRows = rosterPanelEl.querySelector('#bisRosterRows');
    rosterAddButton = rosterPanelEl.querySelector('#bisRosterAdd');
    rosterSelect.addEventListener('change', function () { rosterSelectedKey = rosterSelect.value || ''; renderRosterEditor(); });
    rosterAddButton.addEventListener('click', function () {
      var draft = getRosterDraft(rosterSelectedKey);
      draft.push({ name: '', grade: '' });
      renderRosterEditor();
      var inputs = rosterRows.querySelectorAll('.bis-roster-input');
      if (inputs.length >= 2) inputs[inputs.length - 2].focus();
    });
    rosterPanelEl.querySelector('#bisRosterPaste').addEventListener('click', showPasteRosterModal);
  }

  function createFieldLabel() {
    fieldLabelEl = document.createElement('div');
    fieldLabelEl.className = 'bis-field-label';
    fieldLabelEl.setAttribute('data-site-editor-ui', 'true');
    document.body.appendChild(fieldLabelEl);
  }

  // ═══════════════════════════════════════════════════
  //  Edit Mode
  // ═══════════════════════════════════════════════════
  function enterEditMode() {
    if (editMode) return;
    editMode = true;
    document.body.classList.add('site-admin-editing', 'bis-editor-active');
    if (toolbarEl) toolbarEl.classList.add('visible');
    if (fabEl) fabEl.classList.add('hidden');
    lastSavedSnapshot = JSON.stringify(captureState());
    pushUndoState();
    getEditableFields().forEach(function (el) {
      el.contentEditable = 'true';
      el.spellcheck = true;
      el.setAttribute('tabindex', '0');
    });
    scheduleRescan(true);
    setStatus('Click any text to edit', 'ok');
  }

  function exitEditMode() {
    if (!editMode) return;
    editMode = false;
    document.body.classList.remove('site-admin-editing', 'bis-editor-active');
    if (toolbarEl) toolbarEl.classList.remove('visible');
    if (fabEl) fabEl.classList.remove('hidden');
    if (rosterPanelEl) rosterPanelEl.classList.remove('visible');
    hideFieldLabel();
    clearUnsavedIndicator();
    getEditableFields().forEach(function (el) {
      el.contentEditable = 'false';
      el.spellcheck = false;
      el.removeAttribute('tabindex');
      el.blur();
    });
    setStatus('Ready', '');
  }

  // ═══════════════════════════════════════════════════
  //  Undo / Redo
  // ═══════════════════════════════════════════════════
  function pushUndoState() {
    var snap = JSON.stringify(captureState());
    if (undoStack.length && undoStack[undoStack.length - 1] === snap) return;
    undoStack.push(snap);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
    updateUndoRedoButtons();
    markUnsavedChanges();
  }

  function handleUndo() {
    if (undoStack.length <= 1) return;
    redoStack.push(undoStack.pop());
    var prev = JSON.parse(undoStack[undoStack.length - 1]);
    applyState(prev);
    savedState = normalizeState(prev);
    updateUndoRedoButtons();
    markUnsavedChanges();
    setStatus('Undone', 'ok');
  }

  function handleRedo() {
    if (!redoStack.length) return;
    var next = redoStack.pop();
    undoStack.push(next);
    var parsed = JSON.parse(next);
    applyState(parsed);
    savedState = normalizeState(parsed);
    updateUndoRedoButtons();
    markUnsavedChanges();
    setStatus('Redone', 'ok');
  }

  function updateUndoRedoButtons() {
    if (undoBtnEl) undoBtnEl.disabled = undoStack.length <= 1;
    if (redoBtnEl) redoBtnEl.disabled = redoStack.length === 0;
  }

  function markUnsavedChanges() {
    var saveBtn = toolbarEl && toolbarEl.querySelector('#bisEditorSave');
    if (!saveBtn) return;
    var current = JSON.stringify(captureState());
    saveBtn.classList.toggle('has-changes', current !== lastSavedSnapshot);
  }

  function clearUnsavedIndicator() {
    var saveBtn = toolbarEl && toolbarEl.querySelector('#bisEditorSave');
    if (saveBtn) saveBtn.classList.remove('has-changes');
  }

  // ═══════════════════════════════════════════════════
  //  Save / Reset
  // ═══════════════════════════════════════════════════
  function handleSave() {
    pushUndoState();
    var currentState = captureState();
    var diff = getDiff(currentState);
    if (!diff.length) {
      showToast('No changes to save', 'info');
      return;
    }
    showChangeSummary(diff, function () {
      doSave(currentState);
    });
  }

  function doSave(currentState) {
    var nextState = normalizeState(currentState);
    savedState = nextState;
    lastSavedSnapshot = JSON.stringify(captureState());
    writeJson(getStorageKey(), savedState);
    applyState(savedState);
    clearUnsavedIndicator();

    if (!navigator.onLine) {
      showToast('\uD83D\uDCF4 Offline \u2014 saved locally', 'error');
      return;
    }
    if (siteEditorDb) {
      var user = siteEditorAuth && siteEditorAuth.currentUser;
      if (!user) { showToast('Not signed in \u2014 saved locally', 'error'); return; }
      var saveBtn = toolbarEl && toolbarEl.querySelector('#bisEditorSave');
      var labelSpan = saveBtn && saveBtn.querySelector('.bis-tb-label');
      if (saveBtn) saveBtn.disabled = true;
      if (labelSpan) labelSpan.textContent = ' Saving\u2026';
      siteEditorDb.collection(SITE_EDITOR_COLLECTION).doc(getFirebaseDocId()).set(savedState)
        .then(function () {
          showToast('\u2713 Published!', 'success');
          if (saveBtn) saveBtn.disabled = false;
          if (labelSpan) labelSpan.textContent = ' Save';
        })
        .catch(function (err) {
          console.error('Firestore save error:', err);
          showToast('Failed: ' + (err.code || err.message), 'error');
          if (saveBtn) saveBtn.disabled = false;
          if (labelSpan) labelSpan.textContent = ' Save';
        });
    } else {
      showToast('Saved locally', 'success');
    }
  }

  function handleReset() {
    if (!confirm('Reset all text to default? This cannot be undone.')) return;
    exitEditMode();
    applyState(defaultState);
    savedState = normalizeState(defaultState);
    lastSavedSnapshot = JSON.stringify(captureState());
    writeJson(getStorageKey(), savedState);
    if (siteEditorDb) {
      siteEditorDb.collection(SITE_EDITOR_COLLECTION).doc(getFirebaseDocId()).delete().catch(function () {});
    }
    showToast('Reset to default', 'info');
  }

  // ═══════════════════════════════════════════════════
  //  Change Diff & Summary
  // ═══════════════════════════════════════════════════
  function getDiff(currentState) {
    var changes = [];
    var savedFields = savedState && savedState.fields ? savedState.fields : defaultState.fields;
    var savedRosters = savedState && savedState.rosters ? savedState.rosters : {};

    Object.keys(currentState.fields).forEach(function (key) {
      var nv = currentState.fields[key];
      var ov = Object.prototype.hasOwnProperty.call(savedFields, key) ? savedFields[key] : '';
      if (nv !== ov) {
        var el = document.querySelector('[data-site-editor-key="' + CSS.escape(key) + '"]');
        changes.push({ type: 'field', label: el ? getFieldLabel(el) : key, oldVal: ov, newVal: nv });
      }
    });

    Object.keys(currentState.rosters || {}).forEach(function (key) {
      var nj = JSON.stringify(currentState.rosters[key] || []);
      var oj = JSON.stringify(savedRosters[key] || []);
      if (nj !== oj) {
        var grid = getRosterSections().find(function (g) { return ensureRosterKey(g) === key; });
        var newLen = (currentState.rosters[key] || []).length;
        var oldLen = (savedRosters[key] || []).length;
        changes.push({ type: 'roster', label: grid ? getRosterLabel(grid) : key, added: newLen - oldLen, total: newLen });
      }
    });
    if (JSON.stringify(currentState.photos || []) !== JSON.stringify(savedState.photos || [])) {
      changes.push({ type: 'photos', label: 'Team Photo Archive', total: (currentState.photos || []).length });
    }
    return changes;
  }

  function showChangeSummary(diff, onPublish) {
    var overlay = document.getElementById('bisChangesOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'bisChangesOverlay';
      overlay.className = 'bis-changes-overlay';
      overlay.setAttribute('data-site-editor-ui', 'true');
      document.body.appendChild(overlay);
    }
    var html = '<div class="bis-changes-card">'
      + '<div class="bis-changes-title">Publish ' + diff.length + ' change' + (diff.length !== 1 ? 's' : '') + '?</div>'
      + '<div class="bis-changes-list">';
    diff.forEach(function (c) {
      if (c.type === 'field') {
        var ov = c.oldVal.length > 60 ? c.oldVal.substring(0, 60) + '\u2026' : c.oldVal;
        var nv = c.newVal.length > 60 ? c.newVal.substring(0, 60) + '\u2026' : c.newVal;
        html += '<div class="bis-changes-item">'
          + '<div class="bis-changes-field-name">' + escapeHtml(c.label) + '</div>'
          + '<span class="bis-changes-old">' + escapeHtml(ov || '(empty)') + '</span>'
          + ' \u2192 <span class="bis-changes-new">' + escapeHtml(nv || '(empty)') + '</span>'
          + '</div>';
      } else {
        if (c.type === 'photos') {
          html += '<div class="bis-changes-item"><div class="bis-changes-field-name">' + escapeHtml(c.label) + '</div>'
            + c.total + ' photo' + (c.total !== 1 ? 's' : '') + '</div>';
          return;
        }
        var desc = c.added > 0 ? '+' + c.added + ' players' : c.added < 0 ? c.added + ' players' : 'modified';
        html += '<div class="bis-changes-item">'
          + '<div class="bis-changes-field-name">' + escapeHtml(c.label) + '</div>'
          + escapeHtml(desc) + ' (total: ' + c.total + ')'
          + '</div>';
      }
    });
    html += '</div><div class="bis-changes-actions">'
      + '<button class="bis-modal-btn cancel" id="bisChangesCancel">Cancel</button>'
      + '<button class="bis-modal-btn publish" id="bisChangesPublish">\uD83D\uDE80 Publish</button>'
      + '</div></div>';
    overlay.innerHTML = html;
    overlay.classList.add('visible');
    var pub = overlay.querySelector('#bisChangesPublish');
    var can = overlay.querySelector('#bisChangesCancel');
    function close() { overlay.classList.remove('visible'); }
    pub.addEventListener('click', function () { close(); onPublish(); });
    can.addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  }

  // ═══════════════════════════════════════════════════
  //  Toast
  // ═══════════════════════════════════════════════════
  function showToast(message, type) {
    var toast = document.getElementById('bisToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'bisToast';
      toast.setAttribute('data-site-editor-ui', 'true');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = 'bis-toast ' + (type || 'info');
    void toast.offsetHeight;
    toast.classList.add('visible');
    setTimeout(function () { toast.classList.remove('visible'); }, 3000);
  }

  // ═══════════════════════════════════════════════════
  //  Paste Roster Modal
  // ═══════════════════════════════════════════════════
  function showPasteRosterModal() {
    var overlay = document.getElementById('bisPasteOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'bisPasteOverlay';
      overlay.className = 'bis-paste-overlay';
      overlay.setAttribute('data-site-editor-ui', 'true');
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = '<div class="bis-paste-card">'
      + '<div style="font-weight:800;font-size:18px;margin-bottom:4px">Paste Player List</div>'
      + '<div style="font-size:13px;color:#64748b;margin-bottom:16px">One player per line: <strong>Name, Grade</strong></div>'
      + '<textarea class="bis-paste-textarea" id="bisPasteText" placeholder="John Doe, 10\nJane Smith, 9\nBob Lee, 11"></textarea>'
      + '<div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end">'
      + '<button class="bis-modal-btn cancel" id="bisPasteCancel">Cancel</button>'
      + '<button class="bis-modal-btn publish" id="bisPasteAdd">Add Players</button>'
      + '</div></div>';
    overlay.classList.add('visible');
    var textarea = overlay.querySelector('#bisPasteText');
    textarea.focus();
    function close() { overlay.classList.remove('visible'); }
    overlay.querySelector('#bisPasteAdd').addEventListener('click', function () {
      var text = textarea.value || '';
      var lines = text.split(/\n/).filter(function (l) { return l.trim(); });
      var count = 0;
      var draft = getRosterDraft(rosterSelectedKey);
      lines.forEach(function (line) {
        var parts = line.split(/[,\t]/).map(function (s) { return s.trim(); });
        var name = parts[0] || '';
        var grade = parts[1] || '';
        if (name) { draft.push({ name: name, grade: grade }); count++; }
      });
      if (count) {
        commitRosterDraft(rosterSelectedKey);
        renderRosterEditor();
        showToast('Added ' + count + ' player' + (count > 1 ? 's' : ''), 'success');
      }
      close();
    });
    overlay.querySelector('#bisPasteCancel').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  }

  // ═══════════════════════════════════════════════════
  //  Field Label
  // ═══════════════════════════════════════════════════
  function getFieldLabel(element) {
    if (!element || !(element instanceof HTMLElement)) return '';
    var nav = element.closest('nav,.nav,.navbar');
    if (nav) return 'Navigation';
    var hero = element.closest('[class*="hero"],.hero');
    if (hero) {
      var tag = element.tagName.toLowerCase();
      if (tag === 'h1' || tag === 'h2') return 'Hero Title';
      if (tag === 'p') return 'Hero Text';
      return 'Hero Section';
    }
    var card = element.closest('.hs-card,.team-card');
    if (card) {
      var ct = card.querySelector('.hs-title,.team-title');
      var prefix = ct ? cleanText(ct.textContent) : 'Card';
      if (prefix.length > 30) prefix = prefix.substring(0, 28) + '\u2026';
      if (element === ct || element.closest('.hs-title,.team-title')) return prefix;
      return prefix + ' \u203A Text';
    }
    var acc = element.closest('.accordion-item');
    if (acc) {
      var at = acc.querySelector('.accordion-title');
      if (at) { var atxt = cleanText(at.textContent); if (atxt.length < 40) return atxt; }
    }
    var panel = element.closest('.panel,section,.section');
    if (panel) {
      var pt = panel.querySelector('.panel-title,.section-title,h2,h3');
      if (pt && pt !== element) {
        var ptxt = cleanText(pt.textContent);
        if (ptxt.length < 40) return ptxt + ' \u203A Text';
      }
    }
    if (element.closest('footer')) return 'Footer';
    var tagName = element.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tagName)) return 'Heading';
    if (tagName === 'a') return 'Link';
    return 'Text';
  }

  function showFieldLabel(element) {
    if (!fieldLabelEl || !editMode) return;
    var label = getFieldLabel(element);
    if (!label) { hideFieldLabel(); return; }
    fieldLabelEl.textContent = label;
    var rect = element.getBoundingClientRect();
    var labelH = 22;
    var top = rect.top + window.scrollY - labelH - 4;
    if (top < window.scrollY) top = rect.bottom + window.scrollY + 4;
    fieldLabelEl.style.top = top + 'px';
    fieldLabelEl.style.left = (rect.left + window.scrollX) + 'px';
    fieldLabelEl.classList.add('visible');
  }

  function hideFieldLabel() {
    if (fieldLabelEl) fieldLabelEl.classList.remove('visible');
  }

  // ═══════════════════════════════════════════════════
  //  Roster Panel
  // ═══════════════════════════════════════════════════
  function toggleRosterPanel(forceState) {
    if (!rosterPanelEl) return;
    var show = typeof forceState === 'boolean' ? forceState : !rosterPanelEl.classList.contains('visible');
    rosterPanelEl.classList.toggle('visible', show);
    if (show) { syncRosterDraftsFromDom(); renderRosterEditor(); }
    var btn = toolbarEl && toolbarEl.querySelector('#bisEditorRosterBtn');
    if (btn) btn.classList.toggle('active', show);
  }

  function renderRosterEditor() {
    if (!rosterSelect || !rosterRows) return;
    var sections = getRosterSections();
    if (!sections.length) {
      rosterSelect.innerHTML = '<option disabled>No roster sections found</option>';
      rosterRows.innerHTML = '';
      return;
    }
    var options = sections.map(function (grid) { return { key: ensureRosterKey(grid), label: getRosterLabel(grid) }; });
    if (!rosterSelectedKey || !options.some(function (o) { return o.key === rosterSelectedKey; })) {
      rosterSelectedKey = options[0].key;
    }
    rosterSelect.innerHTML = options.map(function (o) {
      return '<option value="' + escapeHtml(o.key) + '"' + (o.key === rosterSelectedKey ? ' selected' : '') + '>' + escapeHtml(o.label) + '</option>';
    }).join('');
    renderRosterRows();
  }

  function renderRosterRows() {
    if (!rosterRows) return;
    var draft = getRosterDraft(rosterSelectedKey);
    rosterRows.innerHTML = '';
    if (!draft.length) {
      var empty = document.createElement('div');
      empty.className = 'bis-roster-empty';
      empty.textContent = 'No players yet. Click "+ Add Player" below.';
      rosterRows.appendChild(empty);
      return;
    }
    draft.forEach(function (entry, index) {
      var row = document.createElement('div');
      row.className = 'bis-roster-row';
      var nameInput = document.createElement('input');
      nameInput.className = 'bis-roster-input'; nameInput.type = 'text'; nameInput.placeholder = 'Player name'; nameInput.value = entry.name || '';
      var gradeInput = document.createElement('input');
      gradeInput.className = 'bis-roster-input'; gradeInput.type = 'text'; gradeInput.placeholder = 'Grade'; gradeInput.value = entry.grade || '';
      var removeBtn = document.createElement('button');
      removeBtn.type = 'button'; removeBtn.className = 'bis-roster-remove'; removeBtn.textContent = '\u2212';
      nameInput.addEventListener('input', function () { draft[index].name = cleanText(nameInput.value); commitRosterDraft(rosterSelectedKey); });
      gradeInput.addEventListener('input', function () { draft[index].grade = cleanText(gradeInput.value); commitRosterDraft(rosterSelectedKey); });
      removeBtn.addEventListener('click', function () { draft.splice(index, 1); commitRosterDraft(rosterSelectedKey); renderRosterEditor(); });
      row.appendChild(nameInput); row.appendChild(gradeInput); row.appendChild(removeBtn);
      rosterRows.appendChild(row);
    });
  }

  // ═══════════════════════════════════════════════════
  //  Editable Fields
  // ═══════════════════════════════════════════════════
  function getEditableFields() {
    return Array.from(document.body.querySelectorAll('*')).filter(isEditableTextElement);
  }

  function isEditableTextElement(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (EXCLUDED_TAGS.has(element.tagName)) return false;
    if (element.closest(EDITOR_EXCLUDE_SELECTOR)) return false;
    if (element.closest('.roster-item')) return false;
    var identity = (element.id || '') + ' ' + (typeof element.className === 'string' ? element.className : '');
    if (/admin/i.test(identity)) return false;
    if (element.childElementCount !== 0) return false;
    var text = cleanText(element.textContent);
    if (!text || text.length > 500) return false;
    return true;
  }

  var keyboardBound = false;
  function bindEditableFields() {
    getEditableFields().forEach(function (element) {
      ensureElementKey(element);
      if (element.dataset.siteAdminBound === '1') return;
      element.dataset.siteAdminBound = '1';

      element.addEventListener('keydown', function (event) {
        if (!editMode) return;
        if (event.key === 'Enter') { event.preventDefault(); element.blur(); }
      });

      element.addEventListener('focus', function () {
        if (!editMode) return;
        showFieldLabel(element);
      });

      element.addEventListener('blur', function () {
        if (!editMode) return;
        hideFieldLabel();
        pushUndoState();
      });

      element.addEventListener('mouseenter', function () {
        if (!editMode) return;
        if (document.activeElement !== element) showFieldLabel(element);
      });

      element.addEventListener('mouseleave', function () {
        if (!editMode) return;
        if (document.activeElement !== element) hideFieldLabel();
      });

      element.addEventListener('paste', function (event) {
        if (!editMode) return;
        event.preventDefault();
        var text = (event.clipboardData || window.clipboardData).getData('text');
        if (typeof document.execCommand === 'function') { document.execCommand('insertText', false, text); return; }
        var selection = window.getSelection();
        if (!selection || !selection.rangeCount) { element.textContent = (element.textContent || '') + text; return; }
        selection.deleteFromDocument();
        selection.getRangeAt(0).insertNode(document.createTextNode(text));
      });
    });

    if (!keyboardBound) {
      keyboardBound = true;
      document.addEventListener('keydown', function (e) {
        if (!editMode) return;
        var mod = e.metaKey || e.ctrlKey;
        if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
        if (mod && e.key === 'z' && e.shiftKey) { e.preventDefault(); handleRedo(); }
        if (mod && e.key === 'y') { e.preventDefault(); handleRedo(); }
        if (mod && e.key === 's') { e.preventDefault(); handleSave(); }

        // Tab navigation between editable fields
        if (e.key === 'Tab' && !mod) {
          var fields = getEditableFields();
          var active = document.activeElement;
          var idx = fields.indexOf(active);
          if (idx >= 0) {
            e.preventDefault();
            var next = e.shiftKey ? idx - 1 : idx + 1;
            if (next >= 0 && next < fields.length) fields[next].focus();
          }
        }
      }, { capture: true });

      document.addEventListener('click', function (event) {
        if (!editMode) return;
        var field = event.target.closest('[data-site-editor-key]');
        if (field instanceof HTMLElement) field.focus();
      }, true);
    }
  }

  function observeDocument() {
    var observer = new MutationObserver(function () {
      if (editMode) return;
      scheduleRescan(false);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('load', function () { scheduleRescan(true); }, { once: true });
  }

  function scheduleRescan(forceApply) {
    if (rescanFrame) cancelAnimationFrame(rescanFrame);
    rescanFrame = requestAnimationFrame(function () {
      rescanFrame = 0;
      bindEditableFields();
      if (forceApply) savedState = normalizeState(loadLocalState() || savedState || defaultState);
      if (!editMode && savedState) applyState(savedState);
    });
  }

  // ═══════════════════════════════════════════════════
  //  Online / Offline
  // ═══════════════════════════════════════════════════
  function bindOnlineOffline() {
    window.addEventListener('online', function () { if (editMode) showToast('Back online', 'success'); });
    window.addEventListener('offline', function () { if (editMode) showToast('\uD83D\uDCF4 You are offline', 'error'); });
  }

  // ═══════════════════════════════════════════════════
  //  State Management
  // ═══════════════════════════════════════════════════
  function ensureElementKey(element) {
    if (element.dataset.siteEditorKey) return element.dataset.siteEditorKey;
    var parts = [];
    var current = element;
    while (current && current !== document.body) {
      var parent = current.parentElement;
      if (!parent) break;
      var siblings = Array.from(parent.children).filter(function (c) { return c.tagName === current.tagName; });
      var index = Math.max(0, siblings.indexOf(current)) + 1;
      parts.unshift(current.tagName.toLowerCase() + ':' + index);
      current = parent;
    }
    var key = parts.join('/');
    element.dataset.siteEditorKey = key;
    return key;
  }

  function captureState() {
    var fields = {};
    getEditableFields().forEach(function (el) { fields[ensureElementKey(el)] = cleanText(el.textContent); });
    return { fields: fields, rosters: captureRosterState(), photos: capturePhotoState() };
  }

  function capturePhotoState() {
    var archive = document.querySelector('.site-photo-archive');
    if (!archive) return [];
    return Array.from(archive.querySelectorAll('.photo-archive-image')).map(function (image) {
      return { src: image.getAttribute('src') || '', alt: image.getAttribute('alt') || 'Team photo' };
    }).filter(function (photo) { return photo.src; });
  }

  function applyState(state) {
    var normalized = normalizeState(state || defaultState);
    getEditableFields().forEach(function (el) {
      var key = ensureElementKey(el);
      var value = Object.prototype.hasOwnProperty.call(normalized.fields, key)
        ? normalized.fields[key]
        : (defaultState.fields ? defaultState.fields[key] : undefined);
      if (typeof value === 'string') el.textContent = value;
    });
    getRosterSections().forEach(function (grid) {
      var key = ensureRosterKey(grid);
      var fallback = (defaultState.rosters && defaultState.rosters[key]) || readRosterEntries(grid);
      var entries = (normalized.rosters && Object.prototype.hasOwnProperty.call(normalized.rosters, key))
        ? normalized.rosters[key] : fallback;
      renderRosterGrid(grid, entries);
    });
    applyPhotoState(normalized.photos || []);
    syncRosterDraftsFromDom();
    if (rosterPanelEl && rosterPanelEl.classList.contains('visible')) renderRosterEditor();
  }

  function applyReadOnlyState(state) {
    var source = state && state.fields && typeof state.fields === 'object' ? state.fields : {};
    getEditableFields().forEach(function (el) {
      var key = ensureElementKey(el);
      if (Object.prototype.hasOwnProperty.call(source, key)) el.textContent = source[key];
    });
    var rosterSource = state && state.rosters && typeof state.rosters === 'object' ? state.rosters : {};
    getRosterSections().forEach(function (grid) {
      var key = ensureRosterKey(grid);
      if (Object.prototype.hasOwnProperty.call(rosterSource, key)) renderRosterGrid(grid, rosterSource[key]);
    });
    applyPhotoState(state && Array.isArray(state.photos) ? state.photos : []);
  }

  function normalizeState(state) {
    var source = state && state.fields && typeof state.fields === 'object' ? state.fields : {};
    var rosterSource = state && state.rosters && typeof state.rosters === 'object' ? state.rosters : {};
    var baselineState = captureState();
    var fields = {};
    Object.keys(baselineState.fields).forEach(function (key) {
      fields[key] = Object.prototype.hasOwnProperty.call(source, key) ? cleanText(source[key]) : baselineState.fields[key];
    });
    var rosters = {};
    Object.keys(baselineState.rosters || {}).forEach(function (key) {
      rosters[key] = Object.prototype.hasOwnProperty.call(rosterSource, key)
        ? normalizeRosterEntries(rosterSource[key]) : baselineState.rosters[key];
    });
    return { fields: fields, rosters: rosters, photos: normalizePhotos(state && state.photos) };
  }

  function normalizePhotos(photos) {
    if (!Array.isArray(photos)) return capturePhotoState();
    return photos.filter(function (photo) { return photo && typeof photo.src === 'string' && photo.src; })
      .map(function (photo) { return { src: photo.src, alt: cleanText(photo.alt || 'Team photo') || 'Team photo' }; });
  }

  function applyPhotoState(photos) {
    var archive = document.querySelector('.site-photo-archive');
    if (!archive) return;
    var grid = archive.querySelector('.photo-archive-grid');
    if (!grid || !Array.isArray(photos)) return;
    var existing = Array.from(grid.querySelectorAll('.photo-archive-image'));
    var empty = grid.querySelector('.photo-archive-empty');
    if (photos.length) {
      if (empty) empty.remove();
    } else if (!existing.length && !empty) {
      empty = document.createElement('div');
      empty.className = 'photo-archive-empty';
      empty.textContent = 'No team photos yet.';
      grid.appendChild(empty);
    }
    photos.forEach(function (photo, index) {
      var image = existing[index];
      if (!image) {
        image = document.createElement('img');
        image.className = 'photo-archive-image';
        grid.appendChild(image);
      }
      image.src = photo.src; image.alt = photo.alt || 'Team photo';
    });
    existing.slice(photos.length).forEach(function (image) { image.remove(); });
  }

  // ═══════════════════════════════════════════════════
  //  Roster Helpers
  // ═══════════════════════════════════════════════════
  function getRosterSections() {
    return Array.from(document.querySelectorAll('.roster-grid')).filter(function (grid) {
      return grid instanceof HTMLElement && !grid.closest(EDITOR_EXCLUDE_SELECTOR);
    });
  }

  function ensureRosterKey(grid) {
    if (!(grid instanceof HTMLElement)) return '';
    if (grid.dataset.siteRosterKey) return grid.dataset.siteRosterKey;
    var key = 'roster:' + ensureElementKey(grid);
    grid.dataset.siteRosterKey = key;
    return key;
  }

  function stripRosterCount(label) { return cleanText(label).replace(/\s*\(\d+\)\s*$/, ''); }

  function getRosterContextPrefix(grid) {
    var ct = grid.closest('.hs-card');
    if (ct) { var t = ct.querySelector('.hs-title'); if (t) return cleanText(t.textContent); }
    var p = grid.closest('.panel');
    if (p) { var pt = p.querySelector('.panel-title'); if (pt) return cleanText(pt.textContent); }
    return '';
  }

  function getRosterLabel(grid) {
    var ai = grid.closest('.accordion-item');
    var title = ai ? ai.querySelector('.accordion-header .accordion-title') : null;
    var rosterLabel = stripRosterCount(title ? title.textContent : 'Roster');
    var ctx = getRosterContextPrefix(grid);
    return ctx ? ctx + ' \u2014 ' + rosterLabel : rosterLabel;
  }

  function readRosterEntries(grid) {
    return Array.from(grid.querySelectorAll('.roster-item')).map(function (item) {
      var gradeNode = item.querySelector('.grade');
      var grade = cleanText(gradeNode ? gradeNode.textContent : '');
      var clone = item.cloneNode(true);
      clone.querySelectorAll('.grade').forEach(function (n) { n.remove(); });
      return { name: cleanText(clone.textContent), grade: grade };
    }).filter(function (e) { return e.name || e.grade; });
  }

  function normalizeRosterEntries(entries) {
    if (!Array.isArray(entries)) return [];
    return entries.map(function (e) {
      return { name: cleanText((e && e.name) || ''), grade: cleanText((e && e.grade) || '') };
    }).filter(function (e) { return e.name || e.grade; });
  }

  function captureRosterState() {
    var rosters = {};
    getRosterSections().forEach(function (grid) { rosters[ensureRosterKey(grid)] = readRosterEntries(grid); });
    return rosters;
  }

  function updateRosterHeadingCount(grid, entries) {
    var ai = grid.closest('.accordion-item');
    var title = ai ? ai.querySelector('.accordion-header .accordion-title') : null;
    if (title) title.textContent = getRosterLabel(grid) + ' (' + normalizeRosterEntries(entries).length + ')';
  }

  function renderRosterGrid(grid, entries) {
    if (!(grid instanceof HTMLElement)) return;
    var normalized = normalizeRosterEntries(entries);
    grid.innerHTML = '';
    normalized.forEach(function (entry) {
      var item = document.createElement('div');
      item.className = 'roster-item';
      item.appendChild(document.createTextNode(entry.name || ''));
      if (entry.grade) {
        if (entry.name) item.appendChild(document.createTextNode(' '));
        var g = document.createElement('span');
        g.className = 'grade';
        g.textContent = entry.grade;
        item.appendChild(g);
      }
      grid.appendChild(item);
    });
    updateRosterHeadingCount(grid, normalized);
  }

  function syncRosterDraftsFromDom() {
    rosterDrafts = captureRosterState();
    if (rosterSelectedKey && !Object.prototype.hasOwnProperty.call(rosterDrafts, rosterSelectedKey)) rosterSelectedKey = '';
  }

  function getRosterDraft(key) {
    if (!key) return [];
    if (!Object.prototype.hasOwnProperty.call(rosterDrafts, key)) {
      rosterDrafts[key] = normalizeRosterEntries(captureRosterState()[key] || []).map(function (e) { return { name: e.name, grade: e.grade }; });
    }
    return rosterDrafts[key];
  }

  function commitRosterDraft(key) {
    var grid = getRosterSections().find(function (g) { return ensureRosterKey(g) === key; });
    if (!grid) return;
    var entries = normalizeRosterEntries(getRosterDraft(key)).map(function (e) { return { name: e.name, grade: e.grade }; });
    rosterDrafts[key] = entries;
    renderRosterGrid(grid, entries);
  }

  // ═══════════════════════════════════════════════════
  //  Utilities
  // ═══════════════════════════════════════════════════
  function cleanText(value) {
    return value == null ? '' : String(value).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function getStorageKey() {
    var page = location.pathname || '/index.html';
    if (page === '/') page = '/index.html';
    return STORAGE_KEY_PREFIX + page.replace(/[^a-zA-Z0-9/_-]/g, '_');
  }

  function setStatus(message, tone) {
    if (statusEl) { statusEl.textContent = message; statusEl.dataset.tone = tone || ''; }
    if (statusTimer) clearTimeout(statusTimer);
    if (tone === 'ok') {
      statusTimer = setTimeout(function () {
        if (statusEl && editMode) { statusEl.textContent = 'Editing'; statusEl.dataset.tone = ''; }
      }, 3000);
    }
  }

  function loadLocalState() {
    try { var raw = localStorage.getItem(getStorageKey()); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function hasAdminQuery() { return new URLSearchParams(location.search).get('admin') === '1'; }
  function hasSessionAuthorization() { try { return sessionStorage.getItem(SESSION_AUTH_KEY) === '1'; } catch (e) { return false; } }
  function setSessionAuthorization(enabled) { try { if (enabled) sessionStorage.setItem(SESSION_AUTH_KEY, '1'); else sessionStorage.removeItem(SESSION_AUTH_KEY); } catch (e) {} }
  function clearAdminQuery() {
    if (!hasAdminQuery()) return;
    var url = new URL(location.href);
    url.searchParams.delete('admin');
    history.replaceState({}, '', url.toString());
  }

  // ═══════════════════════════════════════════════════
  //  Auth
  // ═══════════════════════════════════════════════════
  function normalizeAdminEmail(v) { return (v || '').toString().trim().toLowerCase(); }
  function isAllowedAdminEmail(v) { return ADMIN_EMAILS.includes(normalizeAdminEmail(v)); }
  function isAuthorizedAdminUser(u) { return Boolean(u && isAllowedAdminEmail(u.email)); }

  async function getResolvedAdminUser() {
    if (!siteEditorAuth) return null;
    if (siteEditorAuth.currentUser) return siteEditorAuth.currentUser;
    try { return await siteEditorAuthReady; } catch (e) { return siteEditorAuth.currentUser || null; }
  }

  async function hasAuthorizedAdminSession() { return isAuthorizedAdminUser(await getResolvedAdminUser()); }

  function showAdminAuthError(reason, errorCode) {
    if (reason === 'cancelled') return;
    var msgs = {
      unauthorized: 'This email is not approved for admin access.',
      wrong_password: 'Incorrect password. Please try again.',
      user_not_found: 'No admin account found for this email.',
      too_many_requests: 'Too many failed attempts. Please try again later.',
      network: 'Network error. Check the connection and try again.',
      auth_unavailable: 'Firebase Auth is not available on this page.'
    };
    alert(msgs[reason] || ('Admin sign-in failed' + (errorCode ? ' (' + errorCode + ')' : '') + '.'));
  }

  function ensurePassModal() {
    if (document.getElementById(PASS_MODAL_ID)) return;
    var modal = document.createElement('div');
    modal.id = PASS_MODAL_ID;
    modal.setAttribute('data-site-editor-ui', 'true');
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.55);align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(4px)';
    modal.innerHTML = '<div style="background:#fff;border-radius:20px;padding:32px 28px;max-width:380px;width:100%;box-shadow:0 30px 60px rgba(0,0,0,.3);border:1px solid rgba(148,163,184,.15)">'
      + '<div style="font-weight:800;font-size:18px;margin-bottom:4px">Admin Login</div>'
      + '<div style="font-size:13px;color:#64748b;margin-bottom:20px">Sign in with your admin account</div>'
      + '<input id="passModalEmail" type="email" placeholder="Email" autocomplete="email" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid rgba(148,163,184,.3);background:#fff;color:#0f172a;font-size:15px;outline:none;margin-bottom:10px" />'
      + '<input id="passModalInput" type="password" placeholder="Password" autocomplete="current-password" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid rgba(148,163,184,.3);background:#fff;color:#0f172a;font-size:15px;outline:none" />'
      + '<div id="passModalError" style="color:#ef4444;font-size:12px;margin-top:8px;display:none"></div>'
      + '<div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end">'
      + '<button id="passModalCancel" style="appearance:none;border:1px solid rgba(148,163,184,.3);background:#fff;color:#0f172a;padding:10px 20px;border-radius:10px;font:inherit;font-weight:600;cursor:pointer">Cancel</button>'
      + '<button id="passModalOk" style="appearance:none;border:none;background:#0f172a;color:#fff;padding:10px 20px;border-radius:10px;font:inherit;font-weight:600;cursor:pointer">Sign In</button>'
      + '</div></div>';
    document.body.appendChild(modal);
  }

  async function promptPass() {
    if (!siteEditorAuth || !window.firebase || typeof firebase.auth !== 'function') {
      return { ok: false, reason: 'auth_unavailable' };
    }
    var currentUser = await getResolvedAdminUser();
    if (isAuthorizedAdminUser(currentUser)) return { ok: true, user: currentUser };

    ensurePassModal();
    var modal = document.getElementById(PASS_MODAL_ID);
    var emailInput = document.getElementById('passModalEmail');
    var passInput = document.getElementById('passModalInput');
    var errorEl = document.getElementById('passModalError');
    var okBtn = document.getElementById('passModalOk');
    var cancelBtn = document.getElementById('passModalCancel');
    if (!modal || !emailInput || !passInput || !okBtn || !cancelBtn) return { ok: false, reason: 'auth_unavailable' };
    emailInput.value = ''; passInput.value = '';
    errorEl.style.display = 'none';
    modal.style.display = 'flex';
    emailInput.focus();

    return new Promise(function (resolve) {
      function cleanup() {
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        emailInput.removeEventListener('keydown', onKey);
        passInput.removeEventListener('keydown', onKey);
        modal.style.display = 'none';
      }
      function onKey(e) { if (e.key === 'Enter') onOk(); if (e.key === 'Escape') onCancel(); }
      async function onOk() {
        var email = (emailInput.value || '').trim();
        var password = passInput.value || '';
        if (!email || !password) { errorEl.textContent = 'Please enter email and password.'; errorEl.style.display = 'block'; return; }
        if (!isAllowedAdminEmail(email)) { cleanup(); resolve({ ok: false, reason: 'unauthorized' }); return; }
        okBtn.disabled = true; okBtn.textContent = 'Signing in\u2026';
        try {
          var result = await siteEditorAuth.signInWithEmailAndPassword(email, password);
          var user = (result && result.user) || siteEditorAuth.currentUser;
          if (!isAuthorizedAdminUser(user)) { try { await siteEditorAuth.signOut(); } catch (e) {} cleanup(); resolve({ ok: false, reason: 'unauthorized' }); return; }
          cleanup(); resolve({ ok: true, user: user });
        } catch (error) {
          okBtn.disabled = false; okBtn.textContent = 'Sign In';
          var code = (error && error.code) || '';
          if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
            errorEl.textContent = 'Incorrect password.'; errorEl.style.display = 'block';
          } else if (code === 'auth/user-not-found') { cleanup(); resolve({ ok: false, reason: 'user_not_found', errorCode: code }); }
          else if (code === 'auth/too-many-requests') { cleanup(); resolve({ ok: false, reason: 'too_many_requests', errorCode: code }); }
          else if (code === 'auth/network-request-failed') { cleanup(); resolve({ ok: false, reason: 'network', errorCode: code }); }
          else { cleanup(); resolve({ ok: false, reason: 'unknown', errorCode: code }); }
        }
      }
      function onCancel() { cleanup(); resolve({ ok: false, reason: 'cancelled' }); }
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      emailInput.addEventListener('keydown', onKey);
      passInput.addEventListener('keydown', onKey);
    });
  }
})();

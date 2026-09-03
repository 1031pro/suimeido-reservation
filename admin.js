(function () {
  var config = window.RESERVATION_CONFIG || {};
  var loginView = document.getElementById('loginView');
  var dashboard = document.getElementById('dashboard');
  var loader = document.getElementById('loader');
  var reservationRows = document.getElementById('reservationRows');
  var menuRows = document.getElementById('menuRows');
  var adminKeyInput = document.getElementById('adminKey');
  var loginError = document.getElementById('loginError');
  var addMenuButton = document.getElementById('addMenuButton');
  var menuOperationHead = document.getElementById('menuOperationHead');

  var state = {
    key: '',
    reservations: [],
    menus: []
  };

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-config]').forEach(function (el) {
      var key = el.getAttribute('data-config');
      if (config[key]) el.textContent = config[key];
    });

    document.getElementById('loginButton').addEventListener('click', login);
    document.getElementById('refreshButton').addEventListener('click', loadAll);
    document.getElementById('logoutButton').addEventListener('click', logout);
    addMenuButton.addEventListener('click', addMenuRow);
    document.getElementById('saveMenuButton').addEventListener('click', saveMenus);
    document.getElementById('statusFilter').addEventListener('change', renderReservations);
    document.getElementById('dateFilter').addEventListener('change', renderReservations);
    document.getElementById('searchInput').addEventListener('input', renderReservations);
    document.querySelectorAll('[data-tab]').forEach(function (button) {
      button.addEventListener('click', function () { switchTab(button.dataset.tab); });
    });

    var saved = sessionStorage.getItem(config.ADMIN_SESSION_KEY || 'reservationAdminKey');
    if (saved) {
      adminKeyInput.value = saved;
      login();
    }
  });

  function hasApiUrl() {
    return config.GAS_WEBAPP_URL && config.GAS_WEBAPP_URL.indexOf('__') !== 0;
  }

  function login() {
    var key = adminKeyInput.value.trim();
    if (!key) return;
    state.key = key;
    showLoader(true);
    callApi({ action: 'adminList', key: key }, function (err, data) {
      showLoader(false);
      if (err || !data || data.error) {
        loginError.textContent = data && data.error ? data.error : '通信エラーが発生しました';
        loginError.style.display = 'block';
        return;
      }
      sessionStorage.setItem(config.ADMIN_SESSION_KEY || 'reservationAdminKey', key);
      loginError.style.display = 'none';
      loginView.style.display = 'none';
      dashboard.style.display = 'block';
      state.reservations = data.reservations || [];
      state.menus = data.menus || [];
      renderReservations();
      renderMenus();
    });
  }

  function logout() {
    sessionStorage.removeItem(config.ADMIN_SESSION_KEY || 'reservationAdminKey');
    location.reload();
  }

  function loadAll() {
    showLoader(true);
    callApi({ action: 'adminList', key: state.key }, function (err, data) {
      showLoader(false);
      if (err || !data || data.error) {
        alert(data && data.error ? data.error : '取得に失敗しました');
        return;
      }
      state.reservations = data.reservations || [];
      state.menus = data.menus || state.menus;
      renderReservations();
      renderMenus();
    });
  }

  function renderReservations() {
    var status = document.getElementById('statusFilter').value;
    var date = document.getElementById('dateFilter').value;
    var query = document.getElementById('searchInput').value.trim().toLowerCase();

    var rows = state.reservations.filter(function (item) {
      if (status === 'active' && item.status === 'キャンセル') return false;
      if (status === 'cancelled' && item.status !== 'キャンセル') return false;
      if (date && item.date !== date) return false;
      if (query) {
        var haystack = [item.reservationId, item.name, item.phone, item.email, item.menuName, item.patientType].join(' ').toLowerCase();
        if (haystack.indexOf(query) < 0) return false;
      }
      return true;
    });

    if (!rows.length) {
      reservationRows.innerHTML = '<tr><td class="empty" colspan="10">該当する予約はありません</td></tr>';
      return;
    }

    reservationRows.innerHTML = rows.map(function (item) {
      var cancelled = item.status === 'キャンセル';
      return '<tr>'
        + '<td>' + escapeHtml(item.reservationId) + '</td>'
        + '<td>' + escapeHtml(item.date) + '</td>'
        + '<td>' + escapeHtml(item.time) + '</td>'
        + '<td>' + escapeHtml(item.menuName || '-') + '<br><small>' + escapeHtml(item.durationMinutes || '') + '分</small></td>'
        + '<td>' + escapeHtml(item.patientType || '-') + '</td>'
        + '<td>' + escapeHtml(item.name) + '</td>'
        + '<td>' + escapeHtml(item.phone) + '<br><small>' + escapeHtml(item.email || '') + '</small></td>'
        + '<td>' + escapeHtml(item.payment || '-') + (item.price ? '<br><small>' + Number(item.price).toLocaleString() + '円</small>' : '') + '</td>'
        + '<td><span class="status ' + (cancelled ? 'cancelled' : '') + '">' + escapeHtml(item.status || '-') + '</span></td>'
        + '<td>' + (cancelled ? '-' : '<button class="danger" type="button" data-cancel="' + escapeHtml(item.reservationId) + '" data-cancel-name="' + escapeAttr(item.name || '') + '">キャンセル</button>') + '</td>'
        + '</tr>';
    }).join('');

    reservationRows.querySelectorAll('[data-cancel]').forEach(function (button) {
      button.addEventListener('click', function () {
        cancelReservation(
          button.getAttribute('data-cancel'),
          button.getAttribute('data-cancel-name')
        );
      });
    });
  }

  function renderMenus() {
    var multipleMenus = !!config.MENU_SELECTION_ENABLED;
    addMenuButton.hidden = !multipleMenus;
    if (menuOperationHead) menuOperationHead.hidden = !multipleMenus;

    if (!state.menus.length) {
      menuRows.innerHTML = '<tr><td class="empty" colspan="7">メニューがありません</td></tr>';
      return;
    }
    var menus = multipleMenus ? state.menus : [state.menus[0]];
    menuRows.innerHTML = menus.map(function (menu, index) {
      return '<tr data-index="' + index + '">'
        + '<td><input class="menu-input" data-field="id" value="' + escapeAttr(menu.id || '') + '"></td>'
        + '<td><input class="menu-input" data-field="name" value="' + escapeAttr(menu.name || '') + '"></td>'
        + '<td><input class="menu-input" data-field="durationMinutes" type="number" min="1" value="' + escapeAttr(menu.durationMinutes || 60) + '"></td>'
        + '<td><input class="menu-input" data-field="price" type="number" min="0" value="' + escapeAttr(menu.price || 0) + '"></td>'
        + '<td><textarea class="menu-input" data-field="description">' + escapeHtml(menu.description || '') + '</textarea></td>'
        + '<td><select class="menu-input" data-field="enabled"><option value="true" ' + (menu.enabled === false ? '' : 'selected') + '>表示</option><option value="false" ' + (menu.enabled === false ? 'selected' : '') + '>非表示</option></select></td>'
        + (multipleMenus ? '<td><button class="danger" type="button" data-delete-menu="' + index + '">削除</button></td>' : '')
        + '</tr>';
    }).join('');

    menuRows.querySelectorAll('[data-delete-menu]').forEach(function (button) {
      button.addEventListener('click', function () {
        var index = parseInt(button.getAttribute('data-delete-menu'), 10);
        state.menus.splice(index, 1);
        renderMenus();
      });
    });
  }

  function addMenuRow() {
    state.menus.push({
      id: 'menu_' + (state.menus.length + 1),
      name: '',
      durationMinutes: 60,
      price: 0,
      description: '',
      enabled: true
    });
    renderMenus();
  }

  function collectMenus() {
    var rows = Array.prototype.slice.call(menuRows.querySelectorAll('tr[data-index]'));
    return rows.map(function (row) {
      var item = {};
      row.querySelectorAll('[data-field]').forEach(function (input) {
        var field = input.getAttribute('data-field');
        if (field === 'durationMinutes' || field === 'price') {
          item[field] = parseInt(input.value || '0', 10);
        } else if (field === 'enabled') {
          item[field] = input.value === 'true';
        } else {
          item[field] = input.value.trim();
        }
      });
      return item;
    }).filter(function (menu) {
      return menu.id && menu.name && menu.durationMinutes > 0;
    });
  }

  function saveMenus() {
    var menus = collectMenus();
    if (!menus.length) {
      alert('保存できるメニューがありません');
      return;
    }
    if (!config.MENU_SELECTION_ENABLED) {
      menus = [menus[0]];
    }
    showLoader(true);
    callApi({
      action: 'adminSaveMenus',
      key: state.key,
      menus_json: JSON.stringify(menus)
    }, function (err, data) {
      showLoader(false);
      if (err || !data || data.error) {
        alert(data && data.error ? data.error : '保存に失敗しました');
        return;
      }
      state.menus = data.menus || menus;
      renderMenus();
      alert('メニュー設定を保存しました');
    });
  }

  function cancelReservation(reservationId, reservationName) {
    if (!confirm(reservationName + '（' + reservationId + '）をキャンセルしますか？')) return;
    showLoader(true);
    callApi({
      action: 'adminCancel',
      key: state.key,
      reservation_id: reservationId
    }, function (err, data) {
      showLoader(false);
      if (err || !data || data.error) {
        alert(data && data.error ? data.error : 'キャンセルに失敗しました');
        return;
      }
      if (data.lineNotificationSent) {
        alert('キャンセルしました。お客様へLINE通知を送信しました。');
      } else if (data.lineNotificationAvailable) {
        alert('キャンセルしましたが、LINE通知の送信に失敗しました。電話またはメールでご連絡ください。');
      } else {
        alert('キャンセルしました。LINE通知先がない予約のため、電話またはメールでご連絡ください。');
      }
      loadAll();
    });
  }

  function switchTab(tab) {
    document.querySelectorAll('[data-tab]').forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.tab === tab);
    });
    document.querySelectorAll('[data-section]').forEach(function (section) {
      section.hidden = section.dataset.section !== tab;
    });
  }

  function callApi(params, callback) {
    if (!hasApiUrl()) {
      window.setTimeout(function () {
        callback(null, mockApi(params));
      }, 250);
      return;
    }
    var callbackName = 'adminCb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    var script = document.createElement('script');
    window[callbackName] = function (data) {
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
      callback(null, data);
    };
    var url = config.GAS_WEBAPP_URL + '?callback=' + encodeURIComponent(callbackName);
    Object.keys(params).forEach(function (key) {
      url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    });
    script.src = url;
    script.onerror = function () {
      delete window[callbackName];
      callback(new Error('通信エラー'));
    };
    document.body.appendChild(script);
  }

  function mockApi(params) {
    if (params.action === 'adminCancel') return { success: true };
    if (params.action === 'adminSaveMenus') return { success: true, menus: JSON.parse(params.menus_json || '[]') };
    return {
      success: true,
      reservations: [
        {
          reservationId: 'RSV20260618001',
          date: '2026-06-18',
          time: '10:00',
          menuName: '鍼灸治療',
          durationMinutes: 60,
          patientType: '新規',
          name: '山田 花子',
          phone: '09012345678',
          email: 'sample@example.com',
          payment: '当日支払い',
          price: 0,
          status: '確定'
        }
      ],
      menus: config.MENUS || []
    };
  }

  function showLoader(show) {
    loader.style.display = show ? 'grid' : 'none';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
  }
})();

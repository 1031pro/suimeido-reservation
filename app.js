(function () {
  var config = window.RESERVATION_CONFIG || {};
  var screens = Array.prototype.slice.call(document.querySelectorAll('[data-screen]'));
  var availabilityGrid = document.getElementById('availabilityGrid');
  var slotHeading = document.getElementById('slotHeading');
  var weekRange = document.getElementById('weekRange');
  var prevWeekButton = document.getElementById('prevWeekButton');
  var reservationForm = document.getElementById('reservationForm');
  var submitLoading = document.getElementById('submitLoading');
  var selectedDateTime = document.getElementById('selectedDateTime');
  var selectedMenuName = document.getElementById('selectedMenuName');
  var completeReservationId = document.getElementById('completeReservationId');
  var completeDateTime = document.getElementById('completeDateTime');
  var completeName = document.getElementById('completeName');
  var completeContact = document.getElementById('completeContact');
  var toast = document.getElementById('toast');
  var paymentField = document.getElementById('paymentField');
  var stripeOption = document.getElementById('stripeOption');
  var onsiteOption = document.getElementById('onsiteOption');
  var submitButton = document.querySelector('[form="reservationForm"]');
  var menuSection = document.getElementById('menuSection');
  var menuList = document.getElementById('menuList');
  var startButton = document.getElementById('startButton');

  var weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  var mockSlotTimes = ['10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '15:30', '16:00'];
  var mockBooked = [
    ['10:30', '14:00'],
    ['11:00', '13:00', '16:00'],
    ['10:00', '15:30'],
    ['13:30'],
    ['10:00', '10:30', '14:00', '16:00'],
    ['11:00', '13:00', '13:30'],
    ['10:30', '15:30', '16:00']
  ];

  var state = {
    weekOffset: 0,
    availability: null,
    selectedMenu: null,
    selectedSlot: null,
    toastTimer: null,
    userId: ''
  };

  document.addEventListener('DOMContentLoaded', function () {
    applyConfigText();
    setupMenuSelection();
    setupPaymentMode();
    setupLiff();
  });

  function hasApiUrl() {
    return config.GAS_WEBAPP_URL && config.GAS_WEBAPP_URL.indexOf('__') !== 0;
  }

  function applyConfigText() {
    document.querySelectorAll('[data-config]').forEach(function (el) {
      var key = el.getAttribute('data-config');
      if (config[key]) el.textContent = config[key];
    });
  }

  function setupPaymentMode() {
    var mode = config.PAYMENT_MODE || 'none';
    if (mode === 'none') {
      paymentField.hidden = true;
      return;
    }

    paymentField.hidden = false;
    var stripeInput = stripeOption.querySelector('input');
    var onsiteInput = onsiteOption.querySelector('input');

    if (mode === 'stripe_required') {
      onsiteOption.hidden = true;
      stripeInput.checked = true;
      return;
    }

    onsiteInput.checked = true;
  }

  function setupMenuSelection() {
    var menus = Array.isArray(config.MENUS) ? config.MENUS : [];
    if (!config.MENU_SELECTION_ENABLED) {
      state.selectedMenu = menus[0] || {
        id: 'default',
        name: config.SERVICE_NAME || '予約',
        durationMinutes: 60,
        durationLabel: config.SERVICE_DURATION_LABEL || '60分',
        price: 0
      };
      menuSection.hidden = true;
      return;
    }

    menuSection.hidden = false;
    if (config.EXTENSION_SELECTION_ENABLED) {
      setupExtensionSelection(menus);
      return;
    }

    startButton.textContent = 'メニューを選んで空き時間を見る';
    startButton.disabled = true;
    menuList.innerHTML = '';
    menus.forEach(function (menu) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'menu-card';
      button.innerHTML = '<strong>' + escapeHtml(menu.name) + '</strong>'
        + '<span>' + escapeHtml(menu.description || '') + '</span>'
        + '<small>' + escapeHtml(menu.durationLabel || (menu.durationMinutes + '分'))
        + (menu.price ? ' / ' + Number(menu.price).toLocaleString() + '円' : '') + '</small>';
      button.addEventListener('click', function () {
        state.selectedMenu = menu;
        document.querySelectorAll('.menu-card').forEach(function (el) {
          el.classList.remove('is-selected');
        });
        button.classList.add('is-selected');
        startButton.disabled = false;
        startButton.textContent = 'このメニューで空き時間を見る';
        updateServiceSummary(menu);
      });
      menuList.appendChild(button);
    });
  }

  function setupExtensionSelection(menus) {
    if (!menus.length) {
      startButton.disabled = true;
      startButton.textContent = '予約メニューを確認してください';
      return;
    }

    var baseMenu = menus[0];
    state.selectedMenu = baseMenu;
    menuList.innerHTML = '<div class="extension-menu">'
      + '<div class="extension-menu__base">'
      + '<span>基本メニュー</span>'
      + '<strong>' + escapeHtml(baseMenu.name) + '</strong>'
      + '<small>' + escapeHtml(baseMenu.durationLabel || (baseMenu.durationMinutes + '分'))
      + (baseMenu.price ? ' / ' + Number(baseMenu.price).toLocaleString() + '円' : '') + '</small>'
      + '</div>'
      + '<label for="extensionSelect">延長時間</label>'
      + '<select id="extensionSelect" class="extension-menu__select"></select>'
      + '<p>延長は15分ごとに1,500円追加されます。</p>'
      + '</div>';

    var select = document.getElementById('extensionSelect');
    menus.forEach(function (menu, index) {
      var option = document.createElement('option');
      option.value = menu.id;
      var extensionMinutes = Math.max(0, Number(menu.durationMinutes) - Number(baseMenu.durationMinutes));
      var extensionLabel = index === 0 ? '延長なし' : '＋' + extensionMinutes + '分';
      option.textContent = extensionLabel + '（合計' + Number(menu.durationMinutes) + '分'
        + (menu.price ? '／' + Number(menu.price).toLocaleString() + '円' : '') + '）';
      select.appendChild(option);
    });

    select.addEventListener('change', function () {
      state.selectedMenu = menus.find(function (menu) {
        return menu.id === select.value;
      }) || baseMenu;
      updateServiceSummary(state.selectedMenu);
    });

    startButton.disabled = false;
    startButton.textContent = '空き時間を見る';
    updateServiceSummary(baseMenu);
  }

  function updateServiceSummary(menu) {
    var serviceName = document.querySelector('[data-config="SERVICE_NAME"]');
    var durationLabel = document.querySelector('[data-config="SERVICE_DURATION_LABEL"]');
    if (serviceName) serviceName.textContent = menu.name;
    if (durationLabel) durationLabel.textContent = menu.durationLabel || (menu.durationMinutes + '分');
  }

  function setupLiff() {
    if (!config.LIFF_ID) return;
    loadLiffSdk(function () {
      if (typeof liff === 'undefined') return;
      liff.init({ liffId: config.LIFF_ID }).then(function () {
        if (liff.isLoggedIn()) {
          return liff.getProfile().then(function (profile) {
            state.userId = profile.userId || '';
          });
        }
      }).catch(function () {});
    });
  }

  function loadLiffSdk(done) {
    if (typeof liff !== 'undefined') {
      done();
      return;
    }

    var script = document.createElement('script');
    script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    script.onload = done;
    script.onerror = function () {};
    document.head.appendChild(script);
  }

  function showScreen(name) {
    screens.forEach(function (screen) {
      screen.classList.toggle('is-active', screen.dataset.screen === name);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function callApi(params, callback) {
    if (!hasApiUrl()) {
      window.setTimeout(function () {
        callback(null, mockApi(params));
      }, 350);
      return;
    }

    var callbackName = 'reservationCb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
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

  function startAvailabilityLoad() {
    if (config.MENU_SELECTION_ENABLED && !state.selectedMenu) {
      showToast('メニューを選択してください');
      return;
    }
    showScreen('loading');
    state.weekOffset = 0;
    loadWeek(0, function () {
      showScreen('slots');
    });
  }

  function loadWeek(offset, done) {
    setWeekButtonsDisabled(true);
    callApi({
      action: 'weekAvailability',
      week_offset: offset,
      menu_id: state.selectedMenu ? state.selectedMenu.id : ''
    }, function (err, data) {
      setWeekButtonsDisabled(false);
      if (err || !data || data.error) {
        showToast(data && data.error ? data.error : '空き時間の取得に失敗しました');
        if (done) done();
        return;
      }
      state.weekOffset = offset;
      state.availability = data;
      renderAvailability(data);
      setWeekButtonsDisabled(false);
      if (done) done();
    });
  }

  function setWeekButtonsDisabled(disabled) {
    prevWeekButton.disabled = disabled || state.weekOffset === 0;
    document.getElementById('nextWeekButton').disabled =
      disabled || !!(state.availability && state.availability.canNext === false);
  }

  function switchWeek(direction) {
    var nextOffset = Math.max(0, state.weekOffset + direction);
    if (nextOffset === state.weekOffset && direction < 0) return;
    loadWeek(nextOffset);
  }

  function renderAvailability(data) {
    availabilityGrid.innerHTML = '';
    slotHeading.textContent = data.startLabel + '〜' + data.endLabel + ' の空き状況';
    weekRange.textContent = data.startLabel + '〜' + data.endLabel;
    prevWeekButton.disabled = state.weekOffset === 0;

    var topLeft = document.createElement('div');
    topLeft.className = 'availability-cell is-head';
    topLeft.textContent = '時間';
    availabilityGrid.appendChild(topLeft);

    data.dates.forEach(function (dateItem) {
      var dayCell = document.createElement('div');
      dayCell.className = 'availability-cell is-head';
      dayCell.innerHTML = '<span>' + escapeHtml(dateItem.label) + '</span><small>' + escapeHtml(dateItem.weekday) + '</small>';
      availabilityGrid.appendChild(dayCell);
    });

    data.rows.forEach(function (row) {
      var timeCell = document.createElement('div');
      timeCell.className = 'availability-cell is-time';
      timeCell.textContent = row.time;
      availabilityGrid.appendChild(timeCell);

      row.cells.forEach(function (slot) {
        var cell = document.createElement('div');
        cell.className = 'availability-cell';
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'availability-button ' + (slot.available ? 'is-open' : 'is-booked');
        button.textContent = slot.available ? '○' : '×';
        button.setAttribute('aria-label', slot.displayDate + ' ' + slot.time + (slot.available ? ' を選択' : ' 予約不可'));
        if (slot.available) {
          button.addEventListener('click', function () {
            selectSlot(slot);
          });
        } else {
          button.disabled = true;
        }
        cell.appendChild(button);
        availabilityGrid.appendChild(cell);
      });
    });
  }

  function selectSlot(slot) {
    state.selectedSlot = slot;
    selectedDateTime.textContent = slot.displayDate + ' ' + slot.time;
    selectedMenuName.textContent = state.selectedMenu ? state.selectedMenu.name : '';
    showScreen('form');
  }

  function getSelectedPayment() {
    if ((config.PAYMENT_MODE || 'none') === 'none') return 'onsite';
    var checked = document.querySelector('input[name="payment"]:checked');
    return checked ? checked.value : 'onsite';
  }

  function submitForm(event) {
    event.preventDefault();
    if (!state.selectedSlot) {
      showToast('日時を選択してください');
      showScreen('slots');
      return;
    }
    if (!reservationForm.checkValidity()) {
      showToast('必須項目を入力してください');
      reservationForm.reportValidity();
      return;
    }

    var params = {
      action: getSelectedPayment() === 'stripe' ? 'createCheckout' : 'submitReservation',
      date: state.selectedSlot.date,
      time: state.selectedSlot.time,
      name: document.getElementById('guestName').value.trim(),
      phone: document.getElementById('guestPhone').value.trim(),
      email: document.getElementById('guestEmail').value.trim(),
      memo: document.getElementById('guestMemo').value.trim(),
      user_id: state.userId,
      menu_id: state.selectedMenu ? state.selectedMenu.id : '',
      menu_name: state.selectedMenu ? state.selectedMenu.name : (config.SERVICE_NAME || ''),
      duration_minutes: state.selectedMenu ? state.selectedMenu.durationMinutes : 60,
      payment: getSelectedPayment()
    };

    submitLoading.classList.add('is-visible');
    submitButton.disabled = true;
    callApi(params, function (err, data) {
      submitLoading.classList.remove('is-visible');
      submitButton.disabled = false;
      if (err || !data || !data.success) {
        showToast(data && data.message ? data.message : '予約処理に失敗しました');
        return;
      }
      if (params.payment === 'stripe' && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      showComplete(data, params);
    });
  }

  function showComplete(data, params) {
    var slot = state.selectedSlot || {};
    completeReservationId.textContent = data.reservationId || '-';
    completeDateTime.textContent = (data.displayDate || slot.displayDate || '') + ' ' + (data.time || slot.time || '');
    completeName.textContent = params.name || document.getElementById('guestName').value.trim();
    completeContact.textContent = (params.phone || document.getElementById('guestPhone').value.trim()) + ' / ' + (params.email || document.getElementById('guestEmail').value.trim());
    showScreen('complete');
  }

  function resetForm() {
    reservationForm.reset();
    state.selectedSlot = null;
    if (config.MENU_SELECTION_ENABLED) {
      applyConfigText();
      if (config.EXTENSION_SELECTION_ENABLED) {
        var extensionSelect = document.getElementById('extensionSelect');
        if (extensionSelect) extensionSelect.selectedIndex = 0;
        state.selectedMenu = (config.MENUS || [])[0] || null;
        startButton.disabled = !state.selectedMenu;
        startButton.textContent = '空き時間を見る';
        if (state.selectedMenu) updateServiceSummary(state.selectedMenu);
      } else {
        state.selectedMenu = null;
        document.querySelectorAll('.menu-card').forEach(function (el) {
          el.classList.remove('is-selected');
        });
        startButton.disabled = true;
        startButton.textContent = 'メニューを選んで空き時間を見る';
      }
    }
    selectedDateTime.textContent = '未選択';
    selectedMenuName.textContent = '';
    completeReservationId.textContent = '-';
    completeDateTime.textContent = '未選択';
    completeName.textContent = '未入力';
    completeContact.textContent = '未入力';
    setupPaymentMode();
  }

  function closeWindow() {
    if (typeof liff !== 'undefined' && liff.isInClient()) {
      liff.closeWindow();
    } else {
      window.close();
    }
  }

  function showToast(message) {
    window.clearTimeout(state.toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    state.toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2600);
  }

  document.addEventListener('click', function (event) {
    var actionTarget = event.target.closest('[data-action]');
    if (!actionTarget) return;
    var action = actionTarget.dataset.action;
    if (action === 'start') startAvailabilityLoad();
    if (action === 'home') showScreen('home');
    if (action === 'backToSlots') showScreen('slots');
    if (action === 'prevWeek') switchWeek(-1);
    if (action === 'nextWeek') switchWeek(1);
    if (action === 'close') closeWindow();
    if (action === 'restart') {
      resetForm();
      showScreen('home');
    }
  });

  reservationForm.addEventListener('submit', submitForm);

  function mockApi(params) {
    if (params.action === 'weekAvailability') {
      return buildMockAvailability(parseInt(params.week_offset || '0', 10));
    }
    if (params.action === 'createCheckout') {
      return {
        success: true,
        checkoutUrl: 'success.html?mock=1&reservation_id=MOCK' + Date.now()
      };
    }
    return {
      success: true,
      reservationId: 'RSV' + Date.now(),
      displayDate: state.selectedSlot ? state.selectedSlot.displayDate : '',
      time: state.selectedSlot ? state.selectedSlot.time : ''
    };
  }

  function buildMockAvailability(offset) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    today.setDate(today.getDate() + offset * 7);

    var dates = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push({
        date: formatDateKey(d),
        label: (d.getMonth() + 1) + '/' + d.getDate(),
        weekday: weekdays[d.getDay()],
        displayDate: formatJapaneseDate(d)
      });
    }

    var rows = mockSlotTimes.map(function (time) {
      return {
        time: time,
        cells: dates.map(function (dateItem, index) {
          var booked = mockBooked[(index + offset) % mockBooked.length].indexOf(time) >= 0;
          return {
            date: dateItem.date,
            time: time,
            available: !booked,
            displayDate: dateItem.displayDate
          };
        })
      };
    });

    return {
      success: true,
      weekOffset: offset,
      startLabel: dates[0].label,
      endLabel: dates[6].label,
      dates: dates,
      rows: rows
    };
  }

  function formatDateKey(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function formatJapaneseDate(date) {
    return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日（' + weekdays[date.getDay()] + '）';
  }

  function pad(value) {
    return ('0' + value).slice(-2);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }
})();

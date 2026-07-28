(function () {
  var config = window.RESERVATION_CONFIG || {};
  var params = new URLSearchParams(location.search);
  var title = document.getElementById('resultTitle');
  var summary = document.getElementById('resultSummary');

  document.querySelectorAll('[data-config]').forEach(function (el) {
    var key = el.getAttribute('data-config');
    if (config[key]) el.textContent = config[key];
  });

  if (params.get('mock')) {
    renderSuccess({
      reservationId: params.get('reservation_id') || '-',
      displayDate: '確認済み',
      time: ''
    });
    return;
  }

  var sessionId = params.get('session_id');
  if (!sessionId) {
    renderError('決済情報が見つかりませんでした');
    return;
  }

  callApi({ action: 'verifyStripePayment', session_id: sessionId }, function (err, data) {
    if (err || !data || !data.success) {
      renderError(data && data.message ? data.message : '予約の確認に失敗しました');
      return;
    }
    renderSuccess(data);
  });

  function callApi(apiParams, callback) {
    if (!config.GAS_WEBAPP_URL || config.GAS_WEBAPP_URL.indexOf('__') === 0) {
      callback(new Error('GAS URL is not configured'));
      return;
    }
    var callbackName = 'reservationSuccessCb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    var script = document.createElement('script');
    window[callbackName] = function (data) {
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
      callback(null, data);
    };
    var url = config.GAS_WEBAPP_URL + '?callback=' + encodeURIComponent(callbackName);
    Object.keys(apiParams).forEach(function (key) {
      url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(apiParams[key]);
    });
    script.src = url;
    script.onerror = function () {
      delete window[callbackName];
      callback(new Error('通信エラー'));
    };
    document.body.appendChild(script);
  }

  function renderSuccess(data) {
    title.textContent = 'ご予約ありがとうございます';
    summary.innerHTML = ''
      + '<div><dt>予約番号</dt><dd>' + escapeHtml(data.reservationId || '-') + '</dd></div>'
      + '<div><dt>日時</dt><dd>' + escapeHtml((data.displayDate || data.date || '') + ' ' + (data.time || data.startTime || '')) + '</dd></div>'
      + '<div><dt>決済</dt><dd>確認済み</dd></div>';
  }

  function renderError(message) {
    title.textContent = '確認が必要です';
    summary.innerHTML = '<div><dt>状況</dt><dd>' + escapeHtml(message) + '</dd></div>';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }
})();

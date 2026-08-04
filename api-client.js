(function (global) {
  'use strict';

  function request(baseUrl, params, callback, options) {
    var settings = options || {};
    var timeoutMs = Math.max(1000, parseInt(settings.timeoutMs || '15000', 10));
    var maxAttempts = Math.max(1, parseInt(settings.maxAttempts || '1', 10));
    var retryDelayMs = Math.max(0, parseInt(settings.retryDelayMs || '500', 10));
    var retryOnErrorResponse = settings.retryOnErrorResponse === true;
    var attempt = 0;
    var requestStartedAt = Date.now();

    function runAttempt() {
      attempt += 1;
      requestOnce(baseUrl, params, timeoutMs, function (err, data) {
        var shouldRetry = attempt < maxAttempts && (
          !!err || !!(retryOnErrorResponse && data && data.error)
        );

        if (shouldRetry) {
          console.warn('[reservation-api] retry', {
            action: params.action || '',
            attempt: attempt,
            reason: err ? err.message : String(data.error || '')
          });
          global.setTimeout(runAttempt, retryDelayMs);
          return;
        }

        callback(err, data, {
          attempts: attempt,
          durationMs: Date.now() - requestStartedAt
        });
      });
    }

    runAttempt();
  }

  function requestOnce(baseUrl, params, timeoutMs, callback) {
    var callbackName = 'reservationCb_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    var script = document.createElement('script');
    var completed = false;
    var timer = null;

    function cleanup() {
      if (timer !== null) global.clearTimeout(timer);
      delete global[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    function finish(err, data) {
      if (completed) return;
      completed = true;
      cleanup();
      callback(err, data);
    }

    global[callbackName] = function (data) {
      finish(null, data);
    };

    var url = baseUrl + '?callback=' + encodeURIComponent(callbackName);
    Object.keys(params).forEach(function (key) {
      url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    });

    script.src = url;
    script.onerror = function () {
      finish(new Error('通信エラー'));
    };
    timer = global.setTimeout(function () {
      finish(new Error('通信がタイムアウトしました'));
    }, timeoutMs);
    document.body.appendChild(script);
  }

  global.ReservationApiClient = {
    request: request
  };
})(window);

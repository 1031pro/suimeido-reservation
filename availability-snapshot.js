(function (global) {
  'use strict';

  function buildWeek(snapshot, offset, menuId) {
    if (!snapshot || !Array.isArray(snapshot.dates) || !Array.isArray(snapshot.rows)) {
      return null;
    }
    if (offset < 0 || offset > Number(snapshot.maxWeekOffset)) return null;

    var menu = (snapshot.menus || []).find(function (item) {
      return item.id === menuId;
    });
    if (!menu) return null;

    var startIndex = offset * 7;
    var dates = snapshot.dates.slice(startIndex, startIndex + 7);
    if (dates.length !== 7) return null;
    var menuBit = Number(menu.bit);

    return {
      success: true,
      weekOffset: offset,
      canNext: offset < Number(snapshot.maxWeekOffset),
      startLabel: dates[0].label,
      endLabel: dates[6].label,
      dates: dates,
      rows: snapshot.rows.map(function (row) {
        return {
          time: row.time,
          cells: dates.map(function (dateItem, dateIndex) {
            var mask = Number((row.masks || [])[startIndex + dateIndex] || 0);
            return {
              date: dateItem.date,
              time: row.time,
              displayDate: dateItem.displayDate,
              available: (mask & menuBit) !== 0
            };
          })
        };
      })
    };
  }

  function createLoader(fetchSnapshot) {
    var value = null;
    var loading = false;
    var waiters = [];

    function load(callback) {
      if (value) {
        callback(null, value, { cached: true });
        return;
      }
      waiters.push(callback);
      if (loading) return;

      loading = true;
      fetchSnapshot(function (err, data) {
        loading = false;
        var valid = !err && data && data.success && !data.error;
        if (valid) value = data;
        var callbacks = waiters.slice();
        waiters = [];
        callbacks.forEach(function (queuedCallback) {
          queuedCallback(
            valid ? null : (err || new Error((data && data.error) || '空き状況を取得できませんでした')),
            valid ? data : null,
            { cached: false }
          );
        });
      });
    }

    return {
      load: load,
      get: function () { return value; },
      clear: function () {
        value = null;
        loading = false;
        waiters = [];
      }
    };
  }

  global.AvailabilitySnapshotClient = {
    buildWeek: buildWeek,
    createLoader: createLoader
  };
})(window);

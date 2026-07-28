window.RESERVATION_CONFIG = {
  GAS_WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbxOeg2UvIDo9vncoMzHVqaqPQCjDzJ5Q-FBMzOoewaJzhCcJGFyX8Vx_rHIOE99aqDDsA/exec',
  LIFF_ID: '2010844453-Mnu7HTph',

  STORE_NAME: '鍼灸治療院　水茗董',
  HEADER_SUBTITLE: '予約受付',
  HERO_TAG: 'LINEからのご予約',
  HERO_TITLE: 'ご希望の日時で施術予約',
  HERO_LEAD: '空いている日時を確認し、そのままご予約いただけます。',
  RESERVATION_NOTICE: '往診時の交通状況や急患対応などにより、LINEからご予約いただいた日時にお受けできない場合や、予約時間の変更をお願いする場合がございます。あらかじめご了承ください。',

  SERVICE_NAME: '全身調整',
  SERVICE_DURATION_LABEL: '60分〜',
  LOCATION_LABEL: '院内施術',
  MENU_SELECTION_ENABLED: true,
  EXTENSION_SELECTION_ENABLED: true,
  EXTENSION_STEP_MINUTES: 15,
  EXTENSION_STEP_PRICE: 1500,
  EXTENSION_MAX_UNITS: 4,
  MENUS: [
    { id: 'full_body_60', name: '全身調整', durationMinutes: 60, durationLabel: '60分', price: 5000, description: '全身調整 60分' },
    { id: 'full_body_extended_75', name: '全身調整＋延長15分', durationMinutes: 75, durationLabel: '75分', price: 6500, description: '全身調整60分に15分延長' },
    { id: 'full_body_extended_90', name: '全身調整＋延長30分', durationMinutes: 90, durationLabel: '90分', price: 8000, description: '全身調整60分に30分延長' },
    { id: 'full_body_extended_105', name: '全身調整＋延長45分', durationMinutes: 105, durationLabel: '105分', price: 9500, description: '全身調整60分に45分延長' },
    { id: 'full_body_extended_120', name: '全身調整＋延長60分', durationMinutes: 120, durationLabel: '120分', price: 11000, description: '全身調整60分に60分延長' }
  ],
  PAYMENT_MODE: 'none',
  PAYMENT_LABEL: '事前カード決済',
  ONSITE_PAYMENT_LABEL: '当日支払い',
  ADMIN_SESSION_KEY: 'reservationAdminKey'
};

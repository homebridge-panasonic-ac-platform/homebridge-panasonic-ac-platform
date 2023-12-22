// Name of the plugin (must match the `name` of the package.json).
export const PLUGIN_NAME = 'homebridge-panasonic-ac-platform';

// The platform the plugin creates (see config.json).
export const PLATFORM_NAME = 'Panasonic AC Platform';

export const COMFORT_CLOUD_USER_AGENT = 'G-RAC';
export const APP_VERSION = '1.19.0';

// 360 sec = 6 min
export const LOGIN_RETRY_BASE_DELAY = 360;
export const MAX_NO_OF_LOGIN_RETRIES = 10;

// Used to renew the token periodically. Only a safety measure, since we are handling
// network errors dynamically and re-issuing a login upon a 401 Unauthorized error.
// 604,800 sec = 7 days
export const LOGIN_TOKEN_REFRESH_INTERVAL = 604800 * 1000;

// 10 minutes
export const DEVICE_STATUS_REFRESH_INTERVAL = 10 * 60 * 1000;

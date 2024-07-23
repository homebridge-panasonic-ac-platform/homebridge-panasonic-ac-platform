// Name of the plugin (must match the `name` of the package.json).
export const PLUGIN_NAME = 'homebridge-panasonic-ac-platform';

// The platform the plugin creates (see config.json).
export const PLATFORM_NAME = 'Panasonic AC Platform';

// New API
// CLIENT_ID and APP_VERSION are related - for each APP VERSION there is a different CLIENT_ID.
// CLIENT_ID and AUTH0CLIENT are hardcoded in Pansonic Comfort Cloud app(iOS / Android).
// Manual how to check APP_CLIENT_ID and AUTH_0_CLIENT: /docs/app.md

// 1.21.0
export const APP_VERSION = '1.21.1';
export const APP_CLIENT_ID = 'Xmy6xIYIitMxngjB2rHvlm6HSDNnaMJx';
export const AUTH_0_CLIENT = 'eyJuYW1lIjoiQXV0aDAuQW5kcm9pZCIsImVudiI6eyJhbmRyb2lkIjoiMzAifSwidmVyc2lvbiI6IjIuOS4zIn0=';
export const REDIRECT_URI = 'panasonic-iot-cfc://authglb.digital.panasonic.com/android/com.panasonic.ACCsmart/callback';

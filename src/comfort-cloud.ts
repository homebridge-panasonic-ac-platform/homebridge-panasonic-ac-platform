import PanasonicPlatformLogger from './logger';
import {
  APP_CLIENT_ID,
  AUTH_0_CLIENT,
  REDIRECT_URI,
} from './settings';
import {
  ComfortCloudDevice,
  ComfortCloudDeviceStatus,
  ComfortCloudDeviceUpdatePayload,
  ComfortCloudGroupResponse,
  PanasonicPlatformConfig,
} from './types';
import axios, { AxiosError } from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import * as cheerio from 'cheerio';
import jsSHA from 'jssha';
import crypto from 'crypto';

/**
 * This class exposes login, device status fetching, and device status update functions.
 */
export default class ComfortCloudApi {
  token;
  tokenRefresh;
  clientId;
  state;
  location;
  csrf;
  code;
  parameters = {};

  constructor(
    private readonly config: PanasonicPlatformConfig,
    private readonly log: PanasonicPlatformLogger,
  ) {

  }

  /**
   * Logs in the user with Comfort Cloud and
   * saves the retrieved token on the instance.
  */
  async login() {
    this.log.debug('Comfort Cloud: login()');

    // 2 FA TOTP (not necessary for know, it only calculate PIN, but Panasonic API not require it yet).
    // Check if the key is given and if it has 32 characters
    if (this.config.key2fa && this.config.key2fa.length === 32) {
      await this.setup2fa();
    } else {
      this.log.debug('No 2FA key or incorrect key (not necessary for know).');
    }

    // NEW API - START ----------------------------------------------------------------------------------

    // How to check API:
    // https://github.com/homebridge-panasonic-ac-platform/homebridge-panasonic-ac-platform/blob/master/docs/app.md

    // Based on:
    // https://github.com/sockless-coding/panasonic_cc/blob/master/custom_components/panasonic_cc/pcomfortcloud/panasonicauthentication.py
    // https://github.com/lostfields/python-panasonic-comfort-cloud
    // https://github.com/craibo/panasonic_cc/
    // https://github.com/little-quokka/python-panasonic-comfort-cloud/

    // Prepare ---------------------------------------------------------------

    function generateRandomString(length) {
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += characters[Math.floor(Math.random() * characters.length)];
      }
      return result;
    }

    function getQuerystringParameterFromHeaderEntryUrl(response, headerEntry, querystringParameter, baseUrl) {
      const headerEntryValue = response.headers[headerEntry];
      if (!headerEntryValue || typeof headerEntryValue !== 'string') {
        return null;
      }
      try {
        const parsedUrl = new URL(headerEntryValue.startsWith('/') ? baseUrl + headerEntryValue : headerEntryValue);
        const params = new URLSearchParams(parsedUrl.search);
        return params.get(querystringParameter) || null;
      } catch (e) {
        return null;
      }
    }
    function base64URLEncode(str) {
      return str.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    }

    function sha256(buffer) {
      return crypto.createHash('sha256').update(buffer).digest();
    }

    this.log.debug(`auth0client: ${AUTH_0_CLIENT}`);
    this.log.debug(`app_client_id: ${APP_CLIENT_ID}`);

    const code_verifier = base64URLEncode(crypto.randomBytes(32));
    this.log.debug(`code_verifier: ${code_verifier}`);

    const code_challenge = base64URLEncode(sha256(code_verifier));
    this.log.debug(`code_challenge: ${code_challenge}`);

    const state = generateRandomString(20);
    this.log.debug(`state: ${state}`);

    // Setup CookieJar
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));

    // Authorize ----------------------------------------------------------------

    await client.request({
      method: 'get',
      url: 'https://authglb.digital.panasonic.com/authorize',
      headers: {
        'user-agent': 'okhttp/4.10.0',
      },
      params: {
        'scope': 'openid offline_access comfortcloud.control a2w.control',
        'audience': 'https://digital.panasonic.com/' + APP_CLIENT_ID + '/api/v1/',
        'protocol': 'oauth2',
        'response_type': 'code',
        'code_challenge': code_challenge,
        'code_challenge_method': 'S256',
        'auth0Client': AUTH_0_CLIENT,
        'client_id': APP_CLIENT_ID,
        'redirect_uri': REDIRECT_URI,
        'state': state,
      },
      maxRedirects: 0,
      validateStatus: status => (status >= 200 && status < 300) || status === 302,
    })
      .then((response) => {
        this.log.debug('Comfort Cloud - Authorize - Success');
        this.log.debug(response.data);
        this.location = response.headers.location;
        this.log.debug(`location: ${this.location}`);
        this.state = getQuerystringParameterFromHeaderEntryUrl(response, 'location', 'state', 'https://authglb.digital.panasonic.com');
        this.log.debug(`state: ${this.state}`);
        this.log.debug('code: ' + getQuerystringParameterFromHeaderEntryUrl(response, 'location', 'code', 'https://authglb.digital.panasonic.com'));
      })
      .catch((error: AxiosError) => {
        this.log.error('Comfort Cloud - Authorize - Error');
        this.log.debug(JSON.stringify(error, null, 2));
        return Promise.reject(error);
      });

    // Authorize - follow redirect --------------------------------------------------

    await client.request({
      method: 'get',
      url: 'https://authglb.digital.panasonic.com' + this.location,
      maxRedirects: 0,
      validateStatus: status => (status >= 200 && status < 300) || status === 200,
    })
      .then((response) => {
        this.log.debug('Comfort Cloud - Authorize follow redirect - Success');
        this.csrf = (response.headers['set-cookie'] as string[])
          .find(cookie => cookie.includes('_csrf'))
          ?.match(new RegExp('^_csrf=(.+?);'))
          ?.[1];
        this.log.debug(`csrf: ${this.csrf}`);
      })
      .catch((error: AxiosError) => {
        this.log.error('Comfort Cloud - Authorize follow redirect - Error');
        this.log.debug(JSON.stringify(error, null, 2));
        return Promise.reject(error);
      });

    // Login ----------------------------------------------------------------

    await client.request({
      method: 'post',
      url: 'https://authglb.digital.panasonic.com/usernamepassword/login',
      headers: {
        'Auth0-Client': AUTH_0_CLIENT,
        'user-agent': 'okhttp/4.10.0',
      },
      data: {
        'client_id': APP_CLIENT_ID,
        'redirect_uri': REDIRECT_URI,
        'tenant': 'pdpauthglb-a1',
        'response_type': 'code',
        'scope': 'openid offline_access comfortcloud.control a2w.control',
        'audience': 'https://digital.panasonic.com/' + APP_CLIENT_ID + '/api/v1/',
        '_csrf': this.csrf,
        'state': this.state,
        '_intstate': 'deprecated',
        'username': this.config.email,
        'password': this.config.password,
        'lang': 'en',
        'connection': 'PanasonicID-Authentication',
      },
      maxRedirects: 0,
      validateStatus: status => (status >= 200 && status < 300) || status === 200,
    })
      .then((response) => {
        this.log.debug('Comfort Cloud - Login - Success');
        this.log.debug(response.data);

        // get wa, wresult, wctx from body
        const $ = cheerio.load(response.data);
        const elements = $('input[type="hidden"]');
        this.log.debug(`elements: ${elements}`);

        // Extract hidden input parameters and store them in a dictionary
        for (const el of elements) {
          this.parameters[el.attribs.name] = el.attribs.value;
        }
      })
      .catch((error: AxiosError) => {
        this.log.error('Comfort Cloud - Login - Error');
        this.log.debug(JSON.stringify(error, null, 2));
        return Promise.reject(error);
      });


    // Login callback ------------------------------------------------------------

    await client.request({
      method: 'post',
      url: 'https://authglb.digital.panasonic.com/login/callback',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 '
          + '(KHTML, like Gecko) Chrome/113.0.0.0 Mobile Safari/537.36',
      },
      data: this.parameters,
      maxRedirects: 0,
      validateStatus: status => (status >= 200 && status < 300) || status === 302,
    })
      .then((response) => {
        this.log.debug('Comfort Cloud - Login callback - Success');
        this.log.debug(response.data);
        this.location = response.headers.location;
        this.log.debug(`location: ${this.location}`);
      })
      .catch((error: AxiosError) => {
        this.log.error('Comfort Cloud - Login callback - Error');
        this.log.debug(JSON.stringify(error, null, 2));
        return Promise.reject(error);
      });

    // Login follow redirect ----------------------------------------------------------

    await client.request({
      method: 'get',
      url: 'https://authglb.digital.panasonic.com' + this.location,
      maxRedirects: 0,
      validateStatus: status => (status >= 200 && status < 300) || status === 302,
    })
      .then((response) => {
        this.log.debug('Comfort Cloud - Login follow redirect - Success');
        this.log.debug(response.data);
        this.code = getQuerystringParameterFromHeaderEntryUrl(response, 'location', 'code', 'https://authglb.digital.panasonic.com');
        this.log.debug(`code: ${this.code}`);
      })
      .catch((error: AxiosError) => {
        this.log.error('Comfort Cloud - Login follow redirect - Error');
        this.log.debug(JSON.stringify(error, null, 2));
        return Promise.reject(error);
      });


    // Get new token -------------------------------------------------------------------

    await client.request({
      method: 'post',
      url: 'https://authglb.digital.panasonic.com/oauth/token',
      headers: {
        'Auth0-Client': AUTH_0_CLIENT,
        'user-agent': 'okhttp/4.10.0',
      },
      data: {
        'scope': 'openid',
        'client_id': APP_CLIENT_ID,
        'grant_type': 'authorization_code',
        'code': this.code,
        'redirect_uri': REDIRECT_URI,
        'code_verifier': code_verifier,
      },
      maxRedirects: 0,
      validateStatus: status => (status >= 200 && status < 300) || status === 302,
    })
      .then((response) => {
        this.log.debug('Comfort Cloud - Get new token - Success');
        this.log.debug(response.data);
        this.token = response.data.access_token;
        this.log.debug(`token: ${this.token}`);
        this.tokenRefresh = response.data.refresh_token;
        this.log.debug(`tokenRefresh: ${this.tokenRefresh}`);
      })
      .catch((error: AxiosError) => {
        this.log.error('Comfort Cloud - Get new token - Error');
        this.log.debug(JSON.stringify(error, null, 2));
        return Promise.reject(error);
      });


    // Client ID --------------------------------------------------------------

    await client.request({
      method: 'post',
      url: 'https://accsmart.panasonic.com/auth/v2/login',
      headers: {
        ...this.getBaseRequestHeaders(),
        'X-User-Authorization-V2': 'Bearer ' + this.token,
      },
      data: {
        'language': 0,
      },
      validateStatus: status => (status >= 200 && status < 300) || status === 200,
    })
      .then((response) => {
        this.log.debug('Comfort Cloud - Client ID - Success');
        this.log.debug(response.data);
        this.clientId = response.data.clientId;
        this.log.debug(`clientId: ${this.clientId}`);
      })
      .catch((error: AxiosError) => {
        this.log.error('Comfort Cloud - Client ID - Error');
        this.log.debug(JSON.stringify(error, null, 2));
        return Promise.reject(error);
      });


    // Set timer to refresh token --------------------------------------------

    // Refresh token just a moment before the expiration of 24 hours
    setTimeout(this.refreshToken.bind(this), 86300000);

  }


  // refresh token --------------------------------------------------------------------

  async refreshToken() {

    this.log.debug('Comfort Cloud - refreshToken()');

    await axios.request({
      method: 'post',
      url: 'https://authglb.digital.panasonic.com/oauth/token',
      headers: {
        'Auth0-Client': AUTH_0_CLIENT,
        'Content-Type': 'application/json',
        'User-Agent': 'okhttp/4.10.0',
      },
      data: {
        'scope': 'openid offline_access comfortcloud.control a2w.control',
        'client_id': APP_CLIENT_ID,
        'refresh_token': this.tokenRefresh,
        'grant_type': 'refresh_token',
      },
    })
      .then((response) => {
        this.log.debug('Comfort Cloud - refreshToken() - Success');
        this.log.debug(response.data);
        this.token = response.data.access_token;
        this.log.debug(`token: ${this.token}`);
        this.tokenRefresh = response.data.refresh_token;
        this.log.debug(`tokenRefresh: ${this.tokenRefresh}`);

        // Refresh token just a moment before the expiration of 24 hours
        setTimeout(this.refreshToken.bind(this), 86300000);
      })
      .catch((error: AxiosError) => {
        this.log.error('Comfort Cloud - refreshToken() - Error');
        this.log.debug(JSON.stringify(error, null, 2));
        this.token = null;
        this.tokenRefresh = null;
        this.login.bind(this);
        return Promise.reject(error);
      });
  }

  // NEW API - END ----------------------------------------------------------------------------------

  // 2 FA TOTP ----------------------------------------------------------------------------------

  async setup2fa() {

    // Decoding Base32 to bytes
    function base32ToBytes(base32) {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      let bits = 0;
      let value = 0;
      const bytes = [];

      for (let i = 0; i < base32.length; i++) {
        const char = base32.charAt(i).toUpperCase();
        value = (value << 5) | alphabet.indexOf(char);
        bits += 5;

        if (bits >= 8) {
          bits -= 8;
          const bytes: number[] = [];
          bytes.push((value >>> bits) & 0xff);
        }
      }
      return bytes;
    }

    // Converting a number to bytes (for a timer)
    function intToBytes(num) {
      const bytes = new Array(8);
      for (let i = 7; i >= 0; i--) {
        bytes[i] = num & 0xff;
        num = num >>> 8;
      }
      return bytes;
    }

    // SHA1
    function sha1(msg) {
      function rotateLeft(n, s) {
        return (n << s) | (n >>> (32 - s));
      }
      let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;

      let padded = msg.slice();
      padded.push(0x80);
      while ((padded.length % 64) !== 56) {
        padded.push(0);
      }
      const len = msg.length * 8;
      padded = padded.concat([0, 0, 0, 0, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff]);

      for (let i = 0; i < padded.length; i += 64) {
        const w = new Array(80);
        for (let t = 0; t < 16; t++) {
          w[t] = (padded[i + t * 4] << 24) | (padded[i + t * 4 + 1] << 16) | (padded[i + t * 4 + 2] << 8) | padded[i + t * 4 + 3];
        }
        for (let t = 16; t < 80; t++) {
          w[t] = rotateLeft(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);
        }

        let a = h0, b = h1, c = h2, d = h3, e = h4;
        for (let t = 0; t < 80; t++) {
          const f = t < 20 ? (b & c) | (~b & d) : t < 40 ? b ^ c ^ d : t < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
          const k = [0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xCA62C1D6][Math.floor(t / 20)];
          const temp = (rotateLeft(a, 5) + f + e + k + w[t]) >>> 0;
          e = d; d = c; c = rotateLeft(b, 30); b = a; a = temp;
        }
        h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
      }

      return [(h0 >>> 24) & 0xff, (h0 >>> 16) & 0xff, (h0 >>> 8) & 0xff, h0 & 0xff,
        (h1 >>> 24) & 0xff, (h1 >>> 16) & 0xff, (h1 >>> 8) & 0xff, h1 & 0xff,
        (h2 >>> 24) & 0xff, (h2 >>> 16) & 0xff, (h2 >>> 8) & 0xff, h2 & 0xff,
        (h3 >>> 24) & 0xff, (h3 >>> 16) & 0xff, (h3 >>> 8) & 0xff, h3 & 0xff,
        (h4 >>> 24) & 0xff, (h4 >>> 16) & 0xff, (h4 >>> 8) & 0xff, h4 & 0xff];
    }

    // HMAC-SHA1
    function hmacSha1(key, message) {
      const blockSize = 64;
      let keyBytes = key.slice();
      if (keyBytes.length > blockSize) {
        keyBytes = sha1(keyBytes);
      }
      while (keyBytes.length < blockSize) {
        keyBytes.push(0);
      }

      const oKeyPad = keyBytes.map(b => b ^ 0x5c);
      const iKeyPad = keyBytes.map(b => b ^ 0x36);

      const inner = iKeyPad.concat(message);
      const innerHash = sha1(inner);
      const outer = oKeyPad.concat(innerHash);
      return sha1(outer);
    }

    // Generate TOTP code
    function generateTOTP(base32Secret) {
      const secretBytes = base32ToBytes(base32Secret);
      const timeStep = 30; // Standardowy interwał 30 sekund
      const epoch = Math.floor(Date.now() / 1000);
      const time = Math.floor(epoch / timeStep);
      const timeBytes = intToBytes(time);

      // Calculate HMAC-SHA1
      const hmac = hmacSha1(secretBytes, timeBytes);

      // Dynamic cutting
      const offset = hmac[hmac.length - 1] & 0xf;
      const binary = ((hmac[offset] & 0x7f) << 24)
        | ((hmac[offset + 1] & 0xff) << 16)
        | ((hmac[offset + 2] & 0xff) << 8)
        | (hmac[offset + 3] & 0xff);

      // Generate a 6-digit code
      const code = (binary % 1000000).toString().padStart(6, '0');
      return code;
    }

    // Show UTC time
    this.log.debug('UTC date: ' + new Date().toISOString().replace('T', ' ').slice(0, 19));

    // Generate 6 digit PIN code calculated by key
    const key2fa = this.config.key2fa;
    const key2fa_masked = key2fa.replace(key2fa.substring(4, 28), '(...)');
    const code2fa = generateTOTP(key2fa);
    this.log.info('2FA TOTP, for key: ' + key2fa_masked + ', PIN code: ' + code2fa);
  }

  // Get devices ----------------------------------------------------------------------------------

  /**
   * Fetches all devices that are registered with the user's Comfort Cloud account.
   *
   * @returns A promise of all the user's devices.
   */
  async getDevices(): Promise<ComfortCloudDevice[]> {
    this.log.debug('Comfort Cloud: getDevices()');

    const fetchedDevices: ComfortCloudDevice[] = [];

    if (!this.token) {
      return Promise.reject('No auth token available (login probably failed). '
        + 'Check your credentials and restart Homebridge.');
    }

    return axios.request<ComfortCloudGroupResponse>({
      method: 'get',
      url: 'https://accsmart.panasonic.com/device/group',
      headers: {
        ...this.getBaseRequestHeaders(),
        'X-Client-Id': this.clientId,
        'X-User-Authorization-V2': 'Bearer ' + this.token,
      },
    })
      .then((response) => {
        this.log.debug('Comfort Cloud - getDevices(): Success');
        this.log.debug(JSON.stringify(response.data, null, 2));

        response.data.groupList.forEach(group => {
          group.deviceList.forEach(device => {
            fetchedDevices.push(device);
          });
        });
        if (fetchedDevices.length === 0) {
          this.log.error('No devices found. '
            + 'Check whether you have added at least one device to your Comfort Cloud account.');
        }
        return fetchedDevices;
      })
      .catch((error: AxiosError) => {
        this.log.debug('Comfort Cloud - getDevices(): Error');
        this.handleNetworkRequestError(error);
        return Promise.reject('Comfort Cloud - getDevices(): Error');
      });
  }

  // Get devices status ----------------------------------------------------------------------------------

  /**
   * Retrieves the status of a device.
   *
   * @param deviceGuid Comfort Cloud's globally unique identifier for the device.
   * @returns A promise of the status of the requested device.
   */
  public getDeviceStatus(deviceGuid: string, deviceName: string): Promise<ComfortCloudDeviceStatus> {
    this.log.debug(`${deviceName} (${deviceGuid}): Comfort Cloud: getDeviceStatus()`);

    if (!this.token) {
      return Promise.reject('No auth token available (login probably failed). '
        + 'Check your credentials and restart Homebridge.');
    }

    if (!deviceGuid) {
      return Promise.reject('Cannot get device status for undefined deviceGuid.');
    }

    return axios.request<ComfortCloudDeviceStatus>({
      method: 'get',
      url: `https://accsmart.panasonic.com/deviceStatus/now/${deviceGuid}`,
      headers: {
        ...this.getBaseRequestHeaders(),
        'X-Client-Id': this.clientId,
        'X-User-Authorization-V2': 'Bearer ' + this.token,
      },
    })
      .then((response) => {
        this.log.debug(`${deviceName} (${deviceGuid}): Comfort Cloud - getDeviceStatus() : Success`);
        this.log.debug(`${deviceName} (${deviceGuid}) - device status:\n${JSON.stringify(response.data, null, 2)}`);
        return response.data;
      })
      .catch((error: AxiosError) => {
        this.log.error(`Comfort Cloud - getDeviceStatus() for GUID '${deviceGuid}': Error`);
        this.log.error('Try restarting the AC (turn it off from the power completely'
          + ' and turn it on again) and Internet router and Homebridge.');
        this.log.error('Turn on debug for more info.');
        this.handleNetworkRequestError(error);
        return Promise.reject(`${deviceName} (${deviceGuid}): Comfort Cloud - getDeviceStatus() : Error`);
      });
  }

  // Set device status ----------------------------------------------------------------------------------

  /**
   * Sets the status of a device.
   *
   * @param deviceGuid Comfort Cloud's globally unique identifier for the device.
   * @param parameters Payload containing status update parameters.
   * @returns
   */
  setDeviceStatus(deviceGuid: string, deviceName: string, parameters: ComfortCloudDeviceUpdatePayload) {
    this.log.debug(`${deviceName} (${deviceGuid}): Comfort Cloud: setDeviceStatus()`);
    this.log.debug(`${deviceName} (${deviceGuid}): ${JSON.stringify(parameters)}`);

    if (!this.token) {
      this.log.error('No auth token available (login probably failed). '
        + 'Check your credentials and restart Homebridge.');
      return;
    }

    if (!deviceGuid) {
      this.log.error('Cannot set device status for undefined deviceGuid.');
      return;
    }

    if (this.config.suppressOutgoingUpdates) {
      this.log.debug(`${deviceName} (${deviceGuid}): Suppressing outgoing device update.`);
      return;
    }

    return axios.request({
      method: 'post',
      url: 'https://accsmart.panasonic.com/deviceStatus/control',
      headers: {
        ...this.getBaseRequestHeaders(),
        'X-Client-Id': this.clientId,
        'X-User-Authorization-V2': 'Bearer ' + this.token,
      },
      data: {
        'deviceGuid': deviceGuid,
        'parameters': parameters,
      },
    })
      .then((response) => {
        this.log.debug(`${deviceName} (${deviceGuid}): Comfort Cloud - setDeviceStatus(): Success`);
        this.log.debug(`${deviceName} (${deviceGuid}): ${JSON.stringify(response.data)}`);
      })
      .catch((error: AxiosError) => {
        this.log.error(`${deviceName} (${deviceGuid}): Comfort Cloud - setDeviceStatus(): Error`);
        this.log.error('Turn on debug for more info.');
        this.handleNetworkRequestError(error);
      });
  }

  // ----------------------------------------------------------------------------------

  /**
   * Generic Axios error handler that checks which type of
   * error occurred and prints the respective information.
   *
   * @see https://axios-http.com/docs/handling_errors
   * @param error The error that is passes into the Axios error handler
   */
  handleNetworkRequestError(error: AxiosError) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx.
      this.log.debug(error.response);
    } else if (error.request) {
      // The request was made but no response was received.
      // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      this.log.debug(error.request);
    } else {
      // Something happened in setting up the request that triggered an error.
      this.log.debug(error.message);
    }
  }

  /**
   * @returns An object containing all required HTTP headers for Comfort Cloud requests.
   */
  getBaseRequestHeaders() {
    return {
      'Accept': 'application/json; charset=UTF-8',
      'Content-Type': 'application/json',
      'User-Agent': 'G-RAC',
      'X-APP-NAME': 'Comfort Cloud',
      'X-APP-TIMESTAMP': new Date().toISOString().replace('T', ' ').slice(0, 19),
      'X-APP-TYPE': '1',
      'X-APP-VERSION': this.config.finalAppVersion,
      'X-CFC-API-KEY': this.getCfcApiKey() ?? '0',
    };
  }

  getCfcApiKey() {
    try {
      // Parse date in 'YYYY-MM-DD HH:MM:SS' format and convert to timestamp (UTC milliseconds)
      const date = new Date().toISOString().replace('T', ' ').slice(0, 19);
      this.log.debug('Date used for CfcApiKey generation: ' + date);
      const dateUTC = new Date(date + ' UTC');
      const timestampMs = dateUTC.getTime().toString();
      const input = 'Comfort Cloud'
          + '521325fb2dd486bf4831b47644317fca'
          + timestampMs
          + 'Bearer '
          + this.token;
      const shaObj = new jsSHA('SHA-256', 'TEXT');
      shaObj.update(input);
      const hashStr = shaObj.getHash('HEX');
      return hashStr.slice(0, 9) + 'cfc' + hashStr.slice(9);
    } catch (error) {
      this.log.error('Failed to generate CfcApiKey key', error);
      return undefined;
    }
  }

}





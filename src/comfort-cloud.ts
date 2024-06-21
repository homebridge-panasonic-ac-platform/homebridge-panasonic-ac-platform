import PanasonicPlatformLogger from './logger';
import axios, { AxiosError } from 'axios';
import {
  APP_VERSION,
  APP_CLIENT_ID,
  AUTH_0_CLIENT,
  REDIRECT_URI,
} from './settings';
import {
  //ComfortCloudAuthResponse,
  ComfortCloudDevice,
  ComfortCloudDeviceStatus,
  ComfortCloudDeviceUpdatePayload,
  ComfortCloudGroupResponse,
  PanasonicPlatformConfig,
} from './types';
import jsSHA from 'jssha';
import crypto from 'crypto';
import * as cheerio from 'cheerio';


import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

/**
 * This class exposes login, device status fetching, and device status update functions.
 */
export default class ComfortCloudApi {
  private token: string;
  private tokenRefresh: string;
  private clientId: string;
  private _loginRefreshInterval;
  state;
  location;
  csrf;
  code;
  parameters = {};

  constructor(
    private readonly config: PanasonicPlatformConfig,
    private readonly log: PanasonicPlatformLogger,
  ) {
    this.token = '';
    this.tokenRefresh = '';
    this.clientId = '';
  }

  /**
   * Logs in the user with Comfort Cloud and
   * saves the retrieved token on the instance.
  */
  async login() {
    this.log.debug('Comfort Cloud: login()');

    // 2 FA TOTP
    // This is not necessary for know, it only calculate PIN, but Panasonic API not require it yet.
    await this.setup2fa();


    // NEW API - START ----------------------------------------------------------------------------------

    // How to check API: /docs/intercept-traffic.md

    // Based on (Python): https://github.com/craibo/panasonic_cc
    // https://github.com/craibo/panasonic_cc/blob/master/custom_components/panasonic_cc/pcomfortcloud/panasonicsession.py

    // Based on (Python): https://github.com/little-quokka/python-panasonic-comfort-cloud/
    // blob/de2869eae5684e5ef5bc8181016902eeb6c73760/pcomfortcloud/panasonic_session.py#L307

    // STEP 0 - const ----------------------------------------------------------------
    this.log.debug('-------------------------- STEP 0 --------------------------');

    const auth0client = AUTH_0_CLIENT;
    const app_client_id = APP_CLIENT_ID;
    this.log.info(`auth0client: ${auth0client}`);
    this.log.info(`app_client_id: ${app_client_id}`);

    // taken from https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce/call-your-api-using-the-authorization-code-flow-with-pkce
    function base64URLEncode(str) {
      return str.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    }
    function sha256(buffer) {
      return crypto.createHash('sha256').update(buffer).digest();
    }
    const code_verifier = base64URLEncode(crypto.randomBytes(32));
    const code_challenge = base64URLEncode(sha256(code_verifier));
    const state = generateRandomString(20);

    this.log.info(`code_verifier: ${code_verifier}`);
    this.log.info(`code_challenge: ${code_challenge}`);
    this.log.info(`state: ${state}`);

    // STEP 1 - authorize ----------------------------------------------------------------

    this.log.debug('-------------------------- STEP 1 --------------------------');

    this.log.debug('Comfort Cloud - authorize');

    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));

    await client.request({
      method: 'get',
      url: 'https://authglb.digital.panasonic.com/authorize',
      headers: {
        'user-agent': 'okhttp/4.10.0',
      },
      params: {
        'scope': 'openid offline_access comfortcloud.control a2w.control',
        'audience': 'https://digital.panasonic.com/' + APP_CLIENT_ID +'/api/v1/',
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
        this.log.debug('Comfort Cloud - authorize - Success');
        this.log.debug(response);
        this.log.debug(response.data);
        this.location = response.headers.location;
        this.state = getQuerystringParameterFromHeaderEntryUrl(response, 'location', 'state', 'https://authglb.digital.panasonic.com');
      })
      .catch((error: AxiosError) => {
        this.log.error('Comfort Cloud - authorize - Error');
        this.log.debug(JSON.stringify(error, null, 2));
        // return Promise.reject(error);
      });

    // STEP 2 - authorize - follow redirect --------------------------------------------------

    this.log.debug('-------------------------- STEP 2 --------------------------');

    this.log.debug('Comfort Cloud - authorize - follow redirect');

    await client.request({
      method: 'get',
      url: 'https://authglb.digital.panasonic.com' + this.location,
      maxRedirects: 0,
      validateStatus: status => (status >= 200 && status < 300) || status === 200,
    })
      .then((response) => {
        this.log.debug('Comfort Cloud - authorize - follow redirect - Success');
        this.log.debug(response.data);
        this.csrf = (response.headers['set-cookie'] as string[])
          .find(cookie => cookie.includes('_csrf'))
          ?.match(new RegExp('^_csrf=(.+?);'))
          ?.[1];
      })
      .catch((error: AxiosError) => {
        this.log.error('Comfort Cloud - authorize - follow redirect - Error');
        this.log.debug(JSON.stringify(error, null, 2));
        return Promise.reject(error);
      });

    // STEP 3 - login ----------------------------------------------------------------

    this.log.debug('-------------------------- STEP 3 --------------------------');

    this.log.debug('Comfort Cloud - login');

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
        'audience': 'https://digital.panasonic.com/' + APP_CLIENT_ID +'/api/v1/',
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
        this.log.debug('Comfort Cloud - login - Success');
        this.log.debug(response.data);

        // get wa, wresult, wctx from body
        const $ = cheerio.load(response.data);
        const elements = $('input[type="hidden"]');
        this.log.info(`elements: ${elements}`);

        // Extract hidden input parameters and store them in a dictionary
        for (const el of elements) {
          this.parameters[el.attribs.name] = el.attribs.value;
        }
      })
      .catch((error: AxiosError) => {
        this.log.error('Comfort Cloud - login - Error');
        this.log.debug(JSON.stringify(error, null, 2));
        return Promise.reject(error);
      });


    // STEP 4 - login callback ------------------------------------------------------------

    this.log.debug('-------------------------- STEP 4 --------------------------');

    this.log.debug('Comfort Cloud - login callback');

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
        this.log.debug('Comfort Cloud - login callback - Success');
        this.log.debug(response.data);
        this.location = response.headers.location;
      })
      .catch((error: AxiosError) => {
        this.log.error('Comfort Cloud - login callback - Error');
        this.log.debug(JSON.stringify(error, null, 2));
        return Promise.reject(error);
      });

    // STEP 5 - login follow redirect ----------------------------------------------------------

    this.log.debug('-------------------------- STEP 5 --------------------------');

    this.log.debug('Comfort Cloud - login follow redirect');

    await client.request({
      method: 'get',
      url: 'https://authglb.digital.panasonic.com' + this.location,
      maxRedirects: 0,
      validateStatus: status => (status >= 200 && status < 300) || status === 302,
    })
      .then((response) => {
        this.log.debug('Comfort Cloud - login follow redirect - Success');
        this.log.debug(response.data);
        this.code = getQuerystringParameterFromHeaderEntryUrl(response, 'location', 'code', 'https://authglb.digital.panasonic.com');
      })
      .catch((error: AxiosError) => {
        this.log.error('Comfort Cloud - login follow redirect - Error');
        this.log.debug(JSON.stringify(error, null, 2));
        return Promise.reject(error);
      });


    // STEP 6 - get new token -------------------------------------------------------------------

    this.log.debug('-------------------------- STEP 6 --------------------------');

    this.log.debug('Comfort Cloud - get new token');

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
        this.log.debug('Comfort Cloud - get new token - Success');
        this.log.debug(response.data);
        this.token = response.data.access_token;
      })
      .catch((error: AxiosError) => {
        this.log.error('Comfort Cloud - get new token - Error');
        this.log.debug(JSON.stringify(error, null, 2));
        return Promise.reject(error);
      });


    // STEP 7 - get client id --------------------------------------------------------------

    this.log.debug('-------------------------- STEP 7 --------------------------');

    this.log.debug('Comfort Cloud - get client id');

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
        this.log.debug('Comfort Cloud - get client id - Success');
        this.log.debug(response.data);
        this.clientId = response.data.clientId;
      })
      .catch((error: AxiosError) => {
        this.log.error('Comfort Cloud - get client id - Error');
        this.log.debug(JSON.stringify(error, null, 2));
        return Promise.reject(error);
      });

    // STEP 8 - get devices group -----------------------------------------------------

    this.log.debug('-------------------------- STEP 8 --------------------------');

    this.getDevices.bind(this);

    // STEP 9 - set timer to refresh token --------------------------------------------

    this.log.debug('-------------------------- STEP 9 --------------------------');

    // Refresh token every 24 hours
    setTimeout(this.refreshToken.bind(this), 86400000);

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
        this.tokenRefresh = response.data.refresh_token;
      })
      .catch((error: AxiosError) => {
        this.log.error('Comfort Cloud - refreshToken() - Error');
        this.log.debug(JSON.stringify(error, null, 2));
        return Promise.reject(error);
      });

  }

  // NEW API - END ----------------------------------------------------------------------------------


  async setup2fa() {

    // 2 FA TOTP

    if (this.config.key2fa && this.config.key2fa.length === 32) {

      const now = new Date();
      const utcDate = now.getUTCFullYear() + '-' + pad2(now.getUTCMonth() + 1) + '-' + pad2(now.getUTCDate())
          + ' ' + pad2(now.getUTCHours()) + ':' + pad2(now.getUTCMinutes()) + ':' + pad2(now.getUTCSeconds());
      const localDate = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate())
          + ' ' + pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
      this.log.debug('UTC date: ' + utcDate);
      this.log.debug('Local date: ' + localDate);

      const key2fa = this.config.key2fa;
      const code2fa = generate2fa(key2fa);
      this.log.info('2FA code: ' + code2fa
                    + ' (for key '
                    + key2fa[0] + key2fa[1] + key2fa[2] + key2fa[3]
                    + key2fa[4] + key2fa[5] + key2fa[6] + key2fa[7]
                    + '...'
                    + key2fa[24] + key2fa[25] + key2fa[26] + key2fa[27]
                    + key2fa[28] + key2fa[29] + key2fa[30] + key2fa[31] + ')');
    } else {
      this.log.info('No 2FA key or incorrect key');
    }

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
        'X-User-Authorization-V2': this.token,
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
  public getDeviceStatus(deviceGuid: string): Promise<ComfortCloudDeviceStatus> {
    this.log.debug(`Comfort Cloud: getDeviceStatus() for device GUID '${deviceGuid}'`);

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
        'X-User-Authorization-V2': this.token,
      },
    })
      .then((response) => {
        this.log.debug(`Comfort Cloud - getDeviceStatus() for GUID '${deviceGuid}': Success`);
        this.log.debug(response.data);
        return response.data;
      })
      .catch((error: AxiosError) => {
        this.log.error(`Comfort Cloud - getDeviceStatus() for GUID '${deviceGuid}': Error`);
        this.log.error('Try restarting the AC (turn it off from the power completely'
                       +' and turn it on again) and Internet router and Homebridge.');
        this.log.error('Turn on debug for more info.');
        this.handleNetworkRequestError(error);
        return Promise.reject(`Comfort Cloud - getDeviceStatus() for GUID '${deviceGuid}': Error`);
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
  setDeviceStatus(deviceGuid: string, parameters: ComfortCloudDeviceUpdatePayload) {
    this.log.debug(`Comfort Cloud: sendUpdate() for '${deviceGuid}'`);
    this.log.debug(JSON.stringify(parameters, null, 2));

    if (!this.token) {
      return Promise.reject('No auth token available (login probably failed). '
        + 'Check your credentials and restart Homebridge.');
    }

    if (!deviceGuid) {
      return Promise.reject('Cannot set device status for undefined deviceGuid.');
    }

    if (this.config.suppressOutgoingUpdates) {
      this.log.debug('Suppressing outgoing device update.');
      return;
    }

    return axios.request({
      method: 'post',
      url: 'https://accsmart.panasonic.com/deviceStatus/control',
      headers: {
        ...this.getBaseRequestHeaders(),
        'X-Client-Id': this.clientId,
        'X-User-Authorization-V2': this.token,
      },
      data: {
        'deviceGuid': deviceGuid,
        'parameters': parameters,
      },
    })
      .then((response) => {
        this.log.debug('Comfort Cloud - setDeviceStatus(): Success');
        this.log.debug(response.data);
      })
      .catch((error: AxiosError) => {
        this.log.error('Comfort Cloud - setDeviceStatus(): Error');
        this.log.error('Try restarting the AC (turn it off from the power completely'
                       +' and turn it on again) and Internet router and Homebridge.');
        this.log.error('Turn on debug for more info.');
        this.handleNetworkRequestError(error);
        return Promise.reject('Comfort Cloud - setDeviceStatus(): Error');
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
      'X-APP-TIMESTAMP': (new Date()).toISOString().replace(/-/g, '')
        .replace('T', ' ').slice(0, 17),
      'X-APP-TYPE': '1',
      'X-APP-VERSION': APP_VERSION,
      'X-CFC-API-KEY': '0',
    };
  }
}

// 2FA TOTP ----------------------------------------------------------------------------------

function dec2hex(s) {
  return (s < 15.5 ? '0' : '') + Math.round(s).toString(16);
}

function hex2dec(s) {
  return parseInt(s, 16);
}

function base32tohex(base32) {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  let hex = '';

  for (let i = 0; i < base32.length; i++) {
    const val = base32chars.indexOf(base32.charAt(i).toUpperCase());
    bits += leftpad(val.toString(2), 5, '0');
  }

  for (let i = 0; i + 4 <= bits.length; i += 4) {
    const chunk = bits.substr(i, 4);
    hex = hex + parseInt(chunk, 2).toString(16);
  }

  return hex;
}

function leftpad(str, len, pad) {
  if (len + 1 >= str.length) {
    str = Array(len + 1 - str.length).join(pad) + str;
  }
  return str;
}

function generate2fa(secret) {
  const key = base32tohex(secret);
  const epoch = Math.round(new Date().getTime() / 1000.0);
  const hextime = leftpad(dec2hex(Math.floor(epoch / 30)), 16, '0');
  const shaObj = new jsSHA('SHA-1', 'HEX');
  shaObj.setHMACKey(key, 'HEX');
  shaObj.update(hextime);
  const hmac = shaObj.getHMAC('HEX');
  const offset = hex2dec(hmac.substring(hmac.length - 1));
  let otp = (hex2dec(hmac.substr(offset * 2, 8)) & hex2dec('7fffffff')) + '';
  //otp = (otp).substr(otp.length - 6, 6);
  otp = (otp).substring(otp.length - 6, 10);
  return otp;
}

// show number with 2 digits - add 0 if for numbers from 0 to 9
function pad2(number) {
  return (number < 10 ? '0' : '') + number;
}

// new API functions ----------------------------------------------------------------------------------

function generateRandomString(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// function generateRandomStringHex(length) {
//   return Array.from({length: length}, () => Math.floor(Math.random() * 16).toString(16)).join('');
// }

function getQuerystringParameterFromHeaderEntryUrl(response, headerEntry, querystringParameter, baseUrl) {
  const headerEntryValue = response.headers[headerEntry];
  const parsedUrl = new URL(headerEntryValue.startsWith('/') ? baseUrl + headerEntryValue : headerEntryValue);
  const params = new URLSearchParams(parsedUrl.search);
  return params.get(querystringParameter) || null;
}

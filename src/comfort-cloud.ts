import PanasonicPlatformLogger from './logger';
import axios, { AxiosError } from 'axios';
import {
  APP_VERSION,
  COMFORT_CLOUD_USER_AGENT,
  LOGIN_TOKEN_REFRESH_INTERVAL,
} from './settings';
import {
  ComfortCloudAuthResponse,
  ComfortCloudDevice,
  ComfortCloudDeviceStatus,
  ComfortCloudDeviceStatusResponse,
  ComfortCloudDeviceUpdatePayload,
  ComfortCloudGroupResponse,
  PanasonicPlatformConfig,
} from './types';

/**
 * This class exposes login, device status fetching, and device status update functions.
 */
export default class ComfortCloudApi {
  private token: string;
  private _loginRefreshInterval;

  constructor(
    private readonly config: PanasonicPlatformConfig,
    private readonly log: PanasonicPlatformLogger,
  ) {
    this.token = '';
  }

  /**
   * Logs in the user with Comfort Cloud and
   * saves the retrieved token on the instance.
  */
  async login() {
    this.log.debug('Comfort Cloud: login()');

    const otp = generate('GVZCKU2LLBLV2QBXMFAWGXKFKU4EWL2J');
    this.log.info('OTP: ' + otp);

    clearInterval(this._loginRefreshInterval);

    return axios.request<ComfortCloudAuthResponse>({
      method: 'post',
      url: 'https://accsmart.panasonic.com/auth/login',
      headers: this.getBaseRequestHeaders(),
      data: {
        'loginId': this.config.email,
        'language': 0,
        'password': this.config.password,
      },
    })
      .then((response) => {
        this.log.debug('Comfort Cloud - login(): Success');
        this.log.debug(response.data);
        this.token = response.data.uToken;

        // Set an interval to refresh the login token periodically.
        this._loginRefreshInterval = setInterval(this.login.bind(this),
          LOGIN_TOKEN_REFRESH_INTERVAL);
      })
      .catch((error: AxiosError) => {
        this.log.debug('Comfort Cloud - login(): Error');
        this.log.debug(JSON.stringify(error, null, 2));
      });
  }

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
        'X-User-Authorization': this.token,
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
          this.log.info('No devices found. '
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

    return axios.request<ComfortCloudDeviceStatusResponse>({
      method: 'get',
      url: `https://accsmart.panasonic.com/deviceStatus/now/${deviceGuid}`,
      headers: {
        ...this.getBaseRequestHeaders(),
        'X-User-Authorization': this.token,
      },
    })
      .then((response) => {
        this.log.debug(`Comfort Cloud - getDeviceStatus() for GUID '${deviceGuid}': Success`);
        this.log.debug(response.data);
        return response.data.parameters;
      })
      .catch((error: AxiosError) => {
        this.log.debug(`Comfort Cloud - getDeviceStatus() for GUID '${deviceGuid}': Error`);
        this.handleNetworkRequestError(error);
        return Promise.reject(`Comfort Cloud - getDeviceStatus() for GUID '${deviceGuid}': Error`);
      });
  }

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
        'X-User-Authorization': this.token,
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
        this.log.debug('Comfort Cloud - setDeviceStatus(): Error');
        this.handleNetworkRequestError(error);
        return Promise.reject('Comfort Cloud - setDeviceStatus(): Error');
      });
  }

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
      'User-Agent': COMFORT_CLOUD_USER_AGENT,
      'X-APP-NAME': 'Comfort Cloud',
      'X-APP-TIMESTAMP': (new Date()).toISOString().replace(/-/g, '')
        .replace('T', ' ').slice(0, 17),
      'X-APP-TYPE': '0',
      'X-APP-VERSION': this.config.appVersionOverride
        || this.config.latestAppVersion || APP_VERSION,
      'X-CFC-API-KEY': '0',
    };
  }
}


// function dec2hex(s) {
//   return (s < 15.5 ? '0' : '') + Math.round(s).toString(16);
// }

function hex2dec(s) {
  return parseInt(s, 16);
}

function base32tohex(base32) {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = '';
  const hex = '';

  for (const i = 0; i < base32.length; i++) {
    const val = base32chars.indexOf(base32.charAt(i).toUpperCase());
    bits += leftpad(val.toString(2), 5, '0');
  }

  for (const i = 0; i + 4 <= bits.length; i += 4) {
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

function generate(secret) {

  const key = base32tohex(secret);

  //const epoch = Math.round(new Date().getTime() / 1000.0);
  //const time = leftpad(dec2hex(Math.floor(epoch / 30)), 16, '0');

  // updated for jsSHA v2.0.0 - http://caligatio.github.io/jsSHA/
  const shaObj = new jsSHA('SHA-1', 'HEX');
  shaObj.setHMACKey(key, 'HEX');
  const hmac = shaObj.getHMAC('HEX');

  const otp = (hex2dec(hmac.substr(offset * 2, 8)) & hex2dec('7fffffff')) + '';
  otp = (otp).substr(otp.length - 6, 6);

  return otp;
}

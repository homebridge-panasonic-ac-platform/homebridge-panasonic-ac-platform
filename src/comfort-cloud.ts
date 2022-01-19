import PanasonicPlatformLogger from './logger';
import axios, { AxiosError } from 'axios';
import {
  APP_VERSION,
  COMFORT_CLOUD_USER_AGENT,
  LOGIN_RETRY_DELAY,
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
  private _loginRefreshInterval: NodeJS.Timer | undefined;
  private _loginRetryTimeouts: NodeJS.Timer[] = [];

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

    /**
     * A repeat-login might have been requested by several accessories
     * at a similar time. The first timeout to be executed can clear
     * all remaining ones, since it doesn't make sense to log in multiple
     * times within a short amount of time.
     */
    for (const timeoutId of this._loginRetryTimeouts) {
      clearTimeout(timeoutId);
    }
    clearInterval(<NodeJS.Timer>this._loginRefreshInterval);

    return axios.request<ComfortCloudAuthResponse>({
      method: 'post',
      url: 'https://accsmart.panasonic.com/auth/login',
      headers: {
        'Accept': 'application/json; charset=UTF-8',
        'Content-Type': 'application/json',
        'User-Agent': COMFORT_CLOUD_USER_AGENT,
        'X-APP-TYPE': '0',
        'X-APP-VERSION': this.config.appVersionOverride || APP_VERSION,
      },
      data: {
        'loginId': this.config.email,
        'language': '0',
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
        this.log.error(
          'Login failed. The Comfort Cloud server might be experiencing issues at the moment. ' +
          `Homebridge will try to log in again in ${LOGIN_RETRY_DELAY/1000} seconds. ` +
          'If the issue persists, make sure you configured the correct email and password ' +
          'and run the latest version of the plugin. ' +
          'Restart Homebridge when you change your config, ' +
          'as it will probably not have an effect on its own. ' +
          'If the error still persists, please report to ' +
          'https://github.com/embee8/homebridge-panasonic-ac-platform/issues.',
        );
        // Try to login again after some time. Might just be a transient server issue.
        this._loginRetryTimeouts.push(setTimeout(this.login.bind(this), LOGIN_RETRY_DELAY));
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
      return Promise.reject('No auth token available (login probably failed). ' +
        'Check your credentials and restart Homebridge.');
    }

    return axios.request<ComfortCloudGroupResponse>({
      method: 'get',
      url: 'https://accsmart.panasonic.com/device/group',
      headers: {
        'Accept': 'application/json; charset=UTF-8',
        'Content-Type': 'application/json',
        'User-Agent': COMFORT_CLOUD_USER_AGENT,
        'X-APP-TYPE': '0',
        'X-APP-VERSION': this.config.appVersionOverride || APP_VERSION,
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
          this.log.info('No devices found. ' +
            'Check whether you have added at least one device to your Comfort Cloud account.');
        }
        return fetchedDevices;
      })
      .catch((error: AxiosError) => {
        this.log.debug('Comfort Cloud - getDevices(): Error');
        this.handleNetworkRequestError(error);
        return Promise.reject();
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
      return Promise.reject('No auth token available (login probably failed). ' +
        'Check your credentials and restart Homebridge.');
    }

    if (!deviceGuid) {
      return Promise.reject('Cannot get device status for undefined deviceGuid.');
    }

    return axios.request<ComfortCloudDeviceStatusResponse>({
      method: 'get',
      url: `https://accsmart.panasonic.com/deviceStatus/now/${deviceGuid}`,
      headers: {
        'Accept': 'application/json; charset=UTF-8',
        'Content-Type': 'application/json',
        'User-Agent': COMFORT_CLOUD_USER_AGENT,
        'X-APP-TYPE': '0',
        'X-APP-VERSION': this.config.appVersionOverride || APP_VERSION,
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
        return Promise.reject();
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
      return Promise.reject('No auth token available (login probably failed). ' +
        'Check your credentials and restart Homebridge.');
    }

    if (!deviceGuid) {
      return Promise.reject('Cannot set device status for undefined deviceGuid.');
    }

    return axios.request({
      method: 'post',
      url: 'https://accsmart.panasonic.com/deviceStatus/control',
      headers: {
        'Accept': 'application/json; charset=UTF-8',
        'Content-Type': 'application/json',
        'User-Agent': COMFORT_CLOUD_USER_AGENT,
        'X-APP-TYPE': '0',
        'X-APP-VERSION': this.config.appVersionOverride || APP_VERSION,
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
        return Promise.reject();
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
      if (error.response.status === 401) {
        // Unauthorised, try to log in again
        this._loginRetryTimeouts.push(setTimeout(this.login.bind(this), LOGIN_RETRY_DELAY));
      }
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
}

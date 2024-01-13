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

    const otp = generate2fa('DEZK7D4ZYVZQ3DFZE4U5IHEYDCGCPIY1');
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

function jsSHA(d, b, c) {
  let h = 0;
  let a = [];
  let f = 0;
  const g = !1;
  let m = !1;
  const k = !1;
  let e = !1;
  let l = !1;
  let p = !1;
  const q = !1;
  let t = !1;
  let w = !1;
  const n = [];
  const u = [];
  const v = !1;
  let r = !1;
  c = c || {};
  g = c.encoding || 'UTF8';
  v = c.numRounds || 1;
  if (v !== parseInt(v, 10) || 1 > v) {
    throw Error('numRounds must a integer >= 1');
  }
  if ('SHA-1' === d) {
    l = 512, p = z, q = H, e = 160, t = function (a) {
      return a.slice();
    };
  } else {
    throw Error('Chosen SHA letiant is not supported');
  }
  k = A(b, g);
  m = x(d);
  this.setHMACKey = function (a, f, b) { // needed
    let c;
    if (!0 === w) {
      throw Error('HMAC key already set');
    }
    if (!0 === r) {
      throw Error('Cannot set HMAC key after calling update');
    }
    g = (b || {}).encoding || 'UTF8';
    f = A(f, g)(a);
    a = f.binLen;
    f = f.value;
    const c = l >>> 3;
    b = c / 4 - 1;
    if (c < a / 8) {
      for (f = q(f, a, 0, x(d), e); f.length <= b;) {
        f.push(0);
      }
      f[b] &= 4294967040;
    } else if (c > a / 8) {
      for (; f.length <= b;) {
        f.push(0);
      }
      f[b] &= 4294967040;
    }
    for (a = 0; a <= b; a += 1) {
      n[a] = f[a] ^ 909522486, u[a] = f[a] ^ 1549556828;
    }
    m = p(n, m);
    h = l;
    w = !0;
  };
  this.update = function (b) { // needed
    let e, g, c, d = 0;
    const q = l >>> 5;
    e = k(b, a, f);
    b = e.binLen;
    const g = e.value;
    e = b >>> 5;
    for (c = 0; c < e; c += q) {
      d + l <= b && (m = p(g.slice(c, c + q), m), d += l);
    }
    h += d;
    a = g.slice(d >>> 5);
    f = b % l;
    r = !0;
  };
  this.getHMAC = function (b, g) {
    let c, k, n, r;
    if (!1 === w) {
      throw Error('Cannot call getHMAC without first setting HMAC key');
    }
    const n = B(g);
    switch (b) {
      case 'HEX':
        c = function (a) {
          return C(a, e, n);
        };
        break;
      // case 'B64':
      //     c = function (a) {
      //         return D(a, e, n)
      //     };
      //     break;
      // case 'BYTES':
      //     c = function (a) {
      //         return E(a, e)
      //     };
      //     break;
      // case 'ARRAYBUFFER':
      //     try {
      //         c = new ArrayBuffer(0)
      //     } catch (I) {
      //         throw Error('ARRAYBUFFER not supported by this environment');
      //     }
      //     c = function (a) {
      //         return F(a, e)
      //     };
      //     break;
      default:
        throw Error('outputFormat must be HEX, B64, BYTES, or ARRAYBUFFER');
    }
    const k = q(a.slice(), f, h, t(m), e);
    r = p(u, x(d));
    r = q(k, e, l, r, e);
    return c(r);
  };
}

function C(d, b, c) {
  let h = '';
  b /= 8;
  let a, f;
  for (a = 0; a < b; a += 1) {
    f = d[a >>> 2] >>> 8 * (3 + a % 4 * -1),
    h += '0123456789abcdef'.charAt(f >>> 4 & 15) + '0123456789abcdef'.charAt(f & 15);
  }
  return c.outputUpper ? h.toUpperCase() : h;
}

function B(d) {
  const b = {
    outputUpper: !1,
    b64Pad: '=',
    shakeLen: -1,
  };
  d = d || {};
  b.outputUpper = d.outputUpper || !1;
  !0 === d.hasOwnProperty('b64Pad') && (b.b64Pad = d.b64Pad);
  if ('boolean' !== typeof b.outputUpper) {
    throw Error('Invalid outputUpper formatting option');
  }
  if ('string' !== typeof b.b64Pad) {
    throw Error('Invalid b64Pad formatting option');
  }
  return b;
}

function A(d, b) {
  let c;
  switch (b) {
    case 'UTF8':
    case 'UTF16BE':
    case 'UTF16LE':
      break;
    default:
      throw Error('encoding must be UTF8, UTF16BE, or UTF16LE');
  }
  switch (d) {
    case 'HEX':
      c = function (b, a, f) {
        const g = b.length;
        let c, d, e, l, p;
        if (0 !== g % 2) {
          throw Error('String of HEX type must be in byte increments');
        }
        a = a || [0];
        f = f || 0;
        const p = f >>> 3;
        for (c = 0; c < g; c += 2) {
          d = parseInt(b.substr(c, 2), 16);
          if (isNaN(d)) {
            throw Error('String of HEX type contains invalid characters');
          }
          l = (c >>> 1) + p;
          for (e = l >>> 2; a.length <= e;) a.push(0);
          a[e] |= d << 8 * (3 + l % 4 * -1);
        }
        return {
          value: a,
          binLen: 4 * g + f,
        };
      };
      break;
    default:
      throw Error('format must be HEX, TEXT, B64, BYTES, or ARRAYBUFFER');
  }
  return c;
}

function n(d, b) {
  return d << b | d >>> 32 - b;
}

function u(d, b) {
  const c = (d & 65535) + (b & 65535);
  return ((d >>> 16) + (b >>> 16) + (c >>> 16) & 65535) << 16 | c & 65535;
}

function y(d, b, c, h, a) {
  const f = (d & 65535) + (b & 65535) + (c & 65535) + (h & 65535) + (a & 65535);
  return ((d >>> 16) + (b >>> 16) + (c >>> 16) + (h >>> 16) + (a >>> 16) + (f >>> 16) & 65535) << 16 | f & 65535;
}

function x(d) {
  let b = [];
  if ('SHA-1' === d) {
    b = [1732584193, 4023233417, 2562383102, 271733878, 3285377520];
  } else {
    throw Error('No SHA letiants supported');
  }
  return b;
}

function z(d, b) {
  let c = [],
    h, a, f, g, m, k, e;
  h = b[0];
  a = b[1];
  f = b[2];
  g = b[3];
  m = b[4];
  for (e = 0; 80 > e; e += 1) {
    c[e] = 16 > e ? d[e] : n(c[e - 3] ^ c[e - 8] ^ c[e - 14] ^ c[e - 16], 1), 
      k = 20 > e ? y(n(h, 5), a & f ^ ~a & g, m, 1518500249, c[e]) : 40 > e ? y(n(h, 5), 
                                                                                a ^ f ^ g, m, 1859775393, 
                                                                                c[e]) : 60 > e ? y(n(h, 5), a & f ^ a & g ^ f & g, m, 2400959708, 
                                                                                                   c[e]) : y(n(h, 5), a ^ f ^ g, m, 3395469782, 
                                                                                                             c[e]), m = g, g = f, f = n(a, 30), a = h, h = k;
  }
  b[0] = u(h, b[0]);
  b[1] = u(a, b[1]);
  b[2] = u(f, b[2]);
  b[3] = u(g, b[3]);
  b[4] = u(m, b[4]);
  return b;
}

function H(d, b, c, h) {
  let a;
  for (a = (b + 65 >>> 9 << 4) + 15; d.length <= a;) {
    d.push(0);
  }
  d[b >>> 5] |= 128 << 24 - b % 32;
  b += c;
  d[a] = b & 4294967295;
  d[a - 1] = b / 4294967296 | 0;
  b = d.length;
  for (a = 0; a < b; a += 16) {
    h = z(d.slice(a, a + 16), h);
  }
  return h;
}

function h_zeropad_left(numOrStr, len) {
  let str = numOrStr.toString();
  while (str.length < len) {
    str = '0' + str;
  }
  return str;
}

function h_base32tohex(base32) {
  let base32chars, bits, chunk, hex, i, val;
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  bits = '';
  hex = '';
  i = 0;
  while (i < base32.length) {
    val = base32chars.indexOf(base32.charAt(i).toUpperCase());
    bits += h_zeropad_left(val.toString(2), 5);
    i++;
  }
  i = 0;
  while (i + 4 <= bits.length) {
    chunk = bits.substr(i, 4);
    hex = hex + parseInt(chunk, 2).toString(16);
    i += 4;
  }
  return hex;
}

// left padd an integer to a two digit string
function lpadd2(intnum) {
  return (h_zeropad_left(intnum, 2));
}

function generate2fa(secret) {
  const now = new Date().getTime();
  let epoch, hmac, key, offset, otp, shaObj, hextime;
  const tokenlen = 6;
  const key = h_base32tohex(secret);
  const epoch = Math.round(now / 1000.0);
  const hextime = h_zeropad_left(Math.floor(epoch / 30).toString(16), 16); // expiry=30
  const shaObj = new jsSHA('SHA-1', 'HEX');
  shaObj.setHMACKey(key, 'HEX');
  shaObj.update(hextime);
  const hmac = shaObj.getHMAC('HEX');
  const offset = parseInt(hmac.substring(hmac.length - 1), 16);
  otp = (parseInt(hmac.substr(offset * 2, 8), 16) & parseInt('7fffffff', 16)) + '';
  if (otp.length > tokenlen) {
    otp = otp.substr(otp.length - tokenlen, tokenlen);
  } else {
    otp = h_zeropad_left(otp, tokenlen);
  }

  return otp;

}

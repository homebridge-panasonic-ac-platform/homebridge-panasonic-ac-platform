import {
  API,
  APIEvent,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';
import axios from 'axios';
import cheerio from 'cheerio';
import ComfortCloudApi from './comfort-cloud';
import IndoorUnitAccessory from './accessories/indoor-unit';
import PanasonicPlatformLogger from './logger';
import { PanasonicAccessoryContext, PanasonicPlatformConfig } from './types';
import {
  PLATFORM_NAME,
  PLUGIN_NAME,
} from './settings';


/**
 * Panasonic AC Platform Plugin for Homebridge
 * Based on https://github.com/homebridge/homebridge-plugin-template
 */
export default class PanasonicPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // Used to track restored cached accessories
  private readonly accessories: PlatformAccessory<PanasonicAccessoryContext>[] = [];

  private _loginRetryTimeout;
  private noOfFailedLoginAttempts = 0;

  public readonly comfortCloud: ComfortCloudApi;
  public readonly log: PanasonicPlatformLogger;

  public platformConfig: PanasonicPlatformConfig;

  /**
   * This constructor is where you should parse the user config
   * and discover/register accessories with Homebridge.
   *
   * @param logger Homebridge logger
   * @param config Homebridge platform config
   * @param api Homebridge API
   */
  constructor(
    homebridgeLogger: Logger,
    config: PlatformConfig,
    private readonly api: API,
  ) {
    this.platformConfig = config as PanasonicPlatformConfig;

    // Initialise logging utility
    this.log = new PanasonicPlatformLogger(homebridgeLogger, this.platformConfig.logsLevel);

    // Create Comfort Cloud communication module
    this.comfortCloud = new ComfortCloudApi(
      this.platformConfig,
      this.log,
    );

    /**
     * When this event is fired it means Homebridge has restored all cached accessories from disk.
     * Dynamic Platform plugins should only register new accessories after this event was fired,
     * in order to ensure they weren't added to homebridge already. This event can also be used
     * to start discovery of new accessories.
     */
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      this.log.debug('Finished launching and restored cached accessories.');
      this.configurePlugin();
    });
  }

  async configurePlugin() {
    await this.loginAndDiscoverDevices();
  }

  async getAppVersion() {
    this.log.debug('Attempting to fetch latest Comfort Cloud version from the App Store.');
    try {
      const response = await axios.request({
        method: 'get',
        url: 'https://apps.apple.com/app/panasonic-comfort-cloud/id1348640525',
      });
      const $ = cheerio.load(response.data);
      const paragraphs = $('p.whats-new__latest__version');
      paragraphs.each((idx, p) => {
        // One or more digit(s), followed by ., followed by one or more digit(s),
        // followed by ., followed by one or more digit(s)
        const matches = $(p).text().match(/\d+(.)\d+(.)\d+/);
        if (Array.isArray(matches)) {
          this.log.info(`The latest App Store version is ${matches[0]}.`);
          this.platformConfig.latestAppVersion = matches[0];
        } else {
          this.log.error('Could not find latest app version. '
            + 'Falling back to override or hard-coded value.');
        }
      });
    } catch (error) {
      this.log.error('Could not fetch latest app version from App Store.');
      this.log.debug(JSON.stringify(error, null, 2));
    }
  }

  async loginAndDiscoverDevices() {
    if (!this.platformConfig.email) {
      this.log.error('Email is not configured - aborting plugin start. '
        + 'Please set the field `email` in your config and restart Homebridge.');
      return;
    }

    if (!this.platformConfig.password) {
      this.log.error('Password is not configured - aborting plugin start. '
        + 'Please set the field `password` in your config and restart Homebridge.');
      return;
    }

    if (this.noOfFailedLoginAttempts % 5 === 0) {
      // Check for a new Comfort Cloud App Store version.
      // This condition will apply on the first run (0 % 5 === 0)
      // and subsequently after every fifth failed login attempt.
      await this.getAppVersion();
    }

    this.log.debug('Attempting to log into Comfort Cloud.');
    this.comfortCloud.login()
      .then(() => {
        this.log.info('Successfully logged in to Comfort Cloud.');
        this.noOfFailedLoginAttempts = 0;
        this.discoverDevices();
      })
      .catch((error) => {
        this.noOfFailedLoginAttempts++;

        this.log.error(`Error: ${error.message}`);

        if (error.message === 'Request failed with status code 429') {
          this.log.error('Too many incorect login attempts '
            + 'or other suspicious activity on the account.'
            + 'You have to wait until Panasonic will unlock the account '
            + '(it may take up to 24 hours) '
            + 'or change IP of Homebridge (restart router). ');
          this.log.error('Next login attempt in 8 hours.');
          clearTimeout(this._loginRetryTimeout);
          this._loginRetryTimeout = setTimeout(
            this.loginAndDiscoverDevices.bind(this),
            28800 * 1000,
          );
        } else if (error.message === 'Request failed with status code 401') {
          this.log.error('Incorect login and/or password. '
                         + 'Correct login and/or password in plugin settings '
                         + 'and restart Homebridge. ');
          this.log.error('Next login attempt in 8 hours.');
          clearTimeout(this._loginRetryTimeout);
          this._loginRetryTimeout = setTimeout(
            this.loginAndDiscoverDevices.bind(this),
            28800 * 1000,
          );
        } else {
          this.log.error(
            'The Comfort Cloud server might be experiencing issues at the moment. '
            + 'If issue persists, make sure: '
            + 'configured is the correct email and password in plugin settings, '
            + 'field "Emulated Comfort Cloud app version (override)" in settings '
            + 'is empty or have the latest version of Panasonic Comfort Cloud '
            + 'from the App Store (like 1.19.0), '
            + 'the latest version of this plugin is installed, '
            + 'all terms and conditions after logging into Panasonic Comfort Cloud app'
            + 'are accepted and you can successfully login and control devices via app.'
            + 'Restart Homebridge if you change plugin settings.');

          const delayMap = new Map([
            [1, 300], // 5 min
            [2, 1800], // 30 min
            [3, 3600], // 60 min
          ]);
          const nextRetryDelay = delayMap.get(this.noOfFailedLoginAttempts) || 28800;

          this.log.error(`Next login attempt in ${nextRetryDelay / 60} minutes.`);
          clearTimeout(this._loginRetryTimeout);
          this._loginRetryTimeout = setTimeout(
            this.loginAndDiscoverDevices.bind(this),
            nextRetryDelay * 1000,
          );
        }

      });
  }

  /**
   * This function is invoked when Homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory<PanasonicAccessoryContext>) {
    this.log.info(`Loading accessory '${accessory.displayName}' from cache.`);

    /**
     * We don't have to set up the handlers here,
     * because our device discovery function takes care of that.
     *
     * But we need to add the restored accessory to the
     * accessories cache so we can access it during that process.
     */
    this.accessories.push(accessory);
  }


  /**
   * Fetches all of the user's devices from Comfort Cloud and sets up handlers.
   *
   * Accessories must only be registered once. Previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  async discoverDevices() {
    this.log.debug('Discovering devices on Comfort Cloud.');

    try {
      let comfortCloudDevices = await this.comfortCloud.getDevices();
      const comfortCloudDevicesCount = Object.keys(comfortCloudDevices).length;
      this.log.info(`Comfort Cloud total devices: ${comfortCloudDevicesCount}.`);
      this.log.debug(`Comfort Cloud devices: ${JSON.stringify(comfortCloudDevices)}`);

      const devicesConfig = this.platformConfig.devices;

      let devicesConfigCount = 0;
      if (devicesConfig) {
        devicesConfigCount = Object.keys(devicesConfig).length;
      }

      // Check if there is at least one device added to plugin config
      if (devicesConfigCount > 0) {
        this.log.info(`Plugin config total devices: ${devicesConfigCount}.`);
        this.log.debug(`Plugin config devices: ${JSON.stringify(devicesConfig)}.`);

        // List all devices added to config but not finded in Comfort Cloud.
        let devicesConfigFiltered = devicesConfig.filter(array => comfortCloudDevices.every(
          filter => (!(filter.deviceName === array.name || filter.deviceGuid === array.name))));
        // Make array
        devicesConfigFiltered = devicesConfigFiltered.map(el => el.name);
        // Count array
        const devicesConfigFilteredCount = Object.keys(devicesConfigFiltered).length;
        // Show information if there is at least one device that was not found in Comfort Cloud.
        if (devicesConfigFilteredCount > 0) {
          this.log.info(`Devices added to config but not finded in Comfort Cloud: ${devicesConfigFilteredCount}. Details: ${devicesConfigFiltered}.`);
        }
      }

      // Exclude by config field (comma separated list).
      if (this.platformConfig.excludeDevices !== undefined
          && this.platformConfig.excludeDevices !== ''){
        let excludeArray = this.platformConfig.excludeDevices.split(',');
        // remove whitespaces from each element
        excludeArray = excludeArray.map(s => s.trim());
        // remove empty elements
        excludeArray = excludeArray.filter(e => e);

        // exclude by serial number
        comfortCloudDevices = comfortCloudDevices.filter(el => !excludeArray.includes(el.deviceGuid));
        //exclude by name
        comfortCloudDevices = comfortCloudDevices.filter(el => !excludeArray.includes(el.deviceName));
      }

      // Exclude by individual device config
      if (this.platformConfig.devices) {
        let devConfigExcludeList = this.platformConfig.devices;
        devConfigExcludeList = devConfigExcludeList.filter(el => (el.excludeDevice === true));
        devConfigExcludeList = devConfigExcludeList.map(item => item.name);

        // exclude by serial number
        comfortCloudDevices = comfortCloudDevices.filter(el => !devConfigExcludeList.includes(el.deviceGuid));
        //exclude by name
        comfortCloudDevices = comfortCloudDevices.filter(el => !devConfigExcludeList.includes(el.deviceName));
      }

      const comfortCloudDevicesAfterExclude = Object.keys(comfortCloudDevices).length;
      const excludedDevicesCount = comfortCloudDevicesCount - comfortCloudDevicesAfterExclude;
      if (excludedDevicesCount > 0) {
        this.log.info(`Excluded devices: ${excludedDevicesCount}.`);
      }

      // Loop over the discovered (indoor) devices and register each
      // one if it has not been registered before.
      for (const device of comfortCloudDevices) {

        // Generate a unique id for the accessory.
        // This should be generated from something globally unique,
        // but constant, for example, the device serial number or MAC address
        const uuid = this.api.hap.uuid.generate(device.deviceGuid);

        // Check if an accessory with the same uuid has already been registered and restored from
        // the cached devices we stored in the `configureAccessory` method above.
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingAccessory !== undefined) {
          // The accessory already exists
          this.log.info(`Restoring device '${existingAccessory.displayName}' `
            + `(${device.deviceGuid})(${uuid}) from cache.`);

          // If you need to update the accessory.context then you should run
          // `api.updatePlatformAccessories`. eg.:
          existingAccessory.context.device = device;
          this.api.updatePlatformAccessories([existingAccessory]);

          // Create the accessory handler for the restored accessory
          new IndoorUnitAccessory(this, existingAccessory);
        } else {
          this.log.info(`Adding device '${device.deviceName}' (${device.deviceGuid})(${uuid}).`);
          // The accessory does not yet exist, so we need to create it
          const accessory = new this.api.platformAccessory<PanasonicAccessoryContext>(
            device.deviceName, uuid);

          // Store a copy of the device object in the `accessory.context` property,
          // which can be used to store any data about the accessory you may need.
          accessory.context.device = device;

          // Create the accessory handler for the newly create accessory
          new IndoorUnitAccessory(this, accessory);

          // Link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      }

      // At this point, we set up all devices from Comfort Cloud, but we did not unregister
      // cached devices that do not exist on the Comfort Cloud account anymore.
      for (const cachedAccessory of this.accessories) {

        if (cachedAccessory.context.device) {
          const guid = cachedAccessory.context.device.deviceGuid;
          const comfortCloudDevice = comfortCloudDevices.find(device => device.deviceGuid === guid);

          if (comfortCloudDevice === undefined) {
            // This cached devices does not exist on the Comfort Cloud account (anymore).

            this.log.info(`Removing device '${cachedAccessory.displayName}' (${guid}) `
              + 'because it does not exist on the Comfort Cloud account or has been excluded in plugin config.');

            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [cachedAccessory]);
          }
        }
      }
    } catch (error) {
      this.log.error('An error occurred during device discovery. '
        + 'Turn on debug mode for more information.');
      this.log.debug(error);
    }
  }
}

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
import ComfortCloudApi from './comfort-cloud';
import PanasonicAirConditionerAccessory from './platformAccessory';
import PanasonicPlatformLogger from './logger';
import { PanasonicAccessoryContext, PanasonicPlatformConfig } from './types';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';

/**
 * Panasonic AC Platform Plugin for Homebridge
 * Based on https://github.com/homebridge/homebridge-plugin-template
 */
export default class PanasonicPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // Used to track restored cached accessories
  private readonly accessories: PlatformAccessory<PanasonicAccessoryContext>[] = [];

  public readonly comfortCloud: ComfortCloudApi;
  public readonly log: PanasonicPlatformLogger;

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
    // Casting because we can't change type in the constructor
    const platformConfig = config as PanasonicPlatformConfig;

    // Initialise logging utility
    this.log = new PanasonicPlatformLogger(homebridgeLogger, platformConfig.debugMode);

    // Create Comfort Cloud communication module
    this.comfortCloud = new ComfortCloudApi(
      platformConfig,
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

      if (!platformConfig.email) {
        this.log.error('Email is not configured - aborting plugin start. ' +
          'Please set the field `email` in your config and restart Homebridge.');
        return;
      }

      if (!platformConfig.password) {
        this.log.error('Password is not configured - aborting plugin start. ' +
          'Please set the field `password` in your config and restart Homebridge.');
        return;
      }

      if (!platformConfig.appVersion) {
        this.log.error('App version is not configured - aborting plugin start. ' +
          'Please set the field `appVersion` in your config and restart Homebridge.');
        return;
      }

      this.log.info('Attempting to log into Comfort Cloud.');
      this.comfortCloud.login()
        .then(() => {
          this.log.info('Successfully logged in. Starting device discovery.');
          this.discoverDevices();
        })
        .catch(() => {
          this.log.error('Login failed. Skipping device discovery.');
        });
    });

    this.log.debug(`Finished initialising platform: ${platformConfig.name}`);
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
    this.log.info('Now discovering devices on Comfort Cloud.');

    try {
      const comfortCloudDevices = await this.comfortCloud.getDevices();

      // Loop over the discovered devices and register each
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
          this.log.info(`Restoring accessory '${existingAccessory.displayName}' ` +
            `(${device.deviceGuid}) from cache.`);

          // If you need to update the accessory.context then you should run
          // `api.updatePlatformAccessories`. eg.:
          existingAccessory.context.device = device;
          this.api.updatePlatformAccessories([existingAccessory]);

          // Create the accessory handler for the restored accessory
          new PanasonicAirConditionerAccessory(this, existingAccessory);
        } else {
          this.log.info(`Adding accessory '${device.deviceName}' (${device.deviceGuid}).`);
          // The accessory does not yet exist, so we need to create it
          const accessory = new this.api.platformAccessory<PanasonicAccessoryContext>(
            device.deviceName, uuid);

          // Store a copy of the device object in the `accessory.context` property,
          // which can be used to store any data about the accessory you may need.
          accessory.context.device = device;

          // Create the accessory handler for the newly create accessory
          // this is imported from `platformAccessory.ts`
          new PanasonicAirConditionerAccessory(this, accessory);

          // Link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      }

      // At this point, we set up all devices from Comfort Cloud, but we did not unregister
      // cached devices that do not exist on the Comfort Cloud account anymore.
      for (const cachedAccessory of this.accessories) {
        const guid = cachedAccessory.context.device.deviceGuid;
        const comfortCloudDevice = comfortCloudDevices.find(device => device.deviceGuid === guid);

        if (comfortCloudDevice === undefined) {
          // This cached devices does not exist on the Comfort Cloud account (anymore).
          this.log.info(`Removing accessory '${cachedAccessory.displayName}' (${guid}) ` +
            'because it does not exist on the Comfort Cloud account (anymore?).');

          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [cachedAccessory]);
        }
      }
    } catch (error) {
      this.log.error('An error occurred during device discovery:');
      this.log.error(error);
    }
  }
}

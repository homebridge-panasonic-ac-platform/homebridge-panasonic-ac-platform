import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import PanasonicPlatform from './platform';
import { ComfortCloudDeviceUpdatePayload, PanasonicAccessoryContext } from './types';

/**
 * An instance of this class is created for each accessory the platform registers.
 * Each accessory may expose multiple services of different service types.
 */
export default class IndoorUnitAccessory {
  private service: Service;
  sendDeviceUpdatePayload: any = {};
  timerRefreshDeviceStatus;
  timerSendDeviceUpdate;
  timerSendDeviceUpdateRefresh;
  timerSetFanSpeed;
  devConfig;
  deviceStatusFull;
  deviceStatus;
  exposeInsideTemp;
  exposeOutdoorTemp;
  exposePower;
  exposeNanoe;
  exposeInsideCleaning;
  exposeEcoNavi;
  exposeEcoFunction;
  exposeAutoMode;
  exposeCoolMode;
  exposeHeatMode;
  exposeDryMode;
  exposeFanMode;
  exposeNanoeStandAloneMode;
  exposeQuietMode;
  exposePowerfulMode;
  exposeSwingUpDown;
  exposeSwingLeftRight;
  exposeFanSpeed;

  constructor(
    private readonly platform: PanasonicPlatform,
    private readonly accessory: PlatformAccessory<PanasonicAccessoryContext>,
  ) {
    // Individual config for each device (if exists).
    if (this.platform.platformConfig.devices) {
      this.devConfig = this.platform.platformConfig.devices.find((item) => item.name === accessory.context.device?.deviceName)
      || this.platform.platformConfig.devices.find((item) => item.name === accessory.context.device?.deviceGuid);
    }

    // Accessory Information
    this.accessory.getService(this.platform.Service.AccessoryInformation)
      ?.setCharacteristic(this.platform.Characteristic.Manufacturer, 'Panasonic')
      .setCharacteristic(this.platform.Characteristic.Model, accessory.context.device?.deviceModuleNumber || 'Unknown')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device?.deviceGuid || 'Unknown');

    // Heater Cooler
    // https://developers.homebridge.io/#/service/HeaterCooler
    this.service = this.accessory.getService(this.platform.Service.HeaterCooler)
      || this.accessory.addService(this.platform.Service.HeaterCooler);

    // Characteristics configuration
    // Each service must implement at-minimum the "required characteristics"
    // See https://developers.homebridge.io/#/service/HeaterCooler

    // Name (optional)
    // This is what is displayed as the default name on the Home app
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.device?.deviceName || 'Unnamed',
    );

    // Active (required)
    this.service
      .getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setActive.bind(this));

    // Current Temperature (required)
    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .setProps({
        minValue: -100,
        maxValue: 100,
        minStep: 0.01,
      });

    // Current Heater-Cooler State (required, but doesn't require a setter)

    // Target Heater-Cooler State (required)
    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .onSet(this.setTargetHeaterCoolerState.bind(this));

    // Rotation Speed (optional)
    this.service
      .getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .setProps({
        minValue: 0,
        maxValue: 8,
        minStep: 1,
      })
      .onSet(this.setRotationSpeed.bind(this));

    // Swing Mode (optional)
    this.service
      .getCharacteristic(this.platform.Characteristic.SwingMode)
      .onSet(this.setSwingMode.bind(this));

    // Cooling Threshold Temperature (optional)
    this.service
      .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .setProps({
        minValue: 16,
        maxValue: 30,
        minStep: 0.5,
      })
      .onSet(this.setThresholdTemperature.bind(this));

    // Heating Threshold Temperature (optional)

    this.service
      .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .setProps({
        minValue: this.devConfig?.minHeatingTemperature || 16,
        maxValue: 30,
        minStep: 0.5,
      })
      .onSet(this.setThresholdTemperature.bind(this));

    // Helper function to manage optional services (setter is optional)
    const manageService = (
      exposeFlag: boolean | undefined,
      serviceName: string,
      serviceType: any, // Replace with proper Homebridge Service type if available
      setter: ((value: any) => Promise<void>) | null = null
    ) => {
      const fullName = `${this.accessory.displayName} ${serviceName}`;
      if (exposeFlag) {
        const service = this.accessory.getService(fullName) || this.accessory.addService(serviceType, fullName, serviceName);
        service.setCharacteristic(this.platform.Characteristic.ConfiguredName, fullName);
        if (setter) service.getCharacteristic(this.platform.Characteristic.On).onSet(setter.bind(this));
        this.platform.log.debug(`${this.accessory.displayName}: add ${serviceName}`);
        return service;
      } else {
        const service = this.accessory.getService(fullName);
        if (service) {
          this.accessory.removeService(service);
          this.platform.log.debug(`${this.accessory.displayName}: remove ${serviceName}`);
        }
      }
    };

    // Additional Sensors and Switches
    manageService(this.devConfig?.exposeInsideTemp, 'inside temp', this.platform.Service.TemperatureSensor);
    manageService(this.devConfig?.exposeOutdoorTemp, 'out temp', this.platform.Service.TemperatureSensor);
    manageService(this.devConfig?.exposePower, 'power', this.platform.Service.Switch, this.setPower);
    manageService(this.devConfig?.exposeNanoe, 'nanoe', this.platform.Service.Switch, this.setNanoe);
    manageService(this.devConfig?.exposeInsideCleaning, 'inside cleaning', this.platform.Service.Switch, this.setInsideCleaning);
    manageService(this.devConfig?.exposeEcoNavi, 'eco navi', this.platform.Service.Switch, this.setEcoNavi);
    manageService(this.devConfig?.exposeEcoFunction, 'eco function', this.platform.Service.Switch, this.setEcoFunction);
    manageService(this.devConfig?.exposeAutoMode, 'auto mode', this.platform.Service.Switch, this.setAutoMode);
    manageService(this.devConfig?.exposeCoolMode, 'cool mode', this.platform.Service.Switch, this.setCoolMode);
    manageService(this.devConfig?.exposeHeatMode, 'heat mode', this.platform.Service.Switch, this.setHeatMode);
    manageService(this.devConfig?.exposeDryMode, 'dry mode', this.platform.Service.Switch, this.setDryMode);
    manageService(this.devConfig?.exposeFanMode, 'fan mode', this.platform.Service.Switch, this.setFanMode);
    
    // Fan Speed (special case with RotationSpeed)
    if (this.devConfig?.exposeFanSpeed) {
      this.exposeFanSpeed = manageService(true, 'fan speed', this.platform.Service.Fan);
      this.exposeFanSpeed.getCharacteristic(this.platform.Characteristic.RotationSpeed).onSet(this.setFanSpeed.bind(this));
    } else {
      manageService(false, 'fan speed');
    }

    // Update characteristic values asynchronously instead of using onGet handlers
    this.refreshDeviceStatus();
  }

  // ===============================================================================================================================================

  /**
   * Retrieves the device status from Comfort Cloud and updates its characteristics.
   */
  async refreshDeviceStatus() {
    let logOutput = '';
    this.platform.log.debug(`${this.accessory.displayName}: refresh status`);

    try {
      this.deviceStatusFull = await this.platform.comfortCloud.getDeviceStatus(
        this.accessory.context.device.deviceGuid, this.accessory.displayName);
      this.deviceStatus = this.deviceStatusFull.parameters;

      // Active
      if (this.deviceStatus.operate !== undefined) {
        const active = this.deviceStatus.operate === 1
          ? this.platform.Characteristic.Active.ACTIVE
          : this.platform.Characteristic.Active.INACTIVE;
        this.service.updateCharacteristic(this.platform.Characteristic.Active, active);
        logOutput += `${(active === 1) ? 'On' : 'Off'}`;
      }

      // Current Temperature
      // If the temperature of the indoor unit is not available,
      // default values will be used: 8°C for heating and 30°C for cooling and else.
      // Temperature of 126 or higher from the API = null/failure

      if (this.deviceStatus.insideTemperature < 126) {
        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentTemperature, this.deviceStatus.insideTemperature);
        logOutput += `, Inside Temp. ${this.deviceStatus.insideTemperature}`;
      } else {
        logOutput += ', Inside Temp. not available';
        this.platform.log.debug(`${this.accessory.displayName}: Inside temperature is not available - setting default temperature`);
        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentTemperature,
          (this.deviceStatus.operationMode === 3) ? 8 : 30,
        );
      }

      // Inside temperature for virtual sensor
      if (this.exposeInsideTemp && this.deviceStatus.insideTemperature < 126) {
        this.exposeInsideTemp.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.deviceStatus.insideTemperature);
      }

      // Outdoor temperature for logs
      if (this.deviceStatus.outTemperature >= 126) {
        logOutput += ', Outdoor Temp. not available';
      } else {
        logOutput += `, Outdoor Temp. ${this.deviceStatus.outTemperature}`;
      }

      // Outdoor temperature for virtual sensor
      // Only check and set if the user wants to display the virtual sensor showing temp from outdoor unit.
      if (this.exposeOutdoorTemp && this.deviceStatus.outTemperature < 126) {
        this.exposeOutdoorTemp.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.deviceStatus.outTemperature);
      }

      // Current Heater-Cooler State and Target Heater-Cooler State
      const currentTemperature = this.service.getCharacteristic(
        this.platform.Characteristic.CurrentTemperature).value as number;
      const setTemperature = this.deviceStatus.temperatureSet;

      switch (this.deviceStatus.operationMode) {
        // Auto
        case 0:
          logOutput += ', Auto Mode';
          // Set target state and current state (based on current temperature)
          this.service.updateCharacteristic(
            this.platform.Characteristic.TargetHeaterCoolerState,
            this.platform.Characteristic.TargetHeaterCoolerState.AUTO,
          );

          if (currentTemperature < setTemperature) {
            this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
              .updateValue(this.platform.Characteristic.CurrentHeaterCoolerState.HEATING);
          } else if (currentTemperature > setTemperature) {
            this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
              .updateValue(this.platform.Characteristic.CurrentHeaterCoolerState.COOLING);
          } else {
            this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
              .updateValue(this.platform.Characteristic.CurrentHeaterCoolerState.IDLE);
          }
          break;

        // Heat
        case 3:
          logOutput += ', Heat Mode';
          this.service.updateCharacteristic(
            this.platform.Characteristic.TargetHeaterCoolerState,
            this.platform.Characteristic.TargetHeaterCoolerState.HEAT,
          );

          if (currentTemperature < setTemperature) {
            this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
              .updateValue(this.platform.Characteristic.CurrentHeaterCoolerState.HEATING);
          } else {
            this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
              .updateValue(this.platform.Characteristic.CurrentHeaterCoolerState.IDLE);
          }
          break;

        // Cool
        case 2:
          logOutput += ', Cool Mode';
          this.service.updateCharacteristic(
            this.platform.Characteristic.TargetHeaterCoolerState,
            this.platform.Characteristic.TargetHeaterCoolerState.COOL,
          );

          if (currentTemperature > setTemperature) {
            this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
              .updateValue(this.platform.Characteristic.CurrentHeaterCoolerState.COOLING);
          } else {
            this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
              .updateValue(this.platform.Characteristic.CurrentHeaterCoolerState.IDLE);
          }
          break;

        // Dry (Dehumidifier)
        case 1:
          logOutput += ', Dry Mode';
          // TODO - improvement: Can we reflect this better/properly in Homebridge?
          // Could add a https://developers.homebridge.io/#/service/HumidifierDehumidifier service
          // to the accessory, but need to check what this implies for the UI.
          this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
            .updateValue(this.platform.Characteristic.CurrentHeaterCoolerState.IDLE);
          this.service.updateCharacteristic(
            this.platform.Characteristic.TargetHeaterCoolerState,
            // TODO - improvement: AUTO isn't a perfect match, but using it for now.
            this.platform.Characteristic.TargetHeaterCoolerState.AUTO,
          );
          break;

        // Fan
        case 4:
          logOutput += ', Fan Mode';
          // TODO - improvement: Same as above, related to:
          // https://developers.homebridge.io/#/service/Fan
          this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
            .updateValue(this.platform.Characteristic.CurrentHeaterCoolerState.IDLE);
          this.service.updateCharacteristic(
            this.platform.Characteristic.TargetHeaterCoolerState,
            // TODO - improvement: AUTO isn't a perfect match, but using it for now.
            this.platform.Characteristic.TargetHeaterCoolerState.AUTO,
          );
          break;

        default:
          this.platform.log.error(
            `Unknown TargetHeaterCoolerState state: '${this.deviceStatus.operationMode}'`);
          break;
      }

      // Rotation Speed
      /**
       * 1) The fanSpeed value in the Comfort Cloud payload doesn't always reflect
       * the current operation mode. For example, when switching from
       * fan speed 4 to Quiet Mode, the fanSpeed in the payload will remain 4.
       * Based on tests, ecoMode seems to take precedence and we'll check it first.
       *
       * 2) HomeKit automatically moves the slider into the 0 position when
       * the device is switched off. We don't have to handle this case manually.
       *
       * 3) See README for the mapping of Comfort Cloud payload to slider position.
       */

      // Check status only when device is on
      if (this.deviceStatus.operate === 1) {
        // Default to AUTO mode
        let sliderValue = 8;

        if (this.deviceStatus.ecoMode === 2) {
          sliderValue = 1;
          logOutput += ', Speed 1 (Quiet Mode)';
        } else if (this.deviceStatus.ecoMode === 1) {
          sliderValue = 7;
          logOutput += ', Speed 5 (Powerful Mode)';
        } else if (this.deviceStatus.ecoMode === 0) {
          switch (this.deviceStatus.fanSpeed) {
            case 1:
              sliderValue = 2;
              logOutput += ', Speed 1';
              break;
            case 2:
              sliderValue = 3;
              logOutput += ', Speed 2';
              break;
            case 3:
              sliderValue = 4;
              logOutput += ', Speed 3';
              break;
            case 4:
              sliderValue = 5;
              logOutput += ', Speed 4';
              break;
            case 5:
              sliderValue = 6;
              logOutput += ', Speed 5';
              break;
            case 0:
              sliderValue = 8;
              logOutput += ', Speed Auto';
              break;
          }
        }
        this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
          .updateValue(sliderValue);
      }

      // Swing Mode
      if (this.deviceStatus.fanAutoMode !== 1) {
        this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
          .updateValue(this.platform.Characteristic.SwingMode.SWING_ENABLED);
      } else {
        this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
          .updateValue(this.platform.Characteristic.SwingMode.SWING_DISABLED);
      }

      // Power (on/off)
      if (this.exposePower) {
        if (this.deviceStatus.operate === 1) {
          this.exposePower.updateCharacteristic(this.platform.Characteristic.On, true);
        } else {
          this.exposePower.updateCharacteristic(this.platform.Characteristic.On, false);
        }
      }

      // Nanoe
      if (this.exposeNanoe) {
        if (this.deviceStatus.nanoe === 2) {
          this.exposeNanoe.updateCharacteristic(this.platform.Characteristic.On, true);
        } else {
          this.exposeNanoe.updateCharacteristic(this.platform.Characteristic.On, false);
        }
      }

      // Inside Cleaning
      if (this.exposeInsideCleaning) {
        if (this.deviceStatus.insideCleaning === 2) {
          this.exposeInsideCleaning.updateCharacteristic(this.platform.Characteristic.On, true);
        } else {
          this.exposeInsideCleaning.updateCharacteristic(this.platform.Characteristic.On, false);
        }
      }

      // Eco Navi
      if (this.exposeEcoNavi) {
        if (this.deviceStatus.ecoNavi === 2) {
          this.exposeEcoNavi.updateCharacteristic(this.platform.Characteristic.On, true);
        } else {
          this.exposeEcoNavi.updateCharacteristic(this.platform.Characteristic.On, false);
        }
      }

      // Eco Function
      if (this.exposeEcoFunction) {
        if (this.deviceStatus.ecoFunctionData === 2) {
          this.exposeEcoFunction.updateCharacteristic(this.platform.Characteristic.On, true);
        } else {
          this.exposeEcoFunction.updateCharacteristic(this.platform.Characteristic.On, false);
        }
      }

      // Auto Mode
      if (this.exposeAutoMode) {
        if (this.deviceStatus.operate === 1 && this.deviceStatus.operationMode === 0) {
          this.exposeAutoMode.updateCharacteristic(this.platform.Characteristic.On, true);
        } else {
          this.exposeAutoMode.updateCharacteristic(this.platform.Characteristic.On, false);
        }
      }

      // Cool Mode
      if (this.exposeCoolMode) {
        if (this.deviceStatus.operate === 1 && this.deviceStatus.operationMode === 2) {
          this.exposeCoolMode.updateCharacteristic(this.platform.Characteristic.On, true);
        } else {
          this.exposeCoolMode.updateCharacteristic(this.platform.Characteristic.On, false);
        }
      }

      // Heat Mode
      if (this.exposeHeatMode) {
        if (this.deviceStatus.operate === 1 && this.deviceStatus.operationMode === 3) {
          this.exposeHeatMode.updateCharacteristic(this.platform.Characteristic.On, true);
        } else {
          this.exposeHeatMode.updateCharacteristic(this.platform.Characteristic.On, false);
        }
      }

      // Dry Mode
      if (this.exposeDryMode) {
        if (this.deviceStatus.operate === 1 && this.deviceStatus.operationMode === 1) {
          this.exposeDryMode.updateCharacteristic(this.platform.Characteristic.On, true);
        } else {
          this.exposeDryMode.updateCharacteristic(this.platform.Characteristic.On, false);
        }
      }

      // Fan Mode
      if (this.exposeFanMode) {
        if (this.deviceStatus.operate === 1 && this.deviceStatus.operationMode === 4 && this.deviceStatus.lastSettingMode === 1) {
          this.exposeFanMode.updateCharacteristic(this.platform.Characteristic.On, true);
        } else {
          this.exposeFanMode.updateCharacteristic(this.platform.Characteristic.On, false);
        }
      }

      // Nanoe Stand Alone Mode
      if (this.exposeNanoeStandAloneMode) {
        if (this.deviceStatus.operate === 1 && this.deviceStatus.operationMode === 4 && this.deviceStatus.lastSettingMode === 2) {
          this.exposeNanoeStandAloneMode.updateCharacteristic(this.platform.Characteristic.On, true);
        } else {
          this.exposeNanoeStandAloneMode.updateCharacteristic(this.platform.Characteristic.On, false);
        }
      }

      // Quiet Mode (speed)
      // Check status only when device is on
      if (this.exposeQuietMode && this.deviceStatus.operate === 1) {
        if (this.deviceStatus.ecoMode === 2) {
          this.exposeQuietMode.updateCharacteristic(this.platform.Characteristic.On, true);
        } else {
          this.exposeQuietMode.updateCharacteristic(this.platform.Characteristic.On, false);
        }
      }

      // Powerful Mode (speed)
      // Check status only when device is on
      if (this.exposePowerfulMode && this.deviceStatus.operate === 1) {
        if (this.deviceStatus.ecoMode === 1) {
          this.exposePowerfulMode.updateCharacteristic(this.platform.Characteristic.On, true);
        } else {
          this.exposePowerfulMode.updateCharacteristic(this.platform.Characteristic.On, false);
        }
      }

      // Swing Up Down
      if (this.exposeSwingUpDown) {
        if (this.deviceStatus.fanAutoMode === 0 || this.deviceStatus.fanAutoMode === 2 ) {
          this.exposeSwingUpDown.updateCharacteristic(this.platform.Characteristic.On, true);
        } else {
          this.exposeSwingUpDown.updateCharacteristic(this.platform.Characteristic.On, false);
        }
      }

      // Swing Left Right
      if (this.exposeSwingLeftRight) {
        if (this.deviceStatus.fanAutoMode === 0 || this.deviceStatus.fanAutoMode === 3 ) {
          this.exposeSwingLeftRight.updateCharacteristic(this.platform.Characteristic.On, true);
        } else {
          this.exposeSwingLeftRight.updateCharacteristic(this.platform.Characteristic.On, false);
        }
      }

      // Fan speed
      // Check status only when device is on
      if (this.exposeFanSpeed) {
        if (this.deviceStatus.operate === 1) {
          if (this.deviceStatus.fanSpeed === 1) {
            this.exposeFanSpeed.updateCharacteristic(this.platform.Characteristic.On, true);
            this.exposeFanSpeed.updateCharacteristic(this.platform.Characteristic.RotationSpeed, 10);
          } else if (this.deviceStatus.fanSpeed === 2) {
            this.exposeFanSpeed.updateCharacteristic(this.platform.Characteristic.On, true);
            this.exposeFanSpeed.updateCharacteristic(this.platform.Characteristic.RotationSpeed, 30);
          } else if (this.deviceStatus.fanSpeed === 3) {
            this.exposeFanSpeed.updateCharacteristic(this.platform.Characteristic.On, true);
            this.exposeFanSpeed.updateCharacteristic(this.platform.Characteristic.RotationSpeed, 50);
          } else if (this.deviceStatus.fanSpeed === 4) {
            this.exposeFanSpeed.updateCharacteristic(this.platform.Characteristic.On, true);
            this.exposeFanSpeed.updateCharacteristic(this.platform.Characteristic.RotationSpeed, 70);
          } else if (this.deviceStatus.fanSpeed === 5) {
            this.exposeFanSpeed.updateCharacteristic(this.platform.Characteristic.On, true);
            this.exposeFanSpeed.updateCharacteristic(this.platform.Characteristic.RotationSpeed, 90);
          } else {
            // Auto mode
            this.exposeFanSpeed.updateCharacteristic(this.platform.Characteristic.On, true);
            this.exposeFanSpeed.updateCharacteristic(this.platform.Characteristic.RotationSpeed, 100);
          }
        } else {
          this.exposeFanSpeed.updateCharacteristic(this.platform.Characteristic.On, false);
          this.exposeFanSpeed.updateCharacteristic(this.platform.Characteristic.RotationSpeed, 0);
        }
      }

      // Cooling Threshold Temperature (optional)
      // Heating Threshold Temperature (optional)
      this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
        .updateValue(setTemperature);
      this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
        .updateValue(setTemperature);

      // log
      if (this.platform.platformConfig.logsLevel >= 1) {
        this.platform.log.info(`${this.accessory.displayName}: ${logOutput}.`);
      }
    } catch (error) {
      this.platform.log.error('An error occurred while refreshing the device status. '
        + 'Turn on debug mode for more information.');

      // Only log if a Promise rejection reason was provided.
      // Some errors are already logged at source.
      if (error) {
        this.platform.log.debug(error);
      }

      // if you need to return an error to show the device as "Not Responding" in the Home app:
      // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

      /**
       * We should be able to pass an error object to the function to mark a service/accessory
       * as 'Not Responding' in the Home App.
       * (Only needs to be set on a single/primary characteristic of an accessory,
       * and needs to be updated with a valid value when the accessory is available again.
       * The error message text is for internal use only, and is not passed to the Home App.)
       *
       * Problem: The Typescript definitions suggest this is not permitted -  commenting for now.
       */
      /*
      this.service.updateCharacteristic(
        this.platform.Characteristic.Active,
        new Error('Exception occurred in refreshDeviceStatus()'),
      );
      */
    }

    // Schedule continuous device updates on the first run
    // 10 minutes when device is on, 60 minutes device is off
    clearTimeout(this.timerRefreshDeviceStatus);
    this.timerRefreshDeviceStatus = null;
    this.timerRefreshDeviceStatus = setTimeout(
      this.refreshDeviceStatus.bind(this),
      (this.service.getCharacteristic(this.platform.Characteristic.Active).value === 1) ? 10 * 60 * 1000 : 60 * 60 * 1000);
  }

  // ===============================================================================================================================================

  /**
   * Handle 'SET' requests from HomeKit
   * These are sent when the user changes the state of an accessory,
   * for example, turning on a Light bulb.
   */
  async setActive(value: CharacteristicValue) {

    this.platform.log.debug(`${this.accessory.displayName}: setActive()`);
    const parameters: ComfortCloudDeviceUpdatePayload = {
      operate: value === this.platform.Characteristic.Active.ACTIVE ? 1 : 0,
    };
    this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](
      `${this.accessory.displayName}: ${value === this.platform.Characteristic.Active.ACTIVE ? 'set On' : 'set Off'}`);

    this.sendDeviceUpdate(
      this.accessory.context.device.deviceGuid, parameters);
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue) {
    this.platform.log.debug(`${this.accessory.displayName}: setTargetHeaterCoolerState()`);
    const parameters: ComfortCloudDeviceUpdatePayload = {
      operate: 1,
    };
    switch (value) {
      case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
        if (this.platform.platformConfig.autoMode === 'fan') {
          parameters.operationMode = 4;
          this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Fan Mode`);
        } else if (this.platform.platformConfig.autoMode === 'dry') {
          parameters.operationMode = 1;
          this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Dry mode`);
        } else {
          parameters.operationMode = 0;
          this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Auto mode`);
        }
        break;

      case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
        parameters.operationMode = 2;
        this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Mode Cool`);
        break;

      case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
        parameters.operationMode = 3;
        this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Mode Heat`);
        break;

      default:
        this.platform.log.error(`${this.accessory.displayName}: Unknown TargetHeaterCoolerState`, value);
        return;
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  async setRotationSpeed(value: CharacteristicValue) {
    this.platform.log.debug(`${this.accessory.displayName}: setRotationSpeed()`);
    const parameters: ComfortCloudDeviceUpdatePayload = {};
    switch (value) {
      // See README for the mapping of slider position to Comfort Cloud payload.
      case 0:
        // HomeKit independently switches off the accessory
        // in this case, which triggers setActive().
        // Nothing to handle here, but documenting for clarity.
        break;
      case 1:
        parameters.ecoMode = 2;
        this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Quiet Mode`);
        break;
      case 2:
        parameters.ecoMode = 0;
        parameters.fanSpeed = 1;
        this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Fan speed 1`);
        break;
      case 3:
        parameters.ecoMode = 0;
        parameters.fanSpeed = 2;
        this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Fan speed 2`);
        break;
      case 4:
        parameters.ecoMode = 0;
        parameters.fanSpeed = 3;
        this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Fan speed 3`);
        break;
      case 5:
        parameters.ecoMode = 0;
        parameters.fanSpeed = 4;
        this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Fan speed 4`);
        break;
      case 6:
        parameters.ecoMode = 0;
        parameters.fanSpeed = 5;
        this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Fan speed 5`);
        break;
      case 7:
        parameters.ecoMode = 1;
        this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Powerful Mode`);
        break;
      case 8:
        parameters.ecoMode = 0;
        parameters.fanSpeed = 0;
        this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Auto Mode`);
        break;
      default:
        parameters.ecoMode = 0;
        parameters.fanSpeed = 0;
        this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Auto Mode`);
        break;
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  async setSwingMode(value: CharacteristicValue) {

    this.platform.log.debug(`${this.accessory.displayName}: setSwingMode()`);

    const parameters: ComfortCloudDeviceUpdatePayload = {};

    if (value === this.platform.Characteristic.SwingMode.SWING_ENABLED) {
      parameters.fanAutoMode = 0;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Swing mode Auto`);
    } else if (value === this.platform.Characteristic.SwingMode.SWING_DISABLED) {
      parameters.fanAutoMode = 1;
      parameters.airSwingUD = (this.devConfig?.swingDefaultUD !== null) ? this.devConfig?.swingDefaultUD : 2;
      parameters.airSwingLR = (this.devConfig?.swingDefaultLR !== null) ? this.devConfig?.swingDefaultLR : 2;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Swing mode Off`);
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  // set Power (on/off)
  async setPower(value) {
    this.platform.log.debug(`${this.accessory.displayName}: setSPower()`);
    const parameters: ComfortCloudDeviceUpdatePayload = {};
    if (value) {
      parameters.operate = 1;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Nanoe On`);
    } else {
      parameters.operate = 0;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Nanoe Off`);
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  // set Nanoe
  async setNanoe(value) {
    this.platform.log.debug(`${this.accessory.displayName}: setNanoe()`);
    const parameters: ComfortCloudDeviceUpdatePayload = {};
    if (value) {
      parameters.nanoe = 2;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Nanoe On`);
    } else {
      parameters.nanoe = 1;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Nanoe Off`);
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  // set Inside Cleaning
  async setInsideCleaning(value) {
    this.platform.log.debug(`${this.accessory.displayName}: setInsideCleaning()`);
    const parameters: ComfortCloudDeviceUpdatePayload = {};
    if (value) {
      parameters.insideCleaning = 2;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Inside Cleaning On`);
    } else {
      parameters.insideCleaning = 1;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Inside Cleaning Off`);
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  // set Eco Navi
  async setEcoNavi(value) {
    this.platform.log.debug(`${this.accessory.displayName}: setEcoNavi()`);
    const parameters: ComfortCloudDeviceUpdatePayload = {};
    if (value) {
      parameters.ecoNavi = 2;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Eco Navi On`);
    } else {
      parameters.ecoNavi = 1;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Eco Navi Off`);
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  // set Eco Function
  async setEcoFunction(value) {
    this.platform.log.debug(`${this.accessory.displayName}: setEcoFunction()`);
    const parameters: ComfortCloudDeviceUpdatePayload = {};
    if (value) {
      parameters.ecoFunctionData = 2;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Eco Function On`);
    } else {
      parameters.ecoFunctionData = 1;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Eco Function Off`);
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  // set Auto Mode
  async setAutoMode(value) {
    this.platform.log.debug(`${this.accessory.displayName}: setAutoMode()`);
    const parameters: ComfortCloudDeviceUpdatePayload = {};
    if (value) {
      parameters.operate = 1;
      parameters.operationMode = 0;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Auto Mode On`);
    } else {
      parameters.operate = 0;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Auto Mode Off`);
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  // set Cool Mode
  async setCoolMode(value) {
    this.platform.log.debug(`${this.accessory.displayName}: setCoolMode()`);
    const parameters: ComfortCloudDeviceUpdatePayload = {};
    if (value) {
      parameters.operate = 1;
      parameters.operationMode = 2;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Cool Mode On`);
    } else {
      parameters.operate = 0;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Cool Mode Off`);
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  // set Heat Mode
  async setHeatMode(value) {
    this.platform.log.debug(`${this.accessory.displayName}: setHeatMode()`);
    const parameters: ComfortCloudDeviceUpdatePayload = {};
    if (value) {
      parameters.operate = 1;
      parameters.operationMode = 3;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Heat Mode On`);
    } else {
      parameters.operate = 0;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Heat Mode Off`);
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  // set Dry Mode
  async setDryMode(value) {
    this.platform.log.debug(`${this.accessory.displayName}: setDryMode()`);
    const parameters: ComfortCloudDeviceUpdatePayload = {};
    if (value) {
      parameters.operate = 1;
      parameters.operationMode = 1;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Dry Mode On`);
    } else {
      parameters.operate = 0;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Dry Mode Off`);
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  // set Fan Mode
  async setFanMode(value) {
    this.platform.log.debug(`${this.accessory.displayName}: setFanMode()`);
    const parameters: ComfortCloudDeviceUpdatePayload = {};
    if (value) {
      parameters.operate = 1;
      parameters.operationMode = 4;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Fan Mode On`);
    } else {
      parameters.operate = 0;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Fan Mode Off`);
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  // set Nanoe Stand Alone Mode
  async setNanoeStandAloneMode(value) {
    this.platform.log.debug(`${this.accessory.displayName}: setNanoeStandAloneMode()`);
    const parameters: ComfortCloudDeviceUpdatePayload = {};
    if (value) {
      parameters.operate = 1;
      parameters.operationMode = 5;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Nanoe Stand Alone Mode On`);
    } else {
      parameters.operate = 0;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Nanoe Stand Alone Mode Off`);
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  // set Quiet Mode
  async setQuietMode(value) {
    this.platform.log.debug(`${this.accessory.displayName}: setQuietMode()`);
    const parameters: ComfortCloudDeviceUpdatePayload = {};
    if (value) {
      parameters.ecoMode = 2;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Quiet Mode On`);
    } else {
      parameters.ecoMode = 0;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Quiet Mode Off`);
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  // set Powerful Mode
  async setPowerfulMode(value) {
    this.platform.log.debug(`${this.accessory.displayName}: setPowerfulMode()`);
    const parameters: ComfortCloudDeviceUpdatePayload = {};
    if (value) {
      parameters.ecoMode = 1;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Powerful Mode On`);
    } else {
      parameters.ecoMode = 0;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Powerful Mode Off`);
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  // set Swing Up Down
  async setSwingUpDown(value) {
    this.platform.log.debug(`${this.accessory.displayName}: setSwingUpDown()`);
    const parameters: ComfortCloudDeviceUpdatePayload = {};
    if (value) {
      // if Swing Left Right is enabled than set Swing Auto (Up Down and Left Right)
      if (this.deviceStatus.fanAutoMode === 3) {
        parameters.fanAutoMode = 0;
      } else {
        parameters.fanAutoMode = 2;
      }
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Swing Up Down On`);
    } else {
      if (this.deviceStatus.fanAutoMode === 0) {
        parameters.fanAutoMode = 3;
      } else {
        parameters.fanAutoMode = 1;
      }
      parameters.airSwingUD = (this.devConfig?.swingDefaultUD !== null) ? this.devConfig?.swingDefaultUD : 2;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Swing Up Down Off`);
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  // set Swing Left Right
  async setSwingLeftRight(value) {
    this.platform.log.debug(`${this.accessory.displayName}: setSwingLeftRight()`);
    const parameters: ComfortCloudDeviceUpdatePayload = {};
    if (value) {
      // if Swing Up Down is enabled than set Swing Auto (Up Down and Left Right)
      if (this.deviceStatus.fanAutoMode === 2) {
        parameters.fanAutoMode = 0;
      } else {
        parameters.fanAutoMode = 3;
      }
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Swing Left Right On`);
    } else {
      if (this.deviceStatus.fanAutoMode === 0) {
        parameters.fanAutoMode = 2;
      } else {
        parameters.fanAutoMode = 1;
      }
      parameters.airSwingLR = (this.devConfig?.swingDefaultLR !== null) ? this.devConfig?.swingDefaultLR : 2;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Swing Left Right Off`);
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  // set Fan speed
  async setFanSpeed(value) {

    // set Fan speed
    if (value >= 0 && value <= 100) {

      this.platform.log.debug(`${this.accessory.displayName}: setFanSpeed(), value: ${value}`);

      const parameters: ComfortCloudDeviceUpdatePayload = {};

      if (value === 0) {
        // Turn off
        parameters.operate = 0;
        this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: set off`);
      } else if (value > 0 && value <= 20) {
        parameters.ecoMode = 0;
        parameters.fanSpeed = 1;
        this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: set fan speed 1`);
      } else if (value > 20 && value <= 40) {
        parameters.ecoMode = 0;
        parameters.fanSpeed = 2;
        this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: set fan speed 2`);
      } else if (value > 40 && value <= 60) {
        parameters.ecoMode = 0;
        parameters.fanSpeed = 3;
        this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: set fan speed 3`);
      } else if (value > 60 && value <= 80) {
        parameters.ecoMode = 0;
        parameters.fanSpeed = 4;
        this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: set fan speed 4`);
      } else if (value > 80 && value < 100) {
        parameters.ecoMode = 0;
        parameters.fanSpeed = 5;
        this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: set fan speed 5`);
      } else if (value === 100) {
        // Auto mode
        parameters.ecoMode = 0;
        parameters.fanSpeed = 0;
        this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: set fan speed auto`);
      }

      this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
    }
  }

  // ===============================================================================================================================================

  async setThresholdTemperature(value: CharacteristicValue) {
    /**
     * This function is used for Cooling AND Heating Threshold Temperature,
     * which is fine in HEAT and COOL mode. But in AUTO mode, it results in a conflict
     * because HomeKit allows setting a lower and an upper temperature but the remote control
     * and Comfort Cloud app only set the target temperature.
     *
     * Option 1: Don't map the AUTO setting in HomeKit to AUTO on ComfortCloud (CC),
     * but switch to COOL or HEAT on CC depending on the current room temperature.
     * In that case, we could process the heating and cooling threshold accordingly.
     * Caveat: HomeKit set to AUTO would show up as HEAT or COOL in the CC app, i.e.
     * we would produce an inconsistent state across control interfaces.
     *
     * Option 2: Map AUTO in HomeKit to AUTO on CC and set the temperature which was set last
     * as target temperature. The user would have to drag both sliders close to each other
     * and treat it as one bar.
     * Caveat: We cannot replace a range slider in HomeKit by a single value. Any user
     * who doesn't read this note might be confused about this.
     *
     * Current choice is option 2 because the only implication for the user is wrongly set
     * temperature in the worst case. Option 1 would offer full functionality, but decrease
     * the compatibility with the Comfort Cloud app.
    */
    this.platform.log.debug(
      `Accessory: setThresholdTemperature() for device '${this.accessory.displayName}'`);
    const parameters: ComfortCloudDeviceUpdatePayload = {
      temperatureSet: value as number,
    };
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  async sendDeviceUpdate(guid: string, payload: ComfortCloudDeviceUpdatePayload = {}) {
    try {
      // HomeKit sends commands when a move starts, not when it ends, so there can be several commands during one move.
      // Users often send several commands at once, e.g. in automation.
      // Collect together all parameters sent in a specified time, so as not to send each parameters separately.
      this.sendDeviceUpdatePayload = Object.assign(this.sendDeviceUpdatePayload, payload);

      clearTimeout(this.timerSendDeviceUpdate);
      this.timerSendDeviceUpdate = null;

      // Only send non-empty payloads to prevent a '500 Internal Server Error'
      if (Object.keys(this.sendDeviceUpdatePayload).length > 0) {

        this.timerSendDeviceUpdate = setTimeout(() => {

          // Workaround - API not storing fanSpeed and ecoMode.
          // Apply only when device is turned off and it is turning on
          // and there is no command to set fanSpeed or ecoMode.
          if (this.deviceStatus.operate === 0
              && this.sendDeviceUpdatePayload.operate === 1
              && !Object.prototype.hasOwnProperty.call(this.sendDeviceUpdatePayload, 'fanSpeed')
              && !Object.prototype.hasOwnProperty.call(this.sendDeviceUpdatePayload, 'ecoMode')) {

            const parameters: any = {};
            switch (this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed).value) {
              case 1:
                parameters.ecoMode = 2;
                break;
              case 2:
                parameters.fanSpeed = 1;
                break;
              case 3:
                parameters.fanSpeed = 2;
                break;
              case 4:
                parameters.fanSpeed = 3;
                break;
              case 5:
                parameters.fanSpeed = 4;
                break;
              case 6:
                parameters.fanSpeed = 5;
                break;
              case 7:
                parameters.ecoMode = 1;
                break;
              default:
                parameters.ecoMode = 0;
                parameters.fanSpeed = 0;
                break;
            }
            this.platform.log.debug(`${this.accessory.displayName}: Applying workaround fix for speed and eco mode, `
                                    + `adding parameters ${JSON.stringify(parameters)} to ${JSON.stringify(this.sendDeviceUpdatePayload)}.`);
            this.sendDeviceUpdatePayload = Object.assign(this.sendDeviceUpdatePayload, parameters);
          }

          // Send update
          this.platform.log.debug(`${this.accessory.displayName}: sendDeviceUpdatePayload: ${JSON.stringify(this.sendDeviceUpdatePayload)}`);
          this.platform.comfortCloud.setDeviceStatus(guid, this.accessory.displayName, this.sendDeviceUpdatePayload);

          // Reset payload
          this.sendDeviceUpdatePayload = {};

          // Refresh device status
          clearTimeout(this.timerSendDeviceUpdateRefresh);
          this.timerSendDeviceUpdateRefresh = null;
          this.timerSendDeviceUpdateRefresh = setTimeout(this.refreshDeviceStatus.bind(this), 7500);

        }, 2500);
      }

    } catch (error) {
      this.platform.log.error('An error occurred while sending a device update. '
        + 'Turn on debug mode for more information.');

      // Only log if a Promise rejection reason was provided.
      // Some errors are already logged at source.
      if (error) {
        this.platform.log.debug(error);
      }
    }
  }
}

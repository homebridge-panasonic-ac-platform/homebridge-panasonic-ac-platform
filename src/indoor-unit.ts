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
  deviceConfig;
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
      this.deviceConfig = this.platform.platformConfig.devices.find((item) => item.name === accessory.context.device?.deviceName)
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
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device?.deviceName || 'Unnamed');

    // Active (required)
    this.service.getCharacteristic(this.platform.Characteristic.Active).onSet(this.setActive.bind(this));

    // Current Temperature (required)
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .setProps({minValue: -100, maxValue: 100, minStep: 0.01});

    // Target Heater-Cooler State (required)
    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .onSet(this.setTargetHeaterCoolerState.bind(this));

    // Rotation Speed (optional)
    this.service
      .getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .setProps({minValue: 0, maxValue: 8, minStep: 1})
      .onSet(this.setRotationSpeed.bind(this));

    // Swing Mode (optional)
    this.service
      .getCharacteristic(this.platform.Characteristic.SwingMode)
      .onSet(this.setSwingMode.bind(this));

    // Cooling Threshold Temperature (optional)
    this.service
      .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .setProps({minValue: 16, maxValue: 30, minStep: 0.5})
      .onSet(this.setThresholdTemperature.bind(this));

    // Heating Threshold Temperature (optional)
    this.service
      .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .setProps({minValue: this.deviceConfig?.minHeatingTemperature || 16, maxValue: 30, minStep: 0.5})
      .onSet(this.setThresholdTemperature.bind(this));

    // Additional sensors and switches

    // Inside temp.
    if (this.deviceConfig?.exposeInsideTemp) {
      this.exposeInsideTemp = this.accessory.getService(this.accessory.displayName + ' (inside temp)')
        || this.accessory.addService(this.platform.Service.TemperatureSensor, this.accessory.displayName + ' (inside temp)', 'exposeInsideTemp');
      this.exposeInsideTemp.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName + ' (inside temp)');
      this.platform.log.debug(`${this.accessory.displayName}: add inside temp sensor`);
    } else {
      const removeInsideTemp = this.accessory.getService(this.accessory.displayName + ' (inside temp)');
      if (removeInsideTemp) {
        this.accessory.removeService(removeInsideTemp);
        this.platform.log.debug(`${this.accessory.displayName}: remove inside temp sensor`);
      }
    }

    // Outdoor temp.
    if (this.deviceConfig?.exposeOutdoorTemp) {
      this.exposeOutdoorTemp = this.accessory.getService(this.accessory.displayName + ' (out temp)')
        || this.accessory.addService(this.platform.Service.TemperatureSensor, this.accessory.displayName + ' (out temp)', 'exposeOutdoorTemp');
      this.exposeOutdoorTemp.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName + ' (out temp)');
      this.platform.log.debug(`${this.accessory.displayName}: add outdoor temp sensor`);
    } else {
      const removeOutdoorTemp = this.accessory.getService(this.accessory.displayName + ' (out temp)');
      if (removeOutdoorTemp) {
        this.accessory.removeService(removeOutdoorTemp);
        this.platform.log.debug(`${this.accessory.displayName}: remove outdoor temp sensor`);
      }
    }

    // Power (on/off)
    if (this.deviceConfig?.exposePower) {
      this.exposePower = this.accessory.getService(this.accessory.displayName + ' (power)')
        || this.accessory.addService(this.platform.Service.Switch, this.accessory.displayName + ' (power)', 'exposePower');
      this.exposePower.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName + ' (power)');
      this.exposePower
        .getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setPower.bind(this));
      this.platform.log.debug(`${this.accessory.displayName}: add power (on/off) switch`);
    } else {
      const removePower = this.accessory.getService(this.accessory.displayName + ' (power)');
      if (removePower) {
        this.accessory.removeService(removePower);
        this.platform.log.debug(`${this.accessory.displayName}: remove power (on/off) switch`);
      }
    }

    // Nanoe
    if (this.deviceConfig?.exposeNanoe) {
      this.exposeNanoe = this.accessory.getService(this.accessory.displayName + ' (nanoe)')
        || this.accessory.addService(this.platform.Service.Switch, this.accessory.displayName + ' (nanoe)', 'exposeNanoe');
      this.exposeNanoe.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName + ' (nanoe)');
      this.exposeNanoe
        .getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setNanoe.bind(this));
      this.platform.log.debug(`${this.accessory.displayName}: add nanoe switch`);
    } else {
      const removeNanoe = this.accessory.getService(this.accessory.displayName + ' (nanoe)');
      if (removeNanoe) {
        this.accessory.removeService(removeNanoe);
        this.platform.log.debug(`${this.accessory.displayName}: remove nanoe switch`);
      }
    }

    // Inside cleaning
    if (this.deviceStatusFull?.insideCleaning && this.deviceConfig?.exposeInsideCleaning) {
      this.exposeInsideCleaning = this.accessory.getService(this.accessory.displayName + ' (inside cleaning)')
        || this.accessory.addService(this.platform.Service.Switch, this.accessory.displayName + ' (inside cleaning)', 'exposeInsideCleaning');
      this.exposeInsideCleaning.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName + ' (inside cleaning)');
      this.exposeInsideCleaning
        .getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setInsideCleaning.bind(this));
      this.platform.log.debug(`${this.accessory.displayName}: add inside cleaning switch`);
    } else {
      const removeInsideCleaning = this.accessory.getService(this.accessory.displayName + ' (inside cleaning)');
      if (removeInsideCleaning) {
        this.accessory.removeService(removeInsideCleaning);
        this.platform.log.debug(`${this.accessory.displayName}: remove inside cleaning switch`);
      }
    }

    // Eco Navi
    if (this.deviceConfig?.exposeEcoNavi) {
      this.exposeEcoNavi = this.accessory.getService(this.accessory.displayName + ' (eco navi)')
        || this.accessory.addService(this.platform.Service.Switch, this.accessory.displayName + ' (eco navi)', 'exposeEcoNavi');
      this.exposeEcoNavi.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName + ' (eco navi)');
      this.exposeEcoNavi
        .getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setEcoNavi.bind(this));
      this.platform.log.debug(`${this.accessory.displayName}: add eco navi switch`);
    } else {
      const removeEcoNavi = this.accessory.getService(this.accessory.displayName + ' (eco navi)');
      if (removeEcoNavi) {
        this.accessory.removeService(removeEcoNavi);
        this.platform.log.debug(`${this.accessory.displayName}: remove eco navi switch`);
      }
    }

    // Eco Function
    if (this.deviceConfig?.exposeEcoFunction) {
      this.exposeEcoFunction = this.accessory.getService(this.accessory.displayName + ' (eco function)')
        || this.accessory.addService(this.platform.Service.Switch, this.accessory.displayName + ' (eco function)', 'exposeEcoFunction');
      this.exposeEcoFunction.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName + ' (eco function)');
      this.exposeEcoFunction
        .getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setEcoFunction.bind(this));
      this.platform.log.debug(`${this.accessory.displayName}: add eco function switch`);
    } else {
      const removeEcoFunction = this.accessory.getService(this.accessory.displayName + ' (eco function)');
      if (removeEcoFunction) {
        this.accessory.removeService(removeEcoFunction);
        this.platform.log.debug(`${this.accessory.displayName}: remove eco function switch`);
      }
    }

    // Cool mode
    if (this.deviceConfig?.exposeCoolMode) {
      this.exposeCoolMode = this.accessory.getService(this.accessory.displayName + ' (cool mode)')
        || this.accessory.addService(this.platform.Service.Switch, this.accessory.displayName + ' (cool mode)', 'exposeCoolMode');
      this.exposeCoolMode.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName + ' (cool mode)');
      this.exposeCoolMode
        .getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setCoolMode.bind(this));
      this.platform.log.debug(`${this.accessory.displayName}: add cool mode switch`);
    } else {
      const removeCoolMode = this.accessory.getService(this.accessory.displayName + ' (cool mode)');
      if (removeCoolMode) {
        this.accessory.removeService(removeCoolMode);
        this.platform.log.debug(`${this.accessory.displayName}: remove cool mode switch`);
      }
    }

    // Heat mode
    if (this.deviceConfig?.exposeHeatMode) {
      this.exposeHeatMode = this.accessory.getService(this.accessory.displayName + ' (heat mode)')
        || this.accessory.addService(this.platform.Service.Switch, this.accessory.displayName + ' (heat mode)', 'exposeHeatMode');
      this.exposeHeatMode.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName + ' (heat mode)');
      this.exposeHeatMode
        .getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setHeatMode.bind(this));
      this.platform.log.debug(`${this.accessory.displayName}: add heat mode switch`);
    } else {
      const removeHeatMode = this.accessory.getService(this.accessory.displayName + ' (heat mode)');
      if (removeHeatMode) {
        this.accessory.removeService(removeHeatMode);
        this.platform.log.debug(`${this.accessory.displayName}: remove heat mode switch`);
      }
    }

    // Dry mode
    if (this.deviceConfig?.exposeDryMode) {
      this.exposeDryMode = this.accessory.getService(this.accessory.displayName + ' (dry mode)')
        || this.accessory.addService(this.platform.Service.Switch, this.accessory.displayName + ' (dry mode)', 'exposeDryMode');
      this.exposeDryMode.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName + ' (dry mode)');
      this.exposeDryMode
        .getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setDryMode.bind(this));
      this.platform.log.debug(`${this.accessory.displayName}: add dry mode switch`);
    } else {
      const removeDryMode = this.accessory.getService(this.accessory.displayName + ' (dry mode)');
      if (removeDryMode) {
        this.accessory.removeService(removeDryMode);
        this.platform.log.debug(`${this.accessory.displayName}: remove dry mode switch`);
      }
    }

    // Fan Mode
    if (this.deviceConfig?.exposeFanMode) {
      this.exposeFanMode = this.accessory.getService(this.accessory.displayName + ' (fan mode)')
        || this.accessory.addService(this.platform.Service.Switch, this.accessory.displayName + ' (fan mode)', 'exposeFanMode');
      this.exposeFanMode.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName + ' (fan mode)');
      this.exposeFanMode
        .getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setFanMode.bind(this));
      this.platform.log.debug(`${this.accessory.displayName}: add fan mode switch`);
    } else {
      const removeFanMode = this.accessory.getService(this.accessory.displayName + ' (fan mode)');
      if (removeFanMode) {
        this.accessory.removeService(removeFanMode);
        this.platform.log.debug(`${this.accessory.displayName}: remove fan mode switch`);
      }
    }

    // Nanoe Stand Alone Mode
    if (this.deviceConfig?.exposeNanoeStandAloneMode) {
      this.exposeNanoeStandAloneMode = this.accessory.getService(this.accessory.displayName + ' (nanoe stand alone mode)')
        || this.accessory.addService(this.platform.Service.Switch, this.accessory.displayName + ' (nanoe stand alone mode)', 'exposeNanoeStandAloneMode');
      this.exposeNanoeStandAloneMode.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName + ' (nanoe stand alone mode)');
      this.exposeNanoeStandAloneMode
        .getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setNanoeStandAloneMode.bind(this));
      this.platform.log.debug(`${this.accessory.displayName}: add nanoe stand alone mode switch`);
    } else {
      const removeNanoeStandAloneMode = this.accessory.getService(this.accessory.displayName + ' (nanoe stand alone mode)');
      if (removeNanoeStandAloneMode) {
        this.accessory.removeService(removeNanoeStandAloneMode);
        this.platform.log.debug(`${this.accessory.displayName}: remove nanoe stand alone mode switch`);
      }
    }

    // Quiet Mode
    if (this.deviceConfig?.exposeQuietMode) {
      this.exposeQuietMode = this.accessory.getService(this.accessory.displayName + ' (quiet mode)')
        || this.accessory.addService(this.platform.Service.Switch, this.accessory.displayName + ' (quiet mode)', 'exposeQuietMode');
      this.exposeQuietMode.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName + ' (quiet mode)');
      this.exposeQuietMode
        .getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setQuietMode.bind(this));
      this.platform.log.debug(`${this.accessory.displayName}: add quiet mode switch`);
    } else {
      const removeQuietMode = this.accessory.getService(this.accessory.displayName + ' (quiet mode)');
      if (removeQuietMode) {
        this.accessory.removeService(removeQuietMode);
        this.platform.log.debug(`${this.accessory.displayName}: remove quiet mode switch`);
      }
    }

    // Powerful mode
    if (this.deviceConfig?.exposePowerfulMode) {
      this.exposePowerfulMode = this.accessory.getService(this.accessory.displayName + ' (powerful mode)')
        || this.accessory.addService(this.platform.Service.Switch, this.accessory.displayName + ' (powerful mode)', 'exposePowerfulMode');
      this.exposePowerfulMode.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName + ' (powerful mode)');
      this.exposePowerfulMode
        .getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setPowerfulMode.bind(this));
      this.platform.log.debug(`${this.accessory.displayName}: add powerful mode switch`);
    } else {
      const removePowerfulMode = this.accessory.getService(this.accessory.displayName + ' (powerful mode)');
      if (removePowerfulMode) {
        this.accessory.removeService(removePowerfulMode);
        this.platform.log.debug(`${this.accessory.displayName}: remove powerful mode switch`);
      }
    }

    // Swing Up Down
    if (this.deviceConfig?.exposeSwingUpDown) {
      this.exposeSwingUpDown = this.accessory.getService(this.accessory.displayName + ' (swing up down)')
        || this.accessory.addService(this.platform.Service.Switch, this.accessory.displayName + ' (swing up down)', 'exposeSwingUpDown');
      this.exposeSwingUpDown.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName + ' (swing up down)');
      this.exposeSwingUpDown
        .getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setSwingUpDown.bind(this));
      this.platform.log.debug(`${this.accessory.displayName}: add swing up down switch`);
    } else {
      const removeSwingUpDown = this.accessory.getService(this.accessory.displayName + ' (swing up down)');
      if (removeSwingUpDown) {
        this.accessory.removeService(removeSwingUpDown);
        this.platform.log.debug(`${this.accessory.displayName}: remove swing up down switch`);
      }
    }

    // Swing Left Right
    if (this.deviceConfig?.exposeSwingLeftRight) {
      this.exposeSwingLeftRight = this.accessory.getService(this.accessory.displayName + ' (swing left right)')
        || this.accessory.addService(this.platform.Service.Switch, this.accessory.displayName + ' (swing left right)', 'exposeSwingLeftRight');
      this.exposeSwingLeftRight.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName + ' (swing left right)');
      this.exposeSwingLeftRight
        .getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setSwingLeftRight.bind(this));
      this.platform.log.debug(`${this.accessory.displayName}: add swing left right switch`);
    } else {
      const removeSwingLeftRight = this.accessory.getService(this.accessory.displayName + ' (swing left right)');
      if (removeSwingLeftRight) {
        this.accessory.removeService(removeSwingLeftRight);
        this.platform.log.debug(`${this.accessory.displayName}: remove swing left right switch`);
      }
    }

    // Fan speed
    if (this.deviceConfig?.exposeFanSpeed) {
      this.exposeFanSpeed = this.accessory.getService(this.accessory.displayName + ' (fan speed)')
        || this.accessory.addService(this.platform.Service.Fan, this.accessory.displayName + ' (fan speed)', 'exposeFanSpeed');
      this.exposeFanSpeed.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName + ' (fan speed)');
      this.exposeFanSpeed
        .getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setFanSpeed.bind(this));
      this.exposeFanSpeed
        .getCharacteristic(this.platform.Characteristic.RotationSpeed)
        .onSet(this.setFanSpeed.bind(this));
      this.platform.log.debug(`${this.accessory.displayName}: add fan speed slider`);
    } else {
      const removeFanSpeed = this.accessory.getService(this.accessory.displayName + ' (fan speed)');
      if (removeFanSpeed) {
        this.accessory.removeService(removeFanSpeed);
        this.platform.log.debug(`${this.accessory.displayName}: remove fan speed slider`);
      }
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
        this.exposeInsideTemp?.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.deviceStatus.insideTemperature);
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
        this.exposeOutdoorTemp?.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.deviceStatus.outTemperature);
      }

      // Current Heater-Cooler State and Target Heater-Cooler State
      const currentTemp = this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).value as number;
      const setTemp = this.deviceStatus.temperatureSet;
      const { operationMode } = this.deviceStatus;

      const modes = {
        0: { log: 'Auto Mode', target: 'AUTO', current: currentTemp < setTemp ? 'HEATING' : currentTemp > setTemp ? 'COOLING' : 'IDLE' },
        3: { log: 'Heat Mode', target: 'HEAT', current: currentTemp < setTemp ? 'HEATING' : 'IDLE' },
        2: { log: 'Cool Mode', target: 'COOL', current: currentTemp > setTemp ? 'COOLING' : 'IDLE' },
        1: { log: 'Dry Mode', target: 'AUTO', current: 'IDLE' },
        4: { log: 'Fan Mode', target: 'AUTO', current: 'IDLE' },
      };

      if (modes[operationMode]) {
        const { log, target, current } = modes[operationMode];
        logOutput += `, ${log}`;

        this.service.updateCharacteristic(
          this.platform.Characteristic.TargetHeaterCoolerState,
          this.platform.Characteristic.TargetHeaterCoolerState[target],
        );

        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentHeaterCoolerState,
          this.platform.Characteristic.CurrentHeaterCoolerState[current],
        );
      } else {
        this.platform.log.error(`Unknown operation mode: '${operationMode}'`);
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
        let sliderValue = 8; // default AUTO

        if (this.deviceStatus.ecoMode === 2) {
          sliderValue = 1; // Quiet Mode
          logOutput += ', Speed 1 (Quiet Mode)';
        } else if (this.deviceStatus.ecoMode === 1) {
          sliderValue = 7; // Powerful Mode
          logOutput += ', Speed 5 (Powerful Mode)';
        } else if (this.deviceStatus.ecoMode === 0) {
          const fanSpeedMap = { 0: 8, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };
          sliderValue = fanSpeedMap[this.deviceStatus.fanSpeed] || 8;
          logOutput += `, Speed ${this.deviceStatus.fanSpeed || 'Auto'}`;
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

      // Expose additional features
      const isOn = this.deviceStatus.operate === 1;

      this.exposePower?.updateCharacteristic(this.platform.Characteristic.On, isOn);
      this.exposeNanoe?.updateCharacteristic(this.platform.Characteristic.On, this.deviceStatus.nanoe === 2);
      this.exposeInsideCleaning?.updateCharacteristic(this.platform.Characteristic.On, this.deviceStatus.insideCleaning === 2);
      this.exposeEcoNavi?.updateCharacteristic(this.platform.Characteristic.On, this.deviceStatus.ecoNavi === 2);
      this.exposeEcoFunction?.updateCharacteristic(this.platform.Characteristic.On, this.deviceStatus.ecoFunctionData === 2);
      this.exposeAutoMode?.updateCharacteristic(this.platform.Characteristic.On, isOn && this.deviceStatus.operationMode === 0);
      this.exposeCoolMode?.updateCharacteristic(this.platform.Characteristic.On, isOn && this.deviceStatus.operationMode === 2);
      this.exposeHeatMode?.updateCharacteristic(this.platform.Characteristic.On, isOn && this.deviceStatus.operationMode === 3);
      this.exposeDryMode?.updateCharacteristic(this.platform.Characteristic.On, isOn && this.deviceStatus.operationMode === 1);
      this.exposeFanMode?.updateCharacteristic(this.platform.Characteristic.On, isOn && this.deviceStatus.operationMode === 4 && this.deviceStatus.lastSettingMode === 1);
      this.exposeNanoeStandAloneMode?.updateCharacteristic(this.platform.Characteristic.On, isOn && this.deviceStatus.operationMode === 4 && this.deviceStatus.lastSettingMode === 2);
      this.exposeSwingUpDown?.updateCharacteristic(this.platform.Characteristic.On, [0, 2].includes(this.deviceStatus.fanAutoMode));
      this.exposeSwingLeftRight?.updateCharacteristic(this.platform.Characteristic.On, [0, 3].includes(this.deviceStatus.fanAutoMode));

      if (isOn) {
        this.exposeQuietMode?.updateCharacteristic(this.platform.Characteristic.On, this.deviceStatus.ecoMode === 2);
        this.exposePowerfulMode?.updateCharacteristic(this.platform.Characteristic.On, this.deviceStatus.ecoMode === 1);
      }

      // Expose fan speed
      if (this.exposeFanSpeed) {
        const isOn = this.deviceStatus.operate === 1;
        const fanSpeed = this.deviceStatus.fanSpeed;
        const speedMap = { 1: 10, 2: 30, 3: 50, 4: 70, 5: 90 };
        const rotationSpeed = isOn ? (speedMap[fanSpeed] || 100) : 0;

        this.exposeFanSpeed.updateCharacteristic(this.platform.Characteristic.On, isOn);
        this.exposeFanSpeed.updateCharacteristic(this.platform.Characteristic.RotationSpeed, rotationSpeed);
      }

      // Cooling Threshold Temperature (optional)
      // Heating Threshold Temperature (optional)
      this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
        .updateValue(setTemp);
      this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
        .updateValue(setTemp);

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

    // Set refresh inteval
    clearTimeout(this.timerRefreshDeviceStatus);
    this.timerRefreshDeviceStatus = null;

    const isActive = this.service.getCharacteristic(this.platform.Characteristic.Active).value === 1;
    const refreshWhenOn = this.deviceConfig?.refreshWhenOn ?? 10;
    const refreshWhenOff = this.deviceConfig?.refreshWhenOff ?? 60;

    if ((isActive === true && refreshWhenOn !== 0) || (isActive === false && refreshWhenOff !== 0)) {
      this.timerRefreshDeviceStatus = setTimeout(
        this.refreshDeviceStatus.bind(this),
        isActive ? refreshWhenOn * 60000 : refreshWhenOff * 60000,
      );
    }
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
      case 2: case 3: case 4: case 5: case 6:
        parameters.ecoMode = 0;
        parameters.fanSpeed = value - 1;
        this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Fan speed ${value - 1}`);
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
      parameters.airSwingUD = (this.deviceConfig?.swingDefaultUD !== null) ? this.deviceConfig?.swingDefaultUD : 2;
      parameters.airSwingLR = (this.deviceConfig?.swingDefaultLR !== null) ? this.deviceConfig?.swingDefaultLR : 2;
      this.platform.log[(this.platform.platformConfig.logsLevel >= 1) ? 'info' : 'debug'](`${this.accessory.displayName}: Swing mode Off`);
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  // Expose additional features - helper function
  async setMode(modeName: string, value: boolean) {
    this.platform.log.debug(`${this.accessory.displayName}: ${modeName}()`);

    // Configuration map for different modes
    const MODE_CONFIGS = {
      setPower: { key: 'operate', on: 1, off: 0 },
      setNanoe: { key: 'nanoe', on: 2, off: 1 },
      setInsideCleaning: { key: 'insideCleaning', on: 2, off: 1 },
      setEcoNavi: { key: 'ecoNavi', on: 2, off: 1 },
      setEcoFunction: { key: 'ecoFunctionData', on: 2, off: 1 },
      setAutoMode: { key: 'operationMode', on: 0, off: 0, operate: true },
      setCoolMode: { key: 'operationMode', on: 2, off: 0, operate: true },
      setHeatMode: { key: 'operationMode', on: 3, off: 0, operate: true },
      setDryMode: { key: 'operationMode', on: 1, off: 0, operate: true },
      setFanMode: { key: 'operationMode', on: 4, off: 0, operate: true },
      setNanoeStandAloneMode: { key: 'operationMode', on: 5, off: 0, operate: true },
      setQuietMode: { key: 'ecoMode', on: 2, off: 0 },
      setPowerfulMode: { key: 'ecoMode', on: 1, off: 0 },
    };

    const config = MODE_CONFIGS[modeName];
    const parameters: ComfortCloudDeviceUpdatePayload = {};

    if (config.operate) {
      parameters.operate = value ? 1 : 0;
      if (value) {
        parameters[config.key] = config.on;
      }
    } else {
      parameters[config.key] = value ? config.on : config.off;
    }

    const logLevel = this.platform.platformConfig.logsLevel >= 1 ? 'info' : 'debug';
    const state = value ? 'On' : 'Off';
    this.platform.log[logLevel](`${this.accessory.displayName}: ${modeName.replace('set', '')} ${state}`);

    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  // Expose additional features
  async setPower(value: boolean) {
    await this.setMode('setPower', value);
  }

  async setNanoe(value: boolean) {
    await this.setMode('setNanoe', value);
  }

  async setInsideCleaning(value: boolean) {
    await this.setMode('setInsideCleaning', value);
  }

  async setEcoNavi(value: boolean) {
    await this.setMode('setEcoNavi', value);
  }

  async setEcoFunction(value: boolean) {
    await this.setMode('setEcoFunction', value);
  }

  async setAutoMode(value: boolean) {
    await this.setMode('setAutoMode', value);
  }

  async setCoolMode(value: boolean) {
    await this.setMode('setCoolMode', value);
  }

  async setHeatMode(value: boolean) {
    await this.setMode('setHeatMode', value);
  }

  async setDryMode(value: boolean) {
    await this.setMode('setDryMode', value);
  }

  async setFanMode(value: boolean) {
    await this.setMode('setFanMode', value);
  }

  async setNanoeStandAloneMode(value: boolean) {
    await this.setMode('setNanoeStandAloneMode', value);
  }

  async setQuietMode(value: boolean) {
    await this.setMode('setQuietMode', value);
  }

  async setPowerfulMode(value: boolean) {
    await this.setMode('setPowerfulMode', value);
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
      parameters.airSwingUD = (this.deviceConfig?.swingDefaultUD !== null) ? this.deviceConfig?.swingDefaultUD : 2;
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
      parameters.airSwingLR = (this.deviceConfig?.swingDefaultLR !== null) ? this.deviceConfig?.swingDefaultLR : 2;
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

import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import PanasonicPlatform from '../platform';
import OutdoorUnitAccessory from './outdoor-unit';
import { DEVICE_STATUS_REFRESH_INTERVAL } from '../settings';
import { ComfortCloudDeviceUpdatePayload, PanasonicAccessoryContext } from '../types';
import {
  ComfortCloudAirSwingLR,
  ComfortCloudAirSwingUD,
  ComfortCloudEcoMode,
  ComfortCloudFanAutoMode,
  ComfortCloudFanSpeed,
  SwingModeDirection,
  SwingModePositionLeftRight,
  SwingModePositionUpDown,
} from '../enums';

/**
 * An instance of this class is created for each accessory the platform registers.
 * Each accessory may expose multiple services of different service types.
 */
export default class IndoorUnitAccessory {
  private service: Service;
  _refreshInterval: NodeJS.Timer | undefined;

  constructor(
    private readonly platform: PanasonicPlatform,
    private readonly accessory: PlatformAccessory<PanasonicAccessoryContext>,
    private readonly connectedOutdoorUnit?: OutdoorUnitAccessory,
  ) {
    // Accessory Information
    // https://developers.homebridge.io/#/service/AccessoryInformation
    this.accessory.getService(this.platform.Service.AccessoryInformation)
      ?.setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        'Panasonic',
      )
      .setCharacteristic(
        this.platform.Characteristic.Model,
        accessory.context.device?.deviceModuleNumber || 'Unknown',
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        accessory.context.device?.deviceGuid || 'Unknown',
      );

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
        minValue: this.platform.platformConfig.minHeatingTemperature || 16,
        maxValue: 30,
        minStep: 0.5,
      })
      .onSet(this.setThresholdTemperature.bind(this));

    // Update characteristic values asynchronously instead of using onGet handlers
    this.refreshDeviceStatus();
  }

  /**
   * Retrieves the device status from Comfort Cloud and updates its characteristics.
   */
  async refreshDeviceStatus() {
    this.platform.log.debug(`Accessory: Refresh status for device '${this.accessory.displayName}'`);

    try {
      const deviceStatus = await this.platform.comfortCloud.getDeviceStatus(
        this.accessory.context.device.deviceGuid);

      // Active
      if (deviceStatus.operate !== undefined) {
        const active = deviceStatus.operate === 1
          ? this.platform.Characteristic.Active.ACTIVE
          : this.platform.Characteristic.Active.INACTIVE;
        this.service.updateCharacteristic(this.platform.Characteristic.Active, active);
      }

      // Current Temperature
      // If the temperature of the indoor unit is not available, the temperature of the
      // outdoor unit will be used. If both are not available, the default values will
      // be used: 8°C for heating and 30°C for cooling.
      // Temperature of 126 from the API = null/failure

      if (deviceStatus.insideTemperature < 126) {
        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentTemperature, deviceStatus.insideTemperature);
        this.platform.log.debug(`Indoor temperature: '${deviceStatus.insideTemperature}'`);
      } else {
        this.platform.log.debug('Indoor temperature: is not available');
        if (deviceStatus.outTemperature < 126) {
          this.service.updateCharacteristic(
            this.platform.Characteristic.CurrentTemperature, deviceStatus.outTemperature);
          this.platform.log.debug(`Outdoor temperature: '${deviceStatus.outTemperature}'`);
        } else {
          this.platform.log.debug(
            'Indoor and Outdoor temperature are not available - setting default temperature');
          this.service.updateCharacteristic(
            this.platform.Characteristic.CurrentTemperature,
            (deviceStatus.operationMode === 3) ? 30 : 8,
          );
        }
      }

      // Outdoor temperature
      // Only check and set if the user wants to display the outdoor unit as separate device.
      if (this.connectedOutdoorUnit) {
        if (deviceStatus.outTemperature >= 126) {
          this.platform.log.error('Outdoor temperature is not available');
        } else {
          // Update the value of the connected outdoor unit
          this.connectedOutdoorUnit.setOutdoorTemperature(deviceStatus.outTemperature);
        }
      }

      // Current Heater-Cooler State and Target Heater-Cooler State
      const currentTemperature = this.service.getCharacteristic(
        this.platform.Characteristic.CurrentTemperature).value as number;
      const setTemperature = deviceStatus.temperatureSet;

      switch (deviceStatus.operationMode) {
        // Auto
        case 0:
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
            `Unknown TargetHeaterCoolerState state: '${deviceStatus.operationMode}'`);
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

      // Default to AUTO mode
      let sliderValue = 8;

      if (deviceStatus.ecoMode === ComfortCloudEcoMode.Quiet) {
        sliderValue = 1;
      } else if (deviceStatus.ecoMode === ComfortCloudEcoMode.Powerful) {
        sliderValue = 7;
      } else if (deviceStatus.ecoMode === ComfortCloudEcoMode.AutoOrManual) {
        switch (deviceStatus.fanSpeed) {
          case ComfortCloudFanSpeed.One:
            sliderValue = 2;
            break;
          case ComfortCloudFanSpeed.Two:
            sliderValue = 3;
            break;
          case ComfortCloudFanSpeed.Three:
            sliderValue = 4;
            break;
          case ComfortCloudFanSpeed.Four:
            sliderValue = 5;
            break;
          case ComfortCloudFanSpeed.Five:
            sliderValue = 6;
            break;
          case ComfortCloudFanSpeed.Auto:
            sliderValue = 8;
            break;
        }
      }
      this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
        .updateValue(sliderValue);

      // Swing Mode
      if (this.platform.platformConfig.oscilateSwitch === 'nanoe') {
        if (deviceStatus.nanoe === 2) {
          this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
            .updateValue(this.platform.Characteristic.SwingMode.SWING_ENABLED);
        } else {
          this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
            .updateValue(this.platform.Characteristic.SwingMode.SWING_DISABLED);
        }
      } else if (this.platform.platformConfig.oscilateSwitch === 'ecoNavi') {
        if (deviceStatus.ecoNavi === 2 || deviceStatus.ecoFunctionData === 2) {
          this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
            .updateValue(this.platform.Characteristic.SwingMode.SWING_ENABLED);
        } else {
          this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
            .updateValue(this.platform.Characteristic.SwingMode.SWING_DISABLED);
        }
      } else if (this.platform.platformConfig.oscilateSwitch === 'insideCleaning') {
        if (deviceStatus.insideCleaning === 2) {
          this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
            .updateValue(this.platform.Characteristic.SwingMode.SWING_ENABLED);
        } else {
          this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
            .updateValue(this.platform.Characteristic.SwingMode.SWING_DISABLED);
        }
      } else if ((deviceStatus.fanAutoMode === ComfortCloudFanAutoMode.AirSwingAuto
        && this.platform.platformConfig.swingModeDirections
        === SwingModeDirection.LeftRightAndUpDown)
        || (deviceStatus.fanAutoMode === ComfortCloudFanAutoMode.AirSwingLR
          && this.platform.platformConfig.swingModeDirections === SwingModeDirection.LeftRightOnly)
        || (deviceStatus.fanAutoMode === ComfortCloudFanAutoMode.AirSwingUD
          && this.platform.platformConfig.swingModeDirections === SwingModeDirection.UpDownOnly)) {
        this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
          .updateValue(this.platform.Characteristic.SwingMode.SWING_ENABLED);
      } else {
        this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
          .updateValue(this.platform.Characteristic.SwingMode.SWING_DISABLED);
      }

      // Cooling Threshold Temperature (optional)
      // Heating Threshold Temperature (optional)
      this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
        .updateValue(setTemperature);
      this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
        .updateValue(setTemperature);
    } catch (error) {
      this.platform.log.error('An error occurred while refreshing the device status. '
        + 'Turn on debug mode for more information.');

      // Only log if a Promise rejection reason was provided.
      // Some errors are already logged at source.
      if (error) {
        this.platform.log.debug(error);
      }

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
    if (!this._refreshInterval) {
      this._refreshInterval = setInterval(
        this.refreshDeviceStatus.bind(this),
        this.platform.platformConfig.refreshInterval * 60 * 1000 || DEVICE_STATUS_REFRESH_INTERVAL,
      );
    }
  }

  /**
   * Handle 'SET' requests from HomeKit
   * These are sent when the user changes the state of an accessory,
   * for example, turning on a Light bulb.
   */
  async setActive(value: CharacteristicValue) {
    this.platform.log.debug(`Accessory: setActive() for device '${this.accessory.displayName}'`);
    const parameters: ComfortCloudDeviceUpdatePayload = {
      operate: value === this.platform.Characteristic.Active.ACTIVE ? 1 : 0,
    };

    // Swing Mode
    if (this.platform.platformConfig.startSwing === 'on') {
      switch (this.platform.platformConfig.swingModeDirections) {
        case SwingModeDirection.LeftRightAndUpDown:
          parameters.fanAutoMode = ComfortCloudFanAutoMode.AirSwingAuto;
          this.platform.log.debug(
            `${this.accessory.displayName}: Swing mode Left/Right and Up/Down`);
          break;
        case SwingModeDirection.LeftRightOnly:
          parameters.fanAutoMode = ComfortCloudFanAutoMode.AirSwingLR;
          parameters.airSwingUD = this.swingModeUpDownToComfortCloudPayloadValue(
            this.platform.platformConfig.swingModeDefaultPositionUpDown);
          this.platform.log.debug(`${this.accessory.displayName}: Swing mode Left/Right`);
          break;
        case SwingModeDirection.UpDownOnly:
          parameters.fanAutoMode = ComfortCloudFanAutoMode.AirSwingUD;
          parameters.airSwingLR = this.swingModeLeftRightToComfortCloudPayloadValue(
            this.platform.platformConfig.swingModeDefaultPositionLeftRight);
          this.platform.log.debug(`${this.accessory.displayName}: Swing mode Up/Down`);
          break;
        default:
          parameters.fanAutoMode = ComfortCloudFanAutoMode.AirSwingAuto;
          this.platform.log.debug(`${this.accessory.displayName}: Swing mode Auto`);
          break;
      }
    } else if (this.platform.platformConfig.startSwing === 'off') {
      parameters.fanAutoMode = ComfortCloudFanAutoMode.Disabled;
      parameters.airSwingLR = this.swingModeLeftRightToComfortCloudPayloadValue(
        this.platform.platformConfig.swingModeDefaultPositionLeftRight);
      parameters.airSwingUD = this.swingModeUpDownToComfortCloudPayloadValue(
        this.platform.platformConfig.swingModeDefaultPositionUpDown);
      this.platform.log.debug(`${this.accessory.displayName}: Swing mode Off`);
    }

    // Nanoe
    if (this.platform.platformConfig.startNanoe === 'on') {
      parameters.nanoe = 2;
      this.platform.log.debug('Nanoe on');
    } else if (this.platform.platformConfig.startNanoe === 'off') {
      parameters.nanoe = 1;
      this.platform.log.debug('Nanoe off');
    }

    // Eco Navi
    if (this.platform.platformConfig.startEcoNavi === 'on') {
      parameters.ecoNavi = 2;
      parameters.ecoFunctionData = 2;
      this.platform.log.debug('Eco Navi on');
    } else if (this.platform.platformConfig.startEcoNavi === 'off') {
      parameters.ecoNavi = 1;
      parameters.ecoFunctionData = 1;
      this.platform.log.debug('Eco Navi off');
    }

    // Inside Cleaning
    if (this.platform.platformConfig.startInsideCleaning === 'on') {
      parameters.insideCleaning = 2;
      this.platform.log.debug('Inside cleaning on');
    } else if (this.platform.platformConfig.startInsideCleaning === 'off') {
      parameters.insideCleaning = 1;
      this.platform.log.debug('Inside cleaning off');
    }

    this.sendDeviceUpdate(
      this.accessory.context.device.deviceGuid, parameters);
    this.platform.log.debug(`${this.accessory.displayName}: ${value === 1 ? 'On' : 'Off'}`);
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue) {
    this.platform.log.debug(
      `Accessory: setTargetHeaterCoolerState() for device '${this.accessory.displayName}'`);
    const parameters: ComfortCloudDeviceUpdatePayload = {
      operate: 1,
    };
    switch (value) {
      case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
        parameters.operationMode = 0;
        this.platform.log.debug(`${this.accessory.displayName}: Mode Auto`);
        break;

      case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
        parameters.operationMode = 2;
        this.platform.log.debug(`${this.accessory.displayName}: Mode Cool`);
        break;

      case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
        parameters.operationMode = 3;
        this.platform.log.debug(`${this.accessory.displayName}: Mode Heat`);
        break;

      default:
        this.platform.log.error('Unknown TargetHeaterCoolerState', value);
        return;
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  async setRotationSpeed(value: CharacteristicValue) {
    this.platform.log.debug(
      `Accessory: setRotationSpeed() for device '${this.accessory.displayName}'`);
    const parameters: ComfortCloudDeviceUpdatePayload = {};
    switch (value) {
      // See README for the mapping of slider position to Comfort Cloud payload.
      case 0:
        // HomeKit independently switches off the accessory
        // in this case, which triggers setActive().
        // Nothing to handle here, but documenting for clarity.
        break;
      case 1:
        parameters.ecoMode = ComfortCloudEcoMode.Quiet;
        this.platform.log.debug(`${this.accessory.displayName}: Quiet Mode`);
        break;
      case 2:
        parameters.ecoMode = ComfortCloudEcoMode.AutoOrManual;
        parameters.fanSpeed = ComfortCloudFanSpeed.One;
        this.platform.log.debug(`${this.accessory.displayName}: Fan speed 1`);
        break;
      case 3:
        parameters.ecoMode = ComfortCloudEcoMode.AutoOrManual;
        parameters.fanSpeed = ComfortCloudFanSpeed.Two;
        this.platform.log.debug(`${this.accessory.displayName}: Fan speed 2`);
        break;
      case 4:
        parameters.ecoMode = ComfortCloudEcoMode.AutoOrManual;
        parameters.fanSpeed = ComfortCloudFanSpeed.Three;
        this.platform.log.debug(`${this.accessory.displayName}: Fan speed 3`);
        break;
      case 5:
        parameters.ecoMode = ComfortCloudEcoMode.AutoOrManual;
        parameters.fanSpeed = ComfortCloudFanSpeed.Four;
        this.platform.log.debug(`${this.accessory.displayName}: Fan speed 4`);
        break;
      case 6:
        parameters.ecoMode = ComfortCloudEcoMode.AutoOrManual;
        parameters.fanSpeed = ComfortCloudFanSpeed.Five;
        this.platform.log.debug(`${this.accessory.displayName}: Fan speed 5`);
        break;
      case 7:
        parameters.ecoMode = ComfortCloudEcoMode.Powerful;
        this.platform.log.debug(`${this.accessory.displayName}: Powerful Mode`);
        break;
      case 8:
        parameters.ecoMode = ComfortCloudEcoMode.AutoOrManual;
        parameters.fanSpeed = ComfortCloudFanSpeed.Auto;
        break;
      default:
        parameters.ecoMode = ComfortCloudEcoMode.AutoOrManual;
        parameters.fanSpeed = ComfortCloudFanSpeed.Auto;
        break;
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  async setSwingMode(value: CharacteristicValue) {
    this.platform.log.debug(
      `Accessory: setSwingMode() for device '${this.accessory.displayName}'`);

    const parameters: ComfortCloudDeviceUpdatePayload = {};

    if (value === this.platform.Characteristic.SwingMode.SWING_ENABLED) {
      // Activate swing mode
      // and (if needed) reset one set of fins to their default position.
      if (this.platform.platformConfig.oscilateSwitch === 'nanoe') {
        parameters.nanoe = 2;
        this.platform.log.debug(`${this.accessory.displayName}: Nanoe On`);
      } else if (this.platform.platformConfig.oscilateSwitch === 'ecoNavi') {
        parameters.ecoNavi = 2;
        parameters.ecoFunctionData = 2;
        this.platform.log.debug(`${this.accessory.displayName}: Eco Navi On`);
      } else if (this.platform.platformConfig.oscilateSwitch === 'insideCleaning') {
        parameters.insideCleaning = 2;
        this.platform.log.debug(`${this.accessory.displayName}: Inside Cleaning On`);
      } else {
        switch (this.platform.platformConfig.swingModeDirections) {
          case SwingModeDirection.LeftRightAndUpDown:
            parameters.fanAutoMode = ComfortCloudFanAutoMode.AirSwingAuto;
            this.platform.log.debug(
              `${this.accessory.displayName}: Swing mode Left/Right and Up/Down`);
            break;
          case SwingModeDirection.LeftRightOnly:
            parameters.fanAutoMode = ComfortCloudFanAutoMode.AirSwingLR;
            parameters.airSwingUD = this.swingModeUpDownToComfortCloudPayloadValue(
              this.platform.platformConfig.swingModeDefaultPositionUpDown);
            this.platform.log.debug(`${this.accessory.displayName}: Swing mode Left/Right`);
            break;
          case SwingModeDirection.UpDownOnly:
            parameters.fanAutoMode = ComfortCloudFanAutoMode.AirSwingUD;
            parameters.airSwingLR = this.swingModeLeftRightToComfortCloudPayloadValue(
              this.platform.platformConfig.swingModeDefaultPositionLeftRight);
            this.platform.log.debug(`${this.accessory.displayName}: Swing mode Up/Down`);
            break;
          default:
            parameters.fanAutoMode = ComfortCloudFanAutoMode.AirSwingAuto;
            this.platform.log.debug(`${this.accessory.displayName}: Swing mode Auto`);
            break;
        }
      }

    } else if (value === this.platform.Characteristic.SwingMode.SWING_DISABLED) {
      if (this.platform.platformConfig.oscilateSwitch === 'nanoe') {
        parameters.nanoe = 1;
        this.platform.log.debug(`${this.accessory.displayName}: Nanoe Off`);
      } else if (this.platform.platformConfig.oscilateSwitch === 'ecoNavi') {
        parameters.ecoNavi = 1;
        parameters.ecoFunctionData = 1;
        this.platform.log.debug(`${this.accessory.displayName}: Eco Navi Off`);
      } else if (this.platform.platformConfig.oscilateSwitch === 'insideCleaning') {
        parameters.insideCleaning = 0;
        this.platform.log.debug(`${this.accessory.displayName}: Inside Cleaning Off`);
      } else {
        parameters.fanAutoMode = ComfortCloudFanAutoMode.Disabled;
        parameters.airSwingLR = this.swingModeLeftRightToComfortCloudPayloadValue(
          this.platform.platformConfig.swingModeDefaultPositionLeftRight);
        parameters.airSwingUD = this.swingModeUpDownToComfortCloudPayloadValue(
          this.platform.platformConfig.swingModeDefaultPositionUpDown);
        this.platform.log.debug(`${this.accessory.displayName}: Swing mode Off`);
      }
    }
    this.sendDeviceUpdate(this.accessory.context.device.deviceGuid, parameters);
  }

  /**
   * Maps the internal left-right swing mode position enum to the corresponding
   * Comfort Cloud value.
   *
   * @param position The internal value for the left-right position.
   * @returns The corresponding Comfort Cloud value for the given position.
   */
  swingModeLeftRightToComfortCloudPayloadValue(position?: SwingModePositionLeftRight) {
    switch (position) {
      case SwingModePositionLeftRight.Left:
        return ComfortCloudAirSwingLR.Left;
      case SwingModePositionLeftRight.CenterLeft:
        return ComfortCloudAirSwingLR.CenterLeft;
      case SwingModePositionLeftRight.Center:
        return ComfortCloudAirSwingLR.Center;
      case SwingModePositionLeftRight.CenterRight:
        return ComfortCloudAirSwingLR.CenterRight;
      case SwingModePositionLeftRight.Right:
        return ComfortCloudAirSwingLR.Right;
      default:
        return ComfortCloudAirSwingLR.Center;
    }
  }

  /**
   * Maps the internal up-down swing mode position enum to the corresponding Comfort Cloud value.
   *
   * @param position The internal value for the up-down position.
   * @returns The corresponding Comfort Cloud value for the given position.
   */
  swingModeUpDownToComfortCloudPayloadValue(position?: SwingModePositionUpDown) {
    switch (position) {
      case SwingModePositionUpDown.Up:
        return ComfortCloudAirSwingUD.Up;
      case SwingModePositionUpDown.CenterUp:
        return ComfortCloudAirSwingUD.CenterUp;
      case SwingModePositionUpDown.Center:
        return ComfortCloudAirSwingUD.Center;
      case SwingModePositionUpDown.CenterDown:
        return ComfortCloudAirSwingUD.CenterDown;
      case SwingModePositionUpDown.Down:
        return ComfortCloudAirSwingUD.Down;
      default:
        return ComfortCloudAirSwingUD.Center;
    }
  }

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
      // Only send non-empty payloads to prevent a '500 Internal Server Error'
      if (Object.keys(payload).length > 0) {
        this.platform.comfortCloud.setDeviceStatus(guid, payload);
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

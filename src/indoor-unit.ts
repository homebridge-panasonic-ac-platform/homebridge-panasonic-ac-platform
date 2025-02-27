import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import PanasonicPlatform from './platform';
import { ComfortCloudDeviceUpdatePayload } from './types';

// Assuming ComfortCloudDeviceStatus has a parameters property; adjust if different
interface ComfortCloudDeviceStatus {
  parameters: {
    operate: number;
    insideTemperature: number;
    outTemperature: number;
    operationMode: number;
    temperatureSet: number;
    fanSpeed: number;
    ecoMode: number;
    fanAutoMode: number;
    nanoe?: number;
    insideCleaning?: number;
    ecoNavi?: number;
    ecoFunctionData?: number;
    lastSettingMode?: number;
  };
}

export default class IndoorUnitAccessory {
  private service: Service;
  private sendPayload: ComfortCloudDeviceUpdatePayload = {};
  private timers: { [key: string]: NodeJS.Timeout } = {};
  private devConfig: any;
  private deviceStatus: ComfortCloudDeviceStatus['parameters'] | undefined;
  private optionalServices: { [key: string]: Service } = {};

  constructor(private platform: PanasonicPlatform, private accessory: PlatformAccessory) {
    this.devConfig = this.platform.platformConfig.devices?.find(
      d => d.name === this.accessory.context.device?.deviceName || d.name === this.accessory.context.device?.deviceGuid
    );

    // Accessory Information
    const infoService = this.accessory.getService(this.platform.Service.AccessoryInformation)!;
    infoService
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Panasonic')
      .setCharacteristic(this.platform.Characteristic.Model, this.accessory.context.device?.deviceModuleNumber || 'Unknown')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.context.device?.deviceGuid || 'Unknown');

    // HeaterCooler Service
    this.service = this.accessory.getService(this.platform.Service.HeaterCooler) || 
      this.accessory.addService(this.platform.Service.HeaterCooler);
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.context.device?.deviceName || 'Unnamed');
    this.service.getCharacteristic(this.platform.Characteristic.Active).onSet(this.setActive.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).setProps({ minValue: -100, maxValue: 100, minStep: 0.01 });
    this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState).onSet(this.setTargetHeaterCoolerState.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed).setProps({ minValue: 0, maxValue: 8, minStep: 1 }).onSet(this.setRotationSpeed.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.SwingMode).onSet(this.setSwingMode.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature).setProps({ minValue: 16, maxValue: 30, minStep: 0.5 }).onSet(this.setThresholdTemperature.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature).setProps({ minValue: this.devConfig?.minHeatingTemperature || 16, maxValue: 30, minStep: 0.5 }).onSet(this.setThresholdTemperature.bind(this));

    // Setup optional features
    this.setupOptionalFeatures();
    this.refreshDeviceStatus();
  }

  private setupOptionalFeatures() {
    const features = [
      { key: 'exposeInsideTemp', type: 'TemperatureSensor', suffix: ' inside temp', setter: null },
      { key: 'exposeOutdoorTemp', type: 'TemperatureSensor', suffix: ' out temp', setter: null },
      { key: 'exposePower', type: 'Switch', suffix: ' power', setter: this.setPower },
      { key: 'exposeNanoe', type: 'Switch', suffix: ' nanoe', setter: this.setNanoe },
      { key: 'exposeInsideCleaning', type: 'Switch', suffix: ' inside cleaning', setter: this.setInsideCleaning },
      { key: 'exposeEcoNavi', type: 'Switch', suffix: ' eco navi', setter: this.setEcoNavi },
      { key: 'exposeEcoFunction', type: 'Switch', suffix: ' eco function', setter: this.setEcoFunction },
      { key: 'exposeAutoMode', type: 'Switch', suffix: ' auto mode', setter: this.setAutoMode },
      { key: 'exposeCoolMode', type: 'Switch', suffix: ' cool mode', setter: this.setCoolMode },
      { key: 'exposeHeatMode', type: 'Switch', suffix: ' heat mode', setter: this.setHeatMode },
      { key: 'exposeDryMode', type: 'Switch', suffix: ' dry mode', setter: this.setDryMode },
      { key: 'exposeFanMode', type: 'Switch', suffix: ' fan mode', setter: this.setFanMode },
      { key: 'exposeNanoeStandAloneMode', type: 'Switch', suffix: ' nanoe stand alone mode', setter: this.setNanoeStandAloneMode },
      { key: 'exposeQuietMode', type: 'Switch', suffix: ' quiet mode', setter: this.setQuietMode },
      { key: 'exposePowerfulMode', type: 'Switch', suffix: ' powerful mode', setter: this.setPowerfulMode },
      { key: 'exposeSwingUpDown', type: 'Switch', suffix: ' swing up down', setter: this.setSwingUpDown },
      { key: 'exposeSwingLeftRight', type: 'Switch', suffix: ' swing left right', setter: this.setSwingLeftRight },
      { key: 'exposeFanSpeed', type: 'Fan', suffix: ' fan speed', setter: this.setFanSpeed },
    ];

    features.forEach(f => {
      const name = this.accessory.displayName + f.suffix;
      if (this.devConfig?.[f.key]) {
        this.optionalServices[f.key] = this.accessory.getService(name) || 
          this.accessory.addService(this.platform.Service[f.type], name, f.key);
        this.optionalServices[f.key].setCharacteristic(this.platform.Characteristic.ConfiguredName, name);
        if (f.setter) {
          this.optionalServices[f.key].getCharacteristic(this.platform.Characteristic.On).onSet(f.setter.bind(this));
          if (f.type === 'Fan') {
            this.optionalServices[f.key].getCharacteristic(this.platform.Characteristic.RotationSpeed).onSet(f.setter.bind(this));
          }
        }
      } else {
        const service = this.accessory.getService(name);
        service && this.accessory.removeService(service);
      }
    });
  }

  async refreshDeviceStatus() {
    try {
      const status = await this.platform.comfortCloud.getDeviceStatus(this.accessory.context.device.deviceGuid, this.accessory.displayName);
      this.deviceStatus = status.parameters;

      const activeState = this.deviceStatus.operate === 1 ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
      this.service.updateCharacteristic(this.platform.Characteristic.Active, activeState);
      const temp = this.deviceStatus.insideTemperature < 126 ? this.deviceStatus.insideTemperature : (this.deviceStatus.operationMode === 3 ? 8 : 30);
      this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, temp);

      // Mode handling
      const modeMap = { 0: 'AUTO', 2: 'COOL', 3: 'HEAT', 1: 'AUTO', 4: 'AUTO' };
      const targetMode = this.platform.Characteristic.TargetHeaterCoolerState[modeMap[this.deviceStatus.operationMode] || 'AUTO'];
      this.service.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, targetMode);
      const currentTemp = this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).value as number;
      const setTemp = this.deviceStatus.temperatureSet;
      if (this.deviceStatus.operationMode === 0) {
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, 
          currentTemp < setTemp ? this.platform.Characteristic.CurrentHeaterCoolerState.HEATING : 
          currentTemp > setTemp ? this.platform.Characteristic.CurrentHeaterCoolerState.COOLING : 
          this.platform.Characteristic.CurrentHeaterCoolerState.IDLE);
      } else if (this.deviceStatus.operationMode === 3) {
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, 
          currentTemp < setTemp ? this.platform.Characteristic.CurrentHeaterCoolerState.HEATING : 
          this.platform.Characteristic.CurrentHeaterCoolerState.IDLE);
      } else if (this.deviceStatus.operationMode === 2) {
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, 
          currentTemp > setTemp ? this.platform.Characteristic.CurrentHeaterCoolerState.COOLING : 
          this.platform.Characteristic.CurrentHeaterCoolerState.IDLE);
      } else {
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, 
          this.platform.Characteristic.CurrentHeaterCoolerState.IDLE);
      }

      // Rotation Speed
      const speed = this.deviceStatus.operate === 1 ? 
        (this.deviceStatus.ecoMode === 2 ? 1 : this.deviceStatus.ecoMode === 1 ? 7 : this.deviceStatus.fanSpeed === 0 ? 8 : this.deviceStatus.fanSpeed + 1) : 0;
      this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, speed);

      // Swing Mode
      this.service.updateCharacteristic(this.platform.Characteristic.SwingMode, 
        this.deviceStatus.fanAutoMode !== 1 ? this.platform.Characteristic.SwingMode.SWING_ENABLED : 
        this.platform.Characteristic.SwingMode.SWING_DISABLED);

      // Threshold Temperatures
      this.service.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, setTemp);
      this.service.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, setTemp);

      // Optional Services
      this.optionalServices.exposeInsideTemp?.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, temp);
      this.optionalServices.exposeOutdoorTemp?.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, 
        this.deviceStatus.outTemperature < 126 ? this.deviceStatus.outTemperature : temp);
      this.optionalServices.exposePower?.updateCharacteristic(this.platform.Characteristic.On, activeState === 1);
      this.optionalServices.exposeNanoe?.updateCharacteristic(this.platform.Characteristic.On, this.deviceStatus.nanoe === 2);
      this.optionalServices.exposeInsideCleaning?.updateCharacteristic(this.platform.Characteristic.On, this.deviceStatus.insideCleaning === 2);
      this.optionalServices.exposeEcoNavi?.updateCharacteristic(this.platform.Characteristic.On, this.deviceStatus.ecoNavi === 2);
      this.optionalServices.exposeEcoFunction?.updateCharacteristic(this.platform.Characteristic.On, this.deviceStatus.ecoFunctionData === 2);
      this.optionalServices.exposeAutoMode?.updateCharacteristic(this.platform.Characteristic.On, activeState === 1 && this.deviceStatus.operationMode === 0);
      this.optionalServices.exposeCoolMode?.updateCharacteristic(this.platform.Characteristic.On, activeState === 1 && this.deviceStatus.operationMode === 2);
      this.optionalServices.exposeHeatMode?.updateCharacteristic(this.platform.Characteristic.On, activeState === 1 && this.deviceStatus.operationMode === 3);
      this.optionalServices.exposeDryMode?.updateCharacteristic(this.platform.Characteristic.On, activeState === 1 && this.deviceStatus.operationMode === 1);
      this.optionalServices.exposeFanMode?.updateCharacteristic(this.platform.Characteristic.On, activeState === 1 && this.deviceStatus.operationMode === 4 && this.deviceStatus.lastSettingMode === 1);
      this.optionalServices.exposeNanoeStandAloneMode?.updateCharacteristic(this.platform.Characteristic.On, activeState === 1 && this.deviceStatus.operationMode === 4 && this.deviceStatus.lastSettingMode === 2);
      this.optionalServices.exposeQuietMode?.updateCharacteristic(this.platform.Characteristic.On, activeState === 1 && this.deviceStatus.ecoMode === 2);
      this.optionalServices.exposePowerfulMode?.updateCharacteristic(this.platform.Characteristic.On, activeState === 1 && this.deviceStatus.ecoMode === 1);
      this.optionalServices.exposeSwingUpDown?.updateCharacteristic(this.platform.Characteristic.On, this.deviceStatus.fanAutoMode === 0 || this.deviceStatus.fanAutoMode === 2);
      this.optionalServices.exposeSwingLeftRight?.updateCharacteristic(this.platform.Characteristic.On, this.deviceStatus.fanAutoMode === 0 || this.deviceStatus.fanAutoMode === 3);
      if (this.optionalServices.exposeFanSpeed && activeState === 1) {
        const fanSpeed = this.deviceStatus.fanSpeed;
        this.optionalServices.exposeFanSpeed.updateCharacteristic(this.platform.Characteristic.On, true);
        this.optionalServices.exposeFanSpeed.updateCharacteristic(this.platform.Characteristic.RotationSpeed, 
          fanSpeed === 0 ? 100 : fanSpeed * 20);
      } else {
        this.optionalServices.exposeFanSpeed?.updateCharacteristic(this.platform.Characteristic.On, false);
        this.optionalServices.exposeFanSpeed?.updateCharacteristic(this.platform.Characteristic.RotationSpeed, 0);
      }
    } catch (e) {
      this.platform.log.error('Status refresh failed:', e);
    }
    clearTimeout(this.timers.refresh);
    this.timers.refresh = setTimeout(this.refreshDeviceStatus.bind(this), 
      this.service.getCharacteristic(this.platform.Characteristic.Active).value === this.platform.Characteristic.Active.ACTIVE ? 10 * 60 * 1000 : 60 * 60 * 1000);
  }

  async setActive(value: CharacteristicValue) {
    this.sendDeviceUpdate({ operate: value === this.platform.Characteristic.Active.ACTIVE ? 1 : 0 });
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue) {
    const modes = {
      [this.platform.Characteristic.TargetHeaterCoolerState.AUTO]: this.platform.platformConfig.autoMode === 'fan' ? 4 : this.platform.platformConfig.autoMode === 'dry' ? 1 : 0,
      [this.platform.Characteristic.TargetHeaterCoolerState.COOL]: 2,
      [this.platform.Characteristic.TargetHeaterCoolerState.HEAT]: 3
    };
    this.sendDeviceUpdate({ operate: 1, operationMode: modes[value as number] });
  }

  async setRotationSpeed(value: CharacteristicValue) {
    const v = value as number;
    const payload = v === 1 ? { ecoMode: 2 } : v === 7 ? { ecoMode: 1 } : { ecoMode: 0, fanSpeed: v === 8 ? 0 : v - 1 };
    this.sendDeviceUpdate(payload);
  }

  async setSwingMode(value: CharacteristicValue) {
    this.sendDeviceUpdate({ 
      fanAutoMode: value === this.platform.Characteristic.SwingMode.SWING_ENABLED ? 0 : 1, 
      airSwingUD: value === this.platform.Characteristic.SwingMode.SWING_DISABLED ? (this.devConfig?.swingDefaultUD ?? 2) : undefined, 
      airSwingLR: value === this.platform.Characteristic.SwingMode.SWING_DISABLED ? (this.devConfig?.swingDefaultLR ?? 2) : undefined 
    });
  }

  async setThresholdTemperature(value: CharacteristicValue) {
    this.sendDeviceUpdate({ temperatureSet: value as number });
  }

  async setPower(value: CharacteristicValue) { this.sendDeviceUpdate({ operate: value ? 1 : 0 }); }
  async setNanoe(value: CharacteristicValue) { this.sendDeviceUpdate({ nanoe: value ? 2 : 1 }); }
  async setInsideCleaning(value: CharacteristicValue) { this.sendDeviceUpdate({ insideCleaning: value ? 2 : 1 }); }
  async setEcoNavi(value: CharacteristicValue) { this.sendDeviceUpdate({ ecoNavi: value ? 2 : 1 }); }
  async setEcoFunction(value: CharacteristicValue) { this.sendDeviceUpdate({ ecoFunctionData: value ? 2 : 1 }); }
  async setAutoMode(value: CharacteristicValue) { this.sendDeviceUpdate({ operate: value ? 1 : 0, operationMode: value ? 0 : undefined }); }
  async setCoolMode(value: CharacteristicValue) { this.sendDeviceUpdate({ operate: value ? 1 : 0, operationMode: value ? 2 : undefined }); }
  async setHeatMode(value: CharacteristicValue) { this.sendDeviceUpdate({ operate: value ? 1 : 0, operationMode: value ? 3 : undefined }); }
  async setDryMode(value: CharacteristicValue) { this.sendDeviceUpdate({ operate: value ? 1 : 0, operationMode: value ? 1 : undefined }); }
  async setFanMode(value: CharacteristicValue) { this.sendDeviceUpdate({ operate: value ? 1 : 0, operationMode: value ? 4 : undefined }); }
  async setNanoeStandAloneMode(value: CharacteristicValue) { this.sendDeviceUpdate({ operate: value ? 1 : 0, operationMode: value ? 5 : undefined }); }
  async setQuietMode(value: CharacteristicValue) { this.sendDeviceUpdate({ ecoMode: value ? 2 : 0 }); }
  async setPowerfulMode(value: CharacteristicValue) { this.sendDeviceUpdate({ ecoMode: value ? 1 : 0 }); }
  async setSwingUpDown(value: CharacteristicValue) {
    this.sendDeviceUpdate({ 
      fanAutoMode: value ? (this.deviceStatus?.fanAutoMode === 3 ? 0 : 2) : (this.deviceStatus?.fanAutoMode === 0 ? 3 : 1), 
      airSwingUD: !value ? (this.devConfig?.swingDefaultUD ?? 2) : undefined 
    });
  }
  async setSwingLeftRight(value: CharacteristicValue) {
    this.sendDeviceUpdate({ 
      fanAutoMode: value ? (this.deviceStatus?.fanAutoMode === 2 ? 0 : 3) : (this.deviceStatus?.fanAutoMode === 0 ? 2 : 1), 
      airSwingLR: !value ? (this.devConfig?.swingDefaultLR ?? 2) : undefined 
    });
  }
  async setFanSpeed(value: CharacteristicValue) {
    const v = value as number;
    const payload = v === 0 ? { operate: 0 } : v <= 20 ? { ecoMode: 0, fanSpeed: 1 } : v <= 40 ? { ecoMode: 0, fanSpeed: 2 } : 
      v <= 60 ? { ecoMode: 0, fanSpeed: 3 } : v <= 80 ? { ecoMode: 0, fanSpeed: 4 } : v < 100 ? { ecoMode: 0, fanSpeed: 5 } : { ecoMode: 0, fanSpeed: 0 };
    this.sendDeviceUpdate(payload);
  }

  async sendDeviceUpdate(payload: ComfortCloudDeviceUpdatePayload) {
    this.sendPayload = { ...this.sendPayload, ...payload };
    clearTimeout(this.timers.send);
    this.timers.send = setTimeout(async () => {
      if (Object.keys(this.sendPayload).length) {
        if (this.deviceStatus?.operate === 0 && this.sendPayload.operate === 1 && !('fanSpeed' in this.sendPayload) && !('ecoMode' in this.sendPayload)) {
          const speed = this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed).value as number;
          this.sendPayload = { ...this.sendPayload, ...(speed === 1 ? { ecoMode: 2 } : speed === 7 ? { ecoMode: 1 } : { ecoMode: 0, fanSpeed: speed === 8 ? 0 : speed - 1 }) };
        }
        try {
          await this.platform.comfortCloud.setDeviceStatus(this.accessory.context.device.deviceGuid, this.accessory.displayName, this.sendPayload);
          this.sendPayload = {};
          clearTimeout(this.timers.refreshAfterSend);
          this.timers.refreshAfterSend = setTimeout(this.refreshDeviceStatus.bind(this), 7500);
        } catch (e) {
          this.platform.log.error('Device update failed:', e);
        }
      }
    }, 2500);
  }
}

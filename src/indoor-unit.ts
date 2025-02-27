import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback } from 'homebridge';
import PanasonicPlatform from './platform';
import { ComfortCloudDeviceUpdatePayload, PanasonicAccessoryContext } from './types';

interface ComfortCloudDeviceStatus {
  parameters: {
    operate: number;
    insideTemperature: number;
    outTemperature: number;
    operationMode: number;
    temperatureSet: number;
    fanSpeed: number;
    fanAutoMode: number;
    nanoe: number;
    insideCleaning: number;
    ecoNavi: number;
    ecoFunctionData: number;
    ecoMode: number;
    lastSettingMode: number;
  };
}

export default class IndoorUnitAccessory {
  private service: Service;
  private sendDeviceUpdatePayload: ComfortCloudDeviceUpdatePayload = {};
  private timers: { [key: string]: NodeJS.Timeout | null } = {};
  private devConfig: any;
  private deviceStatus?: ComfortCloudDeviceStatus['parameters']; // Made optional with ?

  constructor(
    private readonly platform: PanasonicPlatform,
    private readonly accessory: PlatformAccessory<PanasonicAccessoryContext>,
  ) {
    this.devConfig = this.platform.platformConfig.devices?.find(
      item => item.name === (accessory.context.device?.deviceName || accessory.context.device?.deviceGuid),
    );

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Panasonic')
      .setCharacteristic(this.platform.Characteristic.Model, accessory.context.device?.deviceModuleNumber || 'Unknown')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device?.deviceGuid || 'Unknown');

    this.service = this.accessory.getService(this.platform.Service.HeaterCooler)
      || this.accessory.addService(this.platform.Service.HeaterCooler);
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device?.deviceName || 'Unnamed');

    this.setupCharacteristic('Active', this.setActive.bind(this), { minValue: 0, maxValue: 1 });
    this.setupCharacteristic('CurrentTemperature', null, { minValue: -100, maxValue: 100, minStep: 0.01 });
    this.setupCharacteristic('TargetHeaterCoolerState', this.setTargetHeaterCoolerState.bind(this));
    this.setupCharacteristic('RotationSpeed', this.setRotationSpeed.bind(this), { minValue: 0, maxValue: 8, minStep: 1 });
    this.setupCharacteristic('SwingMode', this.setSwingMode.bind(this));
    this.setupCharacteristic('CoolingThresholdTemperature', this.setThresholdTemperature.bind(this),
      { minValue: 16, maxValue: 30, minStep: 0.5 });
    this.setupCharacteristic('HeatingThresholdTemperature', this.setThresholdTemperature.bind(this),
      { minValue: this.devConfig?.minHeatingTemperature || 16, maxValue: 30, minStep: 0.5 });

    this.setupOptionalService('exposeInsideTemp', this.platform.Service.TemperatureSensor, 'inside temp');
    this.setupOptionalService('exposeOutdoorTemp', this.platform.Service.TemperatureSensor, 'out temp');
    this.setupOptionalService('exposePower', this.platform.Service.Switch, 'power', this.setPower.bind(this));
    this.setupOptionalService('exposeNanoe', this.platform.Service.Switch, 'nanoe', this.setNanoe.bind(this));
    this.setupOptionalService('exposeInsideCleaning', this.platform.Service.Switch, 'inside cleaning',
      this.setInsideCleaning.bind(this));
    this.setupOptionalService('exposeEcoNavi', this.platform.Service.Switch, 'eco navi', this.setEcoNavi.bind(this));
    this.setupOptionalService('exposeEcoFunction', this.platform.Service.Switch, 'eco function',
      this.setEcoFunction.bind(this));
    this.setupOptionalService('exposeAutoMode', this.platform.Service.Switch, 'auto mode', this.setAutoMode.bind(this));
    this.setupOptionalService('exposeCoolMode', this.platform.Service.Switch, 'cool mode', this.setCoolMode.bind(this));
    this.setupOptionalService('exposeHeatMode', this.platform.Service.Switch, 'heat mode', this.setHeatMode.bind(this));
    this.setupOptionalService('exposeDryMode', this.platform.Service.Switch, 'dry mode', this.setDryMode.bind(this));
    this.setupOptionalService('exposeFanMode', this.platform.Service.Switch, 'fan mode', this.setFanMode.bind(this));
    this.setupOptionalService('exposeNanoeStandAloneMode', this.platform.Service.Switch, 'nanoe stand alone mode',
      this.setNanoeStandAloneMode.bind(this));
    this.setupOptionalService('exposeQuietMode', this.platform.Service.Switch, 'quiet mode',
      this.setQuietMode.bind(this));
    this.setupOptionalService('exposePowerfulMode', this.platform.Service.Switch, 'powerful mode',
      this.setPowerfulMode.bind(this));
    this.setupOptionalService('exposeSwingUpDown', this.platform.Service.Switch, 'swing up down',
      this.setSwingUpDown.bind(this));
    this.setupOptionalService('exposeSwingLeftRight', this.platform.Service.Switch, 'swing left right',
      this.setSwingLeftRight.bind(this));
    this.setupOptionalService('exposeFanSpeed', this.platform.Service.Fan, 'fan speed', this.setFanSpeed.bind(this), true);

    this.refreshDeviceStatus();
  }

  private setupCharacteristic(
    name: string,
    onSet: ((value: CharacteristicValue, callback?: CharacteristicSetCallback) => void | Promise<void>) | null,
    props?: any
  ) {
    const char = this.service.getCharacteristic(this.platform.Characteristic[name]);
    if (props) {
      char.setProps(props);
    }
    if (onSet) {
      char.onSet(onSet);
    }
  }

  private setupOptionalService(
    configKey: string,
    serviceType: any,
    nameSuffix: string,
    onSet?: (value: CharacteristicValue, callback?: CharacteristicSetCallback) => void | Promise<void>,
    isFan = false
  ) {
    const serviceName = `${this.accessory.displayName} ${nameSuffix}`;
    if (this.devConfig?.[configKey]) {
      const service = this.accessory.getService(serviceName) || 
        this.accessory.addService(serviceType, serviceName, configKey);
      service.setCharacteristic(this.platform.Characteristic.ConfiguredName, serviceName);
      if (onSet) {
        service.getCharacteristic(this.platform.Characteristic.On).onSet(onSet);
        if (isFan) {
          service.getCharacteristic(this.platform.Characteristic.RotationSpeed).onSet(onSet);
        }
      }
    } else {
      const service = this.accessory.getService(serviceName);
      if (service) {
        this.accessory.removeService(service);
      }
    }
  }

  async refreshDeviceStatus() {
    try {
      const statusResponse: ComfortCloudDeviceStatus = await this.platform.comfortCloud.getDeviceStatus(
        this.accessory.context.device.deviceGuid,
        this.accessory.displayName
      );
      this.deviceStatus = statusResponse.parameters;

      this.updateCharacteristic('Active', this.deviceStatus.operate === 1 ? 1 : 0);
      const insideTemp = this.deviceStatus.insideTemperature < 126 
        ? this.deviceStatus.insideTemperature 
        : (this.deviceStatus.operationMode === 3 ? 8 : 30);
      this.updateCharacteristic('CurrentTemperature', insideTemp);
      this.updateOptional('exposeInsideTemp', 'CurrentTemperature', 
        this.deviceStatus.insideTemperature < 126 ? this.deviceStatus.insideTemperature : null);
      this.updateOptional('exposeOutdoorTemp', 'CurrentTemperature', 
        this.deviceStatus.outTemperature < 126 ? this.deviceStatus.outTemperature : null);

      const currentTemp = this.service.getCharacteristic(
        this.platform.Characteristic.CurrentTemperature).value as number;
      const setTemp = this.deviceStatus.temperatureSet;
      this.updateHeaterCoolerState(this.deviceStatus.operationMode, currentTemp, setTemp);

      if (this.deviceStatus.operate === 1) {
        this.updateRotationSpeed();
      }
      this.updateCharacteristic('SwingMode', this.deviceStatus.fanAutoMode !== 1 ? 1 : 0);
      this.updateOptional('exposePower', 'On', this.deviceStatus.operate === 1);
      this.updateOptional('exposeNanoe', 'On', this.deviceStatus.nanoe === 2);
      this.updateOptional('exposeInsideCleaning', 'On', this.deviceStatus.insideCleaning === 2);
      this.updateOptional('exposeEcoNavi', 'On', this.deviceStatus.ecoNavi === 2);
      this.updateOptional('exposeEcoFunction', 'On', this.deviceStatus.ecoFunctionData === 2);
      this.updateOptional('exposeAutoMode', 'On', 
        this.deviceStatus.operate === 1 && this.deviceStatus.operationMode === 0);
      this.updateOptional('exposeCoolMode', 'On', 
        this.deviceStatus.operate === 1 && this.deviceStatus.operationMode === 2);
      this.updateOptional('exposeHeatMode', 'On', 
        this.deviceStatus.operate === 1 && this.deviceStatus.operationMode === 3);
      this.updateOptional('exposeDryMode', 'On', 
        this.deviceStatus.operate === 1 && this.deviceStatus.operationMode === 1);
      this.updateOptional('exposeFanMode', 'On', 
        this.deviceStatus.operate === 1 && 
        this.deviceStatus.operationMode === 4 && 
        this.deviceStatus.lastSettingMode === 1);
      this.updateOptional('exposeNanoeStandAloneMode', 'On', 
        this.deviceStatus.operate === 1 && 
        this.deviceStatus.operationMode === 4 && 
        this.deviceStatus.lastSettingMode === 2);
      this.updateOptional('exposeQuietMode', 'On', 
        this.deviceStatus.operate === 1 && this.deviceStatus.ecoMode === 2);
      this.updateOptional('exposePowerfulMode', 'On', 
        this.deviceStatus.operate === 1 && this.deviceStatus.ecoMode === 1);
      this.updateOptional('exposeSwingUpDown', 'On', 
        [0, 2].includes(this.deviceStatus.fanAutoMode));
      this.updateOptional('exposeSwingLeftRight', 'On', 
        [0, 3].includes(this.deviceStatus.fanAutoMode));
      this.updateFanSpeed();

      this.service.updateCharacteristic(
        this.platform.Characteristic.HeatingThresholdTemperature, setTemp);
      this.service.updateCharacteristic(
        this.platform.Characteristic.CoolingThresholdTemperature, setTemp);

      this.scheduleRefresh();
    } catch (error) {
      this.platform.log.error('Error refreshing status:', error);
    }
  }

  private updateCharacteristic(name: string, value: any) {
    this.service.updateCharacteristic(this.platform.Characteristic[name], value);
  }

  private updateOptional(configKey: string, charName: string, value: any) {
    if (this.devConfig?.[configKey] && value !== null) {
      const serviceName = `${this.accessory.displayName} ${configKey.split('expose')[1].toLowerCase()}`;
      this.accessory.getService(serviceName)?.updateCharacteristic(
        this.platform.Characteristic[charName], value);
    }
  }

  private updateHeaterCoolerState(mode: number, currentTemp: number, setTemp: number) {
    const states = {
      0: [this.platform.Characteristic.TargetHeaterCoolerState.AUTO, 
        currentTemp < setTemp ? 1 : currentTemp > setTemp ? 2 : 0],
      2: [this.platform.Characteristic.TargetHeaterCoolerState.COOL, 
        currentTemp > setTemp ? 2 : 0],
      3: [this.platform.Characteristic.TargetHeaterCoolerState.HEAT, 
        currentTemp < setTemp ? 1 : 0],
      1: [this.platform.Characteristic.TargetHeaterCoolerState.AUTO, 0], // Dry mode
      4: [this.platform.Characteristic.TargetHeaterCoolerState.AUTO, 0], // Fan mode
    };
    const [target, current] = states[mode] || [0, 0];
    this.updateCharacteristic('TargetHeaterCoolerState', target);
    this.updateCharacteristic('CurrentHeaterCoolerState', current);
  }

  private updateRotationSpeed() {
    if (!this.deviceStatus) return;
    let speed = 8; // Auto
    if (this.deviceStatus.ecoMode === 2) {
      speed = 1; // Quiet
    } else if (this.deviceStatus.ecoMode === 1) {
      speed = 7; // Powerful
    } else {
      const speedMap = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 0: 8 };
      speed = speedMap[this.deviceStatus.fanSpeed] || 8;
    }
    this.updateCharacteristic('RotationSpeed', speed);
  }

  private updateFanSpeed() {
    if (!this.deviceStatus) return;
    if (this.devConfig?.exposeFanSpeed && this.deviceStatus.operate === 1) {
      const fanService = this.accessory.getService(`${this.accessory.displayName} fan speed`);
      fanService?.updateCharacteristic(this.platform.Characteristic.On, true);
      const fanSpeedValue = this.deviceStatus.fanSpeed === 0 ? 100 : 
        this.deviceStatus.fanSpeed * 20 - 10;
      fanService?.updateCharacteristic(this.platform.Characteristic.RotationSpeed, fanSpeedValue);
    } else {
      this.updateOptional('exposeFanSpeed', 'On', false);
      this.updateOptional('exposeFanSpeed', 'RotationSpeed', 0);
    }
  }

  private scheduleRefresh() {
    this.clearTimer('timerRefreshDeviceStatus');
    const isActive = this.service.getCharacteristic(this.platform.Characteristic.Active).value;
    this.timers.timerRefreshDeviceStatus = setTimeout(
      this.refreshDeviceStatus.bind(this),
      isActive ? 10 * 60 * 1000 : 60 * 60 * 1000
    );
  }

  private clearTimer(key: string) {
    if (this.timers[key]) {
      clearTimeout(this.timers[key]!);
      this.timers[key] = null;
    }
  }

  async setActive(value: CharacteristicValue, callback?: CharacteristicSetCallback) {
    await this.sendDeviceUpdate({ operate: value === 1 ? 1 : 0 });
    callback?.();
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue, callback?: CharacteristicSetCallback) {
    const modes = {
      [this.platform.Characteristic.TargetHeaterCoolerState.AUTO]: 
        this.platform.platformConfig.autoMode === 'fan' ? 4 : 
        this.platform.platformConfig.autoMode === 'dry' ? 1 : 0,
      [this.platform.Characteristic.TargetHeaterCoolerState.COOL]: 2,
      [this.platform.Characteristic.TargetHeaterCoolerState.HEAT]: 3,
    };
    await this.sendDeviceUpdate({ operate: 1, operationMode: modes[value as number] });
    callback?.();
  }

  async setRotationSpeed(value: CharacteristicValue, callback?: CharacteristicSetCallback) {
    const v = value as number;
    const params: ComfortCloudDeviceUpdatePayload = v === 1 ? { ecoMode: 2 } : 
      v === 7 ? { ecoMode: 1 } : 
      { ecoMode: 0, fanSpeed: { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 0 }[v] || 0 };
    await this.sendDeviceUpdate(params);
    callback?.();
  }

  async setSwingMode(value: CharacteristicValue, callback?: CharacteristicSetCallback) {
    await this.sendDeviceUpdate({
      fanAutoMode: value === 1 ? 0 : 1,
      ...(value === 0 && { 
        airSwingUD: this.devConfig?.swingDefaultUD ?? 2, 
        airSwingLR: this.devConfig?.swingDefaultLR ?? 2 
      })
    });
    callback?.();
  }

  async setPower(value: CharacteristicValue, callback?: CharacteristicSetCallback) { 
    await this.sendDeviceUpdate({ operate: value ? 1 : 0 }); 
    callback?.(); 
  }
  
  async setNanoe(value: CharacteristicValue, callback?: CharacteristicSetCallback) { 
    await this.sendDeviceUpdate({ nanoe: value ? 2 : 1 }); 
    callback?.(); 
  }
  
  async setInsideCleaning(value: CharacteristicValue, callback?: CharacteristicSetCallback) { 
    await this.sendDeviceUpdate({ insideCleaning: value ? 2 : 1 }); 
    callback?.(); 
  }
  
  async setEcoNavi(value: CharacteristicValue, callback?: CharacteristicSetCallback) { 
    await this.sendDeviceUpdate({ ecoNavi: value ? 2 : 1 }); 
    callback?.(); 
  }
  
  async setEcoFunction(value: CharacteristicValue, callback?: CharacteristicSetCallback) { 
    await this.sendDeviceUpdate({ ecoFunctionData: value ? 2 : 1 }); 
    callback?.(); 
  }
  
  async setAutoMode(value: CharacteristicValue, callback?: CharacteristicSetCallback) { 
    await this.sendDeviceUpdate({ 
      operate: value ? 1 : 0, 
      operationMode: value ? 0 : undefined 
    }); 
    callback?.(); 
  }
  
  async setCoolMode(value: CharacteristicValue, callback?: CharacteristicSetCallback) { 
    await this.sendDeviceUpdate({ 
      operate: value ? 1 : 0, 
      operationMode: value ? 2 : undefined 
    }); 
    callback?.(); 
  }
  
  async setHeatMode(value: CharacteristicValue, callback?: CharacteristicSetCallback) { 
    await this.sendDeviceUpdate({ 
      operate: value ? 1 : 0, 
      operationMode: value ? 3 : undefined 
    }); 
    callback?.(); 
  }
  
  async setDryMode(value: CharacteristicValue, callback?: CharacteristicSetCallback) { 
    await this.sendDeviceUpdate({ 
      operate: value ? 1 : 0, 
      operationMode: value ? 1 : undefined 
    }); 
    callback?.(); 
  }
  
  async setFanMode(value: CharacteristicValue, callback?: CharacteristicSetCallback) { 
    await this.sendDeviceUpdate({ 
      operate: value ? 1 : 0, 
      operationMode: value ? 4 : undefined 
    }); 
    callback?.(); 
  }
  
  async setNanoeStandAloneMode(value: CharacteristicValue, callback?: CharacteristicSetCallback) { 
    await this.sendDeviceUpdate({ 
      operate: value ? 1 : 0, 
      operationMode: value ? 5 : undefined 
    }); 
    callback?.(); 
  }
  
  async setQuietMode(value: CharacteristicValue, callback?: CharacteristicSetCallback) { 
    await this.sendDeviceUpdate({ ecoMode: value ? 2 : 0 }); 
    callback?.(); 
  }
  
  async setPowerfulMode(value: CharacteristicValue, callback?: CharacteristicSetCallback) { 
    await this.sendDeviceUpdate({ ecoMode: value ? 1 : 0 }); 
    callback?.(); 
  }
  
  async setSwingUpDown(value: CharacteristicValue, callback?: CharacteristicSetCallback) {
    if (!this.deviceStatus) return;
    await this.sendDeviceUpdate({
      fanAutoMode: value ? (this.deviceStatus.fanAutoMode === 3 ? 0 : 2) : 
        (this.deviceStatus.fanAutoMode === 0 ? 3 : 1),
      ...(!value && { airSwingUD: this.devConfig?.swingDefaultUD ?? 2 })
    });
    callback?.();
  }
  
  async setSwingLeftRight(value: CharacteristicValue, callback?: CharacteristicSetCallback) {
    if (!this.deviceStatus) return;
    await this.sendDeviceUpdate({
      fanAutoMode: value ? (this.deviceStatus.fanAutoMode === 2 ? 0 : 3) : 
        (this.deviceStatus.fanAutoMode === 0 ? 2 : 1),
      ...(!value && { airSwingLR: this.devConfig?.swingDefaultLR ?? 2 })
    });
    callback?.();
  }
  
  async setFanSpeed(value: CharacteristicValue, callback?: CharacteristicSetCallback) {
    const v = value as number;
    const params: ComfortCloudDeviceUpdatePayload = v === 0 ? { operate: 0 } : {
      ecoMode: 0,
      fanSpeed: v <= 20 ? 1 : v <= 40 ? 2 : v <= 60 ? 3 : v <= 80 ? 4 : v < 100 ? 5 : 0
    };
    await this.sendDeviceUpdate(params);
    callback?.();
  }

  async setThresholdTemperature(value: CharacteristicValue, callback?: CharacteristicSetCallback) {
    await this.sendDeviceUpdate({ temperatureSet: value as number });
    callback?.();
  }

  async sendDeviceUpdate(payload: ComfortCloudDeviceUpdatePayload) {
    try {
      this.sendDeviceUpdatePayload = { ...this.sendDeviceUpdatePayload, ...payload };
      this.clearTimer('timerSendDeviceUpdate');
      if (Object.keys(this.sendDeviceUpdatePayload).length) {
        this.timers.timerSendDeviceUpdate = setTimeout(async () => {
          if (this.deviceStatus?.operate === 0 && 
              this.sendDeviceUpdatePayload.operate === 1 &&
              !('fanSpeed' in this.sendDeviceUpdatePayload) && 
              !('ecoMode' in this.sendDeviceUpdatePayload)) {
            const speed = this.service.getCharacteristic(
              this.platform.Characteristic.RotationSpeed).value as number;
            const speedParams = { 1: { ecoMode: 2 }, 7: { ecoMode: 1 } }[speed] || 
              { ecoMode: 0, fanSpeed: [2, 3, 4, 5, 6].includes(speed) ? speed - 1 : 0 };
            this.sendDeviceUpdatePayload = { ...this.sendDeviceUpdatePayload, ...speedParams };
          }
          await this.platform.comfortCloud.setDeviceStatus(
            this.accessory.context.device.deviceGuid,
            this.accessory.displayName,
            this.sendDeviceUpdatePayload
          );
          this.sendDeviceUpdatePayload = {};
          this.clearTimer('timerSendDeviceUpdateRefresh');
          this.timers.timerSendDeviceUpdateRefresh = setTimeout(
            this.refreshDeviceStatus.bind(this), 7500);
        }, 2500);
      }
    } catch (error) {
      this.platform.log.error('Error sending update:', error);
    }
  }
}

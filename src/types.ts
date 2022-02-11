import { PlatformConfig } from 'homebridge';

export interface PanasonicPlatformConfig extends PlatformConfig {
  email: string;
  password: string;
  debugMode: boolean;
  appVersionOverride: string;
  exposeOutdoorUnit: boolean;
  minHeatingTemperature?: number;
}

export interface PanasonicAccessoryContext {
  device: ComfortCloudDevice;
}

// Login
// POST https://accsmart.panasonic.com/auth/login
export interface ComfortCloudAuthResponse {
  code: number;
  message: string;
  uToken: string;
  result: number;
  country: string; // e.g. 'GB'
  clientId: string;
  language: number;
}

// Fetch devices
// GET https://accsmart.panasonic.com/device/group
export interface ComfortCloudGroupResponse {
  iaqStatus: {
    statusCode: number;
  };
  uiFlg: boolean;
  groupCount: number;
  groupList: ComfortCloudDeviceList[];
}

export interface ComfortCloudDeviceList {
  deviceList: ComfortCloudDevice[];
}

export interface ComfortCloudDevice {
  deviceGuid: string;
  deviceType: string;
  deviceName: string;
  permission: number;
  deviceModuleNumber: string;
  deviceHashGuid: string;
  summerHouse: number;
  iAutoX: boolean;
  nanoe: boolean;
  nanoeStandAlone: boolean;
  autoMode: boolean;
  heatMode: boolean;
  fanMode: boolean;
  dryMode: boolean;
  coolMode: boolean;
  ecoNavi: boolean;
  powerfulMode: boolean;
  quietMode: boolean;
  airSwingLR: boolean;
  autoSwingUD: boolean;
  ecoFunction: number;
  temperatureUnit: number;
  modeAvlList: {
    autoMode: number;
    fanMode: number;
  };
  coordinableFlg: boolean;
  parameters: {
    operate: number;
    operationMode: number;
    temperatureSet: number;
    fanSpeed: number;
    fanAutoMode: number;
    airSwingLR: number;
    airSwingUD: number;
    ecoMode: number;
    ecoNavi: number;
    nanoe: number;
    iAuto: number;
    actualNanoe: number;
    airDirection: number;
    ecoFunctionData: number;
    lastSettingMode: number;
  };
}

// Get device status
// GET https://accsmart.panasonic.com/deviceStatus/now/DEVICE_GUID
export interface ComfortCloudDeviceStatusResponse {
  parameters: ComfortCloudDeviceStatus;
}

export interface ComfortCloudDeviceStatus {
  insideTemperature: number;
  temperatureSet: number;
  outTemperature: number;
  operate: number;
  operationMode: number;
  fanSpeed: number;
  airSwingLR: number;
  airSwingUD: number;
  temperatureUnit: string;
}

// Set device status
// POST https://accsmart.panasonic.com/deviceStatus/control
export interface ComfortCloudDeviceUpdatePayload {
  operate?: number;
  operationMode?: number;
  fanSpeed?: number;
  fanAutoMode?: number;
  airSwingLR?: number;
  airSwingUD?: number;
  temperatureSet?: number;
}

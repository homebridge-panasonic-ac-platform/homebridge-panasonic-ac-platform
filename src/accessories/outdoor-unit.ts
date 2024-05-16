import { Service, PlatformAccessory } from 'homebridge';
import PanasonicPlatform from '../platform';

export default class OutdoorUnitAccessory {
  private service: Service;

  constructor(
    private readonly platform: PanasonicPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // Accessory Information
    // https://developers.homebridge.io/#/service/AccessoryInformation

    // Generate random number for virtual serial number
    const uniqueId = (Date.now().toString(9) + Math.floor(Math.random()).toString(9)).substring(1, 11);
    
    this.accessory.getService(this.platform.Service.AccessoryInformation)
      ?.setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        'Panasonic Comfort Cloud',
      )
      .setCharacteristic(
        this.platform.Characteristic.Model,
        'Virtual Outdoor Unit',
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        uniqueId,
      );

    // Temperature Sensor
    // https://developers.homebridge.io/#/service/TemperatureSensor
    this.service = this.accessory.getService(this.platform.Service.TemperatureSensor)
      || this.accessory.addService(this.platform.Service.TemperatureSensor);

    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      'Panasonic Outdoor Unit',
    );
  }

  setOutdoorTemperature(temperature: number) {
    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentTemperature, temperature);
  }
}

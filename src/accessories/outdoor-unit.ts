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
    this.accessory.getService(this.platform.Service.AccessoryInformation)
      ?.setCharacteristic(this.platform.Characteristic.Manufacturer, 'Panasonic')
      .setCharacteristic(this.platform.Characteristic.Model, 'Generic Outdoor Unit')
      .setCharacteristic(this.platform.Characteristic.SerialNumber,
        'HB-PACP-DummyOutdoorSerialNumber');

    // Temperature Sensor
    // https://developers.homebridge.io/#/service/TemperatureSensor
    this.service = this.accessory.getService(this.platform.Service.TemperatureSensor)
      || this.accessory.addService(this.platform.Service.TemperatureSensor);

    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      'Panasonic AC Outdoor Unit',
    );
  }

  setOutdoorTemperature(temperature: number) {
    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentTemperature, temperature);
  }
}

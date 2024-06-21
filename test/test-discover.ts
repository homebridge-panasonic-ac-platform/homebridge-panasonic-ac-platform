import { Logger } from 'homebridge';
import PanasonicPlatform from '../src/platform';
import config from './config';
import { HomebridgeAPI } from 'homebridge/lib/api';

// we are abusing console as logger here
const platform = new PanasonicPlatform(
  console as unknown as Logger,
  config,
  new HomebridgeAPI,
);

platform.loginAndDiscoverDevices();

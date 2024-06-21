import { Logger } from 'homebridge';
import ComfortCloudApi from '../src/comfort-cloud';
import PanasonicPlatformLogger from '../src/logger';
import config from './config';

// fake a logger: We are just usign console as logger
const logger = new PanasonicPlatformLogger(
  console as unknown as Logger,
  2,
);

const api = new ComfortCloudApi(
  config,
  logger,
);

api.login().then(() => {
  api.refreshToken();
});


import { Logger } from 'homebridge';

/**
 * Decorates the Homebridge logger to only log debug messages when debug mode is enabled.
 */
export default class PanasonicPlatformLogger {
  constructor(
    private readonly logger: Logger,
    private readonly logsLevel: int,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug(...messages: any[]) {
    if (this.logsLevel === 2) {
      for (let i = 0; i < messages.length; i++) {
        this.logger.debug(messages[i]);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info(...messages: any[]) {
    if (this.logsLevel >= 1) {
      for (let i = 0; i < messages.length; i++) {
        this.logger.info(messages[i]);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error(...messages: any[]) {
    for (let i = 0; i < messages.length; i++) {
      this.logger.error(messages[i]);
    }
  }
}

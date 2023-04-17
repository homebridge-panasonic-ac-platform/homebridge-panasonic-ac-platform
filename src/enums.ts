export enum ComfortCloudEcoMode {
  AutoOrManual = 0,
  Powerful = 1,
  Quiet = 2
}

export enum ComfortCloudFanSpeed {
  Auto = 0,
  One = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
}

export enum ComfortCloudFanAutoMode {
  Disabled = 1,
  AirSwingAuto = 0,
  AirSwingLR = 3,
  AirSwingUD = 2,
}

export enum ComfortCloudAirSwingUD {
  Up = 0,
  CenterUp = 3,
  Center = 2,
  CenterDown = 4,
  Down = 1,
}

export enum ComfortCloudAirSwingLR {
  Left = 1,
  CenterLeft = 5,
  Center = 2,
  CenterRight = 4,
  Right = 0,
}

// Has to match the 'swingModeDirections'
// dropdown values in config.schema.json.
// Otherwise, the plugin setting will be ignored.
export enum SwingModeDirection {
  LeftRightAndUpDown = 'LEFT-RIGHT-UP-DOWN',
  LeftRightOnly = 'LEFT-RIGHT',
  UpDownOnly = 'UP-DOWN',
}

// Has to match the 'swingModeDefaultPositionUpDown'
// dropdown values in config.schema.json.
// Otherwise, the plugin setting will be ignored.
export enum SwingModePositionUpDown {
  Up = 'UP',
  CenterUp = 'CENTER-UP',
  Center = 'CENTER',
  CenterDown = 'CENTER-DOWN',
  Down = 'DOWN',
}

// Has to match the 'swingModeDefaultPositionLeftRight'
// dropdown values in config.schema.json.
// Otherwise, the plugin setting will be ignored.
export enum SwingModePositionLeftRight {
  Left = 'LEFT',
  CenterLeft = 'CENTER-LEFT',
  Center = 'CENTER',
  CenterRight = 'CENTER-RIGHT',
  Right = 'RIGHT',
}

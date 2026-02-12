export const SimConfig = {
  // FLL Table Configuration according to official rules
  fllTable: {
    // Mat (usable area)
    matWidth: 1.22,  // Official FLL: 1.22m -> X axis
    matLength: 2.44, // Official FLL: 2.44m -> Z axis (2:1 ratio)
    // Table base (slightly larger than mat)
    tableColor: 0xf1f5f9, // slate-100
    // Border walls (new standard)
    borderHeight: 0.08,
    borderThickness: 0.04,
    borderColor: 0x334155, // slate-700
  },
  // Robot Physical Properties
  robot: {
    width: 0.14,
    height: 0.08,
    depth: 0.14,
    wheelRadius: 0.028,
    wheelWidth: 0.02,
    wheelBase: 0.13,
    mass: 1.0,
    maxSpeed: 0.5 
  },
  // Sensor Offsets relative to robot center
  sensors: {
    color: { x: 0, y: -0.03, z: 0.06 }, 
    distance: { x: 0, y: 0.02, z: 0.07 }
  },
  physicsTickRate: 60,
  colors: {
    background: 0x0f172a,   // Dark Engineering Blue
    robotBody: 0xfacc15,    // SPIKE Yellow
    robotAccent: 0xffffff,
    robotBlack: 0x111111,
    robotGrey: 0x333333,
    robotBlue: 0x4C97FF
  }
} as const;

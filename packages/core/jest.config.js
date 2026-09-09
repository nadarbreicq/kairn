/** Config Jest du module d'analyse — voir jest.config.js des autres paquets pour la même logique. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.ts'],
};

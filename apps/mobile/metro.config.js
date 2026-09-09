// Configuration Metro pour un monorepo npm workspaces : @kairn/core vit hors
// de apps/mobile, donc Metro doit aussi surveiller et résoudre depuis la
// racine du dépôt. Motif documenté par Expo pour les monorepos.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;

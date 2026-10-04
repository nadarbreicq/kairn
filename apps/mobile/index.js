/**
 * Point d'entrée explicite plutôt que le "main": "node_modules/expo/AppEntry.js"
 * par défaut d'Expo, qui suppose une installation locale — dans ce monorepo
 * npm workspaces, `expo` est hissé à la racine, ce chemin littéral n'existe
 * donc pas ici. `registerRootComponent` reste résolu normalement.
 */
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);

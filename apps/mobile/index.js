/**
 * Point d'entrée explicite plutôt que le "main": "node_modules/expo/AppEntry.js"
 * par défaut d'Expo, qui suppose une installation locale — dans ce monorepo
 * npm workspaces, `expo` est hissé à la racine, ce chemin littéral n'existe
 * donc pas ici. `registerRootComponent` reste résolu normalement.
 */
import { registerRootComponent } from 'expo';
// Déclare la tâche de suivi GPS avant tout rendu : Android peut relancer le
// service d'enregistrement sans ouvrir d'écran (voir location.expo.ts).
import './src/services/location.expo';
import App from './App';

registerRootComponent(App);

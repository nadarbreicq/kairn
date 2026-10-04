/**
 * Fuseau horaire fixe pour toute la suite : les tests d'affichage en heure
 * locale (formatClock, noms de séance, noms de fichiers) doivent donner le
 * même résultat sur un poste à Paris et sur un serveur de CI en UTC.
 * Fixé ici, avant le lancement des processus de test qui en héritent :
 * changer TZ en cours de test n'est pas pris en compte de façon fiable.
 */
module.exports = async () => {
  process.env.TZ = 'Europe/Paris';
};

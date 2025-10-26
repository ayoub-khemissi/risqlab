import Database from '../lib/database.js';
import log from '../lib/log.js';

/**
 * Script de diagnostic pour vérifier la configuration de la volatilité
 */
async function checkVolatilitySetup() {
  try {
    log.info('='.repeat(60));
    log.info('DIAGNOSTIC DE LA VOLATILITÉ');
    log.info('='.repeat(60));

    // 1. Vérifier que les tables existent
    log.info('\n[1] Vérification des tables...');
    const tables = [
      'crypto_log_returns',
      'crypto_volatility',
      'portfolio_volatility',
      'portfolio_volatility_constituents'
    ];

    for (const table of tables) {
      try {
        const [rows] = await Database.execute(`SELECT COUNT(*) as count FROM ${table}`);
        const count = rows[0].count;
        log.info(`  ✓ ${table}: ${count} enregistrements`);
      } catch (error) {
        log.error(`  ✗ ${table}: Table n'existe pas ou erreur - ${error.message}`);
      }
    }

    // 2. Vérifier les données de marché disponibles
    log.info('\n[2] Vérification des données de marché...');
    const [marketDataStats] = await Database.execute(`
      SELECT
        COUNT(DISTINCT crypto_id) as num_cryptos,
        COUNT(DISTINCT DATE(timestamp)) as num_days,
        MIN(DATE(timestamp)) as first_date,
        MAX(DATE(timestamp)) as last_date
      FROM market_data
    `);

    if (marketDataStats.length > 0) {
      const stats = marketDataStats[0];
      log.info(`  Cryptos avec données: ${stats.num_cryptos}`);
      log.info(`  Jours de données: ${stats.num_days}`);
      log.info(`  Première date: ${stats.first_date}`);
      log.info(`  Dernière date: ${stats.last_date}`);

      if (stats.num_days < 90) {
        log.warn(`  ⚠ ATTENTION: Seulement ${stats.num_days} jours de données disponibles.`);
        log.warn(`  ⚠ Il faut au moins 90 jours pour calculer la volatilité.`);
      } else {
        log.info(`  ✓ Suffisamment de données pour calculer la volatilité (>= 90 jours)`);
      }
    }

    // 3. Vérifier l'index RisqLab 80
    log.info('\n[3] Vérification de l\'index RisqLab 80...');
    const [indexHistory] = await Database.execute(`
      SELECT
        COUNT(*) as count,
        MIN(DATE(timestamp)) as first_date,
        MAX(DATE(timestamp)) as last_date
      FROM index_history ih
      INNER JOIN index_config ic ON ih.index_config_id = ic.id
      WHERE ic.index_name = 'RisqLab 80'
    `);

    if (indexHistory.length > 0 && indexHistory[0].count > 0) {
      log.info(`  ✓ Index calculé: ${indexHistory[0].count} points de données`);
      log.info(`  Première date: ${indexHistory[0].first_date}`);
      log.info(`  Dernière date: ${indexHistory[0].last_date}`);
    } else {
      log.warn(`  ⚠ Index RisqLab 80 non calculé`);
    }

    // 4. Vérifier la volatilité du portfolio
    log.info('\n[4] Vérification de la volatilité du portfolio...');
    const [portfolioVol] = await Database.execute(`
      SELECT
        pv.*,
        ic.index_name
      FROM portfolio_volatility pv
      INNER JOIN index_config ic ON pv.index_config_id = ic.id
      WHERE ic.index_name = 'RisqLab 80'
      ORDER BY pv.date DESC
      LIMIT 1
    `);

    if (portfolioVol.length > 0) {
      const vol = portfolioVol[0];
      log.info(`  ✓ Volatilité calculée !`);
      log.info(`  Date: ${vol.date}`);
      log.info(`  Volatilité annualisée: ${(parseFloat(vol.annualized_volatility) * 100).toFixed(2)}%`);
      log.info(`  Nombre de constituants: ${vol.num_constituents}`);
      log.info(`  Fenêtre: ${vol.window_days} jours`);
    } else {
      log.warn(`  ✗ Aucune volatilité calculée`);
      log.info(`  → Exécutez: npm run update-volatility`);
    }

    // 5. Test de l'API endpoint
    log.info('\n[5] Structure de réponse API simulée...');
    if (portfolioVol.length > 0) {
      log.info(`  GET /volatility/portfolio retournerait:`);
      log.info(`  {`);
      log.info(`    data: {`);
      log.info(`      latest: { ...données },`);
      log.info(`      history: [ ...array ]`);
      log.info(`    }`);
      log.info(`  }`);
      log.info(`  ✓ La jauge devrait s'afficher sur le frontend`);
    } else {
      log.warn(`  ✗ Pas de données à retourner`);
      log.warn(`  ✗ La jauge ne s'affichera PAS`);
    }

    // Résumé
    log.info('\n' + '='.repeat(60));
    log.info('RÉSUMÉ');
    log.info('='.repeat(60));

    const marketDays = marketDataStats[0]?.num_days || 0;
    const hasVolatility = portfolioVol.length > 0;

    if (!hasVolatility) {
      log.warn('\n⚠ LA JAUGE DE VOLATILITÉ NE S\'AFFICHERA PAS');
      log.info('\nÉtapes à suivre:');

      if (marketDays < 90) {
        log.info('1. Attendre d\'avoir au moins 90 jours de données de marché');
        log.info('   (actuellement: ' + marketDays + ' jours)');
        log.info('2. OU importer des données historiques');
      } else {
        log.info('1. Exécuter: npm run update-volatility');
        log.info('2. Vérifier les logs pour les erreurs');
        log.info('3. Rafraîchir le frontend');
      }
    } else {
      log.info('\n✓ TOUT EST CONFIGURÉ CORRECTEMENT');
      log.info('  La jauge devrait être visible sur le frontend');
      log.info('  Si elle n\'apparaît pas, vérifiez:');
      log.info('  - Que le backend est démarré');
      log.info('  - Que le frontend appelle bien l\'API');
      log.info('  - La console du navigateur pour les erreurs');
    }

  } catch (error) {
    log.error(`Erreur lors du diagnostic: ${error.message}`);
    log.error(error.stack);
  } finally {
    process.exit(0);
  }
}

checkVolatilitySetup();

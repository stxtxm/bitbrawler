# Migration des Scripts vers Supabase

Les scripts (`bot-engine.ts` et `daily-reset-engine.ts`) utilisent Firebase Admin SDK. Pour Supabase, nous devons utiliser l'API serveur de Supabase.

## Configuration requise

### 1. Configurer les variables d'environnement

Créez un fichier `.env` pour les scripts avec :

```env
SUPABASE_URL=votre_url_supabase
SUPABASE_SERVICE_ROLE_KEY=votre_clé_service_role
```

⚠️ **Important** : La clé `SUPABASE_SERVICE_ROLE_KEY` est différente de la clé anonyme. Vous la trouverez dans :
- Tableau de bord Supabase → Settings → API → Project API keys → `service_role` key

### 2. Installer le client Supabase pour Node.js

```bash
npm install @supabase/supabase-js
```

## Adaptation du bot-engine.ts

Remplacez l'import Firebase Admin par :

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
```

### Exemples de conversion des requêtes

#### Lecture de personnages
```typescript
// Avant (Firebase)
const snapshot = await db.collection('characters').where('level', '==', level).get();

// Après (Supabase)
const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('level', level);
```

#### Mise à jour d'un personnage
```typescript
// Avant (Firebase)
await db.collection('characters').doc(charId).update({
    fights_left: newFightsLeft,
    experience: newExperience
});

// Après (Supabase)
await supabase
    .from('characters')
    .update({
        fights_left: newFightsLeft,
        experience: newExperience
    })
    .eq('id', charId);
```

#### Transaction (batch)
Supabase ne supporte pas les transactions complexes comme Firebase. Vous devez :
1. Lire les données
2. Calculer les modifications
3. Écrire les données

```typescript
// Exemple pour mettre à jour plusieurs personnages
const updates = characters.map(char => 
    supabase
        .from('characters')
        .update({ fights_left: char.fightsLeft })
        .eq('id', char.id)
);

await Promise.all(updates);
```

## Adaptation du daily-reset-engine.ts

Le script de réinitialisation quotidienne doit être complètement réécrit pour Supabase.

### Nouvelle approche

```typescript
import { createClient } from '@supabase/supabase-js';
import { GAME_RULES } from '../src/config/gameRules';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runDailyReset() {
    console.log('🔄 Starting Supabase Daily Reset...');
    
    // 1. Calculer le timestamp de minuit pour Paris
    const now = new Date();
    const parisResetMidnightUtc = getZonedMidnightUtc(now, DAILY_RESET_TIMEZONE);
    
    // 2. Trouver tous les personnages à réinitialiser
    const { data: characters, error } = await supabase
        .from('characters')
        .select('id, fights_left, last_fight_reset')
        .or(`last_fight_reset.lt.${parisResetMidnightUtc},last_fight_reset.is.null`);
    
    if (error) {
        console.error('❌ Error fetching characters:', error);
        return;
    }
    
    if (!characters || characters.length === 0) {
        console.log('✅ All characters are up to date.');
        return;
    }
    
    console.log(`🔄 Resetting ${characters.length} characters...`);
    
    // 3. Mettre à jour chaque personnage
    const updatePromises = characters.map(char => 
        supabase
            .from('characters')
            .update({
                fights_left: GAME_RULES.COMBAT.MAX_DAILY_FIGHTS,
                last_fight_reset: parisResetMidnightUtc,
                fought_today: [],
                battle_count: 0
            })
            .eq('id', char.id)
    );
    
    const results = await Promise.all(updatePromises);
    
    // 4. Vérifier les erreurs
    const failedUpdates = results.filter(result => result.error);
    if (failedUpdates.length > 0) {
        console.warn(`⚠️ ${failedUpdates.length}/${characters.length} updates failed`);
        failedUpdates.forEach((result, index) => {
            console.error(`Failed update ${index}:`, result.error);
        });
    }
    
    console.log(`✅ Successfully reset ${characters.length - failedUpdates.length} characters`);
}

runDailyReset().catch(console.error);
```

## GitHub Actions pour Supabase

Les workflows GitHub Actions doivent être mis à jour pour utiliser les secrets Supabase :

```yaml
- name: Run Bot Engine
  run: npm run bots:run
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

## Limitations et différences

1. **Pas de transactions complexes** : Supabase ne supporte pas les transactions multi-tables comme Firebase
2. **Requêtes différentes** : La syntaxe des requêtes est différente (SQL-like vs NoSQL)
3. **Gestion des erreurs** : Les codes d'erreur sont différents
4. **Performance** : Les requêtes batch peuvent être plus lentes

## Recommandations

1. **Tester en développement** avant de déployer en production
2. **Surveiller les quotas** Supabase a des limites différentes de Firebase
3. **Optimiser les requêtes** en utilisant des filtres appropriés
4. **Configurer RLS** (Row Level Security) pour la production

Si vous avez besoin d'aide pour adapter un script spécifique, n'hésitez pas à demander !
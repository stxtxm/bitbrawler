# Migration de Firebase vers Supabase

Ce guide vous explique comment configurer Supabase pour remplacer Firebase.

## Étapes de configuration

### 1. Créer un compte Supabase
- Allez sur [supabase.com](https://supabase.com/) et créez un compte (email seul, pas besoin de numéro de téléphone)
- Créez un nouveau projet

### 2. Configurer les variables d'environnement
Créez un fichier `.env` à la racine du projet avec les variables suivantes :

```env
VITE_SUPABASE_URL=votre_url_supabase
VITE_SUPABASE_ANON_KEY=votre_clé_anonyme
```

Vous trouverez ces informations dans :
- Tableau de bord Supabase → Settings → API

### 3. Créer les tables dans Supabase

#### Table `characters`
```sql
create table characters (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamp with time zone default now(),
  name text not null unique,
  gender text not null,
  seed text not null,
  level integer not null default 1,
  hp integer not null,
  max_hp integer not null,
  strength integer not null,
  vitality integer not null,
  dexterity integer not null,
  luck integer not null,
  intelligence integer not null,
  focus integer not null,
  experience integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  fights_left integer not null default 5,
  last_fight_reset bigint not null,
  fight_history jsonb,
  fought_today text[],
  stat_points integer not null default 0,
  pending_fight jsonb,
  inventory text[],
  last_loot_roll bigint,
  incoming_fight_history jsonb,
  is_bot boolean not null default false,
  auto_mode boolean not null default false
);

create index idx_characters_name on characters(name);
create index idx_characters_level on characters(level);
```

#### Table `server_time`
```sql
create table server_time (
  id serial primary key,
  timestamp bigint not null
);

insert into server_time (timestamp) values (extract(epoch from now()) * 1000);
```

### 4. Activer les extensions nécessaires
Dans l'interface SQL de Supabase, exécutez :
```sql
create extension if not exists "uuid-ossp";
```

### 5. Configurer les politiques de sécurité (Row Level Security)

Pour permettre l'accès public en lecture/écriture (pour le développement) :

```sql
-- Pour la table characters
alter table characters enable row level security;

create policy "Enable read access for all users"
  on characters for select
  using (true);

create policy "Enable insert access for all users"
  on characters for insert
  with check (true);

create policy "Enable update access for all users"
  on characters for update
  using (true);

create policy "Enable delete access for all users"
  on characters for delete
  using (true);

-- Pour la table server_time
alter table server_time enable row level security;

create policy "Enable read access for all users"
  on server_time for select
  using (true);
```

⚠️ **Important** : Pour un environnement de production, vous devrez affiner ces politiques pour ajouter une authentification et des règles de sécurité appropriées.

### 6. Tester la connexion

Lancez l'application en développement :
```bash
npm run dev
```

L'application devrait maintenant se connecter à Supabase au lieu de Firebase.

## Modifications apportées

### Fichiers modifiés
- `src/config/firebase.ts` - Désactivé, remplacé par Supabase
- `src/config/supabase.ts` - Nouvelle configuration Supabase
- `src/context/GameContext.tsx` - Adapté pour utiliser Supabase

### Fonctions adaptées
- `syncCharacterWithSupabase` - Remplace la synchronisation Firestore
- `login` - Utilise maintenant l'API Supabase
- `retryConnection` - Vérifie la connexion Supabase
- `appendIncomingFightHistory` - Utilise les requêtes Supabase
- `useFight` - Met à jour les données via Supabase
- `allocateStatPoint` - Met à jour les stats via Supabase
- `startMatchmakingForPlayer` - Gère le matchmaking via Supabase
- `resolvePendingFight` - Résout les combats en attente via Supabase
- `rollLootboxForPlayer` - Gère les lootboxes via Supabase
- `setAutoMode` - Active/désactive le mode auto via Supabase
- `deleteCharacter` - Supprime un personnage via Supabase

## Prochaines étapes

1. **Tester toutes les fonctionnalités** : Création de personnage, combats, lootboxes, etc.
2. **Configurer l'authentification** (optionnel pour le développement)
3. **Mettre en place des webhooks** pour remplacer les GitHub Actions si nécessaire
4. **Optimiser les politiques de sécurité** pour la production

## Notes importantes

1. Supabase utilise PostgreSQL, donc les types de données sont légèrement différents
2. Les requêtes sont maintenant au format SQL via l'API Supabase
3. La structure des données est similaire mais avec des noms de colonnes en snake_case
4. Les fonctions de transaction Firebase ont été remplacées par des requêtes simples

Si vous avez besoin d'aide pour configurer Supabase ou tester la migration, n'hésitez pas à demander !
# Level-Up FX — pipeline, historique des bugs & réglages

> Document de référence pour le système d'annonce de level-up.
> Toute modification du pipeline DOIT mettre à jour ce fichier.

## Pipeline d'annonce

```
gainXp (tick idle / combat / boss / catch-up)
  └─ levelsGained > 0
      └─ onLevelUp(levelsGained, newLevel)
          = useArenaLevelUp.queueLevelUp   ← UNIQUE point d'entrée du FX
              ├─ swallow si FX déjà à l'écran        (#777)
              ├─ no-op si document.hidden            (#772)
              ├─ grâce 5 s post-unlock               (#778)
              ├─ throttle 8 s → agrégation "+N"      (5.5.1)
              └─ setRecentLevelUp({newLevel,isMilestone,count})
                  └─ IdleRunnerScene: glow + float text + flash + shockwave (2 s)
```

Les XP/statPoints sont appliqués par le tick **indépendamment** du FX — le FX
n'est qu'une annonce. Aucune perte de progression possible par throttling.

## Garde-fous anti-régression (chronologie des bugs)

| # | Symptôme | Cause racine | Fix |
|---|---|---|---|
| 1 | Boucle FX « à chaque monstre », back stable | Snapshot périmé du tick écrasait level/exp plus frais (yo-yo) | Guard `charRef` frais dans `runCombatTick`/catch-up (#781) |
| 2 | Texte flottant bloqué après lock | Timer de clear 2 s gelé par Android, jamais rejoué | `visibilitychange` purge hide+visible (#778) |
| 3 | Rafale d'FX après unlock | Ticks throttlés vidant leur backlog un par un | Grâce 5 s post-visible (#778) |
| 4 | Chaînage de flashes niveaux successifs | Dédup même-niveau insuffisant (niveaux différents) | Swallow while showing (#777) |
| 5 | Perçu en boucle à bas niveau | Courbe plate : palier 120 XP ≈ 1 niveau / 3 kills | Throttle global 8 s + agrégation `count` (5.5.1) |

## Réglages

| Constante | Fichier | Valeur | Effet |
|---|---|---|---|
| `MIN_ANNOUNCE_INTERVAL` | `useArenaLevelUp.ts` | 8000 ms | Min entre deux annonces visuelles |
| durée du FX | `queueLevelUp` timer | 2000 ms | Fenêtre d'affichage |
| `lessonCap` / keep | `scripts/compact-memories.mjs` | 500 / 3 | Mémoire dev.json |

## Contrat de tests (`arenaLevelUp.test.ts`)

- Une annonce = un objet `{newLevel, isMilestone, count?}` pendant 2000 ms puis `null`
- Appel pendant l'affichage → avalé (agrégé dans pending)
- Appels <8 s → agrégés silencieusement ; le prochain appel post-fenêtre affiche `{newLevel:max, count:total}`
- `document.hidden` → no-op

## Niveaux legacy au-dessus de la courbe (5.5.2)

Les niveaux gagnés sous l'ancienne courbe plate sont **conservés** (jamais de
nerf). Conséquence : `gainXp` ne peut pas « re-croiser » un seuil déjà
dépassé — plus de rattrapages en rafale.

## Watchdog d'animation × float text

Le one-shot du texte flottant, s'il est monté pendant un freeze PWA et que son
timer de hide meurt avec la page, reste monté indéfiniment. Le watchdog
d'animation (toutes les 2 s) remontait alors le slot → **replay du float à
chaque kill**. Fix : purge du FX (glow + float + cérémonie) sur
`visibilitychange:hidden` dans IdleRunnerScene.

## Signature dedup côté scène (dernier recours)

`IdleRunnerScene` calcule `sig = newLevel:count` et **ignore tout re-run
d'effet avec une signature identique** (`lastFxSigRef`). Même si l'upstream
produit de nouveaux objets par kill (batching React, churn d'identité), le
float/shockwave ne peuvent plus être rejoués pour une annonce déjà montrée.
Un VRAI nouveau niveau change forcément `newLevel` → annonce autorisée.


## Anti double-affichage immédiat (5.5.2)

Même signature (`newLevel:count`) ré-apparue **<4 s** après l'annonce (second
caller post-purge, race null-gap) → supprimée. Un vrai nouveau niveau change
`newLevel` → passe toujours.

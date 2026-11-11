import type { BuildingId } from '@/models/Building';

export interface BuildingInfo {
  /** Label printed on the shared image (French, like the in-game names). */
  label: string;
  /** Number of starters placed there. */
  capacity: number;
}

/** 20 places in total = the usual number of starters (core + rotation). */
export const BUILDING_INFO: Readonly<Record<BuildingId, BuildingInfo>> = Object.freeze({
  silo: { label: 'Silo nucléaire', capacity: 2 },
  refinery1: { label: 'Raffinerie de pétrole 1', capacity: 2 },
  refinery2: { label: 'Raffinerie de pétrole 2', capacity: 2 },
  science: { label: 'Centre scientifique', capacity: 2 },
  info: { label: "Centre d'information", capacity: 2 },
  arsenal: { label: 'Arsenal', capacity: 1 },
  mercenary: { label: 'Usine de mercenaires', capacity: 1 },
  hospital1: { label: 'Hôpital de campagne 1', capacity: 2 },
  hospital2: { label: 'Hôpital de campagne 2', capacity: 2 },
  hospital3: { label: 'Hôpital de campagne 3', capacity: 2 },
  hospital4: { label: 'Hôpital de campagne 4', capacity: 2 },
});

export interface SquadDirective {
  /** The players of these buildings form the squad (names are filled in from the plan). */
  buildings: readonly BuildingId[];
  text: string;
}

export interface SquadPhase {
  title: string;
  directives: readonly SquadDirective[];
}

/** "Directives de l'escouade d'élimination" printed on the image; names come from the building plan. */
export const SQUAD_PHASES: readonly SquadPhase[] = Object.freeze([
  {
    title: "Phase 1 – Jusqu'à l'ouverture du Silo",
    directives: [
      { buildings: ['arsenal'], text: "Soutenir le Centre d'information. Le maintenir sous contrôle." },
      { buildings: ['silo'], text: 'Soutenir les deux raffineries de pétrole.' },
      {
        buildings: ['mercenary'],
        text: "Se déplacer entre le Centre d'information et les raffineries de pétrole. Intervenir là où la situation est la plus critique.",
      },
    ],
  },
  {
    title: "Phase 2 – Après l'ouverture du Silo",
    directives: [
      {
        buildings: ['silo'],
        text: "S'emparer du Silo et le tenir. Objectif principal : le maintenir à 70-80 % du temps. Si possible, également soutenir une raffinerie de pétrole.",
      },
      {
        buildings: ['arsenal', 'mercenary'],
        text: "Tenir au moins l'Arsenal ou l'Usine de mercenaires. Se répartir au départ (un chacun). Si nécessaire, concentrer les forces sur l'un des deux. Toujours garder un œil sur le Centre d'information et être prêt à apporter un soutien.",
      },
    ],
  },
]);

/** Texts of the shared image. */
export const BUILDING_IMAGE_TEXT = Object.freeze({
  title: 'TEMPÊTE DU DÉSERT',
  subtitle: 'AFFECTATIONS DES BÂTIMENTS',
  team: (slot: string) => `ÉQUIPE ${slot}`,
  substitutes: 'REMPLAÇANTS',
  directives: "DIRECTIVES DE L'ESCOUADE D'ÉLIMINATION",
  nobody: '–',
});

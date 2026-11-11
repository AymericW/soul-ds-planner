import { BUILDING_IMAGE_TEXT, BUILDING_INFO, SQUAD_PHASES } from '@/constants/buildings';
import { formatEventDate } from '@/helpers/dates';
import { BUILDINGS, type BuildingAssignment, type BuildingId } from '@/models/Building';
import type { Member } from '@/models/Member';
import type { WeekEvent } from '@/models/WeekEvent';
import { assignmentsBySlot } from '@/domain/selection/overrides';
import { buildingsById } from './buildingPlan';

export interface BuildingImageBuilding {
  id: BuildingId;
  label: string;
  names: string[];
}

export interface BuildingImageDirective {
  /** Squad names, e.g. ["Sempré", "Fataal"]; empty when the buildings are unmanned. */
  names: string[];
  text: string;
}

export interface BuildingImagePhase {
  title: string;
  directives: BuildingImageDirective[];
}

/** Everything printed on the "Affectations des bâtiments" image, resolved to names. */
export interface BuildingImageContent {
  title: string;
  team: string;
  subtitle: string;
  dateLabel: string;
  buildings: BuildingImageBuilding[];
  substitutesTitle: string;
  /** In call-in order. */
  substitutes: string[];
  directivesTitle: string;
  phases: BuildingImagePhase[];
  /** Printed where nobody is placed. */
  nobody: string;
}

/** Squad names of each directive, taken from the players of its buildings (Silo first). */
export function squadPhases(plan: readonly BuildingAssignment[], nameOf: (id: string) => string): BuildingImagePhase[] {
  const byBuilding = buildingsById(plan);
  return SQUAD_PHASES.map((phase) => ({
    title: phase.title,
    directives: phase.directives.map((d) => ({
      names: d.buildings.flatMap((b) => byBuilding[b].map((a) => nameOf(a.memberId))),
      text: d.text,
    })),
  }));
}

export function buildBuildingImageContent(event: WeekEvent, plan: readonly BuildingAssignment[], members: readonly Member[]): BuildingImageContent {
  const names = new Map(members.map((m) => [m.id, m.name]));
  const nameOf = (id: string) => names.get(id) ?? '(removed member)';
  const byBuilding = buildingsById(plan);
  return {
    title: BUILDING_IMAGE_TEXT.title,
    team: BUILDING_IMAGE_TEXT.team(event.slot),
    subtitle: BUILDING_IMAGE_TEXT.subtitle,
    dateLabel: formatEventDate(event.date),
    buildings: BUILDINGS.map((id) => ({ id, label: BUILDING_INFO[id].label, names: byBuilding[id].map((a) => nameOf(a.memberId)) })),
    substitutesTitle: BUILDING_IMAGE_TEXT.substitutes,
    substitutes: assignmentsBySlot(event.assignments).substitute.map((a) => nameOf(a.memberId)),
    directivesTitle: BUILDING_IMAGE_TEXT.directives,
    phases: squadPhases(plan, nameOf),
    nobody: BUILDING_IMAGE_TEXT.nobody,
  };
}

/** File name of the exported PNG, e.g. "tempete-du-desert-equipe-A-2026-11-13.png". */
export function buildingImageFileName(event: WeekEvent): string {
  return `tempete-du-desert-equipe-${event.slot}-${event.date}.png`;
}

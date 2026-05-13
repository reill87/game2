import { communicationEvents } from './communication';
import { planningEvents } from './planning';
import { engineeringEvents } from './engineering';
import { organizationEvents } from './organization';
import { launchEvents } from './launch';
import { industryEvents } from './industry';
import { cultureEvents } from './culture';
import { comedyEvents } from './comedy';
import { incidentEvents } from './incident';
import { conflictEvents } from './conflict';
import { workstyleEvents } from './workstyle';
import type { ContentGameEvent, EventCategory, GameEvent } from './shared';

export type { EventChoice, EventCategory, GameEvent } from './shared';
export { EVENT_CATEGORY_LABEL } from './shared';

export const EVENT_CATEGORIES = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
] as const satisfies ReadonlyArray<EventCategory>;

const EVENTS_BY_CATEGORY: Readonly<Record<EventCategory, ReadonlyArray<ContentGameEvent>>> = {
  A: communicationEvents,
  B: planningEvents,
  C: engineeringEvents,
  D: organizationEvents,
  E: launchEvents,
  F: industryEvents,
  G: cultureEvents,
  H: comedyEvents,
  I: incidentEvents,
  J: conflictEvents,
  K: workstyleEvents,
};

const EVENTS_BY_ID: ReadonlyMap<string, ContentGameEvent> = new Map(
  EVENT_CATEGORIES.flatMap((category) => EVENTS_BY_CATEGORY[category]).map(
    (event) => [event.id, event] as const,
  ),
);

const EVENT_IDS_IN_RUNTIME_ORDER = [
  'weekend-chat-storm',
  'short-meeting-trap',
  'slack-overload',
  'email-marathon',
  'linkedin-headhunt',
  'scope-creep-pre-freeze',
  'okr-quarter',
  'exec-pt-deck',
  'pm-rotation',
  'feature-creep',
  'k-agile-adoption',
  'k-devops-transition',
  'ai-coding-tool',
  'legacy-found',
  'stability-quarter',
  'tech-debt-month',
  'migration-rust',
  'oss-contribute',
  'reorg-quarterly',
  'flat-org-rename',
  'new-exec-onboarding',
  'exit-interview',
  'quarterly-dinner',
  'culture-survey',
  'mandatory-csr',
  'town-hall-q',
  'launch-day-traffic',
  'cs-flood',
  'media-coverage',
  'app-store-feature',
  'series-funding',
  'trend-shift',
  'tech-conf-booth',
  'competitor-release',
  'friend-team-launch',
  'acquisition-offer',
  'regulator-audit',
  'industry-award',
  'inspiration',
  'laptop-died',
  'lunch-survey',
  'book-club',
  'laptop-left-overnight',
  'ceo-only-bug',
  'pre-launch-prayer',
  'office-pet',
  'team-building-pajama',
  'security-incident',
  'prod-push-accident',
  'data-breach-rumor',
  'qa-vs-dev',
  'progressive-vs-conservative',
  'dress-code-debate',
  'english-name',
  'friday-half-day',
  'team-hoodie',
  'overdue-panic',
  'morale-crisis',
  'crisis-pr-instagram',
  'k-twitter-x-rumor',
  'open-banking',
  'dev-internal-blog',
  'ai-debate-summit',
  'bug-bounty',
  'compliance-audit-eu',
  'dev-conf-keynote',
  'q4-bonus-cut',
  'parental-leave-policy',
  'unionization-talk',
  'industry-poach-attempt',
  'work-from-anywhere',
  'side-project-policy',
  'company-retreat-jeju',
  'series-c-failed',
  'patent-troll',
  'github-star-50k',
  'foreign-vc-visit',
  'antitrust-investigation',
  'ipo-roadshow',
  'sxsw-keynote',
  'tech-magazine-cover',
  'design-award',
  'github-octocat-pin',
  'former-employee-startup',
  'crashed-ec2',
  'database-corruption',
  'mentor-monday',
  'pet-policy-vote',
] as const;

const EVENT_CONTENT: ReadonlyArray<ContentGameEvent> = EVENT_IDS_IN_RUNTIME_ORDER.map((id) => {
  const event = EVENTS_BY_ID.get(id);
  if (!event) throw new Error(`Missing event content for id "${id}"`);
  return event;
});

export const EVENTS: ReadonlyArray<GameEvent> = EVENT_CONTENT;

const EVENT_CATEGORY_BY_ID: ReadonlyMap<string, EventCategory> = new Map(
  EVENT_CONTENT.map((event) => [event.id, event.category] as const),
);

export function categoryOf(event: Pick<GameEvent, 'id'>): EventCategory {
  return EVENT_CATEGORY_BY_ID.get(event.id) ?? 'A';
}

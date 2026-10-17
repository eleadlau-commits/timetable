import type { Itinerary } from '../shared/types';
import { journeySteps } from './journeyPresentation';

const clock = (timestamp: number) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }).format(timestamp);
const minutes = (seconds: number) => `${Math.ceil(seconds / 60)} min`;
const stepDuration = (seconds: number) => seconds < 60 ? `${Math.ceil(seconds)} sec` : `${Math.round(seconds / 60)} min`;

export default function JourneyCard({ journey, selected, active, requestedDeparture, onSelect }: {
  journey: Itinerary; selected: boolean; active: boolean; requestedDeparture: string; onSelect: () => void;
}) {
  const isBus = journey.legs.some(leg => leg.mode === 'BUS');
  return <article className={'journey-card ' + (active ? 'selected' : '')}>
    <button type="button" className="journey-summary" aria-expanded={selected}
      aria-label={`${isBus ? 'Bus' : 'Walking'} journey, ${minutes(journey.elapsedSeconds)}, arrive ${clock(journey.endTime)}`}
      onClick={onSelect}>
      <div className="journey-main"><strong>{minutes(journey.elapsedSeconds)}</strong><span>Arrive {clock(journey.endTime)}</span></div>
      <div className="journey-bottom"><div className="route-sequence">{journey.legs.map((leg, index) => <span key={index} className={leg.mode === 'BUS' ? 'route-badge' : 'walk-badge'}>{leg.mode === 'BUS' ? (leg.route?.shortName || leg.route?.longName || 'Bus') : 'Walk'}</span>)}</div><span className={'chevron ' + (selected ? 'expanded' : '')} aria-hidden="true">⌄</span></div>
    </button>
    {selected && <ol className="journey-details" aria-label="Journey steps">
      {journeySteps(journey, requestedDeparture).map((step, index) => <li key={index} className={`leg-detail ${step.kind}-leg`}>
        <span className="leg-dot" aria-hidden="true"/>
        <div className="leg-heading"><strong>{step.label}</strong><span>{stepDuration(step.seconds)}</span></div>
        {step.detail && <p className="leg-context">{step.detail}</p>}
      </li>)}
    </ol>}
  </article>;
}

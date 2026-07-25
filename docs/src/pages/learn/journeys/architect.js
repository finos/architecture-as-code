import React from 'react';
import JourneyPage from '@site/src/components/JourneyPage';
import {journeys} from '@site/src/components/JourneyPage/journeys';

export default function ArchitectJourney() {
    return <JourneyPage journey={journeys.architect} />;
}

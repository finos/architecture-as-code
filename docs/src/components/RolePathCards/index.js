import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import {journeyList} from '../JourneyPage/journeys';
import styles from './styles.module.css';

/**
 * The six-card role picker shared by the homepage and the Learn hub.
 */
export default function RolePathCards() {
    return (
        <div className={styles.paths}>
            {journeyList.map((journey) => (
                <Link
                    key={journey.slug}
                    to={`/learn/journeys/${journey.slug}`}
                    className={styles.pathCard}
                    style={{
                        '--accent-light': journey.accent,
                        '--accent-dark': journey.accentDark,
                    }}>
                    <span className={styles.wm}>{journey.icon}</span>
                    <div className={styles.top}>
                        <div className={clsx(styles.icon, journey.icon.length > 1 && styles.iconSmall)}>
                            {journey.icon}
                        </div>
                        <div className={styles.role}>{journey.roleLabel}</div>
                    </div>
                    <h3 className={styles.cardTitle}>{journey.cardTitle}</h3>
                    <p className={styles.cardBlurb}>{journey.cardBlurb}</p>
                    <div className={styles.foot}>
                        <span className={styles.meta}>{journey.cardMeta}</span>
                        <span className={styles.go}>Start path →</span>
                    </div>
                </Link>
            ))}
        </div>
    );
}

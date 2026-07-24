import React, {useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import shared from '@site/src/components/shared.module.css';
import styles from './talks.module.css';

/**
 * The talks media hub. Each entry is either a YouTube recording
 * (type 'youtube', click-to-play so the page loads no player iframes up
 * front), a self-hosted file (type 'file'), or an off-site recording
 * (type 'external').
 */
const EVENTS = [
    {
        event: 'Open Source in Finance Forum, London 2026',
        talks: [
            {
                type: 'youtube',
                id: 'oof9AQpXgLM',
                // Jump straight to the CALM segment of the keynote.
                start: 410,
                title: 'Keynote: State of the Community — launching the CALM Suite & FDC3 3.0',
                speakers: 'Gabriele Columbro with Matt Bain, Morgan Stanley, and Kris West',
                meta: '17 min · CALM segment from 06:50',
            },
        ],
    },
    {
        event: 'FINOS Open Source in Finance Podcast, June 2026',
        talks: [
            {
                type: 'youtube',
                id: 'hN7DLnTv8ws',
                title: 'Governing the Pipeline: Fusing CALM with Open SDLC',
                speakers: 'Karl Moll, FINOS, with Grizz Griswold',
                meta: '33 min',
            },
        ],
    },
    {
        event: 'Open Source in Finance Forum, Toronto 2026',
        talks: [
            {
                type: 'external',
                href: 'https://www.finos.org/osff-toronto-2026-videos#introduction-to-the-common-architecture-language-model-calm-',
                title: 'Introduction To the Common Architecture Language Model (CALM)',
                speakers: 'Khalid Elsawaf, Morgan Stanley',
                meta: 'Recording on finos.org',
            },
        ],
    },
    {
        event: 'Open Source in Finance Forum, New York 2025',
        talks: [
            {
                type: 'youtube',
                id: 'zdz6lpHZ-tg',
                title: 'Secure Innovation with CALM Architecture as Code — APIs and MCP',
                speakers: 'James Gough & Matthew Bain, Morgan Stanley',
                meta: '28 min',
            },
            {
                type: 'youtube',
                id: 'Js9tK4q0MMw',
                title: 'Secure by Design: Harnessing 3 FINOS Projects — CCC, CALM & AIGF',
                speakers: 'Matthew Bain, Morgan Stanley & Eddie Knight, Sonatype',
                meta: '32 min',
            },
            {
                type: 'youtube',
                id: 'A_NFelYuTds',
                title: 'CALM-aholic! Building Architecture as Code with LLMs and CALM',
                speakers: 'Khalid Elsawaf, Morgan Stanley',
                meta: '24 min',
            },
        ],
    },
    {
        event: 'Open Source in Finance Forum, London 2025',
        talks: [
            {
                type: 'youtube',
                id: 'v60qq05nXTY',
                title: 'CALM — Architecture Lifecycle Management',
                speakers: 'Konadu Appiah & Joseph Brown-Pobee, Turntabl.io',
                meta: '22 min',
            },
            {
                type: 'youtube',
                id: 'Xvnr2Cyt-Sk',
                title: 'Platforms for Secure API Connectivity With Architecture as Code',
                speakers: 'James Gough, Morgan Stanley',
                meta: '45 min',
            },
        ],
    },
    {
        event: 'Open Source in Finance Forum, New York 2024',
        talks: [
            {
                type: 'youtube',
                id: 'bqip3qiXh6o',
                title: 'CALM — Architecture at Scale',
                speakers: 'Denis Coffaro, Morgan Stanley & David Johnston, Red Hat',
                meta: '38 min',
            },
        ],
    },
    {
        event: 'Architecture as Code Working Group, September 2024',
        talks: [
            {
                type: 'file',
                src: 'https://calm.finos.org/video/aasc-wg-2024-09-24.mov',
                title: 'Observable, Secure Architectures Using FINOS Architecture as Code',
                speakers: 'James Gough & Nick Ebbitt',
                meta: 'Working group session',
            },
        ],
    },
];

function TalkMedia({talk}) {
    const [playing, setPlaying] = useState(false);

    if (talk.type === 'external') {
        return (
            <Link className={clsx(styles.media, styles.mediaExternal)} href={talk.href}>
                <span className={styles.playBadge} aria-hidden="true">▶</span>
                <span className={styles.externalLabel}>Watch on finos.org ↗</span>
            </Link>
        );
    }

    if (playing) {
        return talk.type === 'file' ? (
            <video className={styles.media} controls autoPlay src={talk.src} />
        ) : (
            <iframe
                className={styles.media}
                src={`https://www.youtube-nocookie.com/embed/${talk.id}?autoplay=1${talk.start ? `&start=${talk.start}` : ''}`}
                title={talk.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
            />
        );
    }

    return (
        <button
            type="button"
            className={clsx(styles.media, styles.mediaButton)}
            onClick={() => setPlaying(true)}
            aria-label={`Play: ${talk.title}`}>
            {talk.type === 'youtube' && (
                <img
                    className={styles.thumb}
                    src={`https://i.ytimg.com/vi/${talk.id}/hqdefault.jpg`}
                    alt=""
                    loading="lazy"
                />
            )}
            <span className={styles.playBadge} aria-hidden="true">▶</span>
        </button>
    );
}

export default function Talks() {
    return (
        <Layout
            title="Talks"
            description="Conference talks, podcasts and working-group sessions on CALM and Architecture as Code.">
            <main>
                <section className={shared.banner}>
                    <div className={shared.wrap}>
                        <span className={shared.eyebrow}>Community · Talks</span>
                        <h1>CALM on stage</h1>
                        <p>
                            Conference talks, podcasts and working-group sessions our
                            members have given on CALM and Architecture as Code —
                            newest first.
                        </p>
                    </div>
                </section>
                <section className={clsx(shared.wrap, shared.section)}>
                    {EVENTS.map((group) => (
                        <div className={styles.eventGroup} key={group.event}>
                            <h2 className={styles.eventHead}>{group.event}</h2>
                            <div className={styles.talkGrid}>
                                {group.talks.map((talk) => (
                                    <article className={styles.talkCard} key={talk.title}>
                                        <TalkMedia talk={talk} />
                                        <div className={styles.talkBody}>
                                            <h3 className={styles.talkTitle}>{talk.title}</h3>
                                            <p className={styles.talkSpeakers}>{talk.speakers}</p>
                                            <div className={styles.talkMeta}>{talk.meta}</div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </div>
                    ))}
                </section>
            </main>
        </Layout>
    );
}

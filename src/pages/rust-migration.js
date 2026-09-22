import React, {useEffect, useRef, useState} from 'react';
import Layout from '@theme/Layout';
import {PostRow} from '@theme/BlogListPage';
import * as semver from 'semver';
import {
  MAIN_MIGRATION_VERSION,
  MIGRATION_LAYERS,
  MIGRATION_MILESTONES,
  MIGRATION_PURPOSES,
  MIGRATION_RELEASES,
  MIGRATION_STATUSES,
} from '@site/src/data/rustMigration';
import styles from './rust-migration.module.css';

const POSTS = [
  {
    title: 'OCR uses Rust by default starting with v1.102.0-rc.1',
    permalink: '/blog/litellm-rust-ocr',
    date: '2026-09-13T10:00:00.000Z',
    description: 'Starting with v1.102.0-rc.1, OCR calls use the Rust implementation by default while preserving the existing API.',
    authors: [{name: 'Yujong Lee', url: 'mailto:yujong@berri.ai'}],
  },
  {
    title: 'Benchmarking the LiteLLM Rust AI Gateway: Overhead, Memory, and Cost',
    permalink: '/blog/rust-ai-gateway-benchmarks',
    date: '2026-07-22T09:00:00.000Z',
    description: 'AIGatewayBench measures gateway overhead against a deterministic mock. The LiteLLM Rust gateway has the lowest overhead and memory footprint of the four gateways tested.',
    authors: [{name: 'Ishaan Jaffer', url: 'https://www.linkedin.com/in/reffajnaahsi/'}],
  },
  {
    title: 'Migrating LiteLLM to Rust - Building the Fastest and Litest AI Gateway',
    permalink: '/blog/litellm-rust-launch',
    date: '2026-06-22T09:00:00.000Z',
    description: 'LiteLLM is moving its AI gateway to Rust: 15x throughput, 11x less memory, and sub-1ms per-request overhead. No v2, no migration, your config stays the same.',
    authors: [{name: 'Ishaan Jaffer', url: 'https://www.linkedin.com/in/reffajnaahsi/'}],
  },
];

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const MILESTONE_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const MIN_TIMELINE_RELEASES = 10;
const SELECTED_MILESTONE = MIGRATION_MILESTONES[0];
const MIGRATION_UNITS = MIGRATION_PURPOSES.flatMap(purpose => purpose.variants);
const LAYER_LABELS = new Map(MIGRATION_LAYERS.map(layer => [layer.id, layer.label]));
const LAYER_ORDER = MIGRATION_LAYERS.map(layer => layer.id);
const SORTED_PURPOSES = [...MIGRATION_PURPOSES]
  .sort((a, b) => LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer));
const UNIT_LABELS = new Map(MIGRATION_PURPOSES.flatMap(purpose => (
  purpose.variants.map(variant => [variant.id, `${purpose.label}: ${variant.label}`])
)));
const MATRIX_COLUMNS = Math.max(...MIGRATION_PURPOSES.map(purpose => purpose.variants.length));
const VIEWS = [
  {id: 'progress', label: 'Progress', Component: MigrationTimeline},
  {id: 'details', label: 'Details', Component: MigrationMatrix},
];

function isRcVersion(version) {
  return semver.valid(version) !== null && semver.prerelease(version)?.[0] === 'rc';
}

function isMainVersion(version) {
  return semver.eq(version, MAIN_MIGRATION_VERSION);
}

function formatDate(date) {
  return DATE_FORMATTER.format(new Date(date));
}

function compactVersion(version) {
  const parsed = semver.parse(version);
  if (!parsed) {
    return version;
  }
  const release = parsed.patch === 0
    ? `${parsed.major}.${parsed.minor}`
    : `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  return `${release} rc${parsed.prerelease[1]}`;
}

function validateMigrationData() {
  const missingIntroduction = MIGRATION_UNITS.find(unit => !Object.hasOwn(unit, 'introducedIn'));
  if (missingIntroduction) {
    throw new Error(`Rust migration support unit must declare introducedIn: ${missingIntroduction.id}`);
  }
  if (MIGRATION_RELEASES.length < MIN_TIMELINE_RELEASES) {
    throw new Error(`Rust migration timeline must contain at least ${MIN_TIMELINE_RELEASES} RC versions`);
  }
  const invalidVersion = [
    ...MIGRATION_RELEASES.map(release => release.version),
    ...MIGRATION_UNITS.map(unit => unit.introducedIn),
  ]
    .filter(Boolean)
    .find(version => !isRcVersion(version));
  if (invalidVersion) {
    throw new Error(`Rust migration versions must be RC semver versions: ${invalidVersion}`);
  }
}

function isMigratedBy(unit, version) {
  return Boolean(
    MIGRATION_STATUSES[unit.status].migrated
    && unit.introducedIn
    && semver.lte(unit.introducedIn, version),
  );
}

function buildTimeline() {
  validateMigrationData();
  const releases = [...MIGRATION_RELEASES].sort((a, b) => semver.compare(a.version, b.version));
  const percentages = releases.map(release => Math.round(
    (MIGRATION_UNITS.filter(unit => isMigratedBy(unit, release.version)).length / MIGRATION_UNITS.length) * 100,
  ));
  return releases.map((release, index) => {
    const isMain = isMainVersion(release.version);
    const changed = index > 0 && percentages[index - 1] !== percentages[index];
    return {
      version: release.version,
      percent: percentages[index],
      date: formatDate(release.releasedAt ?? release.plannedFor),
      isMain,
      changed,
      notable: index === 0 || isMain || changed,
    };
  });
}

const TIMELINE = buildTimeline();

function useElementWidth(fallback) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.round(entry.contentRect.width);
      if (nextWidth > 0) {
        setWidth(nextWidth);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function MilestoneSelector() {
  return (
    <div className={styles.milestoneSelector} role="group" aria-label="Migration milestone">
      {MIGRATION_MILESTONES.map(milestone => {
        const selected = milestone === SELECTED_MILESTONE;
        return (
          <button
            className={selected ? styles.activeMilestone : undefined}
            type="button"
            aria-pressed={selected}
            disabled={milestone.disabled}
            key={milestone.id}
          >
            <strong>{milestone.label}</strong>
            <span>{MILESTONE_DATE_FORMATTER.format(new Date(milestone.endsOn))}</span>
          </button>
        );
      })}
    </div>
  );
}

function chartLayout(width) {
  const compact = width < 560;
  const height = compact ? 240 : 336;
  const plot = compact
    ? {left: 40, right: 20, top: 36, bottom: 56}
    : {left: 48, right: 40, top: 40, bottom: 64};
  const goalGap = compact ? 72 : 120;
  const plotWidth = width - plot.left - plot.right;
  const baseline = height - plot.bottom;
  const plotHeight = baseline - plot.top;
  return {
    compact,
    height,
    left: plot.left,
    baseline,
    goalX: plot.left + plotWidth,
    x: index => plot.left + (index / (TIMELINE.length - 1)) * (plotWidth - goalGap),
    y: percent => baseline - (percent / 100) * plotHeight,
  };
}

function MigrationTimeline() {
  const [chartRef, width] = useElementWidth(920);
  const {compact, height, left, baseline, goalX, x, y} = chartLayout(width);
  const latest = TIMELINE[TIMELINE.length - 1];
  const linePath = TIMELINE
    .map((point, index) => (
      index === 0 ? `M${x(0)},${y(point.percent)}` : `H${x(index)}V${y(point.percent)}`
    ))
    .join('');
  const areaPath = `${linePath}V${baseline}H${x(0)}Z`;

  return (
    <div className={styles.progressView}>
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <div className={styles.progressSummary}>
            <strong>{latest.percent}%</strong>
          </div>
          <MilestoneSelector />
        </div>

        <div className={styles.chartBody} ref={chartRef}>
          <svg
            className={styles.timeline}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-labelledby="timeline-title timeline-description"
          >
            <title id="timeline-title">Rust migration progress over time</title>
            <desc id="timeline-description">
              {latest.percent} percent of tracked support units run on Rust by default in {MAIN_MIGRATION_VERSION}.
              The selected milestone targets 100 percent by {SELECTED_MILESTONE.endsOn}.
            </desc>
            <defs>
              <linearGradient id="progress-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" className={styles.areaStart} />
                <stop offset="100%" className={styles.areaEnd} />
              </linearGradient>
            </defs>
            {[0, 50, 100].map(tick => (
              <g key={tick}>
                <line
                  className={tick === 0 ? styles.baseline : styles.gridLine}
                  x1={left}
                  x2={goalX}
                  y1={y(tick)}
                  y2={y(tick)}
                />
                <text className={styles.axisLabel} x={left - 10} y={y(tick) + 4} textAnchor="end">{tick}%</text>
              </g>
            ))}
            <path className={styles.progressArea} d={areaPath} fill="url(#progress-area)" />
            <line
              className={styles.goalLine}
              x1={x(TIMELINE.length - 1)}
              x2={goalX}
              y1={y(latest.percent)}
              y2={y(100)}
            />
            <path className={styles.progressLine} d={linePath} />
            {TIMELINE.map((point, index) => {
              const cx = x(index);
              const cy = y(point.percent);
              return (
                <g key={point.version}>
                  <title>
                    {point.version}: {point.percent}%, {point.isMain ? `planned for ${point.date}` : `released ${point.date}`}
                  </title>
                  <circle
                    className={point.isMain ? styles.mainPoint : styles.progressPoint}
                    cx={cx}
                    cy={cy}
                    r={point.isMain ? 5 : 3.5}
                  />
                  {point.changed && (
                    <text className={styles.pointValue} x={cx} y={cy - 12} textAnchor="middle">
                      {point.percent}%
                    </text>
                  )}
                  {(point.notable || !compact) && (
                    <text
                      className={`${styles.versionLabel} ${point.isMain ? styles.mainVersionLabel : ''}`}
                      x={cx}
                      y={baseline + 26}
                      textAnchor={compact && index === 0 ? 'start' : 'middle'}
                    >
                      <tspan x={cx}>{compactVersion(point.version)}</tspan>
                      <tspan className={styles.versionDate} x={cx} dy="16">
                        {point.isMain && !compact ? `${point.date} · main` : point.date}
                      </tspan>
                    </text>
                  )}
                </g>
              );
            })}
            <g className={styles.goal}>
              <title>{SELECTED_MILESTONE.label}: 100% by {SELECTED_MILESTONE.endsOn}</title>
              <circle cx={goalX} cy={y(100)} r="5" />
              <text className={styles.goalLabel} x={goalX} y={y(100) - 14} textAnchor="end">
                100% goal
              </text>
              <text className={styles.goalAxisLabel} x={goalX} y={baseline + 26} textAnchor="end">
                <tspan x={goalX}>Goal</tspan>
                <tspan className={styles.versionDate} x={goalX} dy="16">
                  {formatDate(SELECTED_MILESTONE.endsOn)}
                </tspan>
              </text>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

function MatrixCell({variant}) {
  const status = MIGRATION_STATUSES[variant.status];
  return (
    <article
      className={`${styles.cell} ${styles[variant.status]}`}
      title={variant.requires
        ? `Requires ${variant.requires.map(id => UNIT_LABELS.get(id) ?? id).join(', ')}`
        : undefined}
    >
      <strong>{variant.label}</strong>
      <span className={styles.cellMeta}>
        {status.label}
        {variant.introducedIn && ` · ${compactVersion(variant.introducedIn)}`}
        {variant.introducedIn && isMainVersion(variant.introducedIn) && ' (main)'}
      </span>
    </article>
  );
}

function MigrationMatrix() {
  return (
    <div className={styles.detailsView}>
      <div className={styles.detailsIntro}>
        <p>Each cell is one tracked route, provider, adapter, or capability, grouped by layer.</p>
        <p>Native Messages cells track provider transports. Bridge cells track paired request and return conversion through Chat or Responses</p>
        <div className={styles.legend} aria-label="Migration status legend">
          {Object.entries(MIGRATION_STATUSES).map(([status, metadata]) => (
            <span key={status}><i className={styles[status]} />{metadata.label}</span>
          ))}
        </div>
      </div>

      <div className={styles.matrix} style={{'--matrix-columns': MATRIX_COLUMNS}}>
        {SORTED_PURPOSES.map((purpose, index) => {
          const firstInLayer = SORTED_PURPOSES[index - 1]?.layer !== purpose.layer;
          return (
            <div
              className={`${styles.matrixRow} ${firstInLayer && index > 0 ? styles.layerStart : ''}`}
              key={purpose.id}
            >
              <div className={styles.purposeLabel}>
                <span>{firstInLayer ? LAYER_LABELS.get(purpose.layer) : ''}</span>
                <strong>{purpose.label}</strong>
              </div>
              <div className={styles.cells}>
                {purpose.variants.map(variant => <MatrixCell variant={variant} key={variant.id} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MigrationTracker() {
  const [activeView, setActiveView] = useState(VIEWS[0].id);

  return (
    <section className={styles.trackerSection} aria-labelledby="migration-tracker-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.kicker}>Migration tracker</p>
          <h2 id="migration-tracker-title">Rust migration progress</h2>
        </div>
        <div className={styles.viewToggle} role="group" aria-label="Migration tracker view">
          {VIEWS.map(view => (
            <button
              className={view.id === activeView ? styles.activeToggle : undefined}
              type="button"
              aria-pressed={view.id === activeView}
              onClick={() => setActiveView(view.id)}
              key={view.id}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.trackerBody}>
        {VIEWS.map(({id, Component}) => (
          <div
            className={`${styles.viewPanel} ${id === activeView ? styles.activePanel : ''}`}
            aria-hidden={id !== activeView}
            key={id}
          >
            <Component />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function RustMigrationPage() {
  return (
    <Layout
      title="LiteLLM Rust Migration"
      description="Updates from LiteLLM's migration to Rust."
    >
      <main className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Rust Migration</p>
          <h1 className={styles.title}>LiteLLM is moving to Rust</h1>
          <p className={styles.description}>Follow migration progress across routes, providers, adapters, and foundational services.</p>
          <p className={styles.prototypeNote}>Experimental view. The initial coverage inventory is illustrative and will change.</p>
        </header>

        <MigrationTracker />

        <section className={styles.updates} aria-labelledby="migration-updates-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Engineering updates</p>
              <h2 id="migration-updates-title">How we are getting there</h2>
            </div>
          </div>
          <div className={styles.list}>
            {POSTS.map(post => <PostRow key={post.permalink} post={post} />)}
          </div>
        </section>
      </main>
    </Layout>
  );
}

import { SOURCES } from '../config/sources'

/** Official chapter text of P.L. 2020, c. 92; definition is at N.J.S.A. 13:1D-158. */
export const OBC_DEFINITION_SOURCE =
  'https://www.njleg.state.nj.us/2020/Bills/PL20/92_.HTM'

/** Verbatim from P.L. 2020, c. 92, §2 (C.13:1D-158). */
export const OBC_DEFINITION =
  '“Overburdened community” means any census block group, as determined in accordance with the most recent United States Census, in which: (1) at least 35 percent of the households qualify as low-income households; (2) at least 40 percent of the residents identify as minority or as members of a State recognized tribal community; or (3) at least 40 percent of the households have limited English proficiency.'

type Props = {
  onClose: () => void
}

export function AboutData({ onClose }: Props) {
  return (
    <section className="about" id="about-the-data" aria-labelledby="about-title">
      <div className="about-header">
        <h2 id="about-title">About the data</h2>
        <button type="button" className="about-close" onClick={onClose}>
          Back
        </button>
      </div>

      <h3>Sources</h3>
      <ul className="about-sources">
        <li>
          <a href={SOURCES.femaNfhl.infoUrl} target="_blank" rel="noreferrer">
            FEMA National Flood Hazard Layer
          </a>
          {' — '}
          the federal regulatory flood-zone system of record. Figures reflect FEMA&rsquo;s
          current effective data from the{' '}
          <a href={SOURCES.femaNfhl.url} target="_blank" rel="noreferrer">
            live service
          </a>
          .
        </li>
        <li>
          <a href={SOURCES.njdepOverburdened.infoUrl} target="_blank" rel="noreferrer">
            NJDEP Overburdened Communities
          </a>
          {' — '}
          the state&rsquo;s published layer implementing the New Jersey Environmental Justice
          Law (
          <a href={OBC_DEFINITION_SOURCE} target="_blank" rel="noreferrer">
            N.J.S.A. 13:1D-157 et seq.
          </a>
          ).{' '}
          <a href={SOURCES.njdepOverburdened.url} target="_blank" rel="noreferrer">
            Live service
          </a>
          .
        </li>
        <li>
          <a href={SOURCES.njMunicipalities.infoUrl} target="_blank" rel="noreferrer">
            NJOGIS municipal boundaries
          </a>
          {' — '}
          New Jersey&rsquo;s official municipal outlines, used to select a town.{' '}
          <a href={SOURCES.njMunicipalities.url} target="_blank" rel="noreferrer">
            Live service
          </a>
          .
        </li>
      </ul>

      <h3>What &ldquo;overburdened community&rdquo; means</h3>
      <blockquote cite={OBC_DEFINITION_SOURCE}>
        <p>{OBC_DEFINITION}</p>
      </blockquote>
      <p className="about-cite">
        Source:{' '}
        <a href={OBC_DEFINITION_SOURCE} target="_blank" rel="noreferrer">
          P.L. 2020, c. 92, §2 (N.J.S.A. 13:1D-158)
        </a>
        .
      </p>

      <h3>What this app counts</h3>
      <p>
        The NJDEP layer contains only communities designated overburdened under that law —{' '}
        <a href={SOURCES.njdepOverburdened.url} target="_blank" rel="noreferrer">
          3,180 records covering 3,168 distinct census block groups
        </a>{' '}
        statewide. Non-overburdened block groups are not shown or counted anywhere in this
        app. That is a deliberate lens, not an omission.
      </p>

      <h3>Limitations</h3>
      <ul className="about-limits">
        <li>
          FEMA has no effective digital flood map for some places. Where the National Flood
          Hazard Layer publishes nothing for a block group, this app reports that as missing
          data — never as safe. Atlantic City is the clearest example: most of its
          overburdened block groups have no FEMA flood polygon at all.
        </li>
        <li>
          Flood zones appear on the map only at neighborhood zoom (about 1:36,000 and closer)
          because FEMA&rsquo;s map service will not draw them farther out. The numbers in the
          side panel come from direct queries to the same service and are not limited by that
          zoom rule.
        </li>
        <li>
          &ldquo;Flood-exposed&rdquo; here means a block group touches at least one Special
          Flood Hazard Area polygon — a yes-or-no test, not a share of the block group&rsquo;s
          area that is flooded.
        </li>
        <li>
          A census block group that crosses a municipal line is counted once for that town.
          Counts say &ldquo;block groups intersecting [town]&rdquo; because block groups do not
          nest cleanly inside municipal boundaries.
        </li>
        <li>
          Town boundaries on the map are flat outlines and can extend into water, so a click
          just offshore may still select a town.
        </li>
      </ul>
    </section>
  )
}

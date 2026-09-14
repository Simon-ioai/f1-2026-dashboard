export default function AboutPanel() {
  return (
    <details className="about">
      <summary>
        <span className="about-title">New here? What this dashboard is and how it works</span>
        <span className="about-chevron" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="about-body">
        <p>
          This page tracks the <b>2026 Formula 1 drivers' championship</b> — not just the points,
          but how the title fight is <em>trending</em>. It updates itself: fresh betting-market
          numbers every day around 14:00 Danish time, and full race results every Monday morning
          after a Grand Prix. Nothing here is typed in by hand, and nothing is ever made up — if a
          data source is down, the page shows its last good data with an amber warning instead of
          guessing.
        </p>

        <h4>The panels, top to bottom</h4>
        <ul>
          <li>
            <b>Title probability</b> — each contender's chance of winning the championship,
            according to real people betting real money on{' '}
            <a href="https://polymarket.com/event/2026-f1-drivers-champion" target="_blank" rel="noreferrer">
              Polymarket
            </a>
            . A price of 76% means the market collectively believes that driver wins the title 76
            times out of 100. The small ▲/▼ shows the change over the last 7 days.
          </li>
          <li>
            <b>Title odds timeline</b> — the same probabilities as a line chart covering the whole
            season, so you can see every twist: race weekends are the vertical markers (hover one
            for the winner), and you can click a driver's name to look at their line alone.
          </li>
          <li>
            <b>Clinch scenarios</b> — the pure arithmetic of the title: the earliest race each
            driver could mathematically seal the championship and what they'd need to do, plus
            who is already out of the running.
          </li>
          <li>
            <b>Teammate head-to-head</b> — the only fair comparison in F1 is between two drivers
            in the same car. Qualifying score, race score, points, and the average time gap
            between teammates, measured in thousandths of a second.
          </li>
          <li>
            <b>Simulator vs market</b> — our own toy prediction: the rest of the season is played
            out 20,000 times based on each driver's actual results so far. Where it disagrees
            with the betting market, the market is usually right — the gap is the fun part.
          </li>
          <li>
            <b>Form index</b> — who is hot and who is cold right now: each driver's last three
            weekends compared with their own season average, so a slump or a surge shows up
            before the championship table reflects it.
          </li>
        </ul>

        <h4>Reading the numbers honestly</h4>
        <p>
          Market probabilities are opinions with money behind them, not facts about the future.
          The simulator is a simple model with a small sample behind it. And "mathematically
          alive" can mean needing to win every remaining race — possible is not the same as
          likely. None of this is betting advice.
        </p>
        <p className="about-fine">
          Data: race results and calendar from Jolpica-F1 (community successor to the Ergast
          database), title odds from Polymarket. Unofficial fan project — not affiliated with
          Formula 1.
        </p>
      </div>
    </details>
  );
}

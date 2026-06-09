// golfLogic.js
// Pure golf/data transformations that can be tested without touching the DOM.

(function () {
  const { avg, latestDateOf } = window.TCUtils;

  function progressShots(shots) {
    return (shots || []).filter(s => s.is_full_shot !== false && s.exclude_from_progress !== true);
  }

  function averageMetric(shots, key) {
    return avg((shots || []).map(s => s[key]).filter(x => x != null && !isNaN(x)));
  }

  function shotsForLastSession(shots) {
    if (!shots?.length) return { date: null, shots: [] };
    const firstDate = latestDateOf(shots[0])?.slice(0, 10);
    if (!firstDate) return { date: null, shots: [] };
    return {
      date: firstDate,
      shots: shots.filter(s => latestDateOf(s)?.startsWith(firstDate)),
    };
  }

  function summarizeLastTrackmanSession(shots) {
    const { date, shots: sessionShots } = shotsForLastSession(shots);
    const progress = progressShots(sessionShots);
    const usedShots = progress.length ? progress : sessionShots;

    return {
      date,
      n: usedShots.length,
      carry: averageMetric(usedShots, 'carry'),
      face: averageMetric(usedShots, 'face_angle'),
      path: averageMetric(usedShots, 'club_path'),
      attack: averageMetric(usedShots, 'attack_angle'),
      smash: averageMetric(usedShots, 'smash_factor'),
      launch: averageMetric(usedShots, 'launch_angle'),
      spin: averageMetric(usedShots, 'spin_rate'),
      ballSpeed: averageMetric(usedShots, 'ball_speed'),
      clubSpeed: averageMetric(usedShots, 'club_speed'),
      dynLoft: averageMetric(usedShots, 'dyn_loft'),
      spinAxis: averageMetric(usedShots, 'spin_axis'),
    };
  }

  function filterAnalysisShots(shots, filterKey) {
    switch (filterKey) {
      case 'full':
        return (shots || []).filter(s => s.is_full_shot !== false);
      case 'progress':
        return (shots || []).filter(s => s.exclude_from_progress !== true);
      case 'full_progress':
        return progressShots(shots);
      default:
        return shots || [];
    }
  }

  window.TCGolf = {
    progressShots,
    averageMetric,
    shotsForLastSession,
    summarizeLastTrackmanSession,
    filterAnalysisShots,
  };
})();

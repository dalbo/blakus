class Leaderboard {
  static load(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch (e) { return []; }
  }

  static save(key, entries) {
    try { localStorage.setItem(key, JSON.stringify(entries)); }
    catch (e) {}
  }

  // Returns { entries, rank } — rank is 0-based index in top 10, -1 if not placed
  static add(key, entry) {
    const entries = Leaderboard.load(key);
    entries.push(entry);
    entries.sort((a, b) => {
      const da = a.deaths !== undefined ? a.deaths : (a.p1Deaths + a.p2Deaths);
      const db = b.deaths !== undefined ? b.deaths : (b.p1Deaths + b.p2Deaths);
      return (a.timeMs - b.timeMs) || (da - db);
    });
    const top = entries.slice(0, 10);
    Leaderboard.save(key, top);
    return { entries: top, rank: top.indexOf(entry) };
  }
}

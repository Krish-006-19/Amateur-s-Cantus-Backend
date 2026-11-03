function musicListKey() {
  return 'cache:music:list';
}

function musicDetailKey(id) {
  return `cache:music:detail:${id}`;
}

function artistListKey() {
  return 'cache:artist:list';
}

function artistDetailKey(id) {
  return `cache:artist:detail:${id}`;
}

module.exports = {
  musicListKey,
  musicDetailKey,
  artistListKey,
  artistDetailKey,
};
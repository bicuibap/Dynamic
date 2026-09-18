const MAX_ARTWORK_CACHE = 30;
const artworkCache = new Map();

function cacheArtwork(title, url) {
  if (artworkCache.has(title)) {
    artworkCache.delete(title);
  } else if (artworkCache.size >= MAX_ARTWORK_CACHE) {
    const oldestKey = artworkCache.keys().next().value;
    artworkCache.delete(oldestKey);
  }
  artworkCache.set(title, url);
}

async function fetchOfficialMusicArtwork(title, artist) {
  let clean = title
    .replace(/\[.*?\]|\(.*?\)/g, '')
    .replace(/\|.*$/g, '')
    .replace(/ft\.?.*$/i, '')
    .replace(/feat\.?.*$/i, '')
    .replace(/official\s+(music\s+)?(video|audio|lyrics?)/gi, '')
    .replace(/ncs\s+release/gi, '')
    .trim();

  // Try iTunes Search API
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&media=music&entity=song&limit=1`;
    const res = await fetch(itunesUrl, { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    if (data.results && data.results[0] && data.results[0].artworkUrl100) {
      return data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
    }
  } catch (e) { }

  // Try Deezer Search API
  try {
    const deezerUrl = `https://api.deezer.com/search?q=${encodeURIComponent(clean)}&limit=1`;
    const res = await fetch(deezerUrl, { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    if (data.data && data.data[0] && data.data[0].album && data.data[0].album.cover_medium) {
      return data.data[0].album.cover_big || data.data[0].album.cover_medium;
    }
  } catch (e) { }

  return null;
}

async function resolveCoverArt(title, artist) {
  if (!title) return null;
  if (artworkCache.has(title)) {
    const cached = artworkCache.get(title);
    // Refresh LRU order
    artworkCache.delete(title);
    artworkCache.set(title, cached);
    return cached;
  }

  const coverArt = await fetchOfficialMusicArtwork(title, artist);
  if (coverArt) {
    cacheArtwork(title, coverArt);
  }
  return coverArt;
}

module.exports = { resolveCoverArt };

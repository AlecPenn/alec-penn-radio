const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const CHANNEL_ID = "UCOl7ftt1QeYJW8HREtlr5qA"; // Alec Penn Radio channel ID

export async function getLatestVideos() {
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=snippet&order=date&maxResults=5&type=video`
    );
    const data = await res.json();
    return data.items || [];
  } catch (e) {
    console.error("YouTube fetch error:", e);
    return [];
  }
}

export async function getTopVideos() {
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=snippet&order=viewCount&maxResults=5&type=video`
    );
    const data = await res.json();
    if (!data.items) return [];

    // Get video IDs to fetch view counts
    const ids = data.items.map(i => i.id.videoId).join(",");
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${ids}&part=statistics,snippet`
    );
    const statsData = await statsRes.json();
    return statsData.items || [];
  } catch (e) {
    console.error("YouTube fetch error:", e);
    return [];
  }
}

export async function getTopShorts() {
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=snippet&order=viewCount&maxResults=4&type=video&videoDuration=short`
    );
    const data = await res.json();
    if (!data.items) return [];

    const ids = data.items.map(i => i.id.videoId).join(",");
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${ids}&part=statistics,snippet`
    );
    const statsData = await statsRes.json();
    return statsData.items || [];
  } catch (e) {
    console.error("YouTube fetch error:", e);
    return [];
  }
}

export function formatViews(n) {
  if (!n) return "—";
  const num = parseInt(n);
  if (num >= 1000000) return (num/1000000).toFixed(1)+"M";
  if (num >= 1000) return (num/1000).toFixed(1)+"K";
  return num.toString();
}

export function formatLikes(n) {
  return formatViews(n);
}

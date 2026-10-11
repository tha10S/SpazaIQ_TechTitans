// 7-day forecast from Open-Meteo (free, no API key). Shared by Insights, and by Home and the
// chatbot if they want it, so every screen reads the same forecast.
// The shop's location isn't stored yet, so this is for Johannesburg.

const FORECAST_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=-26.2041&longitude=28.0473' +
  '&current=temperature_2m,weather_code' +
  '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code' +
  '&forecast_days=7&timezone=auto';

const CACHE_MS = 30 * 60 * 1000;
let cache = null; // { at, data }

// Returns { current: { temp, code } | null, days: [{ date: 'YYYY-MM-DD', min, max, rainChance, code }] }
export async function getForecast({ force = false, signal } = {}) {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.data;

  const response = await fetch(FORECAST_URL, { signal });
  if (!response.ok) throw new Error('Weather is unavailable right now.');
  const json = await response.json();

  const daily = json.daily || {};
  const days = (daily.time || []).map((date, index) => ({
    date,
    min: Math.round(daily.temperature_2m_min?.[index]),
    max: Math.round(daily.temperature_2m_max?.[index]),
    rainChance: Number(daily.precipitation_probability_max?.[index] ?? 0),
    code: daily.weather_code?.[index],
  }));
  const data = {
    current: json.current
      ? { temp: Math.round(json.current.temperature_2m), code: json.current.weather_code }
      : null,
    days,
  };

  cache = { at: Date.now(), data };
  return data;
}
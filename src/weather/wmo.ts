/** WMO weather interpretation codes used by Open-Meteo. */
const CODES: Record<number, [string, string]> = {
  0: ['Clear', '☀️'],
  1: ['Mostly clear', '🌤️'],
  2: ['Partly cloudy', '⛅'],
  3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'],
  48: ['Rime fog', '🌫️'],
  51: ['Light drizzle', '🌦️'],
  53: ['Drizzle', '🌦️'],
  55: ['Heavy drizzle', '🌧️'],
  56: ['Freezing drizzle', '🌧️'],
  57: ['Freezing drizzle', '🌧️'],
  61: ['Light rain', '🌦️'],
  63: ['Rain', '🌧️'],
  65: ['Heavy rain', '🌧️'],
  66: ['Freezing rain', '🌧️'],
  67: ['Freezing rain', '🌧️'],
  71: ['Light snow', '🌨️'],
  73: ['Snow', '🌨️'],
  75: ['Heavy snow', '❄️'],
  77: ['Snow grains', '🌨️'],
  80: ['Rain showers', '🌦️'],
  81: ['Rain showers', '🌧️'],
  82: ['Violent showers', '⛈️'],
  85: ['Snow showers', '🌨️'],
  86: ['Snow showers', '❄️'],
  95: ['Thunderstorm', '⛈️'],
  96: ['Thunderstorm, hail', '⛈️'],
  99: ['Thunderstorm, hail', '⛈️'],
};

export function describeCode(code?: number): string {
  return code != null && CODES[code] ? CODES[code][0] : 'Unknown';
}

export function codeEmoji(code?: number): string {
  return code != null && CODES[code] ? CODES[code][1] : '🌡️';
}

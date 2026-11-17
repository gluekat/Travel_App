/** Major airports bundled for instant, offline search by code, airport name or city. */
export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

// code, name, city, country, lat, lon
const RAW: [string, string, string, string, number, number][] = [
  ['ATL', 'Hartsfield-Jackson Atlanta International', 'Atlanta', 'United States', 33.64, -84.43],
  ['LAX', 'Los Angeles International', 'Los Angeles', 'United States', 33.94, -118.41],
  ['ORD', "O'Hare International", 'Chicago', 'United States', 41.98, -87.9],
  ['MDW', 'Midway International', 'Chicago', 'United States', 41.79, -87.75],
  ['DFW', 'Dallas/Fort Worth International', 'Dallas', 'United States', 32.9, -97.04],
  ['DAL', 'Dallas Love Field', 'Dallas', 'United States', 32.85, -96.85],
  ['DEN', 'Denver International', 'Denver', 'United States', 39.86, -104.67],
  ['JFK', 'John F. Kennedy International', 'New York', 'United States', 40.64, -73.78],
  ['LGA', 'LaGuardia', 'New York', 'United States', 40.78, -73.87],
  ['EWR', 'Newark Liberty International', 'Newark', 'United States', 40.69, -74.17],
  ['SFO', 'San Francisco International', 'San Francisco', 'United States', 37.62, -122.38],
  ['OAK', 'Oakland International', 'Oakland', 'United States', 37.72, -122.22],
  ['SJC', 'Norman Y. Mineta San Jose International', 'San Jose', 'United States', 37.36, -121.93],
  ['SEA', 'Seattle-Tacoma International', 'Seattle', 'United States', 47.45, -122.31],
  ['LAS', 'Harry Reid International', 'Las Vegas', 'United States', 36.08, -115.15],
  ['MCO', 'Orlando International', 'Orlando', 'United States', 28.43, -81.31],
  ['MIA', 'Miami International', 'Miami', 'United States', 25.79, -80.29],
  ['FLL', 'Fort Lauderdale-Hollywood International', 'Fort Lauderdale', 'United States', 26.07, -80.15],
  ['TPA', 'Tampa International', 'Tampa', 'United States', 27.98, -82.53],
  ['CLT', 'Charlotte Douglas International', 'Charlotte', 'United States', 35.21, -80.94],
  ['PHX', 'Phoenix Sky Harbor International', 'Phoenix', 'United States', 33.43, -112.01],
  ['IAH', 'George Bush Intercontinental', 'Houston', 'United States', 29.98, -95.34],
  ['HOU', 'William P. Hobby', 'Houston', 'United States', 29.65, -95.28],
  ['MSP', 'Minneapolis-Saint Paul International', 'Minneapolis', 'United States', 44.88, -93.22],
  ['DTW', 'Detroit Metropolitan Wayne County', 'Detroit', 'United States', 42.21, -83.35],
  ['BOS', 'Boston Logan International', 'Boston', 'United States', 42.36, -71.01],
  ['PHL', 'Philadelphia International', 'Philadelphia', 'United States', 39.87, -75.24],
  ['BWI', 'Baltimore/Washington International', 'Baltimore', 'United States', 39.18, -76.67],
  ['DCA', 'Ronald Reagan Washington National', 'Washington', 'United States', 38.85, -77.04],
  ['IAD', 'Washington Dulles International', 'Washington', 'United States', 38.94, -77.46],
  ['SAN', 'San Diego International', 'San Diego', 'United States', 32.73, -117.19],
  ['SLC', 'Salt Lake City International', 'Salt Lake City', 'United States', 40.79, -111.98],
  ['PDX', 'Portland International', 'Portland', 'United States', 45.59, -122.6],
  ['AUS', 'Austin-Bergstrom International', 'Austin', 'United States', 30.2, -97.67],
  ['BNA', 'Nashville International', 'Nashville', 'United States', 36.12, -86.68],
  ['MSY', 'Louis Armstrong New Orleans International', 'New Orleans', 'United States', 29.99, -90.26],
  ['STL', 'St. Louis Lambert International', 'St. Louis', 'United States', 38.75, -90.37],
  ['MCI', 'Kansas City International', 'Kansas City', 'United States', 39.3, -94.71],
  ['RDU', 'Raleigh-Durham International', 'Raleigh', 'United States', 35.88, -78.79],
  ['CLE', 'Cleveland Hopkins International', 'Cleveland', 'United States', 41.41, -81.85],
  ['PIT', 'Pittsburgh International', 'Pittsburgh', 'United States', 40.49, -80.23],
  ['CVG', 'Cincinnati/Northern Kentucky International', 'Cincinnati', 'United States', 39.05, -84.67],
  ['CMH', 'John Glenn Columbus International', 'Columbus', 'United States', 39.99, -82.89],
  ['IND', 'Indianapolis International', 'Indianapolis', 'United States', 39.72, -86.29],
  ['SAT', 'San Antonio International', 'San Antonio', 'United States', 29.53, -98.47],
  ['SMF', 'Sacramento International', 'Sacramento', 'United States', 38.7, -121.59],
  ['SNA', 'John Wayne Airport', 'Orange County', 'United States', 33.68, -117.87],
  ['BUR', 'Hollywood Burbank', 'Burbank', 'United States', 34.2, -118.36],
  ['ONT', 'Ontario International', 'Ontario', 'United States', 34.06, -117.6],
  ['HNL', 'Daniel K. Inouye International', 'Honolulu', 'United States', 21.32, -157.92],
  ['OGG', 'Kahului', 'Maui', 'United States', 20.9, -156.43],
  ['ANC', 'Ted Stevens Anchorage International', 'Anchorage', 'United States', 61.17, -150.0],
  ['SJU', 'Luis Muñoz Marín International', 'San Juan', 'Puerto Rico', 18.44, -66.0],
  ['BDL', 'Bradley International', 'Hartford', 'United States', 41.94, -72.68],
  ['PVD', 'T. F. Green', 'Providence', 'United States', 41.72, -71.43],
  ['ABQ', 'Albuquerque International Sunport', 'Albuquerque', 'United States', 35.04, -106.61],
  ['BOI', 'Boise', 'Boise', 'United States', 43.56, -116.22],
  ['JAX', 'Jacksonville International', 'Jacksonville', 'United States', 30.49, -81.69],
  ['RSW', 'Southwest Florida International', 'Fort Myers', 'United States', 26.54, -81.76],
  ['PBI', 'Palm Beach International', 'West Palm Beach', 'United States', 26.68, -80.1],
  ['CHS', 'Charleston International', 'Charleston', 'United States', 32.9, -80.04],
  ['SAV', 'Savannah/Hilton Head International', 'Savannah', 'United States', 32.13, -81.2],
  ['MEM', 'Memphis International', 'Memphis', 'United States', 35.04, -89.98],
  ['OMA', 'Eppley Airfield', 'Omaha', 'United States', 41.3, -95.89],
  ['MKE', 'Milwaukee Mitchell International', 'Milwaukee', 'United States', 42.95, -87.9],
  ['YYZ', 'Toronto Pearson International', 'Toronto', 'Canada', 43.68, -79.63],
  ['YVR', 'Vancouver International', 'Vancouver', 'Canada', 49.19, -123.18],
  ['YUL', 'Montréal-Trudeau International', 'Montreal', 'Canada', 45.47, -73.74],
  ['YYC', 'Calgary International', 'Calgary', 'Canada', 51.11, -114.02],
  ['YEG', 'Edmonton International', 'Edmonton', 'Canada', 53.31, -113.58],
  ['YOW', 'Ottawa Macdonald-Cartier International', 'Ottawa', 'Canada', 45.32, -75.67],
  ['MEX', 'Benito Juárez International', 'Mexico City', 'Mexico', 19.44, -99.07],
  ['CUN', 'Cancún International', 'Cancún', 'Mexico', 21.04, -86.87],
  ['GDL', 'Guadalajara International', 'Guadalajara', 'Mexico', 20.52, -103.31],
  ['SJD', 'Los Cabos International', 'San José del Cabo', 'Mexico', 23.15, -109.72],
  ['PVR', 'Licenciado Gustavo Díaz Ordaz International', 'Puerto Vallarta', 'Mexico', 20.68, -105.25],
  ['NAS', 'Lynden Pindling International', 'Nassau', 'Bahamas', 25.04, -77.47],
  ['MBJ', 'Sangster International', 'Montego Bay', 'Jamaica', 18.5, -77.91],
  ['PUJ', 'Punta Cana International', 'Punta Cana', 'Dominican Republic', 18.57, -68.36],
  ['PTY', 'Tocumen International', 'Panama City', 'Panama', 9.07, -79.38],
  ['SJO', 'Juan Santamaría International', 'San José', 'Costa Rica', 9.99, -84.21],
  ['BOG', 'El Dorado International', 'Bogotá', 'Colombia', 4.7, -74.15],
  ['LIM', 'Jorge Chávez International', 'Lima', 'Peru', -12.02, -77.11],
  ['SCL', 'Arturo Merino Benítez International', 'Santiago', 'Chile', -33.39, -70.79],
  ['GRU', 'São Paulo/Guarulhos International', 'São Paulo', 'Brazil', -23.43, -46.47],
  ['GIG', 'Rio de Janeiro/Galeão International', 'Rio de Janeiro', 'Brazil', -22.81, -43.25],
  ['EZE', 'Ministro Pistarini International', 'Buenos Aires', 'Argentina', -34.82, -58.54],
  ['LHR', 'Heathrow', 'London', 'United Kingdom', 51.47, -0.45],
  ['LGW', 'Gatwick', 'London', 'United Kingdom', 51.15, -0.19],
  ['STN', 'Stansted', 'London', 'United Kingdom', 51.89, 0.26],
  ['LTN', 'Luton', 'London', 'United Kingdom', 51.87, -0.37],
  ['LCY', 'London City', 'London', 'United Kingdom', 51.5, 0.06],
  ['MAN', 'Manchester', 'Manchester', 'United Kingdom', 53.35, -2.27],
  ['EDI', 'Edinburgh', 'Edinburgh', 'United Kingdom', 55.95, -3.37],
  ['GLA', 'Glasgow', 'Glasgow', 'United Kingdom', 55.87, -4.43],
  ['BHX', 'Birmingham', 'Birmingham', 'United Kingdom', 52.45, -1.75],
  ['DUB', 'Dublin', 'Dublin', 'Ireland', 53.42, -6.27],
  ['SNN', 'Shannon', 'Shannon', 'Ireland', 52.7, -8.92],
  ['CDG', 'Charles de Gaulle', 'Paris', 'France', 49.01, 2.55],
  ['ORY', 'Orly', 'Paris', 'France', 48.72, 2.38],
  ['NCE', "Nice Côte d'Azur", 'Nice', 'France', 43.66, 7.22],
  ['LYS', 'Lyon-Saint Exupéry', 'Lyon', 'France', 45.73, 5.08],
  ['MRS', 'Marseille Provence', 'Marseille', 'France', 43.44, 5.22],
  ['AMS', 'Schiphol', 'Amsterdam', 'Netherlands', 52.31, 4.76],
  ['BRU', 'Brussels', 'Brussels', 'Belgium', 50.9, 4.48],
  ['FRA', 'Frankfurt', 'Frankfurt', 'Germany', 50.03, 8.57],
  ['MUC', 'Munich', 'Munich', 'Germany', 48.35, 11.79],
  ['BER', 'Berlin Brandenburg', 'Berlin', 'Germany', 52.36, 13.5],
  ['HAM', 'Hamburg', 'Hamburg', 'Germany', 53.63, 9.99],
  ['DUS', 'Düsseldorf', 'Düsseldorf', 'Germany', 51.29, 6.77],
  ['ZRH', 'Zürich', 'Zürich', 'Switzerland', 47.46, 8.55],
  ['GVA', 'Geneva', 'Geneva', 'Switzerland', 46.24, 6.11],
  ['VIE', 'Vienna International', 'Vienna', 'Austria', 48.11, 16.57],
  ['PRG', 'Václav Havel Prague', 'Prague', 'Czechia', 50.1, 14.26],
  ['BUD', 'Budapest Ferenc Liszt International', 'Budapest', 'Hungary', 47.44, 19.26],
  ['WAW', 'Warsaw Chopin', 'Warsaw', 'Poland', 52.17, 20.97],
  ['CPH', 'Copenhagen', 'Copenhagen', 'Denmark', 55.62, 12.65],
  ['ARN', 'Stockholm Arlanda', 'Stockholm', 'Sweden', 59.65, 17.92],
  ['OSL', 'Oslo Gardermoen', 'Oslo', 'Norway', 60.19, 11.1],
  ['HEL', 'Helsinki-Vantaa', 'Helsinki', 'Finland', 60.32, 24.96],
  ['KEF', 'Keflavík International', 'Reykjavík', 'Iceland', 63.99, -22.62],
  ['MAD', 'Adolfo Suárez Madrid–Barajas', 'Madrid', 'Spain', 40.47, -3.56],
  ['BCN', 'Barcelona–El Prat', 'Barcelona', 'Spain', 41.3, 2.08],
  ['AGP', 'Málaga', 'Málaga', 'Spain', 36.67, -4.5],
  ['PMI', 'Palma de Mallorca', 'Palma', 'Spain', 39.55, 2.74],
  ['LIS', 'Humberto Delgado', 'Lisbon', 'Portugal', 38.77, -9.13],
  ['OPO', 'Francisco Sá Carneiro', 'Porto', 'Portugal', 41.24, -8.68],
  ['FCO', 'Leonardo da Vinci–Fiumicino', 'Rome', 'Italy', 41.8, 12.24],
  ['CIA', 'Ciampino', 'Rome', 'Italy', 41.8, 12.59],
  ['MXP', 'Milan Malpensa', 'Milan', 'Italy', 45.63, 8.72],
  ['LIN', 'Milan Linate', 'Milan', 'Italy', 45.45, 9.28],
  ['VCE', 'Venice Marco Polo', 'Venice', 'Italy', 45.5, 12.35],
  ['NAP', 'Naples International', 'Naples', 'Italy', 40.89, 14.29],
  ['FLR', 'Florence Peretola', 'Florence', 'Italy', 43.81, 11.2],
  ['ATH', 'Athens Eleftherios Venizelos', 'Athens', 'Greece', 37.94, 23.94],
  ['JTR', 'Santorini', 'Santorini', 'Greece', 36.4, 25.48],
  ['IST', 'Istanbul', 'Istanbul', 'Türkiye', 41.28, 28.74],
  ['SAW', 'Sabiha Gökçen International', 'Istanbul', 'Türkiye', 40.9, 29.31],
  ['DXB', 'Dubai International', 'Dubai', 'United Arab Emirates', 25.25, 55.36],
  ['AUH', 'Abu Dhabi International', 'Abu Dhabi', 'United Arab Emirates', 24.43, 54.65],
  ['DOH', 'Hamad International', 'Doha', 'Qatar', 25.27, 51.61],
  ['TLV', 'Ben Gurion', 'Tel Aviv', 'Israel', 32.01, 34.89],
  ['CAI', 'Cairo International', 'Cairo', 'Egypt', 30.12, 31.41],
  ['JNB', 'O. R. Tambo International', 'Johannesburg', 'South Africa', -26.14, 28.25],
  ['CPT', 'Cape Town International', 'Cape Town', 'South Africa', -33.97, 18.6],
  ['NBO', 'Jomo Kenyatta International', 'Nairobi', 'Kenya', -1.32, 36.93],
  ['CMN', 'Mohammed V International', 'Casablanca', 'Morocco', 33.37, -7.59],
  ['DEL', 'Indira Gandhi International', 'Delhi', 'India', 28.56, 77.1],
  ['BOM', 'Chhatrapati Shivaji Maharaj International', 'Mumbai', 'India', 19.09, 72.87],
  ['BLR', 'Kempegowda International', 'Bengaluru', 'India', 13.2, 77.71],
  ['SIN', 'Changi', 'Singapore', 'Singapore', 1.36, 103.99],
  ['BKK', 'Suvarnabhumi', 'Bangkok', 'Thailand', 13.69, 100.75],
  ['HKT', 'Phuket International', 'Phuket', 'Thailand', 8.11, 98.32],
  ['KUL', 'Kuala Lumpur International', 'Kuala Lumpur', 'Malaysia', 2.75, 101.71],
  ['CGK', 'Soekarno–Hatta International', 'Jakarta', 'Indonesia', -6.13, 106.66],
  ['DPS', 'Ngurah Rai International', 'Denpasar (Bali)', 'Indonesia', -8.75, 115.17],
  ['MNL', 'Ninoy Aquino International', 'Manila', 'Philippines', 14.51, 121.02],
  ['SGN', 'Tan Son Nhat International', 'Ho Chi Minh City', 'Vietnam', 10.82, 106.65],
  ['HAN', 'Noi Bai International', 'Hanoi', 'Vietnam', 21.22, 105.81],
  ['HKG', 'Hong Kong International', 'Hong Kong', 'Hong Kong', 22.31, 113.91],
  ['PEK', 'Beijing Capital International', 'Beijing', 'China', 40.08, 116.58],
  ['PKX', 'Beijing Daxing International', 'Beijing', 'China', 39.51, 116.41],
  ['PVG', 'Shanghai Pudong International', 'Shanghai', 'China', 31.14, 121.81],
  ['CAN', 'Guangzhou Baiyun International', 'Guangzhou', 'China', 23.39, 113.3],
  ['TPE', 'Taiwan Taoyuan International', 'Taipei', 'Taiwan', 25.08, 121.23],
  ['ICN', 'Incheon International', 'Seoul', 'South Korea', 37.46, 126.44],
  ['GMP', 'Gimpo International', 'Seoul', 'South Korea', 37.56, 126.79],
  ['NRT', 'Narita International', 'Tokyo', 'Japan', 35.77, 140.39],
  ['HND', 'Haneda', 'Tokyo', 'Japan', 35.55, 139.78],
  ['KIX', 'Kansai International', 'Osaka', 'Japan', 34.43, 135.24],
  ['ITM', 'Osaka Itami', 'Osaka', 'Japan', 34.79, 135.44],
  ['SYD', 'Sydney Kingsford Smith', 'Sydney', 'Australia', -33.95, 151.18],
  ['MEL', 'Melbourne', 'Melbourne', 'Australia', -37.67, 144.84],
  ['BNE', 'Brisbane', 'Brisbane', 'Australia', -27.38, 153.12],
  ['PER', 'Perth', 'Perth', 'Australia', -31.94, 115.97],
  ['AKL', 'Auckland', 'Auckland', 'New Zealand', -37.01, 174.79],
  ['CHC', 'Christchurch', 'Christchurch', 'New Zealand', -43.49, 172.53],
  ['NAN', 'Nadi International', 'Nadi', 'Fiji', -17.76, 177.44],
];

export const AIRPORTS: Airport[] = RAW.map(([code, name, city, country, lat, lon]) => ({ code, name, city, country, lat, lon }));

/** "LAX – Los Angeles International, Los Angeles" */
export function airportLabel(a: Pick<Airport, 'code' | 'name' | 'city'>): string {
  return `${a.code} – ${a.name}${a.city && !a.name.includes(a.city) ? `, ${a.city}` : ''}`;
}

export function airportByCode(code: string): Airport | undefined {
  const c = code.trim().toUpperCase();
  return AIRPORTS.find((a) => a.code === c);
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Bundled airports matching a code, city, airport name or country; exact code first. */
export function searchAirports(query: string, limit = 8): Airport[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const scored: { a: Airport; score: number }[] = [];
  for (const a of AIRPORTS) {
    const code = a.code.toLowerCase();
    const city = fold(a.city);
    const name = fold(a.name);
    let score = 0;
    if (code === q) score = 100;
    else if (code.startsWith(q)) score = 60;
    else if (city === q) score = 50;
    else if (city.startsWith(q)) score = 40;
    else if (name.includes(q)) score = 30;
    else if (city.includes(q)) score = 20;
    else if (fold(a.country).startsWith(q)) score = 5;
    if (score) scored.push({ a, score });
  }
  return scored.sort((x, y) => y.score - x.score || x.a.code.localeCompare(y.a.code)).slice(0, limit).map((s) => s.a);
}

/** A bundled airport serving a point: the first listed (larger hubs come first) within `maxKm`. */
export function nearestAirport(lat: number, lon: number, maxKm = 100): Airport | undefined {
  const rad = Math.PI / 180;
  return AIRPORTS.find((a) => {
    const dLat = (a.lat - lat) * rad;
    const dLon = (a.lon - lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(a.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) <= maxKm;
  });
}

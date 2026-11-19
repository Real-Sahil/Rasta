/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LocationPoint, CommunityIncident, EmergencyContact } from '../types';

export const LAHORE_DEFAULT_CENTER = {
  lat: 31.5102,
  lng: 74.3441,
  name: 'Liberty Chowk, Gulberg III',
  nameUrdu: 'لبرٹی چوک، گلبرگ ۳'
};

export const POPULAR_LOCATIONS: LocationPoint[] = [
  {
    id: 'liberty_chowk',
    name: 'Liberty Chowk, Gulberg',
    nameUrdu: 'لبرٹی چوک، گلبرگ',
    lat: 31.5102,
    lng: 74.3441,
    address: 'Gulberg III, Main Boulevard, Lahore',
    addressUrdu: 'گلبرگ ۳، مین بلیوارڈ، لاہور',
    category: 'hub'
  },
  {
    id: 'kalma_chowk',
    name: 'Kalma Chowk Flyover & Underpass',
    nameUrdu: 'کلمہ چوک فلائی اوور اور انڈر پاس',
    lat: 31.5036,
    lng: 74.3317,
    address: 'Ferozepur Road / Main Boulevard, Lahore',
    addressUrdu: 'فیروزپور روڈ / مین بلیوارڈ، لاہور',
    category: 'metro'
  },
  {
    id: 'badshahi_mosque',
    name: 'Badshahi Mosque & Lahore Fort',
    nameUrdu: 'بادشاہی مسجد و شاہی قلعہ',
    lat: 31.5881,
    lng: 74.3094,
    address: 'Walled City, Circular Road, Lahore',
    addressUrdu: 'اندرون لاہور، سرکلر روڈ، لاہور',
    category: 'hub'
  },
  {
    id: 'packages_mall',
    name: 'Packages Mall, Walton',
    nameUrdu: 'پیکیجز مال، والٹن روڈ',
    lat: 31.4727,
    lng: 74.3644,
    address: 'Walton Road, Shahrah-e-Roomi, Lahore',
    addressUrdu: 'والٹن روڈ، شاہراہ رومی، لاہور',
    category: 'hub'
  },
  {
    id: 'emporium_mall',
    name: 'Emporium Mall, Johar Town',
    nameUrdu: 'ایمپوریم مال، جوہر ٹاؤن',
    lat: 31.4682,
    lng: 74.2750,
    address: 'Abdul Haque Road, Trade Centre Commercial, Johar Town',
    addressUrdu: 'عبدالحق روڈ، ٹریڈ سنٹر، جوہر ٹاؤن',
    category: 'hub'
  },
  {
    id: 'lahore_airport',
    name: 'Allama Iqbal International Airport (LHE)',
    nameUrdu: 'علامہ اقبال انٹرنیشنل ایئرپورٹ (لاہور)',
    lat: 31.5216,
    lng: 74.4036,
    address: 'Airport Road, Cantt, Lahore',
    addressUrdu: 'ایئرپورٹ روڈ، کینٹ، لاہور',
    category: 'hub'
  },
  {
    id: 'thokar_niaz_baig',
    name: 'Thokar Niaz Baig / Canal Entrance',
    nameUrdu: 'ٹھوکر نیاز بیگ / نہر داخلہ',
    lat: 31.4674,
    lng: 74.2372,
    address: 'Multan Road & Canal Bank Road Intersection',
    addressUrdu: 'ملتان روڈ و کینال بینک روڈ چوراہا',
    category: 'orangeline'
  },
  {
    id: 'lahore_railway_station',
    name: 'Lahore Junction Railway Station',
    nameUrdu: 'لاہور جنکشن ریلوے اسٹیشن',
    lat: 31.5794,
    lng: 74.3323,
    address: 'Empress Road, Railway Colony, Lahore',
    addressUrdu: 'ایمپریس روڈ، ریلوے کالونی، لاہور',
    category: 'orangeline'
  },
  {
    id: 'gaddafi_stadium',
    name: 'Gaddafi Stadium / Nishtar Sports Complex',
    nameUrdu: 'قذافی اسٹیڈیم / نشتر اسپورٹس کمپلیکس',
    lat: 31.5135,
    lng: 74.3337,
    address: 'Ferozepur Road, Gulberg III, Lahore',
    addressUrdu: 'فیروزپور روڈ، گلبرگ ۳، لاہور',
    category: 'metro'
  },
  {
    id: 'dha_phase5',
    name: 'DHA Phase 5 Commercial CCA',
    nameUrdu: 'ڈی ایچ اے فیز ۵ کمرشل',
    lat: 31.4647,
    lng: 74.4121,
    address: 'Defence Housing Authority Phase 5, Lahore',
    addressUrdu: 'ڈی ایچ اے فیز ۵، لاہور',
    category: 'hub'
  },
  {
    id: 'chauburji',
    name: 'Chauburji Monument',
    nameUrdu: 'چوبرجی یادگار',
    lat: 31.5544,
    lng: 74.3039,
    address: 'Multan Road / Bahawalpur Road, Lahore',
    addressUrdu: 'ملتان روڈ / بہاولپور روڈ، لاہور',
    category: 'orangeline'
  },
  {
    id: 'anarkali_bazaar',
    name: 'Anarkali Bazaar & Mall Road',
    nameUrdu: 'انارکلی بازار و مال روڈ',
    lat: 31.5692,
    lng: 74.3144,
    address: 'Shahrah-e-Quaid-e-Azam (Mall Road), Lahore',
    addressUrdu: 'شاہراہ قائد اعظم (مال روڈ)، لاہور',
    category: 'orangeline'
  }
];

// No seeded incidents: only reports created by real users are shown.
export const INITIAL_INCIDENTS: CommunityIncident[] = [];

export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    id: 'rescue1122',
    title: 'Rescue 1122 Punjab Emergency Service',
    titleUrdu: 'ریسکیو ۱۱۲۲ پنجاب ایمرجنسی سروس',
    number: '1122',
    category: 'rescue',
    description: 'Free 24/7 Ambulance, Fire, Urban Search & Water Rescue in Punjab',
    descriptionUrdu: 'پنجاب بھر میں مفت ۲۴ گھنٹے ایمبولینس، فائر بریگیڈ اور ریسکیو'
  },
  {
    id: 'police15',
    title: 'Rescue 15 Police Assistance (Punjab Police)',
    titleUrdu: 'پولیس ہیلپ لائن ۱۵ (پنجاب پولیس)',
    number: '15',
    category: 'police',
    description: 'Emergency police response, accident assistance, and mobile patrols',
    descriptionUrdu: 'پولیس ایمرجنسی، روڈ حادثات پر مدد اور گشت'
  },
  {
    id: 'nhmp130',
    title: 'Motorway Police Helpline (NH&MP 130)',
    titleUrdu: 'موٹروے پولیس ہیلپ لائن ۱۳۰',
    number: '130',
    category: 'motorway',
    description: 'Lahore-Islamabad M2, M3, Ring Road & National Highways emergency recovery',
    descriptionUrdu: 'ایم ۲، ایم ۳، رنگ روڈ اور نیشنل ہائی ویز پر ہنگامی مدد'
  },
  {
    id: 'edhi115',
    title: 'Edhi Foundation Ambulance Service',
    titleUrdu: 'ایدھی فاؤنڈیشن ایمبولینس سروس',
    number: '115',
    category: 'ambulance',
    description: 'Rapid private ambulance dispatch across all Lahore sectors',
    descriptionUrdu: 'لاہور کے تمام علاقوں میں فوری ایدھی ایمبولینس'
  }
];

/** Cities offered for weather / air quality (Open-Meteo works anywhere; these are just convenient picks). */
export const PK_CITIES: { id: string; en: string; ur: string; lat: number; lng: number }[] = [
  { id: 'lahore', en: 'Lahore', ur: 'لاہور', lat: 31.5204, lng: 74.3587 },
  { id: 'karachi', en: 'Karachi', ur: 'کراچی', lat: 24.8607, lng: 67.0011 },
  { id: 'islamabad', en: 'Islamabad', ur: 'اسلام آباد', lat: 33.6844, lng: 73.0479 },
  { id: 'rawalpindi', en: 'Rawalpindi', ur: 'راولپنڈی', lat: 33.5651, lng: 73.0169 },
  { id: 'multan', en: 'Multan', ur: 'ملتان', lat: 30.1575, lng: 71.5249 },
  { id: 'faisalabad', en: 'Faisalabad', ur: 'فیصل آباد', lat: 31.4504, lng: 73.135 },
  { id: 'peshawar', en: 'Peshawar', ur: 'پشاور', lat: 34.0151, lng: 71.5249 },
  { id: 'quetta', en: 'Quetta', ur: 'کوئٹہ', lat: 30.1798, lng: 66.975 },
  { id: 'hyderabad', en: 'Hyderabad', ur: 'حیدرآباد', lat: 25.396, lng: 68.3578 },
  { id: 'gujranwala', en: 'Gujranwala', ur: 'گوجرانوالہ', lat: 32.1877, lng: 74.1945 },
  { id: 'sialkot', en: 'Sialkot', ur: 'سیالکوٹ', lat: 32.4945, lng: 74.5229 },
  { id: 'sargodha', en: 'Sargodha', ur: 'سرگودھا', lat: 32.0836, lng: 72.6711 },
  { id: 'bahawalpur', en: 'Bahawalpur', ur: 'بہاولپور', lat: 29.3956, lng: 71.6836 },
  { id: 'sukkur', en: 'Sukkur', ur: 'سکھر', lat: 27.7052, lng: 68.8574 },
  { id: 'abbottabad', en: 'Abbottabad', ur: 'ایبٹ آباد', lat: 34.1688, lng: 73.2215 },
  { id: 'muzaffarabad', en: 'Muzaffarabad', ur: 'مظفرآباد', lat: 34.37, lng: 73.4711 },
  { id: 'gilgit', en: 'Gilgit', ur: 'گلگت', lat: 35.9208, lng: 74.308 },
  { id: 'gwadar', en: 'Gwadar', ur: 'گوادر', lat: 25.1264, lng: 62.3225 }
];

export const CITY_CENTERS: Record<string, { lat: number; lng: number }> = Object.fromEntries(PK_CITIES.map((c) => [c.id, { lat: c.lat, lng: c.lng }]));

/** Nearest listed city within 80 km of a real fix, else null. */
export function nearestCityId(p: { lat: number; lng: number } | null | undefined): string | null {
  if (!p) return null;
  let best: string | null = null;
  let bestKm = 80;
  for (const c of PK_CITIES) {
    const dLat = ((c.lat - p.lat) * Math.PI) / 180, dLng = ((c.lng - p.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((p.lat * Math.PI) / 180) * Math.cos((c.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const km = 12742 * Math.asin(Math.sqrt(a));
    if (km < bestKm) { bestKm = km; best = c.id; }
  }
  return best;
}

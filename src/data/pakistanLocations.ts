/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LocationPoint, TransitStation, CommunityIncident, EmergencyContact, LocalService } from '../types';

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
    addressUrdu: 'ایم Empress روڈ، ریلوے کالونی، لاہور',
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

export const METROBUS_STATIONS: TransitStation[] = [
  { id: 'mb_shahdara', code: 'MB01', name: 'Shahdara Terminal', nameUrdu: 'شاہدرہ ٹرمینل', line: 'metrobus', lat: 31.6212, lng: 74.2882, zone: 1, facilities: ['Token Counter', 'Metro Card Recharge', 'Wheelchair Ramp', 'Park & Ride'] },
  { id: 'mb_niazi', code: 'MB02', name: 'Niazi Chowk', nameUrdu: 'نیازی چوک', line: 'metrobus', lat: 31.6094, lng: 74.2960, zone: 1, facilities: ['Token Counter', 'Metro Card Recharge'] },
  { id: 'mb_azadi', code: 'MB03', name: 'Azadi Chowk (Minar-e-Pakistan)', nameUrdu: 'آزادی چوک (مینارِ پاکستان)', line: 'metrobus', lat: 31.5932, lng: 74.3090, zone: 1, facilities: ['Token Counter', 'Washrooms', 'Metro Card'] },
  { id: 'mb_bhatti', code: 'MB04', name: 'Bhatti Chowk', nameUrdu: 'بھٹی چوک', line: 'metrobus', lat: 31.5830, lng: 74.3075, zone: 1, facilities: ['Token Counter', 'Elevator'] },
  { id: 'mb_kachehri', code: 'MB05', name: 'Kachehri (District Courts)', nameUrdu: 'کچہری', line: 'metrobus', lat: 31.5714, lng: 74.3061, zone: 1, facilities: ['Token Counter'] },
  { id: 'mb_mao', code: 'MB06', name: 'MAO College', nameUrdu: 'ایم اے او کالج', line: 'metrobus', lat: 31.5647, lng: 74.3082, zone: 1, facilities: ['Token Counter', 'Student Concession Desk'] },
  { id: 'mb_qartaba', code: 'MB07', name: 'Qartaba Chowk (Mozang)', nameUrdu: 'قرطبہ چوک (موزنگ)', line: 'metrobus', lat: 31.5471, lng: 74.3142, zone: 1, facilities: ['Token Counter', 'Metro Card'] },
  { id: 'mb_shama', code: 'MB08', name: 'Shama Chowk', nameUrdu: 'شمع چوک', line: 'metrobus', lat: 31.5350, lng: 74.3180, zone: 2, facilities: ['Token Counter'] },
  { id: 'mb_ichhra', code: 'MB09', name: 'Ichhra Bazaar', nameUrdu: 'اچھرہ بازار', line: 'metrobus', lat: 31.5230, lng: 74.3210, zone: 2, facilities: ['Token Counter', 'Wheelchair Ramp'] },
  { id: 'mb_canal', code: 'MB10', name: 'Canal Station', nameUrdu: 'کینال اسٹیشن', line: 'metrobus', lat: 31.5175, lng: 74.3262, zone: 2, facilities: ['Token Counter', 'Underpass Link'] },
  { id: 'mb_gaddafi', code: 'MB11', name: 'Gaddafi Stadium Station', nameUrdu: 'قذافی اسٹیڈیم اسٹیشن', line: 'metrobus', lat: 31.5135, lng: 74.3337, zone: 2, facilities: ['Token Counter', 'Sports Complex Exit'] },
  { id: 'mb_kalma', code: 'MB12', name: 'Kalma Chowk Station', nameUrdu: 'کلمہ چوک اسٹیشن', line: 'metrobus', lat: 31.5036, lng: 74.3317, zone: 2, facilities: ['Token Counter', 'Metro Card Machine', 'Underpass Access'] },
  { id: 'mb_modeltown', code: 'MB13', name: 'Model Town Station', nameUrdu: 'ماڈل ٹاؤن اسٹیشن', line: 'metrobus', lat: 31.4870, lng: 74.3360, zone: 2, facilities: ['Token Counter', 'Feeder Bus Stop'] },
  { id: 'mb_chungi', code: 'MB14', name: 'Chungi Amar Sidhu', nameUrdu: 'چنگی امر سدھو', line: 'metrobus', lat: 31.4580, lng: 74.3480, zone: 3, facilities: ['Token Counter'] },
  { id: 'mb_kamahan', code: 'MB15', name: 'Kamahan Metro Station', nameUrdu: 'کماہاں اسٹیشن', line: 'metrobus', lat: 31.4390, lng: 74.3540, zone: 3, facilities: ['Token Counter'] },
  { id: 'mb_gajumata', code: 'MB16', name: 'Gaju Matah Terminal', nameUrdu: 'گجو متہ ٹرمینل', line: 'metrobus', lat: 31.3916, lng: 74.3622, zone: 3, facilities: ['Token Counter', 'Bus Depot', 'Park & Ride'] }
];

export const ORANGELINE_STATIONS: TransitStation[] = [
  { id: 'ol_ali_town', code: 'OL01', name: 'Ali Town Terminal', nameUrdu: 'علی ٹاؤن ٹرمینل', line: 'orangeline', lat: 31.4552, lng: 74.2443, zone: 1, facilities: ['Automated Ticket Gates', 'Escalators', 'Elevators', 'Park & Ride'] },
  { id: 'ol_thokar', code: 'OL02', name: 'Thokar Niaz Baig Station', nameUrdu: 'ٹھوکر نیاز بیگ اسٹیشن', line: 'orangeline', lat: 31.4674, lng: 74.2372, zone: 1, facilities: ['Automated Gates', 'Motorway Connector'] },
  { id: 'ol_canal_view', code: 'OL03', name: 'Canal View', nameUrdu: 'کینال ویو', line: 'orangeline', lat: 31.4782, lng: 74.2435, zone: 1, facilities: ['Ticket Vending Machines'] },
  { id: 'ol_hanjarwal', code: 'OL04', name: 'Hanjarwal', nameUrdu: 'ہنجروال', line: 'orangeline', lat: 31.4920, lng: 74.2540, zone: 1, facilities: ['Elevator', 'Token Gates'] },
  { id: 'ol_wahdat', code: 'OL05', name: 'Wahdat Road Station', nameUrdu: 'وحدت روڈ اسٹیشن', line: 'orangeline', lat: 31.5030, lng: 74.2660, zone: 2, facilities: ['Escalators', 'Token Counters'] },
  { id: 'ol_awan_town', code: 'OL06', name: 'Awan Town', nameUrdu: 'اعوان ٹاؤن', line: 'orangeline', lat: 31.5120, lng: 74.2750, zone: 2, facilities: ['Token Gates'] },
  { id: 'ol_sabzazar', code: 'OL07', name: 'Sabzazar Station', nameUrdu: 'سبزہ زار اسٹیشن', line: 'orangeline', lat: 31.5230, lng: 74.2830, zone: 2, facilities: ['Automated Gates', 'Feeder Link'] },
  { id: 'ol_bund_road', code: 'OL08', name: 'Bund Road', nameUrdu: 'بند روڈ', line: 'orangeline', lat: 31.5360, lng: 74.2930, zone: 2, facilities: ['Token Vending', 'Ramp'] },
  { id: 'ol_samanabad', code: 'OL09', name: 'Samanabad Station', nameUrdu: 'سمن آباد اسٹیشن', line: 'orangeline', lat: 31.5450, lng: 74.2990, zone: 2, facilities: ['Ticket Gates', 'Elevators'] },
  { id: 'ol_chauburji', code: 'OL10', name: 'Chauburji Station', nameUrdu: 'چوبرجی اسٹیشن', line: 'orangeline', lat: 31.5544, lng: 74.3039, zone: 2, facilities: ['Elevated Walkway', 'Historic Viewpoint'] },
  { id: 'ol_anarkali', code: 'OL11', name: 'Anarkali Underground Station', nameUrdu: 'انارکلی زیرِ زمین اسٹیشن', line: 'orangeline', lat: 31.5650, lng: 74.3120, zone: 3, facilities: ['Underground Sub-surface', 'Climate Controlled', 'Mall Road Direct Exit'] },
  { id: 'ol_gpo', code: 'OL12', name: 'Central GPO Station', nameUrdu: 'جی پی او سنٹرل اسٹیشن', line: 'orangeline', lat: 31.5695, lng: 74.3168, zone: 3, facilities: ['Underground', 'Direct Postal Complex Entry'] },
  { id: 'ol_lakshmi', code: 'OL13', name: 'Lakshmi Chowk Station', nameUrdu: 'لکشمی چوک اسٹیشن', line: 'orangeline', lat: 31.5735, lng: 74.3245, zone: 3, facilities: ['Ticket Machines', 'Underpass Link'] },
  { id: 'ol_railway', code: 'OL14', name: 'Railway Station Junction', nameUrdu: 'ریلوے اسٹیشن جنکشن', line: 'orangeline', lat: 31.5794, lng: 74.3323, zone: 3, facilities: ['Direct Train Platform Walkway', 'PMA Integrated Interchange'] },
  { id: 'ol_sultanpura', code: 'OL15', name: 'Sultanpura', nameUrdu: 'سلطان پورہ', line: 'orangeline', lat: 31.5840, lng: 74.3450, zone: 3, facilities: ['Token Gates', 'Escalators'] },
  { id: 'ol_uet', code: 'OL16', name: 'UET Lahore (Grand Trunk Rd)', nameUrdu: 'یو ای ٹی جی ٹی روڈ اسٹیشن', line: 'orangeline', lat: 31.5815, lng: 74.3590, zone: 3, facilities: ['Student Concession Helpdesk', 'University Gate Link'] },
  { id: 'ol_shalamar', code: 'OL17', name: 'Shalamar Gardens Station', nameUrdu: 'شالامار باغ اسٹیشن', line: 'orangeline', lat: 31.5860, lng: 74.3810, zone: 4, facilities: ['Tourism Info', 'Automated Gates'] },
  { id: 'ol_dera_gujran', code: 'OL18', name: 'Dera Gujran Terminal', nameUrdu: 'ڈیرہ گجراں ٹرمینل', line: 'orangeline', lat: 31.6022, lng: 74.4379, zone: 4, facilities: ['Train Maintenance Depot', 'Ring Road Interchange', 'Park & Ride'] }
];

export const INITIAL_INCIDENTS: CommunityIncident[] = [
  {
    id: 'inc_1',
    title: 'Canal Road Underpass Maintenance & Single Lane',
    titleUrdu: 'کینال روڈ نیو کیمپس انڈرپاس مرمت و سنگل لین',
    category: 'construction',
    locationName: 'Campus Bridge Underpass, Canal Bank Road',
    locationNameUrdu: 'نیو کیمپس انڈرپاس، کینال بینک روڈ',
    lat: 31.5050,
    lng: 74.3080,
    description: 'Underpass expansion joint repair. Fast lane closed heading towards Thokar. Severe slow crawl.',
    descriptionUrdu: 'کینال روڈ انڈرپاس کے جوائنٹ کی مرمت۔ ٹھوکر کی طرف جانے والی تیز لین بند ہے۔ گاڑیوں کی لمبی قطار۔',
    timestamp: Date.now() - 28 * 60 * 1000,
    upvotes: 24,
    userConfirmed: true,
    credibilityScore: 96,
    isOfficialVerified: true,
    source: 'PSCA',
    alternativeRouteAdvice: 'Divert through Wahdat Road or Garden Town to avoid 25 mins delay.',
    alternativeRouteAdviceUrdu: '۲۵ منٹ کی تاخیر سے بچنے کے لیے وحدت روڈ یا گارڈن ٹاؤن کا راستہ اختیار کریں۔',
    expiresAt: Date.now() + 180 * 60 * 1000
  },
  {
    id: 'inc_2',
    title: 'Waterlogging After Rain near Lakshmi Chowk',
    titleUrdu: 'بارش کے بعد لکشمی چوک پر پانی کا جماؤ',
    category: 'flooding',
    locationName: 'Lakshmi Chowk & McLeod Road Junction',
    locationNameUrdu: 'لکشمی چوک و میکلوڈ روڈ چوراہا',
    lat: 31.5735,
    lng: 74.3245,
    description: 'WASA dewatering machinery operating. 1.5 ft water near cinema crossing. Motorbikes advised to avoid.',
    descriptionUrdu: 'واسا کا پانی نکالنے والا ٹینکر کام کر رہا ہے۔ ۱.۵ فٹ پانی جمع ہے۔ موٹر سائیکل سوار احتیاط کریں۔',
    timestamp: Date.now() - 45 * 60 * 1000,
    upvotes: 18,
    userConfirmed: false,
    credibilityScore: 91,
    isOfficialVerified: false,
    source: 'Citizen_Report',
    alternativeRouteAdvice: 'Take Abbott Road or Davis Road towards Railway Station.',
    alternativeRouteAdviceUrdu: 'ریلوے اسٹیشن کے لیے ایبٹ روڈ یا ڈیوس روڈ کا انتخاب کریں۔',
    expiresAt: Date.now() + 120 * 60 * 1000
  },
  {
    id: 'inc_3',
    title: 'Severe Traffic Congestion at Kalma Chowk Signal',
    titleUrdu: 'کلمہ چوک پر شدید ٹریفک کا دباؤ',
    category: 'congestion',
    locationName: 'Kalma Chowk CBD Underpass Towards Barkat Market',
    locationNameUrdu: 'کلمہ چوک انڈرپاس برکت مارکیٹ رخ',
    lat: 31.5036,
    lng: 74.3317,
    description: 'Broken down dumper truck removed, but bottleneck persists. Heavy slow moving rush.',
    descriptionUrdu: 'خراب ڈمپر ٹرک ہٹا لیا گیا ہے لیکن ٹریفک کا شدید رش تاحال برقرار ہے۔',
    timestamp: Date.now() - 15 * 60 * 1000,
    upvotes: 32,
    userConfirmed: true,
    credibilityScore: 98,
    isOfficialVerified: true,
    source: 'CTPL_Punjab',
    alternativeRouteAdvice: 'Use Ferozepur elevated corridor or Centre Point roundabout.',
    alternativeRouteAdviceUrdu: 'فیروزپور ایلیویٹڈ کوریڈور یا سنٹر پوائنٹ راؤنڈ اباؤٹ استعمال کریں۔',
    expiresAt: Date.now() + 90 * 60 * 1000
  },
  {
    id: 'inc_4',
    title: 'Road Blockage / Protest Near Lower Mall',
    titleUrdu: 'لوئر مال کے قریب سڑک پر رکاوٹ و مظاہرہ',
    category: 'roadblock',
    locationName: 'Lower Mall Road Near Civil Secretariat',
    locationNameUrdu: 'لوئر مال روڈ نزد سول سیکرٹریٹ',
    lat: 31.5640,
    lng: 74.3040,
    description: 'Peaceful union rally. Diversions placed by City Traffic Police Lahore.',
    descriptionUrdu: 'ملازمین کا پرامن احتجاج۔ ٹریفک پولیس کی جانب سے متبادل روٹس تشکیل۔',
    timestamp: Date.now() - 60 * 60 * 1000,
    upvotes: 14,
    userConfirmed: false,
    credibilityScore: 88,
    isOfficialVerified: true,
    source: 'CTPL_Punjab',
    alternativeRouteAdvice: 'Traffic diverted via Kachehri Chowk to Ravi Road.',
    alternativeRouteAdviceUrdu: 'ٹریفک کو کچہری چوک سے راوی روڈ کی جانب موڑ دیا گیا ہے۔',
    expiresAt: Date.now() + 60 * 60 * 1000
  }
];

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
    id: 'ctpl_rasta',
    title: 'City Traffic Police Lahore (CTPL) Rasta Helpline',
    titleUrdu: 'سٹی ٹریفک پولیس لاہور راستہ ہیلپ لائن',
    number: '042-99201996',
    category: 'traffic',
    description: 'Live traffic updates, road clearance, breakdown recovery & vehicle towing',
    descriptionUrdu: 'لائیو ٹریفک رہنمائی، گاڑی خراب ہونے پر لفٹر سروس'
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

export const LOCAL_SERVICES: LocalService[] = [
  {
    id: 'pso_liberty',
    name: 'PSO Fuel Station & Fast Puncture',
    nameUrdu: 'پی ایس او پٹرول پمپ و پنکچر شاپ',
    type: 'petrol',
    lat: 31.5125,
    lng: 74.3418,
    address: 'Main Boulevard, Gulberg III, Lahore',
    addressUrdu: 'مین بلیوارڈ، گلبرگ ۳، لاہور',
    phone: '042-35751240',
    isOpen24Hours: true,
    rating: 4.6,
    fuelAvailable: { petrol: true, diesel: true, cng: false }
  },
  {
    id: 'shell_ferozepur',
    name: 'Shell Select & 24/7 Tyre Care',
    nameUrdu: 'شیل سلیکٹ پمپ و ٹائر کیئر',
    type: 'petrol',
    lat: 31.4980,
    lng: 74.3340,
    address: 'Near Model Town Crossing, Ferozepur Road',
    addressUrdu: 'نزد ماڈل ٹاؤن موڑ، فیروزپور روڈ',
    phone: '042-35882341',
    isOpen24Hours: true,
    rating: 4.8,
    fuelAvailable: { petrol: true, diesel: true, cng: true }
  },
  {
    id: 'puncture_canal',
    name: 'Ustad Aslam 24/7 Tubeless Puncture & Mobile Mechanic',
    nameUrdu: 'استاد اسلم ۲۴ گھنٹے ٹیوب لیس پنکچر و مکینک',
    type: 'puncture',
    lat: 31.5190,
    lng: 74.3310,
    address: 'Canal Bank Road, Under Muslim Town Flyover',
    addressUrdu: 'کینال بینک روڈ، مسلم ٹاؤن فلائی اوور کے نیچے',
    phone: '0300-4829104',
    isOpen24Hours: true,
    rating: 4.9
  },
  {
    id: 'hosp_services',
    name: 'Services Hospital Emergency Trauma Centre',
    nameUrdu: 'سروسز ہسپتال ایمرجنسی ٹراما سنٹر',
    type: 'hospital',
    lat: 31.5412,
    lng: 74.3335,
    address: 'Jail Road, Shadman, Lahore',
    addressUrdu: 'جیل روڈ، شادمان، لاہور',
    phone: '042-99203402',
    isOpen24Hours: true,
    rating: 4.5
  },
  {
    id: 'hosp_jinnah',
    name: 'Jinnah Hospital Lahore 24/7 Emergency',
    nameUrdu: 'جناح ہسپتال لاہور ایمرجنسی',
    type: 'hospital',
    lat: 31.4842,
    lng: 74.2974,
    address: 'Usmani Road, Faisal Town, Lahore',
    addressUrdu: 'عثمانی روڈ، فیصل ٹاؤن، لاہور',
    phone: '042-99231400',
    isOpen24Hours: true,
    rating: 4.6
  }
];

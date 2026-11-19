import 'geo.dart';

class EmergencyContact {
  const EmergencyContact(this.number, this.titleEn, this.titleUr, this.descEn, this.descUr);
  final String number, titleEn, titleUr, descEn, descUr;
}

// Same four numbers as the web app (src/data/pakistanLocations.ts). Urdu text is used for Punjabi too (draft).
const emergencyContacts = [
  EmergencyContact('1122', 'Rescue 1122 Punjab Emergency Service', 'ریسکیو ۱۱۲۲ پنجاب ایمرجنسی سروس', 'Free 24/7 Ambulance, Fire, Urban Search & Water Rescue in Punjab', 'پنجاب بھر میں مفت ۲۴ گھنٹے ایمبولینس، فائر بریگیڈ اور ریسکیو'),
  EmergencyContact('15', 'Rescue 15 Police Assistance (Punjab Police)', 'پولیس ہیلپ لائن ۱۵ (پنجاب پولیس)', 'Emergency police response, accident assistance, and mobile patrols', 'پولیس ایمرجنسی، روڈ حادثات پر مدد اور گشت'),
  EmergencyContact('130', 'Motorway Police Helpline (NH&MP 130)', 'موٹروے پولیس ہیلپ لائن ۱۳۰', 'Lahore-Islamabad M2, M3, Ring Road & National Highways emergency recovery', 'ایم ۲، ایم ۳، رنگ روڈ اور نیشنل ہائی ویز پر ہنگامی مدد'),
  EmergencyContact('115', 'Edhi Foundation Ambulance Service', 'ایدھی فاؤنڈیشن ایمبولینس سروس', 'Rapid private ambulance dispatch across all Lahore sectors', 'لاہور کے تمام علاقوں میں فوری ایدھی ایمبولینس'),
];

String sosText(LatLng p, String lang) {
  final c = '${p.lat.toStringAsFixed(5)}, ${p.lng.toStringAsFixed(5)}';
  final link = 'https://www.google.com/maps?q=${p.lat},${p.lng}';
  return lang == 'en'
      ? '🚨 EMERGENCY ASSISTANCE NEEDED! (Buraq Pakistan app)\nMy GPS coordinates: $c\nMap link: $link\nPlease send help or contact Rescue 1122.'
      : '🚨 ہنگامی مدد درکار ہے! (براق پاکستان ایپ)\nمیرے موجودہ کوآرڈینیٹس: $c\nنقشے کا لنک: $link\nبراہ کرم فوری مدد بھیجیں یا ریسکیو 1122 کو اطلاع دیں۔';
}

Uri whatsappUri(String text) => Uri.https('wa.me', '/', {'text': text});

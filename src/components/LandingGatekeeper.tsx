/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  Navigation, 
  ShieldAlert, 
  CloudRain, 
  Wind, 
  Award, 
  ArrowRight, 
  CheckCircle2, 
  Train, 
  WifiOff, 
  Bluetooth, 
  Globe, 
  MapPin, 
  PhoneCall, 
  Lock, 
  FileText, 
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useMobilityTheme } from './ThemeLayoutWrapper';

interface LandingGatekeeperProps {
  onLaunchMap?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const LandingGatekeeper: React.FC<LandingGatekeeperProps> = ({ onLaunchMap, isOpen = false, onClose }) => {
  const { isRtl, language, setLanguage } = useMobilityTheme();
  const [hasVisited, setHasVisited] = useState(!isOpen);

  useEffect(() => {
    if (isOpen) {
      setHasVisited(false);
    }
  }, [isOpen]);

  const handleLaunch = () => {
    setHasVisited(true);
    if (onClose) onClose();
    if (onLaunchMap) onLaunchMap();
  };

  if (hasVisited && !isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#F5F7F4] text-[#143C35] flex flex-col overflow-y-auto font-sans selection:bg-[#20A477] selection:text-white">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-emerald-900/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#143C35] text-white flex items-center justify-center shadow-lg shadow-[#143C35]/20 overflow-hidden">
            <img src="/buraq-icon.png" alt="Buraq" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg tracking-tight text-[#143C35]">
                {isRtl ? 'براق پاکستان' : 'BURAQ'}
              </span>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#20A477] text-white">
                PK 2.0
              </span>
            </div>
            <span className="text-[11px] font-medium text-emerald-800/70">
              {isRtl ? 'موبিলিٹی انٹیلی جنس' : 'Mobility Intelligence'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Language Selector */}
          <div className="hidden sm:flex items-center gap-1 bg-emerald-900/5 p-1 rounded-xl border border-emerald-900/10 text-xs font-bold">
            <button
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 rounded-lg transition-all ${language === 'en' ? 'bg-[#143C35] text-white shadow-xs' : 'text-[#143C35] hover:bg-emerald-900/10'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('ur')}
              className={`px-2.5 py-1 rounded-lg transition-all ${language === 'ur' ? 'bg-[#143C35] text-white shadow-xs' : 'text-[#143C35] hover:bg-emerald-900/10'}`}
            >
              اردو
            </button>
            <button
              onClick={() => setLanguage('pa')}
              className={`px-2.5 py-1 rounded-lg transition-all ${language === 'pa' ? 'bg-[#143C35] text-white shadow-xs' : 'text-[#143C35] hover:bg-emerald-900/10'}`}
            >
              پنجابی
            </button>
            <button
              onClick={() => setLanguage('ar')}
              className={`px-2.5 py-1 rounded-lg transition-all ${language === 'ar' ? 'bg-[#143C35] text-white shadow-xs' : 'text-[#143C35] hover:bg-emerald-900/10'}`}
            >
              عربي
            </button>
          </div>

          <button
            type="button"
            onClick={handleLaunch}
            className="py-2 px-4 rounded-xl bg-[#20A477] hover:bg-[#143C35] text-white font-extrabold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>{isRtl ? 'براق کھولیں' : 'Open Buraq'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-4 sm:px-8 py-16 sm:py-24 max-w-7xl mx-auto w-full text-center space-y-8">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#20A477]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#143C35]/10 text-[#143C35] text-xs font-extrabold tracking-wide uppercase border border-[#143C35]/15">
            <Sparkles className="w-3.5 h-3.5 text-[#20A477]" />
            <span>{isRtl ? 'پاکستان کے لیے خصوصی نیویگیشن' : 'Multilingual Navigation & Mobility Intelligence Built For Pakistan'}</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-[#143C35] leading-[1.15]">
            {isRtl ? 'پاکستان کا اپنا ذہین ترین نیویگیشن پلیٹ فارم' : 'Navigate Pakistan With Sovereign Mobility Intelligence'}
          </h1>

          <p className="text-base sm:text-lg text-[#143C35]/80 max-w-2xl mx-auto font-medium leading-relaxed">
            {isRtl
              ? 'لائیو ٹرن بائی ٹرن وائس نیویگیشن، ڈبلیز طرز کے کمیونٹی ٹریفک الرٹس، سموگ ایئر کوالٹی (AQI) مانیٹرنگ اور مون سون فلڈ بائی پاس — ایک ہی پلیٹ فارم پر ۱۰۰٪ مفت۔'
              : 'Experience real-time turn-by-turn routing, crowdsourced police and hazard alerts, smog AQI tracking, monsoon flood bypasses, and multimodal public transit in Lahore, Karachi, and Islamabad.'}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={handleLaunch}
              className="w-full sm:w-auto py-4 px-8 rounded-2xl bg-[#143C35] hover:bg-[#20A477] text-white font-black text-base shadow-xl shadow-[#143C35]/25 flex items-center justify-center gap-3 transition-all transform hover:scale-105 cursor-pointer"
            >
              <Navigation className="w-5 h-5 text-[#F2B95D]" />
              <span>{isRtl ? 'براق لائیو میپ کھولیں' : 'Open Buraq Live Map'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <a
              href="#features"
              className="w-full sm:w-auto py-4 px-8 rounded-2xl bg-white hover:bg-emerald-900/5 text-[#143C35] font-extrabold text-base border border-emerald-900/15 shadow-sm transition-all text-center"
            >
              {isRtl ? 'خصوصیات دیکھیں' : 'Explore Features'}
            </a>
          </div>
        </div>

        {/* Map / App Preview Mockup Card */}
        <div className="relative z-10 max-w-4xl mx-auto mt-10 rounded-3xl bg-white p-3 sm:p-4 shadow-2xl border border-emerald-900/10">
          <div className="rounded-2xl bg-[#143C35] text-white p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
            <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-[#20A477]/20 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="text-left space-y-3 z-10">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#20A477] text-white text-[11px] font-black uppercase tracking-wider">
                <span>Live Preview</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black">
                {isRtl ? 'گلبرگ سے کلمہ چوک — ۸ منٹ' : 'Gulberg to Kalma Chowk Underpass'}
              </h3>
              <p className="text-xs sm:text-sm text-emerald-100/80 max-w-md">
                {isRtl ? 'بہترین کوریڈور روٹ فعال۔ ٹریفک روانی معمول کے مطابق۔' : 'Optimized OSRM road corridor active. Smooth traffic flow with zero toll bottlenecks.'}
              </p>
            </div>

            <div className="z-10 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#20A477] text-white flex items-center justify-center font-black text-xl shadow-lg">
                🚗
              </div>
              <div className="text-left">
                <div className="text-xs text-emerald-200 font-bold">Fastest Route</div>
                <div className="text-lg font-black text-white">5.0 km • 8 Mins</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How Buraq Works */}
      <section id="features" className="bg-white px-4 sm:px-8 py-20 border-t border-emerald-950/10">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-black text-[#143C35]">
              {isRtl ? 'براق کیسے کام کرتا ہے؟' : 'How Buraq Works'}
            </h2>
            <p className="text-sm sm:text-base text-[#143C35]/70 font-medium">
              {isRtl ? 'موبائل اور ڈیسک ٹاپ کے لیے ڈیزائن کیا گیا تیز ترین نیویگیشن سسٹم۔' : 'Built for Pakistani commuters with offline resilience and multi-language support.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-[#F5F7F4] border border-emerald-900/10 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#143C35] text-white flex items-center justify-center font-black text-lg shadow-md">
                1
              </div>
              <h3 className="text-lg font-black text-[#143C35]">
                {isRtl ? 'منزل منتخب کریں' : 'Set Destination & Mode'}
              </h3>
              <p className="text-xs sm:text-sm text-[#143C35]/70 leading-relaxed">
                {isRtl ? 'اردو یا انگلش میں تلاش کریں یا بائیک، کار، پیدل یا پبلک ٹرانزٹ منتخب کریں۔' : 'Search any location or popular landmark in Pakistan. Choose between Car, Motorcycle, Walking, or Metrobus Transit.'}
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-[#F5F7F4] border border-emerald-900/10 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#20A477] text-white flex items-center justify-center font-black text-lg shadow-md">
                2
              </div>
              <h3 className="text-lg font-black text-[#143C35]">
                {isRtl ? 'لائیو OSRM اور کمیونٹی الرٹس' : 'OSRM Routing & Hazards'}
              </h3>
              <p className="text-xs sm:text-sm text-[#143C35]/70 leading-relaxed">
                {isRtl ? 'اصل وقت کے ٹریفک روٹس اور کمیونٹی کے ذریعے رپورٹ کردہ پولیس ناکوں اور حادثات سے بچیں۔' : 'Real-time OSRM routing combined with Waze-style crowdsourced police nakas, accidents, and monsoon flood warnings.'}
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-[#F5F7F4] border border-emerald-900/10 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#F2B95D] text-[#143C35] flex items-center justify-center font-black text-lg shadow-md">
                3
              </div>
              <h3 className="text-lg font-black text-[#143C35]">
                {isRtl ? 'وائس نیویگیشن' : 'Voice Navigation & SOS'}
              </h3>
              <p className="text-xs sm:text-sm text-[#143C35]/70 leading-relaxed">
                {isRtl ? 'اردو، پنجابی، عربی اور انگلش میں ٹرن بائی ٹرن وائس انسٹرکشنز اور 1122 ایمرجنسی SOS۔' : 'Turn-by-turn voice instructions in Urdu, Punjabi, Arabic, and English, plus direct 1122 roadside emergency dialing.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pakistan-Specific Road Intelligence & Features */}
      <section className="px-4 sm:px-8 py-20 max-w-7xl mx-auto w-full space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-[#143C35]">
            {isRtl ? 'پاکستان کے لیے خاص خصوصیات' : 'Pakistan-Specific Road Intelligence'}
          </h2>
          <p className="text-sm sm:text-base text-[#143C35]/70 font-medium">
            {isRtl ? 'لاہور، کراچی اور اسلام آباد کی زمینی حقائق کے مطابق تیار کردہ۔' : 'Tailored specifically for the mobility needs of Pakistani metropolitan commuters.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-3xl bg-white border border-emerald-900/10 shadow-sm space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-900/10 text-[#143C35] flex items-center justify-center font-bold">
              🚆
            </div>
            <h4 className="font-extrabold text-sm text-[#143C35]">Metrobus & Orange Line</h4>
            <p className="text-xs text-[#143C35]/70 leading-relaxed">
              Multimodal transit comparison with live station schedules and token fare calculators.
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-emerald-900/10 shadow-sm space-y-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-900/10 text-cyan-700 flex items-center justify-center font-bold">
              <CloudRain className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-sm text-[#143C35]">Monsoon Flood Bypasses</h4>
            <p className="text-xs text-[#143C35]/70 leading-relaxed">
              Automatic rerouting around waterlogged underpasses during heavy monsoon downpours.
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-emerald-900/10 shadow-sm space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-900/10 text-amber-700 flex items-center justify-center font-bold">
              <Wind className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-sm text-[#143C35]">Smog & AQI Tracking</h4>
            <p className="text-xs text-[#143C35]/70 leading-relaxed">
              Real-time Air Quality Index monitoring and health advisories for Lahore and Punjab.
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-emerald-900/10 shadow-sm space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-900/10 text-blue-700 flex items-center justify-center font-bold">
              <WifiOff className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-sm text-[#143C35]">Offline Packs & Mesh</h4>
            <p className="text-xs text-[#143C35]/70 leading-relaxed">
              Download regional vector maps and share traffic alerts peer-to-peer via Bluetooth BLE mesh.
            </p>
          </div>
        </div>
      </section>

      {/* About & Contact Section */}
      <section className="bg-white px-4 sm:px-8 py-20 border-t border-emerald-950/10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-[#143C35]">
              {isRtl ? 'راستہ کے بارے میں' : 'About Rasta Pakistan'}
            </h2>
            <p className="text-sm text-[#143C35]/80 leading-relaxed">
              {isRtl
                ? 'راستہ پاکستان ایک آزاد اور کمیونٹی سے وابستہ موبিলিٹی پروجیکٹ ہے جس کا مقصد پاکستانی مسافروں کو تیز ترین، محفوظ ترین اور اشتہار سے پاک نیویگیشن فراہم کرنا ہے۔'
                : 'Rasta Pakistan is an independent, community-driven mobility intelligence initiative dedicated to providing Pakistani commuters with fast, accurate, and ad-free navigation.'}
            </p>
            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#143C35]">
                <CheckCircle2 className="w-4 h-4 text-[#20A477]" />
                <span>100% Free & Open Source</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#143C35]">
                <CheckCircle2 className="w-4 h-4 text-[#20A477]" />
                <span>No Data Selling</span>
              </div>
            </div>
          </div>

          <div className="p-8 rounded-3xl bg-[#F5F7F4] border border-emerald-900/10 space-y-4">
            <h3 className="text-lg font-black text-[#143C35]">
              {isRtl ? 'رابطہ کریں' : 'Get in Touch'}
            </h3>
            <p className="text-xs text-[#143C35]/70 leading-relaxed">
              {isRtl ? 'فیڈ بیک یا شراکت داری کے لیے ہم سے رابطہ کریں۔' : 'Have feedback, road incident reports, or partnership inquiries? Reach out to our community team.'}
            </p>
            <div className="space-y-2 text-xs font-bold text-[#143C35]">
              <div className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-[#20A477]" />
                <span>Roadside Emergency: Dial 1122</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#20A477]" />
                <span>Email: support@buraqpakistan.pk</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#143C35] text-white px-4 sm:px-8 py-12 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-emerald-200/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#20A477] text-white flex items-center justify-center overflow-hidden">
              <img src="/buraq-icon.png" alt="Buraq" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-white text-sm">Buraq Pakistan 2.0</span>
          </div>

          <div className="flex items-center gap-6 font-medium">
            <a href="#privacy" onClick={(e) => { e.preventDefault(); alert('Buraq Pakistan respects your privacy. No personal telemetry or location data is ever sold or shared.'); }} className="hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="#terms" onClick={(e) => { e.preventDefault(); alert('Terms of Service: Provided 100% free for safe community navigation across Pakistan.'); }} className="hover:text-white transition-colors">
              Terms of Service
            </a>
            <a href="#attribution" onClick={(e) => { e.preventDefault(); alert('Powered by OpenStreetMap contributors, OSRM, and Esri ArcGIS World Street Map.'); }} className="hover:text-white transition-colors">
              Data Attribution
            </a>
          </div>

          <div>
            <span>© 2026 Buraq Pakistan. Built for Pakistani Commuters.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

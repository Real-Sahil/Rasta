/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CommunityIncident, IncidentCategory } from '../types';
import { useMobilityTheme } from './ThemeLayoutWrapper';
import {
  AlertTriangle,
  CheckCircle,
  ThumbsUp,
  Clock,
  PlusCircle,
  X,
  MapPin,
  Navigation,
  Mic,
  Radio,
  Award,
  Share2
} from 'lucide-react';
import { useVoiceInput } from '../services/speechRecognition';

interface TrafficIncidentsProps {
  incidents: CommunityIncident[];
  onAddIncident: (incident: CommunityIncident) => void;
  onConfirmIncident: (id: string) => void;
  onFocusIncident: (incident: CommunityIncident) => void;
  userCoords?: { lat: number; lng: number } | null;
}

/** "3 h 20 min ago" style age; never negative. */
function ageText(ms: number, rtl: boolean): string {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60), r = m % 60;
  if (rtl) return m < 1 ? 'ابھی' : h ? `${h} گھنٹے ${r ? `${r} منٹ ` : ''}پہلے` : `${m} منٹ پہلے`;
  return m < 1 ? 'just now' : h ? `${h} h ${r ? `${r} min ` : ''}ago` : `${m} min ago`;
}

export const TrafficIncidents: React.FC<TrafficIncidentsProps> = ({
  incidents,
  onAddIncident,
  onConfirmIncident,
  onFocusIncident,
  userCoords
}) => {
  const { isRtl, t } = useMobilityTheme();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<IncidentCategory | 'all'>('all');

  // New report form state
  const [title, setTitle] = useState('');
  const [titleUrdu, setTitleUrdu] = useState('');
  const [category, setCategory] = useState<IncidentCategory>('congestion');
  const [locationName, setLocationName] = useState('');
  const [description, setDescription] = useState('');
  const [advice, setAdvice] = useState('');
  const [reportError, setReportError] = useState<string | null>(null);
  const [voiceTarget, setVoiceTarget] = useState<'title' | 'description' | null>(null);

  const {
    isListening: isVoiceReporting,
    interimTranscript: incidentVoiceInterim,
    startListening: startIncidentVoice,
    stopListening: stopIncidentVoice
  } = useVoiceInput((finalText) => {
    if (voiceTarget === 'title') {
      setTitle(finalText);
      setTitleUrdu(finalText);
    } else if (voiceTarget === 'description') {
      setDescription((prev) => prev ? `${prev} ${finalText}` : finalText);
    }
  });

  const handleStartVoiceField = (field: 'title' | 'description') => {
    if (isVoiceReporting && voiceTarget === field) {
      stopIncidentVoice();
      setVoiceTarget(null);
    } else {
      setVoiceTarget(field);
      startIncidentVoice(isRtl ? 'ur-PK' : 'en-US');
    }
  };

  const filteredIncidents = selectedCategory === 'all'
    ? incidents
    : incidents.filter(i => i.category === selectedCategory);

  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !titleUrdu.trim()) return;

    if (!userCoords) {
      setReportError(isRtl ? 'رپورٹ کے لیے GPS لوکیشن درکار ہے۔ براہ کرم مقام کی اجازت دیں۔' : 'A GPS fix is required to report an incident. Please allow location access and try again.');
      return;
    }
    setReportError(null);
    const lat = userCoords.lat;
    const lng = userCoords.lng;

    const newIncident: CommunityIncident = {
      id: `rep_${Date.now()}`,
      title: title || titleUrdu,
      titleUrdu: titleUrdu || title,
      category,
      locationName: locationName || 'Lahore Commuter Route',
      locationNameUrdu: locationName || 'لاہور کینال یا مین شاہراہ',
      lat,
      lng,
      description: description || 'Reported by commuter via Buraq app.',
      descriptionUrdu: description || 'شہری کی جانب سے براق ایپ کے ذریعے رپورٹ۔',
      timestamp: Date.now(),
      upvotes: 1,
      userConfirmed: true,
      credibilityScore: 50,
      isOfficialVerified: false,
      source: 'Citizen_Report',
      alternativeRouteAdvice: advice || undefined,
      alternativeRouteAdviceUrdu: advice || undefined,
      expiresAt: Date.now() + 120 * 60 * 1000
    };

    onAddIncident(newIncident);
    setIsModalOpen(false);
    setTitle('');
    setTitleUrdu('');
    setLocationName('');
    setDescription('');
    setAdvice('');
  };

  const handleShareIncident = (incident: CommunityIncident) => {
    const text = isRtl
      ? `🚨 براق الرٹ: ${incident.titleUrdu}\nمقام: ${incident.locationNameUrdu}\nزمرہ: ${incident.category}\nگوگل میپ: https://www.google.com/maps?q=${incident.lat},${incident.lng}\n- براق پاکستان`
      : `🚨 Buraq Traffic Alert: ${incident.title}\nLocation: ${incident.locationName}\nCategory: ${incident.category.toUpperCase()}\nGoogle Maps: https://www.google.com/maps?q=${incident.lat},${incident.lng}\n- Shared via Buraq Pakistan`;

    if (navigator.share) {
      navigator.share({
        title: incident.title,
        text: text,
        url: `https://www.google.com/maps?q=${incident.lat},${incident.lng}`
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      alert(isRtl ? 'ٹریفک الرٹ کلپ بورڈ پر کاپی ہو گیا!' : 'Incident report link and details copied to clipboard!');
    }
  };

  const getCategoryBadge = (cat: IncidentCategory) => {
    switch (cat) {
      case 'accident':
        return { label: isRtl ? 'حادثہ' : 'Accident', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' };
      case 'flooding':
        return { label: isRtl ? 'بارش / پانی' : 'Flooding', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' };
      case 'construction':
        return { label: isRtl ? 'تعمیراتی کام' : 'Road Work', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' };
      case 'roadblock':
        return { label: isRtl ? 'دھرنا / بندش' : 'Roadblock', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' };
      case 'police_naka':
        return { label: isRtl ? 'پولیس ناکا' : 'Police Naka', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' };
      default:
        return { label: isRtl ? 'شدید ٹریفک' : 'Heavy Jam', color: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' };
    }
  };

  return (
    <div className="space-y-3">
      {/* Feed Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="ui-sub min-w-0 flex-1">{t.incidentSubtitle}</p>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="ui-btn ui-btn-primary h-10 px-4 text-sm shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{t.reportButton}</span>
        </button>
      </div>

      {/* Category Pills Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {[
          { id: 'all', label: isRtl ? 'تمام' : 'All' },
          { id: 'congestion', label: isRtl ? 'ٹریفک جام' : 'Congestion' },
          { id: 'construction', label: isRtl ? 'مرمت' : 'Construction' },
          { id: 'flooding', label: isRtl ? 'پانی / بارش' : 'Waterlogging' },
          { id: 'roadblock', label: isRtl ? 'دھرنا / ناکا' : 'Roadblocks' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSelectedCategory(tab.id as any)}
            aria-pressed={selectedCategory === tab.id}
            className="ui-chip shrink-0"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Incidents List */}
      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
        {filteredIncidents.length === 0 && (
          <div className="py-8 text-center space-y-2">
            <p className="font-display text-[17px] font-extrabold text-[color:var(--ink)]">{isRtl ? 'ابھی کوئی رپورٹ نہیں' : 'No reports yet'}</p>
            <p className="text-xs text-[color:var(--ink-2)]">
              {isRtl ? 'راستے میں کچھ نظر آئے تو رپورٹ کریں تاکہ دوسروں کی مدد ہو۔' : 'See something on the road? Report it to help other drivers. Reports expire after a few hours.'}
            </p>
          </div>
        )}
        {filteredIncidents.map((incident) => {
          const badge = getCategoryBadge(incident.category);

          return (
            <div
              key={incident.id}
              onClick={() => onFocusIncident(incident)}
              className="p-4 bg-[color:var(--paper)] rounded-[22px] hover:ring-1 hover:ring-[color:var(--line)] transition-shadow cursor-pointer space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.color}`}>
                    {badge.label}
                  </span>

                    <span className="text-[11px] text-[color:var(--ink-2)] font-semibold num">
                      {t.credibility}: {incident.credibilityScore}%
                    </span>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-[color:var(--ink-2)] num shrink-0">
                  <Clock className="w-3 h-3" />
                  <span>
                    {ageText(Date.now() - incident.timestamp, isRtl)}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-display font-extrabold text-[15px] text-[color:var(--ink)]">
                  {isRtl ? incident.titleUrdu : incident.title}
                </h4>
                <div className="flex items-center gap-1 text-xs text-[color:var(--ink-2)] mt-0.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{isRtl ? incident.locationNameUrdu : incident.locationName}</span>
                </div>
                <p className="text-xs text-[color:var(--ink-2)] mt-1">
                  {isRtl ? incident.descriptionUrdu : incident.description}
                </p>
              </div>

              {incident.alternativeRouteAdvice && (
                <div className="p-2.5 bg-[color:var(--surface)] rounded-xl text-xs text-[color:var(--ink)]">
                  <span className="font-bold">{isRtl ? 'متبادل راستہ:' : 'Advisory:'} </span>
                  {isRtl ? incident.alternativeRouteAdviceUrdu : incident.alternativeRouteAdvice}
                </div>
              )}

              {/* Confirmation / Upvote & Share bar */}
              <div className="flex items-center justify-between pt-1 border-t border-[color:var(--line)] text-xs">
                <span className="text-[color:var(--ink-2)] text-[11px] num">
                  {incident.upvotes} {t.commuters} {t.confirmedBy}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShareIncident(incident);
                    }}
                    className="ui-btn ui-btn-soft h-8 px-3 text-xs"
                    title={isRtl ? 'شیئر' : 'Share'}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{isRtl ? 'شیئر' : 'Share'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfirmIncident(incident.id);
                    }}
                    aria-pressed={!!incident.userConfirmed}
                    className={`ui-btn h-8 px-3 text-xs ${incident.userConfirmed ? 'ui-btn-ink' : 'ui-btn-soft'}`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>{t.confirmIncident}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Community Report Modal */}
      {isModalOpen && (
        <div className="anim-fade fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="anim-sheet bg-[color:var(--surface)] rounded-[28px] max-w-lg w-full p-5 sm:p-6 shadow-[var(--shadow-float)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[color:var(--line)]">
              <h3 className="font-extrabold text-base text-[color:var(--ink)] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span>{isRtl ? 'سڑک کا مسئلہ یا حادثہ رپورٹ کریں' : 'Report Live Traffic Incident'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="ui-btn ui-btn-soft w-9 h-9 p-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReport} className="mt-4 space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-[color:var(--ink)] mb-1">
                  {isRtl ? 'مسئلے کی قسم' : 'Incident Category'}
                </label>
                {reportError && (
                  <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-800 dark:text-rose-200 text-[11px] font-bold">{reportError}</div>
                )}
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as IncidentCategory)}
                  className="w-full p-2.5 rounded-xl border-0 ring-1 ring-[color:var(--line)] focus:ring-2 focus:ring-[color:var(--ink)] outline-none bg-[color:var(--paper)] text-[color:var(--ink)] font-medium"
                >
                  <option value="congestion">Severe Traffic Jam (شدید رش)</option>
                  <option value="accident">Accident (حادثہ)</option>
                  <option value="flooding">Waterlogging / Rain (بارش کا پانی)</option>
                  <option value="construction">Road Work / Underpass Closed (تعمیراتی کام)</option>
                  <option value="roadblock">Dharna / Protest / VIP (دھرنا یا سڑک بند)</option>
                  <option value="police_naka">Police Checking (پولیس چیکنگ)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[color:var(--ink)] mb-1">
                  {isRtl ? 'مقام کا نام (مثلاً کینال روڈ، کلمہ چوک)' : 'Location / Chowk Name'}
                </label>
                <input
                  type="text"
                  required
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="e.g. Canal Road Campus Bridge Underpass"
                  className="w-full p-2.5 rounded-xl border-0 ring-1 ring-[color:var(--line)] focus:ring-2 focus:ring-[color:var(--ink)] outline-none bg-[color:var(--paper)] text-[color:var(--ink)]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[color:var(--ink)]">
                    {isRtl ? 'عنوان (انگریزی یا اردو)' : 'Incident Headline'}
                  </label>
                  <button
                    type="button"
                    onClick={() => handleStartVoiceField('title')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                      isVoiceReporting && voiceTarget === 'title'
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-[color:var(--paper)] text-[color:var(--ink-2)] hover:text-[color:var(--ink)]'
                    }`}
                  >
                    <Mic className="w-3 h-3" />
                    <span>{isVoiceReporting && voiceTarget === 'title' ? 'Listening...' : (isRtl ? 'بول کر لکھیں' : 'Voice Dictate')}</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Underpass drainage blocked, 20 mins delay"
                  className="w-full p-2.5 rounded-xl border-0 ring-1 ring-[color:var(--line)] focus:ring-2 focus:ring-[color:var(--ink)] outline-none bg-[color:var(--paper)] text-[color:var(--ink)]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[color:var(--ink)]">
                    {isRtl ? 'تفصیل و متبادل راستہ' : 'Details & Alternative Route Advice'}
                  </label>
                  <button
                    type="button"
                    onClick={() => handleStartVoiceField('description')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                      isVoiceReporting && voiceTarget === 'description'
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-[color:var(--paper)] text-[color:var(--ink-2)] hover:text-[color:var(--ink)]'
                    }`}
                  >
                    <Mic className="w-3 h-3" />
                    <span>{isVoiceReporting && voiceTarget === 'description' ? 'Listening...' : (isRtl ? 'بول کر لکھیں' : 'Voice Dictate')}</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Advice fellow Pakistani drivers which road to take instead..."
                  className="w-full p-2.5 rounded-xl border-0 ring-1 ring-[color:var(--line)] focus:ring-2 focus:ring-[color:var(--ink)] outline-none bg-[color:var(--paper)] text-[color:var(--ink)]"
                />
              </div>

              {isVoiceReporting && incidentVoiceInterim && (
                <div className="p-2 rounded-xl bg-slate-900 text-slate-200 text-xs italic flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                  <span>"{incidentVoiceInterim}"</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="ui-btn ui-btn-soft h-11 px-4"
                >
                  {isRtl ? 'منسوخ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="ui-btn ui-btn-primary h-11 px-5"
                >
                  {isRtl ? 'الرٹ شائع کریں' : 'Publish Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

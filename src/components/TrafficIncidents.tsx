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
  ShieldCheck,
  PlusCircle,
  X,
  Camera,
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

  // Community traffic poll state
  const [pollVotes, setPollVotes] = useState({ light: 38, moderate: 47, heavy: 15 });
  const [userVoted, setUserVoted] = useState<string | null>(null);

  const handleVote = (option: 'light' | 'moderate' | 'heavy') => {
    if (userVoted) return;
    setPollVotes(prev => ({
      ...prev,
      [option]: prev[option] + 1
    }));
    setUserVoted(option);
  };

  const totalVotes = pollVotes.light + pollVotes.moderate + pollVotes.heavy;
  const lightPct = Math.round((pollVotes.light / totalVotes) * 100);
  const moderatePct = Math.round((pollVotes.moderate / totalVotes) * 100);
  const heavyPct = 100 - lightPct - moderatePct;

  // New report form state
  const [title, setTitle] = useState('');
  const [titleUrdu, setTitleUrdu] = useState('');
  const [category, setCategory] = useState<IncidentCategory>('congestion');
  const [locationName, setLocationName] = useState('');
  const [description, setDescription] = useState('');
  const [advice, setAdvice] = useState('');
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

    const lat = userCoords?.lat || 31.5102 + (Math.random() - 0.5) * 0.05;
    const lng = userCoords?.lng || 74.3441 + (Math.random() - 0.5) * 0.05;

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
      credibilityScore: 85,
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
        <div>
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" />
            <span>{t.incidentTitle}</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.incidentSubtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{t.reportButton}</span>
        </button>
      </div>

      {/* Live Traffic Flow Polling Widget */}
      <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 rounded-xl space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
            <span>{isRtl ? 'لائیو ٹریفک پول: اس وقت سڑک پر رش کیسا ہے؟' : 'Live Community Traffic Pulse Poll'}</span>
          </div>
          <span className="text-[10px] text-slate-500">{totalVotes} votes</span>
        </div>

        {userVoted ? (
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              {isRtl ? 'آپ کا ووٹ درج ہو گیا! شکریہ۔' : 'Thanks for voting! Community consensus:'}
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
              <div className="p-1.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                Light ({lightPct}%)
              </div>
              <div className="p-1.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                Moderate ({moderatePct}%)
              </div>
              <div className="p-1.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                Heavy ({heavyPct}%)
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => handleVote('light')}
              className="py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-transform hover:scale-105 cursor-pointer"
            >
              {isRtl ? 'ہلکی (Light)' : '🟢 Light'}
            </button>
            <button
              type="button"
              onClick={() => handleVote('moderate')}
              className="py-1.5 px-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-transform hover:scale-105 cursor-pointer"
            >
              {isRtl ? 'درمیانی (Moderate)' : '🟡 Moderate'}
            </button>
            <button
              type="button"
              onClick={() => handleVote('heavy')}
              className="py-1.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-transform hover:scale-105 cursor-pointer"
            >
              {isRtl ? 'شدید (Heavy)' : '🔴 Heavy'}
            </button>
          </div>
        )}
      </div>

      {/* Category Pills Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
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
            className={`px-3 py-1 rounded-lg font-semibold shrink-0 transition-all ${
              selectedCategory === tab.id
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Incidents List */}
      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
        {filteredIncidents.map((incident) => {
          const badge = getCategoryBadge(incident.category);

          return (
            <div
              key={incident.id}
              onClick={() => onFocusIncident(incident)}
              className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 shadow-xs transition-all cursor-pointer space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.color}`}>
                    {badge.label}
                  </span>

                  {incident.isOfficialVerified ? (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      PSCA Verified
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-medium">
                      {t.credibility}: {incident.credibilityScore}%
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>
                    {Math.round((Date.now() - incident.timestamp) / 60000)}m ago
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {isRtl ? incident.titleUrdu : incident.title}
                </h4>
                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{isRtl ? incident.locationNameUrdu : incident.locationName}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {isRtl ? incident.descriptionUrdu : incident.description}
                </p>
              </div>

              {incident.alternativeRouteAdvice && (
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-900/40 rounded-lg text-xs text-emerald-900 dark:text-emerald-300">
                  <span className="font-bold">{isRtl ? 'متبادل راستہ:' : 'Advisory:'} </span>
                  {isRtl ? incident.alternativeRouteAdviceUrdu : incident.alternativeRouteAdvice}
                </div>
              )}

              {/* Confirmation / Upvote & Share bar */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-400 text-[11px]">
                  {incident.upvotes} {t.commuters} {t.confirmedBy}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShareIncident(incident);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 font-bold transition-all cursor-pointer"
                    title="Share Incident Report"
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
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all ${
                      incident.userConfirmed
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50'
                    }`}
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span>{isRtl ? 'سڑک کا مسئلہ یا حادثہ رپورٹ کریں' : 'Report Live Traffic Incident'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReport} className="mt-4 space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isRtl ? 'مسئلے کی قسم' : 'Incident Category'}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as IncidentCategory)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
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
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isRtl ? 'مقام کا نام (مثلاً کینال روڈ، کلمہ چوک)' : 'Location / Chowk Name'}
                </label>
                <input
                  type="text"
                  required
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="e.g. Canal Road Campus Bridge Underpass"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    {isRtl ? 'عنوان (انگریزی یا اردو)' : 'Incident Headline'}
                  </label>
                  <button
                    type="button"
                    onClick={() => handleStartVoiceField('title')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                      isVoiceReporting && voiceTarget === 'title'
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600'
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
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    {isRtl ? 'تفصیل و متبادل راستہ' : 'Details & Alternative Route Advice'}
                  </label>
                  <button
                    type="button"
                    onClick={() => handleStartVoiceField('description')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                      isVoiceReporting && voiceTarget === 'description'
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600'
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
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {isVoiceReporting && incidentVoiceInterim && (
                <div className="p-2 rounded-xl bg-slate-900 text-slate-200 text-xs italic flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                  <span>"{incidentVoiceInterim}"</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2 text-slate-500 cursor-pointer hover:border-emerald-500 hover:text-emerald-600 transition-colors">
                <Camera className="w-5 h-5" />
                <span className="font-medium text-xs">
                  {isRtl ? 'تصویر منسلک کریں (اختیاری)' : 'Attach Road Photo (Optional)'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/30"
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

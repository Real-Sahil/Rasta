/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Map, 
  Search, 
  AlertTriangle, 
  Navigation, 
  MapPin, 
  Clock, 
  Home, 
  Briefcase, 
  ChevronLeft, 
  CornerUpLeft, 
  X, 
  ShieldAlert, 
  Car, 
  Waves, 
  TrafficCone, 
  Flag,
  Mic,
  Camera,
  Map as MapIcon
} from 'lucide-react';
import { CommunityIncident, LocationPoint } from '../types';
import { POPULAR_LOCATIONS } from '../data/pakistanLocations';

interface WazeMobileSimulatorProps {
  onClose?: () => void;
  onReportIncident?: (incident: CommunityIncident) => void;
  onSelectDestination?: (location: LocationPoint) => void;
}

export const WazeMobileSimulator: React.FC<WazeMobileSimulatorProps> = ({
  onClose,
  onReportIncident,
  onSelectDestination
}) => {
  const [currentScreen, setCurrentScreen] = useState<string>('map');
  const [destination, setDestination] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const navigateTo = (screen: string) => setCurrentScreen(screen);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleStartNavigation = (destName: string) => {
    setDestination(destName);
    const found = POPULAR_LOCATIONS.find(l => l.name.toLowerCase().includes(destName.toLowerCase())) || POPULAR_LOCATIONS[0];
    if (onSelectDestination) {
      onSelectDestination(found);
    }
    setCurrentScreen('navigation');
  };

  const handleReport = (type: string, category: string) => {
    showToast(`${type} reported successfully! Thank you for helping Pakistan traffic.`);
    if (onReportIncident) {
      onReportIncident({
        id: `waze_rep_${Date.now()}`,
        title: type,
        titleUrdu: type,
        category: category as any,
        locationName: 'Lahore Road Corridor',
        locationNameUrdu: 'لاہور روڈ کوریڈور',
        lat: 31.5204 + (Math.random() - 0.5) * 0.02,
        lng: 74.3587 + (Math.random() - 0.5) * 0.02,
        description: `Reported via Waze Mobile App: ${type}`,
        descriptionUrdu: `وویز موبائل ایپ کے ذریعے رپورٹ: ${type}`,
        timestamp: Date.now(),
        upvotes: 1,
        userConfirmed: true,
        credibilityScore: 85,
        isOfficialVerified: false,
        source: 'Citizen_Report',
        expiresAt: Date.now() + 3600000
      });
    }
    setCurrentScreen('map');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      {/* Phone Container Frame */}
      <div className="w-full max-w-[400px] h-[820px] max-h-[92vh] bg-white relative overflow-hidden shadow-2xl rounded-[2.5rem] border-[12px] border-slate-900 flex flex-col ring-4 ring-slate-800/50">
        
        {/* Status Bar */}
        <div className="absolute top-0 inset-x-0 h-12 flex justify-between items-center px-6 pt-2 z-40 text-xs font-bold text-slate-800 bg-white/80 backdrop-blur">
          <span>12:45</span>
          <div className="flex space-x-2 items-center">
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1 rounded font-extrabold">Waze PK</span>
            <span>LTE</span>
            <div className="w-5 h-3 bg-slate-800 rounded-sm"></div>
          </div>
        </div>

        {/* Top Notch */}
        <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-50 pointer-events-none">
          <div className="w-40 h-6 bg-slate-900 rounded-b-3xl"></div>
        </div>

        {/* Dynamic Screen Rendering */}
        <div className="flex-1 relative overflow-hidden pt-12">
          {currentScreen === 'map' && (
            <div className="relative w-full h-full flex flex-col bg-[#e5f0ea]">
              {/* Map Grid Background */}
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
              <div className="absolute w-full h-12 bg-white top-1/3 left-0 shadow-sm"></div>
              <div className="absolute w-12 h-full bg-white left-1/3 top-0 shadow-sm"></div>

              {/* Map Markers */}
              <div className="absolute top-1/3 left-1/3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center transform -translate-x-4 -translate-y-4 border-2 border-gray-100 z-10 animate-pulse">
                <Car size={16} className="text-emerald-600" />
              </div>
              <div className="absolute bottom-1/3 right-1/4 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center transform -translate-x-4 -translate-y-4 border-2 border-gray-100 z-10">
                <ShieldAlert size={16} className="text-amber-500" />
              </div>

              {/* Top Search Bar */}
              <div className="absolute top-16 inset-x-4 z-20">
                <div 
                  onClick={() => navigateTo('search')}
                  className="bg-white rounded-full shadow-lg h-14 flex items-center px-4 cursor-pointer hover:bg-gray-50 transition-colors border border-gray-100"
                >
                  <Search className="text-gray-400 mr-3" size={20} />
                  <span className="text-gray-500 font-medium flex-1">Where to in Pakistan?</span>
                  <div className="w-8 h-8 bg-emerald-50 rounded-full flex items-center justify-center">
                    <Mic className="text-emerald-600" size={16} />
                  </div>
                </div>
              </div>

              {/* Floating Action Buttons */}
              <div className="absolute bottom-24 right-4 flex flex-col space-y-4 z-20">
                <button 
                  onClick={() => navigateTo('report')}
                  className="w-16 h-16 bg-amber-500 rounded-full shadow-xl flex items-center justify-center text-white border-2 border-white transform hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  title="Report Hazard"
                >
                  <AlertTriangle size={32} fill="white" className="text-amber-600" />
                </button>
              </div>

              {/* Speedometer */}
              <div className="absolute bottom-24 left-4 w-16 h-16 bg-white rounded-full shadow-lg border-4 border-emerald-500 flex flex-col items-center justify-center z-20">
                <span className="text-xl font-black text-slate-800 leading-none">60</span>
                <span className="text-[10px] text-gray-500 font-bold uppercase">km/h</span>
              </div>
            </div>
          )}

          {currentScreen === 'search' && (
            <div className="relative w-full h-full bg-slate-50 flex flex-col z-30 pb-20 overflow-y-auto">
              <div className="bg-white px-4 pt-4 pb-4 shadow-sm relative">
                <div className="flex items-center">
                  <button onClick={() => navigateTo('map')} className="p-2 -ml-2 text-gray-600 rounded-full hover:bg-gray-100 cursor-pointer">
                    <ChevronLeft size={28} />
                  </button>
                  <div className="flex-1 ml-2 relative">
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="Search Lahore chowks, metro, addresses..." 
                      className="w-full bg-gray-100 rounded-full h-12 pl-4 pr-10 outline-none text-slate-800 font-medium focus:ring-2 ring-emerald-500 text-sm"
                    />
                    <Search className="absolute right-3 top-3 text-gray-400" size={20} />
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 px-2">Favorites</h3>
                  <div className="flex space-x-4 px-2">
                    <button 
                      onClick={() => handleStartNavigation('Home')}
                      className="flex-1 bg-white p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center space-y-2 hover:bg-emerald-50 transition-colors border border-gray-100 cursor-pointer"
                    >
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                        <Home className="text-emerald-600" size={20} />
                      </div>
                      <span className="font-bold text-slate-700 text-xs">Home</span>
                    </button>
                    <button 
                      onClick={() => handleStartNavigation('Work')}
                      className="flex-1 bg-white p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center space-y-2 hover:bg-emerald-50 transition-colors border border-gray-100 cursor-pointer"
                    >
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                        <Briefcase className="text-emerald-600" size={20} />
                      </div>
                      <span className="font-bold text-slate-700 text-xs">Work</span>
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 px-2">Recent Hubs in Pakistan</h3>
                  <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    {POPULAR_LOCATIONS.slice(0, 4).map((item, idx) => (
                      <button 
                        key={item.id}
                        onClick={() => handleStartNavigation(item.name)}
                        className={`w-full flex items-center p-4 text-left hover:bg-emerald-50 transition-colors cursor-pointer ${idx !== 3 ? 'border-b border-gray-100' : ''}`}
                      >
                        <div className="w-8 h-8 text-emerald-600 mr-4 flex-shrink-0 flex items-center justify-center bg-emerald-50 rounded-xl">
                          <MapPin size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{item.name}</p>
                          <p className="text-xs text-gray-500 truncate">{item.address}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentScreen === 'navigation' && (
            <div className="relative w-full h-full flex flex-col bg-[#e5f0ea]">
              {/* Animated Route Line & User Car */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute w-3 h-64 bg-emerald-500 left-1/2 top-1/4 rotate-[15deg] transform -translate-x-1/2 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)] z-10"></div>
                <div className="absolute top-1/2 left-1/2 w-12 h-12 bg-white rounded-full shadow-2xl flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 border-[3px] border-emerald-600 z-20">
                  <Car size={24} className="text-emerald-700" />
                </div>
              </div>

              <div className="absolute top-16 inset-x-2 z-30 flex flex-col">
                <div className="bg-emerald-600 rounded-2xl shadow-lg text-white p-4 flex items-center border border-emerald-700">
                  <div className="mr-4 text-white">
                    <CornerUpLeft size={36} strokeWidth={3} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xl font-black leading-tight">200 m</div>
                    <div className="text-sm font-medium opacity-90 truncate">Turn left onto Main Boulevard Gulberg</div>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-0 w-full bg-white rounded-t-3xl shadow-[0_-10px_25px_rgba(0,0,0,0.1)] z-50 p-6 space-y-3">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-3xl font-black text-slate-800">22 min</div>
                    <div className="text-gray-500 font-medium text-xs mt-1">12.5 km • 1:05 PM arrival</div>
                  </div>
                  <button 
                    onClick={() => navigateTo('map')}
                    className="bg-rose-100 text-rose-600 px-6 py-2.5 rounded-full font-bold shadow-sm hover:bg-rose-200 transition-colors cursor-pointer text-xs"
                  >
                    Stop
                  </button>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-emerald-600 h-2 rounded-full w-2/5"></div>
                </div>
                <div className="text-center text-[11px] text-gray-400 font-bold uppercase">
                  Navigating to {destination || 'Destination'}
                </div>
              </div>
            </div>
          )}

          {currentScreen === 'report' && (
            <div className="absolute inset-0 bg-white z-50 flex flex-col rounded-[2rem] overflow-hidden">
              <div className="bg-amber-500 text-white pt-10 pb-6 px-4 shadow-md relative rounded-b-3xl z-10">
                <button 
                  onClick={() => navigateTo('map')}
                  className="absolute top-10 left-4 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors cursor-pointer"
                >
                  <X size={24} />
                </button>
                <h2 className="text-xl font-black text-center mt-1">What do you see on the road?</h2>
              </div>
              
              <div className="flex-1 p-6 overflow-y-auto pb-24">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: 'police', label: 'Police Naka', cat: 'police', icon: <ShieldAlert size={28} />, color: 'bg-blue-500' },
                    { id: 'traffic', label: 'Heavy Traffic', cat: 'accident', icon: <Car size={28} />, color: 'bg-red-500' },
                    { id: 'block', label: 'Procession', cat: 'roadblock', icon: <Flag size={28} />, color: 'bg-orange-500' },
                    { id: 'pothole', label: 'Deep Pothole', cat: 'roadwork', icon: <AlertTriangle size={28} />, color: 'bg-amber-500' },
                    { id: 'water', label: 'Waterlogging', cat: 'flooding', icon: <Waves size={28} />, color: 'bg-cyan-500' },
                    { id: 'hazard', label: 'Road Hazard', cat: 'hazard', icon: <TrafficCone size={28} />, color: 'bg-yellow-500' },
                    { id: 'camera', label: 'Speed Camera', cat: 'camera', icon: <Camera size={28} />, color: 'bg-slate-700' },
                    { id: 'closure', label: 'Road Closure', cat: 'closure', icon: <X size={28} />, color: 'bg-rose-600' },
                  ].map((opt) => (
                    <button 
                      key={opt.id}
                      onClick={() => handleReport(opt.label, opt.cat)}
                      className="flex flex-col items-center justify-center space-y-2 cursor-pointer"
                    >
                      <div className={`w-16 h-16 rounded-full shadow-lg ${opt.color} flex items-center justify-center text-white border-[3px] border-white transform hover:scale-105 active:scale-95 transition-all`}>
                        {opt.icon}
                      </div>
                      <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Global Toast */}
        {toastMessage && (
          <div className="absolute top-20 inset-x-4 z-[100] animate-bounce">
            <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl font-bold text-xs text-center border border-slate-700">
              {toastMessage}
            </div>
          </div>
        )}

        {/* Bottom Tab Bar */}
        {currentScreen !== 'navigation' && currentScreen !== 'report' && (
          <div className="absolute bottom-0 w-full h-20 bg-white border-t border-gray-200 flex justify-around items-center px-2 pb-4 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] z-40 rounded-b-[1.5rem]">
            <button onClick={() => navigateTo('map')} className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl ${currentScreen === 'map' ? 'text-emerald-600 scale-110' : 'text-gray-400'}`}>
              <MapIcon size={22} />
              <span className="text-[10px] font-bold mt-1">Map</span>
            </button>
            <button onClick={() => navigateTo('search')} className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl ${currentScreen === 'search' ? 'text-emerald-600 scale-110' : 'text-gray-400'}`}>
              <Search size={22} />
              <span className="text-[10px] font-bold mt-1">Search</span>
            </button>
            <button onClick={() => navigateTo('report')} className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl ${currentScreen === 'report' ? 'text-emerald-600 scale-110' : 'text-gray-400'}`}>
              <AlertTriangle size={22} />
              <span className="text-[10px] font-bold mt-1">Report</span>
            </button>
            <button onClick={() => destination ? navigateTo('navigation') : navigateTo('search')} className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl ${currentScreen === 'navigation' ? 'text-emerald-600 scale-110' : 'text-gray-400'}`}>
              <Navigation size={22} />
              <span className="text-[10px] font-bold mt-1">Drive</span>
            </button>
          </div>
        )}

        {/* Close Simulator Button */}
        <div className="absolute top-3 right-4 z-[60]">
          <button
            onClick={onClose}
            className="w-7 h-7 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-black shadow-lg hover:bg-rose-600 transition-colors cursor-pointer"
            title="Close Waze Mobile App Simulator"
          >
            ✕
          </button>
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-1 inset-x-0 flex justify-center z-50 pointer-events-none">
          <div className="w-32 h-1 bg-gray-300 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

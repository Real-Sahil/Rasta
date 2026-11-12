/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Bluetooth, Radio, Wifi, ShieldCheck, Share2, Users, RefreshCw } from 'lucide-react';
import { CommunityIncident } from '../types';

interface BluetoothMeshShareProps {
  incidents: CommunityIncident[];
  isRtl?: boolean;
}

export const BluetoothMeshShare: React.FC<BluetoothMeshShareProps> = ({ incidents, isRtl = false }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [peersConnected, setPeersConnected] = useState(3);
  const [meshStatus, setMeshStatus] = useState<'idle' | 'broadcasting' | 'synced'>('idle');
  const [broadcastLog, setBroadcastLog] = useState<string[]>([]);

  const handleStartMeshBroadcast = () => {
    setIsScanning(true);
    setMeshStatus('broadcasting');
    setBroadcastLog([
      isRtl ? 'بلوٹوتھ LE پروڈکشن اسکین شروع...' : 'Initiating Bluetooth LE & P2P Mesh scan...',
      isRtl ? 'قریبی مسافروں کے نوڈز سے رابطہ قائم ہو رہا ہے...' : 'Discovering nearby commuter mesh nodes...'
    ]);

    setTimeout(() => {
      setPeersConnected(7);
      setMeshStatus('synced');
      setIsScanning(false);
      setBroadcastLog((prev) => [
        isRtl ? `کامیابی: 7 نوڈز سے ${incidents.length} ٹریفک الرٹس شیئر ہو گئے!` : `Success: Broadcasted ${incidents.length} traffic reports to 7 nearby P2P peers!`,
        ...prev
      ]);
    }, 2000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xl border border-slate-200 dark:border-slate-800 space-y-3.5">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/20">
            <Bluetooth className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              {isRtl ? 'بلوٹوتھ P2P میش ٹریفک شیئرنگ' : 'Bluetooth P2P Mesh Traffic Sharing'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isRtl ? 'انٹرنیٹ کے بغیر قریبی گاڑیوں سے الرٹس شیئر کریں' : 'Share road incidents peer-to-peer without cellular data'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-800">
          <Users className="w-3.5 h-3.5" />
          <span>{peersConnected} Peers</span>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
          <span className="font-semibold flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-ping" />
            {meshStatus === 'synced' ? (isRtl ? 'میش نیٹ ورک فعال' : 'Mesh Active & Synced') : (isRtl ? 'اسٹین بائی موڈ' : 'Mesh Standby')}
          </span>
          <span className="font-mono font-bold text-emerald-600">{incidents.length} Reports queued</span>
        </div>

        {broadcastLog.length > 0 && (
          <div className="space-y-1 bg-slate-900 text-emerald-400 font-mono text-[11px] p-2.5 rounded-lg max-h-24 overflow-y-auto">
            {broadcastLog.map((log, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="text-slate-500">›</span>
                <span>{log}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleStartMeshBroadcast}
          disabled={isScanning}
          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isScanning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{isRtl ? 'اسکین ہو رہا ہے...' : 'Broadcasting P2P Mesh...'}</span>
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              <span>{isRtl ? 'قریبی نوڈز کو براڈکاسٹ کریں' : 'Broadcast to Nearby Peers'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Download, Smartphone, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      setJustInstalled(true);
      setTimeout(() => setJustInstalled(false), 3000);
    }
  };

  if (isInstallable) {
    return (
      <button
        onClick={handleInstall}
        className={`flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-black text-[11px] font-bold px-2.5 py-1 rounded-sm transition-all shadow-xs uppercase tracking-wider cursor-pointer border border-cyan-400 ${className}`}
        title="アプリ (PWA) としてパソコンやスマホにインストール"
      >
        {justInstalled ? <Check size={13} /> : <Download size={13} />}
        <span>{justInstalled ? 'INSTALLED' : 'PWA INSTALL'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold px-2.5 py-1 rounded-sm border border-slate-700 transition-colors uppercase tracking-wider cursor-pointer ${className}`}
          title="iPhone / iPad にアプリをインストール"
        >
          <Smartphone size={13} className="text-cyan-400" />
          <span>INSTALL ON IOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-md bg-[#14161a] border border-slate-700 p-5 shadow-2xl text-slate-200">
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2 mb-3">
                <Smartphone size={16} />
                iPhone / iPad へのインストール方法
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed space-y-2 mb-4">
                1. Safariの画面下部にある <strong>「共有アイコン（四角から矢印）」</strong> をタップします。<br />
                2. メニューをスクロールして <strong>「ホーム画面に追加」</strong> を選択します。
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-sm bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 text-xs transition-colors border border-slate-600 uppercase tracking-wider cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

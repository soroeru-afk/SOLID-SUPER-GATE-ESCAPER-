import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Settings, Folder, File as FileIcon, X, Search, Plus, Trash2, Edit2, Upload, Download, Map as MapIcon, ChevronRight, ChevronLeft, Menu, Check, Copy, PanelLeftClose, PanelRightClose, PanelLeftOpen, PanelRightOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// === Types ===
interface LocationItem {
  id: string;
  folderName: string;
  title: string;
  url: string;
  capturedDate?: string; // New feature: manually specified Street View capture date
  parsed: {
    lat?: string;
    lng?: string;
    heading?: string;
    pitch?: string;
    fov?: string;
    pano?: string;
    zoom?: string;
    isValid: boolean;
    fallbackUrl?: string;
  };
}

interface AppSettings {
  sidebarPosition: 'left' | 'right';
  sidebarWidth: number;
  theme: 'dark' | 'light';
  language: 'jp' | 'en';
}

const translations = {
  jp: {
    viewer: 'STREET VIEW VIEWER',
    loadBookmark: 'ブックマークを読込...',
    searchLoc: '場所名で検索...',
    emptyLoc1: 'ブックマークエクスポート(HTML)',
    emptyLoc2: 'またはカスタムJSONを読み込んでください',
    noMatch: '条件に一致する場所がありません',
    selected: '件を選択中',
    cancel: 'キャンセル',
    bulkDelete: '一括削除',
    moveTo: '(移動先フォルダを選択)',
    move: '移動',
    register: '新しい場所を登録',
    export: 'Data Export',
    import: 'Data Import',
    clearAll: 'すべてのデータをクリア',
    loading: 'Loading Street View...',
    openMap: 'Google Mapsで開く',
    settings: 'Settings',
    sidebarWidth: 'サイドバー幅',
    sidebarPos: 'サイドバーの配置',
    posLeft: '左側に配置',
    posRight: '右側に配置',
    theme: 'テーマカラー',
    dark: 'ダーク',
    light: 'ライト',
    close: '閉じる',
    desc: '瞬時に場所を移動できる自分専用のどこでもドア',
    tmTitle: '💡 Tampermonkey連携機能:',
    tmDesc1: 'ブラウザ拡張等から直接場所を追加できます。',
    tmDesc2: 'ローカルストレージ sv_locations_sync を購読中。',
    captured: '撮影:',
    currLoc: 'Current Location:'
  },
  en: {
    viewer: 'STREET VIEW VIEWER',
    loadBookmark: 'Load Bookmarks...',
    searchLoc: 'Search locations...',
    emptyLoc1: 'Please load a bookmark export (HTML)',
    emptyLoc2: 'or custom JSON file',
    noMatch: 'No locations match your search',
    selected: ' items selected',
    cancel: 'Cancel',
    bulkDelete: 'Bulk Delete',
    moveTo: '(Select destination folder)',
    move: 'Move',
    register: 'Register New Location',
    export: 'Data Export',
    import: 'Data Import',
    clearAll: 'Clear All Data',
    loading: 'Loading Street View...',
    openMap: 'Open in Google Maps',
    settings: 'Settings',
    sidebarWidth: 'Sidebar Width',
    sidebarPos: 'Sidebar Position',
    posLeft: 'Left',
    posRight: 'Right',
    theme: 'Theme Color',
    dark: 'Dark',
    light: 'Light',
    close: 'Close',
    desc: 'Your personal portal to travel anywhere instantly',
    tmTitle: '💡 Tampermonkey Integration:',
    tmDesc1: 'Add locations directly from browser extensions.',
    tmDesc2: 'Subscribing to local storage sv_locations_sync.',
    captured: 'Captured:',
    currLoc: 'CURRENT LOCATION:'
  }
};

// === Utilities ===
export const parseGoogleMapsUrl = (url: string) => {
  const latLngMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!latLngMatch) return { isValid: false, fallbackUrl: url };
  
  const lat = latLngMatch[1];
  const lng = latLngMatch[2];

  let panoId: string | undefined = undefined;
  const panoMatch = url.match(/!1s([^!&?]+)/);
  if (panoMatch) {
    panoId = panoMatch[1];
  }

  let heading = '0';
  const hMatch = url.match(/,(-?\d+(?:\.\d+)?)h/);
  if (hMatch) heading = hMatch[1];

  let pitch = '0';
  const tMatch = url.match(/,(-?\d+(?:\.\d+)?)t/);
  if (tMatch) {
    pitch = (90 - parseFloat(tMatch[1])).toFixed(2);
  }

  let zoom = '0';
  // y(FOV)からzoomを計算すると、旧来のcbpパラメーターとの互換性で寄りすぎてしまうため常に0(ワイド)とする
  const yMatch = url.match(/,(-?\d+(?:\.\d+)?)y/);
  if (yMatch) {
    // const fov = parseFloat(yMatch[1]);
  }

  return { lat, lng, pano: panoId, heading, pitch, zoom, isValid: true };
};

function processBookmarksHtml(htmlString: string): Omit<LocationItem, 'id' | 'parsed'>[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const items: Omit<LocationItem, 'id' | 'parsed'>[] = [];
  
  const links = doc.querySelectorAll('a, A');
  links.forEach(a => {
    const url = a.getAttribute('href');
    if (!url) return;
    
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('google.com/maps') || lowerUrl.includes('maps.google.com') || lowerUrl.includes('goo.gl/maps') || lowerUrl.includes('google.co.jp/maps')) {
      const folderPath: string[] = [];
      let current = a.parentElement;
      while (current) {
        if (current.tagName === 'DL') {
          const prev = current.previousElementSibling;
          if (prev && (prev.tagName === 'H3' || prev.tagName === 'h3')) {
            folderPath.unshift(prev.textContent?.trim() || '');
          } else if (prev && (prev.tagName === 'DT' || prev.tagName === 'dt')) {
             const h3 = prev.querySelector('h3, H3');
             if (h3) folderPath.unshift(h3.textContent?.trim() || '');
          } else if (current.parentElement && (current.parentElement.tagName === 'DT' || current.parentElement.tagName === 'dt')) {
             const dt = current.parentElement;
             const h3 = dt.querySelector('h3, H3');
             if (h3) folderPath.unshift(h3.textContent?.trim() || '');
          }
        }
        current = current.parentElement;
      }
      
      const folderName = folderPath.length > 0 ? folderPath.join(' / ') : '未分類';
      items.push({
        folderName: folderName,
        title: a.textContent || '名称未設定',
        url: url,
      });
    }
  });
  return items;
}

const DEFAULT_SETTINGS: AppSettings = {
  sidebarPosition: 'left',
  sidebarWidth: 320,
  theme: 'dark',
  language: 'jp',
};

// === Main App Component ===
export default function App() {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [folderState, setFolderState] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentItem, setCurrentItem] = useState<LocationItem | null>(null);
  const [bulkTargetFolder, setBulkTargetFolder] = useState('');
  
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LocationItem | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const t = (key: keyof typeof translations.jp) => translations[settings.language][key];

  const fileInputRef = useRef<HTMLInputElement>(null);

  // === Custom Dialog State ===
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm' | 'prompt';
    title: string;
    message: string;
    defaultValue?: string;
    resolve: (value: any) => void;
  } | null>(null);
  const [promptValue, setPromptValue] = useState('');

  useEffect(() => {
    if (dialogState?.type === 'prompt') {
      setPromptValue(dialogState.defaultValue || '');
    }
  }, [dialogState]);

  const customAlert = (message: string) => {
    return new Promise<void>((resolve) => {
      setDialogState({
        isOpen: true,
        type: 'alert',
        title: 'お知らせ',
        message,
        resolve: () => resolve()
      });
    });
  };

  const customConfirm = (message: string) => {
    return new Promise<boolean>((resolve) => {
      setDialogState({
        isOpen: true,
        type: 'confirm',
        title: '確認',
        message,
        resolve
      });
    });
  };

  const customPrompt = (message: string, defaultValue: string = '') => {
    return new Promise<string | null>((resolve) => {
      setDialogState({
        isOpen: true,
        type: 'prompt',
        title: '入力',
        message,
        defaultValue,
        resolve
      });
    });
  };

  const closeDialog = (value: any) => {
    if (dialogState) {
      dialogState.resolve(value);
      setDialogState(null);
    }
  };

  // Initialize
  useEffect(() => {
    try {
      const cache = localStorage.getItem('sv_locations_cache');
      if (cache) {
        const parsed = JSON.parse(cache);
        if (Array.isArray(parsed)) setLocations(parsed);
      }
      const savedSettings = localStorage.getItem('sv_settings');
      if (savedSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
      }
      const savedCurrentItem = localStorage.getItem('sv_current_item');
      if (savedCurrentItem) {
        setCurrentItem(JSON.parse(savedCurrentItem));
      }
    } catch(e) {}
  }, []);

  useEffect(() => {
    if (currentItem) {
      localStorage.setItem('sv_current_item', JSON.stringify(currentItem));
    } else {
      localStorage.removeItem('sv_current_item');
    }
  }, [currentItem]);

  // Save changes
  const saveLocations = (newLocs: LocationItem[]) => {
    setLocations(newLocs);
    try {
      localStorage.setItem('sv_locations_cache', JSON.stringify(newLocs));
    } catch(e) {}
  };

  const saveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('sv_settings', JSON.stringify(newSettings));
    } catch(e) {}
  };

  // Sync Tampermonkey
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'sv_locations_sync' && e.newValue) {
        try {
          const syncData = JSON.parse(e.newValue);
          if (Array.isArray(syncData)) {
            let added = false;
            setLocations(prev => {
              const newArray = [...prev];
              const existingUrls = new Set(newArray.map(i => i.url));
              syncData.forEach(item => {
                if (!existingUrls.has(item.url)) {
                  newArray.push({
                    id: item.id || `item_${Date.now()}_${Math.random()}`,
                    folderName: item.folderName || 'Tampermonkey追加分',
                    title: item.title,
                    url: item.url,
                    capturedDate: item.capturedDate,
                    parsed: item.parsed || parseGoogleMapsUrl(item.url)
                  });
                  added = true;
                  existingUrls.add(item.url);
                }
              });
              return newArray;
            });
          }
        } catch(err) {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (locations.length > 0) {
      localStorage.setItem('sv_locations_cache', JSON.stringify(locations));
    }
  }, [locations]);

  // Derived state
  const folderGroups = useMemo(() => {
    let filtered = locations;
    const lowerQuery = searchQuery.toLowerCase();
    if (lowerQuery) {
      filtered = locations.filter(i => 
        i.title.toLowerCase().includes(lowerQuery) || 
        i.folderName.toLowerCase().includes(lowerQuery)
      );
    }
    
    const groups: Record<string, LocationItem[]> = {};
    filtered.forEach(item => {
      const f = item.folderName || 'General';
      if (!groups[f]) groups[f] = [];
      groups[f].push(item);
    });
    return groups;
  }, [locations, searchQuery]);

  const allFolders = useMemo(() => Array.from(new Set(locations.map(i => i.folderName))), [locations]);

  // Handlers
  const toggleFolder = (folderName: string) => {
    if (searchQuery) return; // Expand all automatically if searching
    setFolderState(prev => ({ ...prev, [folderName]: !prev[folderName] }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      let newItems: LocationItem[] = [];
      
      if (file.name.endsWith('.json')) {
        try { newItems = JSON.parse(text); } catch(err) { await customAlert('JSONパースエラー'); }
      } else {
        const extracted = processBookmarksHtml(text);
        newItems = extracted.map(item => ({
          ...item,
          id: `item_${Date.now()}_${Math.random()}`,
          parsed: parseGoogleMapsUrl(item.url)
        }));
      }

      if (newItems.length === 0) {
        await customAlert('Google マップのURLを含むブックマークか、有効なJSONが見つかりませんでした。');
        return;
      }

      setLocations(prev => {
        const added: LocationItem[] = [];
        const existingUrls = new Set(prev.map(i => i.url));
        newItems.forEach(item => {
          if (!existingUrls.has(item.url)) {
            const parsedItem = {
              ...item,
              id: item.id || `item_${Date.now()}_${Math.random()}`,
              parsed: item.parsed || parseGoogleMapsUrl(item.url)
            };
            added.push(parsedItem);
            existingUrls.add(item.url);
          }
        });
        customAlert(`読み込み完了！\n新規 ${added.length}件の場所を認識しました。`);
        return [...prev, ...added];
      });
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const exportDataJson = async () => {
    if (locations.length === 0) {
      await customAlert('エクスポートするデータがありません。');
      return;
    }
    const dataStr = JSON.stringify(locations, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `streetview_locations_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAllData = async () => {
    if (await customConfirm('すべての場所データとフォルダを完全に削除します。本当によろしいですか？')) {
      setLocations([]);
      setCurrentItem(null);
      setSelectedIds(new Set());
      localStorage.removeItem('sv_locations_cache');
      localStorage.removeItem('sv_locations_sync');
    }
  };

  const bulkDelete = async () => {
    if (await customConfirm(`選択した ${selectedIds.size} 件の場所を削除しますか？`)) {
      setLocations(prev => prev.filter(i => !selectedIds.has(i.id)));
      if (currentItem && selectedIds.has(currentItem.id)) {
        setCurrentItem(null);
      }
      setSelectedIds(new Set());
    }
  };

  const bulkMove = async () => {
    if (!bulkTargetFolder) {
      await customAlert('移動先のフォルダを選択してください');
      return;
    }
    const target = bulkTargetFolder.trim();
    setLocations(prev => prev.map(item => selectedIds.has(item.id) ? { ...item, folderName: target } : item));
    setSelectedIds(new Set());
  };

  const editFolder = async (folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newName = await customPrompt('新しいフォルダ名を入力してください', folderName);
    if (newName && newName.trim() && newName.trim() !== folderName) {
      const trimmed = newName.trim();
      setLocations(prev => prev.map(item => item.folderName === folderName ? { ...item, folderName: trimmed } : item));
      setFolderState(prev => {
        const next = { ...prev };
        if (next[folderName] !== undefined) {
          next[trimmed] = next[folderName];
          delete next[folderName];
        }
        return next;
      });
    }
  };

  const deleteFolder = async (folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (await customConfirm(`フォルダ「${folderName}」に含まれるすべての場所を削除しますか？`)) {
      setLocations(prev => prev.filter(item => item.folderName !== folderName));
      if (currentItem && currentItem.folderName === folderName) {
        setCurrentItem(null);
      }
      setSelectedIds(prev => {
        const next = new Set(prev);
        locations.filter(i => i.folderName === folderName).forEach(i => next.delete(i.id));
        return next;
      });
    }
  };

  const getIframeUrl = (item: LocationItem) => {
    if (item.parsed && item.parsed.isValid) {
      const p = item.parsed;
      const zoom = p.zoom || '0';
      const panoParam = p.pano ? `panoid=${p.pano}` : `cbll=${p.lat},${p.lng}`;
      return `https://maps.google.com/maps?layer=c&${panoParam}&cbp=0,${p.heading},0,${zoom},${p.pitch}&output=svembed`;
    }
    return `https://maps.google.com/maps?q=${encodeURIComponent(item.url)}&output=embed`;
  };

  return (
    <div className={`flex bg-slate-950 text-slate-300 font-sans h-screen overflow-hidden select-none ${settings.theme === 'light' ? 'theme-light' : ''}`}>
      
      {/* Search overlay & basic context layout */}
      <div 
        className="flex h-full w-full relative" 
        style={{ flexDirection: settings.sidebarPosition === 'right' ? 'row-reverse' : 'row' }}
      >
        
        {/* === Sidebar === */}
        <div 
          className="flex flex-col bg-slate-900 border-slate-800 shrink-0 h-full relative z-20"
          style={{ 
            width: isSidebarOpen ? `${settings.sidebarWidth}px` : '0px', 
            borderRightWidth: isSidebarOpen && settings.sidebarPosition === 'left' ? '1px' : '0',
            borderLeftWidth: isSidebarOpen && settings.sidebarPosition === 'right' ? '1px' : '0',
            overflow: 'hidden'
          }}
        >
          <div style={{ width: `${settings.sidebarWidth}px` }} className="flex flex-col h-full shrink-0">
            {/* Header Area */}
          <div className="p-4 border-b border-slate-800 shrink-0 flex items-end justify-between gap-2">
            <div className="flex flex-col">
              <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 tracking-tighter uppercase leading-tight">
                SOLID SUPER<br/>GATE ESCAPER
              </h1>
              <span className="text-[10px] text-cyan-500 font-bold tracking-widest mt-1.5 leading-none">{t('viewer')}</span>
            </div>
            <div className="flex border border-slate-700 rounded-sm overflow-hidden text-[9px] font-bold shrink-0 mb-[1px]">
              <button 
                onClick={() => saveSettings({ ...settings, language: 'en' })}
                className={`px-1.5 py-0.5 transition-colors ${settings.language === 'en' ? 'bg-slate-400 text-slate-900' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
              >
                EN
              </button>
              <button 
                onClick={() => saveSettings({ ...settings, language: 'jp' })}
                className={`px-1.5 py-0.5 transition-colors ${settings.language === 'jp' ? 'bg-slate-400 text-slate-900' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
              >
                JP
              </button>
            </div>
          </div>

          <div className="p-4 border-b border-slate-800 shrink-0 flex flex-col gap-3">
            <input type="file" ref={fileInputRef} accept=".html,.json" className="hidden" onChange={handleFileUpload} />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-xs font-bold text-slate-300 transition-colors uppercase tracking-wider"
            >
              <Download size={14} /> {t('loadBookmark')}
            </button>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                <Search size={14} />
              </span>
              <input 
                type="text" 
                placeholder={t('searchLoc')} 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-black/40 border border-slate-700 rounded-md text-xs text-slate-200 focus:border-cyan-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* List Area */}
          <div className="flex-1 overflow-y-auto p-2 font-mono text-sm scrollbar-thin">
            {locations.length === 0 ? (
              <div className="text-center p-8 text-xs text-slate-500 leading-relaxed whitespace-pre-line">
                {t('emptyLoc1')}<br/>{t('emptyLoc2')}
              </div>
            ) : Object.keys(folderGroups).length === 0 ? (
              <div className="text-center p-8 text-xs text-slate-500">
                {t('noMatch')}
              </div>
            ) : (
              Object.entries(folderGroups).sort().map(([folderName, items]) => {
                const isOpen = searchQuery ? true : !!folderState[folderName];
                const folderSelectedCount = items.filter(i => selectedIds.has(i.id)).length;
                const isAllChecked = items.length > 0 && folderSelectedCount === items.length;
                const isIndeterminate = folderSelectedCount > 0 && folderSelectedCount < items.length;

                return (
                  <div key={folderName} className="mb-2">
                    <div className="flex items-center group relative pr-14 ml-[2px]">
                      <div className="w-[34px] flex items-center justify-center shrink-0">
                        <input 
                          type="checkbox"
                          className="custom-checkbox"
                          checked={isAllChecked}
                          ref={el => { if (el) el.indeterminate = isIndeterminate; }}
                          onChange={(e) => {
                            const newSet = new Set(selectedIds);
                            if (e.target.checked) {
                              items.forEach(i => newSet.add(i.id));
                            } else {
                              items.forEach(i => newSet.delete(i.id));
                            }
                            setSelectedIds(newSet);
                          }}
                        />
                      </div>
                      <button 
                        className="flex-1 flex items-center py-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-sm transition-colors text-left min-w-0 group-hover:bg-slate-800"
                        onClick={() => toggleFolder(folderName)}
                      >
                        <ChevronRight size={14} className={`mr-1 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
                        <Folder size={14} className="mr-2 opacity-50 shrink-0" />
                        <span className="flex-1 truncate uppercase text-[11px] font-bold tracking-wider">
                          {folderName}
                        </span>
                        <span className="text-[10px] bg-slate-800 px-1.5 rounded-sm opacity-50 shrink-0 mr-2">{items.length}</span>
                      </button>
                      <div className="absolute right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 group-hover:bg-slate-800 px-1 rounded-sm">
                        <button onClick={(e) => editFolder(folderName, e)} className="p-1 hover:text-cyan-400 text-slate-500 transition-colors cursor-pointer"><Edit2 size={12}/></button>
                        <button onClick={(e) => deleteFolder(folderName, e)} className="p-1 hover:text-red-400 text-slate-500 transition-colors cursor-pointer"><Trash2 size={12}/></button>
                      </div>
                    </div>
                    
                    {isOpen && (
                      <div className="mt-1 flex flex-col gap-0.5 pr-2">
                        {items.map(item => {
                          const isActive = currentItem?.id === item.id;
                          const isChecked = selectedIds.has(item.id);
                          return (
                            <div 
                              key={item.id} 
                              className={`
                                flex items-center py-1 rounded-sm cursor-pointer border-l-2 transition-colors group pr-2
                                ${isActive ? 'bg-cyan-900/20 border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'}
                              `}
                              onClick={() => setCurrentItem(item)}
                            >
                              <div className="w-[34px] flex justify-center shrink-0">
                                <input 
                                  type="checkbox" 
                                  className="custom-checkbox"
                                  checked={isChecked}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    const newSet = new Set(selectedIds);
                                    if (e.target.checked) newSet.add(item.id);
                                    else newSet.delete(item.id);
                                    setSelectedIds(newSet);
                                  }}
                                />
                              </div>
                              <div className="flex-1 min-w-0 flex flex-col pl-[48px]">
                                <span className="truncate text-xs font-semibold">{item.title}</span>
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-[9px] opacity-60">
                                    {item.parsed?.isValid ? `🧭 ${item.parsed.lat}, ${item.parsed.lng}` : '🗺️ 通常URL'}
                                  </span>
                                  {item.capturedDate && (
                                    <span className="text-[9px] bg-cyan-900/50 text-cyan-300 px-1 rounded-sm border border-cyan-800 shrink-0">
                                      📸 {item.capturedDate}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button 
                                className="opacity-0 group-hover:opacity-100 hover:text-cyan-400 p-1 transition-opacity shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditTarget(item);
                                  setIsEditModalOpen(true);
                                }}
                              >
                                <Edit2 size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Bulk actions */}
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-slate-900 border-t-2 border-cyan-500 p-3 flex flex-col gap-2 shrink-0 overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">☑ {selectedIds.size}{t('selected')}</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setSelectedIds(new Set())}
                      className="text-[10px] bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white px-2 py-1 rounded border border-slate-700 font-bold transition-colors uppercase cursor-pointer"
                    >
                      {t('cancel')}
                    </button>
                    <button 
                      onClick={bulkDelete}
                      className="text-[10px] bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white px-2 py-1 rounded border border-red-500/20 font-bold transition-colors uppercase cursor-pointer"
                    >
                      🗑️ {t('bulkDelete')}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 items-center mt-1">
                  <select 
                    value={bulkTargetFolder}
                    onChange={(e) => setBulkTargetFolder(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded text-xs text-white px-2 py-1.5 focus:border-cyan-500 focus:outline-none min-w-0"
                  >
                    <option value="">{t('moveTo')}</option>
                    {allFolders.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <button 
                    onClick={bulkMove}
                    className="text-[10px] bg-cyan-600 hover:bg-cyan-500 text-black px-3 py-1.5 rounded font-bold transition-colors uppercase shrink-0 cursor-pointer"
                  >
                    {t('move')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer actions */}
          <div className="p-3 border-t border-slate-800 shrink-0 flex flex-col gap-2">
            <button 
              className="w-full flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-bold py-2 rounded-md transition-colors"
              onClick={() => {
                setEditTarget(null);
                setIsEditModalOpen(true);
              }}
            >
              <Plus size={14} /> {t('register')}
            </button>
            <div className="flex gap-2">
              <button onClick={exportDataJson} className="flex-1 flex justify-center items-center gap-1 text-[10px] border border-slate-700 hover:bg-slate-800 text-slate-300 py-1.5 rounded-md transition-colors uppercase">
                <Upload size={12} /> {t('export')}
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex justify-center items-center gap-1 text-[10px] border border-slate-700 hover:bg-slate-800 text-slate-300 py-1.5 rounded-md transition-colors uppercase">
                <Download size={12} /> {t('import')}
              </button>
            </div>
            <button 
              onClick={clearAllData}
              className="w-full flex justify-center items-center gap-2 text-[10px] border border-red-900 hover:bg-red-900/30 text-red-500 py-1.5 rounded-md transition-colors mt-1"
            >
              <Trash2 size={12} /> {t('clearAll')}
            </button>
          </div>
          </div> {/* End inner wrapper */}
        </div>

        {/* === Main Content === */}
        <div className="flex-1 bg-black flex flex-col relative z-10 min-w-0">
          
          {/* Sidebar Toggle Button (Expanding tab with wider hit area) */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`absolute top-1/2 -translate-y-1/2 z-[60] flex items-center justify-center group cursor-pointer
              ${settings.sidebarPosition === 'left' ? 'left-0' : 'right-0'}`}
            style={{
              width: '24px',
              height: '100px',
            }}
            title="サイドバーを開閉"
          >
            <div 
              className={`absolute top-1/2 -translate-y-1/2 bg-slate-700/60 group-hover:bg-slate-600 transition-all duration-300 shadow-lg backdrop-blur-sm flex items-center justify-center h-[80px] text-white
                ${settings.sidebarPosition === 'left' ? 'left-0 rounded-r-md' : 'right-0 rounded-l-md'}
                w-[6px] group-hover:w-[20px]`}
            >
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden shrink-0 flex items-center justify-center w-full">
                {settings.sidebarPosition === 'left' ? (
                  isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />
                ) : (
                  isSidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />
                )}
              </div>
            </div>
          </button>

          {!currentItem ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-black relative">
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="absolute top-4 right-4 p-2 text-slate-500 hover:bg-slate-800 hover:text-white rounded-md transition-colors"
                title="設定"
              >
                <Settings size={18} />
              </button>
              <div className="text-6xl font-black font-mono text-white/5 tracking-tighter leading-none mb-4 uppercase">
                STREET VIEW
              </div>
              <p className="text-xs font-mono tracking-widest text-slate-500 mb-8">
                {t('desc')}
              </p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-400 font-bold text-[10px] tracking-wider uppercase px-4 py-2 rounded-md transition-colors flex items-center gap-2"
              >
                <Download size={14} /> {t('loadBookmark')}
              </button>
              
              <div className="mt-12 p-3 bg-cyan-900/10 border border-cyan-900/30 rounded-md text-left text-[10px] font-mono text-slate-400 max-w-sm">
                <strong className="text-cyan-500 mb-1 block">{t('tmTitle')}</strong>
                {t('tmDesc1')}<br/>
                {t('tmDesc2')}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full bg-slate-900">
              <div className="h-12 border-b border-slate-800 bg-black/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0 font-mono text-xs">
                  <span className="text-slate-500 uppercase tracking-widest text-[9px]">{t('currLoc')}</span>
                  <span className="text-white truncate font-bold">{currentItem.title}</span>
                  {currentItem.capturedDate && (
                    <span className="bg-slate-800 border border-slate-700 text-cyan-400 px-1.5 py-0.5 rounded-sm text-[9px] shrink-0">
                      {t('captured')} {currentItem.capturedDate}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 shrink-0 items-center">
                  <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-1.5 text-slate-400 hover:bg-white/10 hover:text-white rounded-md transition-colors"
                    title="設定"
                  >
                    <Settings size={16} />
                  </button>
                  <a 
                    href={currentItem.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-1.5 bg-transparent border border-white/40 hover:border-white hover:bg-white/10 text-white font-bold text-[10px] px-3 py-1.5 rounded-md uppercase tracking-wider transition-colors"
                  >
                    <MapIcon size={12} /> {t('openMap')}
                  </a>
                </div>
              </div>
              <div className="flex-1 bg-slate-950 relative flex items-center justify-center">
                <div className="text-slate-600 font-mono text-xs tracking-widest absolute">{t('loading')}</div>
                <iframe 
                  key={currentItem.id} // force re-render on change
                  src={getIframeUrl(currentItem)} 
                  className="w-full h-full border-none absolute inset-0 z-10" 
                  allowFullScreen
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* === Settings Modal === */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl"
            >
              <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Settings</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>
              
              <div className="p-5 flex flex-col gap-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      {t('sidebarWidth')}
                    </label>
                    <span className="text-xs font-mono font-bold text-white">{settings.sidebarWidth}PX</span>
                  </div>
                  <input 
                    type="range" 
                    min="200" 
                    max="600" 
                    value={settings.sidebarWidth} 
                    onChange={(e) => saveSettings({ ...settings, sidebarWidth: Number(e.target.value) })}
                    className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    {t('sidebarPos')}
                  </label>
                  <div className="flex bg-slate-800 rounded-md p-1 border border-slate-700">
                    <button 
                      className={`flex-1 flex justify-center items-center py-1.5 text-xs font-bold rounded-sm transition-colors ${settings.sidebarPosition === 'left' ? 'bg-cyan-600 text-black' : 'text-slate-400 hover:text-slate-200'}`}
                      onClick={() => saveSettings({ ...settings, sidebarPosition: 'left' })}
                    >
                      {t('posLeft')}
                    </button>
                    <button 
                      className={`flex-1 flex justify-center items-center py-1.5 text-xs font-bold rounded-sm transition-colors ${settings.sidebarPosition === 'right' ? 'bg-cyan-600 text-black' : 'text-slate-400 hover:text-slate-200'}`}
                      onClick={() => saveSettings({ ...settings, sidebarPosition: 'right' })}
                    >
                      {t('posRight')}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    {t('theme')}
                  </label>
                  <div className="flex bg-slate-800 rounded-md p-1 border border-slate-700">
                    <button 
                      className={`flex-1 flex justify-center items-center py-1.5 text-xs font-bold rounded-sm transition-colors ${(!settings.theme || settings.theme === 'dark') ? 'bg-cyan-600 text-black' : 'text-slate-400 hover:text-slate-200'}`}
                      onClick={() => saveSettings({ ...settings, theme: 'dark' })}
                    >
                      {t('dark')}
                    </button>
                    <button 
                      className={`flex-1 flex justify-center items-center py-1.5 text-xs font-bold rounded-sm transition-colors ${settings.theme === 'light' ? 'bg-cyan-600 text-black' : 'text-slate-400 hover:text-slate-200'}`}
                      onClick={() => saveSettings({ ...settings, theme: 'light' })}
                    >
                      {t('light')}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-md transition-colors"
                >
                  {t('close')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Edit / Create Modal === */}
      <AnimatePresence>
        {isEditModalOpen && (
          <EditModal 
            onClose={() => setIsEditModalOpen(false)}
            onSave={(item) => {
              setLocations(prev => {
                const arr = [...prev];
                const idx = arr.findIndex(i => i.id === item.id);
                if (idx >= 0) arr[idx] = item;
                else arr.push(item);
                return arr;
              });
              setIsEditModalOpen(false);
              // Ensure folder is open
              setFolderState(prev => ({ ...prev, [item.folderName]: true }));
            }}
            onDelete={(id) => {
              setLocations(prev => prev.filter(i => i.id !== id));
              if (currentItem?.id === id) setCurrentItem(null);
              setIsEditModalOpen(false);
            }}
            initialData={editTarget}
            allFolders={allFolders}
            customAlert={customAlert}
            customConfirm={customConfirm}
          />
        )}
      </AnimatePresence>

      {/* === Custom Dialog Overlay === */}
      <AnimatePresence>
        {dialogState && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex justify-center items-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="px-5 py-4 border-b border-slate-800 bg-slate-900">
                <h2 className="text-sm font-bold text-white tracking-widest">{dialogState.title}</h2>
              </div>
              <div className="p-5 text-slate-300 text-[13px] whitespace-pre-line leading-relaxed">
                {dialogState.message}
                {dialogState.type === 'prompt' && (
                  <input 
                    type="text" 
                    value={promptValue} 
                    onChange={e => setPromptValue(e.target.value)} 
                    autoFocus
                    className="mt-4 w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                  />
                )}
              </div>
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-2 shrink-0">
                {(dialogState.type === 'confirm' || dialogState.type === 'prompt') && (
                  <button 
                    onClick={() => closeDialog(dialogState.type === 'prompt' ? null : false)}
                    className="px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-md text-xs font-bold transition-colors"
                  >
                    キャンセル
                  </button>
                )}
                <button 
                  onClick={() => closeDialog(dialogState.type === 'prompt' ? promptValue : true)}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-black rounded-md text-xs font-bold transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// === EditModal Component ===
function EditModal({ 
  onClose, 
  onSave, 
  onDelete, 
  initialData, 
  allFolders,
  customAlert,
  customConfirm
}: { 
  onClose: () => void, 
  onSave: (item: LocationItem) => void, 
  onDelete: (id: string) => void,
  initialData: LocationItem | null,
  allFolders: string[],
  customAlert: (message: string) => Promise<void>,
  customConfirm: (message: string) => Promise<boolean>
}) {
  const [url, setUrl] = useState(initialData?.url || '');
  const [title, setTitle] = useState(initialData?.title || '');
  const [folder, setFolder] = useState(initialData?.folderName || '');
  const [capturedDate, setCapturedDate] = useState(initialData?.capturedDate || '');
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);

  // Auto-extract title from URL if empty
  useEffect(() => {
    let isCancelled = false;

    const tryAutoTitle = async () => {
      // urlが有効で title が空の時だけ
      if (!url || title) return;

      if (url.includes('/place/')) {
        try {
          const u = new URL(url);
          const match = u.pathname.match(/\/place\/([^\/]+)/);
          if (match && match[1]) {
            let dec = decodeURIComponent(match[1]).replace(/\+/g, ' ');
            if (!/^[\d\.\-\,]+$/.test(dec)) {
              if (!isCancelled) setTitle(dec);
              return;
            }
          }
        } catch(e) {}
      }

      const parsed = parseGoogleMapsUrl(url);
      if (parsed.isValid && parsed.lat && parsed.lng) {
        if (!isCancelled) setIsFetchingAddress(true);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${parsed.lat}&lon=${parsed.lng}&zoom=16&addressdetails=1&accept-language=ja`, {
            headers: { 'Accept-Language': 'ja' } 
          });
          const data = await res.json();
          if (!isCancelled && data && data.address) {
            const { suburb, quarter, city_district, city, province, state, road } = data.address;
            const parts = [province || state, city || city_district, suburb || quarter || road].filter(Boolean);
            const uniqueParts = Array.from(new Set(parts));
            if (uniqueParts.length > 0) {
              setTitle(uniqueParts.join(' '));
            } else if (data.display_name) {
              setTitle(data.display_name.split(',').slice(0, 2).join(' '));
            }
          }
        } catch(err) {
          console.error(err);
        } finally {
          if (!isCancelled) setIsFetchingAddress(false);
        }
      }
    };

    const timer = setTimeout(tryAutoTitle, 600);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [url]);

  const handleSave = async () => {
    if (!url.trim()) {
      await customAlert('URLを入力してください');
      return;
    }
    const finalFolder = folder.trim() || '未分類';
    
    onSave({
      id: initialData?.id || `item_${Date.now()}_${Math.random()}`,
      url: url.trim(),
      title: title.trim() || '名称未設定',
      folderName: finalFolder,
      capturedDate: capturedDate.trim() || undefined,
      parsed: parseGoogleMapsUrl(url.trim())
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4"
    >
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
          <h2 className="text-sm font-bold text-white">{initialData ? '場所の編集' : '場所の登録'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[70vh] bg-slate-950 scrollbar-thin">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Google Maps URL
            </label>
            <input 
              type="text" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.google.com/maps/..."
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>
          
          <div>
            <div className="flex justify-between items-end mb-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                場所のタイトル
              </label>
              {isFetchingAddress && (
                <span className="text-[9px] text-cyan-500 animate-pulse font-bold tracking-wider">住所を自動取得中...</span>
              )}
            </div>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: お気に入りのカフェ"
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1 flex items-center justify-between">
              <span>撮影日 (任意)</span>
              <span className="text-[9px] text-cyan-600 font-normal normal-case">ストリートビュー画像の撮影年月など</span>
            </label>
            <input 
              type="text" 
              value={capturedDate}
              onChange={(e) => setCapturedDate(e.target.value)}
              placeholder="例: 2022年4月"
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              保存先フォルダ
            </label>
            <div className="flex gap-2">
              <select 
                onChange={(e) => setFolder(e.target.value)}
                value={folder}
                className="w-1/2 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="">▼ 入力から選択</option>
                {allFolders.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <input 
                type="text" 
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="新しいフォルダ名"
                className="w-1/2 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-between items-center shrink-0">
          {initialData ? (
            <button 
              onClick={async () => {
                if (await customConfirm('本当に削除しますか？')) onDelete(initialData.id);
              }}
              className="px-3 py-1.5 border border-red-900 text-red-500 hover:bg-red-500 hover:text-white rounded text-xs font-bold transition-colors"
            >
              削除
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button 
              onClick={onClose}
              className="px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-md text-xs font-bold transition-colors"
            >
              キャンセル
            </button>
            <button 
              onClick={handleSave}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-black rounded-md text-xs font-bold transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            >
              保存
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

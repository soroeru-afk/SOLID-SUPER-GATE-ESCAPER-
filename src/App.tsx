import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Settings, Folder, FolderOpen, Folders, File as FileIcon, X, Search, Plus, Minus, RotateCw, Trash2, Edit2, Upload, Download, Map as MapIcon, ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft, ChevronUp, ChevronDown, Menu, Check, Copy, PanelLeftClose, PanelRightClose, PanelLeftOpen, PanelRightOpen, PanelLeft, PanelRight, Maximize, Minimize, Palette, Eye, EyeOff, ExternalLink, LayoutList, GripVertical, ArrowUp, ArrowDown, Layers, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LinkManagerView, openInCenteredWindow, getDirectStreetViewUrl } from './components/LinkManagerView';

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
  theme: 'navy' | 'dark' | 'light' | 'mocha' | 'latte';
  language: 'jp' | 'en';
  folderIconColor?: string;
  sidebarOpacity?: number;
  sidebarFontSize?: number;
  listFontSize?: number;
}

interface TabData {
  id: string;
  location: LocationItem | null;
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
    navy: 'ネイビー',
    light: 'ライト',
    mocha: 'モカ',
    latte: 'ラテ',
    close: '閉じる',
    desc: '瞬時に場所を移動できる自分専用のどこでもドア',
    tmTitle: '💡 Tampermonkey連携機能:',
    tmDesc1: 'ブラウザ拡張等から直接場所を追加できます。',
    tmDesc2: 'ローカルストレージ sv_locations_sync を購読中。',
    captured: '撮影:',
    currLoc: 'LOCATION:',
    newTab: '新しいタブ',
    clearAllTabs: '全て閉じる',
    fullscreen: 'フルスクリーン',
    exitFullscreen: 'フルスクリーン解除',
    hideUI: 'ヘッダーを隠す',
    showUI: 'ヘッダーを表示',
    sidebarOpacity: 'サイドバー透明度',
    sidebarFontSize: 'サイドバー文字サイズ',
    listFontSize: 'リスト文字サイズ',
    select: '選択',
    selectDone: '完了',
    selectAll: '全選択',
    deselectAll: '全解除',
    openInTabs: '選択項目をタブ化して開く',
    viewModeViewer: 'ビューア',
    viewModeManager: 'リスト管理',
    allData: '[ ALL DATA ]',
    subDirectories: 'SUB-DIRECTORIES',
    bookmarksList: 'BOOKMARKS LIST',
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
    navy: 'Navy',
    light: 'Light',
    mocha: 'Mocha',
    latte: 'Latte',
    close: 'Close',
    desc: 'Your personal portal to travel anywhere instantly',
    tmTitle: '💡 Tampermonkey Integration:',
    tmDesc1: 'Add locations directly from browser extensions.',
    tmDesc2: 'Subscribing to local storage sv_locations_sync.',
    captured: 'Captured:',
    currLoc: 'LOCATION:',
    newTab: 'New Tab',
    clearAllTabs: 'CLEAR ALL',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit Fullscreen',
    hideUI: 'Hide UI',
    showUI: 'Show UI',
    sidebarOpacity: 'Sidebar Opacity',
    sidebarFontSize: 'Sidebar Font Size',
    listFontSize: 'List Font Size',
    select: 'SELECT',
    selectDone: 'DONE',
    selectAll: 'SELECT ALL',
    deselectAll: 'DESELECT ALL',
    openInTabs: 'Open Selected in Tabs',
    viewModeViewer: 'VIEWER',
    viewModeManager: 'MANAGER',
    allData: '[ ALL DATA ]',
    subDirectories: 'SUB-DIRECTORIES',
    bookmarksList: 'BOOKMARKS LIST',
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

interface ExtractedBookmarksResult {
  items: Omit<LocationItem, 'id' | 'parsed'>[];
  parentFolderOrder: string[];
  subFolderOrder: Record<string, string[]>;
}

function processBookmarksHtml(htmlString: string): ExtractedBookmarksResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const items: Omit<LocationItem, 'id' | 'parsed'>[] = [];
  const parentFolderOrder: string[] = [];
  const subFolderOrder: Record<string, string[]> = {};
  
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

      // フォルダ順序の抽出
      if (folderPath.length > 0) {
        const parentName = folderPath[0].trim();
        if (!parentFolderOrder.includes(parentName)) {
          parentFolderOrder.push(parentName);
        }
        if (folderPath.length > 1) {
          const subName = folderPath[1].trim();
          if (!subFolderOrder[parentName]) {
            subFolderOrder[parentName] = [];
          }
          if (!subFolderOrder[parentName].includes(subName)) {
            subFolderOrder[parentName].push(subName);
          }
        }
      }
    }
  });
  return { items, parentFolderOrder, subFolderOrder };
}

const DEFAULT_SETTINGS: AppSettings = {
  sidebarPosition: 'left',
  sidebarWidth: 320,
  theme: 'navy',
  language: 'jp',
  folderIconColor: '#06b6d4',
  sidebarOpacity: 1.0,
  sidebarFontSize: 12,
  listFontSize: 12,
};

// === Main App Component ===
export default function App() {
  const [locations, setLocations] = useState<LocationItem[]>(() => {
    try {
      const cache = localStorage.getItem('sv_locations_cache');
      if (cache) {
        const parsed = JSON.parse(cache);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [folderState, setFolderState] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [bulkTargetFolder, setBulkTargetFolder] = useState('');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [sortOrder, setSortOrder] = useState<'custom' | 'asc' | 'desc'>('custom');
  
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const lastWheelTime = useRef<number>(0);

  const [draggedTabIndex, setDraggedTabIndex] = useState<number | null>(null);
  const [dragOverTabIndex, setDragOverTabIndex] = useState<number | null>(null);

  const handleTabDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    setDraggedTabIndex(index);
  };

  const handleTabDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTabIndex !== index) {
      setDragOverTabIndex(index);
    }
  };

  const handleTabDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedTabIndex !== null && draggedTabIndex !== targetIndex) {
      setTabs(prev => {
        const next = [...prev];
        const [moved] = next.splice(draggedTabIndex, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
    }
    setDraggedTabIndex(null);
    setDragOverTabIndex(null);
  };

  const handleTabDragEnd = () => {
    setDraggedTabIndex(null);
    setDragOverTabIndex(null);
  };

  const currentTabIndex = tabs.findIndex(t => t.id === activeTabId);

  const selectTabByIndex = (targetIndex: number) => {
    if (tabs.length === 0) return;
    const clampedIndex = Math.max(0, Math.min(tabs.length - 1, targetIndex));
    setActiveTabId(tabs[clampedIndex].id);
  };

  const goToPrevTab = () => {
    if (tabs.length === 0) return;
    if (currentTabIndex > 0) {
      selectTabByIndex(currentTabIndex - 1);
    } else if (currentTabIndex === -1) {
      selectTabByIndex(0);
    }
  };

  const goToNextTab = () => {
    if (tabs.length === 0) return;
    if (currentTabIndex >= 0 && currentTabIndex < tabs.length - 1) {
      selectTabByIndex(currentTabIndex + 1);
    } else if (currentTabIndex === -1) {
      selectTabByIndex(0);
    }
  };

  const goToFirstTab = () => {
    if (tabs.length > 0) {
      selectTabByIndex(0);
      if (tabsContainerRef.current) {
        tabsContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      }
    }
  };

  const goToLastTab = () => {
    if (tabs.length > 0) {
      selectTabByIndex(tabs.length - 1);
      if (tabsContainerRef.current) {
        tabsContainerRef.current.scrollTo({ left: tabsContainerRef.current.scrollWidth, behavior: 'smooth' });
      }
    }
  };

  // アクティブタブが切り替わったときにタブバー内で表示領域にスクロール
  useEffect(() => {
    if (activeTabId && tabsContainerRef.current) {
      const el = tabRefs.current.get(activeTabId);
      const container = tabsContainerRef.current;
      if (el && container) {
        const idx = tabs.findIndex(t => t.id === activeTabId);
        if (idx === 0) {
          container.scrollTo({ left: 0, behavior: 'smooth' });
        } else if (idx === tabs.length - 1) {
          container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
        } else {
          const elLeft = el.offsetLeft;
          const elWidth = el.offsetWidth;
          const containerScrollLeft = container.scrollLeft;
          const containerWidth = container.clientWidth;

          if (elLeft < containerScrollLeft + 30) {
            container.scrollTo({ left: Math.max(0, elLeft - 50), behavior: 'smooth' });
          } else if (elLeft + elWidth > containerScrollLeft + containerWidth - 30) {
            container.scrollTo({ left: elLeft + elWidth - containerWidth + 50, behavior: 'smooth' });
          }
        }
      }
    }
  }, [activeTabId, tabs]);

  // タブ領域でのマウスホイール操作によるタブ切り替え
  // カオルさまのご指定通り: ホイール下回転 -> 左のタブへ / ホイール上回転 -> 右のタブへ
  useEffect(() => {
    const el = tabsContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      // ホイールの連続発火を防ぎ、1ノッチごとに1タブずつ確実に切り替え
      if (now - lastWheelTime.current < 130) {
        return;
      }

      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        if (Math.abs(e.deltaY) < 5) return;
        lastWheelTime.current = now;
        if (e.deltaY > 0) {
          // ホイールを下にした時に左へ動く（前のタブ）
          goToPrevTab();
        } else {
          // ホイールを上に回した時に右に動く（次のタブ）
          goToNextTab();
        }
      } else {
        if (Math.abs(e.deltaX) < 5) return;
        lastWheelTime.current = now;
        if (e.deltaX > 0) {
          goToNextTab();
        } else {
          goToPrevTab();
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [tabs, activeTabId, currentTabIndex]);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const currentItem = activeTab?.location || null;

  // === 閲覧履歴ナビゲーション（戻る・進む） ===
  const [navHistory, setNavHistory] = useState<string[]>([]);
  const [navHistoryIndex, setNavHistoryIndex] = useState<number>(-1);
  const isNavigatingHistoryRef = useRef(false);

  useEffect(() => {
    if (!currentItem) return;
    if (isNavigatingHistoryRef.current) {
      isNavigatingHistoryRef.current = false;
      return;
    }
    setNavHistory(prev => {
      const nextHistory = prev.slice(0, navHistoryIndex + 1);
      if (nextHistory[nextHistory.length - 1] === currentItem.id) {
        return prev;
      }
      const updated = [...nextHistory, currentItem.id];
      setNavHistoryIndex(updated.length - 1);
      return updated;
    });
  }, [currentItem?.id]);

  const handleNavBack = () => {
    if (navHistoryIndex > 0) {
      const prevLocId = navHistory[navHistoryIndex - 1];
      const targetItem = locations.find(l => l.id === prevLocId);
      if (targetItem) {
        isNavigatingHistoryRef.current = true;
        setNavHistoryIndex(navHistoryIndex - 1);
        handleItemClick(targetItem);
      }
    }
  };

  const handleNavForward = () => {
    if (navHistoryIndex < navHistory.length - 1) {
      const nextLocId = navHistory[navHistoryIndex + 1];
      const targetItem = locations.find(l => l.id === nextLocId);
      if (targetItem) {
        isNavigatingHistoryRef.current = true;
        setNavHistoryIndex(navHistoryIndex + 1);
        handleItemClick(targetItem);
      }
    }
  };

  useEffect(() => {
    if (activeTabId && !tabs.find(t => t.id === activeTabId)) {
      setActiveTabId(tabs.length > 0 ? tabs[tabs.length - 1].id : null);
    }
  }, [tabs, activeTabId]);

  const handleItemClick = (item: LocationItem) => {
    setMainViewMode('viewer');
    // タブが1つもない、またはアクティブタブIDがない場合は新規タブを作成して開く
    if (tabs.length === 0 || !activeTabId) {
      const newTabId = crypto.randomUUID();
      setTabs([{ id: newTabId, location: item }]);
      setActiveTabId(newTabId);
      return;
    }

    const currentActiveTab = tabs.find(t => t.id === activeTabId);

    // 現在選択中のアクティブタブが空（locationがnull）の場合、他で開かれていても現在のタブに割り当てる
    if (currentActiveTab && !currentActiveTab.location) {
      setTabs(tabs.map(t => t.id === activeTabId ? { ...t, location: item } : t));
      return;
    }

    // 現在のアクティブタブがすでに同じ場所を開いている場合は何もしない
    if (currentActiveTab && currentActiveTab.location?.id === item.id) {
      return;
    }

    // 現在のアクティブタブの場所を、選択した場所に切り替える（他タブにあっても独立して開ける）
    setTabs(tabs.map(t => t.id === activeTabId ? { ...t, location: item } : t));
  };

  // ストリートビューで開くボタン用（すでにタブで開いている場合はそのタブに切り替え、開いていない場合は新規タブで開く）
  const openOrFocusTab = (item: LocationItem) => {
    setMainViewMode('viewer');

    // 1. すでにいずれかのタブで同じ場所が開かれているかチェック
    const existingTab = tabs.find(t => t.location?.id === item.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    // 2. 現在のアクティブタブが空（locationがnull）の場合、現在のタブに割り当てる
    const currentActiveTab = tabs.find(t => t.id === activeTabId);
    if (currentActiveTab && !currentActiveTab.location) {
      setTabs(tabs.map(t => t.id === activeTabId ? { ...t, location: item } : t));
      return;
    }

    // 3. どのタブでも開かれていない場合は「新規タブを作成」してそこで開く
    const newTabId = crypto.randomUUID();
    setTabs(prev => [...prev, { id: newTabId, location: item }]);
    setActiveTabId(newTabId);
  };

  const duplicateTab = (e: React.MouseEvent, tab: TabData) => {
    e.stopPropagation();
    const newTabId = crypto.randomUUID();
    const newTab: TabData = {
      id: newTabId,
      location: tab.location ? { ...tab.location } : null,
    };
    const currentIndex = tabs.findIndex(t => t.id === tab.id);
    const newTabs = [...tabs];
    if (currentIndex !== -1) {
      newTabs.splice(currentIndex + 1, 0, newTab);
    } else {
      newTabs.push(newTab);
    }
    setTabs(newTabs);
    setActiveTabId(newTabId);
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setTabs(prev => prev.filter(t => t.id !== id));
  };

  const addNewTab = () => {
    const newTabId = crypto.randomUUID();
    setTabs([...tabs, { id: newTabId, location: null }]);
    setActiveTabId(newTabId);
  };
  
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LocationItem | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  // メイン画面の表示モード ('viewer': ストリートビュー, 'manager': リンクマネージャー/リスト編集)
  // データが存在する場合は初期状態でリスト管理モード (ALL DATA) を表示
  const [mainViewMode, setMainViewMode] = useState<'viewer' | 'manager'>(() => {
    try {
      const cache = localStorage.getItem('sv_locations_cache');
      if (cache) {
        const parsed = JSON.parse(cache);
        if (Array.isArray(parsed) && parsed.length > 0) return 'manager';
      }
    } catch {}
    return 'viewer';
  });
  const [managerFolder, setManagerFolder] = useState<string | null>(null);
  const [managerNavToken, setManagerNavToken] = useState<number>(() => Date.now());
  const [managerSearch, setManagerSearch] = useState('');
  const [draggedManagerId, setDraggedManagerId] = useState<string | null>(null);

  // リスト管理画面のフォルダナビゲーション（サイドバー連動）
  const navigateToManagerFolder = (folderName: string | null) => {
    setMainViewMode('manager');
    setManagerFolder(folderName);
    setManagerNavToken(Date.now());
  };

  // サイドバー親カテゴリーの並び替え状態 (localStorageで永続化)
  const [parentFolderOrder, setParentFolderOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('knav_parent_folder_order');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [draggedParentFolder, setDraggedParentFolder] = useState<string | null>(null);
  const [dragOverParentFolder, setDragOverParentFolder] = useState<string | null>(null);

  // 第2階層サブカテゴリーの並び替え状態 (localStorageで永続化)
  const [subFolderOrder, setSubFolderOrder] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('knav_sub_folder_order');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [draggedSubFolder, setDraggedSubFolder] = useState<{ parentName: string; subName: string } | null>(null);
  const [dragOverSubFolder, setDragOverSubFolder] = useState<{ parentName: string; subName: string } | null>(null);

  // サイドバー親カテゴリーのドロップ処理
  const handleParentFolderDrop = (targetParent: string) => {
    if (!draggedParentFolder || draggedParentFolder === targetParent) {
      setDraggedParentFolder(null);
      setDragOverParentFolder(null);
      return;
    }

    // 現在の親フォルダ順序リストを取得
    const currentOrder = hierarchicalFolders.map(p => p.name);
    const fromIndex = currentOrder.indexOf(draggedParentFolder);
    const toIndex = currentOrder.indexOf(targetParent);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedParentFolder(null);
      setDragOverParentFolder(null);
      return;
    }

    const newOrder = [...currentOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);

    setParentFolderOrder(newOrder);
    try {
      localStorage.setItem('knav_parent_folder_order', JSON.stringify(newOrder));
    } catch {}

    setDraggedParentFolder(null);
    setDragOverParentFolder(null);
  };

  // サブカテゴリーの順序更新関数
  const updateSubFolderOrder = (parentName: string, newOrder: string[]) => {
    setSubFolderOrder(prev => {
      const updated = {
        ...prev,
        [parentName]: newOrder,
      };
      try {
        localStorage.setItem('knav_sub_folder_order', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // サイドバー第2階層サブカテゴリーのドロップ処理
  const handleSubFolderDrop = (parentName: string, targetSubName: string) => {
    if (!draggedSubFolder || draggedSubFolder.parentName !== parentName || draggedSubFolder.subName === targetSubName) {
      setDraggedSubFolder(null);
      setDragOverSubFolder(null);
      return;
    }

    const parentGroup = hierarchicalFolders.find(p => p.name === parentName);
    if (!parentGroup) {
      setDraggedSubFolder(null);
      setDragOverSubFolder(null);
      return;
    }

    const currentOrder = parentGroup.subGroups.map(s => s.subName);
    const fromIndex = currentOrder.indexOf(draggedSubFolder.subName);
    const toIndex = currentOrder.indexOf(targetSubName);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedSubFolder(null);
      setDragOverSubFolder(null);
      return;
    }

    const newSubList = [...currentOrder];
    const [moved] = newSubList.splice(fromIndex, 1);
    newSubList.splice(toIndex, 0, moved);

    updateSubFolderOrder(parentName, newSubList);

    setDraggedSubFolder(null);
    setDragOverSubFolder(null);
  };

  // マネージャー内でのアイテム上下並び替え関数
  const moveItemOrder = (itemId: string, direction: 'up' | 'down') => {
    setSortOrder('custom');
    const currentIndex = locations.findIndex(loc => loc.id === itemId);
    if (currentIndex === -1) return;

    if (managerFolder) {
      // 特定フォルダ表示中の場合、そのフォルダ内での前後の要素と入れ替える
      const folderItems = locations.filter(loc => loc.folderName === managerFolder);
      const folderItemIndex = folderItems.findIndex(loc => loc.id === itemId);
      const targetFolderIndex = direction === 'up' ? folderItemIndex - 1 : folderItemIndex + 1;
      if (targetFolderIndex < 0 || targetFolderIndex >= folderItems.length) return;
      const targetItem = folderItems[targetFolderIndex];
      const targetGlobalIndex = locations.findIndex(loc => loc.id === targetItem.id);
      
      const newLocs = [...locations];
      const [removed] = newLocs.splice(currentIndex, 1);
      newLocs.splice(targetGlobalIndex, 0, removed);
      saveLocations(newLocs);
    } else {
      // 全件表示中の場合
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= locations.length) return;
      const newLocs = [...locations];
      const [removed] = newLocs.splice(currentIndex, 1);
      newLocs.splice(targetIndex, 0, removed);
      saveLocations(newLocs);
    }
  };

  // ドラッグ＆ドロップによる並べ替え
  const handleItemDrop = (targetId: string) => {
    if (!draggedManagerId || draggedManagerId === targetId) {
      setDraggedManagerId(null);
      return;
    }
    setSortOrder('custom');
    const fromIndex = locations.findIndex(l => l.id === draggedManagerId);
    const toIndex = locations.findIndex(l => l.id === targetId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedManagerId(null);
      return;
    }
    const newLocs = [...locations];
    const [moved] = newLocs.splice(fromIndex, 1);
    newLocs.splice(toIndex, 0, moved);
    saveLocations(newLocs);
    setDraggedManagerId(null);
  };

  // 境界線グリップハンドルのドラッグによるサイドバー幅変更処理（左右どちらでも完璧にリアルタイム追従）
  const handleBoundaryPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = settings.sidebarWidth || 320;
    let hasMoved = false;
    setIsResizingSidebar(true);

    const onPointerMove = (ev: PointerEvent) => {
      const deltaX = ev.clientX - startX;
      if (Math.abs(deltaX) > 2) {
        hasMoved = true;
      }
      let newW: number;
      if (settings.sidebarPosition === 'right') {
        newW = Math.round(startWidth - deltaX);
      } else {
        newW = Math.round(startWidth + deltaX);
      }
      const maxAvailable = Math.max(300, window.innerWidth - 80);
      newW = Math.max(180, Math.min(Math.min(650, maxAvailable), newW));
      saveSettings({ ...settings, sidebarWidth: newW });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      setIsResizingSidebar(false);
      // ドラッグせずにクリックだけした場合は開閉をトグル
      if (!hasMoved) {
        setIsSidebarOpen(prev => !prev);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const t = (key: keyof typeof translations.jp) => translations[settings.language][key];

  // サイドバー文字サイズ計算 (数値px: 10px〜20px、デフォルト12px)
  const getSidebarFontSizePx = (): number => {
    const raw = settings.sidebarFontSize;
    if (typeof raw === 'number' && !isNaN(raw)) {
      return Math.max(9, Math.min(20, raw));
    }
    if ((raw as any) === 'sm') return 11;
    if ((raw as any) === 'lg') return 14;
    return 12;
  };

  // リスト文字サイズ計算 (数値px: 10px〜22px、デフォルト12px)
  const getListFontSizePx = (): number => {
    const raw = settings.listFontSize;
    if (typeof raw === 'number' && !isNaN(raw)) {
      return Math.max(9, Math.min(24, raw));
    }
    return 12;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isImmersive) {
        setIsImmersive(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isImmersive]);

  const toggleFullscreen = () => {
    const docEl = document.documentElement as any;
    if (!document.fullscreenElement && !docEl.webkitFullscreenElement) {
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(console.error);
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(console.error);
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  };

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

  const isLoaded = useRef(false);

  // Initialize
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const targetId = urlParams.get('id') || urlParams.get('loc');
      const targetUrlParam = urlParams.get('url');
      const modeParam = urlParams.get('mode') || urlParams.get('view');

      let parsedLocations: LocationItem[] = [];
      const cache = localStorage.getItem('sv_locations_cache');
      if (cache) {
        const parsed = JSON.parse(cache);
        if (Array.isArray(parsed)) {
          parsedLocations = parsed;
          setLocations(parsed);
        }
      }

      const savedSettings = localStorage.getItem('sv_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.theme === 'dark' && !localStorage.getItem('sv_theme_migrated')) {
          parsed.theme = 'navy';
          localStorage.setItem('sv_theme_migrated', 'true');
        }
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }

      const savedTabs = localStorage.getItem('sv_tabs');
      const savedActiveTab = localStorage.getItem('sv_active_tab_id');
      
      let initialTabsLoaded = false;
      if (savedTabs) {
        const parsedTabs = JSON.parse(savedTabs);
        if (Array.isArray(parsedTabs) && parsedTabs.length > 0) {
          setTabs(parsedTabs);
          initialTabsLoaded = true;
        }
      }
      
      if (!initialTabsLoaded) {
        const initialTabId = crypto.randomUUID();
        setTabs([{ id: initialTabId, location: null }]);
        setActiveTabId(initialTabId);
      } else if (savedActiveTab) {
        setActiveTabId(savedActiveTab);
      }

      // URLパラメータで特定の場所が指定されている場合は直接ビューアで表示
      if (targetId || targetUrlParam || modeParam === 'viewer') {
        setMainViewMode('viewer');
        if (targetId) {
          const match = parsedLocations.find(l => l.id === targetId);
          if (match) {
            handleItemClick(match);
          }
        } else if (targetUrlParam) {
          const parsedGmaps = parseGoogleMapsUrl(targetUrlParam);
          const tempItem: LocationItem = {
            id: `direct_${Date.now()}`,
            title: 'Street View Location',
            folderName: 'Direct',
            url: targetUrlParam,
            parsed: parsedGmaps
          };
          handleItemClick(tempItem);
        }
      } else if (parsedLocations.length > 0) {
        setMainViewMode('manager');
        setManagerFolder(null);
      }
    } catch (e) {} finally {
      isLoaded.current = true;
    }
  }, []);

  useEffect(() => {
    if (!isLoaded.current) return;
    localStorage.setItem('sv_tabs', JSON.stringify(tabs));
    if (activeTabId) {
      localStorage.setItem('sv_active_tab_id', activeTabId);
    } else {
      localStorage.removeItem('sv_active_tab_id');
    }
  }, [tabs, activeTabId]);

  // Dynamic theme-color meta tag sync (Solid series standard: synchronized to Sidebar Header background)
  useEffect(() => {
    const themeHeaderColors: Record<string, string> = {
      navy: '#000000',
      dark: '#14171d',
      light: '#ffffff',
      mocha: '#59483A',
      latte: '#9E8668',
    };
    const currentColor = themeHeaderColors[settings.theme || 'navy'] || '#000000';
    let metaTag = document.querySelector('meta[name="theme-color"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', currentColor);
  }, [settings.theme]);

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
    let filtered = [...locations]; // Clone array before sorting
    const lowerQuery = searchQuery.toLowerCase();
    if (lowerQuery) {
      filtered = filtered.filter(i => 
        i.title.toLowerCase().includes(lowerQuery) || 
        i.folderName.toLowerCase().includes(lowerQuery)
      );
    }
    
    // ソート処理:
    // 'custom'（デフォルト）の場合は locations 配列の並び順（リスト管理画面での並び順）をそのまま保持！
    // 'asc' または 'desc' の場合のみタイトルで名前順ソート
    if (sortOrder === 'asc') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortOrder === 'desc') {
      filtered.sort((a, b) => b.title.localeCompare(a.title));
    }

    const groups: Record<string, LocationItem[]> = {};
    filtered.forEach(item => {
      const f = item.folderName || 'General';
      if (!groups[f]) groups[f] = [];
      groups[f].push(item);
    });
    return groups;
  }, [locations, searchQuery, sortOrder]);

  // 全フォルダ（無検索・全量）の階層構造定義
  const fullHierarchicalFolders = useMemo(() => {
    const parents: Record<string, {
      name: string;
      subGroups: { subName: string; fullName: string; count: number }[];
      hasDirect: boolean;
    }> = {};

    locations.forEach(item => {
      const folderName = item.folderName || 'General';
      const parts = folderName.split(' / ');
      const parentName = parts[0].trim();

      if (!parents[parentName]) {
        parents[parentName] = {
          name: parentName,
          subGroups: [],
          hasDirect: false
        };
      }

      if (parts.length > 1) {
        const subName = parts.slice(1).join(' / ').trim();
        let sub = parents[parentName].subGroups.find(s => s.fullName === folderName);
        if (!sub) {
          sub = { subName, fullName: folderName, count: 0 };
          parents[parentName].subGroups.push(sub);
        }
        sub.count++;
      } else {
        parents[parentName].hasDirect = true;
      }
    });

    const sortedParents = Object.values(parents).sort((a, b) => {
      const idxA = parentFolderOrder.indexOf(a.name);
      const idxB = parentFolderOrder.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    return sortedParents.map(p => {
      const customSubOrder = subFolderOrder[p.name];
      if (customSubOrder && customSubOrder.length > 0) {
        p.subGroups.sort((a, b) => {
          const idxA = customSubOrder.indexOf(a.subName);
          const idxB = customSubOrder.indexOf(b.subName);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.subName.localeCompare(b.subName);
        });
      } else {
        p.subGroups.sort((a, b) => a.subName.localeCompare(b.subName));
      }
      return p;
    });
  }, [locations, parentFolderOrder, subFolderOrder]);

  // サイドバーやリストマネージャーの並び順（親カテゴリ順・サブカテゴリ順）と完全に一致した全フォルダリスト
  const allFolders = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    fullHierarchicalFolders.forEach(parent => {
      if (parent.hasDirect && !seen.has(parent.name)) {
        list.push(parent.name);
        seen.add(parent.name);
      }
      parent.subGroups.forEach(sub => {
        if (!seen.has(sub.fullName)) {
          list.push(sub.fullName);
          seen.add(sub.fullName);
        }
      });
      if (!seen.has(parent.name) && locations.some(l => l.folderName === parent.name)) {
        list.push(parent.name);
        seen.add(parent.name);
      }
    });

    // 万が一漏れがある場合のフォールバック
    locations.forEach(item => {
      const f = item.folderName || 'General';
      if (!seen.has(f)) {
        list.push(f);
        seen.add(f);
      }
    });

    return list;
  }, [fullHierarchicalFolders, locations]);

  // 階層化したフォルダ構造の定義
  const hierarchicalFolders = useMemo(() => {
    const parents: Record<string, {
      name: string;
      subGroups: { subName: string; fullName: string; items: LocationItem[] }[];
      directItems: LocationItem[];
      totalCount: number;
    }> = {};

    Object.entries(folderGroups).forEach(([folderName, items]) => {
      const locItems = items as LocationItem[];
      const parts = folderName.split(' / ');
      const parentName = parts[0].trim();
      
      if (!parents[parentName]) {
        parents[parentName] = {
          name: parentName,
          subGroups: [],
          directItems: [],
          totalCount: 0
        };
      }
      
      parents[parentName].totalCount += locItems.length;

      if (parts.length > 1) {
        const subName = parts.slice(1).join(' / ').trim();
        parents[parentName].subGroups.push({
          subName: subName,
          fullName: folderName,
          items: locItems
        });
      } else {
        parents[parentName].directItems.push(...locItems);
      }
    });

    // ソート（ドラッグ＆ドロップによるカスタム順序があればそれを優先、なければ五十音/アルファベット順）
    const sortedParents = Object.values(parents).sort((a, b) => {
      const idxA = parentFolderOrder.indexOf(a.name);
      const idxB = parentFolderOrder.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    return sortedParents.map(p => {
      const customSubOrder = subFolderOrder[p.name];
      if (customSubOrder && customSubOrder.length > 0) {
        p.subGroups.sort((a, b) => {
          const idxA = customSubOrder.indexOf(a.subName);
          const idxB = customSubOrder.indexOf(b.subName);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.subName.localeCompare(b.subName);
        });
      } else {
        p.subGroups.sort((a, b) => a.subName.localeCompare(b.subName));
      }
      return p;
    });
  }, [folderGroups, parentFolderOrder, subFolderOrder]);

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
      let importedTabs: TabData[] | null = null;
      let importedActiveTabId: string | null = null;
      let importedParentOrder: string[] | null = null;
      let importedSubOrder: Record<string, string[]> | null = null;
      
      if (file.name.endsWith('.json')) {
        try {
          const parsedData = JSON.parse(text);
          if (Array.isArray(parsedData)) {
            // 従来の配列形式JSON
            newItems = parsedData;
          } else if (parsedData && typeof parsedData === 'object') {
            // タブ情報・フォルダ並び順付きのバックアップ形式
            if (Array.isArray(parsedData.locations)) {
              newItems = parsedData.locations;
            }
            if (Array.isArray(parsedData.parentFolderOrder)) {
              importedParentOrder = parsedData.parentFolderOrder;
            }
            if (parsedData.subFolderOrder && typeof parsedData.subFolderOrder === 'object') {
              importedSubOrder = parsedData.subFolderOrder;
            }
            if (Array.isArray(parsedData.tabs)) {
              importedTabs = parsedData.tabs;
            }
            if (typeof parsedData.activeTabId === 'string' || parsedData.activeTabId === null) {
              importedActiveTabId = parsedData.activeTabId;
            }
          }
        } catch (err) {
          await customAlert('JSONパースエラー: ファイル形式を確認してください。');
          return;
        }
      } else {
        const extracted = processBookmarksHtml(text);
        newItems = extracted.items.map(item => ({
          ...item,
          id: `item_${Date.now()}_${Math.random()}`,
          parsed: parseGoogleMapsUrl(item.url)
        }));
        importedParentOrder = extracted.parentFolderOrder;
        importedSubOrder = extracted.subFolderOrder;
      }

      if (newItems.length === 0 && (!importedTabs || importedTabs.length === 0)) {
        await customAlert('Google マップのURLを含むブックマークか、有効なJSONが見つかりませんでした。');
        return;
      }

      // 既存データがある場合は「完全置換（推奨）」か「追加マージ」かを確認
      let shouldReplace = locations.length === 0;
      if (locations.length > 0) {
        shouldReplace = await customConfirm(
          `既存のデータ（${locations.length}件）をこのファイルで完全に置き換えて同期しますか？\n\n【OK】: 完全に置き換えて同期（フォルダ名の変更・削除・並び順が100%反映されます）\n【キャンセル】: 既存のデータに追加してマージ`
        );
      }

      if (shouldReplace) {
        // === 完全置き換えモード ===
        const formattedItems = newItems.map(item => ({
          ...item,
          id: item.id || `item_${Date.now()}_${Math.random()}`,
          parsed: item.parsed || parseGoogleMapsUrl(item.url)
        }));

        setLocations(formattedItems);

        // フォルダ並び順の復元・更新
        if (importedParentOrder && importedParentOrder.length > 0) {
          setParentFolderOrder(importedParentOrder);
          try {
            localStorage.setItem('knav_parent_folder_order', JSON.stringify(importedParentOrder));
          } catch {}
        } else {
          // アイテムから抽出
          const extractedParents: string[] = [];
          formattedItems.forEach(it => {
            const pName = (it.folderName || '未分類').split(' / ')[0].trim();
            if (!extractedParents.includes(pName)) extractedParents.push(pName);
          });
          setParentFolderOrder(extractedParents);
          try {
            localStorage.setItem('knav_parent_folder_order', JSON.stringify(extractedParents));
          } catch {}
        }

        if (importedSubOrder && Object.keys(importedSubOrder).length > 0) {
          setSubFolderOrder(importedSubOrder);
          try {
            localStorage.setItem('knav_sub_folder_order', JSON.stringify(importedSubOrder));
          } catch {}
        }

        // タブ情報の復元
        if (importedTabs && importedTabs.length > 0) {
          const restoredTabs: TabData[] = importedTabs.map(t => {
            let loc = t.location;
            if (loc) {
              const matched = formattedItems.find(l => l.url === loc!.url || l.id === loc!.id);
              if (matched) loc = matched;
            }
            return {
              id: t.id || crypto.randomUUID(),
              location: loc
            };
          });
          setTabs(restoredTabs);
          if (importedActiveTabId && restoredTabs.some(t => t.id === importedActiveTabId)) {
            setActiveTabId(importedActiveTabId);
          } else if (restoredTabs.length > 0) {
            setActiveTabId(restoredTabs[0].id);
          }
        }

        const tabMsg = (importedTabs && importedTabs.length > 0) ? `\n開いていたタブ: ${importedTabs.length}件を復元しました` : '';
        await customAlert(`同期完了！\n全 ${formattedItems.length} 件のデータとフォルダ並び順を復元しました${tabMsg}`);
      } else {
        // === 追加・マージモード ===
        setLocations(prev => {
          const added: LocationItem[] = [];
          let updatedCount = 0;
          const newLocations = [...prev];

          newItems.forEach(item => {
            const parsedItem = {
              ...item,
              id: item.id || `item_${Date.now()}_${Math.random()}`,
              parsed: item.parsed || parseGoogleMapsUrl(item.url)
            };

            const existingIndex = newLocations.findIndex(i => i.url === item.url);
            if (existingIndex !== -1) {
              newLocations[existingIndex] = { ...newLocations[existingIndex], ...parsedItem, id: newLocations[existingIndex].id };
              updatedCount++;
            } else {
              added.push(parsedItem);
              newLocations.push(parsedItem);
            }
          });

          // フォルダ並び順のマージ
          if (importedParentOrder && importedParentOrder.length > 0) {
            setParentFolderOrder(prevOrder => {
              const merged = [...prevOrder];
              importedParentOrder!.forEach(p => {
                if (!merged.includes(p)) merged.push(p);
              });
              try {
                localStorage.setItem('knav_parent_folder_order', JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }

          if (importedSubOrder) {
            setSubFolderOrder(prevSub => {
              const merged = { ...prevSub };
              Object.entries(importedSubOrder!).forEach(([pName, subs]) => {
                if (!merged[pName]) {
                  merged[pName] = subs;
                } else {
                  const existingSubs = [...merged[pName]];
                  subs.forEach(s => {
                    if (!existingSubs.includes(s)) existingSubs.push(s);
                  });
                  merged[pName] = existingSubs;
                }
              });
              try {
                localStorage.setItem('knav_sub_folder_order', JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }

          // タブ情報の復元
          if (importedTabs && importedTabs.length > 0) {
            const restoredTabs: TabData[] = importedTabs.map(t => {
              let loc = t.location;
              if (loc) {
                const matched = newLocations.find(l => l.url === loc!.url || l.id === loc!.id);
                if (matched) loc = matched;
              }
              return {
                id: t.id || crypto.randomUUID(),
                location: loc
              };
            });
            setTabs(restoredTabs);
            if (importedActiveTabId && restoredTabs.some(t => t.id === importedActiveTabId)) {
              setActiveTabId(importedActiveTabId);
            } else if (restoredTabs.length > 0) {
              setActiveTabId(restoredTabs[0].id);
            }
          }

          const tabMsg = (importedTabs && importedTabs.length > 0) ? `\n開いていたタブ: ${importedTabs.length}件を復元しました` : '';
          customAlert(`読み込み完了！\n新規追加: ${added.length}件 / 更新: ${updatedCount}件${tabMsg}`);
          return newLocations;
        });
      }

      navigateToManagerFolder(null);
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const exportDataJson = async () => {
    if (locations.length === 0 && tabs.length === 0) {
      await customAlert('エクスポートするデータがありません。');
      return;
    }

    // ブックマーク一覧、開いているタブ情報、親フォルダ・サブフォルダの並び順を含めてエクスポート
    const exportPayload = {
      version: 3,
      type: 'streetview_backup',
      exportedAt: new Date().toISOString(),
      locations,
      parentFolderOrder,
      subFolderOrder,
      tabs,
      activeTabId
    };

    const dataStr = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // 日付と時間をファイル名に含める
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    
    a.download = `streetview_locations_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAllData = async () => {
    if (await customConfirm('すべての場所データ、フォルダ、および並び順設定を完全に削除します。本当によろしいですか？')) {
      setLocations([]);
      setTabs([]);
      setActiveTabId(null);
      setSelectedIds(new Set());
      setParentFolderOrder([]);
      setSubFolderOrder({});
      localStorage.removeItem('sv_locations_cache');
      localStorage.removeItem('sv_locations_sync');
      localStorage.removeItem('sv_tabs');
      localStorage.removeItem('sv_active_tab_id');
      localStorage.removeItem('knav_parent_folder_order');
      localStorage.removeItem('knav_sub_folder_order');
    }
  };

  const bulkDelete = async () => {
    if (await customConfirm(`選択した ${selectedIds.size} 件の場所を削除しますか？`)) {
      setLocations(prev => prev.filter(i => !selectedIds.has(i.id)));
      setTabs(prev => prev.filter(t => !t.location || !selectedIds.has(t.location.id)));
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

  const openSelectedInTabs = () => {
    if (selectedIds.size === 0) return;
    const selectedItems = locations.filter(loc => selectedIds.has(loc.id));
    if (selectedItems.length === 0) return;

    const newTabsToAdd: TabData[] = selectedItems.map(item => ({
      id: crypto.randomUUID(),
      location: item,
    }));

    let updatedTabs: TabData[];
    if (tabs.length === 1 && !tabs[0].location) {
      updatedTabs = newTabsToAdd;
    } else {
      updatedTabs = [...tabs, ...newTabsToAdd];
    }

    setTabs(updatedTabs);
    setActiveTabId(newTabsToAdd[0].id);
    setSelectedIds(new Set());
    setIsSelectMode(false);
  };

  const editParentFolder = async (parentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newName = await customPrompt('新しい親フォルダ名を入力してください', parentName);
    if (newName && newName.trim() && newName.trim() !== parentName) {
      const trimmed = newName.trim();
      setLocations(prev => prev.map(item => {
        if (item.folderName === parentName) {
          return { ...item, folderName: trimmed };
        }
        if (item.folderName.startsWith(parentName + ' / ')) {
          return { ...item, folderName: item.folderName.replace(parentName + ' / ', trimmed + ' / ') };
        }
        return item;
      }));
      setFolderState(prev => {
        const next = { ...prev };
        if (next[parentName] !== undefined) {
          next[trimmed] = next[parentName];
          delete next[parentName];
        }
        Object.keys(next).forEach(key => {
          if (key.startsWith(parentName + ' / ')) {
            const newKey = key.replace(parentName + ' / ', trimmed + ' / ');
            next[newKey] = next[key];
            delete next[key];
          }
        });
        return next;
      });
    }
  };

  const deleteParentFolder = async (parentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (await customConfirm(`親フォルダ「${parentName}」に含まれるすべての子フォルダと場所を削除しますか？`)) {
      const isTarget = (folder: string) => folder === parentName || folder.startsWith(parentName + ' / ');
      setLocations(prev => prev.filter(item => !isTarget(item.folderName)));
      setTabs(prev => prev.filter(t => !t.location || !isTarget(t.location.folderName)));
      setSelectedIds(prev => {
        const next = new Set(prev);
        locations.filter(i => isTarget(i.folderName)).forEach(i => next.delete(i.id));
        return next;
      });
    }
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
      setTabs(prev => prev.filter(t => t.location?.folderName !== folderName));
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
    <div className={`flex bg-slate-950 text-slate-300 font-sans h-screen overflow-hidden select-none theme-${settings.theme || 'navy'}`}>
      
      {/* リサイズ中のiframeマウスイベント横取り防止用透明オーバーレイ */}
      {isResizingSidebar && (
        <div className="fixed inset-0 z-[999] cursor-col-resize select-none touch-none" />
      )}
      
      {/* Search overlay & basic context layout */}
      <div 
        className="flex h-full w-full relative" 
        style={{ flexDirection: settings.sidebarPosition === 'right' ? 'row-reverse' : 'row' }}
      >
        
        {/* === Sidebar === */}
        <div 
          className="flex flex-col border-slate-800 sidebar-container shrink-0 h-full z-40"
          style={{ 
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: isSidebarOpen ? `${settings.sidebarWidth}px` : '0px', 
            left: settings.sidebarPosition === 'left' ? 0 : 'auto',
            right: settings.sidebarPosition === 'right' ? 0 : 'auto',
            borderRightWidth: isSidebarOpen && settings.sidebarPosition === 'left' ? '1px' : '0',
            borderLeftWidth: isSidebarOpen && settings.sidebarPosition === 'right' ? '1px' : '0',
            pointerEvents: isSidebarOpen ? 'auto' : 'none',
            overflow: 'hidden'
          }}
        >
          <div 
            style={{ width: `${settings.sidebarWidth}px` }} 
            className="flex flex-col h-full shrink-0 relative overflow-hidden"
          >
            {/* Header Area (透明度を適用せず、常に不透明なソリッドヘッダー) */}
            <div className="h-24 px-4 pb-3 pt-4 border-b border-slate-800 bg-header-bg shrink-0 flex items-end justify-between gap-2 z-20 relative">
              <div className="flex flex-col">
                <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 tracking-tighter uppercase leading-tight">
                  SOLID SUPER<br/>GATE ESCAPER
                </h1>
                <span className="text-[10px] text-cyan-500 font-bold tracking-widest mt-1.5 leading-none">{t('viewer')}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 mb-[1px]">
                {/* UI表示・非表示トグル（目のアイコン＋UIテキスト） */}
                <button
                  onClick={() => setIsImmersive(!isImmersive)}
                  className={`h-[20px] px-1.5 flex items-center gap-1 rounded-sm border transition-colors cursor-pointer text-[9px] font-bold font-mono tracking-wider ${
                    isImmersive 
                      ? 'border-cyan-500 bg-cyan-950/90 text-cyan-400 font-black' 
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-500'
                  }`}
                  title={isImmersive ? (settings.language === 'jp' ? "ヘッダーUIを表示" : "Show Header UI") : (settings.language === 'jp' ? "ヘッダーUIを非表示 (HIDE UI)" : "Hide Header UI")}
                >
                  {isImmersive ? <EyeOff size={11} className="shrink-0" /> : <Eye size={11} className="shrink-0" />}
                  <span>UI</span>
                </button>

                {/* 言語切替トグル */}
                <div className="h-[20px] flex items-center border border-slate-700 rounded-sm overflow-hidden text-[9px] font-bold lang-toggle-container">
                  <button 
                    onClick={() => saveSettings({ ...settings, language: 'en' })}
                    className={`h-full px-1.5 flex items-center transition-colors ${settings.language === 'en' ? 'bg-slate-400 text-slate-900' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                  >
                    EN
                  </button>
                  <button 
                    onClick={() => saveSettings({ ...settings, language: 'jp' })}
                    className={`h-full px-1.5 flex items-center transition-colors ${settings.language === 'jp' ? 'bg-slate-400 text-slate-900' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                  >
                    JP
                  </button>
                </div>
              </div>
            </div>

            {/* 下部リストエリア（ヘッダー下のみに透明度レイヤーを適用） */}
            <div className="flex flex-col flex-1 min-h-0 relative z-10 bg-transparent">
              {/* リストエリアの背景レイヤー（リスト管理モードでは自動で1.0、ビューアーモードでは設定した透明度） */}
              <div 
                className="absolute inset-0 bg-slate-950 backdrop-blur-md -z-10 pointer-events-none transition-opacity duration-150"
                style={{ 
                  opacity: mainViewMode === 'manager' ? 1 : (settings.sidebarOpacity ?? 1) 
                }}
              />

              <div className="p-4 border-b border-slate-800/80 shrink-0 flex flex-col gap-3">
              <input type="file" ref={fileInputRef} accept=".html,.json" className="hidden" onChange={handleFileUpload} />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 p-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-md text-xs font-bold text-white transition-colors uppercase tracking-wider shadow-sm cursor-pointer"
              >
                <Download size={14} /> {t('loadBookmark')}
              </button>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search size={14} />
                </span>
                <input 
                  type="text" 
                  placeholder={t('searchLoc')} 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900/30 hover:bg-slate-900/50 focus:bg-slate-900/60 border border-slate-700/60 rounded-md text-xs text-slate-100 placeholder-slate-400 focus:border-cyan-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

          {/* === Toolbar (ファイル件数 ＆ 戻る・進むナビゲーション ＆ アクション) === */}
          <div className="flex flex-col gap-1.5 px-3 py-1.5 border-b border-slate-800/50 shrink-0 font-mono text-[10px] text-slate-400">
            {/* 上段: ファイル件数 ＆ 戻る・進むナビゲーション */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-widest text-slate-300">
                  {locations.length} FILES
                </span>
              </div>
              
              {/* ◀ 戻る / 進む ▶ ボタン (高コントラストで透明時・全テーマで高い視認性を確保) */}
              <div className="flex items-center h-[20px] border border-slate-600/80 bg-slate-900/85 backdrop-blur-xs rounded-sm overflow-hidden text-[9px] font-bold">
                <button
                  onClick={handleNavBack}
                  disabled={navHistoryIndex <= 0}
                  className="h-full px-2 flex items-center gap-1 hover:bg-slate-800 text-slate-100 disabled:text-slate-400/80 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed border-r border-slate-700"
                  title={settings.language === 'jp' ? "前の場所に戻る (Back)" : "Go Back"}
                >
                  <span className="text-[8px]">◀</span>
                  <span>{settings.language === 'jp' ? '戻る' : 'BACK'}</span>
                </button>
                <button
                  onClick={handleNavForward}
                  disabled={navHistoryIndex >= navHistory.length - 1}
                  className="h-full px-2 flex items-center gap-1 hover:bg-slate-800 text-slate-100 disabled:text-slate-400/80 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title={settings.language === 'jp' ? "次の場所に進む (Forward)" : "Go Forward"}
                >
                  <span>{settings.language === 'jp' ? '進む' : 'FWD'}</span>
                  <span className="text-[8px]">▶</span>
                </button>
              </div>
            </div>

            {/* 下段: 並び順ソート切り替え ＆ 選択 ＆ 展開・縮小・リフレッシュ */}
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setSortOrder(prev => {
                  if (prev === 'custom') return 'asc';
                  if (prev === 'asc') return 'desc';
                  return 'custom';
                })} 
                className={`flex items-center gap-1 hover:text-slate-200 transition-colors whitespace-nowrap font-bold cursor-pointer ${sortOrder === 'custom' ? 'text-cyan-400' : 'text-slate-300'}`}
                title={
                  sortOrder === 'custom'
                    ? 'リスト管理の並び順で表示中 (クリックで名前順昇順)'
                    : sortOrder === 'asc'
                    ? '名前順 (昇順) で表示中 (クリックで名前順降順)'
                    : '名前順 (降順) で表示中 (クリックでリスト管理の並び順に戻す)'
                }
              >
                {sortOrder === 'custom' ? '並び順 (同期中)' : sortOrder === 'asc' ? '名前順 ▼' : '名前順 ▲'}
              </button>

              <div className="flex items-center gap-1.5 shrink-0">
                {isSelectMode && locations.length > 0 && (
                  <button
                    onClick={() => {
                      if (selectedIds.size === locations.length) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(new Set(locations.map(l => l.id)));
                      }
                    }}
                    className="hover:text-slate-200 transition-colors text-[9px] font-bold text-slate-400 hover:underline uppercase whitespace-nowrap cursor-pointer px-1"
                    title={selectedIds.size === locations.length ? t('deselectAll') : t('selectAll')}
                  >
                    {selectedIds.size === locations.length ? t('deselectAll') : t('selectAll')}
                  </button>
                )}
                {isSelectMode && selectedIds.size > 0 && (
                  <button 
                    onClick={openSelectedInTabs}
                    className="flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 text-black text-[9px] font-bold px-2 py-0.5 rounded-full transition-colors uppercase tracking-wider shrink-0 cursor-pointer shadow-xs"
                    title="選択した項目をすべてタブで開く"
                  >
                    <FolderOpen size={10} />
                    <span>{settings.language === 'jp' ? `タブ化 (${selectedIds.size})` : `TABS (${selectedIds.size})`}</span>
                  </button>
                )}
                <button 
                  onClick={() => {
                    setIsSelectMode(!isSelectMode);
                    if (isSelectMode) setSelectedIds(new Set()); // モード切替時に選択リセット
                  }} 
                  className={`transition-colors whitespace-nowrap px-2.5 py-0.5 rounded-full border font-bold tracking-wider uppercase text-[10px] cursor-pointer ${
                    isSelectMode 
                      ? 'bg-cyan-600 border-cyan-500 text-black shadow-xs font-black' 
                      : 'bg-slate-800/40 hover:bg-slate-800/80 hover:text-white text-slate-300 border-slate-700/60'
                  }`}
                >
                  {isSelectMode ? t('selectDone') : t('select')}
                </button>
                
                <div className="flex items-center gap-1.5 ml-1">
                  <button 
                    onClick={() => setFolderState(allFolders.reduce((acc, k) => ({...acc, [k]: true}), {}))} 
                    className="hover:text-slate-200 text-slate-400 transition-colors cursor-pointer p-0.5" 
                    title="すべて展開 (Expand All)"
                  >
                    <Plus size={13} />
                  </button>
                  <button 
                    onClick={() => setFolderState({})} 
                    className="hover:text-slate-200 text-slate-400 transition-colors cursor-pointer p-0.5" 
                    title="すべて折りたたむ (Collapse All)"
                  >
                    <Minus size={13} />
                  </button>
                  <button 
                    onClick={() => window.location.reload()} 
                    className="hover:text-slate-200 text-slate-400 transition-colors cursor-pointer p-0.5" 
                    title="再読み込み (Refresh)"
                  >
                    <RotateCw size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* List Area */}
          <div className="flex-1 overflow-y-auto p-2 font-mono text-sm scrollbar-thin">
            {/* 最上部: K-Navigator風 [ ALL DATA ] カード */}
            <div className="mb-2">
              <button
                onClick={() => {
                  navigateToManagerFolder(null);
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-sm border transition-all cursor-pointer group ${
                  mainViewMode === 'manager' && !managerFolder
                    ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300 font-black shadow-xs shadow-cyan-500/10'
                    : 'border-slate-700/60 bg-transparent hover:bg-slate-800/60 hover:border-slate-500/80 text-slate-200 hover:text-white'
                }`}
                title="リスト管理（全件表示）を開く"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Folders size={14} className={`${mainViewMode === 'manager' && !managerFolder ? 'text-cyan-400' : 'text-slate-400 group-hover:text-cyan-400'} transition-colors shrink-0 ml-0.5`} />
                  <span className="font-bold uppercase tracking-wider text-xs truncate">
                    [ ALL DATA ]
                  </span>
                </div>
                <span className={`text-[9px] border font-bold px-1.5 py-0.5 rounded-sm shrink-0 mr-1 ${
                  mainViewMode === 'manager' && !managerFolder
                    ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-300'
                }`}>
                  {locations.length}
                </span>
              </button>
            </div>

            {locations.length === 0 ? (
              <div className="text-center p-8 text-xs text-slate-500 leading-relaxed whitespace-pre-line">
                {t('emptyLoc1')}<br/>{t('emptyLoc2')}
              </div>
            ) : Object.keys(folderGroups).length === 0 ? (
              <div className="text-center p-8 text-xs text-slate-500">
                {t('noMatch')}
              </div>
            ) : (
              (() => {
                const fs = getSidebarFontSizePx();
                return hierarchicalFolders.map(parent => {
                  const isParentOpen = searchQuery ? true : !!folderState[parent.name];
                  const isParentActive = mainViewMode === 'manager' && managerFolder === parent.name;
                  const isDragOver = dragOverParentFolder === parent.name;
                  const isDragging = draggedParentFolder === parent.name;
                  
                  return (
                    <div 
                      key={parent.name} 
                      className={`mb-2 transition-all ${isDragOver ? 'border-t-2 border-cyan-400 pt-1' : ''} ${isDragging ? 'opacity-40' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverParentFolder !== parent.name) {
                          setDragOverParentFolder(parent.name);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverParentFolder === parent.name) {
                          setDragOverParentFolder(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleParentFolderDrop(parent.name);
                      }}
                    >
                      {/* 親フォルダ */}
                      <div className="flex items-center group relative p-1 rounded-sm transition-colors hover:bg-slate-800/60">
                        {/* ドラッグハンドル (K-Navigator風 GripVertical) */}
                        <div 
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.setData('text/plain', parent.name);
                            setDraggedParentFolder(parent.name);
                          }}
                          onDragEnd={() => {
                            setDraggedParentFolder(null);
                            setDragOverParentFolder(null);
                          }}
                          className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-200 p-0.5 mr-0.5 shrink-0 transition-colors" 
                          title="ドラッグしてカテゴリーを移動・並べ替え"
                        >
                          <GripVertical size={13} />
                        </div>

                        <button 
                          className={`flex-1 flex items-center transition-colors text-left min-w-0 cursor-pointer ${
                            isParentActive ? 'text-cyan-300 font-bold' : 'text-slate-200 hover:text-white'
                          }`}
                          onClick={() => {
                            const nextOpen = !folderState[parent.name];
                            setFolderState(prev => ({ ...prev, [parent.name]: nextOpen }));
                            if (nextOpen) {
                              navigateToManagerFolder(parent.name);
                            } else {
                              if (managerFolder === parent.name || (managerFolder && managerFolder.startsWith(parent.name + ' / '))) {
                                navigateToManagerFolder(null);
                              }
                            }
                          }}
                          title="クリックで開閉 / リスト表示切り替え"
                        >
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              const nextOpen = !folderState[parent.name];
                              setFolderState(prev => ({ ...prev, [parent.name]: nextOpen }));
                              if (nextOpen) {
                                navigateToManagerFolder(parent.name);
                              } else if (managerFolder === parent.name || (managerFolder && managerFolder.startsWith(parent.name + ' / '))) {
                                navigateToManagerFolder(null);
                              }
                            }}
                            className="p-0.5 mr-0.5 hover:text-cyan-400 text-slate-400 transition-colors cursor-pointer"
                            title={isParentOpen ? "折りたたむ" : "展開する"}
                          >
                            <ChevronRight size={14} className={`transition-transform shrink-0 ${isParentOpen ? 'rotate-90' : ''}`} />
                          </span>
                          <Folder 
                            size={14} 
                            className={`mr-2 shrink-0 ${isParentActive ? 'text-cyan-400 opacity-100' : 'text-slate-400 opacity-80'}`} 
                          />
                          <span className="flex-1 truncate uppercase font-bold tracking-wider" style={{ fontSize: `${fs}px` }}>
                            {parent.name}
                          </span>
                          <span className={`text-[9px] border font-bold px-1.5 rounded-sm shrink-0 mr-2 ${
                            isParentActive 
                              ? 'bg-cyan-950 border-cyan-400 text-cyan-300' 
                              : 'bg-slate-800 border-slate-700/60 text-slate-300'
                          }`}>
                            {parent.totalCount}
                          </span>
                        </button>
                        <div className="absolute right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 px-1 rounded-sm">
                          <button onClick={(e) => editParentFolder(parent.name, e)} className="p-1 hover:text-cyan-400 text-slate-400 transition-colors cursor-pointer"><Edit2 size={12}/></button>
                          <button onClick={(e) => deleteParentFolder(parent.name, e)} className="p-1 hover:text-red-400 text-slate-400 transition-colors cursor-pointer"><Trash2 size={12}/></button>
                        </div>
                      </div>

                      {isParentOpen && (
                        <div className="mt-1 pl-3 flex flex-col gap-1">
                          {/* 子フォルダ */}
                          {parent.subGroups.map(sub => {
                            const isSubOpen = searchQuery ? true : !!folderState[sub.fullName];
                            const isSubActive = mainViewMode === 'manager' && managerFolder === sub.fullName;
                            const isSubDragging = draggedSubFolder?.parentName === parent.name && draggedSubFolder?.subName === sub.subName;
                            const isSubDragOver = dragOverSubFolder?.parentName === parent.name && dragOverSubFolder?.subName === sub.subName;
                            
                            return (
                              <div 
                                key={sub.fullName} 
                                className={`mb-1 transition-all ${isSubDragOver ? 'border-t-2 border-cyan-400 pt-0.5' : ''} ${isSubDragging ? 'opacity-40' : ''}`}
                                onDragOver={(e) => {
                                  if (draggedSubFolder && draggedSubFolder.parentName === parent.name) {
                                    e.preventDefault();
                                    if (dragOverSubFolder?.parentName !== parent.name || dragOverSubFolder?.subName !== sub.subName) {
                                      setDragOverSubFolder({ parentName: parent.name, subName: sub.subName });
                                    }
                                  }
                                }}
                                onDragLeave={() => {
                                  if (dragOverSubFolder?.parentName === parent.name && dragOverSubFolder?.subName === sub.subName) {
                                    setDragOverSubFolder(null);
                                  }
                                }}
                                onDrop={(e) => {
                                  if (draggedSubFolder && draggedSubFolder.parentName === parent.name) {
                                    e.preventDefault();
                                    handleSubFolderDrop(parent.name, sub.subName);
                                  }
                                }}
                              >
                                <div className="flex items-center group/sub relative p-1 rounded-sm transition-colors hover:bg-slate-800/40">
                                  {/* ドラッグハンドル */}
                                  <div 
                                    draggable
                                    onDragStart={(e) => {
                                      e.stopPropagation();
                                      e.dataTransfer.setData('text/plain', sub.subName);
                                      setDraggedSubFolder({ parentName: parent.name, subName: sub.subName });
                                    }}
                                    onDragEnd={() => {
                                      setDraggedSubFolder(null);
                                      setDragOverSubFolder(null);
                                    }}
                                    className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-200 p-0.5 mr-0.5 shrink-0 transition-colors" 
                                    title="ドラッグしてサブカテゴリーを移動・並べ替え"
                                  >
                                    <GripVertical size={11} />
                                  </div>

                                  <button 
                                    className={`flex-1 flex items-center transition-colors text-left min-w-0 cursor-pointer ${
                                      isSubActive ? 'text-cyan-300 font-bold' : 'text-slate-200 hover:text-white'
                                    }`}
                                    onClick={() => {
                                      const nextOpen = !folderState[sub.fullName];
                                      setFolderState(prev => ({ ...prev, [parent.name]: true, [sub.fullName]: nextOpen }));
                                      if (nextOpen) {
                                        navigateToManagerFolder(sub.fullName);
                                      } else {
                                        navigateToManagerFolder(parent.name);
                                      }
                                    }}
                                    title="クリックで開閉 / リスト表示切り替え"
                                  >
                                    <span
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const nextOpen = !folderState[sub.fullName];
                                        setFolderState(prev => ({ ...prev, [parent.name]: true, [sub.fullName]: nextOpen }));
                                        if (nextOpen) {
                                          navigateToManagerFolder(sub.fullName);
                                        } else {
                                          navigateToManagerFolder(parent.name);
                                        }
                                      }}
                                      className="p-0.5 mr-0.5 hover:text-cyan-400 text-slate-400 transition-colors cursor-pointer"
                                      title={isSubOpen ? "折りたたむ" : "展開する"}
                                    >
                                      <ChevronRight size={12} className={`transition-transform shrink-0 ${isSubOpen ? 'rotate-90' : ''}`} />
                                    </span>
                                    <FolderOpen size={12} className={`mr-2 shrink-0 ${isSubActive ? 'text-cyan-400 opacity-100' : 'text-slate-400 opacity-80'}`} />
                                    <span className="flex-1 truncate font-bold tracking-wide" style={{ fontSize: `${Math.max(9, fs - 1)}px` }}>
                                      {sub.subName}
                                    </span>
                                    <span className={`text-[9px] border font-bold px-1.5 rounded-sm shrink-0 mr-2 ${
                                      isSubActive
                                        ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                                        : 'bg-slate-800/80 border-slate-700/40 text-slate-300'
                                    }`}>
                                      {sub.items.length}
                                    </span>
                                  </button>
                                  <div className="absolute right-1 flex gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity bg-slate-900 px-1 rounded-sm">
                                    <button onClick={(e) => editFolder(sub.fullName, e)} className="p-1 hover:text-cyan-400 text-slate-400 transition-colors cursor-pointer"><Edit2 size={10}/></button>
                                    <button onClick={(e) => deleteFolder(sub.fullName, e)} className="p-1 hover:text-red-400 text-slate-400 transition-colors cursor-pointer"><Trash2 size={10}/></button>
                                  </div>
                                </div>

                                {isSubOpen && (
                                  <div className="mt-1 flex flex-col gap-0.5 pl-4 pr-1 border-l border-slate-800/60 ml-2">
                                    {sub.items.map(item => {
                                      const isActive = currentItem?.id === item.id;
                                      const isChecked = selectedIds.has(item.id);
                                      return (
                                        <div 
                                          key={item.id} 
                                          className={`
                                            flex items-center py-1.5 px-2 rounded-sm cursor-pointer border-l-2 transition-colors group/item relative
                                            ${isActive ? 'bg-cyan-500/20 border-cyan-500 text-white font-bold' : 'border-transparent text-slate-200 hover:bg-slate-800/60 hover:text-white'}
                                          `}
                                          onClick={() => {
                                            if (isSelectMode) {
                                              const newSet = new Set(selectedIds);
                                              if (newSet.has(item.id)) newSet.delete(item.id);
                                              else newSet.add(item.id);
                                              setSelectedIds(newSet);
                                            } else {
                                              handleItemClick(item);
                                            }
                                          }}
                                        >
                                          {isSelectMode && (
                                            <div className="mr-3 flex items-center justify-center shrink-0">
                                              <input 
                                                type="checkbox" 
                                                className="custom-checkbox pointer-events-none"
                                                checked={isChecked}
                                                readOnly
                                              />
                                            </div>
                                          )}
                                          <div className="flex-1 min-w-0 flex flex-col">
                                            <span className="truncate font-semibold leading-snug" style={{ fontSize: `${fs}px` }}>{item.title}</span>
                                            <div className="flex items-center gap-2 mt-0.5">
                                              <span className={`truncate ${isActive ? 'text-slate-200 font-medium' : 'text-slate-400 group-hover/item:text-slate-300'}`} style={{ fontSize: `${Math.max(8, fs - 3)}px` }}>
                                                {item.parsed?.isValid ? `🧭 ${item.parsed.lat}, ${item.parsed.lng}` : '🗺️ 通常URL'}
                                              </span>
                                              {item.capturedDate && (
                                                <span className={`${isActive ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/50' : 'bg-slate-900 text-cyan-300 border-slate-700/80'} px-1 rounded-sm border shrink-0 uppercase tracking-widest font-mono font-bold`} style={{ fontSize: `${Math.max(8, fs - 3)}px` }}>
                                                  {item.capturedDate}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="absolute right-2 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center bg-slate-900/95 border border-slate-700/80 rounded-sm shadow-md z-10">
                                            <button 
                                              className="hover:text-cyan-400 p-1.5 transition-colors shrink-0 cursor-pointer text-slate-400"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openOrFocusTab(item);
                                              }}
                                              title="ストリートビューで表示 (既存タブまたは新規タブ)"
                                            >
                                              <Compass size={12} />
                                            </button>
                                            <button 
                                              className="hover:text-cyan-400 p-1.5 transition-colors shrink-0 cursor-pointer text-slate-400"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openInCenteredWindow(item, 1920, 1100);
                                              }}
                                              title="別窓で開く (新しいウィンドウ)"
                                            >
                                              <ExternalLink size={12} />
                                            </button>
                                            <button 
                                              className="hover:text-white p-1.5 transition-colors shrink-0 disabled:opacity-50 cursor-pointer text-slate-400"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditTarget(item);
                                                setIsEditModalOpen(true);
                                              }}
                                              disabled={isSelectMode}
                                              title="詳細設定を編集"
                                            >
                                              <Edit2 size={12} />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* 親フォルダ直下のアイテム */}
                          {parent.directItems.map(item => {
                            const isActive = currentItem?.id === item.id;
                            const isChecked = selectedIds.has(item.id);
                            return (
                              <div 
                                key={item.id} 
                                className={`
                                  flex items-center py-1.5 px-2 rounded-sm cursor-pointer border-l-2 transition-colors group/item relative
                                  ${isActive ? 'bg-cyan-500/20 border-cyan-500 text-white font-bold' : 'border-transparent text-slate-200 hover:bg-slate-800/60 hover:text-white'}
                                `}
                                onClick={() => {
                                  if (isSelectMode) {
                                    const newSet = new Set(selectedIds);
                                    if (newSet.has(item.id)) newSet.delete(item.id);
                                    else newSet.add(item.id);
                                    setSelectedIds(newSet);
                                  } else {
                                    handleItemClick(item);
                                  }
                                }}
                              >
                                {isSelectMode && (
                                  <div className="mr-3 flex items-center justify-center shrink-0">
                                    <input 
                                      type="checkbox" 
                                      className="custom-checkbox pointer-events-none"
                                      checked={isChecked}
                                      readOnly
                                    />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0 flex flex-col">
                                  <span className="truncate font-semibold leading-snug" style={{ fontSize: `${fs}px` }}>{item.title}</span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`truncate ${isActive ? 'text-slate-200 font-medium' : 'text-slate-400 group-hover/item:text-slate-300'}`} style={{ fontSize: `${Math.max(8, fs - 3)}px` }}>
                                      {item.parsed?.isValid ? `🧭 ${item.parsed.lat}, ${item.parsed.lng}` : '🗺️ 通常URL'}
                                    </span>
                                    {item.capturedDate && (
                                      <span className={`${isActive ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/50' : 'bg-slate-900 text-cyan-300 border-slate-700/80'} px-1 rounded-sm border shrink-0 uppercase tracking-widest font-mono font-bold`} style={{ fontSize: `${Math.max(8, fs - 3)}px` }}>
                                        {item.capturedDate}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="absolute right-2 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center bg-slate-900/95 border border-slate-700/80 rounded-sm shadow-md z-10">
                                  <button 
                                    className="hover:text-cyan-400 p-1.5 transition-colors shrink-0 cursor-pointer text-slate-400"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openOrFocusTab(item);
                                    }}
                                    title="ストリートビューで表示 (既存タブまたは新規タブ)"
                                  >
                                    <Compass size={12} />
                                  </button>
                                  <button 
                                    className="hover:text-cyan-400 p-1.5 transition-colors shrink-0 cursor-pointer text-slate-400"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openInCenteredWindow(item, 1920, 1100);
                                    }}
                                    title="別窓で開く (新しいウィンドウ)"
                                  >
                                    <ExternalLink size={12} />
                                  </button>
                                  <button 
                                    className="hover:text-white p-1.5 transition-colors shrink-0 disabled:opacity-50 cursor-pointer text-slate-400"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditTarget(item);
                                      setIsEditModalOpen(true);
                                    }}
                                    disabled={isSelectMode}
                                    title="詳細設定を編集"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                });
              })()
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

                {/* 選択した項目を一括でタブ化して開くボタン */}
                <button
                  onClick={openSelectedInTabs}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-bold rounded shadow transition-colors uppercase tracking-wider cursor-pointer"
                  title="選択したすべての場所を別々のタブとして展開"
                >
                  <FolderOpen size={14} />
                  <span>{settings.language === 'jp' ? `選択した ${selectedIds.size} 件をタブ化して開く` : `Open ${selectedIds.size} in Tabs`}</span>
                </button>
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

            {/* リストマネージャー画面を開くボタン */}
            <button 
              onClick={() => setMainViewMode(prev => prev === 'viewer' ? 'manager' : 'viewer')}
              className="w-full flex justify-center items-center gap-2 text-xs font-bold py-1.5 rounded-md border transition-all uppercase tracking-wider bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-slate-600"
            >
              <LayoutList size={14} className="text-cyan-400" />
              <span>{mainViewMode === 'manager' ? (settings.language === 'jp' ? "ビューアに戻る" : "BACK TO VIEWER") : (settings.language === 'jp' ? "リストマネージャー" : "LIST MANAGER")}</span>
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
              className="w-full flex justify-center items-center gap-2 text-[10px] border border-red-900 hover:bg-red-900/30 text-red-500 py-1.5 rounded-md transition-colors mt-0.5"
            >
              <Trash2 size={12} /> {t('clearAll')}
            </button>
          </div>
            </div> {/* End opacity container */}
          </div> {/* End inner wrapper */}
        </div>

        {/* === Main Content === */}
        <div className="flex-1 bg-black flex flex-col relative z-10 min-w-0">
          
          {/* Floating Show UI Handle (UIを隠した時のみ画面上部に極薄・半透明で配置、ホバー時のみ表示) */}
          {isImmersive && (
            <button
              onClick={() => setIsImmersive(false)}
              className="absolute top-0 left-1/2 -translate-x-1/2 z-[80] flex items-center justify-center group cursor-pointer h-6 w-28 opacity-20 hover:opacity-100 transition-opacity"
              title={settings.language === 'jp' ? "UIを表示 (Escキーでも復帰可能)" : "Show UI (or press Esc)"}
            >
              <div className="w-16 h-3.5 flex items-center justify-center bg-slate-900/80 hover:bg-slate-800 border-x border-b border-white/20 rounded-b-md backdrop-blur-sm shadow-md">
                <ChevronDown size={13} className="text-white/80 group-hover:text-cyan-400 transition-colors" />
              </div>
            </button>
          )}

          {/* Floating Exit Fullscreen Button (visible only when immersive mode hides the header and we are in fullscreen) */}
          {(isImmersive && isFullscreen) && (
            <button
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 z-[70] p-2 bg-header-bg/50 hover:bg-header-bg/80 text-white rounded-md backdrop-blur-sm transition-all opacity-30 hover:opacity-100 shadow-lg"
              title={t('exitFullscreen')}
            >
              <Minimize size={20} />
            </button>
          )}

          {/* Header Area (always visible to maintain height) */}
          {!isImmersive && (
            <div 
              className="h-12 border-b border-slate-800 bg-header-bg/80 backdrop-blur-md flex items-center justify-between shrink-0 z-20 relative flex-nowrap overflow-hidden px-3 sm:px-4 location-header-bar"
              style={{ 
                marginRight: (isSidebarOpen && settings.sidebarPosition === 'right') ? `${settings.sidebarWidth}px` : '0px',
                marginLeft: (isSidebarOpen && settings.sidebarPosition === 'left') ? `${settings.sidebarWidth}px` : '0px',
              }}
            >
              <div className="flex items-center gap-2 min-w-0 font-mono text-xs shrink overflow-hidden mr-2">
                <span className="text-white/90 uppercase tracking-widest text-[9px] shrink-0">{t('currLoc')}</span>
                {(activeTab && currentItem) ? (
                  <>
                    <span className="text-white truncate font-bold location-title-text">{currentItem.title}</span>
                    {currentItem.capturedDate && (
                      <span className="bg-slate-800 border border-slate-700 text-cyan-400 px-1.5 py-0.5 rounded-sm text-[9px] shrink-0 hidden md:inline-block">
                        {t('captured')} {currentItem.capturedDate}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-white/40 truncate font-bold">-</span>
                )}
              </div>
              <div className="flex gap-1.5 sm:gap-2 shrink-0 items-center flex-nowrap">
                {isSidebarOpen && (
                  <div className="hidden sm:flex items-center flex-nowrap">
                    {/* 不透明度スライダー (OPACITY) */}
                    <div className="flex items-center gap-1.5 mr-2.5">
                      <span className="text-[10px] text-white/90 font-bold uppercase tracking-wider hidden md:block">OPACITY</span>
                      <input 
                        type="range" 
                        min="10" 
                        max="100" 
                        value={Math.round((settings.sidebarOpacity ?? 1) * 100)} 
                        onChange={(e) => saveSettings({ ...settings, sidebarOpacity: Number(e.target.value) / 100 })}
                        className="w-14 sm:w-16 solid-square-slider"
                        title={`不透明度: ${Math.round((settings.sidebarOpacity ?? 1) * 100)}%`}
                      />
                      <span className="text-[9px] font-mono text-cyan-400 font-bold w-5 text-right">
                        {Math.round((settings.sidebarOpacity ?? 1) * 100)}
                      </span>
                    </div>
                    
                    <div className="hidden sm:block w-px h-4 bg-white/20 mr-2.5"></div>

                    {/* 文字サイズスライダー (TEXT) */}
                    <div className="hidden sm:flex items-center gap-1 mr-2.5">
                      <span className="text-[10px] text-white/90 font-bold uppercase tracking-wider">TEXT</span>
                      <input 
                        type="range" 
                        min="10" 
                        max="18" 
                        step="1"
                        value={getSidebarFontSizePx()} 
                        onChange={(e) => saveSettings({ ...settings, sidebarFontSize: Number(e.target.value) })}
                        className="w-14 sm:w-16 solid-square-slider"
                        title={`文字サイズ: ${getSidebarFontSizePx()}px`}
                      />
                      <span className="text-[9px] font-mono text-cyan-400 font-bold w-6 text-right">
                        {getSidebarFontSizePx()}P
                      </span>
                    </div>

                    <div className="hidden sm:block w-px h-4 bg-white/20 mr-2"></div>
                  </div>
                )}

                <button 
                  onClick={() => {
                    const themes = ['navy', 'dark', 'light', 'mocha', 'latte'] as const;
                    const currentIndex = themes.indexOf(settings.theme || 'navy');
                    const nextTheme = themes[(currentIndex + 1) % themes.length];
                    saveSettings({ ...settings, theme: nextTheme });
                  }}
                  className="flex items-center justify-center gap-1.5 border border-white/20 hover:border-cyan-500 hover:bg-white/10 text-[10px] text-white/90 hover:text-cyan-400 font-bold px-2 py-1 rounded-md uppercase tracking-wider transition-colors shrink-0 w-[78px]"
                  title={`テーマ切り替え: ${(settings.theme || 'navy').toUpperCase()}`}
                >
                  <Palette size={12} className="shrink-0" />
                  <span>{settings.theme || 'navy'}</span>
                </button>

                {/* ビューア / リスト編集マネージャー切り替えボタン */}
                <button 
                  onClick={() => setMainViewMode(prev => prev === 'viewer' ? 'manager' : 'viewer')}
                  className={`flex items-center gap-1.5 border text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider transition-colors shrink-0 ${
                    mainViewMode === 'manager'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.6)] font-black'
                      : 'border-white/20 text-white/90 hover:text-cyan-400 hover:border-cyan-500 hover:bg-white/10'
                  }`}
                  title={mainViewMode === 'manager' ? "ストリートビュー表示に戻る" : "リスト式編集マネージャーを開く"}
                >
                  <LayoutList size={13} />
                  <span>{mainViewMode === 'manager' ? t('viewModeViewer') : t('viewModeManager')}</span>
                </button>

                {(activeTab && currentItem) ? (
                  <a 
                    href={getDirectStreetViewUrl(currentItem)} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-1 bg-transparent border border-white/20 hover:border-cyan-500 hover:bg-white/10 text-white/90 hover:text-cyan-400 font-bold text-[10px] px-2 py-1 rounded-md uppercase tracking-wider transition-colors open-map-btn shrink-0"
                  >
                    <MapIcon size={12} /> <span className="hidden lg:inline">{t('openMap')}</span>
                  </a>
                ) : (
                  <button 
                    disabled
                    className="flex items-center gap-1 bg-transparent border border-white/20 text-white/90 font-bold text-[10px] px-2 py-1 rounded-md uppercase tracking-wider cursor-not-allowed shrink-0"
                  >
                    <MapIcon size={12} /> <span className="hidden lg:inline">{t('openMap')}</span>
                  </button>
                )}

                {/* 最右端アイコン群：サイドバー位置 ＆ 全画面 ＆ 別タブ ＆ 設定 */}
                <div className="flex items-center gap-1 border-l border-white/20 pl-2 ml-1 shrink-0">
                  <button 
                    onClick={() => saveSettings({ ...settings, sidebarPosition: settings.sidebarPosition === 'left' ? 'right' : 'left' })}
                    className="p-1.5 text-white/90 hover:bg-white/20 hover:text-cyan-400 rounded-md transition-colors border border-white/20 hover:border-white/40"
                    title={`サイドバー位置切替 (現在: ${settings.sidebarPosition === 'left' ? '左' : '右'} / クリックで${settings.sidebarPosition === 'left' ? '右' : '左'}側へ移動)`}
                  >
                    {settings.sidebarPosition === 'left' ? <PanelLeft size={15} /> : <PanelRight size={15} />}
                  </button>

                  <button 
                    onClick={toggleFullscreen}
                    className="p-1.5 text-white/90 hover:bg-white/20 hover:text-white rounded-md transition-colors border border-white/20 hover:border-white/40"
                    title={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
                  >
                    {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
                  </button>

                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-white/90 hover:bg-white/20 hover:text-cyan-400 rounded-md transition-colors border border-white/20 hover:border-white/40 inline-flex items-center justify-center shrink-0"
                    title="別タブで開く (新しいウィンドウで開く)"
                  >
                    <ExternalLink size={15} />
                  </a>

                  <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-1.5 text-white/90 hover:bg-white/20 hover:text-cyan-400 rounded-md transition-colors border border-white/20 hover:border-white/40 shrink-0"
                    title="設定"
                  >
                    <Settings size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* === Tab Bar === */}
          {(tabs.length > 0 && !isImmersive) && (
            <div 
              className="flex items-center bg-slate-900 border-b border-slate-800 shrink-0 z-20 relative h-12"
              style={{ 
                marginRight: (isSidebarOpen && settings.sidebarPosition === 'right') ? `${settings.sidebarWidth}px` : '0px',
                marginLeft: (isSidebarOpen && settings.sidebarPosition === 'left') ? `${settings.sidebarWidth}px` : '0px',
              }}
            >
              <div className="flex items-center shrink-0 border-r border-slate-800">
                <button
                  onClick={goToFirstTab}
                  disabled={currentTabIndex <= 0}
                  className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  title="一番最初のタブへ移動 (最左端)"
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  onClick={goToPrevTab}
                  disabled={currentTabIndex <= 0}
                  className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  title="前のタブへ移動 (左)"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>

              <div 
                ref={tabsContainerRef}
                className="flex-1 flex items-center gap-1 py-1.5 px-1 overflow-x-auto tab-scrollbar select-none"
              >
                {tabs.map((tab, idx) => (
                  <button
                    key={tab.id}
                    ref={(node) => {
                      if (node) tabRefs.current.set(tab.id, node);
                      else tabRefs.current.delete(tab.id);
                    }}
                    draggable
                    onDragStart={(e) => handleTabDragStart(e, idx)}
                    onDragOver={(e) => handleTabDragOver(e, idx)}
                    onDrop={(e) => handleTabDrop(e, idx)}
                    onDragEnd={handleTabDragEnd}
                    onClick={() => {
                      setActiveTabId(tab.id);
                      setMainViewMode('viewer');
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 border text-[10px] uppercase font-mono font-bold whitespace-nowrap transition-all cursor-grab active:cursor-grabbing select-none
                      ${draggedTabIndex === idx ? 'opacity-30 scale-95 border-dashed border-cyan-400' : ''}
                      ${dragOverTabIndex === idx && draggedTabIndex !== idx ? 'border-cyan-400 bg-cyan-950/50 shadow-[inset_0_0_8px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400' : ''}
                      ${activeTabId === tab.id 
                        ? 'bg-slate-800 border-slate-600 text-white shadow-sm' 
                        : 'bg-transparent border-slate-700 border-dashed text-slate-500 hover:bg-slate-800/50 hover:text-slate-300 hover:border-slate-600'
                      }`}
                    title="クリックで選択 / ドラッグで並べ替え"
                  >
                    <span className="truncate max-w-[120px] pointer-events-none">
                      {tab.location ? tab.location.title : `TAB ${(idx + 1).toString().padStart(2, '0')}`}
                    </span>
                    <div 
                      className="flex items-center gap-1.5 ml-1"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <Copy 
                        size={11} 
                        className="opacity-40 hover:opacity-100 hover:text-cyan-400 cursor-pointer transition-all" 
                        title="タブを複製 (コピー)" 
                        onClick={(e) => duplicateTab(e, tab)} 
                      />
                      <X 
                        size={12} 
                        className={`opacity-50 hover:opacity-100 hover:text-rose-400 cursor-pointer transition-all ${activeTabId === tab.id ? 'text-white' : 'text-slate-500'}`} 
                        title="タブを閉じる"
                        onClick={(e) => closeTab(e, tab.id)} 
                      />
                    </div>
                  </button>
                ))}
              </div>

              {/* 常時固定のタブ操作ボタン群（+新規タブ & 全て閉じる） */}
              <div className="flex items-center shrink-0 border-l border-slate-800 px-1 bg-slate-900 z-10">
                <button 
                  onClick={addNewTab}
                  className="flex items-center justify-center w-7 h-7 border border-slate-600 border-dashed text-slate-400 hover:text-cyan-400 hover:border-cyan-500 hover:bg-slate-800 transition-colors mx-1 shrink-0 rounded-sm cursor-pointer"
                  title={t('newTab')}
                >
                  <Plus size={14} strokeWidth={2.5} />
                </button>
                
                <button 
                  onClick={() => { setTabs([]); setActiveTabId(null); }}
                  className="flex items-center justify-center px-2.5 py-1.5 border border-slate-700 border-dashed text-slate-400 hover:text-red-400 hover:border-red-500/60 hover:bg-slate-800 transition-colors text-[10px] uppercase font-mono shrink-0 mr-1 cursor-pointer whitespace-nowrap"
                  title="すべてのタブを閉じる"
                >
                  {t('clearAllTabs')}
                </button>
              </div>

              <div className="flex items-center shrink-0 border-l border-slate-800">
                <button
                  onClick={goToNextTab}
                  disabled={currentTabIndex >= tabs.length - 1}
                  className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  title="次のタブへ移動 (右)"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={goToLastTab}
                  disabled={currentTabIndex >= tabs.length - 1}
                  className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  title="一番最後のタブへ移動 (最右端)"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Sidebar Boundary Resizer & Toggle Handle (ドラッグで幅変更 / クリックで開閉) */}
          <div
            onPointerDown={handleBoundaryPointerDown}
            className={`absolute top-0 bottom-0 z-[60] flex items-center justify-center cursor-col-resize group select-none touch-none ${settings.sidebarPosition === 'left' ? '-translate-x-1/2' : 'translate-x-1/2'}`}
            style={{
              width: '20px',
              left: settings.sidebarPosition === 'left' ? (isSidebarOpen ? `${settings.sidebarWidth}px` : '0px') : 'auto',
              right: settings.sidebarPosition === 'right' ? (isSidebarOpen ? `${settings.sidebarWidth}px` : '0px') : 'auto',
            }}
            title={isSidebarOpen ? "ドラッグでサイドバー幅を変更 / クリックで開閉" : "クリックでサイドバーを開く"}
          >
            {/* ホバー時に現れる境界ハイライト縦ライン */}
            <div className="absolute top-0 bottom-0 w-[2px] bg-transparent group-hover:bg-cyan-400/60 transition-colors pointer-events-none" />

            {/* 中央のピル型グリップハンドル */}
            <div 
              className="flex items-center justify-center transition-all duration-200 shadow-md backdrop-blur-sm text-white rounded-full
                h-[56px] w-[5px] group-hover:w-[22px]
                bg-slate-300/80 group-hover:bg-slate-900 border border-slate-600/70 group-hover:border-cyan-400
                opacity-80 group-hover:opacity-100 pointer-events-none"
            >
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 overflow-hidden shrink-0 flex items-center justify-center w-full text-cyan-400">
                {settings.sidebarPosition === 'left' ? (
                  isSidebarOpen ? <ChevronLeft size={13} /> : <ChevronRight size={13} />
                ) : (
                  isSidebarOpen ? <ChevronRight size={13} /> : <ChevronLeft size={13} />
                )}
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div 
            className="flex-1 relative bg-slate-950 overflow-hidden"
            style={{ 
              marginRight: (mainViewMode === 'manager' && isSidebarOpen && settings.sidebarPosition === 'right') ? `${settings.sidebarWidth}px` : '0px',
              marginLeft: (mainViewMode === 'manager' && isSidebarOpen && settings.sidebarPosition === 'left') ? `${settings.sidebarWidth}px` : '0px',
            }}
          >
            {mainViewMode === 'manager' ? (
              <LinkManagerView
                locations={locations}
                allFolders={allFolders}
                initialFolder={managerFolder}
                navigationToken={managerNavToken}
                onFolderSelect={(folder) => {
                  setManagerFolder(folder);
                  if (folder) {
                    const parts = folder.split(' / ');
                    const parentName = parts[0].trim();
                    setFolderState(prev => ({
                      ...prev,
                      [parentName]: true,
                      ...(parts.length > 1 ? { [folder]: true } : {})
                    }));
                  }
                }}
                parentFolderOrder={parentFolderOrder}
                onReorderParentFolders={(newOrder) => {
                  setParentFolderOrder(newOrder);
                  try {
                    localStorage.setItem('knav_parent_folder_order', JSON.stringify(newOrder));
                  } catch {}
                }}
                subFolderOrder={subFolderOrder}
                onReorderSubFolders={updateSubFolderOrder}
                listFontSize={getListFontSizePx()}
                onUpdateListFontSize={(size) => saveSettings({ ...settings, listFontSize: size })}
                theme={settings.theme}
                onSelectLocation={(loc) => {
                  handleItemClick(loc);
                }}
                onOpenOrFocusTab={(loc) => {
                  openOrFocusTab(loc);
                }}
                onOpenInNewWindow={(loc) => {
                  openInCenteredWindow(loc, 1920, 1100);
                }}
                onOpenInNewTab={(loc) => {
                  openInCenteredWindow(loc, 1920, 1100);
                }}
                onEditLocation={(loc) => {
                  setEditTarget(loc);
                  setIsEditModalOpen(true);
                }}
                onDeleteLocation={(id) => {
                  const newLocs = locations.filter(l => l.id !== id);
                  saveLocations(newLocs);
                  setTabs(prev => prev.filter(t => !t.location || t.location.id !== id));
                }}
                onBulkDelete={(ids) => {
                  const setIds = new Set(ids);
                  const newLocs = locations.filter(l => !setIds.has(l.id));
                  saveLocations(newLocs);
                  setTabs(prev => prev.filter(t => !t.location || !setIds.has(t.location.id)));
                }}
                onBulkMove={(ids, targetFolder) => {
                  const setIds = new Set(ids);
                  const newLocs = locations.map(l => {
                    if (setIds.has(l.id)) {
                      return { ...l, folderName: targetFolder };
                    }
                    return l;
                  });
                  saveLocations(newLocs);
                }}
                onOpenSelectedInTabs={(ids) => {
                  const setIds = new Set(ids);
                  const selectedItems = locations.filter(loc => setIds.has(loc.id));
                  if (selectedItems.length === 0) return;
                  const newTabsToAdd: TabData[] = selectedItems.map(item => ({
                    id: crypto.randomUUID(),
                    location: item,
                  }));
                  let updatedTabs: TabData[];
                  if (tabs.length === 1 && !tabs[0].location) {
                    updatedTabs = newTabsToAdd;
                  } else {
                    updatedTabs = [...tabs, ...newTabsToAdd];
                  }
                  setTabs(updatedTabs);
                  setActiveTabId(newTabsToAdd[0].id);
                  setMainViewMode('viewer');
                }}
                onReorderItems={(newLocs) => {
                  setSortOrder('custom');
                  saveLocations(newLocs);
                }}
                onUpdateItem={(updated) => {
                  const newLocs = locations.map(l => l.id === updated.id ? updated : l);
                  saveLocations(newLocs);
                }}
                onRenameFolder={(oldName, newName) => {
                  const newLocs = locations.map(l => l.folderName === oldName ? { ...l, folderName: newName } : l);
                  saveLocations(newLocs);
                }}
                onDeleteFolder={(folderName) => {
                  const newLocs = locations.filter(l => l.folderName !== folderName);
                  saveLocations(newLocs);
                }}
                onAddLocation={() => {
                  setEditTarget(null);
                  setIsEditModalOpen(true);
                }}
                onCloseManager={() => {
                  setMainViewMode('viewer');
                }}
                language={settings.language}
              />
            ) : (
              <>
                {(!activeTab || !currentItem) && (
                  <div 
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-black transition-[margin] duration-150 ease-out"
                    style={{ 
                      marginRight: (isSidebarOpen && settings.sidebarPosition === 'right') ? `${settings.sidebarWidth}px` : '0px',
                      marginLeft: (isSidebarOpen && settings.sidebarPosition === 'left') ? `${settings.sidebarWidth}px` : '0px',
                    }}
                  >
                    <div className="text-6xl font-black font-mono text-white/5 tracking-tighter leading-none mb-4 uppercase">
                      STREET VIEW
                    </div>
                    <p className="text-xs font-mono tracking-widest text-slate-500 mb-8">
                      {t('desc')}
                    </p>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-400 font-bold text-[10px] tracking-wider uppercase px-4 py-2 rounded-md transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <Download size={14} /> {t('loadBookmark')}
                      </button>
                      <button 
                        onClick={() => setMainViewMode('manager')}
                        className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-[10px] tracking-wider uppercase px-4 py-2 rounded-md transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <LayoutList size={14} /> {settings.language === 'jp' ? "リスト管理を開く" : "OPEN MANAGER"}
                      </button>
                    </div>
                    
                    <div className="mt-12 p-3 bg-cyan-900/10 border border-cyan-900/30 rounded-md text-left text-[10px] font-mono text-slate-400 max-w-sm">
                      <strong className="text-cyan-500 mb-1 block">{t('tmTitle')}</strong>
                      {t('tmDesc1')}<br/>
                      {t('tmDesc2')}
                    </div>
                  </div>
                )}

                {/* Render all persistent iframes */}
                {tabs.filter(t => t.location).map(tab => (
                  <div 
                    key={tab.id}
                    className="absolute inset-0 z-10 bg-slate-950 flex items-center justify-center"
                    style={{ display: activeTabId === tab.id ? 'block' : 'none' }}
                  >
                    <div className="text-slate-600 font-mono text-xs tracking-widest absolute m-4 inset-0 flex justify-center mt-12 pointer-events-none">{t('loading')}</div>
                    <iframe 
                      key={tab.location!.id} // force re-render ONLY if this specific tab's location changes
                      src={getIframeUrl(tab.location!)} 
                      className="w-full h-full border-none absolute inset-0 z-10" 
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* === Settings Modal === */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-overlay-bg/60 backdrop-blur-sm flex justify-center items-center p-4"
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
                    max="550" 
                    step="1"
                    value={settings.sidebarWidth} 
                    onChange={(e) => saveSettings({ ...settings, sidebarWidth: Number(e.target.value) })}
                    className="w-full solid-square-slider"
                  />
                </div>

                {/* Opacity Slider */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      {t('sidebarOpacity')}
                    </label>
                    <span className="text-xs font-mono font-bold text-white">{Math.round((settings.sidebarOpacity ?? 1) * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    value={Math.round((settings.sidebarOpacity ?? 1) * 100)} 
                    onChange={(e) => saveSettings({ ...settings, sidebarOpacity: Number(e.target.value) / 100 })}
                    className="w-full solid-square-slider"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    {t('sidebarPos')}
                  </label>
                  <div className="flex bg-slate-800 rounded-none p-1 border border-slate-700">
                    <button 
                      className={`flex-1 flex justify-center items-center py-1.5 text-xs font-bold transition-colors ${settings.sidebarPosition === 'left' ? 'bg-cyan-600 text-black' : 'text-slate-400 hover:text-slate-200'}`}
                      onClick={() => saveSettings({ ...settings, sidebarPosition: 'left' })}
                    >
                      {t('posLeft')}
                    </button>
                    <button 
                      className={`flex-1 flex justify-center items-center py-1.5 text-xs font-bold transition-colors ${settings.sidebarPosition === 'right' ? 'bg-cyan-600 text-black' : 'text-slate-400 hover:text-slate-200'}`}
                      onClick={() => saveSettings({ ...settings, sidebarPosition: 'right' })}
                    >
                      {t('posRight')}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      {t('sidebarFontSize')}
                    </label>
                    <span className="text-xs font-mono font-bold text-cyan-400">{getSidebarFontSizePx()}PX</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="18" 
                    step="1"
                    value={getSidebarFontSizePx()} 
                    onChange={(e) => saveSettings({ ...settings, sidebarFontSize: Number(e.target.value) })}
                    className="w-full solid-square-slider"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                    <span>10px (小)</span>
                    <span>12px (標準)</span>
                    <span>18px (大)</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      {t('listFontSize')}
                    </label>
                    <span className="text-xs font-mono font-bold text-cyan-400">{getListFontSizePx()}PX</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="20" 
                    step="1"
                    value={getListFontSizePx()} 
                    onChange={(e) => saveSettings({ ...settings, listFontSize: Number(e.target.value) })}
                    className="w-full solid-square-slider"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                    <span>10px (小)</span>
                    <span>12px (標準)</span>
                    <span>20px (大)</span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    {t('theme')}
                  </label>
                  <div className="flex flex-wrap bg-slate-800 rounded-md p-1 border border-slate-700">
                    <button 
                      className={`flex-1 min-w-[30%] flex justify-center items-center py-1.5 text-xs font-bold rounded-sm transition-colors ${(!settings.theme || settings.theme === 'navy') ? 'bg-cyan-600 text-black' : 'text-slate-400 hover:text-slate-200'}`}
                      onClick={() => saveSettings({ ...settings, theme: 'navy' })}
                    >
                      {t('navy')}
                    </button>
                    <button 
                      className={`flex-1 min-w-[30%] flex justify-center items-center py-1.5 text-xs font-bold rounded-sm transition-colors ${settings.theme === 'dark' ? 'bg-cyan-600 text-black' : 'text-slate-400 hover:text-slate-200'}`}
                      onClick={() => saveSettings({ ...settings, theme: 'dark' })}
                    >
                      {t('dark')}
                    </button>
                    <button 
                      className={`flex-1 min-w-[30%] flex justify-center items-center py-1.5 text-xs font-bold rounded-sm transition-colors ${settings.theme === 'light' ? 'bg-cyan-600 text-black' : 'text-slate-400 hover:text-slate-200'}`}
                      onClick={() => saveSettings({ ...settings, theme: 'light' })}
                    >
                      {t('light')}
                    </button>
                    <button 
                      className={`flex-1 min-w-[45%] flex justify-center items-center py-1.5 text-xs font-bold rounded-sm transition-colors ${settings.theme === 'mocha' ? 'bg-cyan-600 text-black' : 'text-slate-400 hover:text-slate-200'}`}
                      onClick={() => saveSettings({ ...settings, theme: 'mocha' })}
                    >
                      {t('mocha')}
                    </button>
                    <button 
                      className={`flex-1 min-w-[45%] flex justify-center items-center py-1.5 text-xs font-bold rounded-sm transition-colors ${settings.theme === 'latte' ? 'bg-cyan-600 text-black' : 'text-slate-400 hover:text-slate-200'}`}
                      onClick={() => saveSettings({ ...settings, theme: 'latte' })}
                    >
                      {t('latte')}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      フォルダー色 (Folder Color)
                    </label>
                    <button 
                      onClick={() => saveSettings({ ...settings, folderIconColor: undefined })}
                      className="text-[10px] text-cyan-500 hover:underline font-bold"
                    >
                      テーマ標準色に戻す
                    </button>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-800 rounded-md p-2 border border-slate-700">
                    <input 
                      type="color" 
                      value={settings.folderIconColor || '#94a3b8'} 
                      onChange={(e) => saveSettings({ ...settings, folderIconColor: e.target.value })}
                      className="w-8 h-8 rounded border border-slate-600 bg-transparent cursor-pointer shrink-0"
                    />
                    <div className="flex-1 flex flex-wrap gap-1.5 items-center">
                      <button
                        onClick={() => saveSettings({ ...settings, folderIconColor: undefined })}
                        className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${!settings.folderIconColor ? 'bg-cyan-600 text-black border-cyan-500' : 'bg-slate-700 text-slate-300 border-slate-600'}`}
                      >
                        標準 (テーマ同調)
                      </button>
                      {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#a1a1aa'].map(c => (
                        <button
                          key={c}
                          style={{ backgroundColor: c }}
                          onClick={() => saveSettings({ ...settings, folderIconColor: c })}
                          className={`w-5 h-5 rounded-full border transition-transform ${settings.folderIconColor === c ? 'scale-110 border-white' : 'border-transparent hover:scale-105'}`}
                        />
                      ))}
                    </div>
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
              setTabs(prev => prev.filter(t => t.location?.id !== id));
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
            className="fixed inset-0 z-[100] bg-overlay-bg/60 backdrop-blur-sm flex justify-center items-center p-4"
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
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-black rounded-md text-xs font-bold transition-colors shadow-lg shadow-cyan-500/30"
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
    const cleanUrl = getDirectStreetViewUrl(url.trim()) || url.trim();
    
    onSave({
      id: initialData?.id || `item_${Date.now()}_${Math.random()}`,
      url: cleanUrl,
      title: title.trim() || '名称未設定',
      folderName: finalFolder,
      capturedDate: capturedDate.trim() || undefined,
      parsed: parseGoogleMapsUrl(cleanUrl)
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-overlay-bg/60 backdrop-blur-sm flex justify-center items-center p-4"
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
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-black rounded-md text-xs font-bold transition-colors shadow-lg shadow-cyan-500/30"
            >
              保存
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

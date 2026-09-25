import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Folder, FolderOpen, MapPin, Search, Plus, Trash2, Edit2, 
  ExternalLink, Compass, GripVertical, 
  CheckSquare, Square, X, ChevronRight,
  Database, FolderEdit, FolderMinus,
  ChevronsUp, ChevronUp, ChevronDown, ChevronsDown,
  Check, Copy
} from 'lucide-react';

export interface LocationItem {
  id: string;
  folderName: string;
  title: string;
  url: string;
  capturedDate?: string;
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

// === Google Maps 直接ストリートビューURLの安全生成ユーティリティ ===
export const getDirectStreetViewUrl = (urlOrLoc: string | { url?: string; parsed?: any }) => {
  let rawUrl = '';
  let parsedObj: any = null;

  if (typeof urlOrLoc === 'string') {
    rawUrl = urlOrLoc;
  } else if (urlOrLoc && typeof urlOrLoc === 'object') {
    rawUrl = urlOrLoc.url || '';
    parsedObj = urlOrLoc.parsed;
  }

  if (!rawUrl && !parsedObj) return '';

  // 1. すでに parsed がある場合、または rawUrl から座標を抽出
  const latLngMatch = rawUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const lat = parsedObj?.lat !== undefined && parsedObj?.lat !== null ? String(parsedObj.lat) : (latLngMatch ? latLngMatch[1] : null);
  const lng = parsedObj?.lng !== undefined && parsedObj?.lng !== null ? String(parsedObj.lng) : (latLngMatch ? latLngMatch[2] : null);

  if (lat && lng) {
    // pano ID
    let pano = parsedObj?.pano;
    if (!pano) {
      const panoMatch = rawUrl.match(/!1s([^!&?]+)/);
      if (panoMatch && !panoMatch[1].startsWith('0x')) pano = panoMatch[1];
    }
    if (pano && pano.startsWith('0x')) {
      pano = undefined;
    }

    // heading (h)
    let headingVal = 0;
    if (parsedObj?.heading !== undefined && parsedObj?.heading !== null) {
      headingVal = parseFloat(String(parsedObj.heading)) || 0;
    } else {
      const hMatch = rawUrl.match(/,(-?\d+(?:\.\d+)?)h/);
      if (hMatch) headingVal = parseFloat(hMatch[1]) || 0;
    }
    const headingStr = `${Math.round(headingVal)}h`;

    // pitch (t) : Google Maps の URL では 90t が正面（水平）、84t や 95t など
    let pitchT = 90;
    const tMatch = rawUrl.match(/,(-?\d+(?:\.\d+)?)t/);
    if (tMatch) {
      pitchT = parseFloat(tMatch[1]);
    } else if (parsedObj?.pitch !== undefined && parsedObj?.pitch !== null) {
      const pVal = parseFloat(String(parsedObj.pitch));
      pitchT = 90 - (isNaN(pVal) ? 0 : pVal);
    }
    const pitchStr = `${pitchT.toFixed(2)}t`;
    const fov = '75y';

    if (pano) {
      return `https://www.google.com/maps/@${lat},${lng},3a,${fov},${headingStr},${pitchStr}/data=!3m6!1e1!3m4!1s${pano}!2e0!7i16384!8i8192`;
    }
    return `https://www.google.com/maps/@${lat},${lng},3a,${fov},${headingStr},${pitchStr}/data=!3m4!1e1!3m2!1e1!2e0`;
  }

  // 2. 座標パースができない場合でも、自アプリのドメインや重複を削ぎ落として Google Maps の URL を修復
  let cleaned = rawUrl.trim();
  const googleIdx = cleaned.search(/google\.(?:com|co\.jp)\/maps/i);
  if (googleIdx !== -1) {
    cleaned = 'https://www.' + cleaned.slice(googleIdx);
  } else if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }

  return cleaned;
};

// === 新しいウィンドウをモニター中央 (1920×1100) で開くユーティリティ ===
export const openInCenteredWindow = (urlOrLoc: string | LocationItem, width = 1920, height = 1100) => {
  if (!urlOrLoc) return;
  const targetUrl = getDirectStreetViewUrl(urlOrLoc);
  if (!targetUrl) return;

  // 1. モニターの利用可能領域を取得 (iframe内のinnerHeightではなく、モニター自体の解像度を使用)
  const screenObj = typeof window !== 'undefined' ? (window.screen as any) : null;
  const availW = screenObj?.availWidth || screenObj?.width || 1920;
  const availH = screenObj?.availHeight || screenObj?.height || 1080;

  // モニターの有効高さに収まるように調整 (フルHD 1080p環境でも上下にマージンを残して完全中央配置)
  const targetW = Math.min(width, availW);
  const targetH = Math.min(height, Math.max(600, availH - 60));

  // 2. 現在のウィンドウが存在するモニターの左上原点 (マルチモニター対応)
  let monitorLeft = 0;
  let monitorTop = 0;

  if (screenObj && typeof screenObj.availLeft === 'number' && typeof screenObj.availTop === 'number') {
    // Chrome / Edge などの最新マルチモニター座標
    monitorLeft = screenObj.availLeft;
    monitorTop = screenObj.availTop;
  } else {
    // フォールバック: 現在のウィンドウ位置からモニター基点を算出
    const currentX = window.screenLeft !== undefined ? window.screenLeft : (window.screenX || 0);
    const currentY = window.screenTop !== undefined ? window.screenTop : (window.screenY || 0);
    
    // 現在のウィンドウ中心があるモニターの原点を計算
    const windowCenterX = currentX + (window.outerWidth || availW) / 2;
    const windowCenterY = currentY + (window.outerHeight || availH) / 2;
    monitorLeft = Math.floor(windowCenterX / availW) * availW;
    monitorTop = Math.floor(windowCenterY / availH) * availH;
  }

  // 3. モニターの中央座標 (left, top) を算出
  const left = Math.round(monitorLeft + (availW - targetW) / 2);
  const top = Math.round(monitorTop + (availH - targetH) / 2);

  const features = [
    `width=${targetW}`,
    `height=${targetH}`,
    `left=${left}`,
    `top=${top}`,
    'resizable=yes',
    'scrollbars=yes',
    'status=yes',
    'menubar=no',
    'toolbar=no',
    'location=yes'
  ].join(',');

  const win = window.open(targetUrl, '_blank', features);
  if (win) {
    try {
      // featuresの座標に加えてmoveTo/resizeToも実行して確実に中央配置
      win.moveTo(left, top);
      win.resizeTo(targetW, targetH);
      win.focus();
    } catch {
      win.focus();
    }
  }
};

interface LinkManagerViewProps {
  locations: LocationItem[];
  allFolders: string[];
  initialFolder?: string | null;
  navigationToken?: number;
  onFolderSelect?: (folder: string | null) => void;
  parentFolderOrder?: string[];
  onReorderParentFolders?: (newOrder: string[]) => void;
  subFolderOrder?: Record<string, string[]>;
  onReorderSubFolders?: (parentName: string, newOrder: string[]) => void;
  theme?: string;
  onSelectLocation: (loc: LocationItem) => void;
  onOpenOrFocusTab?: (loc: LocationItem) => void;
  onOpenInNewTab?: (loc: LocationItem) => void;
  onOpenInNewWindow?: (loc: LocationItem) => void;
  onEditLocation: (loc: LocationItem) => void;
  onDeleteLocation: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkMove: (ids: string[], targetFolder: string) => void;
  onBulkCopy?: (ids: string[], targetFolder: string) => void;
  onOpenSelectedInTabs: (ids: string[]) => void;
  onReorderItems: (newLocs: LocationItem[]) => void;
  onUpdateItem: (updated: LocationItem) => void;
  onRenameFolder: (oldName: string, newName: string) => void;
  onDeleteFolder: (folderName: string) => void;
  onAddLocation: () => void;
  onCloseManager: () => void;
  listFontSize?: number;
  onUpdateListFontSize?: (size: number) => void;
  language: 'jp' | 'en';
}

export const LinkManagerView: React.FC<LinkManagerViewProps> = ({
  locations,
  allFolders,
  initialFolder = null,
  navigationToken,
  onFolderSelect,
  parentFolderOrder = [],
  onReorderParentFolders,
  subFolderOrder = {},
  onReorderSubFolders,
  listFontSize = 12,
  onUpdateListFontSize,
  onSelectLocation,
  onOpenOrFocusTab,
  onOpenInNewTab,
  onOpenInNewWindow,
  onEditLocation,
  onDeleteLocation,
  onBulkDelete,
  onBulkMove,
  onBulkCopy,
  onOpenSelectedInTabs,
  onReorderItems,
  onUpdateItem,
  onRenameFolder,
  onDeleteFolder,
  onAddLocation,
  onCloseManager,
  language,
}) => {
  // 階層ナビゲーション状態: 親フォルダ (第1階層) と 子フォルダ (第2階層)
  const [selectedParent, setSelectedParent] = useState<string | null>(() => {
    if (!initialFolder) return null;
    const parts = initialFolder.split(' / ');
    return parts[0].trim();
  });
  const [selectedSub, setSelectedSub] = useState<string | null>(() => {
    if (!initialFolder) return null;
    const parts = initialFolder.split(' / ');
    return parts.length > 1 ? initialFolder : null;
  });

  // カテゴリカードのドラッグ＆ドロップ並び替え状態 (第1階層 親フォルダ)
  const [draggedCardParent, setDraggedCardParent] = useState<string | null>(null);
  const [dragOverCardParent, setDragOverCardParent] = useState<string | null>(null);

  const handleCardParentDrop = (targetParent: string) => {
    if (!draggedCardParent || draggedCardParent === targetParent || !onReorderParentFolders) {
      setDraggedCardParent(null);
      setDragOverCardParent(null);
      return;
    }
    const currentOrder = hierarchicalData.map(p => p.name);
    const fromIndex = currentOrder.indexOf(draggedCardParent);
    const toIndex = currentOrder.indexOf(targetParent);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedCardParent(null);
      setDragOverCardParent(null);
      return;
    }
    const newOrder = [...currentOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    onReorderParentFolders(newOrder);
    setDraggedCardParent(null);
    setDragOverCardParent(null);
  };

  // サブカテゴリカードのドラッグ＆ドロップ並び替え状態 (第2階層 中間層フォルダ)
  const [draggedCardSub, setDraggedCardSub] = useState<string | null>(null);
  const [dragOverCardSub, setDragOverCardSub] = useState<string | null>(null);

  const handleCardSubDrop = (targetSubName: string) => {
    if (!draggedCardSub || draggedCardSub === targetSubName || !selectedParent || !onReorderSubFolders) {
      setDraggedCardSub(null);
      setDragOverCardSub(null);
      return;
    }
    const currentSubs = currentParentInfo?.subFolders.map(s => s.name) || [];
    const fromIndex = currentSubs.indexOf(draggedCardSub);
    const toIndex = currentSubs.indexOf(targetSubName);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedCardSub(null);
      setDragOverCardSub(null);
      return;
    }
    const newOrder = [...currentSubs];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    onReorderSubFolders(selectedParent, newOrder);
    setDraggedCardSub(null);
    setDragOverCardSub(null);
  };

  // initialFolder / navigationToken の外部変更検知 (サイドバー連動)
  useEffect(() => {
    if (initialFolder === undefined && navigationToken === undefined) return;
    if (!initialFolder) {
      setSelectedParent(null);
      setSelectedSub(null);
    } else {
      const parts = initialFolder.split(' / ');
      setSelectedParent(parts[0].trim());
      setSelectedSub(parts.length > 1 ? initialFolder : null);
    }
  }, [initialFolder, navigationToken]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [bulkTargetFolder, setBulkTargetFolder] = useState('');

  // === オリジナルカスタム確認ダイアログ・プロンプト状態 ===
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const [promptModal, setPromptModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    defaultValue: string;
    onConfirm: (val: string) => void;
  } | null>(null);
  const [promptInputVal, setPromptInputVal] = useState('');

  // === 列幅のリサイズ状態管理 ===
  const [colWidths, setColWidths] = useState<{ title: number; coords: number; dir: number }>({
    title: 320,
    coords: 220,
    dir: 200,
  });

  const resizingRef = useRef<{
    colKey: 'title' | 'coords' | 'dir';
    startX: number;
    startWidth: number;
  } | null>(null);

  const handleResizeStart = (colKey: 'title' | 'coords' | 'dir', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      colKey,
      startX: e.clientX,
      startWidth: colWidths[colKey],
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = moveEvent.clientX - resizingRef.current.startX;
      const minWidth = colKey === 'title' ? 180 : 120;
      const newWidth = Math.max(minWidth, resizingRef.current.startWidth + delta);
      setColWidths(prev => ({
        ...prev,
        [resizingRef.current!.colKey]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // インライン編集状態
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingItemId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingItemId]);

  // フォルダごとのアイテム件数カウント
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const loc of locations) {
      const f = loc.folderName || 'Unassigned';
      counts[f] = (counts[f] || 0) + 1;
    }
    return counts;
  }, [locations]);

  // フォルダ階層データの構築（第1階層の親フォルダと配下のサブフォルダ）
  const hierarchicalData = useMemo(() => {
    const parentMap = new Map<string, {
      name: string;
      totalCount: number;
      directCount: number;
      subFolders: { name: string; fullName: string; count: number }[];
    }>();

    for (const folder of allFolders) {
      const parts = folder.split(' / ');
      const parentName = parts[0].trim();
      if (!parentMap.has(parentName)) {
        parentMap.set(parentName, {
          name: parentName,
          totalCount: 0,
          directCount: 0,
          subFolders: [],
        });
      }
      const info = parentMap.get(parentName)!;
      const count = folderCounts[folder] || 0;
      if (parts.length > 1) {
        const subName = parts.slice(1).join(' / ').trim();
        info.subFolders.push({
          name: subName,
          fullName: folder,
          count,
        });
        info.totalCount += count;
      } else {
        info.directCount += count;
        info.totalCount += count;
      }
    }

    const list = Array.from(parentMap.values());
    // サイドバーのドラッグ＆ドロップ順序 (parentFolderOrder) を即座に反映！
    list.sort((a, b) => {
      const idxA = parentFolderOrder.indexOf(a.name);
      const idxB = parentFolderOrder.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
    list.forEach(p => {
      const customSubOrder = subFolderOrder[p.name];
      if (customSubOrder && customSubOrder.length > 0) {
        p.subFolders.sort((a, b) => {
          const idxA = customSubOrder.indexOf(a.name);
          const idxB = customSubOrder.indexOf(b.name);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.name.localeCompare(b.name);
        });
      } else {
        p.subFolders.sort((a, b) => a.name.localeCompare(b.name));
      }
    });
    return list;
  }, [allFolders, folderCounts, parentFolderOrder, subFolderOrder]);

  const currentParentInfo = useMemo(() => {
    if (!selectedParent) return null;
    return hierarchicalData.find(p => p.name === selectedParent) || null;
  }, [hierarchicalData, selectedParent]);

  // フィルタリングされたアイテムリスト
  const filteredItems = useMemo(() => {
    let list = locations;
    if (selectedSub) {
      list = list.filter(loc => (loc.folderName || 'Unassigned') === selectedSub);
    } else if (selectedParent) {
      list = list.filter(loc => {
        const f = loc.folderName || 'Unassigned';
        return f === selectedParent || f.startsWith(`${selectedParent} / `);
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(loc => 
        loc.title.toLowerCase().includes(q) ||
        loc.folderName.toLowerCase().includes(q) ||
        loc.url.toLowerCase().includes(q)
      );
    }
    return list;
  }, [locations, selectedParent, selectedSub, searchQuery]);

  // === 無限スクロール・遅延読み込み (800件以上のALL DATAでも爆速表示) ===
  const [visibleCount, setVisibleCount] = useState(60);

  // フォルダ選択や検索キーワードが変わったら表示件数をリセット
  useEffect(() => {
    setVisibleCount(60);
  }, [selectedParent, selectedSub, searchQuery]);

  // 画面に実際に描画するアイテム（必要に応じてスクロールで動的追加）
  const displayedItems = useMemo(() => {
    return filteredItems.slice(0, visibleCount);
  }, [filteredItems, visibleCount]);

  // テーブルスクロール検知（下部に近づいたら次の50件を瞬時に追加）
  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 350) {
      setVisibleCount(prev => {
        if (prev < filteredItems.length) {
          return Math.min(prev + 50, filteredItems.length);
        }
        return prev;
      });
    }
  };

  // 全選択 / 解除
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(item => item.id)));
    }
  };

  const toggleSelectItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // URLの短縮フォーマット（Google Mapsの長いパラメータを削って短く表示）
  const formatShortUrl = (url: string) => {
    if (!url) return '';
    try {
      const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (match) {
        return `maps.google.com/@${Number(match[1]).toFixed(4)},${Number(match[2]).toFixed(4)}`;
      }
      const parsed = new URL(url);
      const path = parsed.pathname.length > 20 ? parsed.pathname.slice(0, 20) + '...' : parsed.pathname;
      return `${parsed.hostname}${path}`;
    } catch {
      return url.length > 32 ? url.slice(0, 32) + '...' : url;
    }
  };

  // 表示中リスト (filteredItems) での並び替え順序を locations 全体に正確に適用・保存する
  const applyReorderedFilteredItems = (newFiltered: LocationItem[]) => {
    // 現在の locations において filteredItems に属するアイテムのインデックス位置を収集
    const filteredIdSet = new Set(filteredItems.map(f => f.id));
    const indices: number[] = [];
    locations.forEach((item, index) => {
      if (filteredIdSet.has(item.id)) {
        indices.push(index);
      }
    });

    const newLocations = [...locations];
    // 収集したインデックス位置に、新しく並び替えたアイテムを順番に格納
    indices.forEach((locIndex, i) => {
      if (i < newFiltered.length) {
        newLocations[locIndex] = newFiltered[i];
      }
    });

    onReorderItems(newLocations);
  };

  // === 複数選択された項目の上下移動（Kナビゲーター方式） ===
  const moveSelectedUp = () => {
    if (selectedIds.size === 0) return;
    const newFiltered = [...filteredItems];
    for (let i = 1; i < newFiltered.length; i++) {
      if (selectedIds.has(newFiltered[i].id) && !selectedIds.has(newFiltered[i - 1].id)) {
        const temp = newFiltered[i];
        newFiltered[i] = newFiltered[i - 1];
        newFiltered[i - 1] = temp;
      }
    }
    applyReorderedFilteredItems(newFiltered);
  };

  const moveSelectedDown = () => {
    if (selectedIds.size === 0) return;
    const newFiltered = [...filteredItems];
    for (let i = newFiltered.length - 2; i >= 0; i--) {
      if (selectedIds.has(newFiltered[i].id) && !selectedIds.has(newFiltered[i + 1].id)) {
        const temp = newFiltered[i];
        newFiltered[i] = newFiltered[i + 1];
        newFiltered[i + 1] = temp;
      }
    }
    applyReorderedFilteredItems(newFiltered);
  };

  const moveSelectedToTop = () => {
    if (selectedIds.size === 0) return;
    const selected: LocationItem[] = [];
    const unselected: LocationItem[] = [];
    for (const item of filteredItems) {
      if (selectedIds.has(item.id)) {
        selected.push(item);
      } else {
        unselected.push(item);
      }
    }
    applyReorderedFilteredItems([...selected, ...unselected]);
  };

  const moveSelectedToBottom = () => {
    if (selectedIds.size === 0) return;
    const selected: LocationItem[] = [];
    const unselected: LocationItem[] = [];
    for (const item of filteredItems) {
      if (selectedIds.has(item.id)) {
        selected.push(item);
      } else {
        unselected.push(item);
      }
    }
    applyReorderedFilteredItems([...unselected, ...selected]);
  };

  // ドラッグ＆ドロップ処理
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) {
      setDragOverId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const fromIndex = filteredItems.findIndex(item => item.id === draggedId);
    const toIndex = filteredItems.findIndex(item => item.id === targetId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const newFiltered = [...filteredItems];
      const [movedItem] = newFiltered.splice(fromIndex, 1);
      newFiltered.splice(toIndex, 0, movedItem);
      applyReorderedFilteredItems(newFiltered);
    }

    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // インラインタイトルの保存
  const saveInlineTitle = (item: LocationItem) => {
    if (!editingItemId) return;
    const trimmed = editingTitleText.trim();
    if (trimmed && trimmed !== item.title) {
      onUpdateItem({ ...item, title: trimmed });
    }
    setEditingItemId(null);
  };

  // 一括移動
  const handleBulkMove = () => {
    if (!bulkTargetFolder || selectedIds.size === 0) return;
    onBulkMove(Array.from(selectedIds), bulkTargetFolder);
    setSelectedIds(new Set());
    setBulkTargetFolder('');
  };

  // 一括コピー保存
  const handleBulkCopy = () => {
    if (!bulkTargetFolder || selectedIds.size === 0) return;
    if (onBulkCopy) {
      onBulkCopy(Array.from(selectedIds), bulkTargetFolder);
    }
    setSelectedIds(new Set());
    setBulkTargetFolder('');
  };

  // 一括削除
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmModal({
      isOpen: true,
      title: language === 'jp' ? '一括削除の確認' : 'Confirm Bulk Deletion',
      message: language === 'jp' 
        ? `選択した ${selectedIds.size} 件の場所を削除してもよろしいですか？\nこの操作は取り消せません。`
        : `Are you sure you want to delete ${selectedIds.size} selected locations?`,
      confirmText: language === 'jp' ? '削除する' : 'Delete',
      isDanger: true,
      onConfirm: () => {
        onBulkDelete(Array.from(selectedIds));
        setSelectedIds(new Set());
        setConfirmModal(null);
      }
    });
  };

  // 一括タブ化
  const handleBulkTabs = () => {
    if (selectedIds.size === 0) return;
    onOpenSelectedInTabs(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  // フォルダ名変更
  const handleRenameCurrentFolder = () => {
    const targetFolder = selectedSub || selectedParent;
    if (!targetFolder) return;
    setPromptInputVal(targetFolder);
    setPromptModal({
      isOpen: true,
      title: language === 'jp' ? 'フォルダ名の変更' : 'Rename Folder',
      message: language === 'jp' ? `「${targetFolder}」の新しいフォルダ名を入力してください` : `Enter new name for "${targetFolder}"`,
      defaultValue: targetFolder,
      onConfirm: (newName) => {
        if (newName && newName.trim() && newName.trim() !== targetFolder) {
          onRenameFolder(targetFolder, newName.trim());
          if (selectedSub) {
            setSelectedSub(newName.trim());
          } else {
            setSelectedParent(newName.trim());
          }
        }
        setPromptModal(null);
      }
    });
  };

  // フォルダ削除
  const handleDeleteCurrentFolder = () => {
    const targetFolder = selectedSub || selectedParent;
    if (!targetFolder) return;
    const count = selectedSub ? (folderCounts[selectedSub] || 0) : (currentParentInfo?.totalCount || 0);
    setConfirmModal({
      isOpen: true,
      title: language === 'jp' ? 'フォルダ削除の確認' : 'Confirm Folder Deletion',
      message: language === 'jp' 
        ? `フォルダ「${targetFolder}」および含まれるすべての場所 (${count} 件) を削除しますか？\nこのフォルダ内の登録データもすべて削除されます。`
        : `Delete folder "${targetFolder}" and all its ${count} locations?`,
      confirmText: language === 'jp' ? 'フォルダごと削除' : 'Delete Folder',
      isDanger: true,
      onConfirm: () => {
        onDeleteFolder(targetFolder);
        if (selectedSub) {
          setSelectedSub(null);
        } else {
          setSelectedParent(null);
        }
        setConfirmModal(null);
      }
    });
  };

  const isAllSelected = filteredItems.length > 0 && selectedIds.size === filteredItems.length;

  return (
    <div className="flex flex-col h-full select-none overflow-hidden font-sans bg-slate-950 text-slate-300 transition-colors">
      
      {/* === 1. TOP HEADER / TITLE BAR === */}
      <div className="px-5 py-3 border-b border-slate-800 bg-header-bg text-white flex items-center justify-between shrink-0 shadow-sm transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <span className="p-1.5 rounded border border-cyan-500/40 bg-cyan-600 text-black font-bold">
              <Database size={16} />
            </span>
            <div className="flex flex-col">
              <div className="text-[10px] font-mono tracking-widest font-black uppercase leading-none text-cyan-600 dark:text-cyan-400">
                03 DATA BANKS
              </div>
              <h2 className="text-base font-black tracking-tight uppercase leading-tight text-white">
                LIST MANAGER
              </h2>
            </div>
          </div>

          {/* パンくずナビゲーション (BREADCRUMBS) */}
          <div className="hidden md:flex items-center gap-1.5 ml-4 pl-4 border-l border-slate-700/60 text-xs font-mono min-w-0 text-slate-400">
            <span className="font-bold uppercase shrink-0 text-slate-400">CURRENT DIR:</span>
            
            {/* ルート: [ ALL DATA ] */}
            <button 
              onClick={() => {
                setSelectedParent(null);
                setSelectedSub(null);
                onFolderSelect?.(null);
              }}
              className={`hover:underline font-black transition-colors shrink-0 cursor-pointer ${
                selectedParent === null ? 'text-cyan-600 dark:text-cyan-400 underline' : 'text-slate-300'
              }`}
            >
              [ ALL DATA ]
            </button>

            {/* 第1階層: 親フォルダ */}
            {selectedParent && (
              <>
                <ChevronRight size={14} className="text-slate-600 shrink-0" />
                <button
                  onClick={() => {
                    setSelectedSub(null);
                    onFolderSelect?.(selectedParent);
                  }}
                  className={`font-bold px-2 py-0.5 rounded truncate max-w-[220px] border transition-colors cursor-pointer ${
                    selectedSub === null
                      ? 'border-cyan-500/40 bg-cyan-500/20 text-white font-black'
                      : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500 hover:text-white'
                  }`}
                  title={selectedParent}
                >
                  {selectedParent}
                </button>
              </>
            )}

            {/* 第2階層: 子フォルダ */}
            {selectedSub && (
              <>
                <ChevronRight size={14} className="text-slate-600 shrink-0" />
                <span className="font-black px-2 py-0.5 rounded truncate max-w-[240px] border border-cyan-500/40 bg-cyan-500/20 text-white" title={selectedSub}>
                  {selectedSub.split(' / ').slice(1).join(' / ') || selectedSub}
                </span>
              </>
            )}

            {/* フォルダ操作ボタン（名前変更・削除） */}
            {(selectedParent || selectedSub) && (
              <div className="flex items-center gap-1 ml-1 shrink-0">
                <button
                  onClick={handleRenameCurrentFolder}
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-colors shrink-0 border border-slate-700 hover:bg-slate-800 text-slate-300 cursor-pointer"
                  title="フォルダ名を変更"
                >
                  <FolderEdit size={12} />
                  <span>{language === 'jp' ? "名前変更" : "RENAME"}</span>
                </button>
                <button
                  onClick={handleDeleteCurrentFolder}
                  className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 px-2 py-0.5 hover:bg-red-950/40 rounded transition-colors shrink-0 border border-red-500/30 cursor-pointer"
                  title="フォルダを削除"
                >
                  <FolderMinus size={12} />
                  <span>{language === 'jp' ? "フォルダ削除" : "DELETE"}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 右側アクション：検索＆ストリートビューに戻るボタン */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative w-44 sm:w-60">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={language === 'jp' ? "場所名・フォルダ等で検索..." : "Search locations..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded border border-slate-700 bg-slate-900 text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            onClick={onCloseManager}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-black font-black text-xs uppercase tracking-wider rounded shadow transition-all cursor-pointer"
            title="ストリートビュー表示画面に戻る"
          >
            <Compass size={15} />
            <span>{language === 'jp' ? "ビューアに戻る" : "BACK TO VIEWER"}</span>
          </button>
        </div>
      </div>

      {/* === 2. SUB-DIRECTORIES (Kナビゲーター風 階層連動グリッド) === */}
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/60 shrink-0 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
            <Folder size={14} className="text-cyan-600 dark:text-cyan-400" />
            <span>
              {selectedParent === null 
                ? `CATEGORIES (${hierarchicalData.length})` 
                : `CATEGORIES : ${selectedParent} (${(currentParentInfo?.subFolders.length || 0) + (currentParentInfo?.directCount ? 1 : 0)})`
              }
            </span>
          </div>
          {selectedParent && (
            <button
              onClick={() => {
                setSelectedParent(null);
                setSelectedSub(null);
                onFolderSelect?.(null);
              }}
              className="text-[10px] font-mono underline font-black text-cyan-600 dark:text-cyan-400 hover:opacity-80 cursor-pointer flex items-center gap-1"
            >
              <span>← {language === 'jp' ? "トップ階層に戻る" : "Back to Top Categories"}</span>
            </button>
          )}
        </div>

        {/* 等幅グリッド配置 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1">
          {selectedParent === null ? (
            /* [トップ階層] [ ALL DATA ] + 第1階層の親フォルダカード (8個のみ) */
            <>
              {/* [ ALL DATA ] 全件表示カード */}
              <button
                onClick={() => {
                  setSelectedParent(null);
                  setSelectedSub(null);
                  onFolderSelect?.(null);
                }}
                className="flex items-center justify-between px-3 py-2 rounded border text-xs font-mono transition-all cursor-pointer shadow-xs bg-cyan-500 border-cyan-400 text-slate-950 font-black ring-2 ring-cyan-500/30"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Database size={14} className="text-slate-950" />
                  <span className="font-black truncate">[ ALL DATA ]</span>
                </div>
                <span className="ml-2 px-2 py-0.5 rounded text-[11px] font-mono font-black shrink-0 border bg-slate-950 text-white border-slate-800">
                  {locations.length}
                </span>
              </button>

              {/* 第1階層親フォルダ (8個) */}
              {hierarchicalData.map(parent => {
                const isDragOver = dragOverCardParent === parent.name;
                const isDragging = draggedCardParent === parent.name;
                return (
                  <button
                    key={parent.name}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', parent.name);
                      setDraggedCardParent(parent.name);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverCardParent !== parent.name) {
                        setDragOverCardParent(parent.name);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverCardParent === parent.name) {
                        setDragOverCardParent(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleCardParentDrop(parent.name);
                    }}
                    onDragEnd={() => {
                      setDraggedCardParent(null);
                      setDragOverCardParent(null);
                    }}
                    onClick={() => {
                      setSelectedParent(parent.name);
                      setSelectedSub(null);
                      onFolderSelect?.(parent.name);
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded border text-xs font-mono transition-all cursor-pointer shadow-xs bg-slate-900 border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/90 text-slate-300 hover:text-white ${
                      isDragOver ? 'ring-2 ring-cyan-400 border-cyan-400' : ''
                    } ${isDragging ? 'opacity-40' : ''}`}
                    title="クリックで開く / ドラッグでカテゴリー並べ替え"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <GripVertical size={12} className="text-slate-500 shrink-0 cursor-grab" />
                      <Folder size={14} className="text-slate-400 shrink-0" />
                      <span className="font-bold truncate" title={parent.name}>{parent.name}</span>
                    </div>
                    <span className="ml-2 px-2 py-0.5 rounded text-[11px] font-mono font-black shrink-0 border bg-slate-800 text-slate-300 border-slate-700/60">
                      {parent.totalCount}
                    </span>
                  </button>
                );
              })}
            </>
          ) : (
            /* [親フォルダ選択時] [ 親フォルダ すべて ] + その親に属するサブフォルダカード */
            <>
              {/* [ 親フォルダ すべて ] カード */}
              <button
                onClick={() => {
                  setSelectedSub(null);
                  onFolderSelect?.(selectedParent);
                }}
                className={`flex items-center justify-between px-3 py-2 rounded border text-xs font-mono transition-all cursor-pointer shadow-xs ${
                  selectedSub === null
                    ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-black ring-2 ring-cyan-500/30'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FolderOpen size={14} className={selectedSub === null ? 'text-slate-950' : 'text-slate-400'} />
                  <span className="font-black truncate">[ {selectedParent} すべて ]</span>
                </div>
                <span className={`ml-2 px-2 py-0.5 rounded text-[11px] font-mono font-black shrink-0 border ${
                  selectedSub === null
                    ? 'bg-slate-950 text-white border-slate-800'
                    : 'bg-slate-800 text-slate-300 border-slate-700/60'
                }`}>
                  {currentParentInfo?.totalCount || 0}
                </span>
              </button>

              {/* サブフォルダたち (第2階層 中間層) */}
              {currentParentInfo?.subFolders.map(sub => {
                const isSelected = selectedSub === sub.fullName;
                const isDragOver = dragOverCardSub === sub.name;
                const isDragging = draggedCardSub === sub.name;
                return (
                  <button
                    key={sub.fullName}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', sub.name);
                      setDraggedCardSub(sub.name);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverCardSub !== sub.name) {
                        setDragOverCardSub(sub.name);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverCardSub === sub.name) {
                        setDragOverCardSub(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleCardSubDrop(sub.name);
                    }}
                    onDragEnd={() => {
                      setDraggedCardSub(null);
                      setDragOverCardSub(null);
                    }}
                    onClick={() => {
                      const next = isSelected ? null : sub.fullName;
                      setSelectedSub(next);
                      onFolderSelect?.(next || selectedParent);
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded border text-xs font-mono transition-all cursor-pointer shadow-xs ${
                      isDragOver ? 'ring-2 ring-cyan-400 border-cyan-400' : ''
                    } ${isDragging ? 'opacity-40' : ''} ${
                      isSelected
                        ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-black ring-2 ring-cyan-500/30'
                        : 'bg-slate-900 border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/90 text-slate-300 hover:text-white'
                    }`}
                    title="クリックで選択 / ドラッグでサブカテゴリー並べ替え"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <GripVertical size={12} className={`shrink-0 cursor-grab ${isSelected ? 'text-slate-900' : 'text-slate-500'}`} />
                      <Folder size={14} className={isSelected ? 'text-slate-950' : 'text-slate-400'} />
                      <span className="font-bold truncate" title={sub.name}>{sub.name}</span>
                    </div>
                    <span className={`ml-2 px-2 py-0.5 rounded text-[11px] font-mono font-black shrink-0 border ${
                      isSelected
                        ? 'bg-slate-950 text-white border-slate-800'
                        : 'bg-slate-800 text-slate-300 border-slate-700/60'
                    }`}>
                      {sub.count}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* === 3. LIST TOOLBAR === */}
      <div className="px-4 py-1.5 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between gap-2 shrink-0 transition-colors overflow-x-auto select-none">
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-xs font-mono tracking-wider text-slate-400 shrink-0">
            <span className="font-black uppercase text-white">BOOKMARKS</span>
            <span className="mx-1 text-slate-500">|</span>
            <span>TOTAL: <strong className="text-cyan-600 dark:text-cyan-400 font-black">{filteredItems.length}</strong></span>
          </div>

          <div className="h-4 w-px hidden sm:block bg-slate-800 shrink-0" />

          {/* 新規登録ボタン */}
          <button
            onClick={onAddLocation}
            className="flex items-center gap-1.5 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-black font-black text-xs uppercase tracking-wider rounded shadow transition-colors cursor-pointer shrink-0"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span>+ ADD LOCATION</span>
          </button>

          {/* リスト文字サイズ調整スライダー */}
          {onUpdateListFontSize && (
            <>
              <div className="h-4 w-px hidden sm:block bg-slate-800 shrink-0" />
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono shrink-0">
                <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider shrink-0">TEXT:</span>
                <input
                  type="range"
                  min="10"
                  max="20"
                  step="1"
                  value={listFontSize}
                  onChange={(e) => onUpdateListFontSize(Number(e.target.value))}
                  style={{ width: '54px', minWidth: '54px', maxWidth: '54px' }}
                  className="solid-square-slider cursor-pointer shrink-0"
                  title={`リスト文字サイズ: ${listFontSize}px`}
                />
                <span className="text-cyan-400 font-bold text-[10px] shrink-0 w-6 text-right">{listFontSize}P</span>
              </div>
            </>
          )}
        </div>

        {/* 選択関連の一括アクション ＆ Kナビゲーター上下移動ボタン [ ⤊ ] [ ↑ ] [ ↓ ] [ ⤋ ] */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* 全選択ボタン */}
          <button
            onClick={toggleSelectAll}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded border transition-colors cursor-pointer ${
              isAllSelected 
                ? 'bg-cyan-500/20 border-cyan-500 text-white font-black'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {isAllSelected ? <CheckSquare size={13} className="text-cyan-600 dark:text-cyan-400" /> : <Square size={13} />}
            <span>{isAllSelected ? (language === 'jp' ? "全解除" : "DESELECT ALL") : (language === 'jp' ? "全選択" : "SELECT ALL")}</span>
          </button>

          {selectedIds.size > 0 && (
            <>
              {/* 選択件数バッジ */}
              <span className="text-xs font-mono font-black px-2 py-1 rounded border border-cyan-500/40 bg-cyan-500/20 text-white">
                {selectedIds.size}件選択中
              </span>

              {/* 選択解除ボタン */}
              <button
                onClick={() => setSelectedIds(new Set())}
                className="flex items-center gap-1 px-2 py-1 text-xs font-mono rounded border border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                title="選択を解除"
              >
                <X size={12} />
                <span>Cancel</span>
              </button>

              {/* === Kナビゲーターの上下移動ボタングループ [ ⤊ ] [ ↑ ] [ ↓ ] [ ⤋ ] === */}
              <div className="flex items-center border border-slate-700 bg-slate-900 rounded overflow-hidden shadow-xs">
                <button
                  onClick={moveSelectedToTop}
                  className="p-1.5 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-colors cursor-pointer"
                  title="選択した項目を最上部へ移動"
                >
                  <ChevronsUp size={14} />
                </button>
                <div className="w-px h-4 bg-slate-800" />
                <button
                  onClick={moveSelectedUp}
                  className="p-1.5 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-colors cursor-pointer"
                  title="選択した項目を1つ上へ移動"
                >
                  <ChevronUp size={14} />
                </button>
                <div className="w-px h-4 bg-slate-800" />
                <button
                  onClick={moveSelectedDown}
                  className="p-1.5 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-colors cursor-pointer"
                  title="選択した項目を1つ下へ移動"
                >
                  <ChevronDown size={14} />
                </button>
                <div className="w-px h-4 bg-slate-800" />
                <button
                  onClick={moveSelectedToBottom}
                  className="p-1.5 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-colors cursor-pointer"
                  title="選択した項目を最下部へ移動"
                >
                  <ChevronsDown size={14} />
                </button>
              </div>

              {/* 一括フォルダ移動 & コピー保存 */}
              <div className="flex items-center gap-1 border border-slate-700 bg-slate-900 rounded px-1.5 py-0.5">
                <select
                  value={bulkTargetFolder}
                  onChange={(e) => setBulkTargetFolder(e.target.value)}
                  className="bg-transparent text-xs outline-none pr-1 max-w-[140px] font-mono cursor-pointer text-slate-200"
                >
                  <option value="" className="bg-slate-900 text-slate-400">Move/Copy to...</option>
                  {allFolders.map(f => (
                    <option key={f} value={f} className="bg-slate-900 text-slate-200">{f}</option>
                  ))}
                </select>
                {onBulkCopy && (
                  <button
                    onClick={handleBulkCopy}
                    disabled={!bulkTargetFolder}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 disabled:opacity-40 disabled:pointer-events-none font-bold text-[10px] rounded transition-colors uppercase cursor-pointer flex items-center gap-1"
                    title="選択した項目を指定フォルダの一番上にコピーして保存"
                  >
                    <Copy size={11} />
                    <span>{language === 'jp' ? "コピー" : "COPY"}</span>
                  </button>
                )}
                <button
                  onClick={handleBulkMove}
                  disabled={!bulkTargetFolder}
                  className="px-2 py-0.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:pointer-events-none text-black font-bold text-[10px] rounded transition-colors uppercase cursor-pointer"
                >
                  {language === 'jp' ? "移動" : "MOVE"}
                </button>
              </div>

              {/* 一括タブ化 */}
              <button
                onClick={handleBulkTabs}
                className="flex items-center gap-1.5 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-black font-black text-xs uppercase tracking-wider rounded shadow transition-colors cursor-pointer"
                title="選択した項目を一括タブ化して開く"
              >
                <FolderOpen size={13} />
                <span>{language === 'jp' ? `タブ化 (${selectedIds.size})` : `TABS (${selectedIds.size})`}</span>
              </button>

              {/* 一括削除 */}
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase rounded transition-colors cursor-pointer shadow-xs"
                title="選択した項目を削除"
              >
                <Trash2 size={13} />
                <span>{language === 'jp' ? `削除 (${selectedIds.size})` : `DELETE (${selectedIds.size})`}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* === 4. LIST TABLE (境界線グリップハンドル付きリサイズ可能テーブル) === */}
      <div 
        onScroll={handleTableScroll}
        className="flex-1 overflow-y-auto overflow-x-auto min-h-0"
      >
        <table className="w-full text-left border-collapse font-sans text-xs table-fixed">
          {/* 列幅のcolgroup指定 */}
          <colgroup>
            <col style={{ width: '40px' }} />
            <col style={{ width: '40px' }} />
            <col style={{ width: `${colWidths.title}px` }} />
            <col style={{ width: `${colWidths.coords}px` }} />
            <col style={{ width: `${colWidths.dir}px` }} />
            <col style={{ width: '140px' }} />
          </colgroup>

          {/* テーブルヘッダー */}
          <thead className="sticky top-0 z-10 text-[10px] font-mono border-b border-slate-800 bg-slate-900 text-slate-400 uppercase tracking-widest select-none shadow-xs">
            <tr>
              <th className="py-2.5 px-2 w-10 text-center">GRIP</th>
              <th className="py-2.5 px-2 w-10 text-center">CHECK</th>
              
              {/* 1. NODE TITLE 列 (リサイズハンドル付き) */}
              <th className="py-2.5 px-3 relative group">
                <span className="truncate block pr-3">NODE TITLE (場所名)</span>
                {/* 境界線リサイズグリップハンドル */}
                <div
                  onMouseDown={(e) => handleResizeStart('title', e)}
                  className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors z-20"
                  title="ドラッグして列幅を調整"
                >
                  <div className="w-[2px] h-full bg-slate-700/60 group-hover:bg-cyan-400 transition-colors" />
                </div>
              </th>

              {/* 2. COORDINATES & INFO 列 (リサイズハンドル付き) */}
              <th className="py-2.5 px-3 relative group">
                <span className="truncate block pr-3">COORDINATES & INFO</span>
                {/* 境界線リサイズグリップハンドル */}
                <div
                  onMouseDown={(e) => handleResizeStart('coords', e)}
                  className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors z-20"
                  title="ドラッグして列幅を調整"
                >
                  <div className="w-[2px] h-full bg-slate-700/60 group-hover:bg-cyan-400 transition-colors" />
                </div>
              </th>

              {/* 3. DIRECTORY 列 (リサイズハンドル付き) */}
              <th className="py-2.5 px-3 relative group">
                <span className="truncate block pr-3">DIRECTORY</span>
                {/* 境界線リサイズグリップハンドル */}
                <div
                  onMouseDown={(e) => handleResizeStart('dir', e)}
                  className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors z-20"
                  title="ドラッグして列幅を調整"
                >
                  <div className="w-[2px] h-full bg-slate-700/60 group-hover:bg-cyan-400 transition-colors" />
                </div>
              </th>

              {/* 4. ACTIONS 列 (ゴミ箱など常に枠内に収まる固定幅140px) */}
              <th className="py-2.5 px-3 text-right w-[140px]">
                ACTIONS
              </th>
            </tr>
          </thead>

          {/* テーブルボディ */}
          <tbody className="divide-y divide-slate-800/80 font-mono">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-slate-400 font-mono text-xs">
                  {searchQuery ? "一致する場所が見つかりませんでした" : "このフォルダには場所が登録されていません"}
                </td>
              </tr>
            ) : (
              <>
                {displayedItems.map((item, index) => {
                const isSelected = selectedIds.has(item.id);
                const isDragging = draggedId === item.id;
                const isOver = dragOverId === item.id;
                const isEditing = editingItemId === item.id;
                const coords = (item.parsed.lat && item.parsed.lng) 
                  ? `${Number(item.parsed.lat).toFixed(5)}, ${Number(item.parsed.lng).toFixed(5)}`
                  : null;

                const shortUrl = formatShortUrl(item.url);

                return (
                  <tr
                    key={item.id}
                    draggable={!isEditing}
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragOver={(e) => handleDragOver(e, item.id)}
                    onDrop={(e) => handleDrop(e, item.id)}
                    onDragEnd={handleDragEnd}
                    className={`transition-colors group cursor-pointer ${
                      isSelected 
                        ? 'bg-cyan-500/15' 
                        : (index % 2 === 0 ? 'bg-slate-950' : 'bg-slate-900/60') + ' hover:bg-slate-800/80'
                    } ${isDragging ? 'opacity-30' : ''} ${isOver ? 'border-t-2 border-cyan-500' : ''}`}
                    onClick={() => {
                      if (!isEditing) {
                        onSelectLocation(item);
                      }
                    }}
                  >
                    {/* 1. ドラッグハンドル */}
                    <td 
                      className="py-2.5 px-2 text-center" 
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div 
                        className="cursor-grab active:cursor-grabbing p-1 inline-flex items-center justify-center rounded transition-colors text-slate-500 hover:text-cyan-400 hover:bg-slate-800"
                        title="ドラッグして並べ替え"
                      >
                        <GripVertical size={14} />
                      </div>
                    </td>

                    {/* 2. チェックボックス */}
                    <td 
                      className="py-2 px-2 text-center"
                      onClick={(e) => toggleSelectItem(item.id, e)}
                    >
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-cyan-600 focus:ring-0 focus:outline-none cursor-pointer"
                        />
                      </div>
                    </td>

                    {/* 3. タイトル (短縮URL表示＆インライン編集対応) */}
                    <td 
                      className="py-2.5 px-3 overflow-hidden"
                      onClick={(e) => {
                        if (isEditing) e.stopPropagation();
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="p-1 rounded shrink-0 border border-slate-700 bg-slate-800 text-slate-400 group-hover:text-cyan-400">
                          <MapPin size={13} />
                        </span>
                        
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editingTitleText}
                              onChange={(e) => setEditingTitleText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveInlineTitle(item);
                                if (e.key === 'Escape') setEditingItemId(null);
                              }}
                              className="px-2 py-1 rounded w-full focus:outline-none shadow-sm border border-cyan-500 bg-slate-900 text-slate-100"
                              style={{ fontSize: `${listFontSize}px` }}
                            />
                            <button
                              onClick={() => saveInlineTitle(item)}
                              className="p-1 bg-cyan-600 hover:bg-cyan-500 text-black rounded shrink-0 font-bold cursor-pointer"
                              title="保存"
                            >
                              <Check size={13} strokeWidth={3} />
                            </button>
                            <button
                              onClick={() => setEditingItemId(null)}
                              className="p-1 rounded shrink-0 cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-400"
                              title="キャンセル"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                            <div className="flex items-center gap-1.5">
                              <span 
                                className="font-bold truncate text-white group-hover:underline"
                                style={{ fontSize: `${listFontSize}px` }}
                                title={item.title}
                              >
                                {item.title}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingItemId(item.id);
                                  setEditingTitleText(item.title);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all shrink-0 cursor-pointer text-slate-400 hover:text-cyan-400 hover:bg-slate-800"
                                title="名前を直接編集"
                              >
                                <Edit2 size={11} />
                              </button>
                            </div>
                            {/* URL短縮表示 */}
                            <span 
                              className="text-[10px] truncate font-mono mt-0.5 text-slate-400"
                              title={item.url}
                            >
                              {shortUrl}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 4. 座標・撮影日 */}
                    <td className="py-2.5 px-3 overflow-hidden text-[11px] text-slate-400">
                      <div className="flex flex-col overflow-hidden">
                        {coords ? (
                          <span className="font-mono text-[11px] text-slate-300 truncate">{coords}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                        {item.capturedDate && (
                          <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold truncate">
                            📅 {item.capturedDate}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 5. フォルダ */}
                    <td 
                      className="py-2.5 px-3 overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          const folder = item.folderName || 'Unassigned';
                          const parts = folder.split(' / ');
                          setSelectedParent(parts[0].trim());
                          setSelectedSub(parts.length > 1 ? folder : null);
                          onFolderSelect?.(folder);
                        }}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] max-w-full truncate transition-colors cursor-pointer border border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-500 hover:text-cyan-400"
                        title="このフォルダで絞り込む"
                      >
                        <Folder size={11} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                        <span className="truncate">{item.folderName || 'Unassigned'}</span>
                      </button>
                    </td>

                    {/* 6. アクションボタン（枠外に出ないように右寄せ固定） */}
                    <td 
                      className="py-2.5 px-3 text-right overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            if (onOpenOrFocusTab) {
                              onOpenOrFocusTab(item);
                            } else {
                              onSelectLocation(item);
                            }
                          }}
                          className="p-1.5 rounded transition-colors cursor-pointer text-slate-400 hover:text-cyan-400 hover:bg-slate-800 shrink-0"
                          title={language === 'jp' ? "ストリートビューで表示 (既存タブまたは新規タブ)" : "Open in Street View (Existing or New Tab)"}
                        >
                          <Compass size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (onOpenInNewWindow) {
                              onOpenInNewWindow(item);
                            } else if (onOpenInNewTab) {
                              onOpenInNewTab(item);
                            } else {
                              openInCenteredWindow(item.url, 1920, 1100);
                            }
                          }}
                          className="p-1.5 rounded transition-colors cursor-pointer text-slate-400 hover:text-cyan-400 hover:bg-slate-800 shrink-0"
                          title={language === 'jp' ? "新しいウィンドウで開く (1920×1100 センター表示)" : "Open in new window (1920x1100 centered)"}
                        >
                          <ExternalLink size={14} />
                        </button>
                        <button
                          onClick={() => onEditLocation(item)}
                          className="p-1.5 rounded transition-colors cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
                          title="詳細設定を編集"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              title: language === 'jp' ? '場所の削除' : 'Delete Location',
                              message: language === 'jp' ? `「${item.title}」を削除しますか？` : `Delete "${item.title}"?`,
                              confirmText: language === 'jp' ? '削除' : 'Delete',
                              isDanger: true,
                              onConfirm: () => {
                                onDeleteLocation(item.id);
                                setConfirmModal(null);
                              }
                            });
                          }}
                          className="p-1.5 rounded transition-colors cursor-pointer text-slate-400 hover:text-red-400 hover:bg-red-950/40 shrink-0"
                          title="削除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleCount < filteredItems.length && (
                <tr>
                  <td colSpan={6} className="py-3 text-center text-slate-400 bg-slate-900/60 border-t border-slate-800/80">
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-xs font-mono text-slate-400">
                        {filteredItems.length} 件中 {displayedItems.length} 件を表示中（スクロールで自動展開）
                      </span>
                      <button
                        type="button"
                        onClick={() => setVisibleCount(filteredItems.length)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-bold underline px-2 py-0.5 rounded hover:bg-cyan-500/10 cursor-pointer transition-colors"
                      >
                        全件を一括表示
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </>
            )}
          </tbody>
        </table>
      </div>

      {/* === 5. BOTTOM STATUS BAR === */}
      <div className="px-5 py-2 border-t border-slate-800 bg-slate-900/90 text-[10px] font-mono flex items-center justify-between shrink-0 transition-colors text-slate-400">
        <div className="flex items-center gap-3">
          <span>{locations.length} TOTAL NODES</span>
          <span>•</span>
          <span>{allFolders.length} DIRECTORIES</span>
          {selectedIds.size > 0 && (
            <>
              <span>•</span>
              <span className="font-bold text-cyan-600 dark:text-cyan-400">{selectedIds.size} SELECTED</span>
            </>
          )}
        </div>
        <div className="text-slate-400">
          💡 列境界線をドラッグで幅変更 / 行ドラッグで並べ替え / [ ⤊ ][ ↑ ][ ↓ ][ ⤋ ]で一括移動
        </div>
      </div>

      {/* === 6. オリジナルカスタム確認ダイアログ (MODAL) === */}
      {confirmModal && confirmModal.isOpen && (
        <div 
          className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setConfirmModal(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-900 flex items-center gap-2">
              {confirmModal.isDanger ? (
                <Trash2 size={16} className="text-red-400 shrink-0" />
              ) : (
                <Folder size={16} className="text-cyan-400 shrink-0" />
              )}
              <h2 className="text-sm font-bold text-white tracking-wide">{confirmModal.title}</h2>
            </div>
            <div className="p-5 text-slate-200 text-xs whitespace-pre-line leading-relaxed">
              {confirmModal.message}
            </div>
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-md text-xs font-bold transition-colors cursor-pointer"
              >
                {confirmModal.cancelText || (language === 'jp' ? 'キャンセル' : 'Cancel')}
              </button>
              <button
                onClick={() => confirmModal.onConfirm()}
                className={`px-4 py-2 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  confirmModal.isDanger 
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30' 
                    : 'bg-cyan-600 hover:bg-cyan-500 text-black shadow-lg shadow-cyan-500/30'
                }`}
              >
                {confirmModal.confirmText || (language === 'jp' ? 'OK' : 'OK')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === 7. オリジナルカスタムプロンプト (MODAL) === */}
      {promptModal && promptModal.isOpen && (
        <div 
          className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPromptModal(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-900 flex items-center gap-2">
              <Edit2 size={16} className="text-cyan-400 shrink-0" />
              <h2 className="text-sm font-bold text-white tracking-wide">{promptModal.title}</h2>
            </div>
            <div className="p-5 text-slate-200 text-xs flex flex-col gap-3">
              <p className="whitespace-pre-line leading-relaxed">{promptModal.message}</p>
              <input
                type="text"
                value={promptInputVal}
                onChange={(e) => setPromptInputVal(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') promptModal.onConfirm(promptInputVal);
                  if (e.key === 'Escape') setPromptModal(null);
                }}
                className="w-full bg-slate-800 border border-cyan-500/80 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setPromptModal(null)}
                className="px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-md text-xs font-bold transition-colors cursor-pointer"
              >
                {language === 'jp' ? 'キャンセル' : 'Cancel'}
              </button>
              <button
                onClick={() => promptModal.onConfirm(promptInputVal)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-black rounded-md text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-cyan-500/30"
              >
                {language === 'jp' ? '変更する' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

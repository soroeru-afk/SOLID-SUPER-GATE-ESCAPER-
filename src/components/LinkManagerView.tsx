import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Folder, FolderOpen, MapPin, Search, Plus, Trash2, Edit2, 
  ExternalLink, Compass, GripVertical, 
  CheckSquare, Square, X, ChevronRight,
  Database, FolderEdit, FolderMinus,
  ChevronsUp, ChevronUp, ChevronDown, ChevronsDown,
  Check
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

interface LinkManagerViewProps {
  locations: LocationItem[];
  allFolders: string[];
  theme?: string;
  onSelectLocation: (loc: LocationItem) => void;
  onOpenInNewTab: (loc: LocationItem) => void;
  onEditLocation: (loc: LocationItem) => void;
  onDeleteLocation: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkMove: (ids: string[], targetFolder: string) => void;
  onOpenSelectedInTabs: (ids: string[]) => void;
  onReorderItems: (newLocs: LocationItem[]) => void;
  onUpdateItem: (updated: LocationItem) => void;
  onRenameFolder: (oldName: string, newName: string) => void;
  onDeleteFolder: (folderName: string) => void;
  onAddLocation: () => void;
  onCloseManager: () => void;
  language: 'jp' | 'en';
}

export const LinkManagerView: React.FC<LinkManagerViewProps> = ({
  locations,
  allFolders,
  onSelectLocation,
  onOpenInNewTab,
  onEditLocation,
  onDeleteLocation,
  onBulkDelete,
  onBulkMove,
  onOpenSelectedInTabs,
  onReorderItems,
  onUpdateItem,
  onRenameFolder,
  onDeleteFolder,
  onAddLocation,
  onCloseManager,
  language,
}) => {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [bulkTargetFolder, setBulkTargetFolder] = useState('');

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

  // フィルタリングされたアイテムリスト
  const filteredItems = useMemo(() => {
    let list = locations;
    if (selectedFolder !== null) {
      list = list.filter(loc => (loc.folderName || 'Unassigned') === selectedFolder);
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
  }, [locations, selectedFolder, searchQuery]);

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

  // === 複数選択された項目の上下移動（Kナビゲーター方式） ===
  const moveSelectedUp = () => {
    if (selectedIds.size === 0) return;
    const newItems = [...locations];
    for (let i = 1; i < newItems.length; i++) {
      if (selectedIds.has(newItems[i].id) && !selectedIds.has(newItems[i - 1].id)) {
        const temp = newItems[i];
        newItems[i] = newItems[i - 1];
        newItems[i - 1] = temp;
      }
    }
    onReorderItems(newItems);
  };

  const moveSelectedDown = () => {
    if (selectedIds.size === 0) return;
    const newItems = [...locations];
    for (let i = newItems.length - 2; i >= 0; i--) {
      if (selectedIds.has(newItems[i].id) && !selectedIds.has(newItems[i + 1].id)) {
        const temp = newItems[i];
        newItems[i] = newItems[i + 1];
        newItems[i + 1] = temp;
      }
    }
    onReorderItems(newItems);
  };

  const moveSelectedToTop = () => {
    if (selectedIds.size === 0) return;
    const selected: LocationItem[] = [];
    const unselected: LocationItem[] = [];
    for (const item of locations) {
      if (selectedIds.has(item.id)) {
        selected.push(item);
      } else {
        unselected.push(item);
      }
    }
    onReorderItems([...selected, ...unselected]);
  };

  const moveSelectedToBottom = () => {
    if (selectedIds.size === 0) return;
    const selected: LocationItem[] = [];
    const unselected: LocationItem[] = [];
    for (const item of locations) {
      if (selectedIds.has(item.id)) {
        selected.push(item);
      } else {
        unselected.push(item);
      }
    }
    onReorderItems([...unselected, ...selected]);
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

    const fromIndex = locations.findIndex(item => item.id === draggedId);
    const toIndex = locations.findIndex(item => item.id === targetId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const newItems = [...locations];
      const [movedItem] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, movedItem);
      onReorderItems(newItems);
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

  // 一括削除
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(language === 'jp' ? `選択した ${selectedIds.size} 件の場所を削除してもよろしいですか？` : `Delete ${selectedIds.size} selected locations?`)) {
      onBulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  // 一括タブ化
  const handleBulkTabs = () => {
    if (selectedIds.size === 0) return;
    onOpenSelectedInTabs(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  // フォルダ名変更
  const handleRenameCurrentFolder = () => {
    if (!selectedFolder) return;
    const newName = window.prompt(
      language === 'jp' ? `「${selectedFolder}」の新しいフォルダ名を入力してください` : `Enter new name for "${selectedFolder}"`,
      selectedFolder
    );
    if (newName && newName.trim() && newName.trim() !== selectedFolder) {
      onRenameFolder(selectedFolder, newName.trim());
      setSelectedFolder(newName.trim());
    }
  };

  // フォルダ削除
  const handleDeleteCurrentFolder = () => {
    if (!selectedFolder) return;
    if (window.confirm(
      language === 'jp' 
        ? `フォルダ「${selectedFolder}」および含まれるすべての場所 (${folderCounts[selectedFolder] || 0} 件) を削除しますか？`
        : `Delete folder "${selectedFolder}" and all its ${folderCounts[selectedFolder] || 0} locations?`
    )) {
      onDeleteFolder(selectedFolder);
      setSelectedFolder(null);
    }
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

          {/* パンくずナビゲーション */}
          <div className="hidden md:flex items-center gap-2 ml-4 pl-4 border-l border-slate-700/60 text-xs font-mono min-w-0 text-slate-400">
            <span className="font-bold uppercase shrink-0 text-slate-400">CURRENT DIR:</span>
            <button 
              onClick={() => setSelectedFolder(null)}
              className={`hover:underline font-black transition-colors shrink-0 cursor-pointer ${
                selectedFolder === null ? 'text-cyan-600 dark:text-cyan-400 underline' : 'text-slate-300'
              }`}
            >
              [ ALL DATA ]
            </button>
            {selectedFolder && (
              <>
                <ChevronRight size={14} className="text-slate-600" />
                <span className="font-bold px-2 py-0.5 rounded truncate max-w-[200px] border border-cyan-500/40 bg-cyan-500/20 text-white">
                  {selectedFolder}
                </span>

                {/* フォルダ操作ボタン */}
                <button
                  onClick={handleRenameCurrentFolder}
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-colors shrink-0 ml-1 border border-slate-700 hover:bg-slate-800 text-slate-300 cursor-pointer"
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
              </>
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

      {/* === 2. SUB-DIRECTORIES (Kナビゲーター風 等幅グリッド) === */}
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/60 shrink-0 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
            <Folder size={14} className="text-cyan-600 dark:text-cyan-400" />
            <span>CATEGORIES ({allFolders.length + 1})</span>
          </div>
          {selectedFolder && (
            <button
              onClick={() => setSelectedFolder(null)}
              className="text-[10px] font-mono underline font-black text-cyan-600 dark:text-cyan-400 hover:opacity-80 cursor-pointer"
            >
              {language === 'jp' ? "すべてのフォルダを表示" : "Show All Folders"}
            </button>
          )}
        </div>

        {/* 等幅グリッド配置（黒文字・高コントラスト対応） */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1">
          {/* [ ALL DATA ] 全件表示カード */}
          <button
            onClick={() => setSelectedFolder(null)}
            className={`flex items-center justify-between px-3 py-2 rounded border text-xs font-mono transition-all cursor-pointer shadow-xs ${
              selectedFolder === null
                ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-black ring-2 ring-cyan-500/30'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Database size={14} className={selectedFolder === null ? 'text-slate-950' : 'text-slate-400'} />
              <span className="font-black truncate">[ ALL DATA ]</span>
            </div>
            <span className={`ml-2 px-2 py-0.5 rounded text-[11px] font-mono font-black shrink-0 border ${
              selectedFolder === null
                ? 'bg-slate-950 text-white border-slate-800'
                : 'bg-slate-800 text-slate-300 border-slate-700/60'
            }`}>
              {locations.length}
            </span>
          </button>

          {/* 各フォルダカード */}
          {allFolders.map(folder => {
            const count = folderCounts[folder] || 0;
            const isSelected = selectedFolder === folder;
            return (
              <button
                key={folder}
                onClick={() => setSelectedFolder(isSelected ? null : folder)}
                className={`flex items-center justify-between px-3 py-2 rounded border text-xs font-mono transition-all cursor-pointer shadow-xs ${
                  isSelected
                    ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-black ring-2 ring-cyan-500/30'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Folder size={14} className={isSelected ? 'text-slate-950' : 'text-slate-400'} />
                  <span className="font-black truncate" title={folder}>{folder}</span>
                </div>
                <span className={`ml-2 px-2 py-0.5 rounded text-[11px] font-mono font-black shrink-0 border ${
                  isSelected
                    ? 'bg-slate-950 text-white border-slate-800'
                    : 'bg-slate-800 text-slate-300 border-slate-700/60'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* === 3. LIST TOOLBAR === */}
      <div className="px-5 py-2 border-b border-slate-800 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3 shrink-0 transition-colors">
        <div className="flex items-center gap-3">
          <div className="text-xs font-mono tracking-wider text-slate-400">
            <span className="font-black uppercase text-white">BOOKMARKS</span>
            <span className="mx-2 text-slate-500">|</span>
            <span>TOTAL RECS: <strong className="text-cyan-600 dark:text-cyan-400 font-black">{filteredItems.length}</strong></span>
          </div>

          <div className="h-4 w-px hidden sm:block bg-slate-800" />

          {/* 新規登録ボタン */}
          <button
            onClick={onAddLocation}
            className="flex items-center gap-1.5 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-black font-black text-xs uppercase tracking-wider rounded shadow transition-colors cursor-pointer"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span>+ ADD LOCATION</span>
          </button>
        </div>

        {/* 選択関連の一括アクション ＆ Kナビゲーター上下移動ボタン [ ⤊ ] [ ↑ ] [ ↓ ] [ ⤋ ] */}
        <div className="flex items-center gap-2 flex-wrap">
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

              {/* 一括フォルダ移動 (Move to...) */}
              <div className="flex items-center gap-1 border border-slate-700 bg-slate-900 rounded px-1.5 py-0.5">
                <select
                  value={bulkTargetFolder}
                  onChange={(e) => setBulkTargetFolder(e.target.value)}
                  className="bg-transparent text-xs outline-none pr-1 max-w-[140px] font-mono cursor-pointer text-slate-200"
                >
                  <option value="" className="bg-slate-900 text-slate-400">Move to...</option>
                  {allFolders.map(f => (
                    <option key={f} value={f} className="bg-slate-900 text-slate-200">{f}</option>
                  ))}
                </select>
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
      <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
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
              filteredItems.map((item, index) => {
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
                              className="text-xs px-2 py-1 rounded w-full focus:outline-none shadow-sm border border-cyan-500 bg-slate-900 text-slate-100"
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
                                className="font-bold truncate text-xs text-white group-hover:underline"
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
                        onClick={() => setSelectedFolder(item.folderName || 'Unassigned')}
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
                          onClick={() => onSelectLocation(item)}
                          className="p-1.5 rounded transition-colors cursor-pointer text-slate-400 hover:text-cyan-400 hover:bg-slate-800 shrink-0"
                          title="ストリートビューで表示"
                        >
                          <Compass size={14} />
                        </button>
                        <button
                          onClick={() => onOpenInNewTab(item)}
                          className="p-1.5 rounded transition-colors cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
                          title="新しいタブで開く"
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
                            if (window.confirm(language === 'jp' ? `「${item.title}」を削除しますか？` : `Delete "${item.title}"?`)) {
                              onDeleteLocation(item.id);
                            }
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
              })
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

    </div>
  );
};

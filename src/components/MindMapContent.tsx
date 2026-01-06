'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  NodeMouseHandler,
  EdgeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';

import WordNode from './WordNode';
import InputBox from './InputBox';
import HistoryPanel from './HistoryPanel';

// 常量配置
const RADIAL_RADIUS = 300;
const MAX_HISTORY_ITEMS = 50;
const CLICK_DELAY = 250;
const FIT_VIEW_PADDING = 0.2;
const FIT_VIEW_DURATION = 500;
const RETRY_DELAY = 100;

// 类型定义
interface WordData {
  chinese: string;
  english: string;
  detail?: string;
  hasDetail?: boolean;
}

interface HistoryItem {
  id: string;
  word: string;
  timestamp: Date;
  nodes: Node[];
  edges: Edge[];
}

const nodeTypes = {
  wordNode: WordNode,
};

// LocalStorage 键名
const STORAGE_KEYS = {
  HISTORY: 'mindmap_history',
  NODES: 'mindmap_nodes',
  EDGES: 'mindmap_edges',
};

function MindMapInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [loadingNodeId, setLoadingNodeId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const nodeIdCounter = useRef(0);
  const clickTimer = useRef<NodeJS.Timeout | null>(null);
  const { fitView, getNodes } = useReactFlow();

  // 从 localStorage 加载数据
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
      const savedNodes = localStorage.getItem(STORAGE_KEYS.NODES);
      const savedEdges = localStorage.getItem(STORAGE_KEYS.EDGES);

      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        setHistory(parsedHistory.map((item: HistoryItem) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        })));
      }

      if (savedNodes && savedEdges) {
        const parsedNodes = JSON.parse(savedNodes);
        const parsedEdges = JSON.parse(savedEdges);
        setNodes(parsedNodes);
        setEdges(parsedEdges);
        
        // 恢复节点 ID 计数器
        const maxId = parsedNodes.reduce((max: number, node: Node) => {
          const idNum = parseInt(node.id.replace('node-', ''));
          return idNum > max ? idNum : max;
        }, 0);
        nodeIdCounter.current = maxId;
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
  }, [setNodes, setEdges]);

  // 保存到 localStorage
  useEffect(() => {
    try {
      if (nodes.length > 0 || edges.length > 0) {
        localStorage.setItem(STORAGE_KEYS.NODES, JSON.stringify(nodes));
        localStorage.setItem(STORAGE_KEYS.EDGES, JSON.stringify(edges));
      }
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }, [nodes, edges]);

  useEffect(() => {
    try {
      if (history.length > 0) {
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
      }
    } catch (error) {
      console.error('Failed to save history to localStorage:', error);
    }
  }, [history]);

  // 错误提示自动消失
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const generateNodeId = () => {
    nodeIdCounter.current += 1;
    return `node-${nodeIdCounter.current}`;
  };

  // Get the path from root to a specific node
  const getNodePath = useCallback((nodeId: string): string[] => {
    const currentNodes = getNodes();
    const path: string[] = [];
    let currentId: string | null = nodeId;

    while (currentId) {
      const node = currentNodes.find(n => n.id === currentId);
      if (node) {
        path.unshift(node.data.chinese);
        const parentEdge = edges.find(e => e.target === currentId);
        currentId = parentEdge ? parentEdge.source : null;
      } else {
        break;
      }
    }

    return path;
  }, [edges, getNodes]);

  const calculateRadialPositions = useCallback(
    (
      centerX: number,
      centerY: number,
      count: number,
      radius: number = RADIAL_RADIUS,
      startAngle: number = 0
    ) => {
      const positions: { x: number; y: number }[] = [];
      const angleStep = (2 * Math.PI) / count;

      for (let i = 0; i < count; i++) {
        const angle = startAngle + i * angleStep;
        positions.push({
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        });
      }

      return positions;
    },
    []
  );

  // Double click to expand node or show detail
  const handleNodeDoubleClick: NodeMouseHandler = useCallback(async (event, node) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }

    if (loadingNodeId || isGenerating) return;

    // Get CURRENT position from ReactFlow state
    const currentNodes = getNodes();
    const currentNode = currentNodes.find(n => n.id === node.id);
    if (!currentNode) return;

    // 如果已经有详细内容，不再重复请求
    if (currentNode.data.detail) {
      return;
    }

    const currentX = currentNode.position.x;
    const currentY = currentNode.position.y;

    const parentPath = getNodePath(node.id);
    parentPath.pop();

    setLoadingNodeId(node.id);
    setIsGenerating(true);

    try {
      // 首先尝试获取详细内容（设置 10 秒超时）
      const detailController = new AbortController();
      const detailTimeout = setTimeout(() => detailController.abort(), 10000);

      try {
        const detailResponse = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'detail',
            word: currentNode.data.chinese,
            parentPath: parentPath.length > 0 ? parentPath : undefined,
          }),
          signal: detailController.signal,
        });

        clearTimeout(detailTimeout);

        if (detailResponse.ok) {
          const { hasDetail, detail } = await detailResponse.json();
          
          if (hasDetail && detail) {
            // 更新节点显示详细内容
            setNodes(nds => nds.map(n =>
              n.id === node.id
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      detail,
                      hasDetail: true,
                    }
                  }
                : n
            ));
            
            setLoadingNodeId(null);
            setIsGenerating(false);
            
            setTimeout(() => fitView({ padding: FIT_VIEW_PADDING, duration: FIT_VIEW_DURATION }), RETRY_DELAY);
            return;
          }
        }
      } catch (detailError) {
        clearTimeout(detailTimeout);
        // 如果获取详细内容失败，继续尝试生成子节点
        console.log('Detail fetch failed, falling back to child nodes:', detailError);
      }

      // 如果没有详细内容，继续生成子节点（设置 15 秒超时）
      const childController = new AbortController();
      const childTimeout = setTimeout(() => childController.abort(), 15000);

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: currentNode.data.chinese,
          parentPath: parentPath.length > 0 ? parentPath : undefined,
        }),
        signal: childController.signal,
      });

      clearTimeout(childTimeout);

      if (!response.ok) throw new Error('生成失败');

      const { words } = await response.json() as { words: WordData[] };

      // Check existing children to avoid overlap
      const existingChildEdges = edges.filter(e => e.source === node.id);
      const startAngle = existingChildEdges.length > 0
        ? Math.random() * Math.PI * 2
        : -Math.PI / 2;

      // Use CURRENT position and configured radius
      const positions = calculateRadialPositions(
        currentX,
        currentY,
        words.length,
        RADIAL_RADIUS,
        startAngle
      );

      const newNodes: Node[] = words.map((word, index) => ({
        id: generateNodeId(),
        type: 'wordNode',
        position: positions[index],
        data: {
          chinese: word.chinese,
          english: word.english,
          detail: word.detail,
          hasDetail: word.hasDetail,
          isSelected: false,
          isCenter: false,
          isLoading: false,
        },
      }));

      // Simple edge style - no animation
      const newEdges: Edge[] = newNodes.map(newNode => ({
        id: `edge-${node.id}-${newNode.id}`,
        source: node.id,
        target: newNode.id,
        type: 'default',
        style: { stroke: '#666', strokeWidth: 1.5 },
      }));

      setNodes(nds => [...nds, ...newNodes]);
      setEdges(eds => [...eds, ...newEdges]);

      const historyItem: HistoryItem = {
        id: generateNodeId(),
        word: currentNode.data.chinese,
        timestamp: new Date(),
        nodes: [...currentNodes, ...newNodes],
        edges: [...edges, ...newEdges],
      };
      setHistory(prev => [historyItem, ...prev.slice(0, MAX_HISTORY_ITEMS - 1)]);

      setTimeout(() => fitView({ padding: FIT_VIEW_PADDING, duration: FIT_VIEW_DURATION }), RETRY_DELAY);

    } catch (error) {
      console.error('Failed to generate:', error);
      let errorMsg = '操作失败';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMsg = '请求超时，请重试';
        } else {
          errorMsg = error.message;
        }
      }
      
      setErrorMessage(errorMsg);
    } finally {
      setLoadingNodeId(null);
      setIsGenerating(false);
    }
  }, [edges, loadingNodeId, isGenerating, setNodes, setEdges, fitView, getNodePath, getNodes, calculateRadialPositions]);

  // Single click to edit
  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      return;
    }

    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;

      if (event.shiftKey) {
        setSelectedNodeIds(prev => {
          if (prev.includes(node.id)) {
            return prev.filter(id => id !== node.id);
          } else {
            return [...prev, node.id];
          }
        });

        setNodes(nds => nds.map(n => ({
          ...n,
          data: {
            ...n.data,
            isSelected: n.id === node.id ? !n.data.isSelected : n.data.isSelected,
          }
        })));
      } else {
        setEditingNodeId(node.id);
        setEditText(node.data.chinese);
      }
    }, CLICK_DELAY);
  }, [setNodes]);

  // Right click for selection
  const onNodeContextMenu: NodeMouseHandler = useCallback((event, node) => {
    event.preventDefault();
    setSelectedNodeIds(prev => {
      if (prev.includes(node.id)) {
        return prev.filter(id => id !== node.id);
      } else {
        return [...prev, node.id];
      }
    });

    setNodes(nds => nds.map(n => ({
      ...n,
      data: {
        ...n.data,
        isSelected: n.id === node.id ? !n.data.isSelected : n.data.isSelected,
      }
    })));
  }, [setNodes]);

  // Click edge to delete it
  const onEdgeClick: EdgeMouseHandler = useCallback((event, edge) => {
    if (confirm('删除这条连线？')) {
      setEdges(eds => eds.filter(e => e.id !== edge.id));
    }
  }, [setEdges]);

  // Save edited node
  const handleSaveEdit = useCallback(() => {
    if (editingNodeId && editText.trim()) {
      setNodes(nds => nds.map(n =>
        n.id === editingNodeId
          ? { ...n, data: { ...n.data, chinese: editText.trim() } }
          : n
      ));
    }
    setEditingNodeId(null);
    setEditText('');
  }, [editingNodeId, editText, setNodes]);

  const handleCancelEdit = useCallback(() => {
    setEditingNodeId(null);
    setEditText('');
  }, []);

  // Delete node and its children
  const handleDeleteNode = useCallback(() => {
    if (!editingNodeId) return;

    const nodesToDelete = new Set<string>([editingNodeId]);
    let changed = true;
    while (changed) {
      changed = false;
      edges.forEach(edge => {
        if (nodesToDelete.has(edge.source) && !nodesToDelete.has(edge.target)) {
          nodesToDelete.add(edge.target);
          changed = true;
        }
      });
    }

    setNodes(nds => nds.filter(n => !nodesToDelete.has(n.id)));
    setEdges(eds => eds.filter(e => !nodesToDelete.has(e.source) && !nodesToDelete.has(e.target)));
    setEditingNodeId(null);
    setEditText('');
  }, [editingNodeId, edges, setNodes, setEdges]);

  const handleInputSubmit = useCallback(async (word: string) => {
    const currentNodes = getNodes();
    let centerX = 0;
    let centerY = 0;

    if (selectedNodeIds.length > 0) {
      const selectedNodes = currentNodes.filter(n => selectedNodeIds.includes(n.id));
      const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length;
      const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length;
      centerX = avgX + 250;
      centerY = avgY;
    } else if (currentNodes.length > 0) {
      const maxX = Math.max(...currentNodes.map(n => n.position.x));
      centerX = maxX + 350;
      centerY = 0;
    }

    const newNodeId = generateNodeId();
    const newNode: Node = {
      id: newNodeId,
      type: 'wordNode',
      position: { x: centerX, y: centerY },
      data: {
        chinese: word,
        english: '',
        isSelected: false,
        isCenter: true,
        isLoading: false,
      },
    };

    // Simple edge style - yellow for user-created connections
    const newEdges: Edge[] = selectedNodeIds.map(selectedId => ({
      id: `edge-${selectedId}-${newNodeId}`,
      source: selectedId,
      target: newNodeId,
      type: 'default',
      style: { stroke: '#FFD700', strokeWidth: 2 },
    }));

    setNodes(nds => [
      ...nds.map(n => ({ ...n, data: { ...n.data, isSelected: false } })),
      newNode
    ]);
    setEdges(eds => [...eds, ...newEdges]);
    setSelectedNodeIds([]);

    setTimeout(() => {
      fitView({ padding: FIT_VIEW_PADDING, duration: FIT_VIEW_DURATION });
    }, RETRY_DELAY);
  }, [selectedNodeIds, setNodes, setEdges, fitView, getNodes]);

  const handleGenerateSummary = useCallback(async () => {
    const currentNodes = getNodes();
    if (currentNodes.length === 0) {
      setErrorMessage('请先添加一些概念节点');
      return;
    }

    setIsSummarizing(true);
    setShowSummary(true);
    setSummary('');

    try {
      const allNodes = currentNodes.map(n => ({
        chinese: n.data.chinese,
        english: n.data.english || '',
      }));

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'summarize', allNodes }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '生成失败');
      }

      const { summary: summaryText } = await response.json();
      setSummary(summaryText);
    } catch (error) {
      console.error('Failed to generate summary:', error);
      const errorMsg = error instanceof Error ? error.message : '生成总结失败';
      setSummary(`生成失败: ${errorMsg}`);
      setErrorMessage(errorMsg);
    } finally {
      setIsSummarizing(false);
    }
  }, [getNodes]);

  const handleHistorySelect = useCallback((historyId: string) => {
    const item = history.find(h => h.id === historyId);
    if (item) {
      setNodes(item.nodes);
      setEdges(item.edges);
      setSelectedNodeIds([]);
      setTimeout(() => fitView({ padding: FIT_VIEW_PADDING, duration: FIT_VIEW_DURATION }), RETRY_DELAY);
    }
  }, [history, setNodes, setEdges, fitView]);

  const handleHistoryClear = useCallback(() => {
    if (confirm('确定要清空所有历史记录吗？')) {
      setHistory([]);
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
    }
  }, []);

  const handleClearAll = useCallback(() => {
    if (confirm('确定要清空整个画布吗？此操作不可恢复。')) {
      setNodes([]);
      setEdges([]);
      setSelectedNodeIds([]);
      nodeIdCounter.current = 0;
      localStorage.removeItem(STORAGE_KEYS.NODES);
      localStorage.removeItem(STORAGE_KEYS.EDGES);
    }
  }, [setNodes, setEdges]);

  return (
    <div className="w-screen h-screen bg-white relative">
      <ReactFlow
        nodes={nodes.map(n => ({
          ...n,
          data: {
            ...n.data,
            isLoading: n.id === loadingNodeId,
          }
        }))}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: 'default',
          style: { stroke: '#666', strokeWidth: 1.5 },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e5e5" />
      </ReactFlow>

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div
              className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center animate-pulse"
              style={{
                background: 'linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(255,193,7,0.1) 100%)',
                border: '2px solid rgba(255,215,0,0.3)',
              }}
            >
              <svg className="w-12 h-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">知识图谱探索</h2>
            <p className="text-gray-500">在下方输入一个概念，开始构建知识网络</p>
          </div>
        </div>
      )}

      {nodes.length > 0 && (
        <div className="fixed top-4 left-4 z-50 flex gap-2">
          <button
            onClick={handleGenerateSummary}
            disabled={isSummarizing}
            className="
              px-4 py-2 rounded-full font-medium text-sm
              transition-all duration-200
              bg-yellow-400 text-black hover:bg-yellow-500
              hover:scale-105 active:scale-95
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center gap-2
            "
            style={{ boxShadow: '0 4px 16px rgba(255,215,0,0.3)' }}
          >
            {isSummarizing ? (
              <>
                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                生成总结
              </>
            )}
          </button>
          <button
            onClick={handleClearAll}
            className="
              px-4 py-2 rounded-full font-medium text-sm
              transition-all duration-200
              bg-gray-200 text-gray-700 hover:bg-gray-300
              hover:scale-105 active:scale-95
            "
          >
            清空画布
          </button>
        </div>
      )}

      <HistoryPanel
        history={history}
        onSelect={handleHistorySelect}
        onClear={handleHistoryClear}
      />

      <InputBox onSubmit={handleInputSubmit} disabled={isGenerating} />

      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 text-center text-sm text-gray-400">
        <p>单击编辑 • 双击展开/查看详情 • 右键选中 • 点击连线可删除</p>
      </div>

      {/* 加载中提示 */}
      {loadingNodeId && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div
            className="px-6 py-3 rounded-full bg-blue-500 text-white font-medium shadow-lg flex items-center gap-3"
          >
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>AI 思考中...</span>
            <button
              onClick={() => {
                setLoadingNodeId(null);
                setIsGenerating(false);
              }}
              className="ml-2 hover:bg-blue-600 rounded-full p-1 transition-colors"
              aria-label="取消"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {errorMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div
            className="px-6 py-3 rounded-full bg-red-500 text-white font-medium shadow-lg flex items-center gap-2"
            role="alert"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {errorMessage}
            <button
              onClick={() => setErrorMessage(null)}
              className="ml-2 hover:bg-red-600 rounded-full p-1"
              aria-label="关闭"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingNodeId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]">
          <div
            className="bg-white rounded-2xl p-6 w-80"
            style={{ boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}
          >
            <h3 className="text-lg font-bold text-gray-800 mb-4">编辑节点</h3>
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              autoFocus
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                className="flex-1 px-4 py-2 bg-yellow-400 text-black rounded-lg hover:bg-yellow-500 transition-colors font-medium"
              >
                保存
              </button>
              <button
                onClick={handleDeleteNode}
                className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
              >
                删除
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            style={{ boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">思路框架总结</h2>
              <button
                onClick={() => setShowSummary(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {isSummarizing ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-gray-500">正在分析您的知识图谱...</p>
                </div>
              ) : (
                <div className="prose prose-gray max-w-none">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: summary
                        .replace(/\n/g, '<br/>')
                        .replace(/#{3}\s(.+)/g, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
                        .replace(/#{2}\s(.+)/g, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
                        .replace(/#{1}\s(.+)/g, '<h1 class="text-2xl font-bold mt-6 mb-3">$1</h1>')
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>')
                        .replace(/^-\s(.+)/gm, '<li class="ml-4">$1</li>')
                        .replace(/^\d+\.\s(.+)/gm, '<li class="ml-4 list-decimal">$1</li>')
                    }}
                  />
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(summary);
                  alert('已复制到剪贴板');
                }}
                disabled={isSummarizing || !summary}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                复制内容
              </button>
              <button
                onClick={() => setShowSummary(false)}
                className="px-4 py-2 rounded-lg bg-yellow-400 text-black hover:bg-yellow-500 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MindMapContent() {
  return (
    <ReactFlowProvider>
      <MindMapInner />
    </ReactFlowProvider>
  );
}

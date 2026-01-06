'use client';

import { useCallback, useState, useRef } from 'react';
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
} from 'reactflow';
import 'reactflow/dist/style.css';

import WordNode from './WordNode';
import InputBox from './InputBox';
import HistoryPanel from './HistoryPanel';

interface WordData {
  chinese: string;
  english: string;
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

function MindMapInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [loadingNodeId, setLoadingNodeId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const nodeIdCounter = useRef(0);
  const { fitView } = useReactFlow();

  const generateNodeId = () => {
    nodeIdCounter.current += 1;
    return `node-${nodeIdCounter.current}`;
  };

  const calculateRadialPositions = (
    centerX: number,
    centerY: number,
    count: number,
    radius: number,
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
  };

  const onNodeClick: NodeMouseHandler = useCallback(async (event, node) => {
    if (loadingNodeId || isGenerating) return;

    setLoadingNodeId(node.id);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: node.data.chinese }),
      });

      if (!response.ok) throw new Error('生成失败');

      const { words } = await response.json() as { words: WordData[] };

      const existingChildEdges = edges.filter(e => e.source === node.id);
      const startAngle = existingChildEdges.length > 0
        ? Math.random() * Math.PI * 2
        : -Math.PI / 2;

      const positions = calculateRadialPositions(
        node.position.x,
        node.position.y,
        words.length,
        200,
        startAngle
      );

      const newNodes: Node[] = words.map((word, index) => ({
        id: generateNodeId(),
        type: 'wordNode',
        position: positions[index],
        data: {
          chinese: word.chinese,
          english: word.english,
          isSelected: false,
          isCenter: false,
          isLoading: false,
        },
      }));

      const newEdges: Edge[] = newNodes.map(newNode => ({
        id: `edge-${node.id}-${newNode.id}`,
        source: node.id,
        target: newNode.id,
        type: 'default',
        animated: true,
        style: { stroke: '#000', strokeWidth: 2 },
      }));

      setNodes(nds => [...nds, ...newNodes]);
      setEdges(eds => [...eds, ...newEdges]);

      const historyItem: HistoryItem = {
        id: generateNodeId(),
        word: node.data.chinese,
        timestamp: new Date(),
        nodes: [...nodes, ...newNodes],
        edges: [...edges, ...newEdges],
      };
      setHistory(prev => [historyItem, ...prev.slice(0, 49)]);

      setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 100);

    } catch (error) {
      console.error('Failed to generate:', error);
      alert('生成关联词失败，请重试');
    } finally {
      setLoadingNodeId(null);
      setIsGenerating(false);
    }
  }, [nodes, edges, loadingNodeId, isGenerating, setNodes, setEdges, fitView]);

  const onNodeContextMenu: NodeMouseHandler = useCallback((event, node) => {
    event.preventDefault();
    setSelectedNodeIds(prev => {
      if (prev.includes(node.id)) {
        return prev.filter(id => id !== node.id);
      } else {
        return [...prev, node.id];
      }
    });

    // Update node appearance
    setNodes(nds => nds.map(n => ({
      ...n,
      data: {
        ...n.data,
        isSelected: n.id === node.id ? !n.data.isSelected : n.data.isSelected,
      }
    })));
  }, [setNodes]);

  const handleInputSubmit = useCallback(async (word: string) => {
    let centerX = 0;
    let centerY = 0;

    if (selectedNodeIds.length > 0) {
      const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
      const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length;
      const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length;
      centerX = avgX + 200;
      centerY = avgY;
    } else if (nodes.length > 0) {
      const maxX = Math.max(...nodes.map(n => n.position.x));
      centerX = maxX + 300;
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

    const newEdges: Edge[] = selectedNodeIds.map(selectedId => ({
      id: `edge-${selectedId}-${newNodeId}`,
      source: selectedId,
      target: newNodeId,
      type: 'default',
      animated: true,
      style: { stroke: '#FFD700', strokeWidth: 2 },
    }));

    // Clear selection
    setNodes(nds => [
      ...nds.map(n => ({ ...n, data: { ...n.data, isSelected: false } })),
      newNode
    ]);
    setEdges(eds => [...eds, ...newEdges]);
    setSelectedNodeIds([]);

    setTimeout(() => {
      fitView({ padding: 0.2, duration: 500 });
    }, 100);
  }, [nodes, selectedNodeIds, setNodes, setEdges, fitView]);

  const handleHistorySelect = useCallback((historyId: string) => {
    const item = history.find(h => h.id === historyId);
    if (item) {
      setNodes(item.nodes);
      setEdges(item.edges);
      setSelectedNodeIds([]);
      setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 100);
    }
  }, [history, setNodes, setEdges, fitView]);

  const handleHistoryClear = useCallback(() => {
    setHistory([]);
  }, []);

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
        onNodeContextMenu={onNodeContextMenu}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        proOptions={{ hideAttribution: true }}
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
            <h2 className="text-2xl font-bold text-gray-800 mb-2">创意发散思维</h2>
            <p className="text-gray-500">在下方输入一个词语，开始你的创意之旅</p>
          </div>
        </div>
      )}

      <HistoryPanel
        history={history}
        onSelect={handleHistorySelect}
        onClear={handleHistoryClear}
      />

      <InputBox onSubmit={handleInputSubmit} disabled={isGenerating} />

      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 text-center text-sm text-gray-400">
        <p>点击节点发散 • 右键选中 • 选中后输入可连接</p>
      </div>
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

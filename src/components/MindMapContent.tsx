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
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
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

  const handleNodeClick = useCallback(async (nodeId: string) => {
    if (loadingNodes.has(nodeId) || isGenerating) return;

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setLoadingNodes(prev => new Set(prev).add(nodeId));
    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: node.data.chinese }),
      });

      if (!response.ok) throw new Error('生成失败');

      const { words } = await response.json() as { words: WordData[] };

      const existingChildEdges = edges.filter(e => e.source === nodeId);
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
          onClick: () => {},
          onRightClick: () => {},
        },
      }));

      const newEdges: Edge[] = newNodes.map(newNode => ({
        id: `edge-${nodeId}-${newNode.id}`,
        source: nodeId,
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

    } catch (error) {
      console.error('Failed to generate:', error);
      alert('生成关联词失败，请重试');
    } finally {
      setLoadingNodes(prev => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
      setIsGenerating(false);
    }
  }, [nodes, edges, loadingNodes, isGenerating, setNodes, setEdges]);

  const handleNodeRightClick = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setNodes(nds =>
      nds.map(node => ({
        ...node,
        data: {
          ...node.data,
          isSelected: selectedNodes.has(node.id),
          isLoading: loadingNodes.has(node.id),
          onClick: () => handleNodeClick(node.id),
          onRightClick: (e: React.MouseEvent) => handleNodeRightClick(node.id, e),
        },
      }))
    );
  }, [selectedNodes, loadingNodes, handleNodeClick, handleNodeRightClick, setNodes]);

  const handleInputSubmit = useCallback(async (word: string) => {
    const selectedNodesList = nodes.filter(n => selectedNodes.has(n.id));

    let centerX = 0;
    let centerY = 0;

    if (selectedNodesList.length > 0) {
      const avgX = selectedNodesList.reduce((sum, n) => sum + n.position.x, 0) / selectedNodesList.length;
      const avgY = selectedNodesList.reduce((sum, n) => sum + n.position.y, 0) / selectedNodesList.length;
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
        onClick: () => {},
        onRightClick: () => {},
      },
    };

    const newEdges: Edge[] = selectedNodesList.map(selectedNode => ({
      id: `edge-${selectedNode.id}-${newNodeId}`,
      source: selectedNode.id,
      target: newNodeId,
      type: 'default',
      animated: true,
      style: { stroke: '#FFD700', strokeWidth: 2 },
    }));

    setNodes(nds => [...nds, newNode]);
    setEdges(eds => [...eds, ...newEdges]);
    setSelectedNodes(new Set());

    setTimeout(() => {
      fitView({ padding: 0.2, duration: 500 });
    }, 100);
  }, [nodes, selectedNodes, setNodes, setEdges, fitView]);

  const handleHistorySelect = useCallback((historyId: string) => {
    const item = history.find(h => h.id === historyId);
    if (item) {
      setNodes(item.nodes);
      setEdges(item.edges);
      setSelectedNodes(new Set());
      setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 100);
    }
  }, [history, setNodes, setEdges, fitView]);

  const handleHistoryClear = useCallback(() => {
    setHistory([]);
  }, []);

  return (
    <div className="w-screen h-screen bg-white relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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

'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

export interface WordNodeData {
  chinese: string;
  english: string;
  isSelected: boolean;
  isCenter: boolean;
  isLoading: boolean;
  detail?: string; // 详细内容（公式、定义等）
  hasDetail?: boolean; // 是否有详细内容
}

function WordNode({ data }: NodeProps<WordNodeData>) {
  const { chinese, english, isSelected, isCenter, isLoading, detail, hasDetail } = data;

  // 如果有详细内容，使用矩形卡片样式
  if (detail) {
    const maxWidth = 400;
    const minWidth = 250;
    const maxHeight = 400;
    
    return (
      <>
        <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
        <div
          className={`
            relative cursor-pointer select-none
            transition-all duration-200 ease-out
            ${isLoading ? 'animate-pulse' : ''}
            rounded-2xl overflow-hidden
          `}
          style={{
            minWidth: minWidth,
            maxWidth: maxWidth,
            maxHeight: maxHeight,
            background: isSelected
              ? 'linear-gradient(135deg, #FFD700 0%, #FFC107 100%)'
              : 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: isSelected
              ? '2px solid #FFD700'
              : '2px solid rgba(0,0,0,0.08)',
            boxShadow: isSelected
              ? '0 12px 40px rgba(255,215,0,0.4), inset 0 2px 4px rgba(255,255,255,0.6)'
              : '0 12px 40px rgba(0,0,0,0.12), inset 0 2px 4px rgba(255,255,255,0.6)',
          }}
        >
          <div 
            className="p-5 overflow-y-auto custom-scrollbar" 
            style={{ 
              maxHeight: maxHeight,
            }}
          >
            <div className={`text-lg font-bold mb-3 ${isSelected ? 'text-black' : 'text-gray-900'}`}>
              {chinese}
            </div>
            {english && (
              <div className={`text-xs mb-3 font-medium ${isSelected ? 'text-gray-700' : 'text-gray-600'}`}>
                {english}
              </div>
            )}
            <div 
              className={`text-sm leading-relaxed whitespace-pre-wrap ${isSelected ? 'text-gray-900' : 'text-gray-800'}`}
              style={{
                fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
                wordBreak: 'break-word',
              }}
            >
              {detail}
            </div>
          </div>
          {isLoading && (
            <div
              className="absolute inset-0 rounded-2xl animate-ping pointer-events-none"
              style={{
                border: '2px solid #FFD700',
                opacity: 0.5,
              }}
            />
          )}
        </div>
        <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      </>
    );
  }

  // 原有的圆形节点样式
  const size = isCenter || isSelected ? 140 : 110;
  const fontSize = isCenter || isSelected ? 'text-lg' : 'text-base';
  const englishFontSize = isCenter || isSelected ? 'text-sm' : 'text-xs';

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div
        className={`
          relative flex flex-col items-center justify-center
          rounded-full cursor-pointer select-none
          transition-all duration-300 ease-out
          hover:scale-105 active:scale-95
          ${isLoading ? 'animate-pulse' : ''}
        `}
        style={{
          width: size,
          height: size,
          background: isSelected
            ? 'linear-gradient(135deg, #FFD700 0%, #FFC107 100%)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: isSelected
            ? '2px solid #FFD700'
            : '1px solid rgba(0,0,0,0.1)',
          boxShadow: isSelected
            ? '0 8px 32px rgba(255,215,0,0.3), inset 0 2px 4px rgba(255,255,255,0.5)'
            : '0 8px 32px rgba(0,0,0,0.1), inset 0 2px 4px rgba(255,255,255,0.5)',
        }}
      >
        <div
          className={`${fontSize} font-bold text-center px-3 leading-tight ${isSelected ? 'text-black' : 'text-gray-800'}`}
          style={{
            maxWidth: size - 20,
            wordBreak: 'break-word',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {chinese}
        </div>
        {english && (
          <div
            className={`${englishFontSize} mt-1 text-center px-2 ${isSelected ? 'text-gray-700' : 'text-gray-500'}`}
            style={{
              maxWidth: size - 16,
              wordBreak: 'break-word',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {english}
          </div>
        )}
        
        {/* 显示有详细内容的指示器 */}
        {hasDetail && (
          <div
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center"
            style={{
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.5)',
            }}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}

        {isLoading && (
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{
              border: '2px solid #FFD700',
              opacity: 0.5,
            }}
          />
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </>
  );
}

export default memo(WordNode);

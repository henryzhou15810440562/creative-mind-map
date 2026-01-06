'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion } from 'framer-motion';

export interface WordNodeData {
  chinese: string;
  english: string;
  isSelected: boolean;
  isCenter: boolean;
  isLoading: boolean;
  onClick: () => void;
  onRightClick: (e: React.MouseEvent) => void;
}

function WordNode({ data }: NodeProps<WordNodeData>) {
  const { chinese, english, isSelected, isCenter, isLoading, onClick, onRightClick } = data;

  const size = isCenter || isSelected ? 140 : 110;
  const fontSize = isCenter || isSelected ? 'text-lg' : 'text-base';
  const englishFontSize = isCenter || isSelected ? 'text-sm' : 'text-xs';

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className={`
          relative flex flex-col items-center justify-center
          rounded-full cursor-pointer select-none
          transition-all duration-300 ease-out
          ${isLoading ? 'breathing pulse-ring' : ''}
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
        onClick={onClick}
        onContextMenu={onRightClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
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

        {isLoading && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              border: '2px solid #FFD700',
            }}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </motion.div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </>
  );
}

export default memo(WordNode);

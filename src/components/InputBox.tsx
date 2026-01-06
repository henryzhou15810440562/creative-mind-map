'use client';

import { useState, KeyboardEvent } from 'react';
import { motion } from 'framer-motion';

interface InputBoxProps {
  onSubmit: (word: string) => void;
  disabled?: boolean;
}

export default function InputBox({ onSubmit, disabled = false }: InputBoxProps) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && !disabled) {
      onSubmit(trimmed);
      setValue('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.2 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
    >
      <div
        className="flex items-center gap-2 px-6 py-3 rounded-full glass-dark"
        style={{
          background: 'rgba(0, 0, 0, 0.08)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入词语，开始发散思维..."
          disabled={disabled}
          className="
            w-64 md:w-80 bg-transparent outline-none
            text-gray-800 placeholder-gray-400
            text-base
          "
        />
        <motion.button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`
            px-5 py-2 rounded-full font-medium text-sm
            transition-all duration-200
            ${disabled || !value.trim()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-black text-white hover:bg-gray-800'
            }
          `}
        >
          {disabled ? (
            <span className="flex items-center gap-2">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"
              />
              生成中
            </span>
          ) : (
            '发散'
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

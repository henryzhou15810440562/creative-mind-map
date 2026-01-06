'use client';

import dynamic from 'next/dynamic';

const MindMapContent = dynamic(() => import('./MindMapContent'), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-yellow-400 border-t-transparent animate-spin" />
        <p className="text-gray-500">加载中...</p>
      </div>
    </div>
  ),
});

export default function MindMap() {
  return <MindMapContent />;
}

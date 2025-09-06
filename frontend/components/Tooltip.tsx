'use client';

interface TooltipProps {
  content: string;
  position: { x: number; y: number };
  visible: boolean;
}

export default function Tooltip({ content, position, visible }: TooltipProps) {
  if (!visible || !content) return null;

  return (
    <div
      className='tooltip show'
      style={{
        left: position.x,
        top: position.y,
        transform: 'translateX(-50%) translateY(-100%)',
      }}>
      {content}
    </div>
  );
}

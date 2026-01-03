import { useState, useRef, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Trash2 } from "lucide-react";

interface SwipeableCardProps {
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
  className?: string;
}

export const SwipeableCard = ({
  children,
  onEdit,
  onDelete,
  onClick,
  className = "",
}: SwipeableCardProps) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const ACTION_WIDTH = 70;
  const THRESHOLD = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = translateX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const diff = e.touches[0].clientX - startXRef.current;
    let newTranslate = currentXRef.current + diff;
    
    // Limit swipe range
    if (newTranslate > 0) newTranslate = 0;
    if (newTranslate < -ACTION_WIDTH * 2) newTranslate = -ACTION_WIDTH * 2;
    
    setTranslateX(newTranslate);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    
    // Snap to action buttons or back
    if (translateX < -THRESHOLD) {
      setTranslateX(-ACTION_WIDTH * 2);
    } else {
      setTranslateX(0);
    }
  };

  const handleClick = () => {
    if (translateX !== 0) {
      setTranslateX(0);
      return;
    }
    onClick?.();
  };

  const handleEdit = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setTranslateX(0);
    onEdit?.();
  };

  const handleDelete = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setTranslateX(0);
    onDelete?.();
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Background action buttons */}
      <div className="absolute inset-y-0 right-0 flex">
        <button
          onClick={handleEdit}
          className="w-[70px] h-full bg-primary flex items-center justify-center text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Pencil className="h-5 w-5" />
        </button>
        <button
          onClick={handleDelete}
          className="w-[70px] h-full bg-destructive flex items-center justify-center text-destructive-foreground transition-colors hover:bg-destructive/90"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      {/* Swipeable card */}
      <Card
        ref={cardRef}
        className={`relative border shadow-sm bg-card transition-transform ${
          isDragging ? "" : "duration-200"
        } ${className}`}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        <CardContent className="p-4">{children}</CardContent>
      </Card>
    </div>
  );
};

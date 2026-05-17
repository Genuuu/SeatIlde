import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className, showText = true }: LogoProps) {
  return (
    <div className={cn("flex items-center space-x-3", className)}>
      <div className="relative w-10 h-10">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Pin Shape */}
          <g transform="translate(10, 5) scale(0.8)">
            <path 
              d="M50 100C50 100 0 65 0 35C0 15.665 15.665 0 35 0C54.335 0 70 15.665 70 35C70 65 50 100 50 100Z" 
              fill="#84cc16" 
              transform="translate(15, 0)"
            />
            <path 
              d="M50 0C30.665 0 15 15.665 15 35C15 65 35 100 35 100V0H50Z" 
              fill="#0f4c75" 
              transform="translate(15, 0)"
            />
            
            {/* Seat silhouette (simplified perspective) */}
            <path 
              d="M38 25 L34 50 Q34 58 48 62 L62 58 Q66 57 66 50 L64 30" 
              fill="none"
              stroke="white"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(10, 5)"
            />
            <path 
              d="M34 50 Q48 55 66 50" 
              fill="none"
              stroke="white"
              strokeWidth="5"
              strokeLinecap="round"
              transform="translate(10, 5)"
            />
            {/* Occupancy Indicator Dot */}
            <circle cx="60" cy="58" r="4.5" fill="#84cc16" className="animate-pulse" />
          </g>
        </svg>
      </div>
      {showText && (
        <div className="flex font-bold text-2xl tracking-tighter">
          <span className="text-[#0f4c75] dark:text-slate-100">Seat</span>
          <span className="text-[#84cc16]">Idle</span>
        </div>
      )}
    </div>
  );
}

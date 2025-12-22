import React from 'react';
import { motion } from 'framer-motion';

interface BeadRingProps {
    count: number;
}

export const BeadRing: React.FC<BeadRingProps> = ({ count }) => {
    // We want to visualize 108 beads.
    // A spiral or a large circle might be hard to fit on mobile.
    // Let's try a creative "Digital Mala" visualization.
    // A growing circle progress, but with 108 distinct dots/segments.

    const beads = Array.from({ length: 108 }, (_, i) => i);
    const radius = 120; // Radius of the ring

    // Calculate position for each bead on a circle
    // We start from top ( -90 degrees)

    return (
        <div className="relative w-80 h-80 flex items-center justify-center mx-auto">
            <svg width="320" height="320" viewBox="0 0 320 320" className="rotate-[-90deg]">
                {beads.map((_, index) => {
                    const angle = (index / 108) * 360;
                    const radian = (angle * Math.PI) / 180;
                    const cx = 160 + radius * Math.cos(radian);
                    const cy = 160 + radius * Math.sin(radian);

                    const isActive = index < count;
                    const isCurrent = index === count - 1;

                    return (
                        <motion.circle
                            key={index}
                            cx={cx}
                            cy={cy}
                            r={isActive ? 3 : 2}
                            fill={isActive ? "#fbbf24" : "#4c0519"} // Gold vs Maroon-950
                            initial={false}
                            animate={{
                                r: isCurrent ? 6 : (isActive ? 3.5 : 2),
                                fill: isActive ? "#fbbf24" : "#4c0519",
                                filter: isCurrent ? "drop-shadow(0 0 6px #fbbf24)" : "none"
                            }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        />
                    );
                })}
            </svg>

            {/* Center Counter Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <motion.div
                    key={count}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-7xl font-serif font-bold text-saffron-600 drop-shadow-sm"
                >
                    {count}
                </motion.div>
            </div>
        </div>
    );
};

import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@mui/material/styles';

interface BeadRingProps {
    count: number;
    activeFill?: string;
    inactiveFill?: string;
}

export const BeadRing: React.FC<BeadRingProps> = ({ count, activeFill, inactiveFill }) => {
    const muiTheme = useTheme();
    const fill = activeFill ?? '#fbbf24';
    const bg = inactiveFill ?? '#4c0519';
    const counterColor = muiTheme.palette.primary.main;

    const beads = Array.from({ length: 108 }, (_, i) => i);
    const radius = 120;

    return (
        <div className="relative w-full max-w-[320px] aspect-square flex items-center justify-center mx-auto">
            <svg width="100%" height="100%" viewBox="0 0 320 320" className="rotate-[-90deg]">
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
                            fill={isActive ? fill : bg}
                            initial={false}
                            animate={{
                                r: isCurrent ? 6 : (isActive ? 3.5 : 2),
                                fill: isActive ? fill : bg,
                                filter: isCurrent ? `drop-shadow(0 0 6px ${fill})` : 'none',
                            }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
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
                    className="text-7xl font-bold drop-shadow-sm"
                    style={{ fontFamily: '"Playfair Display", serif', color: counterColor }}
                >
                    {count}
                </motion.div>
            </div>
        </div>
    );
};

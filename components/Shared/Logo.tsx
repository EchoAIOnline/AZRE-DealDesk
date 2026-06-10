import React from 'react';
import { logoBase64, textBase64 } from './logoData';

interface LogoProps {
    className?: string;
    iconSize?: number;
    showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', iconSize = 32, showText = true }) => {
    return (
        <div className={`flex items-center gap-2.5 ${className}`}>
            <img 
                src={logoBase64} 
                alt="DealDesk Logo" 
                style={{ height: iconSize * 1.25, width: 'auto' }}
                className="shrink-0 object-contain drop-shadow-sm"
            />
            {showText && (
                <img 
                    src={textBase64} 
                    alt="DealDesk" 
                    style={{ height: iconSize * 1.15, width: 'auto' }}
                    className="shrink-0 object-contain drop-shadow-sm ml-1"
                />
            )}
        </div>
    );
};

import React from 'react';

export interface IconProps {
  size?: number;
  color?: string;
  style?: any;
}

const Svg: React.FC<{
  size?: number;
  color?: string;
  style?: any;
  strokeWidth?: number;
  children: React.ReactNode;
}> = ({ size = 18, color = 'currentColor', style, strokeWidth = 2, children }) => {
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: color,
      strokeWidth,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style },
    },
    children
  );
};

const path = (d: string, props?: Record<string, any>) => React.createElement('path', { d, ...props, key: d });
const circle = (cx: number, cy: number, r: number, props?: Record<string, any>) =>
  React.createElement('circle', { cx, cy, r, ...props, key: `${cx}-${cy}-${r}` });
const rect = (x: number, y: number, width: number, height: number, rx?: number, props?: Record<string, any>) =>
  React.createElement('rect', { x, y, width, height, rx, ...props, key: `${x}-${y}-${width}-${height}` });
const line = (x1: number, y1: number, x2: number, y2: number, props?: Record<string, any>) =>
  React.createElement('line', { x1, y1, x2, y2, ...props, key: `${x1}-${y1}-${x2}-${y2}` });
const polyline = (points: string, props?: Record<string, any>) =>
  React.createElement('polyline', { points, ...props, key: points });
const polygon = (points: string, props?: Record<string, any>) =>
  React.createElement('polygon', { points, ...props, key: points });

// Modern Fluent/Lucide vector icons
export const OverviewIcon: React.FC<IconProps> = ({ size = 18, color = '#ffffff', style }) => (
  <Svg size={size} color={color} style={style}>
    {rect(3, 3, 7, 9, 1)}
    {rect(14, 3, 7, 5, 1)}
    {rect(14, 12, 7, 9, 1)}
    {rect(3, 16, 7, 5, 1)}
  </Svg>
);

export const AppsIcon: React.FC<IconProps> = ({ size = 18, color = '#ffffff', style }) => (
  <Svg size={size} color={color} style={style}>
    {rect(2, 4, 20, 16, 2)}
    {line(2, 9, 22, 9)}
    {circle(5.5, 6.5, 0.75, { fill: color, stroke: 'none' })}
    {circle(8.5, 6.5, 0.75, { fill: color, stroke: 'none' })}
    {line(7, 14, 17, 14)}
  </Svg>
);

export const NetworkIcon: React.FC<IconProps> = ({ size = 18, color = '#ffffff', style }) => (
  <Svg size={size} color={color} style={style}>
    {rect(9, 2, 6, 6, 1)}
    {rect(16, 16, 6, 6, 1)}
    {rect(2, 16, 6, 6, 1)}
    {path('M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3')}
    {path('M12 12V8')}
  </Svg>
);

export const RulesIcon: React.FC<IconProps> = ({ size = 18, color = '#ffffff', style }) => (
  <Svg size={size} color={color} style={style}>
    {circle(6, 6, 3)}
    {circle(6, 18, 3)}
    {circle(18, 12, 3)}
    {path('M9 6h2a3 3 0 0 1 3 3v2')}
    {path('M9 18h2a3 3 0 0 0 3-3v-2')}
    {path('M14 12h1')}
  </Svg>
);

export const ActivityIcon: React.FC<IconProps> = ({ size = 18, color = '#ffffff', style }) => (
  <Svg size={size} color={color} style={style}>
    {polyline('22 12 18 12 15 21 9 3 6 12 2 12')}
  </Svg>
);

export const SettingsIcon: React.FC<IconProps> = ({ size = 18, color = '#ffffff', style }) => (
  <Svg size={size} color={color} style={style}>
    {circle(12, 12, 3)}
    {path(
      'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z'
    )}
  </Svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ size = 16, color = '#ffffff', style }) => (
  <Svg size={size} color={color} style={style}>
    {path('M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8')}
    {path('M3 3v5h5')}
    {path('M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16')}
    {path('M16 21h5v-5')}
  </Svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size = 16, color = '#888888', style }) => (
  <Svg size={size} color={color} style={style}>
    {circle(11, 11, 8)}
    {path('m21 21-4.3-4.3')}
  </Svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 14, color = '#107c41', style }) => (
  <Svg size={size} color={color} style={style}>
    {polyline('20 6 9 17 4 12')}
  </Svg>
);

export const AlertIcon: React.FC<IconProps> = ({ size = 14, color = '#d13438', style }) => (
  <Svg size={size} color={color} style={style}>
    {path('m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z')}
    {line(12, 9, 12, 13)}
    {line(12, 17, 12.01, 17, { strokeWidth: 3 })}
  </Svg>
);

export const WifiIcon: React.FC<IconProps> = ({ size = 16, color = '#ffffff', style }) => (
  <Svg size={size} color={color} style={style}>
    {path('M5 12.55a11 11 0 0 1 14.08 0')}
    {path('M1.42 9a16 16 0 0 1 21.16 0')}
    {path('M8.53 16.11a6 6 0 0 1 6.95 0')}
    {line(12, 20, 12.01, 20, { strokeWidth: 3 })}
  </Svg>
);

export const EthernetIcon: React.FC<IconProps> = ({ size = 16, color = '#ffffff', style }) => (
  <Svg size={size} color={color} style={style}>
    {rect(4, 4, 16, 16, 2)}
    {rect(9, 8, 6, 4)}
    {path('M10 16h4')}
    {path('M12 12v4')}
  </Svg>
);

export const ShieldIcon: React.FC<IconProps> = ({ size = 16, color = '#1173d4', style }) => (
  <Svg size={size} color={color} style={style}>
    {path('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z')}
  </Svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 12, color = '#888888', style }) => (
  <Svg size={size} color={color} style={style}>
    {polyline('6 9 12 15 18 9')}
  </Svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ size = 10, color = '#888888', style }) => (
  <Svg size={size} color={color} style={style}>
    {polyline('9 18 15 12 9 6')}
  </Svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = ({ size = 10, color = '#888888', style }) => (
  <Svg size={size} color={color} style={style}>
    {polyline('15 18 9 12 15 6')}
  </Svg>
);

export const ArrowRightIcon: React.FC<IconProps> = ({ size = 10, color = '#888888', style }) => (
  <Svg size={size} color={color} style={style}>
    {line(5, 12, 19, 12)}
    {polyline('12 5 19 12 12 19')}
  </Svg>
);

export const SwapIcon: React.FC<IconProps> = ({ size = 14, color = '#ffffff', style }) => (
  <Svg size={size} color={color} style={style}>
    {path('M16 3l4 4-4 4')}
    {path('M20 7H4')}
    {path('M8 21l-4-4 4-4')}
    {path('M4 17h16')}
  </Svg>
);

export const StarIcon: React.FC<IconProps> = ({ size = 14, color = '#ffffff', style }) => (
  <Svg size={size} color={color} style={style}>
    {polygon('12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2')}
  </Svg>
);

export const BoltIcon: React.FC<IconProps> = ({ size = 14, color = '#10b981', style }) => (
  <Svg size={size} color={color} style={style}>
    {polygon('13 2 3 14 12 14 11 22 21 10 12 10 13 2')}
  </Svg>
);

export const PauseIcon: React.FC<IconProps> = ({ size = 14, color = '#94a3b8', style }) => (
  <Svg size={size} color={color} style={style}>
    {rect(6, 4, 4, 16)}
    {rect(14, 4, 4, 16)}
  </Svg>
);

export const SunIcon: React.FC<IconProps> = ({ size = 14, color = '#f59e0b', style }) => (
  <Svg size={size} color={color} style={style}>
    {circle(12, 12, 5)}
    {line(12, 1, 12, 3)}
    {line(12, 21, 12, 23)}
    {line(4.22, 4.22, 5.64, 5.64)}
    {line(18.36, 18.36, 19.78, 19.78)}
    {line(1, 12, 3, 12)}
    {line(21, 12, 23, 12)}
    {line(4.22, 19.78, 5.64, 18.36)}
    {line(18.36, 5.64, 19.78, 4.22)}
  </Svg>
);

export const MoonIcon: React.FC<IconProps> = ({ size = 14, color = '#93c5fd', style }) => (
  <Svg size={size} color={color} style={style}>
    {path('M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z')}
  </Svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 12, color = '#888888', style }) => (
  <Svg size={size} color={color} style={style}>
    {line(18, 6, 6, 18)}
    {line(6, 6, 18, 18)}
  </Svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 14, color = '#ef4444', style }) => (
  <Svg size={size} color={color} style={style}>
    {polyline('3 6 5 6 21 6')}
    {path('M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2')}
    {line(10, 11, 10, 17)}
    {line(14, 11, 14, 17)}
  </Svg>
);

export const SortAscIcon: React.FC<IconProps> = ({ size = 8, color = '#888888', style }) => (
  <Svg size={size} color={color} style={style}>
    {polyline('18 15 12 9 6 15')}
  </Svg>
);

export const SortDescIcon: React.FC<IconProps> = ({ size = 8, color = '#888888', style }) => (
  <Svg size={size} color={color} style={style}>
    {polyline('6 9 12 15 18 9')}
  </Svg>
);

export const SortUpDownIcon: React.FC<IconProps> = ({ size = 10, color = '#888888', style }) => (
  <Svg size={size} color={color} style={style}>
    {polyline('7 15 12 20 17 15')}
    {polyline('7 9 12 4 17 9')}
  </Svg>
);

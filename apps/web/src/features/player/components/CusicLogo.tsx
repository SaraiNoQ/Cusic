import { useId } from 'react';

export function CusicLogo({
  className,
}: Readonly<{
  className?: string;
}>) {
  const uid = useId().replace(/:/g, '');
  const goldFillId = `cusic-gold-fill-${uid}`;
  const goldStrokeId = `cusic-gold-stroke-${uid}`;
  const goldHighlightId = `cusic-gold-highlight-${uid}`;
  const metalFilterId = `cusic-metal-${uid}`;
  const glowFilterId = `cusic-glow-${uid}`;
  const grainFilterId = `cusic-grain-${uid}`;
  const textMaskId = `cusic-mask-${uid}`;
  const outerCPath = 'M160 13 A74 74 0 1 0 160 109';
  const innerCPath = 'M156 27 A60 60 0 1 0 156 95';

  return (
    <svg
      viewBox="0 0 720 160"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={goldFillId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5f4936" />
          <stop offset="16%" stopColor="#9c7651" />
          <stop offset="34%" stopColor="#f4e3c2" />
          <stop offset="52%" stopColor="#c29766" />
          <stop offset="74%" stopColor="#f5d8ae" />
          <stop offset="100%" stopColor="#694f37" />
        </linearGradient>
        <linearGradient id={goldStrokeId} x1="12%" y1="10%" x2="82%" y2="90%">
          <stop offset="0%" stopColor="#fff4dd" />
          <stop offset="24%" stopColor="#f2d5ac" />
          <stop offset="55%" stopColor="#8a6543" />
          <stop offset="100%" stopColor="#f4ddb7" />
        </linearGradient>
        <linearGradient
          id={goldHighlightId}
          x1="30%"
          y1="0%"
          x2="70%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#fff9e9" stopOpacity="0.96" />
          <stop offset="42%" stopColor="#ffddb3" stopOpacity="0.58" />
          <stop offset="100%" stopColor="#7c5030" stopOpacity="0" />
        </linearGradient>
        <filter
          id={glowFilterId}
          x="-18%"
          y="-40%"
          width="136%"
          height="190%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="4.5" result="blur" />
          <feOffset in="blur" dy="4" result="offsetBlur" />
          <feFlood floodColor="#090603" floodOpacity="0.9" result="shadow" />
          <feComposite in="shadow" in2="offsetBlur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter
          id={metalFilterId}
          x="-8%"
          y="-20%"
          width="116%"
          height="150%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.95 0.025"
            numOctaves="2"
            seed="19"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="1.4"
            xChannelSelector="R"
            yChannelSelector="G"
            result="engraved"
          />
          <feSpecularLighting
            in="noise"
            surfaceScale="2.8"
            specularConstant="0.7"
            specularExponent="18"
            lightingColor="#fff5e4"
            result="specular"
          >
            <feDistantLight azimuth="120" elevation="46" />
          </feSpecularLighting>
          <feComposite
            in="specular"
            in2="SourceAlpha"
            operator="in"
            result="specularText"
          />
          <feColorMatrix
            in="specularText"
            type="matrix"
            values="1 0 0 0 0.14 0 1 0 0 0.1 0 0 1 0 0.02 0 0 0 0.42 0"
            result="warmSpecular"
          />
          <feMerge>
            <feMergeNode in="engraved" />
            <feMergeNode in="warmSpecular" />
          </feMerge>
        </filter>
        <filter
          id={grainFilterId}
          x="-10%"
          y="-20%"
          width="120%"
          height="160%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="1"
            seed="7"
            result="grain"
          />
          <feColorMatrix
            in="grain"
            type="saturate"
            values="0"
            result="monoGrain"
          />
          <feComponentTransfer in="monoGrain">
            <feFuncA type="table" tableValues="0 0.12" />
          </feComponentTransfer>
        </filter>
        <mask
          id={textMaskId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="720"
          height="160"
        >
          <rect width="720" height="160" fill="black" />
          <path d={outerCPath} fill="none" stroke="white" strokeWidth="9" />
          <path d={innerCPath} fill="none" stroke="white" strokeWidth="4.4" />
          <text
            x="220"
            y="109"
            fill="white"
            fontFamily="Baskerville, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Palatino, serif"
            fontSize="103"
            letterSpacing="24"
          >
            USIC
          </text>
        </mask>
      </defs>

      <g filter={`url(#${glowFilterId})`}>
        <g transform="translate(0 4)" opacity="0.54">
          <path
            d={outerCPath}
            fill="none"
            stroke="#0b0908"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path
            d={innerCPath}
            fill="none"
            stroke="#0b0908"
            strokeWidth="4.4"
            strokeLinecap="round"
          />
          <text
            x="220"
            y="109"
            fill="#0b0908"
            fontFamily="Baskerville, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Palatino, serif"
            fontSize="103"
            letterSpacing="24"
          >
            USIC
          </text>
        </g>

        <g filter={`url(#${metalFilterId})`}>
          <path
            d={outerCPath}
            fill="none"
            stroke={`url(#${goldStrokeId})`}
            strokeWidth="8.4"
            strokeLinecap="round"
          />
          <path
            d={innerCPath}
            fill="none"
            stroke={`url(#${goldStrokeId})`}
            strokeWidth="3.8"
            strokeLinecap="round"
          />
          <text
            x="220"
            y="109"
            fill={`url(#${goldFillId})`}
            stroke={`url(#${goldStrokeId})`}
            strokeWidth="1.85"
            paintOrder="stroke fill"
            fontFamily="Baskerville, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Palatino, serif"
            fontSize="103"
            letterSpacing="24"
          >
            USIC
          </text>
        </g>

        <path
          d="M159 16 A71 71 0 1 0 159 106"
          fill="none"
          stroke={`url(#${goldStrokeId})`}
          strokeWidth="1.4"
          opacity="0.94"
          strokeLinecap="round"
        />

        <g opacity="0.58">
          <path
            d={outerCPath}
            fill="none"
            stroke={`url(#${goldHighlightId})`}
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          <path
            d={innerCPath}
            fill="none"
            stroke={`url(#${goldHighlightId})`}
            strokeWidth="0.85"
            strokeLinecap="round"
          />
          <text
            x="220"
            y="109"
            fill="none"
            stroke={`url(#${goldHighlightId})`}
            strokeWidth="0.95"
            fontFamily="Baskerville, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Palatino, serif"
            fontSize="103"
            letterSpacing="24"
          >
            USIC
          </text>
        </g>

        <g mask={`url(#${textMaskId})`} opacity="0.5">
          <rect
            x="0"
            y="0"
            width="720"
            height="160"
            fill="#f6ead6"
            filter={`url(#${grainFilterId})`}
          />
          <ellipse
            cx="270"
            cy="66"
            rx="255"
            ry="44"
            fill="#fff5e7"
            fillOpacity="0.3"
          />
          <ellipse
            cx="450"
            cy="108"
            rx="212"
            ry="38"
            fill="#4a2e18"
            fillOpacity="0.16"
          />
        </g>
      </g>
    </svg>
  );
}

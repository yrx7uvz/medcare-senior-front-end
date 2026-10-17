import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { MedicationAppearance, PillShape } from '../../types/domain';
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY, describeAppearance } from '../../lib/medicationMeta';
import { radius, useTheme } from '../../theme';

const SIZE_PX = { sm: 44, md: 64, lg: 104, xl: 136 } as const;
export type PillVisualSize = keyof typeof SIZE_PX;

interface Props {
  appearance: MedicationAppearance;
  size?: PillVisualSize;
  /** Nome do remédio, para o rótulo do leitor de tela. */
  name?: string;
}

// ---------- utilidades de cor ----------
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** amt < 0 escurece, amt > 0 clareia. */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return `#${[f(r), f(g), f(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const outline = (fill: string) => (luminance(fill) > 0.85 ? '#8C9BAB' : shade(fill, -0.35));
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Comprimento desenhado (viewBox 100) proporcional ao tamanho real: 4 mm → 34, 22 mm → 88. */
function drawnLength(mm: number) {
  return 34 + ((clamp(mm, 4, 22) - 4) / 18) * 54;
}

// ---------- desenhos ----------
function Tablet({ shape, lengthMm, widthMm, fill, hasScore, imprint, showImprint }: {
  shape: PillShape; lengthMm: number; widthMm: number; fill: string; hasScore?: boolean; imprint?: string; showImprint: boolean;
}) {
  const len = drawnLength(lengthMm);
  const wid = shape === 'REDONDO' ? len : clamp(len * (widthMm / lengthMm), len * 0.3, len);
  const cx = 50;
  const cy = 50;
  const stroke = outline(fill);
  const common = { fill, stroke, strokeWidth: 2.2 };
  let body: React.ReactNode;
  switch (shape) {
    case 'REDONDO':
      body = <Circle cx={cx} cy={cy} r={len / 2} {...common} />;
      break;
    case 'OVAL':
      body = <Ellipse cx={cx} cy={cy} rx={len / 2} ry={wid / 2} {...common} />;
      break;
    case 'OBLONGO':
      body = <Rect x={cx - len / 2} y={cy - wid / 2} width={len} height={wid} rx={wid / 2} {...common} />;
      break;
    case 'RETANGULAR':
      body = <Rect x={cx - len / 2} y={cy - wid / 2} width={len} height={wid} rx={Math.min(7, wid / 4)} {...common} />;
      break;
    case 'LOSANGO':
      body = (
        <Path
          d={`M${cx} ${cy - wid / 2} L${cx + len / 2} ${cy} L${cx} ${cy + wid / 2} L${cx - len / 2} ${cy} Z`}
          strokeLinejoin="round"
          {...common}
        />
      );
      break;
    default:
      body = <Rect x={cx - len / 2} y={cy - wid / 2} width={len} height={wid} rx={wid / 3} {...common} />;
  }
  const fontSize = clamp(wid * 0.3, 7, 15);
  return (
    <G>
      {body}
      <Ellipse cx={cx - len * 0.14} cy={cy - wid * 0.2} rx={len * 0.2} ry={wid * 0.1} fill="#FFFFFF" opacity={0.45} />
      {hasScore ? (
        <Line x1={cx} y1={cy - wid / 2 + 4} x2={cx} y2={cy + wid / 2 - 4} stroke={shade(stroke, -0.1)} strokeWidth={1.8} strokeLinecap="round" />
      ) : null}
      {showImprint && imprint ? (
        <SvgText
          x={hasScore ? cx + len * 0.22 : cx}
          y={cy + fontSize * 0.36}
          fontSize={fontSize}
          fontWeight="bold"
          fill={stroke}
          textAnchor="middle"
        >
          {imprint.slice(0, 5)}
        </SvgText>
      ) : null}
    </G>
  );
}

function Capsule({ lengthMm, widthMm, c1, c2, imprint, showImprint }: {
  lengthMm: number; widthMm: number; c1: string; c2: string; imprint?: string; showImprint: boolean;
}) {
  const len = drawnLength(lengthMm);
  const hgt = clamp(len * (widthMm / lengthMm), len * 0.28, len * 0.6);
  const r = hgt / 2;
  const cx = 50;
  const cy = 50;
  const x0 = cx - len / 2;
  const x1 = cx + len / 2;
  const left = `M${cx} ${cy - r} L${x0 + r} ${cy - r} A${r} ${r} 0 0 0 ${x0 + r} ${cy + r} L${cx} ${cy + r} Z`;
  const right = `M${cx} ${cy - r} L${x1 - r} ${cy - r} A${r} ${r} 0 0 1 ${x1 - r} ${cy + r} L${cx} ${cy + r} Z`;
  return (
    <G rotation={-28} origin="50, 50">
      <Path d={left} fill={c1} stroke={outline(c1)} strokeWidth={2} />
      <Path d={right} fill={c2} stroke={outline(c2)} strokeWidth={2} />
      <Line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke={shade(outline(c1), -0.1)} strokeWidth={1.6} />
      <Rect x={x0 + r * 0.7} y={cy - r * 0.68} width={len - r * 1.4} height={r * 0.32} rx={r * 0.16} fill="#FFFFFF" opacity={0.4} />
      {showImprint && imprint ? (
        <SvgText x={cx - len / 4} y={cy + 3.5} fontSize={clamp(hgt * 0.35, 7, 12)} fontWeight="bold" fill={outline(c1)} textAnchor="middle">
          {imprint.slice(0, 5)}
        </SvgText>
      ) : null}
    </G>
  );
}

function DropperBottle({ body, cap }: { body: string; cap: string }) {
  return (
    <G>
      <Rect x={44} y={10} width={12} height={20} rx={6} fill={cap} stroke={outline(cap)} strokeWidth={1.8} />
      <Rect x={41} y={28} width={18} height={10} rx={2} fill={shade(body, -0.25)} />
      <Rect x={30} y={36} width={40} height={54} rx={8} fill={body} stroke={outline(body)} strokeWidth={2} />
      <Rect x={30} y={52} width={40} height={20} fill="#FFFFFF" opacity={0.92} />
      <Line x1={36} y1={59} x2={64} y2={59} stroke="#8C9BAB" strokeWidth={2} />
      <Line x1={36} y1={65} x2={56} y2={65} stroke="#8C9BAB" strokeWidth={2} />
      <Path d="M83 46 C83 46 75 57 75 62 a8 8 0 0 0 16 0 C91 57 83 46 83 46Z" fill="#5FA8E8" stroke="#2F6FA8" strokeWidth={1.5} />
    </G>
  );
}

function SyrupBottle({ body, cap }: { body: string; cap: string }) {
  return (
    <G>
      <Rect x={30} y={10} width={26} height={12} rx={3} fill={cap} stroke={outline(cap)} strokeWidth={1.8} />
      <Rect x={34} y={21} width={18} height={10} fill={shade(body, -0.2)} />
      <Path d="M28 38 Q28 30 36 30 L50 30 Q58 30 58 38 L58 88 Q58 92 54 92 L32 92 Q28 92 28 88 Z" fill={body} stroke={outline(body)} strokeWidth={2} />
      <Rect x={28} y={50} width={30} height={22} fill="#FFFFFF" opacity={0.9} />
      <Line x1={33} y1={58} x2={53} y2={58} stroke="#8C9BAB" strokeWidth={2} />
      <Line x1={33} y1={64} x2={48} y2={64} stroke="#8C9BAB" strokeWidth={2} />
      <Path d="M60 62 L88 62 L84 92 L64 92 Z" fill="#FFFFFF" opacity={0.85} stroke="#8C9BAB" strokeWidth={1.8} />
      <Path d="M62.6 76 L85.4 76 L84 92 L64 92 Z" fill={body} opacity={0.65} />
      <Line x1={66} y1={70} x2={72} y2={70} stroke="#8C9BAB" strokeWidth={1.4} />
      <Line x1={66} y1={82} x2={72} y2={82} stroke="#8C9BAB" strokeWidth={1.4} />
    </G>
  );
}

function Syringe({ liquid }: { liquid: string }) {
  return (
    <G rotation={-35} origin="50, 50">
      <Rect x={4} y={40} width={5} height={20} rx={2} fill="#8C9BAB" />
      <Rect x={9} y={47} width={16} height={6} fill="#B8C2CC" />
      <Rect x={24} y={41} width={46} height={18} rx={3} fill="#F4F8FC" stroke="#6B7C8D" strokeWidth={1.8} />
      <Rect x={42} y={43} width={27} height={14} fill={liquid} opacity={0.75} />
      {[30, 36, 42, 48, 54, 60].map((x) => (
        <Line key={x} x1={x} y1={41} x2={x} y2={46} stroke="#6B7C8D" strokeWidth={1.2} />
      ))}
      <Rect x={70} y={46} width={8} height={8} fill="#B8C2CC" />
      <Line x1={78} y1={50} x2={96} y2={50} stroke="#6B7C8D" strokeWidth={1.6} strokeLinecap="round" />
    </G>
  );
}

function Patch({ fill }: { fill: string }) {
  return (
    <G>
      <Rect x={16} y={16} width={68} height={68} rx={16} fill={fill} stroke={outline(fill)} strokeWidth={2} />
      <Rect x={25} y={25} width={50} height={50} rx={10} fill="none" stroke={outline(fill)} strokeWidth={1.6} strokeDasharray="4 4" />
      <Circle cx={50} cy={50} r={9} fill={shade(fill, -0.12)} />
    </G>
  );
}

/** Fallback genérico por tipo quando faltam formato, cor ou tamanho. */
function defaultsFor(a: MedicationAppearance) {
  const shape: PillShape = a.shape ?? 'REDONDO';
  const lengthMm = a.lengthMm ?? (a.type === 'CAPSULA' ? 17 : shape === 'REDONDO' ? 9 : 12);
  const widthMm = a.widthMm ?? (a.type === 'CAPSULA' ? 6 : shape === 'REDONDO' ? lengthMm : lengthMm * 0.55);
  return {
    shape,
    lengthMm,
    widthMm,
    primary: a.primaryColor ?? DEFAULT_PRIMARY[a.type],
    secondary: a.secondaryColor ?? DEFAULT_SECONDARY[a.type],
  };
}

function Drawing({ appearance, showImprint }: { appearance: MedicationAppearance; showImprint: boolean }) {
  const d = defaultsFor(appearance);
  switch (appearance.type) {
    case 'CAPSULA':
      return <Capsule lengthMm={d.lengthMm} widthMm={d.widthMm} c1={d.primary} c2={d.secondary} imprint={appearance.imprint} showImprint={showImprint} />;
    case 'GOTAS':
      return <DropperBottle body={d.primary} cap={d.secondary} />;
    case 'XAROPE':
      return <SyrupBottle body={d.primary} cap={d.secondary} />;
    case 'INJECAO':
      return <Syringe liquid={d.primary} />;
    case 'ADESIVO':
      return <Patch fill={d.primary} />;
    default:
      return (
        <Tablet
          shape={d.shape}
          lengthMm={d.lengthMm}
          widthMm={d.widthMm}
          fill={d.primary}
          hasScore={appearance.hasScore}
          imprint={appearance.imprint}
          showImprint={showImprint}
        />
      );
  }
}

/**
 * Representação visual do remédio (react-native-svg). Desenha a partir de tipo,
 * formato, cores e proporção do tamanho; mostra a foto quando existir, com o
 * desenho como fallback e como miniatura. Nunca exibe um remédio sem imagem.
 */
export function PillVisual({ appearance, size = 'md', name }: Props) {
  const { colors, highContrast } = useTheme();
  const [photoFailed, setPhotoFailed] = useState(false);
  const px = SIZE_PX[size];
  const showPhoto = !!appearance.photoUrl && !photoFailed;
  const label = `${name ? `${name}: ` : ''}${describeAppearance(appearance)}`;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[
        styles.tile,
        {
          width: px,
          height: px,
          borderRadius: size === 'sm' ? radius.md : radius.lg,
          backgroundColor: colors.pillTile,
          borderColor: highContrast ? colors.border : 'transparent',
          borderWidth: highContrast ? 2 : 0,
        },
      ]}
    >
      {showPhoto ? (
        <>
          <Image
            source={{ uri: appearance.photoUrl }}
            onError={() => setPhotoFailed(true)}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          <View style={[styles.thumb, { width: px * 0.42, height: px * 0.42, backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
              <Drawing appearance={appearance} showImprint={false} />
            </Svg>
          </View>
        </>
      ) : (
        <Svg width={px * 0.92} height={px * 0.92} viewBox="0 0 100 100">
          <Drawing appearance={appearance} showImprint={size !== 'sm'} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumb: { position: 'absolute', right: 3, bottom: 3, borderRadius: 999, borderWidth: 1, padding: 2 },
});

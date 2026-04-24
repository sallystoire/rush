import React from "react";

export type Gender = "male" | "female";

export interface AccessoryItem {
  id: string;
  type: "hair" | "cap" | "wings" | "glasses" | "beard";
}

interface PlayerCharacterProps {
  skinColor?: string;
  gender?: Gender;
  hairColor?: string;
  equippedItems?: AccessoryItem[];
  size?: number;
  className?: string;
}

const SKIN_PRESETS = {
  beige: "#F5C9A0",
  light: "#FFE0BD",
  medium: "#D4956A",
  tan: "#C68642",
  brown: "#8D5524",
  dark: "#5C3317",
  ebony: "#3B1F0A",
};

function getSkinHex(skinColor: string): string {
  return SKIN_PRESETS[skinColor as keyof typeof SKIN_PRESETS] ?? skinColor;
}

function darken(hex: string, amount = 30): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function lighten(hex: string, amount = 30): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export default function PlayerCharacter({
  skinColor = "beige",
  gender = "male",
  hairColor = "#3b1f0a",
  equippedItems = [],
  size = 200,
  className,
}: PlayerCharacterProps) {
  const skin = getSkinHex(skinColor);
  const skinDark = darken(skin, 25);
  const hairDark = darken(hairColor, 20);
  const isFemale = gender === "female";

  const scale = size / 220;
  const W = 220;
  const H = 220;

  const equippedCap = equippedItems.find((i) => i.type === "cap");
  const equippedWings = equippedItems.find((i) => i.type === "wings");
  const equippedHair = equippedItems.find((i) => i.type === "hair");
  const equippedGlasses = equippedItems.find((i) => i.type === "glasses");

  const shirtColor = isFemale ? "#e040a0" : "#2979ff";
  const pantsColor = isFemale ? "#7e57c2" : "#37474f";
  const shoeColor = "#212121";

  return (
    <svg
      width={W * scale}
      height={H * scale}
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      style={{ imageRendering: "pixelated" }}
    >
      {/* Wings (behind character) */}
      {equippedWings && <WingsAccessory item={equippedWings} />}

      {/* Shadow */}
      <ellipse cx={110} cy={210} rx={45} ry={8} fill="rgba(0,0,0,0.2)" />

      {/* === LEGS === */}
      {/* Left leg */}
      <rect x={85} y={148} width={22} height={42} rx={4} fill={pantsColor} />
      <rect x={85} y={182} width={22} height={8} rx={2} fill={shoeColor} />
      {/* Right leg */}
      <rect x={113} y={148} width={22} height={42} rx={4} fill={pantsColor} />
      <rect x={113} y={182} width={24} height={8} rx={2} fill={shoeColor} />

      {/* === BODY === */}
      <rect
        x={isFemale ? 83 : 80}
        y={95}
        width={isFemale ? 54 : 60}
        height={58}
        rx={6}
        fill={shirtColor}
      />
      {/* Belt */}
      <rect x={80} y={145} width={60} height={7} rx={2} fill={darken(pantsColor, 10)} />
      {/* Shirt detail */}
      <rect x={106} y={98} width={8} height={30} rx={2} fill={darken(shirtColor, 20)} />

      {/* === ARMS === */}
      {/* Left arm */}
      <rect x={62} y={98} width={18} height={38} rx={5} fill={shirtColor} />
      <rect x={62} y={132} width={18} height={22} rx={4} fill={skin} />
      {/* Right arm */}
      <rect x={140} y={98} width={18} height={38} rx={5} fill={shirtColor} />
      <rect x={140} y={132} width={18} height={22} rx={4} fill={skin} />

      {/* === NECK === */}
      <rect x={103} y={82} width={14} height={16} rx={3} fill={skin} />

      {/* === HEAD === */}
      <rect x={80} y={32} width={60} height={58} rx={10} fill={skin} />
      {/* Head shadow (bottom of head) */}
      <rect x={80} y={76} width={60} height={14} rx={8} fill={skinDark} />

      {/* === EYES === */}
      <rect x={91} y={52} width={10} height={10} rx={2} fill="#fff" />
      <rect x={119} y={52} width={10} height={10} rx={2} fill="#fff" />
      <rect x={93} y={54} width={6} height={6} rx={1} fill="#1a0a00" />
      <rect x={121} y={54} width={6} height={6} rx={1} fill="#1a0a00" />
      {/* Eye shine */}
      <rect x={94} y={55} width={2} height={2} fill="#fff" />
      <rect x={122} y={55} width={2} height={2} fill="#fff" />

      {/* === EYEBROWS === */}
      <rect x={90} y={48} width={12} height={3} rx={1} fill={hairColor} />
      <rect x={118} y={48} width={12} height={3} rx={1} fill={hairColor} />

      {/* === NOSE === */}
      <rect x={108} y={61} width={4} height={5} rx={1} fill={skinDark} />

      {/* === MOUTH === */}
      {isFemale ? (
        <>
          <rect x={97} y={70} width={16} height={4} rx={2} fill="#e91e63" />
          <rect x={99} y={70} width={12} height={2} rx={1} fill="#ff80ab" />
        </>
      ) : (
        <rect x={98} y={70} width={14} height={4} rx={2} fill={darken(skin, 20)} />
      )}

      {/* === HAIR === */}
      {!equippedCap && <HairStyle equippedHair={equippedHair} gender={gender} hairColor={hairColor} hairDark={hairDark} />}

      {/* === GLASSES === */}
      {equippedGlasses && <GlassesAccessory item={equippedGlasses} />}

      {/* === CAP === */}
      {equippedCap && <CapAccessory item={equippedCap} hairColor={hairColor} hairDark={hairDark} />}
    </svg>
  );
}

function HairStyle({
  equippedHair,
  gender,
  hairColor,
  hairDark,
}: {
  equippedHair?: AccessoryItem;
  gender: Gender;
  hairColor: string;
  hairDark: string;
}) {
  if (!equippedHair) {
    if (gender === "female") {
      return (
        <>
          <rect x={78} y={28} width={64} height={22} rx={8} fill={hairColor} />
          <rect x={74} y={40} width={10} height={40} rx={5} fill={hairColor} />
          <rect x={136} y={40} width={10} height={40} rx={5} fill={hairColor} />
          <rect x={80} y={78} width={12} height={20} rx={4} fill={hairColor} />
          <rect x={128} y={78} width={12} height={20} rx={4} fill={hairColor} />
          <rect x={78} y={28} width={64} height={10} rx={6} fill={hairDark} />
        </>
      );
    }
    return (
      <>
        <rect x={78} y={28} width={64} height={18} rx={8} fill={hairColor} />
        <rect x={78} y={28} width={64} height={8} rx={6} fill={hairDark} />
      </>
    );
  }

  switch (equippedHair.id) {
    case "hair_afro":
      return (
        <ellipse cx={110} cy={34} rx={38} ry={28} fill={hairColor} />
      );
    case "hair_long":
      return (
        <>
          <rect x={78} y={26} width={64} height={20} rx={8} fill={hairColor} />
          <rect x={72} y={36} width={14} height={60} rx={6} fill={hairColor} />
          <rect x={134} y={36} width={14} height={60} rx={6} fill={hairColor} />
          <rect x={78} y={26} width={64} height={8} rx={6} fill={hairDark} />
        </>
      );
    case "hair_spiky":
      return (
        <>
          <rect x={78} y={28} width={64} height={16} rx={4} fill={hairColor} />
          <polygon points="90,28 95,12 100,28" fill={hairColor} />
          <polygon points="104,26 110,8 116,26" fill={hairColor} />
          <polygon points="120,28 125,14 130,28" fill={hairColor} />
        </>
      );
    case "hair_bun":
      return (
        <>
          <rect x={78} y={30} width={64} height={16} rx={8} fill={hairColor} />
          <ellipse cx={110} cy={28} rx={16} ry={14} fill={hairColor} />
          <ellipse cx={110} cy={26} rx={10} ry={8} fill={hairDark} />
        </>
      );
    case "hair_curly":
      return (
        <>
          <ellipse cx={86} cy={36} rx={14} ry={16} fill={hairColor} />
          <ellipse cx={110} cy={30} rx={16} ry={14} fill={hairColor} />
          <ellipse cx={134} cy={36} rx={14} ry={16} fill={hairColor} />
          <rect x={80} y={42} width={60} height={10} rx={4} fill={hairColor} />
        </>
      );
    default:
      return (
        <rect x={78} y={28} width={64} height={18} rx={8} fill={hairColor} />
      );
  }
}

function CapAccessory({ item, hairColor, hairDark }: { item: AccessoryItem; hairColor: string; hairDark: string }) {
  switch (item.id) {
    case "cap_baseball":
      return (
        <>
          <rect x={78} y={32} width={64} height={24} rx={8} fill="#e53935" />
          <rect x={78} y={32} width={64} height={8} rx={6} fill="#b71c1c" />
          <rect x={68} y={46} width={28} height={8} rx={4} fill="#e53935" />
          <rect x={86} y={38} width={28} height={6} rx={2} fill="#ffeb3b" />
        </>
      );
    case "cap_crown":
      return (
        <>
          <rect x={82} y={36} width={56} height={20} rx={4} fill="#ffd700" />
          <polygon points="82,36 90,16 98,36" fill="#ffd700" />
          <polygon points="102,36 110,14 118,36" fill="#ffd700" />
          <polygon points="122,36 130,16 138,36" fill="#ffd700" />
          <rect x={82} y={48} width={56} height={8} rx={2} fill="#ff8f00" />
          <circle cx={90} cy={24} r={4} fill="#e91e63" />
          <circle cx={110} cy={20} r={5} fill="#2979ff" />
          <circle cx={130} cy={24} r={4} fill="#e91e63" />
        </>
      );
    case "cap_cowboy":
      return (
        <>
          <rect x={84} y={36} width={52} height={18} rx={6} fill="#795548" />
          <rect x={64} y={48} width={92} height={10} rx={5} fill="#5d4037" />
          <rect x={100} y={30} width={20} height={12} rx={3} fill="#795548" />
        </>
      );
    case "cap_beanie":
      return (
        <>
          <rect x={80} y={28} width={60} height={28} rx={12} fill="#7b1fa2" />
          <rect x={76} y={48} width={68} height={10} rx={4} fill="#6a1b9a" />
          <circle cx={110} cy={26} r={8} fill="#ab47bc" />
        </>
      );
    default:
      return (
        <>
          <rect x={78} y={32} width={64} height={24} rx={8} fill="#333" />
          <rect x={78} y={32} width={64} height={8} rx={6} fill={hairDark} />
          <rect x={72} y={44} width={24} height={8} rx={4} fill="#333" />
        </>
      );
  }
}

function GlassesAccessory({ item }: { item: AccessoryItem }) {
  return (
    <>
      <rect x={87} y={50} width={16} height={14} rx={4} fill="none" stroke="#333" strokeWidth={2.5} />
      <rect x={117} y={50} width={16} height={14} rx={4} fill="none" stroke="#333" strokeWidth={2.5} />
      <line x1={103} y1={57} x2={117} y2={57} stroke="#333" strokeWidth={2} />
      <line x1={87} y1={57} x2={82} y2={55} stroke="#333" strokeWidth={2} />
      <line x1={133} y1={57} x2={138} y2={55} stroke="#333" strokeWidth={2} />
      {item.id === "glasses_sunglasses" && (
        <>
          <rect x={89} y={52} width={12} height={10} rx={3} fill="rgba(0,0,0,0.6)" />
          <rect x={119} y={52} width={12} height={10} rx={3} fill="rgba(0,0,0,0.6)" />
        </>
      )}
    </>
  );
}

function WingsAccessory({ item }: { item: AccessoryItem }) {
  if (item.id === "wings_angel") {
    return (
      <>
        <ellipse cx={52} cy={115} rx={32} ry={48} fill="rgba(255,255,255,0.9)" transform="rotate(-20,52,115)" />
        <ellipse cx={168} cy={115} rx={32} ry={48} fill="rgba(255,255,255,0.9)" transform="rotate(20,168,115)" />
        <ellipse cx={48} cy={105} rx={18} ry={30} fill="rgba(255,255,255,0.6)" transform="rotate(-15,48,105)" />
        <ellipse cx={172} cy={105} rx={18} ry={30} fill="rgba(255,255,255,0.6)" transform="rotate(15,172,105)" />
      </>
    );
  }
  if (item.id === "wings_butterfly") {
    return (
      <>
        <ellipse cx={50} cy={110} rx={38} ry={28} fill="#e040fb" transform="rotate(-30,50,110)" opacity={0.9} />
        <ellipse cx={50} cy={130} rx={24} ry={18} fill="#ce93d8" transform="rotate(10,50,130)" opacity={0.9} />
        <ellipse cx={170} cy={110} rx={38} ry={28} fill="#e040fb" transform="rotate(30,170,110)" opacity={0.9} />
        <ellipse cx={170} cy={130} rx={24} ry={18} fill="#ce93d8" transform="rotate(-10,170,130)" opacity={0.9} />
      </>
    );
  }
  if (item.id === "wings_dragon") {
    return (
      <>
        <polygon points="80,105 20,60 30,110 50,130" fill="#e53935" opacity={0.9} />
        <polygon points="140,105 200,60 190,110 170,130" fill="#e53935" opacity={0.9} />
        <line x1="80" y1="105" x2="20" y2="60" stroke="#b71c1c" strokeWidth={2} />
        <line x1="20" y1="60" x2="30" y2="110" stroke="#b71c1c" strokeWidth={1.5} />
        <line x1="30" y1="110" x2="50" y2="130" stroke="#b71c1c" strokeWidth={1.5} />
        <line x1="140" y1="105" x2="200" y2="60" stroke="#b71c1c" strokeWidth={2} />
        <line x1="200" y1="60" x2="190" y2="110" stroke="#b71c1c" strokeWidth={1.5} />
        <line x1="190" y1="110" x2="170" y2="130" stroke="#b71c1c" strokeWidth={1.5} />
      </>
    );
  }
  return null;
}

export { SKIN_PRESETS };

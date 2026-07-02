// Lucide icon sprite source. Each used icon is imported as a raw SVG string
// (Vite inlines only these, not the full Lucide set) and turned into a sprite
// <symbol> once via IconSprite.svelte — so every on-page icon is a cheap
// <use href> instead of a Svelte component instance (the old @lucide/svelte
// components were the dominant per-navigation render cost).
//
// To add an icon: add its kebab name to this list and re-run; reference it as
// <LucideIcon name="that-name" />.
import activity from "lucide-static/icons/activity.svg?raw";
import appWindow from "lucide-static/icons/app-window.svg?raw";
import arrowUpDown from "lucide-static/icons/arrow-up-down.svg?raw";
import batteryFull from "lucide-static/icons/battery-full.svg?raw";
import bot from "lucide-static/icons/bot.svg?raw";
import box from "lucide-static/icons/box.svg?raw";
import boxes from "lucide-static/icons/boxes.svg?raw";
import braces from "lucide-static/icons/braces.svg?raw";
import cable from "lucide-static/icons/cable.svg?raw";
import chartNoAxesColumn from "lucide-static/icons/chart-no-axes-column.svg?raw";
import check from "lucide-static/icons/check.svg?raw";
import chevronDown from "lucide-static/icons/chevron-down.svg?raw";
import chevronLeft from "lucide-static/icons/chevron-left.svg?raw";
import chevronRight from "lucide-static/icons/chevron-right.svg?raw";
import circuitBoard from "lucide-static/icons/circuit-board.svg?raw";
import code from "lucide-static/icons/code.svg?raw";
import codeXml from "lucide-static/icons/code-xml.svg?raw";
import cpu from "lucide-static/icons/cpu.svg?raw";
import database from "lucide-static/icons/database.svg?raw";
import factory from "lucide-static/icons/factory.svg?raw";
import fileCog from "lucide-static/icons/file-cog.svg?raw";
import gitCompare from "lucide-static/icons/git-compare.svg?raw";
import gitCompareArrows from "lucide-static/icons/git-compare-arrows.svg?raw";
import globe from "lucide-static/icons/globe.svg?raw";
import grid2x2Check from "lucide-static/icons/grid-2x2-check.svg?raw";
import heart from "lucide-static/icons/heart.svg?raw";
import images from "lucide-static/icons/images.svg?raw";
import info from "lucide-static/icons/info.svg?raw";
import keyboard from "lucide-static/icons/keyboard.svg?raw";
import library from "lucide-static/icons/library.svg?raw";
import medal from "lucide-static/icons/medal.svg?raw";
import monitor from "lucide-static/icons/monitor.svg?raw";
import network from "lucide-static/icons/network.svg?raw";
import puzzle from "lucide-static/icons/puzzle.svg?raw";
import radio from "lucide-static/icons/radio.svg?raw";
import radioTower from "lucide-static/icons/radio-tower.svg?raw";
import ruler from "lucide-static/icons/ruler.svg?raw";
import satelliteDish from "lucide-static/icons/satellite-dish.svg?raw";
import search from "lucide-static/icons/search.svg?raw";
import sun from "lucide-static/icons/sun.svg?raw";
import tags from "lucide-static/icons/tags.svg?raw";
import terminal from "lucide-static/icons/terminal.svg?raw";
import trophy from "lucide-static/icons/trophy.svg?raw";
import wrench from "lucide-static/icons/wrench.svg?raw";
import x from "lucide-static/icons/x.svg?raw";
import zap from "lucide-static/icons/zap.svg?raw";

const RAW = new Map([
  ["activity", activity],
  ["app-window", appWindow],
  ["arrow-up-down", arrowUpDown],
  ["battery-full", batteryFull],
  ["bot", bot],
  ["box", box],
  ["boxes", boxes],
  ["braces", braces],
  ["cable", cable],
  ["chart-no-axes-column", chartNoAxesColumn],
  ["check", check],
  ["chevron-down", chevronDown],
  ["chevron-left", chevronLeft],
  ["chevron-right", chevronRight],
  ["circuit-board", circuitBoard],
  ["code", code],
  ["code-xml", codeXml],
  ["cpu", cpu],
  ["database", database],
  ["factory", factory],
  ["file-cog", fileCog],
  ["git-compare", gitCompare],
  ["git-compare-arrows", gitCompareArrows],
  ["globe", globe],
  ["grid-2x2-check", grid2x2Check],
  ["heart", heart],
  ["images", images],
  ["info", info],
  ["keyboard", keyboard],
  ["library", library],
  ["medal", medal],
  ["monitor", monitor],
  ["network", network],
  ["puzzle", puzzle],
  ["radio", radio],
  ["radio-tower", radioTower],
  ["ruler", ruler],
  ["satellite-dish", satelliteDish],
  ["search", search],
  ["sun", sun],
  ["tags", tags],
  ["terminal", terminal],
  ["trophy", trophy],
  ["wrench", wrench],
  ["x", x],
  ["zap", zap]
]);

// Lucide outlines carry their stroke styling on the outer <svg>; we strip that
// wrapper and re-apply it on a <g> so each symbol is self-contained (inherits
// currentColor, no host attributes needed).
const STROKE =
  "fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"";

export const LUCIDE_SYMBOLS = [...RAW].map(([name, svg]) => {
  const inner = svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .trim();
  return { id: `lu-${name}`, viewBox: "0 0 24 24", inner: `<g ${STROKE}>${inner}</g>` };
});

/** Names that have a bundled symbol (mirrors LucideIcon lookups). */
export const LUCIDE_NAMES = new Set(RAW.keys());

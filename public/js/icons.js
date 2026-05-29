import Baby from "../vendor/lucide/icons/baby.js";
import Calendar from "../vendor/lucide/icons/calendar.js";
import Clock from "../vendor/lucide/icons/clock.js";
import Plus from "../vendor/lucide/icons/plus.js";
import Trash from "../vendor/lucide/icons/trash.js";
import PenLine from "../vendor/lucide/icons/pen-line.js";
import Search from "../vendor/lucide/icons/search.js";
import ShieldCheck from "../vendor/lucide/icons/shield-check.js";
import BookOpenCheck from "../vendor/lucide/icons/book-open-check.js";
import ClipboardCheck from "../vendor/lucide/icons/clipboard-check.js";
import Stethoscope from "../vendor/lucide/icons/stethoscope.js";
import Syringe from "../vendor/lucide/icons/syringe.js";
import Moon from "../vendor/lucide/icons/moon.js";
import Utensils from "../vendor/lucide/icons/utensils.js";
import BedDouble from "../vendor/lucide/icons/bed-double.js";
import Bath from "../vendor/lucide/icons/bath.js";
import ShowerHead from "../vendor/lucide/icons/shower-head.js";
import Trees from "../vendor/lucide/icons/trees.js";
import Pill from "../vendor/lucide/icons/pill.js";
import NotebookText from "../vendor/lucide/icons/notebook-text.js";
import UserPlus from "../vendor/lucide/icons/user-plus.js";
import Database from "../vendor/lucide/icons/database.js";
import ExternalLink from "../vendor/lucide/icons/external-link.js";
import Save from "../vendor/lucide/icons/save.js";
import X from "../vendor/lucide/icons/x.js";
import Check from "../vendor/lucide/icons/check.js";
import CircleAlert from "../vendor/lucide/icons/circle-alert.js";
import Settings from "../vendor/lucide/icons/settings.js";
import Menu from "../vendor/lucide/icons/menu.js";
import Milk from "../vendor/lucide/icons/milk.js";
import DoorOpen from "../vendor/lucide/icons/door-open.js";
import School from "../vendor/lucide/icons/school.js";
import House from "../vendor/lucide/icons/house.js";
import HandHeart from "../vendor/lucide/icons/hand-heart.js";
import Bus from "../vendor/lucide/icons/bus.js";
import AlarmClock from "../vendor/lucide/icons/alarm-clock.js";
import Timer from "../vendor/lucide/icons/timer.js";

const h = React.createElement;

const icons = {
  baby: Baby,
  calendar: Calendar,
  clock: Clock,
  plus: Plus,
  trash: Trash,
  edit: PenLine,
  search: Search,
  shield: ShieldCheck,
  book: BookOpenCheck,
  checklist: ClipboardCheck,
  health: Stethoscope,
  vaccine: Syringe,
  sleep: Moon,
  feeding: Utensils,
  meal: Utensils,
  nap: BedDouble,
  bath: Bath,
  shower: ShowerHead,
  walk: Trees,
  medicine: Pill,
  note: NotebookText,
  profile: UserPlus,
  database: Database,
  external: ExternalLink,
  save: Save,
  close: X,
  check: Check,
  alert: CircleAlert,
  settings: Settings,
  menu: Menu,
  formula: Milk,
  daycare: School,
  home: House,
  pickup: DoorOpen,
  care: HandHeart,
  bus: Bus,
  alarm: AlarmClock,
  timer: Timer
};

export function Icon({ name, size = 18, strokeWidth = 2 }) {
  const icon = icons[name] || CircleAlert;

  return h(
    "svg",
    {
      className: "icon",
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    icon.map(([tag, attrs], index) => h(tag, { ...attrs, key: index }))
  );
}

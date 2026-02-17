import {
  useState,
  useRef,
  useEffect,
  type CSSProperties,
  type FC,
  type ReactNode,
  type KeyboardEvent,
  type ChangeEvent,
  type JSX,
} from "react";
import * as XLSX from "xlsx";

// ══════════════════════════════════════════════════════════
//  🔧  CONFIG
// ══════════════════════════════════════════════════════════
const SHEETS_URL =
  "https://script.google.com/macros/s/AKfycby89qyw6LjfgokbFUQxF_c699bdEGX2mI4SDWcDz-t8GeEgUIjoTHF10xgo813nghUL1A/exec";
/*
  ┌─ SETUP — Google Sheets ─────────────────────────────────┐
  │  1. sheets.google.com → жаңы таблица                    │
  │  2. Кеңейтүүлөр → Apps Script → код кош:                │
  │                                                         │
  │  function doPost(e) {                                   │
  │    const s=SpreadsheetApp                               │
  │      .getActiveSpreadsheet().getActiveSheet();          │
  │    if(s.getLastRow()===0){                              │
  │      s.appendRow(["№","Дата","АИА","Телефон","Шаар",    │
  │        "График","Тажрыйба","Багыт","Айлык","Башталуу",  │
  │        "Жөндөмдөр","Тилдер","Өзү жөнүндө","Булак"]);   │
  │      s.getRange(1,1,1,14)                               │
  │        .setBackground("#1855c4")                        │
  │        .setFontColor("#fff").setFontWeight("bold");     │
  │      s.setFrozenRows(1);                                │
  │    }                                                    │
  │    const d=JSON.parse(e.postData.contents);             │
  │    const n=s.getLastRow();                              │
  │    const ts=Utilities.formatDate(new Date(),            │
  │      "Asia/Bishkek","dd.MM.yyyy HH:mm");                │
  │    s.appendRow([n,ts,d.name,d.phone,d.city,             │
  │      d.schedule,d.experience,d.salesType,               │
  │      d.salary,d.startDate,d.skills,d.languages,         │
  │      d.about,d.source]);                                │
  │    return ContentService                                │
  │      .createTextOutput(JSON.stringify({ok:true}))       │
  │      .setMimeType(ContentService.MimeType.JSON);        │
  │  }                                                      │
  │  function doGet(){                                      │
  │    return ContentService                                │
  │      .createTextOutput(JSON.stringify({ok:true}))       │
  │      .setMimeType(ContentService.MimeType.JSON);        │
  │  }                                                      │
  │                                                         │
  │  3. Жайгаштыруу → Веб-колдонмо                         │
  │     · Аткаруу: Мен   · Мүмкүнчүлүк: Баардыгы           │
  │  4. URL көчүрүп → SHEETS_URL ге чаптоо                  │
  └─────────────────────────────────────────────────────────┘
*/

// ══════════════════════════════════════════════════════════
//  TYPES
// ══════════════════════════════════════════════════════════

type Step = "form" | "thanks" | "login" | "admin";
type ScheduleId = "morning" | "evening" | "any";
type SalesTypeId = "b2c" | "b2b" | "tele" | "online";
type TagColor = "blue" | "green" | "red" | "kg";
type Breakpoint = "mobile" | "tablet" | "desktop";
type LangLevel = 1 | 2 | 3 | 4 | 5;

interface LangItem {
  id: string;
  label: string;
  level: LangLevel;
}

interface FormState {
  name: string;
  phone: string;
  city: string;
  schedule: ScheduleId | "";
  experience: string;
  salesType: SalesTypeId[];
  salary: string;
  startDate: string;
  languages: LangItem[];
  about: string;
  source: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

interface Application extends Omit<
  FormState,
  "salesType" | "schedule" | "skills" | "languages"
> {
  salesType: string;
  schedule: string;
  languages: string;
  ts: string;
  id: number;
}

interface Schedule {
  id: ScheduleId;
  emoji: string;
  label: string;
  time: string;
  sub: string;
  hours: number[];
}

interface SalesType {
  id: SalesTypeId;
  label: string;
  desc: string;
}

// ══════════════════════════════════════════════════════════
//  CONSTANTS  (Кыргызча)
// ══════════════════════════════════════════════════════════

const STORAGE_KEY = "sales_apps_kg_v1";

const LANG_OPTIONS = [
  { id: "ky", label: "Кыргызча" },
  { id: "ru", label: "Орусча" },
  { id: "en", label: "Англисче" },
  { id: "zh", label: "Кытайча" },
  { id: "tr", label: "Түркчө" },
];

const LEVEL_LABELS: Record<LangLevel, string> = {
  1: "Башталгыч",
  2: "Орточо",
  3: "Жакшы",
  4: "Өтө жакшы",
  5: "Эркин",
};

const LEVEL_COLORS: Record<LangLevel, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#eab308",
  4: "#22c55e",
  5: "#1a73e8",
};

const INIT_LANGS: LangItem[] = [
  { id: "ky", label: "Кыргызча", level: 5 },
  { id: "ru", label: "Орусча", level: 3 },
];

const INIT: FormState = {
  name: "",
  phone: "",
  city: "",
  schedule: "",
  experience: "",
  salesType: [],
  salary: "",
  startDate: "",
  languages: INIT_LANGS,
  about: "",
  source: "",
};

const SCHEDULES: Schedule[] = [
  {
    id: "morning",
    emoji: "🌅",
    label: "Эртең – Күндүз",
    time: "10:00 – 18:00",
    sub: "Дш–Шб · эс алуу: жекшемби + 1 жумуш күнү",
    hours: [10, 11, 12, 13, 14, 15, 16, 17],
  },
  {
    id: "evening",
    emoji: "🌆",
    label: "Күндүз – Кеч",
    time: "14:00 – 22:00",
    sub: "Дш–Шб · эс алуу: жекшемби + 1 жумуш күнү",
    hours: [14, 15, 16, 17, 18, 19, 20, 21],
  },
  {
    id: "any",
    emoji: "✅",
    label: "Каалаган",
    time: "Экөө тең",
    sub: "Каалаган убакытта иштөөгө даярмын",
    hours: [],
  },
];

const SALES_TYPES: SalesType[] = [
  { id: "b2c", label: "B2C", desc: "Жеке адамдарга сатуу" },
  { id: "b2b", label: "B2B", desc: "Корпоративдик кардарлар" },
  { id: "tele", label: "Телемаркетинг", desc: "Муздак чалуулар" },
  { id: "online", label: "Онлайн", desc: "Мессенджерлер / соцтармактар" },
];

const ALL_HOURS: number[] = [
  8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
];

const HINTS: Partial<Record<keyof FormState, string>> = {
  name: "Толук аты-жөңүздү жазыңыз: Фамилия Аты Атасынын аты",
  phone: "Биз ушул номерге чалып, жолугушуга чакырабыз",
  city: "Иштөөгө даяр шаарыңызды көрсөтүңүз",
  schedule: "Ыңгайлуу иш убактыңызды тандаңыз — жолугушууда талкуулай алабыз",
  experience: "Тажрыйба болбосо да жарайт — биз нөлдөн үйрөтөбүз",
  salesType: "Тажрыйбаңыз же кызыгуу бар бардык багытты белгилеңиз",
  salary: "Каалаган айлыгыңызды айтыңыз — биз компромисс табабыз",
  startDate: "Учурдагы иштен чыгуу убактыңыз болсо, айтыңыз",
  languages: "Сүйлөгөн тилдериңизди жана деңгээлиңизди белгилеңиз",
  about: "Эң жакшы натыйжаларыңыз, жетишкендиктериңиз жөнүндө айтып бериңиз",
  source: "Биз жакшы кандидаттарды кайдан таба аларыбызды билгибиз келет",
};

// ══════════════════════════════════════════════════════════
//  HOOKS
// ══════════════════════════════════════════════════════════

function useBreakpoint(): Breakpoint {
  const get = (): Breakpoint => {
    const w = window.innerWidth;
    if (w < 600) return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  };
  const [bp, setBp] = useState<Breakpoint>(get);
  useEffect(() => {
    const h = () => setBp(get());
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return bp;
}

// ══════════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════════

function loadApps(): Application[] {
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    ) as Application[];
  } catch {
    return [];
  }
}
function saveApps(apps: Application[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
}

// Кыргызстан телефон форматы: +996 (7XX) XXX-XXX
function phoneMaskKG(value: string): string {
  let v = value.replace(/\D/g, "");
  if (v.startsWith("0")) v = "996" + v.slice(1);
  if (!v.startsWith("996")) v = "996" + v;
  v = v.slice(0, 12);
  let o = "";
  if (v.length > 0) o = "+996";
  if (v.length > 3) o += " (" + v.slice(3, 6);
  if (v.length > 6) o += ") " + v.slice(6, 9);
  if (v.length > 9) o += "-" + v.slice(9, 12);
  return o;
}

function formatLangs(langs: LangItem[]): string {
  return langs.map((l) => `${l.label} — ${LEVEL_LABELS[l.level]}`).join("; ");
}

async function sendToSheets(entry: Application): Promise<void> {
  console.log("Sending to Sheets:", entry);
  await fetch(SHEETS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: entry.name,
      phone: entry.phone,
      city: entry.city,
      schedule: entry.schedule,
      experience: entry.experience,
      salesType: entry.salesType,
      salary: entry.salary,
      startDate: entry.startDate,
      languages: entry.languages,
      about: entry.about,
      source: entry.source,
    }),
  });
}

function exportExcel(apps: Application[]): void {
  const rows = apps.map((a, i) => ({
    "№": i + 1,
    Дата: a.ts,
    АИА: a.name,
    Телефон: a.phone,
    Шаар: a.city,
    График: a.schedule,
    Тажрыйба: a.experience,
    Багыт: a.salesType,
    Айлык: a.salary,
    Башталуу: a.startDate,
    Тилдер: a.languages,
    "Өзү жөнүндө": a.about,
    Булак: a.source,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [4, 16, 24, 16, 14, 22, 20, 22, 18, 16, 30, 28, 35, 16].map(
    (w) => ({ wch: w }),
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Арыздар");
  XLSX.writeFile(
    wb,
    `Арыздар_${new Date().toLocaleDateString("ru-RU").replace(/\./g, "-")}.xlsx`,
  );
}

// ══════════════════════════════════════════════════════════
//  APP
// ══════════════════════════════════════════════════════════

export default function App(): JSX.Element {
  const [form, setForm] = useState<FormState>(INIT);
  const [errors, setErrors] = useState<FormErrors>({});
  const [step, setStep] = useState<Step>("form");
  const [apps, setApps] = useState<Application[]>(loadApps);
  const [sending, setSending] = useState<boolean>(false);
  const [sendErr, setSendErr] = useState<boolean>(false);
  const [pass, setPass] = useState<string>("");
  const [passErr, setPassErr] = useState<boolean>(false);
  const topRef = useRef<HTMLDivElement>(null);
  const bp = useBreakpoint();
  const isDesktop = bp === "desktop";
  const isMobile = bp === "mobile";

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [step]);

  const upd = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ): void => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const toggleType = (id: SalesTypeId): void =>
    upd(
      "salesType",
      form.salesType.includes(id)
        ? form.salesType.filter((x) => x !== id)
        : [...form.salesType, id],
    );

  // Languages
  const addLang = (id: string): void => {
    const opt = LANG_OPTIONS.find((l) => l.id === id);
    if (!opt || form.languages.find((l) => l.id === id)) return;
    upd("languages", [
      ...form.languages,
      { id: opt.id, label: opt.label, level: 3 },
    ]);
  };
  const removeLang = (id: string): void =>
    upd(
      "languages",
      form.languages.filter((l) => l.id !== id),
    );
  const setLangLevel = (id: string, level: LangLevel): void =>
    upd(
      "languages",
      form.languages.map((l) => (l.id === id ? { ...l, level } : l)),
    );

  function validate(): boolean {
    const e: FormErrors = {};
    if (form.name.trim().length < 2) e.name = "АИАңызды жазыңыз";
    if (form.phone.replace(/\D/g, "").length < 12)
      e.phone = "Туура номер киргизиңиз";
    if (form.city.trim().length < 2) e.city = "Шаарыңызды жазыңыз";
    if (!form.schedule) e.schedule = "Графикти тандаңыз";
    if (!form.experience) e.experience = "Тажрыйбаңызды көрсөтүңүз";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(): Promise<void> {
    if (!validate()) return;
    setSending(true);
    setSendErr(false);
    const sched = SCHEDULES.find((s) => s.id === form.schedule);
    const ts = new Date().toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const entry: Application = {
      ...form,
      schedule: sched
        ? `${sched.emoji} ${sched.label} · ${sched.time}`
        : form.schedule,
      salesType: form.salesType
        .map((id) => SALES_TYPES.find((t) => t.id === id)?.label ?? id)
        .join(", "),

      languages: formatLangs(form.languages),
      ts,
      id: Date.now(),
    };
    try {
      await sendToSheets(entry);
      const updated = [...apps, entry];
      setApps(updated);
      saveApps(updated);
      setStep("thanks");
    } catch {
      setSendErr(true);
    } finally {
      setSending(false);
    }
  }

  function tryLogin(): void {
    if (pass === "hr2024") {
      setStep("admin");
      setPassErr(false);
    } else setPassErr(true);
  }

  function reset(): void {
    setForm(INIT);
    setErrors({});
    setStep("form");
  }

  const formProps = {
    isDesktop,
    isMobile,
    form,
    errors,
    upd,
    toggleType,

    addLang,
    removeLang,
    setLangLevel,
    sending,
    sendErr,
    onSubmit: handleSubmit,
    onAdminNav: () => setStep("login"),
  };

  return (
    <div style={lay.page(isMobile)}>
      <div ref={topRef} />
      <div style={$.pageBg} />
      {step === "form" && <FormPage {...formProps} />}
      {step === "thanks" && <ThanksPage onReset={reset} />}
      {step === "login" && (
        <LoginPage
          pass={pass}
          setPass={setPass}
          err={passErr}
          onLogin={tryLogin}
          onBack={() => setStep("form")}
        />
      )}
      {step === "admin" && (
        <AdminPage
          isMobile={isMobile}
          apps={apps}
          onExport={() => exportExcel(apps)}
          onBack={() => setStep("form")}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  FORM PAGE
// ══════════════════════════════════════════════════════════

interface FormPageProps {
  isDesktop: boolean;
  isMobile: boolean;
  form: FormState;
  errors: FormErrors;
  upd: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  toggleType: (id: SalesTypeId) => void;

  addLang: (id: string) => void;
  removeLang: (id: string) => void;
  setLangLevel: (id: string, lv: LangLevel) => void;
  sending: boolean;
  sendErr: boolean;
  onSubmit: () => void;
  onAdminNav: () => void;
}

const FormPage: FC<FormPageProps> = ({
  isDesktop,
  isMobile,
  form,
  errors,
  upd,
  toggleType,

  addLang,
  removeLang,
  setLangLevel,
  sending,
  sendErr,
  onSubmit,
  onAdminNav,
}) => (
  <div style={isDesktop ? lay.desktopWrap : lay.wrap(isMobile)}>
    {/* ── Main column ── */}
    <div style={isDesktop ? lay.leftCol : undefined}>
      {/* Hero */}
      <div style={$.hero}>
        <div style={$.heroBar} />
        <div style={lay.heroPad(isMobile)}>
          <div style={$.heroTop}>
            <div style={$.heroBadge}>💼</div>
            <span style={$.heroOrg}>Кадрлар бөлүмү · Арыз берүү</span>
          </div>
          <h1 style={lay.heroTitle(isMobile)}>Сатуу менеджери</h1>
          <p style={$.heroDesc}>
            Арызды толтуруңуз — биз 1–2 жумуш күнүнүн ичинде байланышабыз
          </p>
          <div style={$.heroTags}>
            <Tag color="kg">🇰🇬 Бишкек</Tag>
            <Tag color="blue">🏢 Офис · 6/1</Tag>
            <Tag color="green">💰 Айлык + %</Tag>
            <Tag color="red">🔥 Шашылыш набор</Tag>
          </div>
        </div>
      </div>

      {/* Жеке маалыматтар */}
      <Section icon="👤" title="Жеке маалыматтар" isMobile={isMobile}>
        <FField label="Аты-жөнү" req err={errors.name} hint={HINTS.name}>
          <input
            style={iS(errors.name)}
            placeholder="Алиев Азамат Болотович"
            value={form.name}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              upd("name", e.target.value)
            }
          />
        </FField>
        <TwoCol isMobile={isMobile}>
          <FField
            label="Телефон номери"
            req
            err={errors.phone}
            hint={HINTS.phone}
          >
            <input
              style={iS(errors.phone)}
              placeholder="+996 (7__) ___-___"
              value={form.phone}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                upd("phone", phoneMaskKG(e.target.value))
              }
            />
          </FField>
          <FField label="Шаар" req err={errors.city} hint={HINTS.city}>
            <input
              style={iS(errors.city)}
              placeholder="Бишкек"
              value={form.city}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                upd("city", e.target.value)
              }
            />
          </FField>
        </TwoCol>
      </Section>

      {/* График */}
      <Section icon="🕐" title="Иш графиги" isMobile={isMobile}>
        {errors.schedule && <div style={$.errBanner}>⚠️ {errors.schedule}</div>}
        <Hint text={HINTS.schedule} />
        <div style={$.schedGrid}>
          {SCHEDULES.map((s) => {
            const active = form.schedule === s.id;
            return (
              <button
                key={s.id}
                onClick={() => upd("schedule", s.id)}
                style={{ ...$.schedBtn, ...(active ? $.schedOn : {}) }}
              >
                {active && <span style={$.schedCheck}>✓</span>}
                <div style={$.schedEmoji}>{s.emoji}</div>
                <div style={$.schedName}>{s.label}</div>
                <div style={$.schedTime}>{s.time}</div>
                <div style={$.schedSub}>{s.sub}</div>
                {s.hours.length > 0 && (
                  <div style={$.hourRow}>
                    {ALL_HOURS.map((h) => (
                      <span
                        key={h}
                        style={{
                          ...$.hour,
                          ...(s.hours.includes(h) ? $.hourOn : $.hourOff),
                        }}
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Тажрыйба */}
      <Section icon="📋" title="Тажрыйба жана багыт" isMobile={isMobile}>
        <FField
          label="Сатуудагы тажрыйба"
          req
          err={errors.experience}
          hint={HINTS.experience}
        >
          <select
            style={sS(errors.experience)}
            value={form.experience}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              upd("experience", e.target.value)
            }
          >
            <option value="">— Тандаңыз —</option>
            {[
              "Тажрыйба жок (үйрөнүүгө даярмын)",
              "1 жылга чейин",
              "1–3 жыл",
              "3–5 жыл",
              "5 жылдан ашык",
            ].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </FField>

        <FField
          label="Сатуу багыты (бир нече болушу мүмкүн)"
          hint={HINTS.salesType}
        >
          <div style={lay.typeGrid(isMobile)}>
            {SALES_TYPES.map((t) => {
              const active = form.salesType.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleType(t.id)}
                  style={{ ...$.typeBtn, ...(active ? $.typeBtnOn : {}) }}
                >
                  <span
                    style={{ fontSize: 16, color: "#1855c4", flexShrink: 0 }}
                  >
                    {active ? "☑" : "☐"}
                  </span>
                  <span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#202124",
                      }}
                    >
                      {t.label}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 11,
                        color: "#5f6368",
                      }}
                    >
                      {t.desc}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </FField>

        <TwoCol isMobile={isMobile}>
          <FField label="Күтүлгөн айлык" hint={HINTS.salary}>
            <select
              style={sS()}
              value={form.salary}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                upd("salary", e.target.value)
              }
            >
              <option value="">— Тандаңыз —</option>
              {[
                "30 000 сомго чейин",
                "30 000–50 000 сом",
                "50 000–80 000 сом",
                "80 000 сомдон ашык",
                "Талкуулоодо",
              ].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </FField>
          <FField label="Качан башташка даярсыз?" hint={HINTS.startDate}>
            <select
              style={sS()}
              value={form.startDate}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                upd("startDate", e.target.value)
              }
            >
              <option value="">— Тандаңыз —</option>
              {[
                "Дароо",
                "1 жумадан кийин",
                "2 жумадан кийин",
                "1 айдан кийин",
              ].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </FField>
        </TwoCol>
      </Section>

      {/* Тилдер */}
      <Section icon="🌐" title="Тилдер (Языки)" isMobile={isMobile}>
        <Hint text={HINTS.languages} />
        <LangEditor
          items={form.languages}
          options={LANG_OPTIONS}
          onAdd={addLang}
          onRemove={removeLang}
          onLevel={setLangLevel}
        />
      </Section>

      {/* Кошумча */}
      <Section icon="💬" title="Кошумча маалымат" isMobile={isMobile}>
        <FField label="Өзүңүз жөнүндө айтыңыз" hint={HINTS.about}>
          <textarea
            style={{ ...iS(), minHeight: 96, resize: "vertical" }}
            placeholder="Эң жакшы жетишкендиктериңиз, мотивацияңыз, эмне үчүн бизде иштегиңиз келет..."
            value={form.about}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              upd("about", e.target.value)
            }
          />
        </FField>
        <FField label="Биз жөнүндө кайдан уктуңуз?" hint={HINTS.source}>
          <select
            style={sS()}
            value={form.source}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              upd("source", e.target.value)
            }
          >
            <option value="">— Тандаңыз —</option>
            {[
              "Hh.kg (HeadHunter)",
              "Нomework.kg",
              "Dostuk (Дос айтты)",
              "Социалдык тармактар",
              "Башка",
            ].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </FField>
      </Section>

      {/* Submit */}
      <div style={lay.submitWrap(isMobile)}>
        {sendErr && (
          <div style={$.sendErrBanner}>
            ⚠️ Жиберүү мүмкүн болбоду. Интернет байланышын текшерип, кайра
            аракет кылыңыз.
          </div>
        )}
        <button
          style={{
            ...$.btnMain,
            ...(sending ? { opacity: 0.72, cursor: "not-allowed" } : {}),
          }}
          onClick={onSubmit}
          disabled={sending}
        >
          {sending ? (
            <>
              <Spin /> Жиберилүүдө…
            </>
          ) : (
            "Арызды жиберүү →"
          )}
        </button>
        <button style={$.adminLink} onClick={onAdminNav}>
          HR үчүн кирүү
        </button>
      </div>
    </div>

    {/* ── Right sidebar (desktop only) ── */}
    {isDesktop && (
      <div style={lay.rightCol}>
        <SidebarInfo />
      </div>
    )}
  </div>
);

// ══════════════════════════════════════════════════════════
//  LANGUAGE EDITOR
// ══════════════════════════════════════════════════════════

interface LangEditorProps {
  items: LangItem[];
  options: { id: string; label: string }[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onLevel: (id: string, lv: LangLevel) => void;
}

const LangEditor: FC<LangEditorProps> = ({
  items,
  options,
  onAdd,
  onRemove,
  onLevel,
}) => {
  const remaining = options.filter((o) => !items.find((i) => i.id === o.id));
  return (
    <div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 12,
        }}
      >
        {items.map((item) => (
          <ScaleRow
            key={item.id}
            label={item.label}
            level={item.level}
            onLevel={(lv) => onLevel(item.id, lv)}
            onRemove={() => onRemove(item.id)}
          />
        ))}
      </div>
      {remaining.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {remaining.map((o) => (
            <button
              key={o.id}
              onClick={() => onAdd(o.id)}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 20,
                border: "1.5px dashed #b6e8d0",
                background: "#f0fdf4",
                color: "#0f7d47",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              + {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════
//  SCALE ROW — общий компонент для навыков и языков
// ══════════════════════════════════════════════════════════

interface ScaleRowProps {
  label: string;
  level: LangLevel;
  onLevel: (lv: LangLevel) => void;
  onRemove: () => void;
}

const ScaleRow: FC<ScaleRowProps> = ({ label, level, onLevel, onRemove }) => (
  <div style={$.scaleRow}>
    <div style={$.scaleLabel}>{label}</div>
    <div style={$.scaleDots}>
      {([1, 2, 3, 4, 5] as LangLevel[]).map((n) => (
        <button
          key={n}
          onClick={() => onLevel(n)}
          title={LEVEL_LABELS[n]}
          style={{
            ...$.scaleDot,
            background: n <= level ? LEVEL_COLORS[level] : "#e5e7eb",
            transform: n === level ? "scale(1.25)" : "scale(1)",
          }}
        />
      ))}
      <span style={{ ...$.scaleLvlLabel, color: LEVEL_COLORS[level] }}>
        {LEVEL_LABELS[level]}
      </span>
    </div>
    <button onClick={onRemove} style={$.scaleRemove}>
      ✕
    </button>
  </div>
);

// ══════════════════════════════════════════════════════════
//  DESKTOP SIDEBAR
// ══════════════════════════════════════════════════════════

const SidebarInfo: FC = () => (
  <div style={side.root}>
    <div style={side.card}>
      <div style={side.cardTitle}>📌 Вакансия</div>
      {[
        ["💼", "Сатуу менеджери"],
        ["🏢", "Офис · 6/1 график"],
        ["📍", "Бишкек, борбордук офис"],
        ["💰", "Айлык + сатуудан %"],
      ].map(([ic, tx]) => (
        <div key={tx} style={side.vacLine}>
          <span style={side.vacIcon}>{ic}</span>
          <span>{tx}</span>
        </div>
      ))}
      <div style={side.divider} />
      <div style={side.cardTitle}>🕐 Иш убактысы</div>
      <div style={side.shiftRow}>
        {[
          ["🌅", "Эртең", "10:00–18:00"],
          ["🌆", "Кеч", "14:00–22:00"],
        ].map(([ic, lb, tm]) => (
          <div key={lb} style={side.shiftCard}>
            <div style={side.shiftLabel}>
              {ic} {lb}
            </div>
            <div style={side.shiftTime}>{tm}</div>
          </div>
        ))}
      </div>
    </div>

    <div style={side.card}>
      <div style={side.cardTitle}>🎁 Биз сунуштайбыз</div>
      {[
        ["📈", "Кирешеге чек жок"],
        ["🎓", "Биринчи күндөн окутуу"],
        ["🏆", "Эң жакшы кызматкерге бонус"],
        ["👥", "Жаш жана дос жамаат"],
        ["📊", "CRM жана кардарлар базасы"],
        ["☕", "Жабдылган офис, ашкана"],
      ].map(([ic, tx]) => (
        <div key={tx} style={side.offerRow}>
          <span style={side.offerIcon}>{ic}</span>
          <span style={side.offerText}>{tx}</span>
        </div>
      ))}
    </div>

    <div style={side.card}>
      <div style={side.cardTitle}>📋 Кабыл алуу процесси</div>
      {[
        ["1", "Арыз жибер"],
        ["2", "HR чалат (1–2 күн)"],
        ["3", "Офисте маектешүү"],
        ["4", "Оффер → ишке чык"],
      ].map(([n, tx]) => (
        <div key={n} style={side.stepRow}>
          <span style={side.stepNum}>{n}</span>
          <span style={side.stepText}>{tx}</span>
        </div>
      ))}
    </div>

    <div style={side.card}>
      <div style={side.cardTitle}>📞 HR байланышы</div>
      {[
        ["📱", "+996 (700) 000-000"],
        ["✉️", "hr@company.kg"],
        ["🕘", "Дш–Жм, 09:00–18:00"],
      ].map(([ic, tx]) => (
        <div
          key={tx}
          style={{
            ...side.contactRow,
            fontSize: tx.startsWith("Дш") ? 11 : 13,
          }}
        >
          <span>{ic}</span>
          <span style={{ color: tx.startsWith("Дш") ? "#5f6368" : "#3c4043" }}>
            {tx}
          </span>
        </div>
      ))}
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════
//  THANKS PAGE
// ══════════════════════════════════════════════════════════

const ThanksPage: FC<{ onReset: () => void }> = ({ onReset }) => (
  <div style={$.centerWrap}>
    <div style={$.thanksCard}>
      <div style={{ fontSize: 64, marginBottom: 18 }}>🎉</div>
      <h2 style={$.thanksTitle}>Арызыңыз кабыл алынды!</h2>
      <p style={$.thanksSub}>
        Биздин вакансиябызга кызыгуу билдиргениңизге рахмат.
        <br />
        HR адиси арызыңызды карап, <strong>1–2 жумуш күнүнүн ичинде</strong>
        <br />
        байланышат.
      </p>
      <div style={$.thanksHint}>📞 Телефонуңузга чалуу же билдирүү күтүңүз</div>
      <button style={$.btnMain} onClick={onReset}>
        Дагы бир арыз берүү
      </button>
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════
//  LOGIN PAGE
// ══════════════════════════════════════════════════════════

interface LoginPageProps {
  pass: string;
  setPass: (v: string) => void;
  err: boolean;
  onLogin: () => void;
  onBack: () => void;
}
const LoginPage: FC<LoginPageProps> = ({
  pass,
  setPass,
  err,
  onLogin,
  onBack,
}) => (
  <div style={$.centerWrap}>
    <div style={$.loginCard}>
      <div style={{ fontSize: 46, marginBottom: 14 }}>🔐</div>
      <h2 style={$.loginTitle}>HR кирүүсү</h2>
      <input
        style={{
          ...iS(err ? "err" : undefined),
          marginBottom: err ? 4 : 16,
          textAlign: "center",
          letterSpacing: 4,
        }}
        type="password"
        placeholder="••••••••"
        value={pass}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setPass(e.target.value)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) =>
          e.key === "Enter" && onLogin()
        }
      />
      {err && (
        <div
          style={{
            fontSize: 12,
            color: "#d93025",
            marginBottom: 14,
            textAlign: "center",
          }}
        >
          Сырсөз туура эмес
        </div>
      )}
      <button style={$.btnMain} onClick={onLogin}>
        Кирүү
      </button>
      <button style={$.btnBack} onClick={onBack}>
        ← Арызга кайтуу
      </button>
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════
//  ADMIN PAGE
// ══════════════════════════════════════════════════════════

interface AdminPageProps {
  isMobile: boolean;
  apps: Application[];
  onExport: () => void;
  onBack: () => void;
}
const AdminPage: FC<AdminPageProps> = ({
  isMobile,
  apps,
  onExport,
  onBack,
}) => (
  <div style={lay.wrap(isMobile)}>
    <div style={lay.adminBar(isMobile)}>
      <div>
        <div style={$.adminTitle}>📊 HR Панели</div>
        <div style={{ fontSize: 12, color: "#5f6368", marginTop: 2 }}>
          Арыздар саны: <strong>{apps.length}</strong>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          style={{
            ...$.btnExcel,
            ...(!apps.length ? { opacity: 0.5, cursor: "not-allowed" } : {}),
          }}
          onClick={onExport}
          disabled={!apps.length}
        >
          ⬇ Excel жүктөө ({apps.length})
        </button>
        <button style={$.btnBack} onClick={onBack}>
          ← Арызга
        </button>
      </div>
    </div>

    {apps.length === 0 ? (
      <div style={$.empty}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
        <div style={{ color: "#5f6368", fontSize: 15 }}>
          Азырынча арыздар жок
        </div>
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[...apps].reverse().map((a, i) => (
          <div key={a.id} style={$.appCard}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={$.appNum}>#{apps.length - i}</span>
              <span style={{ fontSize: 11, color: "#9aa0a6" }}>{a.ts}</span>
              <span style={{ ...$.tag, ...$.tagBlue, marginLeft: "auto" }}>
                {a.schedule?.includes("·")
                  ? a.schedule.split("·")[1]?.trim()
                  : a.schedule}
              </span>
            </div>
            <div
              style={{
                fontSize: isMobile ? 14 : 16,
                fontWeight: 800,
                color: "#202124",
                marginBottom: 6,
              }}
            >
              {a.name}
            </div>
            <div
              style={{
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
                fontSize: 13,
                color: "#3c4043",
                marginBottom: 4,
              }}
            >
              <span>📞 {a.phone}</span>
              <span>📍 {a.city}</span>
            </div>
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                fontSize: 12,
                color: "#5f6368",
                marginBottom: 6,
              }}
            >
              <span>💼 {a.experience}</span>
              {a.salary && <span>💰 {a.salary}</span>}
              {a.startDate && <span>📅 {a.startDate}</span>}
            </div>
            {a.salesType && (
              <span
                style={{
                  ...$.tag,
                  ...$.tagGreen,
                  display: "inline-block",
                  marginBottom: 4,
                }}
              >
                {a.salesType}
              </span>
            )}
            {a.languages && (
              <div
                style={{
                  fontSize: 12,
                  color: "#3c4043",
                  marginTop: 4,
                  marginBottom: 2,
                }}
              >
                🌐 {a.languages}
              </div>
            )}

            {a.about && (
              <div
                style={{
                  fontSize: 12,
                  color: "#5f6368",
                  fontStyle: "italic",
                  paddingLeft: 10,
                  borderLeft: "3px solid #e8f0fe",
                  lineHeight: 1.55,
                  marginTop: 6,
                }}
              >
                "{a.about}"
              </div>
            )}
            {a.source && (
              <div style={{ fontSize: 11, color: "#bbb", marginTop: 6 }}>
                Булак: {a.source}
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

// ══════════════════════════════════════════════════════════
//  REUSABLE COMPONENTS
// ══════════════════════════════════════════════════════════

interface SectionProps {
  icon: string;
  title: string;
  children: ReactNode;
  isMobile: boolean;
}
const Section: FC<SectionProps> = ({ icon, title, children, isMobile }) => (
  <div style={lay.section(isMobile)}>
    <div style={$.secTitle}>
      <span>{icon}</span>
      {title}
    </div>
    {children}
  </div>
);

interface TwoColProps {
  children: ReactNode;
  isMobile: boolean;
}
const TwoCol: FC<TwoColProps> = ({ children, isMobile }) => (
  <div
    style={{
      display: "flex",
      gap: 14,
      flexDirection: isMobile ? "column" : "row",
    }}
  >
    {children}
  </div>
);

interface FFieldProps {
  label: string;
  req?: boolean;
  err?: string;
  hint?: string;
  children: ReactNode;
}
const FField: FC<FFieldProps> = ({ label, req, err, hint, children }) => (
  <div style={{ marginBottom: 18, flex: 1, minWidth: 0 }}>
    <label style={$.label}>
      {label}
      {req && <span style={{ color: "#e53935" }}> *</span>}
    </label>
    {children}
    {hint && !err && <Hint text={hint} />}
    {err && <div style={$.errText}>{err}</div>}
  </div>
);

const Hint: FC<{ text?: string }> = ({ text }) =>
  text ? <div style={$.hint}>💡 {text}</div> : null;

interface TagProps {
  color: TagColor;
  children: ReactNode;
}
const Tag: FC<TagProps> = ({ color, children }) => {
  const styles: Record<TagColor, CSSProperties> = {
    blue: { color: "#1855c4", borderColor: "#c5d9fb", background: "#eaf1ff" },
    green: { color: "#0f7d47", borderColor: "#b6e8d0", background: "#e6f8ef" },
    red: { color: "#b91c1c", borderColor: "#fecaca", background: "#fff0f0" },
    kg: { color: "#c41818", borderColor: "#fca5a5", background: "#fff5f5" },
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 12,
        fontWeight: 600,
        padding: "4px 11px",
        borderRadius: 20,
        border: "1px solid",
        ...styles[color],
      }}
    >
      {children}
    </span>
  );
};

const Spin: FC = () => (
  <span
    style={{
      display: "inline-block",
      width: 14,
      height: 14,
      border: "2px solid rgba(255,255,255,0.3)",
      borderTopColor: "#fff",
      borderRadius: "50%",
      animation: "spin .7s linear infinite",
      verticalAlign: "middle",
      marginRight: 8,
    }}
  />
);

// ══════════════════════════════════════════════════════════
//  LAYOUT HELPERS
// ══════════════════════════════════════════════════════════

const lay = {
  page: (m: boolean): CSSProperties => ({
    minHeight: "100vh",
    padding: m ? "14px 10px 48px" : "28px 16px 60px",
    fontFamily: "'Segoe UI','Helvetica Neue',sans-serif",
    position: "relative",
  }),
  wrap: (m: boolean): CSSProperties => ({
    maxWidth: 680,
    margin: "0 auto",
    width: "100%",
  }),
  desktopWrap: {
    display: "flex" as const,
    gap: 24,
    maxWidth: 1160,
    margin: "0 auto",
    alignItems: "flex-start",
  },
  leftCol: { flex: "1 1 660px", minWidth: 0 } as CSSProperties,
  rightCol: { width: 300, flexShrink: 0, position: "sticky" as const, top: 28 },
  heroPad: (m: boolean): CSSProperties => ({
    padding: m ? "14px 14px 12px" : "22px 26px 20px",
  }),
  heroTitle: (m: boolean): CSSProperties => ({
    fontSize: m ? 19 : 24,
    fontWeight: 800,
    color: "#202124",
    margin: "0 0 6px",
  }),
  section: (m: boolean): CSSProperties => ({
    background: "#fff",
    borderRadius: 10,
    boxShadow: "0 1px 8px rgba(0,0,0,0.07)",
    padding: m ? "14px 14px" : "20px 24px",
    marginBottom: 12,
  }),
  submitWrap: (m: boolean): CSSProperties => ({
    background: "#fff",
    borderRadius: 10,
    boxShadow: "0 1px 8px rgba(0,0,0,0.07)",
    padding: m ? "14px" : "18px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  }),
  typeGrid: (m: boolean): CSSProperties => ({
    display: "grid",
    gridTemplateColumns: m ? "1fr" : "1fr 1fr",
    gap: 8,
    marginTop: 4,
  }),
  adminBar: (m: boolean): CSSProperties => ({
    background: "#fff",
    borderRadius: 10,
    boxShadow: "0 1px 8px rgba(0,0,0,0.07)",
    padding: m ? "14px" : "18px 22px",
    marginBottom: 12,
    display: "flex",
    alignItems: m ? "flex-start" : "center",
    flexDirection: m ? "column" : "row",
    justifyContent: "space-between",
    gap: 12,
  }),
};

// ══════════════════════════════════════════════════════════
//  SIDEBAR STYLES
// ══════════════════════════════════════════════════════════

const side: Record<string, CSSProperties> = {
  root: { display: "flex", flexDirection: "column", gap: 12 },
  card: {
    background: "#fff",
    borderRadius: 10,
    boxShadow: "0 1px 8px rgba(0,0,0,0.07)",
    padding: "16px 18px",
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#1855c4",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "1.5px solid #e8f0fe",
  },
  divider: { height: 1, background: "#f0f0f0", margin: "14px 0" },
  vacLine: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#3c4043",
    marginBottom: 8,
  },
  vacIcon: { fontSize: 15, flexShrink: 0 },
  shiftRow: { display: "flex", gap: 8 },
  shiftCard: {
    flex: 1,
    background: "#eaf1ff",
    borderRadius: 6,
    padding: "8px 10px",
    textAlign: "center",
  },
  shiftLabel: { fontSize: 11, color: "#5f6368", marginBottom: 2 },
  shiftTime: { fontSize: 13, fontWeight: 700, color: "#1855c4" },
  offerRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    fontSize: 13,
    color: "#3c4043",
    marginBottom: 8,
  },
  offerIcon: { fontSize: 15, flexShrink: 0, marginTop: 1 },
  offerText: { lineHeight: 1.4 },
  stepRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  stepNum: {
    width: 24,
    height: 24,
    background: "#1855c4",
    color: "#fff",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    flexShrink: 0,
  },
  stepText: { fontSize: 13, color: "#3c4043" },
  contactRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
};

// ══════════════════════════════════════════════════════════
//  STATIC INPUT STYLES
// ══════════════════════════════════════════════════════════

const base: CSSProperties = {
  width: "100%",
  border: "1px solid #dadce0",
  borderRadius: 5,
  fontFamily: "inherit",
  fontSize: 14,
  color: "#202124",
  background: "#fff",
  padding: "10px 14px",
  outline: "none",
  boxSizing: "border-box",
};
const iS = (err?: string): CSSProperties => ({
  ...base,
  borderColor: err ? "#d93025" : "#dadce0",
});
const sS = (err?: string): CSSProperties => ({
  ...base,
  borderColor: err ? "#d93025" : "#dadce0",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath fill='%235f6368' d='M7 7l3 3 3-3z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  backgroundSize: 20,
  paddingRight: 36,
  cursor: "pointer",
  appearance: "none",
});

// ══════════════════════════════════════════════════════════
//  STATIC STYLES
// ══════════════════════════════════════════════════════════

const $: Record<string, CSSProperties> = {
  pageBg: {
    position: "fixed",
    inset: 0,
    zIndex: -1,
    background: "linear-gradient(145deg,#eef3ff 0%,#f5f9ff 55%,#fff5f5 100%)",
  },
  centerWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "90vh",
    padding: "20px",
  },

  hero: {
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
    overflow: "hidden",
    marginBottom: 12,
  },
  heroBar: {
    height: 6,
    background: "linear-gradient(90deg,#c41818,#1855c4,#0f9d58)",
  },
  heroTop: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  heroBadge: {
    width: 36,
    height: 36,
    background: "#1855c4",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 17,
    color: "#fff",
    flexShrink: 0,
  },
  heroOrg: {
    fontSize: 11,
    fontWeight: 700,
    color: "#5f6368",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  heroDesc: {
    fontSize: 13,
    color: "#5f6368",
    margin: "0 0 12px",
    lineHeight: 1.5,
  },
  heroTags: { display: "flex", flexWrap: "wrap", gap: 7 },

  secTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "#1855c4",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottom: "2px solid #e8f0fe",
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#3c4043",
    marginBottom: 6,
  },
  hint: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 5,
    lineHeight: 1.5,
    display: "flex",
    alignItems: "flex-start",
    gap: 4,
  },
  errText: { fontSize: 11, color: "#d93025", marginTop: 4, fontWeight: 600 },
  errBanner: {
    background: "#fff0f0",
    border: "1px solid #fca5a5",
    color: "#b91c1c",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 12,
    marginBottom: 12,
  },
  sendErrBanner: {
    background: "#fff0f0",
    border: "1px solid #fca5a5",
    color: "#b91c1c",
    borderRadius: 6,
    padding: "10px 14px",
    fontSize: 13,
    lineHeight: 1.5,
  },

  schedGrid: { display: "flex", flexDirection: "column", gap: 9, marginTop: 8 },
  schedBtn: {
    position: "relative",
    textAlign: "left",
    border: "1.5px solid #dadce0",
    borderRadius: 8,
    padding: "13px 14px 11px",
    cursor: "pointer",
    background: "#fafbff",
    width: "100%",
  },
  schedOn: { border: "2px solid #1855c4", background: "#eaf1ff" },
  schedCheck: {
    position: "absolute",
    top: 10,
    right: 12,
    background: "#1855c4",
    color: "#fff",
    borderRadius: "50%",
    width: 20,
    height: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 800,
  },
  schedEmoji: { fontSize: 18, marginBottom: 3 },
  schedName: { fontSize: 14, fontWeight: 800, color: "#202124" },
  schedTime: {
    fontSize: 13,
    fontWeight: 700,
    color: "#1855c4",
    marginBottom: 2,
  },
  schedSub: { fontSize: 11, color: "#5f6368", marginBottom: 7 },
  hourRow: { display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 },
  hour: { padding: "2px 5px", borderRadius: 3, fontSize: 10, fontWeight: 700 },
  hourOn: { background: "#dbeafe", color: "#1855c4" },
  hourOff: { background: "#f1f3f4", color: "#bbb" },

  typeBtn: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    padding: "10px 12px",
    border: "1.5px solid #dadce0",
    borderRadius: 7,
    cursor: "pointer",
    background: "#fafbff",
    textAlign: "left",
  },
  typeBtnOn: { border: "1.5px solid #1855c4", background: "#eaf1ff" },

  // Scale row
  scaleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    background: "#fafbff",
    borderRadius: 8,
    border: "1px solid #e8edf4",
  },
  scaleLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#202124",
    flex: 1,
    minWidth: 0,
  },
  scaleDots: { display: "flex", alignItems: "center", gap: 6 },
  scaleDot: {
    width: 16,
    height: 16,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    transition: "transform .15s, background .15s",
    flexShrink: 0,
  },
  scaleLvlLabel: { fontSize: 11, fontWeight: 700, minWidth: 72 },
  scaleRemove: {
    background: "none",
    border: "none",
    color: "#9aa0a6",
    cursor: "pointer",
    fontSize: 14,
    padding: "0 2px",
    lineHeight: 1,
    flexShrink: 0,
  },

  btnMain: {
    width: "100%",
    background: "#1855c4",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 15,
    fontWeight: 800,
    padding: "13px",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(24,85,196,0.25)",
    fontFamily: "inherit",
  },
  adminLink: {
    background: "none",
    border: "none",
    color: "#bbb",
    fontSize: 12,
    cursor: "pointer",
    textAlign: "center",
    fontFamily: "inherit",
    padding: "2px 0",
  },
  btnBack: {
    background: "none",
    color: "#5f6368",
    border: "1px solid #e0e0e0",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    padding: "9px 16px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnExcel: {
    background: "#0f9d58",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 700,
    padding: "9px 18px",
    cursor: "pointer",
    fontFamily: "inherit",
  },

  thanksCard: {
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 4px 32px rgba(0,0,0,0.10)",
    padding: "48px 36px",
    textAlign: "center",
    maxWidth: 440,
    width: "100%",
  },
  thanksTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: "#202124",
    marginBottom: 12,
  },
  thanksSub: {
    fontSize: 14,
    color: "#5f6368",
    lineHeight: 1.8,
    marginBottom: 22,
  },
  thanksHint: {
    background: "#eaf1ff",
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 13,
    color: "#1855c4",
    fontWeight: 600,
    marginBottom: 22,
  },

  loginCard: {
    background: "#fff",
    borderRadius: 14,
    boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
    padding: "40px 28px",
    textAlign: "center",
    maxWidth: 340,
    width: "100%",
  },
  loginTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#202124",
    marginBottom: 20,
  },

  adminTitle: { fontSize: 18, fontWeight: 800, color: "#202124" },
  empty: {
    background: "#fff",
    borderRadius: 10,
    padding: "52px 20px",
    textAlign: "center",
  },
  appCard: {
    background: "#fff",
    borderRadius: 10,
    boxShadow: "0 1px 8px rgba(0,0,0,0.07)",
    padding: "14px 18px",
  },
  appNum: {
    background: "#1855c4",
    color: "#fff",
    borderRadius: 5,
    padding: "2px 9px",
    fontSize: 11,
    fontWeight: 800,
  },

  tag: { padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 },
  tagBlue: { background: "#e8f0fe", color: "#1855c4" },
  tagGreen: { background: "#e6f8ef", color: "#0f7d47" },
};

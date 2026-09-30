import type { Slide, PresentationSettings, SlideElement, FieldKey, TextFormat, SlideBackground } from '../types';
import { getTheme, FONT_STACK } from '../themes';
import { getIcon } from '../lib/icons';
import { ChartCanvas } from './ChartCanvas';
import { OverlayLayer } from './OverlayLayer';

interface Props {
  slide: Slide;
  settings: PresentationSettings;
  editable?: boolean;
  onChange?: (slide: Slide) => void;
  scale?: number; // visual scale factor for thumbnails
  selectedElementId?: string | null;
  onSelectElement?: (id: string | null) => void;
  onChangeElement?: (id: string, patch: Partial<SlideElement>) => void;
  /** Currently selected AI template field key (null when an overlay element is selected). */
  selectedField?: FieldKey | null;
  /** Called when the user clicks a template text field. */
  onSelectField?: (key: FieldKey | null) => void;
  /** Apply a formatting patch to a template field. */
  onChangeFieldStyle?: (key: FieldKey, patch: TextFormat) => void;
}

function textFormatToCss(fs?: TextFormat): React.CSSProperties {
  if (!fs) return {};
  const css: React.CSSProperties = {};
  if (fs.fontFamily) css.fontFamily = FONT_STACK[fs.fontFamily];
  if (fs.fontSize !== undefined) css.fontSize = fs.fontSize;
  if (fs.bold !== undefined) css.fontWeight = fs.bold ? 700 : 400;
  if (fs.italic !== undefined) css.fontStyle = fs.italic ? 'italic' : 'normal';
  if (fs.underline !== undefined) css.textDecoration = fs.underline ? 'underline' : 'none';
  if (fs.color !== undefined) css.color = fs.color;
  if (fs.align !== undefined) css.textAlign = fs.align;
  if (fs.lineHeight !== undefined) css.lineHeight = fs.lineHeight;
  if (fs.letterSpacing !== undefined) css.letterSpacing = `${fs.letterSpacing}px`;
  if (fs.paragraphSpacing !== undefined) css.paddingBottom = `${fs.paragraphSpacing}px`;
  return css;
}

export function SlideRenderer({
  slide, settings, editable = false, onChange,
  selectedElementId = null, onSelectElement, onChangeElement,
  selectedField = null, onSelectField, onChangeFieldStyle,
}: Props) {
  const theme = getTheme(settings.theme);
  const headingFont = FONT_STACK[theme.headingFont];
  const bodyFont = FONT_STACK[theme.bodyFont];

  // Per-slide background override takes precedence over the global setting.
  const bgStyle: { background: string; overlay?: React.CSSProperties; imageUrl?: string } = slide.background
    ? resolveSlideBackground(slide.background)
    : getBackgroundStyle(settings, theme);
  const isDark = isColorDark(bgStyle.background);

  const update = (patch: Partial<Slide>) => {
    if (onChange) onChange({ ...slide, ...patch });
  };

  const fieldStyle = (key: FieldKey): TextFormat => slide.fieldStyles?.[key] || {};

  const accent = settings.primaryColor || theme.primary;

  const containerStyle: React.CSSProperties = {
    background: bgStyle.background,
    color: isDark ? '#f1f5f9' : theme.text,
    fontFamily: bodyFont,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
    height: '100%',
  };

  const headingStyle: React.CSSProperties = { fontFamily: headingFont };
  const mutedColor = isDark ? 'rgba(241, 245, 249, 0.7)' : theme.muted;

  return (
    <div
      style={containerStyle}
      className="theme-transition"
      onPointerDown={(e) => {
        if (editable && e.target === e.currentTarget) {
          onSelectElement?.(null);
          onSelectField?.(null);
        }
      }}
    >
      {bgStyle.imageUrl && (
        <>
          <img src={bgStyle.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
          <div className="absolute inset-0 pointer-events-none" style={{ background: isDark ? 'rgba(2,6,23,0.55)' : 'rgba(255,255,255,0.72)' }} />
        </>
      )}
      {bgStyle.overlay && <div className="absolute inset-0 pointer-events-none" style={bgStyle.overlay} />}

      <div className="relative w-full h-full" style={{ padding: '5% 6%' }}>
        <SlideContent
          slide={slide}
          settings={settings}
          editable={editable}
          onChange={onChange}
          headingStyle={headingStyle}
          mutedColor={mutedColor}
          accent={accent}
          isDark={isDark}
          fieldStyle={fieldStyle}
          selectedField={selectedField}
          onSelectField={onSelectField}
          onChangeFieldStyle={onChangeFieldStyle}
          update={update}
        />
      </div>

      {slide.elements && slide.elements.length > 0 && (
        <OverlayLayer
          slide={slide}
          editable={editable}
          selectedId={selectedElementId ?? null}
          onSelect={onSelectElement ?? (() => {})}
          onChange={onChangeElement ?? (() => {})}
          width={1280}
          height={720}
        />
      )}
    </div>
  );
}

function resolveSlideBackground(bg: NonNullable<Slide['background']>): { background: string; overlay?: React.CSSProperties; imageUrl?: string } {
  const base = bg.type === 'solid'
    ? { background: bg.color || '#ffffff' }
    : { background: `linear-gradient(${bg.angle || 135}deg, ${bg.from || '#06b6d4'} 0%, ${bg.to || '#6366f1'} 100%)` };
  const overlay = patternOverlayStyle(bg.pattern);
  return { ...base, overlay, imageUrl: bg.imageUrl };
}

function patternOverlayStyle(pattern: SlideBackground['pattern']): React.CSSProperties | undefined {
  const ink = 'rgba(100,116,139,0.28)';
  switch (pattern) {
    case 'dots':
      return { backgroundImage: `radial-gradient(${ink} 1.4px, transparent 1.5px)`, backgroundSize: '18px 18px' };
    case 'grid':
      return { backgroundImage: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`, backgroundSize: '26px 26px' };
    case 'lines':
      return { backgroundImage: 'repeating-linear-gradient(135deg, rgba(100,116,139,0.16) 0 2px, transparent 2px 12px)' };
    case 'blobs':
      return { background: 'radial-gradient(circle at 18% 22%, rgba(6,182,212,0.35), transparent 52%), radial-gradient(circle at 82% 78%, rgba(99,102,241,0.35), transparent 52%)' };
    default:
      return undefined;
  }
}

function SlideContent({
  slide, settings, editable, headingStyle, mutedColor, accent, isDark, fieldStyle, selectedField, onSelectField, update,
}: {
  slide: Slide;
  settings: PresentationSettings;
  editable: boolean;
  onChange?: (s: Slide) => void;
  headingStyle: React.CSSProperties;
  mutedColor: string;
  accent: string;
  isDark: boolean;
  fieldStyle: (key: FieldKey) => TextFormat;
  selectedField: FieldKey | null;
  onSelectField?: (key: FieldKey | null) => void;
  onChangeFieldStyle?: (key: FieldKey, patch: TextFormat) => void;
  update: (patch: Partial<Slide>) => void;
}) {
  const theme = getTheme(settings.theme);
  const surfaceColor = isDark ? 'rgba(15, 23, 42, 0.5)' : theme.surface;
  const borderColor = isDark ? 'rgba(148, 163, 184, 0.2)' : theme.border;

  // Build contentEditable props for a top-level template field (title/subtitle/body).
  // Applies field style overrides and tracks selection so the floating toolbar
  // can format AI-generated text identically to manually added text elements.
  const fieldProps = (key: 'title' | 'subtitle' | 'body', baseStyle: React.CSSProperties = {}) =>
    editable
      ? {
          contentEditable: true,
          suppressContentEditableWarning: true,
          spellCheck: false,
          'data-field-key': key,
          onFocus: () => onSelectField?.(key),
          onBlur: (e: React.FocusEvent<HTMLElement>) => {
            const text = e.currentTarget.innerText.trim();
            if (text !== (slide[key] || '')) update({ [key]: text } as Partial<Slide>);
          },
          className: `outline-none rounded transition-shadow ${selectedField === key ? 'ring-2 ring-brand-400 ring-offset-1' : 'hover:ring-1 hover:ring-brand-300'}`,
          style: { ...baseStyle, ...textFormatToCss(fieldStyle(key)) },
        }
      : {};

  switch (slide.layout) {
    case 'hero':
      return (
        <div className="flex flex-col justify-center h-full animate-fade-up">
          <div className="w-16 h-1 rounded-full mb-5" style={{ background: accent }} />
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4"
            style={headingStyle}
            {...fieldProps('title', headingStyle)}
          >
            {slide.title}
          </h1>
          {slide.subtitle && (
            <p
              className="text-lg md:text-xl max-w-2xl"
              style={{ color: mutedColor, whiteSpace: 'pre-line' }}
              {...fieldProps('subtitle', { color: mutedColor })}
            >
              {slide.subtitle}
            </p>
          )}
          <div className="mt-8 flex items-center gap-2 text-sm" style={{ color: mutedColor }}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: accent }} />
            <span>{settings.audience.charAt(0).toUpperCase() + settings.audience.slice(1)} · {settings.duration} min</span>
          </div>
        </div>
      );

    case 'thank-you':
      return (
        <div className="flex flex-col items-center justify-center h-full text-center animate-fade-up">
          <div className="w-16 h-1 rounded-full mb-6" style={{ background: accent }} />
          <h1 className="text-5xl md:text-6xl font-bold mb-3" style={headingStyle} {...fieldProps('title', headingStyle)}>
            {slide.title}
          </h1>
          {slide.subtitle && (
            <p className="text-lg md:text-xl" style={{ color: mutedColor, whiteSpace: 'pre-line' }} {...fieldProps('subtitle', { color: mutedColor })}>
              {slide.subtitle}
            </p>
          )}
          <div className="mt-8 text-sm" style={{ color: mutedColor }}>
            Generated with Prezento AI
          </div>
        </div>
      );

    case 'section-divider':
      return (
        <div className="flex flex-col justify-center h-full animate-fade-up">
          {slide.sectionNumber && (
            <div className="text-7xl md:text-8xl font-bold opacity-25 mb-2" style={{ ...headingStyle, color: accent }}>
              {slide.sectionNumber}
            </div>
          )}
          <h2 className="text-3xl md:text-4xl font-bold" style={headingStyle} {...fieldProps('title', headingStyle)}>
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className="text-lg mt-2" style={{ color: mutedColor }} {...fieldProps('subtitle', { color: mutedColor })}>
              {slide.subtitle}
            </p>
          )}
        </div>
      );

    case 'agenda':
      return (
        <div className="h-full flex flex-col animate-fade-up">
          <HeaderBar accent={accent} />
          <h2 className="text-3xl md:text-4xl font-bold mb-1" style={headingStyle} {...fieldProps('title', headingStyle)}>
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className="text-base md:text-lg mb-6" style={{ color: mutedColor }} {...fieldProps('subtitle', { color: mutedColor })}>
              {slide.subtitle}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 flex-1">
            {(slide.bullets || []).map((b, i) => (
              <div
                key={b.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: surfaceColor, border: `1px solid ${borderColor}` }}
              >
                <span
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold shrink-0"
                  style={{ background: accent, color: '#fff' }}
                >
                  {i + 1}
                </span>
                <EditableText
                  fieldKey={`bullets:${i}`}
                  selectedField={selectedField}
                  onSelectField={onSelectField}
                  fieldStyle={fieldStyle(`bullets:${i}`)}
                  value={b.text}
                  editable={editable}
                  onChange={(text) => {
                    const bullets = [...(slide.bullets || [])];
                    bullets[i] = { ...bullets[i], text };
                    update({ bullets });
                  }}
                  className="text-sm md:text-base font-medium"
                />
              </div>
            ))}
          </div>
        </div>
      );

    case 'two-column':
    case 'image-left':
    case 'image-right':
    case 'full-image': {
      const hasImage = slide.image && slide.image.url && slide.image.url.trim().length > 0;
      const isFullImage = slide.layout === 'full-image';
      // When there's no image, collapse to a single-column text layout.
      const gridClass = isFullImage
        ? 'grid-cols-1'
        : hasImage
          ? 'grid-cols-1 md:grid-cols-2'
          : 'grid-cols-1';
      return (
        <div className="h-full flex flex-col animate-fade-up">
          <HeaderBar accent={accent} />
          <h2 className="text-2xl md:text-3xl font-bold mb-1" style={headingStyle} {...fieldProps('title', headingStyle)}>
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className="text-sm md:text-base mb-4" style={{ color: mutedColor }} {...fieldProps('subtitle', { color: mutedColor })}>
              {slide.subtitle}
            </p>
          )}
          <div className={`grid gap-5 flex-1 min-h-0 ${gridClass}`}>
            <div className="flex flex-col gap-3 overflow-y-auto min-h-0 pr-1 prezento-slide-scroll">
              {slide.body && (
                <p className="text-sm md:text-base leading-relaxed" {...fieldProps('body')}>
                  {slide.body}
                </p>
              )}
              {slide.bullets && slide.bullets.length > 0 && (
                <ul className="space-y-2">
                  {slide.bullets.map((b, i) => {
                    const bulletFs = fieldStyle(`bullets:${i}`);
                    const bulletLH = bulletFs.lineHeight ?? 1.5;
                    const bulletFS = bulletFs.fontSize;
                    return (
                    <li key={b.id} className="flex gap-2 text-sm md:text-base">
                      <span
                        className="shrink-0 flex items-center justify-center"
                        style={{
                          width: '0.375rem',
                          height: `calc(${bulletLH} * ${bulletFS ? bulletFS + 'px' : '1em'})`,
                        }}
                      >
                        <span style={{ width: '0.375rem', height: '0.375rem', borderRadius: '50%', background: accent }} />
                      </span>
                      <EditableText
                        fieldKey={`bullets:${i}`}
                        selectedField={selectedField}
                        onSelectField={onSelectField}
                        fieldStyle={fieldStyle(`bullets:${i}`)}
                        value={b.text}
                        editable={editable}
                        onChange={(text) => {
                          const bullets = [...(slide.bullets || [])];
                          bullets[i] = { ...bullets[i], text };
                          update({ bullets });
                        }}
                      />
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {hasImage && !isFullImage && (
              <div className="flex items-center justify-center rounded-xl overflow-hidden" style={{ background: surfaceColor, border: `1px solid ${borderColor}` }}>
                <img src={slide.image!.url} alt={slide.image!.alt} className="w-full h-full object-cover" />
              </div>
            )}
            {hasImage && isFullImage && (
              <div className="flex items-center justify-center rounded-xl overflow-hidden flex-1" style={{ background: surfaceColor, border: `1px solid ${borderColor}` }}>
                <img src={slide.image!.url} alt={slide.image!.alt} className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>
      );
    }

    case 'cards':
    case 'grid':
    case 'diagram': {
      const cards = slide.cards || [];
      const cols = cards.length <= 3 ? cards.length : cards.length <= 4 ? 2 : 3;
      return (
        <div className="h-full flex flex-col animate-fade-up">
          <HeaderBar accent={accent} />
          <h2 className="text-2xl md:text-3xl font-bold mb-1" style={headingStyle} {...fieldProps('title', headingStyle)}>
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className="text-sm md:text-base mb-4" style={{ color: mutedColor }} {...fieldProps('subtitle', { color: mutedColor })}>
              {slide.subtitle}
            </p>
          )}
          <div className="grid gap-3 flex-1 min-h-0 overflow-y-auto pr-1 prezento-slide-scroll" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {cards.map((c, i) => {
              const Icon = getIcon(c.icon);
              return (
                <div
                  key={c.id}
                  className="flex flex-col p-4 rounded-xl"
                  style={{ background: surfaceColor, border: `1px solid ${borderColor}`, borderTop: `3px solid ${accent}` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: `${accent}20`, color: accent }}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <EditableText
                      fieldKey={`cards:${i}:title`}
                      selectedField={selectedField}
                      onSelectField={onSelectField}
                      fieldStyle={fieldStyle(`cards:${i}:title`)}
                      value={c.title}
                      editable={editable}
                      onChange={(text) => {
                        const cards = [...(slide.cards || [])];
                        cards[i] = { ...cards[i], title: text };
                        update({ cards });
                      }}
                      className="font-semibold text-sm md:text-base"
                    />
                  </div>
                  <EditableText
                    fieldKey={`cards:${i}:description`}
                    selectedField={selectedField}
                    onSelectField={onSelectField}
                    fieldStyle={fieldStyle(`cards:${i}:description`)}
                    value={c.description}
                    editable={editable}
                    onChange={(text) => {
                      const cards = [...(slide.cards || [])];
                      cards[i] = { ...cards[i], description: text };
                      update({ cards });
                    }}
                    className="text-xs md:text-sm leading-relaxed"
                    style={{ color: mutedColor }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    case 'statistics': {
      const stats = slide.stats || [];
      return (
        <div className="h-full flex flex-col animate-fade-up">
          <HeaderBar accent={accent} />
          <h2 className="text-2xl md:text-3xl font-bold mb-1" style={headingStyle} {...fieldProps('title', headingStyle)}>
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className="text-sm md:text-base mb-6" style={{ color: mutedColor }} {...fieldProps('subtitle', { color: mutedColor })}>
              {slide.subtitle}
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 items-center">
            {stats.map((st, i) => (
              <div key={st.id} className="text-center p-4 rounded-xl" style={{ background: surfaceColor, border: `1px solid ${borderColor}` }}>
                <div className="text-3xl md:text-4xl lg:text-5xl font-bold mb-1" style={{ ...headingStyle, color: accent }}>
                  <EditableText
                    fieldKey={`stats:${i}:value`}
                    selectedField={selectedField}
                    onSelectField={onSelectField}
                    fieldStyle={fieldStyle(`stats:${i}:value`)}
                    value={st.value}
                    editable={editable}
                    onChange={(text) => {
                      const stats = [...(slide.stats || [])];
                      stats[i] = { ...stats[i], value: text };
                      update({ stats });
                    }}
                  />
                </div>
                <div className="text-sm md:text-base font-semibold mb-1">
                  <EditableText
                    fieldKey={`stats:${i}:label`}
                    selectedField={selectedField}
                    onSelectField={onSelectField}
                    fieldStyle={fieldStyle(`stats:${i}:label`)}
                    value={st.label}
                    editable={editable}
                    onChange={(text) => {
                      const stats = [...(slide.stats || [])];
                      stats[i] = { ...stats[i], label: text };
                      update({ stats });
                    }}
                  />
                </div>
                {st.description && (
                  <div className="text-xs" style={{ color: mutedColor }}>
                    <EditableText
                      fieldKey={`stats:${i}:description`}
                      selectedField={selectedField}
                      onSelectField={onSelectField}
                      fieldStyle={fieldStyle(`stats:${i}:description`)}
                      value={st.description}
                      editable={editable}
                      onChange={(text) => {
                        const stats = [...(slide.stats || [])];
                        stats[i] = { ...stats[i], description: text };
                        update({ stats });
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'timeline': {
      const items = slide.timeline || [];
      return (
        <div className="h-full flex flex-col animate-fade-up">
          <HeaderBar accent={accent} />
          <h2 className="text-2xl md:text-3xl font-bold mb-1" style={headingStyle} {...fieldProps('title', headingStyle)}>
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className="text-sm md:text-base mb-6" style={{ color: mutedColor }} {...fieldProps('subtitle', { color: mutedColor })}>
              {slide.subtitle}
            </p>
          )}
          <div className="flex-1 flex items-center">
            <div className="relative w-full">
              <div className="absolute left-0 right-0 top-4 h-0.5" style={{ background: `${accent}40` }} />
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
                {items.map((t, i) => (
                  <div key={t.id} className="relative">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-3 relative z-10" style={{ background: accent, color: '#fff' }}>
                      {i + 1}
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: surfaceColor, border: `1px solid ${borderColor}` }}>
                      <div className="text-xs font-bold mb-1" style={{ color: accent }}>
                        <EditableText
                          fieldKey={`timeline:${i}:year`}
                          selectedField={selectedField}
                          onSelectField={onSelectField}
                          fieldStyle={fieldStyle(`timeline:${i}:year`)}
                          value={t.year}
                          editable={editable}
                          onChange={(text) => {
                            const timeline = [...(slide.timeline || [])];
                            timeline[i] = { ...timeline[i], year: text };
                            update({ timeline });
                          }}
                        />
                      </div>
                      <EditableText
                        fieldKey={`timeline:${i}:title`}
                        selectedField={selectedField}
                        onSelectField={onSelectField}
                        fieldStyle={fieldStyle(`timeline:${i}:title`)}
                        value={t.title}
                        editable={editable}
                        onChange={(text) => {
                          const timeline = [...(slide.timeline || [])];
                          timeline[i] = { ...timeline[i], title: text };
                          update({ timeline });
                        }}
                        className="text-sm font-semibold mb-1"
                      />
                      <EditableText
                        fieldKey={`timeline:${i}:description`}
                        selectedField={selectedField}
                        onSelectField={onSelectField}
                        fieldStyle={fieldStyle(`timeline:${i}:description`)}
                        value={t.description}
                        editable={editable}
                        onChange={(text) => {
                          const timeline = [...(slide.timeline || [])];
                          timeline[i] = { ...timeline[i], description: text };
                          update({ timeline });
                        }}
                        className="text-xs leading-relaxed"
                        style={{ color: mutedColor }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    case 'process': {
      const steps = slide.steps || [];
      return (
        <div className="h-full flex flex-col animate-fade-up">
          <HeaderBar accent={accent} />
          <h2 className="text-2xl md:text-3xl font-bold mb-1" style={headingStyle} {...fieldProps('title', headingStyle)}>
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className="text-sm md:text-base mb-6" style={{ color: mutedColor }} {...fieldProps('subtitle', { color: mutedColor })}>
              {slide.subtitle}
            </p>
          )}
          <div className="flex-1 min-h-0 grid gap-3 items-stretch overflow-y-auto pr-1 prezento-slide-scroll" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((s, i) => (
              <div key={s.id} className="flex flex-col p-4 rounded-xl" style={{ background: surfaceColor, border: `1px solid ${borderColor}`, borderTop: `4px solid ${accent}` }}>
                <div className="text-2xl md:text-3xl font-bold mb-2" style={{ color: accent }}>
                  {String(s.step).padStart(2, '0')}
                </div>
                <EditableText
                  fieldKey={`steps:${i}:title`}
                  selectedField={selectedField}
                  onSelectField={onSelectField}
                  fieldStyle={fieldStyle(`steps:${i}:title`)}
                  value={s.title}
                  editable={editable}
                  onChange={(text) => {
                    const steps = [...(slide.steps || [])];
                    steps[i] = { ...steps[i], title: text };
                    update({ steps });
                  }}
                  className="text-sm font-semibold mb-2"
                />
                <EditableText
                  fieldKey={`steps:${i}:description`}
                  selectedField={selectedField}
                  onSelectField={onSelectField}
                  fieldStyle={fieldStyle(`steps:${i}:description`)}
                  value={s.description}
                  editable={editable}
                  onChange={(text) => {
                    const steps = [...(slide.steps || [])];
                    steps[i] = { ...steps[i], description: text };
                    update({ steps });
                  }}
                  className="text-xs leading-relaxed flex-1"
                  style={{ color: mutedColor }}
                />
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute right-[-12px] top-1/2 -translate-y-1/2 text-accent" style={{ color: accent }}>
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'comparison': {
      if (!slide.comparison) return null;
      const rows = slide.comparison.rows;
      return (
        <div className="h-full flex flex-col animate-fade-up">
          <HeaderBar accent={accent} />
          <h2 className="text-2xl md:text-3xl font-bold mb-1" style={headingStyle} {...fieldProps('title', headingStyle)}>
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className="text-sm md:text-base mb-4" style={{ color: mutedColor }} {...fieldProps('subtitle', { color: mutedColor })}>
              {slide.subtitle}
            </p>
          )}
          <div className="flex-1 rounded-xl overflow-hidden" style={{ border: `1px solid ${borderColor}` }}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="p-3 font-semibold text-sm" style={{ background: surfaceColor, color: mutedColor }}>Feature</div>
              <div className="p-3 font-semibold text-sm" style={{ background: surfaceColor, color: mutedColor }}>{slide.comparison.leftTitle}</div>
              <div className="p-3 font-semibold text-sm" style={{ background: accent, color: '#fff' }}>{slide.comparison.rightTitle}</div>
              {rows.map((r, i) => (
                <ComparisonRowCells
                  key={r.id}
                  row={r}
                  editable={editable}
                  surfaceColor={surfaceColor}
                  mutedColor={mutedColor}
                  accent={accent}
                  selectedField={selectedField}
                  onSelectField={onSelectField}
                  fieldStyle={fieldStyle}
                  rowIndex={i}
                  onChange={(newRow) => {
                    const comparison = slide.comparison!;
                    const newRows = [...comparison.rows];
                    newRows[i] = newRow;
                    update({ comparison: { ...comparison, rows: newRows } });
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      );
    }

    case 'table': {
      if (!slide.table) return null;
      const { headers, rows } = slide.table;
      return (
        <div className="h-full flex flex-col animate-fade-up">
          <HeaderBar accent={accent} />
          <h2 className="text-2xl md:text-3xl font-bold mb-1" style={headingStyle} {...fieldProps('title', headingStyle)}>
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className="text-sm md:text-base mb-4" style={{ color: mutedColor }} {...fieldProps('subtitle', { color: mutedColor })}>
              {slide.subtitle}
            </p>
          )}
          <div className="flex-1 min-h-0 rounded-xl overflow-auto prezento-slide-scroll" style={{ border: `1px solid ${borderColor}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="p-3 text-left font-semibold" style={{ background: accent, color: '#fff' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : surfaceColor }}>
                    {r.map((c, j) => (
                      <td key={j} className="p-3" style={{ color: mutedColor, borderTop: `1px solid ${borderColor}` }}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    case 'chart': {
      if (!slide.chart) return null;
      return (
        <div className="h-full flex flex-col animate-fade-up">
          <HeaderBar accent={accent} />
          <h2 className="text-2xl md:text-3xl font-bold mb-1" style={headingStyle} {...fieldProps('title', headingStyle)}>
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className="text-sm md:text-base mb-4" style={{ color: mutedColor }} {...fieldProps('subtitle', { color: mutedColor })}>
              {slide.subtitle}
            </p>
          )}
          <div className="flex-1 p-3 rounded-xl" style={{ background: surfaceColor, border: `1px solid ${borderColor}` }}>
            <ChartCanvas data={slide.chart} color={accent} isDark={isDark} />
          </div>
        </div>
      );
    }

    case 'quote': {
      if (!slide.quote) return null;
      return (
        <div className="h-full flex flex-col justify-center animate-fade-up">
          <HeaderBar accent={accent} />
          <div className="text-6xl md:text-7xl leading-none mb-4" style={{ color: accent, fontFamily: headingStyle.fontFamily }}>
            "
          </div>
          <blockquote className="text-2xl md:text-3xl lg:text-4xl italic leading-snug mb-4" style={headingStyle} {...fieldProps('body')}>
            {slide.quote.text}
          </blockquote>
          <div className="text-base md:text-lg" style={{ color: mutedColor }}>
            — {slide.quote.author}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

function HeaderBar({ accent }: { accent: string }) {
  return <div className="w-12 h-1 rounded-full mb-3" style={{ background: accent }} />;
}

function ComparisonRowCells({
  row, editable, surfaceColor, mutedColor, onChange,
  selectedField, onSelectField, fieldStyle, rowIndex,
}: {
  row: import('../types').ComparisonRow;
  editable: boolean;
  surfaceColor: string;
  mutedColor: string;
  accent: string;
  onChange: (row: import('../types').ComparisonRow) => void;
  selectedField?: FieldKey | null;
  onSelectField?: (key: FieldKey | null) => void;
  fieldStyle: (key: FieldKey) => TextFormat;
  rowIndex: number;
}) {
  return (
    <>
      <div className="p-3 text-sm font-medium" style={{ background: surfaceColor, borderTop: `1px solid ${borderColorPlaceholder}` }}>
        <EditableText fieldKey={`comparison:${rowIndex}:feature`} selectedField={selectedField} onSelectField={onSelectField} fieldStyle={fieldStyle(`comparison:${rowIndex}:feature`)} value={row.feature} editable={editable} onChange={(feature) => onChange({ ...row, feature })} />
      </div>
      <div className="p-3 text-sm" style={{ background: surfaceColor, borderTop: `1px solid ${borderColorPlaceholder}`, color: mutedColor }}>
        <EditableText fieldKey={`comparison:${rowIndex}:optionA`} selectedField={selectedField} onSelectField={onSelectField} fieldStyle={fieldStyle(`comparison:${rowIndex}:optionA`)} value={row.optionA} editable={editable} onChange={(optionA) => onChange({ ...row, optionA })} />
      </div>
      <div className="p-3 text-sm" style={{ borderTop: `1px solid ${borderColorPlaceholder}` }}>
        <EditableText fieldKey={`comparison:${rowIndex}:optionB`} selectedField={selectedField} onSelectField={onSelectField} fieldStyle={fieldStyle(`comparison:${rowIndex}:optionB`)} value={row.optionB} editable={editable} onChange={(optionB) => onChange({ ...row, optionB })} className="font-medium" />
      </div>
    </>
  );
}
const borderColorPlaceholder = 'rgba(148, 163, 184, 0.2)';

function EditableText({
  value, editable, onChange, className, style,
  fieldKey, selectedField, onSelectField, fieldStyle,
}: {
  value: string;
  editable: boolean;
  onChange: (text: string) => void;
  className?: string;
  style?: React.CSSProperties;
  fieldKey?: FieldKey;
  selectedField?: FieldKey | null;
  onSelectField?: (key: FieldKey | null) => void;
  fieldStyle?: TextFormat;
}) {
  if (editable) {
    const selected = fieldKey && selectedField === fieldKey;
    return (
      <span
        contentEditable
        suppressContentEditableWarning
        data-field-key={fieldKey}
        onFocus={() => fieldKey && onSelectField?.(fieldKey)}
        onBlur={(e) => {
          const text = e.currentTarget.innerText.trim();
          if (text !== value) onChange(text);
        }}
        className={`outline-none rounded inline-block transition-shadow ${selected ? 'ring-2 ring-brand-400 ring-offset-1' : 'hover:ring-1 hover:ring-brand-300'} ${className || ''}`}
        style={{ ...style, ...textFormatToCss(fieldStyle) }}
        spellCheck={false}
      >
        {value}
      </span>
    );
  }
  return <span className={className} style={{ ...style, ...textFormatToCss(fieldStyle) }}>{value}</span>;
}

// ── Background helpers ───────────────────────────────────────────────────────

function getBackgroundStyle(settings: PresentationSettings, theme: ReturnType<typeof getTheme>): { background: string; overlay?: React.CSSProperties } {
  const primary = settings.primaryColor || theme.primary;
  const secondary = settings.secondaryColor || theme.secondary;

  switch (settings.background) {
    case 'white':
      return { background: '#ffffff' };
    case 'black':
      return { background: '#0b1120' };
    case 'blue':
      return { background: '#1e3a8a' };
    case 'green':
      return { background: '#064e3b' };
    case 'purple':
      return { background: '#4c1d95' };
    case 'gradient':
      return {
        background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
      };
    case 'abstract':
      return {
        background: theme.background,
        overlay: {
          background: `radial-gradient(at 20% 20%, ${primary}30 0px, transparent 50%), radial-gradient(at 80% 80%, ${secondary}30 0px, transparent 50%)`,
        },
      };
    case 'geometric':
      return {
        background: theme.background,
        overlay: {
          backgroundImage: `linear-gradient(${primary}15 1px, transparent 1px), linear-gradient(90deg, ${primary}15 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        },
      };
    case 'glassmorphism':
      return {
        background: theme.background,
        overlay: {
          background: `linear-gradient(135deg, ${primary}10, ${secondary}10)`,
          backdropFilter: 'blur(20px)',
        },
      };
    case 'custom':
      return { background: settings.primaryColor || theme.background };
    default:
      return { background: theme.background };
  }
}

function isColorDark(color: string): boolean {
  // Handle hex and gradient (assume gradient is dark-ish)
  if (color.startsWith('linear-gradient') || color.startsWith('radial-gradient')) {
    // sample first hex
    const m = color.match(/#([0-9a-f]{6})/i);
    if (m) return isColorDark('#' + m[1]);
    return true;
  }
  const hex = color.replace('#', '');
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

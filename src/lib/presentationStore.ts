import { supabase } from './supabase';
import type { Presentation, PresentationSettings, Slide } from '../types';

async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export interface PresentationRow {
  id: string;
  user_id: string;
  title: string;
  thumbnail: string | null;
  theme: string | null;
  slides: Slide[];
  settings: PresentationSettings | null;
  total_slides: number;
  created_at: string;
  updated_at: string;
}

function rowToPresentation(row: PresentationRow): Presentation {
  return {
    id: row.id,
    settings: row.settings ?? {
      title: row.title,
      prompt: '',
      slideCount: row.total_slides,
      audience: 'college',
      language: 'English',
      mode: 'ai_generation',
      theme: (row.theme as Presentation['settings']['theme']) || 'modern',
      background: 'white',
      fontFamily: 'inter',
      primaryColor: '#06b6d4',
      secondaryColor: '#6366f1',
      iconStyle: 'line',
      presentationStyle: 'informative',
      duration: 15,
      speakerNotes: true,
      references: true,
      images: true,
      charts: true,
      explainPoints: true,
    },
    slides: row.slides || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function presentationToRow(p: Presentation) {
  return {
    id: p.id,
    title: p.settings.title,
    thumbnail: null as string | null,
    theme: p.settings.theme,
    slides: p.slides,
    settings: p.settings,
    total_slides: p.slides.length,
  };
}

export async function savePresentation(
  p: Presentation,
): Promise<{ error: string | null }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: 'Not authenticated' };

  if (!p.slides || p.slides.length === 0) {
    return { error: 'Cannot save a presentation with no slides' };
  }

  const row = presentationToRow(p);

  // Check if the presentation already exists
  const { data: existing } = await supabase
    .from('presentations')
    .select('id')
    .eq('id', p.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('presentations')
      .update({
        title: row.title,
        theme: row.theme,
        slides: row.slides,
        settings: row.settings,
        total_slides: row.total_slides,
        updated_at: new Date().toISOString(),
      })
      .eq('id', p.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from('presentations')
      .insert({
        id: p.id,
        user_id: userId,
        title: row.title,
        theme: row.theme,
        slides: row.slides,
        settings: row.settings,
        total_slides: row.total_slides,
      });
    if (error) return { error: error.message };
  }
  return { error: null };
}

export async function listPresentations(): Promise<{ data: PresentationRow[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('presentations')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: data as PresentationRow[], error: null };
}

export async function getPresentation(id: string): Promise<{ data: Presentation | null; error: string | null }> {
  const { data, error } = await supabase
    .from('presentations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: 'Presentation not found' };
  return { data: rowToPresentation(data as PresentationRow), error: null };
}

export async function deletePresentation(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('presentations').delete().eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

export async function renamePresentation(id: string, newTitle: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('presentations')
    .update({ title: newTitle, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

export async function duplicatePresentation(id: string): Promise<{ data: Presentation | null; error: string | null }> {
  const { data: existing, error } = await getPresentation(id);
  if (error || !existing) return { data: null, error: error || 'Not found' };

  const copy: Presentation = {
    ...existing,
    id: crypto.randomUUID(),
    settings: { ...existing.settings, title: `${existing.settings.title} (Copy)` },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const { error: saveErr } = await savePresentation(copy);
  if (saveErr) return { data: null, error: saveErr };
  return { data: copy, error: null };
}



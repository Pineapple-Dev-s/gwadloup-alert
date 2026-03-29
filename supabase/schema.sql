-- ============================================
-- GWADLOUP ALÈRT — Schéma de base de données
-- À exécuter dans Supabase SQL Editor
-- ============================================

-- Extension pour générer des UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table des profils utilisateurs
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  commune TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'citizen' CHECK (role IN ('citizen', 'admin', 'official')),
  reports_count INTEGER DEFAULT 0,
  reputation INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Catégories de signalements
-- ============================================
CREATE TYPE report_category AS ENUM (
  'pothole',
  'abandoned_vehicle',
  'illegal_dump',
  'broken_light',
  'flooding',
  'vegetation',
  'damaged_sign',
  'dangerous_road',
  'noise',
  'water_leak',
  'other'
);

CREATE TYPE report_status AS ENUM (
  'pending',
  'acknowledged',
  'in_progress',
  'resolved',
  'rejected'
);

CREATE TYPE report_priority AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

-- ============================================
-- Table des signalements
-- ============================================
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category report_category NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) >= 5 AND char_length(title) <= 150),
  description TEXT NOT NULL CHECK (char_length(description) >= 10 AND char_length(description) <= 2000),
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN 15.8 AND 16.6),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -61.9 AND -60.9),
  address TEXT,
  commune TEXT,
  images TEXT[] DEFAULT '{}',
  status report_status DEFAULT 'pending',
  priority report_priority DEFAULT 'medium',
  upvotes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  admin_response TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_reports_category ON public.reports(category);
CREATE INDEX idx_reports_commune ON public.reports(commune);
CREATE INDEX idx_reports_user ON public.reports(user_id);
CREATE INDEX idx_reports_location ON public.reports(latitude, longitude);
CREATE INDEX idx_reports_created ON public.reports(created_at DESC);

-- ============================================
-- Table des votes (un vote par user par report)
-- ============================================
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, report_id)
);

-- ============================================
-- Table des commentaires
-- ============================================
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) >= 2 AND char_length(content) <= 1000),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_report ON public.comments(report_id);

-- ============================================
-- Fonctions et triggers
-- ============================================

-- Créer profil automatiquement à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'citoyen_' || LEFT(NEW.id::text, 8))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Incrémenter reports_count du profil
CREATE OR REPLACE FUNCTION public.increment_reports_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET reports_count = reports_count + 1, reputation = reputation + 10
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_report_created
  AFTER INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_reports_count();

-- Gérer les votes (incrémenter/décrémenter upvotes)
CREATE OR REPLACE FUNCTION public.handle_vote_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.reports SET upvotes = upvotes + 1 WHERE id = NEW.report_id;
  -- Donner de la réputation à l'auteur du signalement
  UPDATE public.profiles SET reputation = reputation + 2
  WHERE id = (SELECT user_id FROM public.reports WHERE id = NEW.report_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_vote_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.reports SET upvotes = upvotes - 1 WHERE id = OLD.report_id;
  UPDATE public.profiles SET reputation = reputation - 2
  WHERE id = (SELECT user_id FROM public.reports WHERE id = OLD.report_id);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_vote_insert
  AFTER INSERT ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_vote_insert();

CREATE TRIGGER on_vote_delete
  AFTER DELETE ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_vote_delete();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Profiles : lecture publique, modification par le propriétaire
CREATE POLICY "Profiles visibles par tous"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Chacun modifie son profil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Reports : lecture publique, création par utilisateurs connectés, modification par auteur
CREATE POLICY "Signalements visibles par tous"
  ON public.reports FOR SELECT
  USING (true);

CREATE POLICY "Utilisateurs connectés créent des signalements"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Auteurs modifient leurs signalements"
  ON public.reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Auteurs suppriment leurs signalements"
  ON public.reports FOR DELETE
  USING (auth.uid() = user_id);

-- Votes
CREATE POLICY "Votes visibles par tous"
  ON public.votes FOR SELECT
  USING (true);

CREATE POLICY "Utilisateurs connectés votent"
  ON public.votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Utilisateurs retirent leur vote"
  ON public.votes FOR DELETE
  USING (auth.uid() = user_id);

-- Comments
CREATE POLICY "Commentaires visibles par tous"
  ON public.comments FOR SELECT
  USING (true);

CREATE POLICY "Utilisateurs connectés commentent"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Auteurs suppriment leurs commentaires"
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id);

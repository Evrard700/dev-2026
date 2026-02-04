-- KOUZO MVP - Supabase Schema for MOTO mode
-- Tables pour synchronisation des clients et commandes

-- Table: moto_clients
CREATE TABLE IF NOT EXISTS public.moto_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  neighborhood TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: moto_orders  
CREATE TABLE IF NOT EXISTS public.moto_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.moto_clients(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_address TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  price NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS moto_clients_user_id_idx ON public.moto_clients(user_id);
CREATE INDEX IF NOT EXISTS moto_orders_user_id_idx ON public.moto_orders(user_id);
CREATE INDEX IF NOT EXISTS moto_orders_client_id_idx ON public.moto_orders(client_id);
CREATE INDEX IF NOT EXISTS moto_orders_status_idx ON public.moto_orders(status);

-- Row Level Security (RLS)
ALTER TABLE public.moto_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moto_orders ENABLE ROW LEVEL SECURITY;

-- Policies: Chaque utilisateur ne voit que ses propres données
CREATE POLICY "Users can view their own clients"
  ON public.moto_clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clients"
  ON public.moto_clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients"
  ON public.moto_clients FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clients"
  ON public.moto_clients FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own orders"
  ON public.moto_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own orders"
  ON public.moto_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders"
  ON public.moto_orders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own orders"
  ON public.moto_orders FOR DELETE
  USING (auth.uid() = user_id);

-- Fonction pour auto-update du timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour auto-update
CREATE TRIGGER update_moto_clients_updated_at
  BEFORE UPDATE ON public.moto_clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_moto_orders_updated_at
  BEFORE UPDATE ON public.moto_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

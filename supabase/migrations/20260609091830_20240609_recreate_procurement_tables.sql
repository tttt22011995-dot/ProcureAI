-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS delivery_performance CASCADE;
DROP TABLE IF EXISTS vendor_ratings CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;

-- ─── Vendors Table ───
CREATE TABLE vendors (
  id TEXT PRIMARY KEY,
  vendor_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  contract_end TEXT,
  email TEXT NOT NULL,
  spend NUMERIC(14,2) NOT NULL DEFAULT 0,
  contact TEXT NOT NULL,
  phone TEXT,
  payment_terms TEXT NOT NULL DEFAULT 'Net 30',
  lead_time INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Purchase Orders Table ───
CREATE TABLE purchase_orders (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  delivery_date TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  delivery_status TEXT DEFAULT 'ordered',
  actual_delivery_date TEXT,
  delivery_notes JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Vendor Ratings Table ───
CREATE TABLE vendor_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id TEXT NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
  quality NUMERIC(3,2) NOT NULL DEFAULT 0,
  delivery NUMERIC(3,2) NOT NULL DEFAULT 0,
  cost NUMERIC(3,2) NOT NULL DEFAULT 0,
  responsiveness NUMERIC(3,2) NOT NULL DEFAULT 0,
  overall NUMERIC(3,2) NOT NULL DEFAULT 0,
  trend TEXT NOT NULL DEFAULT 'stable',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Delivery Performance Table ───
CREATE TABLE delivery_performance (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL UNIQUE REFERENCES purchase_orders(id) ON DELETE CASCADE,
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  promised_date TEXT NOT NULL,
  actual_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  delay_days INTEGER NOT NULL DEFAULT 0,
  on_time BOOLEAN DEFAULT true,
  days_difference INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Enable RLS ───
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_performance ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies (anon + authenticated, full CRUD) ───
CREATE POLICY "anon_select_vendors" ON vendors FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_vendors" ON vendors FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_vendors" ON vendors FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_vendors" ON vendors FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "anon_select_purchase_orders" ON purchase_orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_purchase_orders" ON purchase_orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_purchase_orders" ON purchase_orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_purchase_orders" ON purchase_orders FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "anon_select_vendor_ratings" ON vendor_ratings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_vendor_ratings" ON vendor_ratings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_vendor_ratings" ON vendor_ratings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_vendor_ratings" ON vendor_ratings FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "anon_select_delivery_performance" ON delivery_performance FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_delivery_performance" ON delivery_performance FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_delivery_performance" ON delivery_performance FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_delivery_performance" ON delivery_performance FOR DELETE TO anon, authenticated USING (true);

-- ─── Indexes ───
CREATE INDEX idx_vendors_vendor_code ON vendors(vendor_code);
CREATE INDEX idx_vendors_name ON vendors(name);
CREATE INDEX idx_vendors_category ON vendors(category);
CREATE INDEX idx_vendors_status ON vendors(status);

CREATE INDEX idx_purchase_orders_vendor_id ON purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_delivery_status ON purchase_orders(delivery_status);
CREATE INDEX idx_purchase_orders_created_at ON purchase_orders(created_at);
CREATE INDEX idx_purchase_orders_delivery_date ON purchase_orders(delivery_date);

CREATE INDEX idx_vendor_ratings_vendor_id ON vendor_ratings(vendor_id);
CREATE INDEX idx_vendor_ratings_overall ON vendor_ratings(overall);
CREATE INDEX idx_vendor_ratings_trend ON vendor_ratings(trend);

CREATE INDEX idx_delivery_performance_vendor_id ON delivery_performance(vendor_id);
CREATE INDEX idx_delivery_performance_status ON delivery_performance(status);
CREATE INDEX idx_delivery_performance_on_time ON delivery_performance(on_time);
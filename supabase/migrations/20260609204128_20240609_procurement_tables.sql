-- Migration: procurement tables + catalog_items with RLS, indexes, seed data

-- ============================================================
-- 1. catalog_items
-- ============================================================
CREATE TABLE IF NOT EXISTS catalog_items (
  id text PRIMARY KEY,
  name text NOT NULL,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  category text,
  unit text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_items_select" ON catalog_items FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "catalog_items_insert" ON catalog_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "catalog_items_update" ON catalog_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "catalog_items_delete" ON catalog_items FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_catalog_items_name ON catalog_items(name);

-- ============================================================
-- 2. vendors
-- ============================================================
CREATE TABLE IF NOT EXISTS vendors (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  location text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  risk_score integer NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'low',
  delivery_score integer NOT NULL DEFAULT 0,
  quality_score integer NOT NULL DEFAULT 0,
  cost_score integer NOT NULL DEFAULT 0,
  sustainability_score integer NOT NULL DEFAULT 0,
  innovation_score integer NOT NULL DEFAULT 0,
  lead_time integer NOT NULL DEFAULT 0,
  min_order integer NOT NULL DEFAULT 0,
  payment_terms text NOT NULL DEFAULT 'Net 30',
  certifications text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors_select" ON vendors FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "vendors_insert" ON vendors FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "vendors_update" ON vendors FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "vendors_delete" ON vendors FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);

-- ============================================================
-- 3. purchase_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id text PRIMARY KEY,
  vendor_id text NOT NULL,
  vendor_name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  total integer NOT NULL DEFAULT 0,
  subtotal integer NOT NULL DEFAULT 0,
  tax integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ordered',
  delivery_status text,
  created_at date NOT NULL DEFAULT now(),
  delivery_date date NOT NULL,
  actual_delivery_date date,
  priority text NOT NULL DEFAULT 'medium',
  delivery_notes jsonb NOT NULL DEFAULT '[]'
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_orders_select" ON purchase_orders FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "purchase_orders_insert" ON purchase_orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "purchase_orders_update" ON purchase_orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "purchase_orders_delete" ON purchase_orders FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_delivery_status ON purchase_orders(delivery_status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON purchase_orders(created_at DESC);

-- ============================================================
-- 4. vendor_ratings
-- ============================================================
CREATE TABLE IF NOT EXISTS vendor_ratings (
  id text PRIMARY KEY,
  vendor_id text NOT NULL UNIQUE,
  vendor_name text NOT NULL,
  overall integer NOT NULL DEFAULT 0,
  delivery integer NOT NULL DEFAULT 0,
  quality integer NOT NULL DEFAULT 0,
  cost integer NOT NULL DEFAULT 0,
  sustainability integer NOT NULL DEFAULT 0,
  innovation integer NOT NULL DEFAULT 0,
  last_reviewed text NOT NULL,
  strengths text[] NOT NULL DEFAULT '{}',
  weaknesses text[] NOT NULL DEFAULT '{}',
  review text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vendor_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_ratings_select" ON vendor_ratings FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "vendor_ratings_insert" ON vendor_ratings FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "vendor_ratings_update" ON vendor_ratings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "vendor_ratings_delete" ON vendor_ratings FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_vendor_ratings_vendor_id ON vendor_ratings(vendor_id);

-- ============================================================
-- 5. delivery_performance
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_performance (
  id text PRIMARY KEY,
  po_id text NOT NULL UNIQUE,
  vendor_id text NOT NULL,
  vendor_name text NOT NULL,
  promised_date date NOT NULL,
  actual_date date,
  status text NOT NULL DEFAULT 'on-time',
  delay_days integer NOT NULL DEFAULT 0,
  on_time boolean NOT NULL DEFAULT true,
  days_difference integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_performance_select" ON delivery_performance FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "delivery_performance_insert" ON delivery_performance FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "delivery_performance_update" ON delivery_performance FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delivery_performance_delete" ON delivery_performance FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_delivery_performance_po_id ON delivery_performance(po_id);
CREATE INDEX IF NOT EXISTS idx_delivery_performance_vendor_id ON delivery_performance(vendor_id);

-- ============================================================
-- Seed data
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vendors LIMIT 1) THEN

    INSERT INTO vendors (id, name, category, location, status, risk_score, risk_level, delivery_score, quality_score, cost_score, sustainability_score, innovation_score, lead_time, min_order, payment_terms, certifications) VALUES
      ('V-001', 'Acme Manufacturing', 'Electronics', 'Shenzhen, China', 'active', 45, 'medium', 85, 90, 75, 60, 80, 14, 5000, 'Net 30', Array['ISO 9001', 'ISO 14001']),
      ('V-002', 'Global Parts Ltd', 'Automotive', 'Stuttgart, Germany', 'active', 25, 'low', 92, 88, 70, 75, 85, 21, 10000, 'Net 45', Array['IATF 16949', 'ISO 9001']),
      ('V-003', 'Pacific Logistics', 'Logistics', 'Singapore', 'active', 60, 'medium', 78, 82, 80, 55, 65, 7, 2000, 'Net 15', Array['ISO 9001']),
      ('V-004', 'Nordic Components', 'Electronics', 'Helsinki, Finland', 'active', 15, 'low', 95, 94, 65, 90, 88, 28, 3000, 'Net 60', Array['ISO 9001', 'ISO 14001', 'RoHS']),
      ('V-005', 'TexSource International', 'Textiles', 'Mumbai, India', 'active', 70, 'high', 72, 75, 85, 50, 60, 10, 1000, 'Net 30', Array['OEKO-TEX', 'GOTS']),
      ('V-006', 'EuroChem Supplies', 'Chemicals', 'Rotterdam, Netherlands', 'active', 55, 'medium', 80, 85, 78, 70, 75, 14, 5000, 'Net 30', Array['ISO 9001', 'REACH']),
      ('V-007', 'SteelWorks Corp', 'Metals', 'Pittsburgh, USA', 'active', 30, 'low', 88, 87, 72, 65, 70, 21, 15000, 'Net 45', Array['ISO 9001', 'ASTM']),
      ('V-008', 'GreenPack Solutions', 'Packaging', 'Melbourne, Australia', 'active', 20, 'low', 90, 92, 68, 95, 82, 14, 2000, 'Net 30', Array['FSC', 'ISO 14001']),
      ('V-009', 'TechComponents Inc', 'Electronics', 'Taipei, Taiwan', 'active', 40, 'medium', 86, 89, 77, 60, 92, 14, 3000, 'Net 30', Array['ISO 9001', 'IPC-A-610']),
      ('V-010', 'AgriSource Global', 'Agriculture', 'São Paulo, Brazil', 'active', 50, 'medium', 75, 80, 82, 70, 65, 10, 5000, 'Net 30', Array['Organic', 'Fair Trade']),
      ('V-011', 'MedSupply Pro', 'Medical', 'Boston, USA', 'active', 10, 'low', 96, 98, 60, 85, 90, 7, 1000, 'Net 15', Array['FDA', 'ISO 13485']),
      ('V-012', 'BuildRight Materials', 'Construction', 'Dubai, UAE', 'active', 65, 'high', 70, 78, 88, 55, 68, 14, 8000, 'Net 45', Array['ISO 9001', 'CE Mark']);

    INSERT INTO purchase_orders (id, vendor_id, vendor_name, items, total, subtotal, tax, status, delivery_status, created_at, delivery_date, actual_delivery_date, priority, delivery_notes) VALUES
      ('PO-2024-001', 'V-001', 'Acme Manufacturing', '[{"id":"li_1","name":"Electronic Components","quantity":100,"unitPrice":150,"total":15000}]', 16500, 15000, 1500, 'delivered', 'invoiced', '2024-01-15', '2024-02-01', '2024-02-03', 'high', '[]'),
      ('PO-2024-002', 'V-002', 'Global Parts Ltd', '[{"id":"li_2","name":"Automotive Parts","quantity":50,"unitPrice":800,"total":40000}]', 44000, 40000, 4000, 'delivered', 'invoiced', '2024-01-20', '2024-02-15', '2024-02-14', 'high', '[]'),
      ('PO-2024-003', 'V-003', 'Pacific Logistics', '[{"id":"li_3","name":"Logistics Services","quantity":1,"unitPrice":5000,"total":5000}]', 5500, 5000, 500, 'delivered', 'invoiced', '2024-02-01', '2024-02-10', '2024-02-10', 'medium', '[]'),
      ('PO-2024-004', 'V-004', 'Nordic Components', '[{"id":"li_4","name":"Semiconductor Chips","quantity":200,"unitPrice":75,"total":15000}]', 16500, 15000, 1500, 'delivered', 'invoiced', '2024-02-10', '2024-03-01', '2024-03-05', 'high', '[]'),
      ('PO-2024-005', 'V-005', 'TexSource International', '[{"id":"li_5","name":"Cotton Fabric","quantity":500,"unitPrice":25,"total":12500}]', 13750, 12500, 1250, 'delivered', 'invoiced', '2024-03-01', '2024-03-20', '2024-03-25', 'medium', '[]'),
      ('PO-2024-006', 'V-006', 'EuroChem Supplies', '[{"id":"li_6","name":"Industrial Chemicals","quantity":100,"unitPrice":200,"total":20000}]', 22000, 20000, 2000, 'delivered', 'invoiced', '2024-03-15', '2024-04-01', '2024-04-02', 'high', '[]'),
      ('PO-2024-007', 'V-007', 'SteelWorks Corp', '[{"id":"li_7","name":"Steel Beams","quantity":30,"unitPrice":1200,"total":36000}]', 39600, 36000, 3600, 'delivered', 'invoiced', '2024-04-01', '2024-04-20', '2024-04-22', 'medium', '[]'),
      ('PO-2024-008', 'V-008', 'GreenPack Solutions', '[{"id":"li_8","name":"Packaging Materials","quantity":1000,"unitPrice":8,"total":8000}]', 8800, 8000, 800, 'delivered', 'invoiced', '2024-04-10', '2024-04-25', '2024-04-24', 'low', '[]'),
      ('PO-2024-009', 'V-009', 'TechComponents Inc', '[{"id":"li_9","name":"PCB Boards","quantity":150,"unitPrice":120,"total":18000}]', 19800, 18000, 1800, 'delivered', 'invoiced', '2024-05-01', '2024-05-15', '2024-05-16', 'high', '[]'),
      ('PO-2024-010', 'V-010', 'AgriSource Global', '[{"id":"li_10","name":"Organic Fertilizer","quantity":200,"unitPrice":45,"total":9000}]', 9900, 9000, 900, 'delivered', 'invoiced', '2024-05-15', '2024-06-01', '2024-06-02', 'medium', '[]'),
      ('PO-2024-011', 'V-001', 'Acme Manufacturing', '[{"id":"li_11","name":"LED Displays","quantity":75,"unitPrice":200,"total":15000}]', 16500, 15000, 1500, 'in-transit', 'in-transit', '2024-06-01', '2024-06-20', NULL, 'high', '[]'),
      ('PO-2024-012', 'V-002', 'Global Parts Ltd', '[{"id":"li_12","name":"Engine Components","quantity":40,"unitPrice":950,"total":38000}]', 41800, 38000, 3800, 'confirmed', 'confirmed', '2024-06-10', '2024-07-01', NULL, 'high', '[]'),
      ('PO-2024-013', 'V-011', 'MedSupply Pro', '[{"id":"li_13","name":"Medical Supplies","quantity":300,"unitPrice":60,"total":18000}]', 19800, 18000, 1800, 'ordered', 'ordered', '2024-06-15', '2024-07-10', NULL, 'high', '[]'),
      ('PO-2024-014', 'V-012', 'BuildRight Materials', '[{"id":"li_14","name":"Construction Materials","quantity":50,"unitPrice":600,"total":30000}]', 33000, 30000, 3000, 'ordered', 'ordered', '2024-06-20', '2024-07-15', NULL, 'medium', '[]'),
      ('PO-2024-015', 'V-004', 'Nordic Components', '[{"id":"li_15","name":"Microcontrollers","quantity":250,"unitPrice":85,"total":21250}]', 23375, 21250, 2125, 'in-transit', 'in-transit', '2024-07-01', '2024-07-20', NULL, 'high', '[]'),
      ('PO-2024-016', 'V-003', 'Pacific Logistics', '[{"id":"li_16","name":"Shipping Services","quantity":1,"unitPrice":8000,"total":8000}]', 8800, 8000, 800, 'confirmed', 'confirmed', '2024-07-05', '2024-07-25', NULL, 'medium', '[]'),
      ('PO-2024-017', 'V-005', 'TexSource International', '[{"id":"li_17","name":"Synthetic Fabric","quantity":400,"unitPrice":30,"total":12000}]', 13200, 12000, 1200, 'ordered', 'ordered', '2024-07-10', '2024-08-01', NULL, 'low', '[]'),
      ('PO-2024-018', 'V-006', 'EuroChem Supplies', '[{"id":"li_18","name":"Lab Chemicals","quantity":80,"unitPrice":250,"total":20000}]', 22000, 20000, 2000, 'in-transit', 'in-transit', '2024-07-15', '2024-08-05', NULL, 'high', '[]'),
      ('PO-2024-019', 'V-007', 'SteelWorks Corp', '[{"id":"li_19","name":"Aluminum Sheets","quantity":60,"unitPrice":500,"total":30000}]', 33000, 30000, 3000, 'ordered', 'ordered', '2024-08-01', '2024-08-20', NULL, 'medium', '[]'),
      ('PO-2024-020', 'V-008', 'GreenPack Solutions', '[{"id":"li_20","name":"Eco Packaging","quantity":1500,"unitPrice":6,"total":9000}]', 9900, 9000, 900, 'confirmed', 'confirmed', '2024-08-05', '2024-08-25', NULL, 'low', '[]'),
      ('PO-2024-021', 'V-009', 'TechComponents Inc', '[{"id":"li_21","name":"Connectors","quantity":500,"unitPrice":15,"total":7500}]', 8250, 7500, 750, 'ordered', 'ordered', '2024-08-10', '2024-09-01', NULL, 'medium', '[]'),
      ('PO-2024-022', 'V-010', 'AgriSource Global', '[{"id":"li_22","name":"Seeds","quantity":1000,"unitPrice":12,"total":12000}]', 13200, 12000, 1200, 'in-transit', 'in-transit', '2024-08-15', '2024-09-05', NULL, 'medium', '[]'),
      ('PO-2024-023', 'V-011', 'MedSupply Pro', '[{"id":"li_23","name":"Surgical Instruments","quantity":200,"unitPrice":120,"total":24000}]', 26400, 24000, 2400, 'confirmed', 'confirmed', '2024-09-01', '2024-09-20', NULL, 'high', '[]'),
      ('PO-2024-024', 'V-012', 'BuildRight Materials', '[{"id":"li_24","name":"Concrete Mix","quantity":100,"unitPrice":180,"total":18000}]', 19800, 18000, 1800, 'ordered', 'ordered', '2024-09-05', '2024-09-25', NULL, 'medium', '[]'),
      ('PO-2024-025', 'V-001', 'Acme Manufacturing', '[{"id":"li_25","name":"Power Supplies","quantity":120,"unitPrice":180,"total":21600}]', 23760, 21600, 2160, 'ordered', 'ordered', '2024-09-10', '2024-10-01', NULL, 'high', '[]');

    INSERT INTO vendor_ratings (id, vendor_id, vendor_name, overall, delivery, quality, cost, sustainability, innovation, last_reviewed, strengths, weaknesses, review) VALUES
      ('VR-001', 'V-001', 'Acme Manufacturing', 78, 85, 90, 75, 60, 80, '2024-06-15', Array['Quality control', 'Fast delivery'], Array['Higher costs', 'Limited sustainability'], ''),
      ('VR-002', 'V-002', 'Global Parts Ltd', 82, 92, 88, 70, 75, 85, '2024-06-10', Array['Reliable delivery', 'High quality'], Array['Premium pricing', 'Long lead times'], ''),
      ('VR-003', 'V-003', 'Pacific Logistics', 72, 78, 82, 80, 55, 65, '2024-06-20', Array['Competitive pricing', 'Good coverage'], Array['Inconsistent delivery', 'Limited innovation'], ''),
      ('VR-004', 'V-004', 'Nordic Components', 86, 95, 94, 65, 90, 88, '2024-06-01', Array['Excellent quality', 'Sustainable practices'], Array['Higher costs', 'Long lead times'], ''),
      ('VR-005', 'V-005', 'TexSource International', 68, 72, 75, 85, 50, 60, '2024-06-25', Array['Cost competitive', 'Good range'], Array['Quality issues', 'Poor sustainability'], ''),
      ('VR-006', 'V-006', 'EuroChem Supplies', 78, 80, 85, 78, 70, 75, '2024-06-18', Array['Good quality', 'Fair pricing'], Array['Delivery delays', 'Limited innovation'], ''),
      ('VR-007', 'V-007', 'SteelWorks Corp', 76, 88, 87, 72, 65, 70, '2024-06-12', Array['Strong quality', 'Reliable'], Array['Higher costs', 'Limited sustainability'], ''),
      ('VR-008', 'V-008', 'GreenPack Solutions', 85, 90, 92, 68, 95, 82, '2024-06-08', Array['Sustainable leader', 'Good quality'], Array['Higher costs', 'Limited range'], ''),
      ('VR-009', 'V-009', 'TechComponents Inc', 81, 86, 89, 77, 60, 92, '2024-06-14', Array['Innovative', 'Good quality'], Array['Higher costs', 'Limited sustainability'], ''),
      ('VR-010', 'V-010', 'AgriSource Global', 74, 75, 80, 82, 70, 65, '2024-06-22', Array['Fair pricing', 'Good quality'], Array['Inconsistent delivery', 'Limited innovation'], ''),
      ('VR-011', 'V-011', 'MedSupply Pro', 92, 96, 98, 60, 85, 90, '2024-06-05', Array['Excellent quality', 'Fast delivery'], Array['Very expensive', 'Limited range'], ''),
      ('VR-012', 'V-012', 'BuildRight Materials', 68, 70, 78, 88, 55, 68, '2024-06-28', Array['Cost competitive', 'Good range'], Array['Quality issues', 'Poor sustainability'], '');

    INSERT INTO delivery_performance (id, po_id, vendor_id, vendor_name, promised_date, actual_date, status, delay_days, on_time, days_difference) VALUES
      ('dp-PO-2024-001', 'PO-2024-001', 'V-001', 'Acme Manufacturing', '2024-02-01', '2024-02-03', 'delayed', 2, false, -2),
      ('dp-PO-2024-002', 'PO-2024-002', 'V-002', 'Global Parts Ltd', '2024-02-15', '2024-02-14', 'on-time', 0, true, 1),
      ('dp-PO-2024-003', 'PO-2024-003', 'V-003', 'Pacific Logistics', '2024-02-10', '2024-02-10', 'on-time', 0, true, 0),
      ('dp-PO-2024-004', 'PO-2024-004', 'V-004', 'Nordic Components', '2024-03-01', '2024-03-05', 'delayed', 4, false, -4),
      ('dp-PO-2024-005', 'PO-2024-005', 'V-005', 'TexSource International', '2024-03-20', '2024-03-25', 'delayed', 5, false, -5),
      ('dp-PO-2024-006', 'PO-2024-006', 'V-006', 'EuroChem Supplies', '2024-04-01', '2024-04-02', 'delayed', 1, false, -1),
      ('dp-PO-2024-007', 'PO-2024-007', 'V-007', 'SteelWorks Corp', '2024-04-20', '2024-04-22', 'delayed', 2, false, -2),
      ('dp-PO-2024-008', 'PO-2024-008', 'V-008', 'GreenPack Solutions', '2024-04-25', '2024-04-24', 'on-time', 0, true, 1),
      ('dp-PO-2024-009', 'PO-2024-009', 'V-009', 'TechComponents Inc', '2024-05-15', '2024-05-16', 'delayed', 1, false, -1),
      ('dp-PO-2024-010', 'PO-2024-010', 'V-010', 'AgriSource Global', '2024-06-01', '2024-06-02', 'delayed', 1, false, -1);

  END IF;
END $$;

-- ============================================================
-- Seed catalog_items
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM catalog_items LIMIT 1) THEN
    INSERT INTO catalog_items (id, name, unit_price) VALUES
      ('CAT-001', 'Electronic Components', 150),
      ('CAT-002', 'Automotive Parts', 800),
      ('CAT-003', 'Logistics Services', 5000),
      ('CAT-004', 'Semiconductor Chips', 75),
      ('CAT-005', 'Cotton Fabric', 25),
      ('CAT-006', 'Industrial Chemicals', 200),
      ('CAT-007', 'Steel Beams', 1200),
      ('CAT-008', 'Packaging Materials', 8),
      ('CAT-009', 'PCB Boards', 120),
      ('CAT-010', 'Organic Fertilizer', 45),
      ('CAT-011', 'LED Displays', 200),
      ('CAT-012', 'Engine Components', 950),
      ('CAT-013', 'Medical Supplies', 60),
      ('CAT-014', 'Construction Materials', 600),
      ('CAT-015', 'Microcontrollers', 85),
      ('CAT-016', 'Shipping Services', 8000),
      ('CAT-017', 'Synthetic Fabric', 30),
      ('CAT-018', 'Lab Chemicals', 250),
      ('CAT-019', 'Aluminum Sheets', 500),
      ('CAT-020', 'Eco Packaging', 6),
      ('CAT-021', 'Connectors', 15),
      ('CAT-022', 'Seeds', 12),
      ('CAT-023', 'Surgical Instruments', 120),
      ('CAT-024', 'Concrete Mix', 180),
      ('CAT-025', 'Power Supplies', 180),
      ('CAT-026', 'Resistors', 0.5),
      ('CAT-027', 'Capacitors', 1.2),
      ('CAT-028', 'Inductors', 2.5),
      ('CAT-029', 'Diodes', 0.8),
      ('CAT-030', 'Transistors', 3.5);
  END IF;
END $$;

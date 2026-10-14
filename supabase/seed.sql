-- Development seed: fake accounts and sample freight data. NEVER run on production.
-- All people and companies are invented; addresses use the reserved .test
-- domain, which can never be a real mailbox. Dates are relative to now(), so
-- the Overview cards (last 30 days, next 7 days) always have something to show.
-- Re-runnable: everything is keyed by fixed IDs and replaced.
--
-- Sign in without OAuth by opening, on localhost:
--   http://localhost:3000/overview?session=dev-owner   (Dana Owner, manager, Professional plan)
--   http://localhost:3000/overview?session=dev-agent   (Ravi Agent, team member)
--   http://localhost:3000/overview?session=dev-solo    (Sam Solo, no team, trial)
-- These sessions have no mailbox: Overview, Shipments, Quotes, Rates, Team,
-- Settings and the Inbox's "not replied" lists work; loading a live inbox
-- shows "Reconnect Gmail". To test a real mailbox, sign in with Google or
-- Outlook on localhost as usual (it is stored in this dev project only).

-- Safety net: runs only on an empty development database (no accounts outside
-- .test) or on one this seed already ran on (its fake team exists). The
-- production project has real accounts and never this team, so it is refused.
-- (Signing in on localhost adds your own test mailbox to the dev project; the
-- marker keeps the seed usable there.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email NOT LIKE '%.test')
     AND NOT EXISTS (SELECT 1 FROM public.teams WHERE id = '00000000-0000-4000-8000-000000000010') THEN
    RAISE EXCEPTION 'This database has real (non-.test) accounts and was never seeded. The dev seed only runs on the development project.';
  END IF;
END $$;

-- Fixed IDs
-- owner 00000000-0000-4000-8000-000000000001, agent ...0002, solo ...0003, team ...0010

DELETE FROM public.customer_portals WHERE token LIKE 'dev-%';
DELETE FROM public.shipments WHERE user_id IN ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003');
DELETE FROM public.quotes WHERE session_id LIKE 'dev-%';
DELETE FROM public.rate_cards WHERE session_id LIKE 'dev-%';
DELETE FROM public.email_activity WHERE email_id LIKE 'dev-%';
DELETE FROM public.email_analysis WHERE email_id LIKE 'dev-%';
DELETE FROM public.company_profiles WHERE owner_user_id = '00000000-0000-4000-8000-000000000001';
DELETE FROM public.gmail_sessions WHERE session_id LIKE 'dev-%';
DELETE FROM public.subscriptions WHERE user_email LIKE '%@demo-forwarding.test';
UPDATE public.profiles SET team_id = NULL WHERE id IN ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');
DELETE FROM public.teams WHERE id = '00000000-0000-4000-8000-000000000010';
DELETE FROM public.profiles WHERE id IN ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003');

-- ---- Accounts ------------------------------------------------------------------
INSERT INTO public.profiles (id, email, full_name, role, plan) VALUES
  ('00000000-0000-4000-8000-000000000001', 'dana.owner@demo-forwarding.test', 'Dana Owner', 'manager', 'professional'),
  ('00000000-0000-4000-8000-000000000002', 'ravi.agent@demo-forwarding.test', 'Ravi Agent', 'employee', 'professional'),
  ('00000000-0000-4000-8000-000000000003', 'sam.solo@demo-forwarding.test', 'Sam Solo', 'employee', 'trial');

INSERT INTO public.teams (id, name, manager_id, invite_code) VALUES
  ('00000000-0000-4000-8000-000000000010', 'Demo Forwarding · Rotterdam Desk', '00000000-0000-4000-8000-000000000001', 'DEMO-RTM');
UPDATE public.profiles SET team_id = '00000000-0000-4000-8000-000000000010'
  WHERE id IN ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');

INSERT INTO public.subscriptions (session_id, user_email, plan, status, trial_analyses_used, current_period_start, current_period_end) VALUES
  ('dev-owner', 'dana.owner@demo-forwarding.test', 'professional', 'active', 0, now() - interval '10 days', now() + interval '20 days'),
  ('dev-agent', 'ravi.agent@demo-forwarding.test', 'professional', 'active', 0, now() - interval '10 days', now() + interval '20 days'),
  ('dev-solo', 'sam.solo@demo-forwarding.test', 'trial', 'trialing', 7, NULL, NULL);

-- Sessions without mailbox tokens (see the header)
INSERT INTO public.gmail_sessions (session_id, user_id, gmail_email, user_name, provider) VALUES
  ('dev-owner', '00000000-0000-4000-8000-000000000001', 'dana.owner@demo-forwarding.test', 'Dana Owner', 'google'),
  ('dev-agent', '00000000-0000-4000-8000-000000000002', 'ravi.agent@demo-forwarding.test', 'Ravi Agent', 'google'),
  ('dev-solo', '00000000-0000-4000-8000-000000000003', 'sam.solo@demo-forwarding.test', 'Sam Solo', 'outlook');

-- Our own test mailbox, when it has signed in on localhost: internal plan (no
-- limits), as in production. Only touches the dev project (see the safety net).
INSERT INTO public.subscriptions (user_email, plan, status, trial_analyses_used)
VALUES ('freightzard@gmail.com', 'internal', 'active', 0)
ON CONFLICT (user_email) DO UPDATE SET plan = 'internal', status = 'active', updated_at = now();

-- ---- Company profile (Netherlands, with a kept Brazilian CNPJ) ------------------
INSERT INTO public.company_profiles (owner_user_id, country, legal_name, trade_name, identifiers, address, contact_name, contact_email, phone_country, phone_number, updated_by) VALUES
  ('00000000-0000-4000-8000-000000000001', 'NL', 'Demo Forwarding B.V.', 'Demo Forwarding',
   '{"NL": {"vat": "NL123456789B01", "eori": "NL123456789", "reg": "12345678"}, "BR": {"cnpj": "11.222.333/0001-81"}}',
   '{"line1": "Wilhelminakade 1", "postal_code": "3072 AP", "city": "Rotterdam"}',
   'Dana Owner', 'dana.owner@demo-forwarding.test', 'NL', '10 123 4567', '00000000-0000-4000-8000-000000000001');

-- ---- Analysed emails --------------------------------------------------------------
INSERT INTO public.email_analysis (email_id, user_id, gmail_session_id, thread_id, subject, from_email, intent, priority, mode, pol, pod, incoterm, cargo_type, container_type, container_count, missing_info, summary, suggested_reply, replied_at, response_time_minutes, created_at) VALUES
  ('dev-e01', '00000000-0000-4000-8000-000000000001', 'dev-owner', 'dev-t01', 'RFQ: 2x40HC Santos → Rotterdam, soybean meal', 'marta@agro-exemplo.test',
   'quote_request', 'urgent', 'ocean', 'BRSSZ', 'NLRTM', NULL, 'Soybean meal', '40HC', 2, '["Incoterm", "Cargo ready date"]',
   'Quote request for 2x40HC soybean meal Santos to Rotterdam with on-carriage to Venlo.', E'Hi Marta,\n\nThanks for your request. Could you share the incoterm and cargo ready date so we can confirm the rate?\n\nBest regards,\nDana', NULL, NULL, now() - interval '3 hours'),
  ('dev-e02', '00000000-0000-4000-8000-000000000001', 'dev-owner', 'dev-t02', 'Booking confirmation MSKU4820193 – ETA update', 'bookings@carrier-demo.test',
   'booking_confirmation', 'high', 'ocean', 'CNSHA', 'NLRTM', 'CIF', 'Electronics', '40HC', 1, '[]',
   'Carrier moved the ETA for booking 248119 to next Tuesday.', E'Hello,\n\nNoted, thank you. We have updated the ETA.\n\nBest regards,\nDana', now() - interval '20 hours', 40, now() - interval '21 hours'),
  ('dev-e03', '00000000-0000-4000-8000-000000000001', 'dev-owner', 'dev-t03', 'Where is container TGHU7710226?', 'ops@haulage-demo.test',
   'tracking_inquiry', 'medium', 'road', 'BEANR', 'DEDUS', NULL, NULL, NULL, NULL, '[]',
   'Customer asks for an update on TGHU7710226 after gate-out in Antwerp.', E'Hi,\n\nWe are checking with the haulier and will update you within the hour.\n\nBest regards,\nDana', NULL, NULL, now() - interval '2 days'),
  ('dev-e04', '00000000-0000-4000-8000-000000000001', 'dev-owner', 'dev-t04', 'CE Mercante 152305012345678 – AFRMM pendente?', 'ana@importadora-exemplo.test',
   'afrmm_status_check', 'high', 'ocean', 'ITGOA', 'BRSSZ', NULL, NULL, NULL, NULL, '[]',
   'Client asks whether the AFRMM for CE 152305012345678 has been paid.', E'Bom dia Ana,\n\nVamos verificar o status do AFRMM e retornamos ainda hoje.\n\nAtenciosamente,\nDana', NULL, NULL, now() - interval '4 days'),
  ('dev-e05', '00000000-0000-4000-8000-000000000001', 'dev-owner', 'dev-t05', 'Air freight 480 kg Shenzhen → Amsterdam', 'li.wei@exports-demo.test',
   'quote_request', 'low', 'air', 'CNSZX', 'NLAMS', 'EXW', 'Spare parts', NULL, NULL, '["Commodity HS code"]',
   'Air quote request, 480 kg / 3.1 cbm, SZX to AMS, ready Friday.', E'Hi Li Wei,\n\nThanks. Could you confirm the HS code of the spare parts?\n\nBest regards,\nDana', now() - interval '5 days', 95, now() - interval '5 days 2 hours'),
  ('dev-e06', '00000000-0000-4000-8000-000000000001', 'dev-owner', 'dev-t06', 'Documents required: T1 for MRN 26NL0000123456', 'customs@broker-demo.test',
   'documentation_request', 'medium', 'road', NULL, NULL, NULL, NULL, NULL, NULL, '["T1 transit document"]',
   'Customs broker needs the T1 transit document for the shipment.', E'Hello,\n\nPlease find the T1 attached.\n\nBest regards,\nDana', NULL, NULL, now() - interval '9 days'),
  ('dev-e07', '00000000-0000-4000-8000-000000000001', 'dev-owner', 'dev-t07', 'Your weekly freight market newsletter', 'news@market-letter.test',
   'marketing', 'low', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]',
   'Newsletter or marketing email (List-Unsubscribe header). Not sent to AI; no analysis used.', '', NULL, NULL, now() - interval '1 day'),
  ('dev-e08', '00000000-0000-4000-8000-000000000002', 'dev-agent', 'dev-t08', 'Rail slots Duisburg – Małaszewicze week 42', 'planning@rail-demo.test',
   'booking_confirmation', 'medium', 'rail', 'DEDUI', 'PLMAL', 'FCA', 'Containers', '40HC', 4, '[]',
   'Four rail slots confirmed on the Duisburg block train for week 42.', E'Hi,\n\nThank you, confirmed on our side.\n\nBest regards,\nRavi', now() - interval '6 days', 25, now() - interval '6 days 1 hour'),
  ('dev-e09', '00000000-0000-4000-8000-000000000002', 'dev-agent', 'dev-t09', 'URGENT: reefer temperature alarm MSCU5551234', 'reefer@terminal-demo.test',
   'tracking_inquiry', 'urgent', 'ocean', 'ESVLC', 'NLRTM', NULL, 'Citrus', '40RH', 1, '["Set point confirmation"]',
   'Terminal reports a temperature alarm on reefer MSCU5551234 at Valencia.', E'Hello,\n\nPlease confirm the set point is -1 °C; we are informing the shipper now.\n\nBest regards,\nRavi', NULL, NULL, now() - interval '5 hours'),
  ('dev-e10', '00000000-0000-4000-8000-000000000003', 'dev-solo', 'dev-t10', 'LCL quote Genoa → Santos, 6 pallets', 'compras@cliente-exemplo.test',
   'quote_request', 'high', 'ocean', 'ITGOA', 'BRSSZ', 'FOB', 'Machine parts', NULL, NULL, '["Dimensions per pallet"]',
   'LCL quote request for 6 pallets of machine parts from Genoa to Santos.', E'Olá,\n\nPodem enviar as dimensões de cada palete?\n\nAtenciosamente,\nSam', NULL, NULL, now() - interval '1 day');

INSERT INTO public.email_activity (user_id, email_id, action, created_at)
  SELECT user_id, email_id, 'received', created_at FROM public.email_analysis WHERE email_id LIKE 'dev-%';
INSERT INTO public.email_activity (user_id, email_id, action, intent, priority, created_at)
  SELECT user_id, email_id, 'analyzed', intent, priority, created_at + interval '2 minutes' FROM public.email_analysis WHERE email_id LIKE 'dev-%';
INSERT INTO public.email_activity (user_id, email_id, action, intent, priority, response_time_minutes, created_at)
  SELECT user_id, email_id, 'replied', intent, priority, response_time_minutes, replied_at FROM public.email_analysis WHERE email_id LIKE 'dev-%' AND replied_at IS NOT NULL;

-- ---- Shipments ----------------------------------------------------------------------
INSERT INTO public.shipments (id, user_id, status, reference, customer, origin, destination, mode, commodity, weight, container, incoterm, etd, eta, carrier, notes, booking_number, email_id, email_subject, ai_generated, approved, created_at) VALUES
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'booked', 'FW-26-0412', 'Agro Exemplo Ltda', 'Santos, BR', 'Rotterdam, NL', 'ocean', 'Soybean meal', '52,000 KG', '2x40HC', 'FOB',
   to_char(now() + interval '6 days', 'YYYY-MM-DD'), to_char(now() + interval '28 days', 'YYYY-MM-DD'), 'Maersk', '', 'BKG-248119', 'dev-e01', 'RFQ: 2x40HC Santos → Rotterdam, soybean meal', true, true, now() - interval '3 days'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'in_transit', 'FW-26-0398', 'Holland Demo BV', 'Shanghai, CN', 'Rotterdam, NL', 'ocean', 'Electronics', '18,400 KG', '1x40HC', 'CIF',
   to_char(now() - interval '20 days', 'YYYY-MM-DD'), to_char(now() + interval '4 days', 'YYYY-MM-DD'), 'MSC', '', 'BKG-248120', 'dev-e02', 'Booking confirmation MSKU4820193 – ETA update', false, true, now() - interval '25 days'),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'at_destination', 'FW-26-0377', 'Importadora Exemplo', 'Genoa, IT', 'Santos, BR', 'ocean', 'Machinery', '24,000 KG', '1x40FR', 'DAP',
   to_char(now() - interval '30 days', 'YYYY-MM-DD'), to_char(now() - interval '1 day', 'YYYY-MM-DD'), 'CMA CGM', 'Awaiting customs release', NULL, 'dev-e04', NULL, false, true, now() - interval '35 days'),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000002', 'quoted', 'FW-26-0416', 'Rail Demo Partners', 'Duisburg, DE', 'Małaszewicze, PL', 'rail', 'Containers', '', '4x40HC', 'FCA',
   to_char(now() + interval '14 days', 'YYYY-MM-DD'), to_char(now() + interval '18 days', 'YYYY-MM-DD'), '', '', NULL, 'dev-e08', NULL, false, true, now() - interval '6 days'),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 'inquiry', 'FW-26-0420', 'Exports Demo Co.', 'Shenzhen, CN', 'Amsterdam, NL', 'air', 'Spare parts', '480 KG', '', 'EXW',
   '', '', '', '', NULL, 'dev-e05', 'Air freight 480 kg Shenzhen → Amsterdam', true, false, now() - interval '5 days');

INSERT INTO public.shipment_events (shipment_id, source, event_type, description, location, event_at) VALUES
  ('00000000-0000-4000-8000-000000000102', 'manual', 'vessel_departed', 'Vessel departed', 'Shanghai, CN', now() - interval '20 days'),
  ('00000000-0000-4000-8000-000000000102', 'manual', 'transshipment', 'Transshipment', 'Singapore, SG', now() - interval '12 days');

INSERT INTO public.customer_portals (token, shipment_id, session_id, title, show_carrier, show_rate, message) VALUES
  ('dev-portal-demo', '00000000-0000-4000-8000-000000000102', 'dev-owner', 'Your shipment Shanghai → Rotterdam', true, false, 'Your container is on its way. We will confirm the delivery slot once it arrives.');

-- ---- Quotes and rates --------------------------------------------------------------------
INSERT INTO public.quotes (session_id, email_id, email_subject, customer_name, customer_email, origin, destination, mode, commodity, container_type, weight, incoterm, carrier, sell_rate, currency, transit_time, validity_date, notes, charges, status, created_at) VALUES
  ('dev-owner', 'dev-e01', 'RFQ: 2x40HC Santos → Rotterdam, soybean meal', 'Agro Exemplo Ltda', 'marta@agro-exemplo.test', 'Santos, BR', 'Rotterdam, NL', 'ocean', 'Soybean meal', '40HC', '52,000 KG', 'FOB', 'Maersk',
   3850, 'USD', '22 days', (now() + interval '17 days')::date, 'Rates subject to space availability.', '[{"name": "Ocean freight 2x40HC", "amount": 3400}, {"name": "THC origin", "amount": 450}]', 'sent', now() - interval '2 hours'),
  ('dev-owner', 'dev-e05', 'Air freight 480 kg Shenzhen → Amsterdam', 'Exports Demo Co.', 'li.wei@exports-demo.test', 'Shenzhen, CN', 'Amsterdam, NL', 'air', 'Spare parts', NULL, '480 KG', 'EXW', NULL,
   2150, 'EUR', '3 days', (now() + interval '7 days')::date, NULL, '[{"name": "Air freight", "amount": 1900}, {"name": "Pick-up", "amount": 250}]', 'draft', now() - interval '1 day');

INSERT INTO public.rate_cards (session_id, origin, destination, mode, carrier, container_type, buy_rate, sell_rate, currency, transit_time, validity_start, validity_end, notes) VALUES
  ('dev-owner', 'Santos, BR', 'Rotterdam, NL', 'ocean', 'Maersk', '40HC', 1550, 1700, 'USD', '22 days', (now() - interval '10 days')::date, (now() + interval '20 days')::date, 'Weekly service'),
  ('dev-owner', 'Shanghai, CN', 'Rotterdam, NL', 'ocean', 'MSC', '40HC', 2100, 2400, 'USD', '32 days', (now() - interval '5 days')::date, (now() + interval '9 days')::date, NULL),
  ('dev-owner', 'Shenzhen, CN', 'Amsterdam, NL', 'air', 'Demo Air Cargo', NULL, 3.9, 4.5, 'EUR', '3 days', (now() - interval '1 day')::date, (now() + interval '60 days')::date, 'Per kg, min 100 kg');

INSERT INTO incidents (title, incident_type, occurred_at, source, confidence, severity_weight, status, region, geom)
VALUES
('Disparo reportado em via principal','tiroteio',NOW() - INTERVAL '2 hours','central-190',0.95,1.50,'confirmado','Centro',ST_SetSRID(ST_MakePoint(-43.1767,-22.9068),4326)::geography),
('Roubo de celular em ponto de onibus','roubo',NOW() - INTERVAL '6 hours','boletim-online',0.88,1.20,'confirmado','Lapa',ST_SetSRID(ST_MakePoint(-43.1790,-22.9130),4326)::geography),
('Tentativa de homicidio em viela','homicidio',NOW() - INTERVAL '10 hours','central-190',0.90,1.60,'confirmado','Sao Cristovao',ST_SetSRID(ST_MakePoint(-43.2165,-22.8990),4326)::geography);

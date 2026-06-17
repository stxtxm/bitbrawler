ALTER TABLE characters ADD COLUMN IF NOT EXISTS equipped_items JSONB DEFAULT '{"weapon": null, "armor": null, "accessory": null}'::jsonb;
